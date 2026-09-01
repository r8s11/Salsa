-- =====================================================================
-- Founder Reissue, Revoke-via-Reissue, and History RPCs — Phase 9
-- =====================================================================
-- Purpose:
--   Adds the missing operational primitives Phase 9's brief requires:
--
--     1. admin_reissue_founder_invitation — the canonical "Reissue" action
--        (spec §11). For an approved Founder request: revoke any pending
--        invitation, mint a fresh token + fresh expiration, and return the
--        new plaintext token exactly once (like admin_create_founder_invitation).
--        The token is the sole credential; the previous token is now
--        cryptographically unreachable and its old invitation row is
--        'revoked' — enforced row-locked so concurrent reissue and
--        acceptance resolve deterministically (spec §19: "If recipient
--        accepts just before admin reissue, accepted must win").
--
--     2. admin_founder_invitation_history — ALL invitations for a request,
--        in created_at DESC order (spec §6). Exposes the historical
--        created/revoked/accepted lifecycle for the admin detail page.
--        Returns the same canonical fields as
--        admin_founder_invitation_for_request — token_hash is NEVER selected.
--
--     3. admin_founder_invitation_delivery_attempts — ALL delivery attempts
--        for one invitation, in attempt_number ASC order (spec §7). Powers
--        the Email History panel. Never exposes raw provider bodies; only
--        normalized error_code categories.
--
--   Per the brief's "do not duplicate primitives that are already correct"
--   rule, the existing `admin_create_founder_invitation` is left
--   byte-for-byte as shipped. The new `admin_reissue_founder_invitation`
--   is structurally similar but has different preconditions (accepts any
--   pending state, including fresh-active) and an explicit invariant
--   (no-accepted-on-this-request) that `admin_create_founder_invitation`
--   does not enforce — keeping them as two distinct RPCs matches the
--   existing 'create' vs 'reissue' admin-action terminology (spec §3).
--
-- Required: REQUIRED before deploying Phase 9 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: depends on public.founder_access_requests
--   (20260831000001), public.founder_invitations (20260831000004),
--   public.founder_invitation_delivery_attempts (20260831000006),
--   public.is_admin() and public.is_moderator().
--
-- Data impact: no existing row is changed. New RPCs only.
--
-- Rollback considerations: drop the three new functions. No data
-- changes; the existing `admin_founder_invitation_for_request` shape is
-- unchanged, so application code calling it is unaffected.
-- =====================================================================

begin;

-- ------------------------------------------------------------
-- 1. admin_reissue_founder_invitation — the canonical Reissue action
-- ------------------------------------------------------------
-- Spec §11: reissue must
--   1. authenticate admin (caller-derived, never client-supplied)
--   2. load Founder request
--   3. ensure request remains approved
--   4. inspect existing invitations
--   5. reject if already accepted
--   6. revoke current active invitation if needed
--   7. mint a fresh Phase 4 invitation
--   8. return safe result (caller sends the email)
--
-- The plaintext token is returned exactly once — only token_hash is
-- persisted (spec §6/§26). The 72-hour lifetime mirrors Phase 4.
--
-- Concurrency: this function takes `for update` on the Founder request,
-- which conflicts with Phase 4 creation's `for share`, serializing a
-- reissue with every create/reissue attempt for the same request. It then
-- locks every historical invitation row before checking for acceptance or
-- revoking a pending credential. A concurrent acceptance therefore either
-- commits first and makes reissue refuse, or blocks until reissue revokes
-- the old token; in the latter case the recipient's original token resolves
-- to that now-revoked row and fails safely. Net effect: a single canonical
-- active invitation at all times (spec §20).

drop function if exists public.admin_reissue_founder_invitation(uuid);
create function public.admin_reissue_founder_invitation(p_founder_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expiry_hours constant integer := 72;
  v_request    public.founder_access_requests%rowtype;
  v_invitation public.founder_invitations%rowtype;
  v_token      text;
  v_token_hash text;
  v_invitation_id uuid;
  v_expires_at timestamptz;
  v_revoked_count integer := 0;
begin
  -- 1. Authorization: caller must be admin.
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  -- 2. Lock the Founder request exclusively. This conflicts with Phase 4
  -- creation's FOR SHARE lock, so create/reissue operations serialize.
  select * into v_request
    from public.founder_access_requests
   where id = p_founder_request_id
   for update;

  if not found then
    raise exception 'founder request not found' using errcode = 'P0002';
  end if;

  -- 3. Approved only — never reissue against a pending or rejected
  -- request; the admin must approve first. Spec §3 / §4.
  if v_request.status <> 'approved' then
    raise exception 'founder request must be approved before reissuing an invitation (current status: %)', v_request.status
      using errcode = '22023';
  end if;

  -- 4 + 5. Lock every historical invitation before deciding whether an
  -- accepted credential exists. This is deliberately a row loop instead
  -- of an `exists (...)` predicate: FOR UPDATE must cover the accepted row
  -- too, otherwise acceptance could commit between the check and the
  -- pending-row revoke. If acceptance won the lock first, the loop resumes
  -- with status='accepted' and this reissue refuses (spec §19).
  for v_invitation in
    select *
      from public.founder_invitations
     where founder_request_id = p_founder_request_id
     for update
  loop
    if v_invitation.status = 'accepted' then
      raise exception 'an invitation for this request has already been accepted and cannot be reissued' using errcode = '22023';
    end if;
  end loop;

  -- 6. Revoke every pending invitation (active and stale) now that no
  -- accepted invitation can race this decision. `revoked_by = null`
  -- identifies this system supersede, distinct from explicit admin revoke
  -- which stores the actor id. The previous rows remain visible in history.
  update public.founder_invitations
     set status = 'revoked', revoked_at = now(), revoked_by = null
   where founder_request_id = p_founder_request_id
     and status = 'pending';
  get diagnostics v_revoked_count = row_count;

  -- 7. Mint a fresh, high-entropy, unguessable token. Same algorithm
  -- as admin_create_founder_invitation (32 random bytes, hex-encoded
  -- for URL-safety, SHA-256 hashed server-side). Never derived from
  -- email, uuid, timestamp, or request id.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(hours => v_expiry_hours);

  insert into public.founder_invitations (
    founder_request_id, email, normalized_email, token_hash, expires_at, created_by
  ) values (
    p_founder_request_id, v_request.email, v_request.normalized_email, v_token_hash, v_expires_at, auth.uid()
  )
  returning id into v_invitation_id;

  -- 8. Return the plaintext token once. The caller (Edge function) is
  -- responsible for sending the email and recording the delivery
  -- attempt. Same shape as admin_create_founder_invitation's return
  -- so the Edge function can be a near-clone.
  return jsonb_build_object(
    'id', v_invitation_id,
    'token', v_token,
    'email', v_request.email,
    'organizationName', v_request.organization_name,
    'expiresAt', v_expires_at,
    'revokedCount', v_revoked_count
  );
end;
$$;

revoke execute on function public.admin_reissue_founder_invitation(uuid) from public, anon;
grant  execute on function public.admin_reissue_founder_invitation(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. admin_founder_invitation_history — ALL invitations for a request
-- ------------------------------------------------------------
-- Spec §6: history must retain revoked/failed invitations. The
-- existing admin_founder_invitation_for_request only returns the most
-- recent — this new RPC returns every invitation for the request,
-- newest first, so the admin history panel can show the full audit
-- chain (reissue -> old row kept as revoked -> new row appears as
-- pending).
--
-- Returns the SAME canonical column shape as
-- admin_founder_invitation_for_request so a single TypeScript row
-- type works for both queries.

drop function if exists public.admin_founder_invitation_history(uuid);
create function public.admin_founder_invitation_history(p_founder_request_id uuid)
returns table (
  id                              uuid,
  founder_request_id              uuid,
  email                           text,
  status                          text,
  expires_at                      timestamptz,
  created_at                      timestamptz,
  created_by                      uuid,
  revoked_at                      timestamptz,
  revoked_by                      uuid,
  accepted_at                     timestamptz,
  accepted_by                     uuid,
  latest_delivery_status          text,
  latest_delivery_provider_message_id text,
  latest_delivery_attempted_at    timestamptz,
  latest_delivery_error_code      text,
  delivery_attempt_count          integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'admin or moderator role required' using errcode = '42501';
  end if;

  return query
    select i.id, i.founder_request_id, i.email, i.status, i.expires_at, i.created_at,
           i.created_by, i.revoked_at, i.revoked_by, i.accepted_at, i.accepted_by,
           d.status, d.provider_message_id, d.attempted_at, d.error_code,
           coalesce(cnt.attempt_count, 0)::integer
      from public.founder_invitations i
      left join lateral (
        select da.status, da.provider_message_id, da.attempted_at, da.error_code
          from public.founder_invitation_delivery_attempts da
         where da.invitation_id = i.id
         order by da.attempt_number desc
         limit 1
      ) d on true
      left join lateral (
        select count(*)::integer as attempt_count
          from public.founder_invitation_delivery_attempts da2
         where da2.invitation_id = i.id
      ) cnt on true
     where i.founder_request_id = p_founder_request_id
     order by i.created_at desc;
end;
$$;

revoke execute on function public.admin_founder_invitation_history(uuid) from public, anon;
grant  execute on function public.admin_founder_invitation_history(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. admin_founder_invitation_delivery_attempts — full attempt log
-- ------------------------------------------------------------
-- Spec §7: full history, one row per attempt, oldest first. Used by
-- the Email panel in the admin UI. Same column shape as the existing
-- founder_invitation_delivery_attempts table, exposed via the same
-- name so a single TypeScript model works.

drop function if exists public.admin_founder_invitation_delivery_attempts(uuid);
create function public.admin_founder_invitation_delivery_attempts(p_invitation_id uuid)
returns table (
  id                       uuid,
  invitation_id            uuid,
  attempt_number           integer,
  provider                 text,
  provider_message_id      text,
  status                   text,
  error_code               text,
  attempted_by             uuid,
  attempted_at             timestamptz,
  completed_at             timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'admin or moderator role required' using errcode = '42501';
  end if;

  return query
    select a.id, a.invitation_id, a.attempt_number, a.provider,
           a.provider_message_id, a.status, a.error_code, a.attempted_by,
           a.attempted_at, a.completed_at
      from public.founder_invitation_delivery_attempts a
     where a.invitation_id = p_invitation_id
     order by a.attempt_number asc;
end;
$$;

revoke execute on function public.admin_founder_invitation_delivery_attempts(uuid) from public, anon;
grant  execute on function public.admin_founder_invitation_delivery_attempts(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Notify PostgREST to reload schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

commit;

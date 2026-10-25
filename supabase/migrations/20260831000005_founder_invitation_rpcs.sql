-- =====================================================================
-- Founder Invitation RPCs — Phase 4
-- =====================================================================
-- Purpose:
--   Server-side boundary for the Founder invitation lifecycle:
--     - admin_create_founder_invitation: approved request -> pending invitation
--     - admin_revoke_founder_invitation: pending -> revoked (admin only)
--     - validate_founder_invitation: public, safe token validation (Phase 6 will consume this)
--     - admin_founder_invitation_for_request: admin/moderator read for the review UI
--
-- Token algorithm (spec §5-§7): 32 bytes from extensions.gen_random_bytes()
-- (256 bits of entropy, well over the ~128-bit target), hex-encoded (64
-- lowercase hex chars, URL-safe with no encoding needed). Hashed with
-- extensions.digest(token, 'sha256'), hex-encoded, stored as token_hash.
-- pgcrypto functions are schema-qualified as `extensions.*` because this
-- project sets `search_path = public` on SECURITY DEFINER functions and
-- pgcrypto is installed in the `extensions` schema, not `public` — the
-- exact failure mode already documented and fixed once before in
-- 20260820000000_fix_admin_invite_user.sql (errcode 42883 otherwise).
--
-- created_by/revoked_by are read from auth.uid() inside each SECURITY
-- DEFINER function body — never accepted as a parameter from the client
-- — which is a deliberately stricter pattern than Phase 3's
-- admin_review_founder_request(p_reviewer_id uuid) (client-supplied),
-- because spec §23 explicitly requires actor identity to be
-- server-derived and non-spoofable for this domain.
--
-- Required: REQUIRED before deploying Phase 4 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: depends on public.founder_invitations
--   (20260831000004_founder_invitations.sql), public.founder_access_requests
--   (20260831000001_founder_access_requests.sql), public.is_admin() and
--   public.is_moderator().
--
-- Data impact: no existing row is changed by applying this file.
--
-- Rollback considerations: drop the four functions. No data changes.
-- =====================================================================

-- ------------------------------------------------------------
-- 1. admin_create_founder_invitation — approved request -> pending invitation
-- ------------------------------------------------------------

drop function if exists public.admin_create_founder_invitation(uuid);
create function public.admin_create_founder_invitation(p_founder_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Single source of truth for invitation lifetime (spec §8). 72 hours:
  -- long enough to survive a weekend, short enough to keep a stolen link
  -- from being useful indefinitely.
  v_expiry_hours constant integer := 72;
  v_request    public.founder_access_requests%rowtype;
  v_existing   public.founder_invitations%rowtype;
  v_token      text;
  v_token_hash text;
  v_invitation_id uuid;
  v_expires_at timestamptz;
begin
  -- 1. Authorization: caller must be admin (spec §11).
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  -- 2. Load and lock the founder request; verify it is approved (spec §4).
  select * into v_request
    from public.founder_access_requests
   where id = p_founder_request_id
   for share;

  if not found then
    raise exception 'founder request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'approved' then
    raise exception 'founder request must be approved before an invitation can be created (current status: %)', v_request.status
      using errcode = '22023';
  end if;

  -- 3. Enforce the single-active-invitation invariant (spec §9), locking
  -- any existing pending row so concurrent creates cannot both pass this
  -- check (race-safe: the second caller blocks here until the first
  -- transaction commits or rolls back, then re-evaluates against the
  -- now-committed row).
  select * into v_existing
    from public.founder_invitations
   where founder_request_id = p_founder_request_id
     and status = 'pending'
   for update;

  if found then
    if v_existing.expires_at > now() then
      raise exception 'an active invitation already exists for this request' using errcode = '23505';
    end if;
    -- Stale (expired) pending invitation: system-supersede it so the
    -- partial unique index (founder_invitations_pending_per_request_uniq)
    -- does not block the fresh insert below. revoked_by stays NULL to
    -- mark this as a system supersede rather than an admin revoke —
    -- distinguishable in the audit trail.
    update public.founder_invitations
       set status = 'revoked', revoked_at = now(), revoked_by = null
     where id = v_existing.id;
  end if;

  -- 4. Generate a fresh, high-entropy, unguessable token (spec §5/§7).
  -- Never derived from email, uuid, timestamp, or request id.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(hours => v_expiry_hours);

  -- 5. Insert. Email is copied from the approved request (spec §29), not
  -- accepted from client input. created_by is the authenticated caller,
  -- read from auth.uid() — never a client-supplied value (spec §23).
  insert into public.founder_invitations (
    founder_request_id, email, normalized_email, token_hash, expires_at, created_by
  ) values (
    p_founder_request_id, v_request.email, v_request.normalized_email, v_token_hash, v_expires_at, auth.uid()
  )
  returning id into v_invitation_id;

  -- 6. Return the plaintext token once. It is never retrievable again —
  -- only token_hash is persisted (spec §6/§26). organizationName is
  -- included (Phase 5 addition) purely for email copy — it costs no
  -- extra query since v_request is already loaded above.
  return jsonb_build_object(
    'id', v_invitation_id,
    'token', v_token,
    'email', v_request.email,
    'organizationName', v_request.organization_name,
    'expiresAt', v_expires_at
  );
end;
$$;

revoke execute on function public.admin_create_founder_invitation(uuid) from public, anon;
grant execute on function public.admin_create_founder_invitation(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. admin_revoke_founder_invitation — pending -> revoked (spec §17)
-- ------------------------------------------------------------

drop function if exists public.admin_revoke_founder_invitation(uuid);
create function public.admin_revoke_founder_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.founder_invitations%rowtype;
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  select * into v_invitation
    from public.founder_invitations
   where id = p_invitation_id
   for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if v_invitation.status = 'accepted' then
    raise exception 'an accepted invitation cannot be revoked' using errcode = '22023';
  end if;
  if v_invitation.status = 'revoked' then
    raise exception 'invitation is already revoked' using errcode = '22023';
  end if;

  update public.founder_invitations
     set status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
   where id = p_invitation_id;

  return jsonb_build_object('success', true, 'status', 'revoked');
end;
$$;

revoke execute on function public.admin_revoke_founder_invitation(uuid) from public, anon;
grant execute on function public.admin_revoke_founder_invitation(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. validate_founder_invitation — public, safe token validation (spec §14/§15)
-- ------------------------------------------------------------
-- Deliberately anon-accessible: Phase 6's acceptance page is a public,
-- unauthenticated route that must be able to check a token before the
-- visitor signs in or creates an account. Returns only safe, minimal
-- metadata on success and one generic shape on every failure mode
-- (nonexistent / malformed / revoked / accepted / expired / linked
-- request no longer approved) so a caller cannot distinguish *why* a
-- token failed (spec §15).

drop function if exists public.validate_founder_invitation(text);
create function public.validate_founder_invitation(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash       text;
  v_invitation public.founder_invitations%rowtype;
  v_request    public.founder_access_requests%rowtype;
  v_invalid    constant jsonb := jsonb_build_object('valid', false);
begin
  -- 1. Format check first — a malformed token never reaches a lookup.
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return v_invalid;
  end if;

  -- 2. Hash and look up by the unique, indexed token_hash column.
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_invitation
    from public.founder_invitations
   where token_hash = v_hash;

  if not found then
    return v_invalid;
  end if;

  -- 3. Lifecycle checks: must be pending, not expired.
  if v_invitation.status <> 'pending' then
    return v_invalid;
  end if;
  if v_invitation.expires_at <= now() then
    return v_invalid;
  end if;

  -- 4. Defense in depth (spec §28): the linked request must still be
  -- approved even though Phase 3 does not allow reverse transitions.
  select * into v_request
    from public.founder_access_requests
   where id = v_invitation.founder_request_id;

  if not found or v_request.status <> 'approved' then
    return v_invalid;
  end if;

  -- 5. Safe public metadata only — no token hash, no internal audit
  -- fields, no reviewed_by/admin notes, no raw row (spec §14).
  return jsonb_build_object(
    'valid', true,
    'organizationName', v_request.organization_name,
    'invitedEmail', v_invitation.email,
    'expiresAt', v_invitation.expires_at
  );
end;
$$;

revoke execute on function public.validate_founder_invitation(text) from public;
grant execute on function public.validate_founder_invitation(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 4. admin_founder_invitation_for_request — admin/moderator read (spec §25)
-- ------------------------------------------------------------
-- Returns the most recent invitation for a request (pending, expired,
-- revoked, or accepted), or zero rows if none was ever created. Powers
-- the "Invitation: <state>" line on the admin request detail page.

drop function if exists public.admin_founder_invitation_for_request(uuid);
create function public.admin_founder_invitation_for_request(p_founder_request_id uuid)
returns table (
  id                  uuid,
  founder_request_id  uuid,
  email               text,
  status              text,
  expires_at          timestamptz,
  created_at          timestamptz,
  created_by          uuid,
  revoked_at          timestamptz,
  revoked_by          uuid,
  accepted_at         timestamptz,
  accepted_by         uuid
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
         i.created_by, i.revoked_at, i.revoked_by, i.accepted_at, i.accepted_by
    from public.founder_invitations i
   where i.founder_request_id = p_founder_request_id
   order by i.created_at desc
   limit 1;
end;
$$;

revoke execute on function public.admin_founder_invitation_for_request(uuid) from public, anon;
grant execute on function public.admin_founder_invitation_for_request(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. Notify PostgREST to reload schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

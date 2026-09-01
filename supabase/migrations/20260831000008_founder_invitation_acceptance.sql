-- =====================================================================
-- Founder Invitation Acceptance RPC — Phase 6
-- =====================================================================
-- Purpose:
--   Atomically consumes a valid Founder invitation on behalf of the
--   authenticated caller, binding it to their user id. This is the
--   single-use state transition `pending -> accepted` — nothing else
--   (no organization creation, no organizer membership, no role grant;
--   those are Phase 7).
--
--   Deliberately granted to `authenticated` only (not anon): possession
--   of the token alone is not enough — the caller must be signed in AND
--   their trusted auth email must match the invitation's invited email
--   (spec §7).
--
--   Authenticated email source (spec §18): `auth.users.email`, read
--   through a SECURITY DEFINER function with `set search_path = public`
--   — never the profiles table (user-editable), never a client-supplied
--   value. `auth.users` lives in the `auth` schema, which is always on
--   the search path regardless of this function's `search_path` setting,
--   so the reference below needs no explicit qualification.
--
--   Note on normalized comparison (spec §7): the invariant is
--   `lower(auth.users.email) = founder_invitations.normalized_email`.
--   `founder_invitations.normalized_email` is already lowercase (copied
--   from `founder_access_requests.normalized_email` at creation time,
--   which the request-founder-access Edge Function normalizes), so only
--   the auth side needs `lower()`.
--
-- Required: REQUIRED before deploying Phase 6 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: depends on public.founder_invitations
--   (20260831000004_founder_invitations.sql), public.founder_access_requests
--   (20260831000001_founder_access_requests.sql).
--
-- Data impact: modifies exactly one founder_invitations row (the one
--   being accepted). No other table is touched.
--
-- Rollback considerations: drop the function. The invitation row's
--   accepted state is a real business event and is not rolled back.
-- =====================================================================

drop function if exists public.accept_founder_invitation(text);
create function public.accept_founder_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash         text;
  v_invitation   public.founder_invitations%rowtype;
  v_request      public.founder_access_requests%rowtype;
  v_auth_email   text;
  v_invitation_id uuid;
begin
  -- 1. Require an authenticated user (spec §17 step 1). auth.uid() is
  --    the only trusted identity source — never a client-supplied id.
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- 2. Validate token format — a malformed token never reaches a lookup.
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invitation is invalid, expired, or no longer available' using errcode = '22023';
  end if;

  -- 3. Hash and look up by the unique, indexed token_hash column.
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- 4. Lock the invitation row FOR UPDATE so two concurrent acceptance
  --    attempts with the same token cannot both succeed (spec §20): the
  --    second caller blocks here until the first commits, then sees the
  --    already-accepted status and fails.
  select * into v_invitation
    from public.founder_invitations
   where token_hash = v_hash
   for update;

  -- 5. Verify the invitation exists.
  if not found then
    raise exception 'invitation is invalid, expired, or no longer available' using errcode = '22023';
  end if;

  -- 6. Verify status = pending (not revoked, not already accepted).
  --    Single-use enforcement (spec §19): a second acceptance attempt
  --    must fail safely. The generic message deliberately does not
  --    distinguish "already accepted" from "revoked" or "expired" for
  --    the public surface; the specific state is visible in audit_logs
  --    and the admin UI for diagnostics.
  if v_invitation.status <> 'pending' then
    raise exception 'invitation is invalid, expired, or no longer available' using errcode = '22023';
  end if;

  -- 7. Verify not expired. Revalidated here, never trusted from a prior
  --    frontend check (spec §22: the invitation may have expired while
  --    the user was going through auth).
  if v_invitation.expires_at <= now() then
    raise exception 'invitation is invalid, expired, or no longer available' using errcode = '22023';
  end if;

  -- 8. Defense in depth (spec §24): the linked request must still be
  --    approved, even though Phase 3 makes reviewed requests immutable.
  select * into v_request
    from public.founder_access_requests
   where id = v_invitation.founder_request_id;

  if not found or v_request.status <> 'approved' then
    raise exception 'invitation is invalid, expired, or no longer available' using errcode = '22023';
  end if;

  -- 9. Obtain the authenticated user's trusted email from auth.users
  --    (spec §18) — the authoritative identity source, not the profiles
  --    table (which is user-editable) and never a client-supplied value.
  select lower(u.email) into v_auth_email
    from auth.users u
   where u.id = auth.uid();

  if v_auth_email is null then
    raise exception 'authenticated user email could not be resolved' using errcode = 'P0002';
  end if;

  -- 10. Email identity check (spec §7): the authenticated email must
  --     match the invitation's normalized invited email. This blocks
  --     account A accepting an invitation issued to email B.
  if v_auth_email <> v_invitation.normalized_email then
    raise exception 'this invitation was sent to a different email address' using errcode = '22023';
  end if;

  -- 11. Perform the state transition. `for update` in step 4 plus this
  --     conditional update make the transition atomic; only one caller
  --     can flip status from pending to accepted for this row.
  update public.founder_invitations
     set status = 'accepted',
         accepted_at = now(),
         accepted_by = auth.uid()
   where id = v_invitation.id
     and status = 'pending';

  if not found then
    -- Lost a race with a concurrent acceptance (spec §20) — only one
    -- winner is possible.
    raise exception 'invitation is invalid, expired, or no longer available' using errcode = '22023';
  end if;

  -- 12. Return only safe acceptance result (spec §28): no token hash,
  --     no reviewer identity, no rejection fields, no audit internals.
  --     organizationName and founderRequestId are included for the
  --     success screen and the Phase 7 handoff respectively.
  return jsonb_build_object(
    'accepted', true,
    'organizationName', v_request.organization_name,
    'founderRequestId', v_invitation.founder_request_id
  );
end;
$$;

-- Authenticated callers only — anonymous acceptance is explicitly
-- rejected by the auth.uid() check inside the function, but revoking
-- the grant from anon means the request never reaches the function at
-- all (401 at the PostgREST layer, a cleaner boundary).
revoke execute on function public.accept_founder_invitation(text) from public, anon;
grant execute on function public.accept_founder_invitation(text) to authenticated;

-- ------------------------------------------------------------
-- Notify PostgREST to reload schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

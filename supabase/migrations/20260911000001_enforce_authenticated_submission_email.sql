-- ===========================================================================
-- Phase 1B — Enforce authenticated submitter_email at the database boundary
-- ===========================================================================
-- Security problem:
--   Authenticated users can insert event_submissions with an arbitrary
--   submitter_email, even though the UI derives it from useAuth().user.email.
--   The email is security-relevant: it is the recipient for submission
--     confirmation, approval, and rejection notifications.
--   submitter_id IS already enforced (RLS: submitter_id = auth.uid()), but
--   submitter_email has no such constraint — a direct Supabase client insert
--   could set it to any address.
--
-- Solution:
--   A BEFORE INSERT trigger that, for authenticated callers (auth.uid() IS NOT
--   NULL), replaces NEW.submitter_email with the caller's trusted Auth email
--   from auth.users, and raises if no email can be resolved. For anonymous
--   callers (auth.uid() IS NULL), behavior is unchanged — they supply their own
--   email as before.
--
--   This mirrors the pattern in founder_invitation_acceptance.sql (lines 118-
--   120), which reads `auth.users.email` through a SECURITY DEFINER function.
--
-- Design notes:
--   - SECURITY DEFINER: required because auth.users is not accessible to the
--     `authenticated` role via default grants. The function runs as its owner
--     (postgres), matching the established is_moderator() / admin_ RPCs.
--   - set search_path = public: pins the schema, preventing search_path
--     injection. auth.users in the `auth` schema is still reachable because
--     `auth` is a system schema always present on the search path.
--   - does NOT trust NEW.submitter_id: uses auth.uid() as the sole identity
--     source. A caller cannot impersonate another user because the RLS INSERT
--     policy (submitter_id = auth.uid()) blocks it before this trigger runs.
--   - preserves anonymous submissions: when auth.uid() IS NULL, the trigger
--     returns NEW unchanged — anon submitter_email/name flow is untouched.
--   - if authenticated but auth.users.email is NULL: FAILS SAFE with a clear
--     error. An auth-authenticated user with no email cannot submit, which is
--     correct — there is no address to notify them at.
--
-- Rollback: drop the trigger and function.
--
-- Execution order: depends on public.event_submissions
--   (20260817000000_event_submissions.sql).
--
-- Data impact: none (trigger only affects new inserts).
-- ===========================================================================

-- ─── Trigger function ────────────────────────────────────────────────────────
-- Normalizes submitter_email for authenticated inserts. The RLS INSERT policy
-- ("Authenticated users can submit") already guarantees submitter_id =
-- auth.uid() before this trigger fires; this trigger adds the email guarantee.

drop function if exists public.normalize_authenticated_submission_email();
create function public.normalize_authenticated_submission_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_email text;
begin
  -- Anonymous path: auth.uid() is NULL. Leave submitter_email exactly as
  -- supplied — anon submitters enter their own contact info.
  if auth.uid() is null then
    return new;
  end if;

  -- Authenticated path: always enforce submitter_id = auth.uid().
  -- The WITH CHECK policy already blocks submitter_id != auth.uid(), but
  -- defense-in-depth: reject explicitly here too.
  if new.submitter_id is not null and new.submitter_id <> auth.uid() then
    raise exception 'submitter_id must match the authenticated user'
      using errcode = '42501';
  end if;

  if new.submitter_id is null then
    new.submitter_id := auth.uid();
  end if;

  -- Resolve the trusted email from auth.users — the authoritative identity
  -- source (spec §18 of the founder invitation pattern). Never the profiles
  -- table (user-editable) or a client-supplied value.
  select lower(u.email) into v_auth_email
    from auth.users u
   where u.id = auth.uid();

  if v_auth_email is null then
    -- Fail safe: an authenticated user with no Auth email cannot be notified.
    raise exception 'authenticated user has no email address on record'
      using errcode = 'P0001';
  end if;

  new.submitter_email := v_auth_email;
  return new;
end;
$$;

-- ─── Grant ───────────────────────────────────────────────────────────────────
-- The function is only ever invoked by the trigger (which runs in the row's
-- security context). No direct EXECUTE grant is needed or given.
revoke execute on function public.normalize_authenticated_submission_email() from public;

-- ─── Trigger ─────────────────────────────────────────────────────────────────
create trigger event_submissions_normalize_email
  before insert on public.event_submissions
  for each row execute function public.normalize_authenticated_submission_email();

-- ─── Schema reload ───────────────────────────────────────────────────────────
-- The trigger/function don't change the PostgREST-visible surface (no new
-- RPC columns), so no pgrst reload is needed. But reload anyway for
-- consistency with the repository's other migration pattern.
notify pgrst, 'reload schema';

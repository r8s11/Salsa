-- =====================================================================
-- Founder Request — Applicant Receipt Confirmation Delivery Tracking
-- =====================================================================
-- Purpose: extends the existing delivery-tracking table/RPCs (
--   20260904000000_founder_request_admin_notifications.sql) to also
--   track the applicant's own receipt-confirmation email as a second
--   `email_event` value on the same table — not a second table. The
--   existing `admin_request_notification` rows and behavior are
--   unchanged; this is additive to the check constraint and to the
--   claim RPC's accepted values, plus one clean signature cutover on
--   the completion RPC (old 4-arg dropped, new 6-arg requires the
--   caller to also state request_id/email_event so a mismatch updates
--   zero rows instead of silently closing the wrong attempt).
--
-- Required: apply before deploying the applicant-confirmation email;
--   production SQL is manually reviewed/run by the project owner (this
--   file, not automatic). Local dev picks it up via `supabase start` /
--   `supabase db reset`.
--
-- Execution order: depends on
--   20260904000000_founder_request_admin_notifications.sql.
--
-- Data impact: no existing row changes; every existing
--   'admin_request_notification' row still satisfies the widened check
--   constraint (a value is added, none removed).
--
-- Cutover gap: the completion RPC's signature is a breaking change with
--   exactly one caller (request-founder-access). Apply this migration
--   and redeploy that Edge Function together, back to back — a request
--   submitted in the gap between the two is affected two ways: (1) the
--   pre-redeploy code still claims and successfully sends its
--   admin_request_notification via Resend, but its completion call then
--   targets the now-dropped 4-arg signature and errors, so that admin
--   attempt row is left permanently 'pending' (the email was sent; only
--   the tracking row is wrong) until a later stale reclaim or manual
--   correction reconciles it; (2) the pre-redeploy code has no notion
--   of applicant_confirmation at all, so no confirmation attempt is
--   ever created for that request — not stuck pending, simply never
--   attempted, until the request owner is manually notified or the row
--   is resubmitted. Minimize the gap; consider pausing public intake
--   for its duration.
--
-- Rollback:
--   drop function if exists public.complete_founder_request_notification_attempt(uuid, uuid, text, text, text, text);
--   -- then recreate the prior 4-arg completion RPC (20260904000000's
--   -- rollback block has its body), re-narrow claim's validation to
--   -- admin-only, and re-narrow the check constraint back to
--   -- ('admin_request_notification') only — only once no
--   -- 'applicant_confirmation' row exists, since narrowing while one
--   -- exists fails with a check violation.
--   notify pgrst, 'reload schema';
--   Roll back together with the Edge Function deploy, not separately.
-- =====================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Widen the email_event check constraint
-- ----------------------------------------------------------------------------
-- Postgres auto-named this constraint
-- founder_request_notification_attempts_email_event_check when the table
-- was created with an inline `check (email_event in (...))` and no
-- explicit constraint name. Named explicitly here going forward so a
-- future change can target it without re-deriving the auto-generated name.

alter table public.founder_request_notification_attempts
  drop constraint if exists founder_request_notification_attempts_email_event_check;

alter table public.founder_request_notification_attempts
  add constraint founder_request_notification_attempts_email_event_check
  check (email_event in ('admin_request_notification', 'applicant_confirmation'));

comment on table public.founder_request_notification_attempts is
  'One row per Founder/Host access request email-delivery attempt: the internal admin-notification (email_event = admin_request_notification) or the applicant''s own receipt confirmation (email_event = applicant_confirmation). A ''pending'' row is an exclusive claim held while the provider call is in flight; the unique partial index permits at most one active (pending) or successfully-sent row per (request_id, email_event), so at most one send can be in flight or recorded successful per purpose at a time. This is not an unconditional exactly-once guarantee across all time: Resend retains an idempotency key for 24 hours (https://resend.com/docs/api-reference/idempotency-keys), so a completion that never lands (e.g. a crash between a successful provider call and closing the claim) leaves the row ''pending'' indefinitely until a stale reclaim or manual correction, and a reclaim issued more than 24h after the original attempt could resend rather than dedupe. Recipient address is never stored — it is always derivable server-side (platform_settings.support_email for the admin notification, the request''s own normalized_email for the confirmation).';

-- ----------------------------------------------------------------------------
-- 2. claim_founder_request_notification_attempt() — widen validation only
-- ----------------------------------------------------------------------------
-- Signature, parameter names, defaults, and every existing behavior for
-- email_event = 'admin_request_notification' are unchanged. The only
-- change is that 'applicant_confirmation' is now also an accepted value,
-- so the same claim-then-send idempotency primitive protects both
-- purposes independently (the unique partial index is already keyed on
-- (request_id, email_event), so the two purposes for the same request
-- never collide with each other).

create or replace function public.claim_founder_request_notification_attempt(
  p_request_id   uuid,
  p_email_event  text default 'admin_request_notification',
  p_stale_after  interval default interval '5 minutes'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id uuid;
begin
  if p_email_event not in ('admin_request_notification', 'applicant_confirmation') then
    raise exception 'invalid email_event' using errcode = '22023';
  end if;

  -- Take over a stale claim if one exists. FOR UPDATE serializes concurrent
  -- takeover attempts so only one wins.
  update public.founder_request_notification_attempts
     set claimed_at           = now(),
         error_code           = null,
         provider_message_id  = null
   where id = (
     select id
       from public.founder_request_notification_attempts
      where request_id  = p_request_id
        and email_event = p_email_event
        and status      = 'pending'
        and claimed_at  < now() - p_stale_after
      for update skip locked
      limit 1
   )
   returning id into v_attempt_id;

  if v_attempt_id is not null then
    return v_attempt_id;
  end if;

  -- Fresh claim. A unique violation means another caller holds the claim or
  -- the notification already sent — either way this caller must not send.
  begin
    insert into public.founder_request_notification_attempts
      (request_id, email_event, status)
    values
      (p_request_id, p_email_event, 'pending')
    returning id into v_attempt_id;
  exception
    when unique_violation then
      return null;
  end;

  return v_attempt_id;
end;
$$;

comment on function public.claim_founder_request_notification_attempt(uuid, text, interval) is
  'Atomically claims the right to send one Founder-request email of the given purpose (admin_request_notification or applicant_confirmation). Returns the attempt id, or NULL when it already sent or is in flight. Service-role only.';

-- ----------------------------------------------------------------------------
-- 3. Drop the old completion RPC; replace with a request/event-bound one
-- ----------------------------------------------------------------------------
-- Clean cutover — the old 4-arg signature trusted attempt_id alone. The new
-- signature also requires the caller to state which request and which
-- purpose it believes it is closing; the UPDATE binds all three (id,
-- request_id, email_event), so a caller-side mixup between the two
-- purposes for the same request (or between two different requests)
-- updates zero rows and returns false instead of silently closing the
-- wrong attempt. Still only ever transitions 'pending' -> 'sent'/'failed',
-- so a late/duplicate completion can never rewrite a settled attempt.

drop function if exists public.complete_founder_request_notification_attempt(uuid, text, text, text);

create or replace function public.complete_founder_request_notification_attempt(
  p_attempt_id          uuid,
  p_request_id          uuid,
  p_email_event         text,
  p_status              text,
  p_provider_message_id text default null,
  p_error_code          text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'status must be sent or failed' using errcode = '22023';
  end if;
  if p_status = 'sent' and coalesce(p_provider_message_id, '') = '' then
    raise exception 'provider_message_id is required when status is sent' using errcode = '22023';
  end if;
  if p_status = 'failed' and coalesce(p_error_code, '') = '' then
    raise exception 'error_code is required when status is failed' using errcode = '22023';
  end if;

  update public.founder_request_notification_attempts
     set status              = p_status,
         provider_message_id = nullif(p_provider_message_id, ''),
         error_code          = nullif(p_error_code, ''),
         completed_at        = now()
   where id          = p_attempt_id
     and request_id  = p_request_id
     and email_event = p_email_event
     and status      = 'pending';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

comment on function public.complete_founder_request_notification_attempt(uuid, uuid, text, text, text, text) is
  'Closes a claimed Founder-request email attempt (admin_request_notification or applicant_confirmation) as sent or failed. Requires the caller to state the owning request_id and email_event in addition to attempt_id; a mismatch on any of the three updates zero rows and returns false. Only transitions from pending, so a settled attempt is never rewritten. Service-role only.';

-- ----------------------------------------------------------------------------
-- 4. Grants — service role only
-- ----------------------------------------------------------------------------
-- Neither function is callable from the browser. `service_role` bypasses RLS
-- but NOT function EXECUTE ACLs, so the explicit grant below is required —
-- same pattern as claim_submission_email_attempt(). The claim RPC's grant
-- already exists from 20260904000000 (CREATE OR REPLACE above did not drop
-- it) and is re-stated here only for clarity/idempotency; the completion
-- RPC's grant must be re-issued because DROP FUNCTION above removed the
-- prior grant along with the prior signature.

revoke all on function public.claim_founder_request_notification_attempt(uuid, text, interval)
  from public, anon, authenticated;
revoke all on function public.complete_founder_request_notification_attempt(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_founder_request_notification_attempt(uuid, text, interval)
  to service_role;
grant execute on function public.complete_founder_request_notification_attempt(uuid, uuid, text, text, text, text)
  to service_role;

-- RLS and the moderator-read policy on founder_request_notification_attempts
-- are untouched — they already cover both purposes' rows identically, since
-- neither the policy nor the grant discriminates on email_event.

-- ----------------------------------------------------------------------------
-- 5. service_role SELECT on platform_settings
-- ----------------------------------------------------------------------------
-- The admin-notification path reads platform_settings.support_email as
-- service_role (runtimeDependencies().notify.readSettings() in
-- request-founder-access/index.ts) and has done so since
-- 20260904000000. That migration's header asserted this grant already
-- existed via `sql/submission-emails/001_email_delivery_attempts.sql`
-- (a column-scoped `grant select (platform_name, public_site_url,
-- support_email, singleton) on public.platform_settings to
-- service_role`). That assertion is only true once 001 has actually been
-- run against the target database — 001 lives under `sql/`, not
-- `supabase/migrations/`, so it is NOT applied automatically by
-- `supabase db reset` / `supabase start` the way every file in this
-- directory is. Verified locally: a fresh local stack that only ever
-- ran `supabase/migrations/*` has service_role SELECT on
-- founder_access_requests but NOT on platform_settings, so the
-- admin-notification path fails with `configuration_error` (42501) on
-- its very first settings read — a local/CI parity gap, not a
-- production one (assuming 001 was in fact run against production
-- before 20260904000000 shipped there).
--
-- Restating the grant here, inside a migration that DOES apply
-- automatically, closes that parity gap going forward without touching
-- anything else: idempotent, additive, and a strict superset of the
-- column-scoped grant it duplicates (harmless — GRANT is not
-- cumulative-conflicting, a broader later grant simply supersedes a
-- narrower earlier one for the same role/table).

grant select on public.platform_settings to service_role;

commit;

-- ----------------------------------------------------------------------------
-- 6. Notify PostgREST to reload schema
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';

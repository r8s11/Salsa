-- =====================================================================
-- Founder Request — Automatic Admin Notification Delivery Tracking
-- =====================================================================
-- Purpose:
--   Records delivery attempts for the internal "a new Founder/Host
--   access request needs review" notification, and provides the atomic
--   claim primitive that makes those sends idempotent. Mirrors
--   public.event_submission_email_attempts
--   (sql/submission-emails/001_email_delivery_attempts.sql) exactly —
--   same shape, same claim-then-send RPC pair, same reasoning — because
--   this notification has the identical trust profile: triggered by an
--   anonymous public submission via a service-role Edge Function, with
--   no authenticated actor to attribute the attempt to.
--
--   This is deliberately its own table rather than a new row shape in
--   public.founder_invitation_delivery_attempts. That table requires
--   attempted_by uuid not null references auth.users(id) — a human
--   admin action (send/reissue an invitation). An anonymous applicant's
--   submission has no such actor, so it cannot honestly populate that
--   column. Invitation-delivery lifecycle and request-notification
--   lifecycle are different concerns with different cardinality and a
--   different trust boundary; forcing them into one table would either
--   fabricate an actor or weaken a constraint that currently holds.
--
-- Required: REQUIRED before deploying the automatic Founder request
--   admin notification. Production SQL is manually reviewed and run by
--   the project owner; this file must be applied to production
--   manually. Local dev picks it up through `supabase start` /
--   `supabase db reset`.
--
-- Execution order: depends on public.founder_access_requests
--   (20260831000001), public.is_moderator()
--   (20260817000000_event_submissions.sql).
--
-- Data impact: no existing row is changed.
--
-- Safety notes:
--   Purely additive: one new table, two indexes, one unique partial
--   index, one RLS policy, two new SECURITY DEFINER functions granted
--   to service_role only. No existing table, column, policy, function,
--   or row is modified or dropped. Fully idempotent (IF NOT EXISTS /
--   CREATE OR REPLACE) — safe to run more than once.
--
--   No new service_role table grant is required: public.founder_access
--   _requests already grants `select, insert` to service_role
--   (20260903000000_phase10_founder_delivery_reliability.sql) and
--   public.platform_settings already grants service_role SELECT on
--   platform_name/public_site_url/support_email/singleton
--   (sql/submission-emails/001_email_delivery_attempts.sql). Both are
--   reused unchanged by request-founder-access's notification path.
--
-- Rollback considerations:
--   drop function if exists public.complete_founder_request_notification_attempt(uuid, text, text, text);
--   drop function if exists public.claim_founder_request_notification_attempt(uuid, text, interval);
--   drop table if exists public.founder_request_notification_attempts;
--   notify pgrst, 'reload schema';
--
--   Dropping the table also drops the unique index, so a re-deployed
--   function would resume sending duplicate notifications on retry.
--   Deploy the function and this file together, and roll them back
--   together.
-- =====================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------

create table if not exists public.founder_request_notification_attempts (
  id                  uuid        primary key default gen_random_uuid(),

  request_id          uuid        not null
                        references public.founder_access_requests(id) on delete cascade,

  -- Explicit purpose (spec: "Email Purpose Must Be Explicit"). Exactly one
  -- value exists today; kept as a column + check rather than an implied
  -- constant so a future second Founder-request notification purpose
  -- (if one is ever added) does not require a schema rewrite.
  email_event         text        not null
                        check (email_event in ('admin_request_notification')),

  -- 'pending' is the claim: written before the provider call so a concurrent
  -- caller collides on the unique index below and sends nothing. It becomes
  -- 'sent' or 'failed' once the provider answers (or once a configuration
  -- gap — e.g. no recipient configured — closes the attempt without ever
  -- calling the provider).
  status              text        not null
                        check (status in ('pending', 'sent', 'failed')),

  provider            text        not null default 'resend',

  -- Resend's message id on success — the join key for `resend emails get`.
  provider_message_id text        null,

  -- Normalized failure category only (configuration_error, no_recipient,
  -- invalid_recipient, provider_error, rate_limited, network_error).
  -- Never a raw provider response body or exception message.
  error_code          text        null,

  claimed_at          timestamptz not null default now(),
  completed_at        timestamptz null,
  created_at          timestamptz not null default now(),

  -- A finished attempt must say how it finished.
  constraint founder_request_notification_attempts_completion_check check (
    (status = 'pending' and completed_at is null)
    or (status = 'sent'   and completed_at is not null and provider_message_id is not null)
    or (status = 'failed' and completed_at is not null and error_code is not null)
  )
);

comment on table public.founder_request_notification_attempts is
  'One row per internal admin-notification attempt for a Founder/Host access request. A ''pending'' row is an exclusive claim held while the provider call is in flight; the unique partial index makes duplicate notifications impossible. Recipient address is never stored — it is always derivable from platform_settings.support_email.';

comment on column public.founder_request_notification_attempts.error_code is
  'Normalized failure category only (configuration_error, no_recipient, invalid_recipient, provider_error, rate_limited, network_error) — never a raw provider response body.';

-- ----------------------------------------------------------------------------
-- 2. The idempotency guard
-- ----------------------------------------------------------------------------
-- At most one live claim OR one success per (request, email_event).
--
-- 'failed' is excluded on purpose, and that asymmetry is the whole design:
--   * a success stays in the index forever  -> the same notification can
--     never be sent twice;
--   * a failure falls out of the index      -> a deliberate retry (or a
--     later reconciliation sweep) is allowed to claim again.

create unique index if not exists founder_request_notification_attempts_active_key
  on public.founder_request_notification_attempts (request_id, email_event)
  where status in ('pending', 'sent');

create index if not exists founder_request_notification_attempts_request_idx
  on public.founder_request_notification_attempts (request_id, created_at desc);

create index if not exists founder_request_notification_attempts_failed_idx
  on public.founder_request_notification_attempts (created_at desc)
  where status = 'failed';

-- ----------------------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------------------
-- Read-only for moderators/admins (so a failure is visible in the admin UI),
-- writable by nobody through the API. The Edge Function writes with the
-- service role via the SECURITY DEFINER functions below.

alter table public.founder_request_notification_attempts enable row level security;

grant select on public.founder_request_notification_attempts to authenticated;

drop policy if exists "Moderators read founder request notification attempts"
  on public.founder_request_notification_attempts;
create policy "Moderators read founder request notification attempts"
  on public.founder_request_notification_attempts
  for select
  to authenticated
  using (public.is_moderator());

-- ----------------------------------------------------------------------------
-- 4. claim_founder_request_notification_attempt()
-- ----------------------------------------------------------------------------
-- Atomically claims the right to send one admin notification, or reports
-- that someone already has it. Returns the attempt id on a successful
-- claim, NULL when the notification was already sent or is currently in
-- flight elsewhere. Mirrors claim_submission_email_attempt().

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
  if p_email_event not in ('admin_request_notification') then
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
  'Atomically claims the right to send one Founder-request admin notification. Returns the attempt id, or NULL when it already sent or is in flight. Service-role only.';

-- ----------------------------------------------------------------------------
-- 5. complete_founder_request_notification_attempt()
-- ----------------------------------------------------------------------------
-- Closes a claim opened above. Only ever moves 'pending' -> 'sent'/'failed',
-- so a late/duplicate completion cannot rewrite a settled attempt.

create or replace function public.complete_founder_request_notification_attempt(
  p_attempt_id          uuid,
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
   where id     = p_attempt_id
     and status = 'pending';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

comment on function public.complete_founder_request_notification_attempt(uuid, text, text, text) is
  'Closes a claimed Founder-request notification attempt as sent or failed. Only transitions from pending, so a settled attempt is never rewritten. Service-role only.';

-- ----------------------------------------------------------------------------
-- 6. Grants — service role only
-- ----------------------------------------------------------------------------
-- Neither function is callable from the browser. `service_role` bypasses RLS
-- but NOT function EXECUTE ACLs, so the explicit grant below is required —
-- same pattern as claim_submission_email_attempt().

revoke all on function public.claim_founder_request_notification_attempt(uuid, text, interval)
  from public, anon, authenticated;
revoke all on function public.complete_founder_request_notification_attempt(uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_founder_request_notification_attempt(uuid, text, interval)
  to service_role;
grant execute on function public.complete_founder_request_notification_attempt(uuid, text, text, text)
  to service_role;

-- The attempts table needs no service_role grant: the Edge Function only
-- touches it through the two SECURITY DEFINER functions above, which execute
-- as the owner. Least privilege by construction.

commit;

-- ----------------------------------------------------------------------------
-- 7. Notify PostgREST to reload schema
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';

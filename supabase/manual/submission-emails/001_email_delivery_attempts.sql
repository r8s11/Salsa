-- ============================================================================
-- Event Submission Email Notifications — 001: delivery attempts + claim RPCs
-- ============================================================================
--
-- PURPOSE
--   Records every transactional email attempt for the existing anonymous
--   Event Submission workflow, and provides the atomic claim primitive that
--   makes those sends idempotent.
--
--   The table serves two jobs at once:
--     1. Diagnosability. Email delivery is secondary to database state (a
--        failed send must never undo a submission or an approval), so a
--        failure has to leave a durable, queryable trace instead of only a
--        log line in the Edge Function.
--     2. Idempotency. A page refresh, a double-clicked Approve button, or a
--        client retry must not produce a second email. The unique partial
--        index below is the enforcement point.
--
-- REQUIRED vs OPTIONAL
--   REQUIRED. The `send-submission-email` Edge Function calls
--   claim_submission_email_attempt() before every send and
--   complete_submission_email_attempt() after. Without this file the
--   function returns 503 and sends nothing.
--
-- EXECUTION ORDER
--   1. THIS FILE (001_email_delivery_attempts.sql)          — required
--   2. 002_anon_submitter_contact_required.sql               — recommended
--   3. 003_postcheck.sql                                     — verification
--
--   Depends on: public.event_submissions (20260817000000), public.is_moderator()
--   (same migration), public.audit_logs (20260813000100).
--
-- SAFETY NOTES
--   Purely additive: one new table, one unique index, two new functions, one
--   RLS policy on the new table. No existing table, column, policy, function,
--   or row is modified or dropped. Fully idempotent (IF NOT EXISTS /
--   CREATE OR REPLACE) — safe to run more than once.
--
--   The claim function is SECURITY DEFINER but is granted to nobody: only the
--   service role (which bypasses grants) can call it. It is not reachable
--   from the browser under the anon or authenticated key.
--
-- ROLLBACK CONSIDERATIONS
--   Reverting drops diagnostic history and the idempotency guard. If you must:
--
--     drop function if exists public.complete_submission_email_attempt(uuid, text, text, text);
--     drop function if exists public.claim_submission_email_attempt(uuid, text, text);
--     drop table if exists public.event_submission_email_attempts;
--     notify pgrst, 'reload schema';
--
--   Dropping the table also drops the unique index, so a re-deployed function
--   would resume sending duplicate emails on retry. Deploy the function and
--   this file together, and roll them back together.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------

create table if not exists public.event_submission_email_attempts (
  id                  uuid        primary key default gen_random_uuid(),

  submission_id       uuid        not null
                        references public.event_submissions(id) on delete cascade,

  -- Which of the four transactional emails this attempt is for.
  email_event         text        not null
                        check (email_event in (
                          'received', 'awaiting_review', 'approved', 'rejected'
                        )),

  -- 'pending' is the claim: written before the provider call so a concurrent
  -- caller collides on the unique index below and sends nothing. It becomes
  -- 'sent' or 'failed' once the provider answers.
  status              text        not null
                        check (status in ('pending', 'sent', 'failed')),

  -- Whether this attempt targeted the submitter or the moderation address.
  -- The actual address is deliberately NOT stored: it is always derivable
  -- from event_submissions.submitter_email or platform_settings.support_email,
  -- and duplicating PII into a log table earns nothing.
  recipient_kind      text        not null
                        check (recipient_kind in ('submitter', 'moderator')),

  provider            text        not null default 'resend',

  -- Resend's message id on success — the join key for `resend emails get`.
  provider_message_id text        null,

  -- Normalized failure category only (no_recipient, provider_error,
  -- rate_limited, network_error, invalid_recipient, invalid_sender).
  -- Never a raw provider response body or exception message.
  error_code          text        null,

  claimed_at          timestamptz not null default now(),
  completed_at        timestamptz null,
  created_at          timestamptz not null default now(),

  -- A finished attempt must say how it finished.
  constraint event_submission_email_attempts_completion_check check (
    (status = 'pending'  and completed_at is null)
    or (status = 'sent'   and completed_at is not null and provider_message_id is not null)
    or (status = 'failed' and completed_at is not null and error_code is not null)
  )
);

comment on table public.event_submission_email_attempts is
  'One row per transactional email attempt for an event submission. A ''pending'' row is an exclusive claim held while the provider call is in flight; the unique partial index makes duplicate sends impossible.';

comment on column public.event_submission_email_attempts.error_code is
  'Normalized failure category only (no_recipient, provider_error, rate_limited, network_error, invalid_recipient, invalid_sender) — never a raw provider response body.';

-- ----------------------------------------------------------------------------
-- 2. The idempotency guard
-- ----------------------------------------------------------------------------
-- At most one live claim OR one success per (submission, email_event).
--
-- 'failed' is excluded on purpose, and that asymmetry is the whole design:
--   * a success stays in the index forever  -> the same email can never be
--     sent twice;
--   * a failure falls out of the index      -> a deliberate retry is allowed
--     to claim again.

create unique index if not exists event_submission_email_attempts_active_key
  on public.event_submission_email_attempts (submission_id, email_event)
  where status in ('pending', 'sent');

-- Supports the moderator-facing "what happened to this submission's email"
-- lookup and the operational failure sweep.
create index if not exists event_submission_email_attempts_submission_idx
  on public.event_submission_email_attempts (submission_id, created_at desc);

create index if not exists event_submission_email_attempts_failed_idx
  on public.event_submission_email_attempts (created_at desc)
  where status = 'failed';

-- ----------------------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------------------
-- Read-only for moderators/admins (so a failure is visible in the admin UI),
-- writable by nobody through the API. The Edge Function writes with the
-- service role, which bypasses RLS.

alter table public.event_submission_email_attempts enable row level security;

grant select on public.event_submission_email_attempts to authenticated;

drop policy if exists "Moderators read submission email attempts"
  on public.event_submission_email_attempts;
create policy "Moderators read submission email attempts"
  on public.event_submission_email_attempts
  for select
  to authenticated
  using (public.is_moderator());

-- ----------------------------------------------------------------------------
-- 4. claim_submission_email_attempt()
-- ----------------------------------------------------------------------------
-- Atomically claims the right to send one email, or reports that someone
-- already has it. Returns the attempt id on a successful claim, NULL when the
-- email was already sent or is currently in flight elsewhere.
--
-- Stale-claim takeover: a function instance that crashed between claiming and
-- completing would otherwise leave a 'pending' row blocking the pair forever.
-- A pending row older than p_stale_after is therefore reclaimable. The window
-- is generously longer than any Edge Function timeout, so a takeover cannot
-- race a still-running send.

create or replace function public.claim_submission_email_attempt(
  p_submission_id  uuid,
  p_email_event    text,
  p_recipient_kind text,
  p_stale_after    interval default interval '5 minutes'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id uuid;
begin
  if p_email_event not in ('received', 'awaiting_review', 'approved', 'rejected') then
    raise exception 'invalid email_event' using errcode = '22023';
  end if;
  if p_recipient_kind not in ('submitter', 'moderator') then
    raise exception 'invalid recipient_kind' using errcode = '22023';
  end if;

  -- Take over a stale claim if one exists. FOR UPDATE serializes concurrent
  -- takeover attempts so only one wins.
  update public.event_submission_email_attempts
     set claimed_at      = now(),
         recipient_kind  = p_recipient_kind,
         error_code      = null,
         provider_message_id = null
   where id = (
     select id
       from public.event_submission_email_attempts
      where submission_id = p_submission_id
        and email_event   = p_email_event
        and status        = 'pending'
        and claimed_at    < now() - p_stale_after
      for update skip locked
      limit 1
   )
   returning id into v_attempt_id;

  if v_attempt_id is not null then
    return v_attempt_id;
  end if;

  -- Fresh claim. A unique violation means another caller holds the claim or
  -- the email already sent — either way this caller must not send.
  begin
    insert into public.event_submission_email_attempts
      (submission_id, email_event, status, recipient_kind)
    values
      (p_submission_id, p_email_event, 'pending', p_recipient_kind)
    returning id into v_attempt_id;
  exception
    when unique_violation then
      return null;
  end;

  return v_attempt_id;
end;
$$;

comment on function public.claim_submission_email_attempt(uuid, text, text, interval) is
  'Atomically claims the right to send one submission email. Returns the attempt id, or NULL when the email already sent or is in flight. Service-role only.';

-- ----------------------------------------------------------------------------
-- 5. complete_submission_email_attempt()
-- ----------------------------------------------------------------------------
-- Closes a claim opened above. Only ever moves 'pending' -> 'sent'/'failed',
-- so a late/duplicate completion cannot rewrite a settled attempt.

create or replace function public.complete_submission_email_attempt(
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

  update public.event_submission_email_attempts
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

comment on function public.complete_submission_email_attempt(uuid, text, text, text) is
  'Closes a claimed submission-email attempt as sent or failed. Only transitions from pending, so a settled attempt is never rewritten. Service-role only.';

-- ----------------------------------------------------------------------------
-- 6. Grants — service role only
-- ----------------------------------------------------------------------------
-- Neither function is callable from the browser. `service_role` bypasses RLS
-- but NOT function EXECUTE ACLs, so revoking the default PUBLIC grant would
-- lock the Edge Function out too — the explicit grant below is required.
-- Same pattern as public.account_deletion_blocker() in
-- 20260830000000_account_deletion_storage_check.sql.

revoke all on function public.claim_submission_email_attempt(uuid, text, text, interval)
  from public, anon, authenticated;
revoke all on function public.complete_submission_email_attempt(uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_submission_email_attempt(uuid, text, text, interval)
  to service_role;
grant execute on function public.complete_submission_email_attempt(uuid, text, text, text)
  to service_role;

-- ----------------------------------------------------------------------------
-- 6b. Service-role READ grants for the Edge Function
-- ----------------------------------------------------------------------------
-- REQUIRED. This project revokes Supabase's default `service_role` table
-- grants: on a stock install `service_role` has only
-- REFERENCES/TRIGGER/TRUNCATE on public.event_submissions and
-- public.platform_settings — no SELECT. Verified against a live stack, where
-- a service-role read returned:
--   42501 permission denied for table event_submissions
-- Without the grants below, `send-submission-email` fails its very first read
-- and returns 503 for every send. This is not optional polish.
--
-- COLUMN-LEVEL, not table-level, and that is deliberate.
--
-- The requirement "internal_note must never reach the submitter" is enforced
-- three times over. Two of those are code: the function's SELECT list omits
-- the column, and the rejection template has no parameter for it. Both are
-- promises a future edit could break. The grant below is the third and only
-- structural one: the service role is not permitted to read
-- `internal_note` at all, so a regression that tried to select it fails with
-- a permission error instead of leaking a moderator's private note to a
-- member of the public.
--
-- Keep this column list in sync with readSubmission()'s select in
-- supabase/functions/send-submission-email/index.ts. Adding a column there
-- without adding it here produces a 42501, not silent breakage.

grant select (
  id,
  status,
  submitter_email,
  submitter_name,
  submitted_data,
  edited_data,
  rejection_message,
  approved_event_id,
  submitted_at
  -- internal_note is INTENTIONALLY ABSENT. Do not add it.
) on public.event_submissions to service_role;

grant select (
  platform_name,
  public_site_url,
  support_email,
  singleton
) on public.platform_settings to service_role;

-- The attempts table needs no service_role grant: the Edge Function only
-- touches it through the two SECURITY DEFINER functions above, which execute
-- as the owner. Least privilege by construction.

commit;

-- ----------------------------------------------------------------------------
-- 7. Notify PostgREST to reload schema
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';

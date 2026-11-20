-- ============================================================================
-- Event Submission Email Notifications — 004: member publication emails
-- ============================================================================
--
-- PURPOSE
--   Allows the published and auto_published email events for submissions that
--   signed-in members publish without moderator approval.
--
-- REQUIRED vs OPTIONAL
--   REQUIRED before deploying the updated send-submission-email Edge Function.
--   Depends on: 001_email_delivery_attempts.sql.
--
-- EXECUTION ORDER
--   Apply 001 first, then this file, then deploy send-submission-email.
--   Replaces only the email-event constraint and claim function's event list;
--   existing delivery history, idempotency guards, and function grants remain.
-- ============================================================================

begin;

alter table public.event_submission_email_attempts
  drop constraint if exists event_submission_email_attempts_email_event_check;

alter table public.event_submission_email_attempts
  add constraint event_submission_email_attempts_email_event_check
  check (email_event in (
    'received', 'awaiting_review', 'approved', 'rejected', 'published', 'auto_published'
  ));

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
  if p_email_event not in ('received', 'awaiting_review', 'approved', 'rejected', 'published', 'auto_published') then
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

notify pgrst, 'reload schema';

commit;

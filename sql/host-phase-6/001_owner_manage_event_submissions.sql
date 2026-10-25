-- =====================================================================
-- Host Phase 6 — owner management of event_submissions
--
-- Purpose:
--   Repair a verified lifecycle gap: /submit writes new events to
--   public.event_submissions with status='pending', but before this policy
--   only moderators/admins may UPDATE that table. The Host UI consequently
--   could not truthfully make a newly submitted event appear, edit it, or
--   withdraw it through the canonical moderation workflow.
--
--   This file lets an authenticated submitter:
--     - save edited_data for their own pending or rejected submission; and
--     - change only pending -> withdrawn to withdraw their own submission.
--
--   It never permits canonical event mutation, approval, rejection,
--   reviewer-field mutation, deletion, or publication.
--
-- Required / optional: REQUIRED for a fully working moderated Organizer MVP.
--   It must be manually reviewed and applied before Phase 6's owner-submission
--   code can operate against production.
--
-- Execution order: standalone. Run after the existing
--   20260817000000_event_submissions migration and before deploying Phase 6
--   application code.
--
-- Tables affected: public.event_submissions (UPDATE policy + UPDATE trigger).
--
-- Data impact: no existing row is changed when this file runs. Future owner
--   saves write edited_data; owner withdrawal changes pending -> withdrawn.
--   No DELETE policy is created: submission history remains permanent.
--
-- Safety notes:
--   - RLS uses submitter_id = auth.uid(), existing pending/rejected state, and
--     account_is_active(auth.uid()). A plain authenticated role is never
--     enough.
--   - The trigger guards columns RLS cannot compare against OLD values. It
--     freezes submitted_data, submitter identity, reviewer fields, internal
--     notes, approved_event_id, duplicate fields, and timestamps from owner
--     mutation. Moderators/admins remain exempt through existing
--     is_moderator(), preserving current review tooling.
--   - Owner transition is narrow: pending may become withdrawn. Rejected may
--     remain rejected while edited_data changes; saving does NOT silently
--     resubmit, approve, or publish it.
--   - `edited_data` is retained as structured audit input. Existing admin
--     approval logic already applies submitted_data plus edited_data.
--   - Idempotent policy/trigger replacement only targets objects this file
--     owns. No existing policy is dropped except the same named policy.
--
-- Rollback considerations:
--   Drop the owner UPDATE policy and trigger first. Existing submission rows
--   remain intact; no history is lost. See commented rollback at the end.
--
-- IMPORTANT: Do not execute against production automatically.
-- =====================================================================

-- Owner UPDATE policy. Existing "Submitters read own submissions" SELECT
-- policy supplies required visibility for UPDATE. Existing grant UPDATE on the
-- table already targets authenticated; repeat grant is harmless and explicit.
grant update on public.event_submissions to authenticated;

drop policy if exists "Submitters edit or withdraw own submissions" on public.event_submissions;
create policy "Submitters edit or withdraw own submissions"
  on public.event_submissions
  for update
  to authenticated
  using (
    submitter_id = (select auth.uid())
    and status in ('pending', 'rejected')
    and public.account_is_active((select auth.uid()))
  )
  with check (
    submitter_id = (select auth.uid())
    and status in ('pending', 'rejected', 'withdrawn')
    and public.account_is_active((select auth.uid()))
  );

-- RLS cannot inspect OLD values. This trigger gives owner writes a narrow,
-- auditable shape while preserving unrestricted existing moderator workflow.
create or replace function public.guard_submitter_submission_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_moderator() then
    return new;
  end if;

  if old.submitter_id is distinct from auth.uid() then
    raise exception 'submission owner required' using errcode = '42501';
  end if;

  if old.status not in ('pending', 'rejected') then
    raise exception 'only pending or rejected submissions may be changed by submitter'
      using errcode = '42501';
  end if;

  -- Owner may retain status while saving edits, or withdraw a pending record.
  if not (
    new.status = old.status
    or (old.status = 'pending' and new.status = 'withdrawn')
  ) then
    raise exception 'submitter may only withdraw a pending submission'
      using errcode = '42501';
  end if;

  -- Canonical source, identity, reviewer workflow, and duplicate handling
  -- remain moderator-owned. An owner may only alter edited_data and the
  -- narrow status transition above; updated_at is maintained separately.
  if new.submitted_data is distinct from old.submitted_data
     or new.submitter_id is distinct from old.submitter_id
     or new.submitter_email is distinct from old.submitter_email
     or new.submitter_name is distinct from old.submitter_name
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.rejection_reason is distinct from old.rejection_reason
     or new.rejection_message is distinct from old.rejection_message
     or new.internal_note is distinct from old.internal_note
     or new.duplicate_of_event_id is distinct from old.duplicate_of_event_id
     or new.dismissed_duplicate_ids is distinct from old.dismissed_duplicate_ids
     or new.approved_event_id is distinct from old.approved_event_id
     or new.submitted_at is distinct from old.submitted_at
     or new.created_at is distinct from old.created_at then
    raise exception 'submitter may only save edited event data or withdraw'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists event_submissions_guard_submitter_update on public.event_submissions;
create trigger event_submissions_guard_submitter_update
  before update on public.event_submissions
  for each row execute function public.guard_submitter_submission_update();

comment on function public.guard_submitter_submission_update() is
  'Restricts non-moderator owners to edited_data changes and pending->withdrawn only; preserves immutable moderation history.';

notify pgrst, 'reload schema';

-- Manual rollback (do not run as part of normal deployment):
-- drop trigger if exists event_submissions_guard_submitter_update on public.event_submissions;
-- drop function if exists public.guard_submitter_submission_update();
-- drop policy if exists "Submitters edit or withdraw own submissions" on public.event_submissions;
-- notify pgrst, 'reload schema';

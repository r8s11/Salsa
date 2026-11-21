-- Capture production-only objects that govern submitter edits of event_submissions.
-- Production has had this policy and trigger since before the repo tracked them;
-- 20261121012558 defines public.guard_submitter_submission_update() but never
-- attached it, so fresh databases let owners change moderator-owned columns.
-- Definitions match production exactly; both statements are idempotent there.

drop policy if exists "Submitters edit or withdraw own submissions" on public.event_submissions;
create policy "Submitters edit or withdraw own submissions"
  on public.event_submissions
  for update
  to authenticated
  using (
    submitter_id = (select auth.uid())
    and status = any (array['pending', 'rejected'])
    and public.account_is_active((select auth.uid()))
  )
  with check (
    submitter_id = (select auth.uid())
    and status = any (array['pending', 'rejected', 'withdrawn'])
    and public.account_is_active((select auth.uid()))
  );

drop trigger if exists event_submissions_guard_submitter_update on public.event_submissions;
create trigger event_submissions_guard_submitter_update
  before update on public.event_submissions
  for each row execute function public.guard_submitter_submission_update();

comment on function public.guard_submitter_submission_update() is
  'Restricts non-moderator owners to edited_data changes and pending->withdrawn only; preserves immutable moderation history.';

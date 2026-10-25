-- Ties a submission to the account that made it, so "my submissions" can
-- be looked up reliably instead of matching the free-text email field.
-- Nullable: every pre-existing row (all submitted before Auth existed) has
-- no owning account and simply won't appear under anyone's profile — correct,
-- since no account owns them.
alter table public.events add column submitter_id uuid references auth.users(id);

-- Lets a signed-in user see their own submissions at any status (not just
-- approved). Combines via OR with the existing public/admin SELECT policies.
create policy "Users can view own submissions"
  on public.events
  for select
  to authenticated
  using (submitter_id = auth.uid());

-- Hardening on the existing insert policy (20260809000000_events_insert_policy.sql):
-- without this, an authenticated request could set submitter_id to someone
-- else's UUID, making a spam submission appear on a stranger's profile, or
-- an anon request could set a submitter_id at all despite having no session.
-- `IS NOT DISTINCT FROM` null-safely requires: anon (auth.uid() is null) ->
-- submitter_id must be null; authenticated -> submitter_id must equal auth.uid().
alter policy "Anon can submit pending events"
  on public.events
  with check (status = 'pending' and submitter_id is not distinct from auth.uid());

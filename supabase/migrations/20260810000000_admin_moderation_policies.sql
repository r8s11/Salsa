-- Admin moderation policies for public.events.
-- Grants sit below policies — without grant update, the UPDATE policy is
-- never evaluated. SELECT is already granted to `authenticated` by the
-- baseline migration; this only adds a second SELECT policy (RLS combines
-- same-command policies with OR) so admins see pending/rejected rows too.
grant update on public.events to authenticated;

create policy "Admins can view all events"
  on public.events
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can update events"
  on public.events
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

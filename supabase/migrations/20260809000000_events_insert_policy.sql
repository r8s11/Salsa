-- Anon insert capped to status='pending' so anonymous writes can never bypass
-- moderation. Mirrors Docs/sql queries/fix_insert_rls.sql as applied to
-- production. Both SubmitEventPage and scripts/import-ics.mjs insert with
-- status='pending'.

-- Policies sit on top of grants — without the grant, the policy never runs.
grant insert on public.events to anon, authenticated;

create policy "Anon can submit pending events"
  on public.events
  for insert
  to anon, authenticated
  with check (status = 'pending');

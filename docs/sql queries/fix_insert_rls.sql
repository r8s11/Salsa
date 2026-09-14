-- Restore an anon-insert policy on public.events, capped to status='pending'
-- so anonymous writes can never bypass moderation.
--
-- Both SubmitEventPage and scripts/import-ics.mjs insert with status='pending',
-- so this policy is sufficient for both.
--
-- Idempotent: drops any prior insert policy by name first.

-- 1. Make sure RLS is on (Supabase default).
alter table public.events enable row level security;

-- 2. Grant INSERT at the table level. Policies sit ON TOP of grants — if the
--    role lacks the privilege, the policy never gets a chance to allow the row.
grant insert on public.events to anon, authenticated;

-- 3. Drop any prior insert policies on this table to avoid leftover restrictive
--    policies silently AND-ing themselves into the check.
drop policy if exists "Anyone can insert events" on public.events;
drop policy if exists "Anon can submit pending events" on public.events;

-- 4. Create the permissive insert policy.
create policy "Anon can submit pending events"
  on public.events
  for insert
  to anon, authenticated
  with check (status = 'pending');

-- 5. Tell PostgREST (the layer behind supabase-js) to reload the schema cache.
--    Without this, recently-added columns / changed policies can be invisible
--    to the API for up to a minute.
notify pgrst, 'reload schema';

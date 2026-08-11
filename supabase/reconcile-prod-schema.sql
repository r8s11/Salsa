-- Reconcile the hosted (production) Supabase project's public.events schema
-- with local migrations. NOT `supabase db push` / `db reset` — those are
-- explicitly unsafe here (see baseline migration's header comment): the
-- local baseline is reconstructed from `Docs/sql queries/`, not dumped from
-- production, and reset drops/recreates the database. This script only ever
-- adds columns/policies/grants that are provably missing; it never drops or
-- rewrites data.
--
-- Root cause of "column events.submitter_id does not exist": three
-- migrations were written locally and applied to the local dev database but
-- were never run against the hosted project (documented as a known,
-- deferred gap in Docs/superpowers/plans/2026-08-09-salsa-local-supabase-plan.md
-- — "obtain the project's DB password" before ever pushing migrations).
-- Cross-referencing `Docs/sql queries/*.sql` (the scripts actually applied to
-- production, per that plan) against `supabase/migrations/*.sql` (the local
-- migration history) shows exactly what's missing on prod:
--
--   MISSING (this script adds them):
--   - host, recurrence, gallery columns             (20260714000000)
--   - submitter_id column + its SELECT policy       (20260811000000)
--   - insert-policy hardening (submitter_id check)  (20260811000000)
--   - admin SELECT/UPDATE policies + update grant   (20260810000000)
--
--   ALREADY ON PROD (confirmed via Docs/sql queries/, not touched here):
--   - image_url          — in the original events.sql create table
--   - submitter_name/email, city, price_amount fix — hand-applied scripts
--   - the pending-only anon insert policy — fix_insert_rls.sql already
--     created a policy named "Anon can submit pending events" with the same
--     definition as migration 20260809000000; re-creating it would error, so
--     this script only ALTERs it (see below) rather than re-creating it.
--
-- The admin gap means /admin is also currently broken on production, not
-- just /profile: without "Admins can view all events" no admin can see a
-- pending/rejected row, and without the update grant + "Admins can update
-- events" policy no approve/reject can succeed even if they could see one.
--
-- Idempotent: every ADD COLUMN is `if not exists`; every CREATE POLICY is
-- preceded by `drop policy if exists` for that exact name; grants are
-- naturally idempotent. Verified locally by running this script twice against
-- an already-fully-migrated database — both runs succeed with no errors and
-- no duplicate objects.

begin;

alter table public.events
  add column if not exists host text,
  add column if not exists recurrence text,
  add column if not exists gallery text[],
  add column if not exists submitter_id uuid references auth.users(id);

-- Lets a signed-in user see their own submissions at any status. Combines via
-- OR with the existing public/admin SELECT policies.
drop policy if exists "Users can view own submissions" on public.events;
create policy "Users can view own submissions"
  on public.events
  for select
  to authenticated
  using (submitter_id = auth.uid());

-- Harden the existing anon-insert policy (already on prod via
-- Docs/sql queries/fix_insert_rls.sql under this same name) so an
-- authenticated request cannot set submitter_id to someone else's UUID, and
-- an anon request cannot set a submitter_id at all despite having no
-- session. ALTER (not DROP+CREATE) because the policy already exists on
-- prod under this exact name.
alter policy "Anon can submit pending events"
  on public.events
  with check (status = 'pending' and submitter_id is not distinct from auth.uid());

-- Admin moderation: without this grant + these two policies, no admin can
-- see a pending/rejected event or approve/reject one on production today.
grant update on public.events to authenticated;

drop policy if exists "Admins can view all events" on public.events;
create policy "Admins can view all events"
  on public.events
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
  on public.events
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin event management: without these, /admin cannot create or delete
-- events on production, and events cannot carry public contact info.
alter table public.events
  add column if not exists contact_email text,
  add column if not exists contact_instagram text,
  add column if not exists contact_website text;

grant delete on public.events to authenticated;

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
  on public.events
  for delete
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can insert events" on public.events;
create policy "Admins can insert events"
  on public.events
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Without this, recently-added columns/changed policies can be invisible to
-- the PostgREST API layer (which supabase-js talks to) for up to a minute.
notify pgrst, 'reload schema';

commit;

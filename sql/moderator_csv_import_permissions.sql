-- Moderator CSV Event Import — permissions.
-- MANUAL REVIEW REQUIRED before running against production.
--
-- Widens the existing "Admins can insert events" RLS policy (added in
-- 20260812000000_admin_manage_events.sql) from admin-only to admin OR
-- moderator. This is the same policy every direct event write already goes
-- through (createEventAsAdmin/updateEvent/duplicateEvent in eventsRepo.ts)
-- — CSV import reuses that exact insert path rather than adding a new one.
--
-- Side effect (intentional, documented): this also fixes a pre-existing gap
-- where AdminEventsPage already shows moderators a "Create Event" button
-- that silently failed for them (RLS rejected the insert). After this
-- change, moderators can use both manual "Create Event" and CSV import,
-- consistent with each other.
--
-- Safe / additive: only broadens a `with check` clause on an existing
-- policy. No data change, no new grants beyond what admins already have.

alter policy "Admins can insert events"
  on public.events
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator'));

-- Rollback (restore admin-only):
--   alter policy "Admins can insert events"
--     on public.events
--     with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

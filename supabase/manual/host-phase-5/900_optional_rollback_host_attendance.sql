-- =====================================================================
-- Host Phase 5 — 900 — OPTIONAL ROLLBACK
--
-- !! DESTRUCTIVE !!  READ BEFORE RUNNING.
--
-- Purpose:
--   Removes everything files 001-007 created, in dependency-safe order.
--
-- Required or optional: OPTIONAL. Never run as part of a normal deploy.
--
-- Whether destructive: YES — IRREVERSIBLY.
--   Dropping public.event_check_ins destroys all arrival history.
--   Dropping public.event_attendees destroys every roster entry.
--   There is no soft-delete or archive step here. If either table holds real
--   event data, take a verified backup first and confirm it restores.
--
-- Execution order (reverse of creation):
--   grants -> policies -> triggers -> trigger functions -> indexes (dropped
--   with their tables) -> tables -> authorization helpers.
--
-- Dependencies / ordering notes:
--   - The 001 helper functions cannot be dropped while any 006 policy
--     references them, so policies must go first. The statements below are
--     already in the correct order.
--   - public.set_updated_at() is a PRE-EXISTING shared repo function used by
--     profiles, events, organizers, venues and others. It is deliberately
--     NOT dropped here. Only the trigger binding it to event_attendees is
--     removed.
--   - public.is_organizer() may be adopted by later phases. Dropping it is
--     therefore split out at the very bottom and commented off by default;
--     uncomment only if nothing else references it.
--
-- Partial rollback:
--   To disable the feature without data loss, run the REVOKE block only.
--   That removes Data API access while leaving every row intact.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Revoke Data API access (non-destructive; safe to run alone)
-- ---------------------------------------------------------------------
revoke all on public.event_check_ins  from authenticated;
revoke all on public.event_attendees  from authenticated;

-- ---------------------------------------------------------------------
-- 2. Policies
-- ---------------------------------------------------------------------
drop policy if exists "Hosts reverse check-ins for own approved events" on public.event_check_ins;
drop policy if exists "Hosts record check-ins for own approved events" on public.event_check_ins;
drop policy if exists "Hosts read own approved event check-ins"        on public.event_check_ins;

drop policy if exists "Hosts delete never-checked-in attendees"    on public.event_attendees;
drop policy if exists "Hosts update own approved event attendees"  on public.event_attendees;
drop policy if exists "Hosts add attendees to own approved events" on public.event_attendees;
drop policy if exists "Hosts read own approved event attendees"    on public.event_attendees;

-- ---------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------
drop trigger if exists event_check_ins_guard_immutable on public.event_check_ins;
drop trigger if exists event_attendees_guard_immutable on public.event_attendees;
drop trigger if exists event_attendees_set_updated_at  on public.event_attendees;

-- ---------------------------------------------------------------------
-- 4. Tables  !! THIS IS THE IRREVERSIBLE STEP !!
-- ---------------------------------------------------------------------
-- Indexes and constraints are dropped with their tables.
drop table if exists public.event_check_ins;
drop table if exists public.event_attendees;

-- ---------------------------------------------------------------------
-- 5. Trigger functions (only after their triggers are gone)
-- ---------------------------------------------------------------------
drop function if exists public.guard_event_check_in_immutable_columns();
drop function if exists public.guard_event_attendee_immutable_columns();

-- NOTE: public.set_updated_at() is shared and intentionally preserved.

-- ---------------------------------------------------------------------
-- 6. Authorization helpers (only after all referencing policies are gone)
-- ---------------------------------------------------------------------
drop function if exists public.can_manage_event_attendance(uuid);

-- Uncomment ONLY if no later phase references is_organizer():
-- drop function if exists public.is_organizer();

notify pgrst, 'reload schema';

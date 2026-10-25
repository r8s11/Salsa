-- =====================================================================
-- Host Phase 5 — 005 — indexes and the one-active-check-in rule
--
-- Purpose:
--   1. The concurrency-critical partial unique index that makes duplicate
--      active check-ins impossible.
--   2. Supporting indexes for roster/door queries and for every foreign key,
--      so the Supabase performance advisor has no unindexed-FK findings and
--      so cascading deletes do not sequential-scan.
--
-- Required or optional: REQUIRED. The partial unique index is the mechanism
--   that satisfies "a current attendee cannot have multiple active check-ins
--   accidentally". Do not treat it as an optional performance tweak.
--
-- Execution order: FIFTH (after 004, before 006).
--
-- Dependencies: public.event_attendees, public.event_check_ins.
--
-- Safety notes:
--   - All statements use `if not exists`, so the file is idempotent.
--   - Index creation here is NOT concurrent. These tables are new and empty
--     at first run, so the brief lock is irrelevant. If this file is ever
--     re-run against a large populated table, switch to
--     `create index concurrently` and run it outside a transaction block.
--   - The partial unique index is the concurrency guarantee: two door workers
--     double-tapping the same attendee at the same instant cannot both
--     succeed. The second INSERT fails on a unique violation (SQLSTATE
--     23505) at COMMIT-time serialization, which is exactly the desired
--     behavior — no application-level lock, no distributed coordination.
--     The application should treat 23505 on this index as "already checked
--     in" rather than as an error to surface raw.
--
-- Whether destructive: NO. Adds indexes only.
--
-- Rollback considerations: see 900. Dropping the partial unique index
--   silently re-permits duplicate active check-ins; do not drop it while the
--   check-in feature is live.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. One active (non-reversed) check-in per attendee
-- ---------------------------------------------------------------------
-- Reversed rows are excluded from the uniqueness scope, so an attendee can
-- legitimately be checked in, reversed, and checked in again — while never
-- holding two simultaneous active check-ins.
create unique index if not exists event_check_ins_one_active_per_attendee_idx
  on public.event_check_ins (attendee_id)
  where reversed_at is null;

-- ---------------------------------------------------------------------
-- 2. Roster and door-mode query paths
-- ---------------------------------------------------------------------
-- Primary roster fetch: all attendees for one event, name-ordered.
create index if not exists event_attendees_event_id_idx
  on public.event_attendees (event_id);

create index if not exists event_attendees_event_category_idx
  on public.event_attendees (event_id, category);

-- Attendance/check-in history for one event.
create index if not exists event_check_ins_event_id_idx
  on public.event_check_ins (event_id);

-- Covers BOTH the attendee_id lookup path (as a leading prefix) and the
-- composite foreign key (attendee_id, event_id) exactly. A separate
-- single-column attendee_id index would be redundant with this one.
create index if not exists event_check_ins_attendee_event_idx
  on public.event_check_ins (attendee_id, event_id);

-- ---------------------------------------------------------------------
-- 3. Foreign-key coverage
-- ---------------------------------------------------------------------
-- Unindexed FK columns force sequential scans on parent deletes and are
-- flagged by the Supabase performance advisor. These tables are small and
-- write volume is low (door check-ins), so full FK coverage is the right
-- trade.
create index if not exists event_attendees_profile_id_idx
  on public.event_attendees (profile_id)
  where profile_id is not null;

create index if not exists event_attendees_created_by_idx
  on public.event_attendees (created_by);

create index if not exists event_check_ins_checked_in_by_idx
  on public.event_check_ins (checked_in_by);

create index if not exists event_check_ins_reversed_by_idx
  on public.event_check_ins (reversed_by)
  where reversed_by is not null;

notify pgrst, 'reload schema';

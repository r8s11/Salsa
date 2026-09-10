-- =====================================================================
-- Host Phase 5 — 003 — public.event_check_ins
--
-- Purpose:
--   Append-only arrival history for roster entries. One row per recorded
--   arrival. Reversal is a state change on the row, never a delete, so the
--   operational record of "this person was checked in and then that was
--   undone, by whom, when, and why" survives.
--
-- Required or optional: REQUIRED.
--
-- Execution order: THIRD (after 002, before 004).
--
-- Dependencies:
--   - public.event_attendees (composite FK target created in 002)
--   - auth.users             (checked_in_by / reversed_by actors)
--
-- Design decision — event_id is stored, not derived:
--   The spec asks whether event_id should live on the check-in row or be
--   derived from the attendee. It is stored here, for two reasons:
--     1. Query efficiency: door mode and attendance counts filter by event,
--        and RLS itself filters by event. Deriving it would force a join
--        into every policy evaluation.
--     2. Integrity: because it is stored, it can be CONSTRAINED. The
--        composite foreign key (attendee_id, event_id) referencing
--        event_attendees(id, event_id) makes a cross-event check-in
--        structurally impossible — the database rejects it, rather than
--        relying on application code to pass the right pair.
--   Denormalization without a constraint would be a bug; denormalization
--   with a composite FK is the point.
--
-- Safety notes:
--   - `create table if not exists`: same create-once caveat as 002. CHECK
--     constraints apply at creation time only.
--   - RLS is enabled at creation. Policies land in 006, grants in 007.
--   - ON DELETE CASCADE from attendee: removing a roster entry removes its
--     arrival history with it. Note that 006 deliberately forbids deleting
--     an attendee that has any check-in history, so this cascade is reachable
--     in practice only through event deletion (002 cascade) or privileged
--     maintenance.
--   - No QR token storage, no device/scanner fingerprint, no geolocation, and
--     no IP capture. `method` records only HOW the arrival was recorded.
--     'future_qr' and 'future_self_check_in' are accepted values so the
--     constraint does not need changing later, but nothing in this phase
--     writes them.
--
-- Whether destructive: NO. Creates one new table.
--
-- Rollback considerations: see 900. Dropping this table destroys arrival
--   history irreversibly; the rollback file is marked accordingly.
-- =====================================================================

create table if not exists public.event_check_ins (
  id             uuid        primary key default gen_random_uuid(),

  attendee_id    uuid        not null,

  -- Stored deliberately. See "Design decision" above.
  event_id       uuid        not null,

  checked_in_at  timestamptz not null default now(),

  -- The authenticated actor who recorded the arrival. RLS in 006 forces this
  -- to equal auth.uid() on INSERT; the trigger in 004 makes it immutable.
  checked_in_by  uuid        not null references auth.users(id),

  method         text        not null default 'manual'
                   check (method in ('manual', 'door', 'future_qr', 'future_self_check_in')),

  -- Reversal fields. Present from day one because correcting a mistaken
  -- check-in is a real door-night need, and because reversal must be
  -- non-destructive to preserve history.
  reversed_at     timestamptz null,
  reversed_by     uuid        null references auth.users(id),
  reversal_reason text        null
                    check (reversal_reason is null or length(reversal_reason) <= 300),

  created_at     timestamptz not null default now(),

  -- Cross-event integrity: the (attendee, event) pair must exist on the
  -- roster. This is what makes a cross-event check-in impossible.
  -- No ON UPDATE action, so an attendee's event_id cannot be moved out from
  -- under an existing check-in either.
  constraint event_check_ins_attendee_event_fkey
    foreign key (attendee_id, event_id)
    references public.event_attendees (id, event_id)
    on delete cascade,

  -- Reversal is all-or-nothing: a reversed row must record both when and by
  -- whom. Prevents half-written reversals that would be ambiguous later.
  constraint event_check_ins_reversal_complete
    check (
      (reversed_at is null and reversed_by is null)
      or (reversed_at is not null and reversed_by is not null)
    ),

  -- A reason without a reversal is meaningless.
  constraint event_check_ins_reason_requires_reversal
    check (reversal_reason is null or reversed_at is not null),

  -- Time cannot run backwards.
  constraint event_check_ins_reversal_after_check_in
    check (reversed_at is null or reversed_at >= checked_in_at)
);

alter table public.event_check_ins enable row level security;

comment on table public.event_check_ins is
  'Append-only arrival history for event_attendees. Reversal is a state change, never a delete. Private Host operational data.';
comment on column public.event_check_ins.event_id is
  'Stored (not derived) so it can be constrained: composite FK to event_attendees(id, event_id) makes cross-event check-ins impossible.';
comment on column public.event_check_ins.method is
  'How the arrival was recorded. future_qr / future_self_check_in are reserved values; nothing writes them in Phase 5.';

notify pgrst, 'reload schema';

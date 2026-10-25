-- =====================================================================
-- Host Phase 5 — 002 — public.event_attendees
--
-- Purpose:
--   The unified event roster. One row per person expected or permitted to
--   attend an event, regardless of how they got on the list: Host-added
--   guests, comps, staff, performers, instructors, door walk-ins, and
--   (future) public registrations.
--
--   Rationale for a single table rather than separate registration and
--   guest-list tables:
--     - Door mode needs ONE roster query, not a union of two shapes.
--     - Check-in needs ONE foreign key target, not a polymorphic parent.
--     - Attendance counts are a single aggregate.
--     - Public self-registration does not exist in this product yet, so a
--       dedicated registration table would be speculative today.
--   The `source` column keeps future registrations distinguishable, and a
--   separate event_registrations table can still be added later for
--   payment/booking state without reshaping this roster.
--
-- Required or optional: REQUIRED.
--
-- Execution order: SECOND (after 001, before 003).
--
-- Dependencies:
--   - public.events    (event_id target)
--   - public.profiles  (optional profile_id link)
--   - auth.users       (created_by actor)
--   - public.set_updated_at()  (existing trigger function; wired in 004)
--
-- Safety notes:
--   - `create table if not exists` makes re-running a no-op, but it also
--     means the CHECK constraints below are only applied at creation time.
--     Treat this as a create-once file: if the table already exists with a
--     different shape, stop and reconcile deliberately rather than
--     re-running this file and assuming the constraints landed.
--   - RLS is enabled here, immediately at creation, so the table is never
--     exposed unprotected. Policies arrive in 006 and grants in 007, so
--     between 002 and 007 the table is readable by nobody through the
--     Data API (deny-by-default).
--   - `unique (id, event_id)` looks redundant against the primary key. It is
--     required: it is the target of the composite foreign key in 003 that
--     makes cross-event check-ins structurally impossible.
--
-- Whether destructive: NO. Creates one new table. No existing object or row
--   is modified.
--
-- Rollback considerations: see 900. Dropping this table cascades to
--   event_check_ins rows (003 declares ON DELETE CASCADE from attendee).
--
-- Data/PII note:
--   Deliberately minimal. display_name is the only required personal field.
--   email is optional and never required for door entry. No phone, no
--   payment data, no auth tokens, no profile snapshot copies. See the
--   privacy analysis in the Phase 5 report for retention considerations
--   (no retention automation is built in this phase).
-- =====================================================================

create table if not exists public.event_attendees (
  id           uuid        primary key default gen_random_uuid(),

  -- Roster belongs to a canonical event. Deleting the event removes its
  -- roster: attendance is operational data with no meaning once the event
  -- record is gone, and orphaned rosters would be worse than removal.
  event_id     uuid        not null references public.events(id) on delete cascade,

  -- Optional link to a registered account. NULL is the normal case for
  -- Host-added guests and walk-ins: this model never fabricates a profile
  -- for an unregistered person. Set null on profile deletion so the roster
  -- entry survives account removal.
  profile_id   uuid        null references public.profiles(id) on delete set null,

  -- Required for every entry, including profile-linked ones, so door staff
  -- always have a name to read off the list without joining profiles.
  display_name text        not null
                 check (btrim(display_name) <> '' and length(display_name) <= 120),

  email        text        null
                 check (email is null or (btrim(email) <> '' and length(email) <= 300)),

  -- WHO this person is to the event. Constrained text (not an enum) to match
  -- the established convention on events.status, events.city, profiles.role,
  -- organizers.status, organizer_members.member_role, and to keep future
  -- category additions a one-line constraint change rather than an enum
  -- migration.
  category     text        not null
                 check (category in (
                   'registered', 'guest', 'comp', 'staff',
                   'performer', 'instructor', 'walk_in'
                 )),

  -- HOW the entry was created. Distinct from category on purpose: a walk_in
  -- category and a door source are different facts, and a future public
  -- registration will be category 'registered' with source
  -- 'future_registration'.
  source       text        not null default 'host'
                 check (source in ('host', 'door', 'future_registration', 'system')),

  -- One row can represent a small party ("Ana +2"). Bounded on both ends:
  -- >= 1 because a zero-person attendee is meaningless, <= 20 to stop a
  -- typo from corrupting headcounts. Raise deliberately if a real product
  -- need appears.
  party_size   integer     not null default 1
                 check (party_size >= 1 and party_size <= 20),

  notes        text        null
                 check (notes is null or length(notes) <= 500),

  -- The authenticated actor who created the row. RLS in 006 forces this to
  -- equal auth.uid() on INSERT, and the trigger in 004 makes it immutable,
  -- so it cannot be spoofed or reassigned after the fact.
  created_by   uuid        not null references auth.users(id),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Required composite-FK target for 003. See safety notes above.
  unique (id, event_id)
);

alter table public.event_attendees enable row level security;

comment on table public.event_attendees is
  'Unified per-event roster: Host-added guests, comps, staff, performers, instructors, walk-ins, and future registrations. Private Host operational data.';
comment on column public.event_attendees.category is
  'Who the person is to the event. Distinct from source.';
comment on column public.event_attendees.source is
  'How the entry was created. Distinct from category.';
comment on column public.event_attendees.profile_id is
  'Optional link to a registered account. NULL for unregistered guests and walk-ins; no placeholder profile is ever created.';

notify pgrst, 'reload schema';

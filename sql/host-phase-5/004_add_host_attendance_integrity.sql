-- =====================================================================
-- Host Phase 5 — 004 — integrity and immutability triggers
--
-- Purpose:
--   Enforces at the database level the facts that RLS alone cannot express,
--   because a WITH CHECK clause sees only the NEW row and cannot compare it
--   to the OLD one:
--     1. updated_at maintenance on event_attendees (existing repo helper).
--     2. An attendee can never be moved to a different event, and its
--        created_by actor can never be reassigned.
--     3. A check-in's core facts (which attendee, which event, when, by whom,
--        how) are immutable. Only the reversal fields may change, and only
--        from unreversed to reversed — a reversal can never be silently
--        un-reversed to hide it.
--
-- Required or optional: REQUIRED. Without 004, an authorized Organizer could
--   PATCH an attendee's event_id or a check-in's checked_in_by through the
--   Data API, because the 006 policies would still pass for rows they manage.
--
-- Execution order: FOURTH (after 003, before 005).
--
-- Dependencies:
--   - public.event_attendees, public.event_check_ins (002, 003)
--   - public.set_updated_at() (existing repo trigger function, reused)
--
-- Safety notes:
--   - Triggers are dropped-if-exists then created, so the file is idempotent.
--     Only triggers introduced by this file are touched, each with a distinct
--     name; no pre-existing trigger is affected.
--   - These guards are enforced for every role including service_role and
--     postgres. That is intentional: they encode data-model invariants, not
--     permissions. Deliberate maintenance must drop the trigger explicitly.
--   - Raised errors use SQLSTATE 42501 (insufficient_privilege) so PostgREST
--     surfaces them as 403 rather than a generic 500.
--
-- Whether destructive: NO. Adds trigger functions and triggers only.
--
-- Rollback considerations: see 900.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. updated_at maintenance (reuses the existing repo helper)
-- ---------------------------------------------------------------------
drop trigger if exists event_attendees_set_updated_at on public.event_attendees;
create trigger event_attendees_set_updated_at
  before update on public.event_attendees
  for each row execute function public.set_updated_at();

-- event_check_ins has no updated_at column by design: it is append-only
-- history, and reversal is recorded in explicit, purpose-named columns.

-- ---------------------------------------------------------------------
-- 2. event_attendees immutability
-- ---------------------------------------------------------------------
create or replace function public.guard_event_attendee_immutable_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_id is distinct from old.event_id then
    raise exception 'event_attendees.event_id is immutable'
      using errcode = '42501';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'event_attendees.created_by is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists event_attendees_guard_immutable on public.event_attendees;
create trigger event_attendees_guard_immutable
  before update on public.event_attendees
  for each row execute function public.guard_event_attendee_immutable_columns();

comment on function public.guard_event_attendee_immutable_columns() is
  'Prevents moving a roster entry between events and prevents reassigning its created_by actor.';

-- ---------------------------------------------------------------------
-- 3. event_check_ins immutability + one-way reversal
-- ---------------------------------------------------------------------
create or replace function public.guard_event_check_in_immutable_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.attendee_id is distinct from old.attendee_id
     or new.event_id is distinct from old.event_id then
    raise exception 'event_check_ins attendee_id and event_id are immutable'
      using errcode = '42501';
  end if;

  if new.checked_in_at is distinct from old.checked_in_at
     or new.checked_in_by is distinct from old.checked_in_by
     or new.method is distinct from old.method
     or new.created_at is distinct from old.created_at then
    raise exception 'event_check_ins arrival facts are immutable; reverse the check-in instead'
      using errcode = '42501';
  end if;

  -- Reversal is one-way. Clearing reversed_at would erase the fact that a
  -- reversal happened, which is exactly the history this table exists to keep.
  if old.reversed_at is not null and new.reversed_at is null then
    raise exception 'event_check_ins reversal cannot be undone; record a new check-in instead'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists event_check_ins_guard_immutable on public.event_check_ins;
create trigger event_check_ins_guard_immutable
  before update on public.event_check_ins
  for each row execute function public.guard_event_check_in_immutable_columns();

comment on function public.guard_event_check_in_immutable_columns() is
  'Check-in arrival facts are immutable; reversal is one-way. Re-admitting requires a new check-in row.';

notify pgrst, 'reload schema';

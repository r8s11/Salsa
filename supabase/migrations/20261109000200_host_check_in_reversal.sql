-- =====================================================================
-- Host attendance: server-stamped actors, reversible check-ins
--
-- The Phase 5 tables require event_attendees.created_by,
-- event_check_ins.checked_in_by and (once reversed_at is set) reversed_by
-- to be non-null, and the RLS policies require each to equal auth.uid().
-- Nothing stamped them: the client never sends them and no default or
-- trigger existed, so adding an attendee, checking in and reversing a
-- check-in could not succeed under that schema. These triggers stamp the
-- caller from auth.uid() (RLS still rejects any other value) and make
-- reversed_at server time, so a skewed device clock cannot violate
-- event_check_ins_reversal_after_check_in.
--
-- The trigger functions run as the caller: they only read auth.uid().
-- "One active check-in per attendee" is already enforced by the Phase 5
-- index event_check_ins_one_active_per_attendee_idx.
-- Verified against disposable local Postgres; not applied to production.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. event_attendees.created_by
-- ---------------------------------------------------------------------

create or replace function public.set_event_attendee_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  return new;
end;
$$;

revoke execute on function public.set_event_attendee_actor() from public, anon;

drop trigger if exists event_attendees_set_actor on public.event_attendees;
create trigger event_attendees_set_actor
  before insert on public.event_attendees
  for each row execute function public.set_event_attendee_actor();

-- ---------------------------------------------------------------------
-- 2. event_check_ins.checked_in_by / reversed_at / reversed_by
-- ---------------------------------------------------------------------

create or replace function public.set_event_check_in_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.checked_in_by := coalesce(new.checked_in_by, (select auth.uid()));
  elsif new.reversed_at is not null and old.reversed_at is null then
    -- First reversal: server time and caller are authoritative.
    new.reversed_at := now();
    new.reversed_by := coalesce(new.reversed_by, (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke execute on function public.set_event_check_in_actor() from public, anon;

drop trigger if exists event_check_ins_set_actor on public.event_check_ins;
create trigger event_check_ins_set_actor
  before insert or update on public.event_check_ins
  for each row execute function public.set_event_check_in_actor();

notify pgrst, 'reload schema';

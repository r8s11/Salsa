-- =====================================================================
-- Phase 5 — Host Attendance (event_attendees + event_check_ins)
--
-- Combined migration from sql/host-phase-5/001-007.
-- Authorization function updated to use organizer_members (Phase 6).
--
-- SQL executed: NO (requires manual review and execution)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Authorization helpers
-- ---------------------------------------------------------------------

create or replace function public.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'organizer';
$$;

revoke execute on function public.is_organizer() from public, anon;
grant  execute on function public.is_organizer() to authenticated;

comment on function public.is_organizer() is
  'True when the caller JWT app_metadata.role is exactly organizer.';

-- Updated to use organizer_members from Phase 6 instead of submitter_id.
create or replace function public.can_manage_event_attendance(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (
        (
          e.status = 'approved'
          and e.organizer_id is not null
          and exists (
            select 1
            from public.organizer_members om
            where om.organizer_id = e.organizer_id
              and om.user_id = (select auth.uid())
              and om.status = 'active'
              and om.member_role in ('owner', 'manager')
          )
          and public.account_is_active((select auth.uid()))
        )
        or public.is_admin()
      )
  );
$$;

revoke execute on function public.can_manage_event_attendance(uuid) from public, anon;
grant  execute on function public.can_manage_event_attendance(uuid) to authenticated;

comment on function public.can_manage_event_attendance(uuid) is
  'Single authorization seam for Host attendance: active owner/manager on event organizer, or Admin.';

-- ---------------------------------------------------------------------
-- 2. event_attendees table
-- ---------------------------------------------------------------------

create table if not exists public.event_attendees (
  id           uuid        primary key default gen_random_uuid(),
  event_id     uuid        not null references public.events(id) on delete cascade,
  profile_id   uuid        null references public.profiles(id) on delete set null,
  display_name text        not null
                 check (btrim(display_name) <> '' and length(display_name) <= 120),
  email        text        null
                 check (email is null or (btrim(email) <> '' and length(email) <= 300)),
  category     text        not null
                 check (category in (
                   'registered', 'guest', 'comp', 'staff',
                   'performer', 'instructor', 'walk_in'
                 )),
  source       text        not null default 'host'
                 check (source in ('host', 'door', 'future_registration', 'system')),
  party_size   integer     not null default 1
                 check (party_size >= 1 and party_size <= 20),
  notes        text        null
                 check (notes is null or length(notes) <= 500),
  created_by   uuid        not null references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, event_id)
);

alter table public.event_attendees enable row level security;

comment on table public.event_attendees is
  'Unified per-event roster: Host-added guests, comps, staff, performers, instructors, walk-ins.';

-- ---------------------------------------------------------------------
-- 3. event_check_ins table
-- ---------------------------------------------------------------------

create table if not exists public.event_check_ins (
  id             uuid        primary key default gen_random_uuid(),
  attendee_id    uuid        not null,
  event_id       uuid        not null,
  checked_in_at  timestamptz not null default now(),
  checked_in_by  uuid        not null references auth.users(id),
  method         text        not null default 'manual'
                   check (method in ('manual', 'door', 'future_qr', 'future_self_check_in')),
  reversed_at     timestamptz null,
  reversed_by     uuid        null references auth.users(id),
  reversal_reason text        null
                    check (reversal_reason is null or length(reversal_reason) <= 300),
  created_at     timestamptz not null default now(),
  constraint event_check_ins_attendee_event_fkey
    foreign key (attendee_id, event_id)
    references public.event_attendees (id, event_id)
    on delete cascade,
  constraint event_check_ins_reversal_complete
    check (
      (reversed_at is null and reversed_by is null)
      or (reversed_at is not null and reversed_by is not null)
    ),
  constraint event_check_ins_reason_requires_reversal
    check (reversal_reason is null or reversed_at is not null),
  constraint event_check_ins_reversal_after_check_in
    check (reversed_at is null or reversed_at >= checked_in_at)
);

alter table public.event_check_ins enable row level security;

comment on table public.event_check_ins is
  'Append-only arrival history for event_attendees. Reversal is a state change, never a delete.';

-- ---------------------------------------------------------------------
-- 4. Integrity triggers
-- ---------------------------------------------------------------------

drop trigger if exists event_attendees_set_updated_at on public.event_attendees;
create trigger event_attendees_set_updated_at
  before update on public.event_attendees
  for each row execute function public.set_updated_at();

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

-- ---------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------

create unique index if not exists event_check_ins_one_active_per_attendee_idx
  on public.event_check_ins (attendee_id)
  where reversed_at is null;

create index if not exists event_attendees_event_id_idx
  on public.event_attendees (event_id);

create index if not exists event_attendees_event_category_idx
  on public.event_attendees (event_id, category);

create index if not exists event_check_ins_event_id_idx
  on public.event_check_ins (event_id);

create index if not exists event_check_ins_attendee_event_idx
  on public.event_check_ins (attendee_id, event_id);

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

-- ---------------------------------------------------------------------
-- 6. RLS policies
-- ---------------------------------------------------------------------

-- event_attendees
drop policy if exists "Hosts read own approved event attendees" on public.event_attendees;
create policy "Hosts read own approved event attendees"
  on public.event_attendees for select to authenticated
  using (public.can_manage_event_attendance(event_id));

drop policy if exists "Hosts add attendees to own approved events" on public.event_attendees;
create policy "Hosts add attendees to own approved events"
  on public.event_attendees for insert to authenticated
  with check (
    public.can_manage_event_attendance(event_id)
    and created_by = (select auth.uid())
  );

drop policy if exists "Hosts update own approved event attendees" on public.event_attendees;
create policy "Hosts update own approved event attendees"
  on public.event_attendees for update to authenticated
  using (public.can_manage_event_attendance(event_id))
  with check (public.can_manage_event_attendance(event_id));

drop policy if exists "Hosts delete never-checked-in attendees" on public.event_attendees;
create policy "Hosts delete never-checked-in attendees"
  on public.event_attendees for delete to authenticated
  using (
    public.can_manage_event_attendance(event_id)
    and not exists (
      select 1 from public.event_check_ins c
      where c.attendee_id = event_attendees.id
    )
  );

-- event_check_ins
drop policy if exists "Hosts read own approved event check-ins" on public.event_check_ins;
create policy "Hosts read own approved event check-ins"
  on public.event_check_ins for select to authenticated
  using (public.can_manage_event_attendance(event_id));

drop policy if exists "Hosts record check-ins for own approved events" on public.event_check_ins;
create policy "Hosts record check-ins for own approved events"
  on public.event_check_ins for insert to authenticated
  with check (
    public.can_manage_event_attendance(event_id)
    and checked_in_by = (select auth.uid())
    and reversed_at is null
    and reversed_by is null
  );

drop policy if exists "Hosts reverse check-ins for own approved events" on public.event_check_ins;
create policy "Hosts reverse check-ins for own approved events"
  on public.event_check_ins for update to authenticated
  using (public.can_manage_event_attendance(event_id))
  with check (
    public.can_manage_event_attendance(event_id)
    and (reversed_at is null or reversed_by = (select auth.uid()))
  );

-- No DELETE policy on event_check_ins — arrival history is never destroyed.

-- ---------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------

grant select, insert, update, delete on public.event_attendees to authenticated;
grant select, insert, update on public.event_check_ins to authenticated;
revoke all on public.event_attendees from anon;
revoke all on public.event_check_ins from anon;

notify pgrst, 'reload schema';

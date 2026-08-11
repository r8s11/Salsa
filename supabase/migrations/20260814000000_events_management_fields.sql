-- Phase 3 — status vocabulary, source, dance styles, timestamps.
-- Additive and nullable-or-defaulted: old code keeps working after this
-- migration applies; deploy ordering rule is migration before push.

alter table public.events
  add column if not exists source_type text not null default 'user_submission',
  add column if not exists dance_styles text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancellation_reason text;

alter table public.events
  add constraint events_source_type_check
  check (source_type in ('admin','user_submission','organizer','moderator','imported'));

alter table public.events
  add constraint events_status_check
  check (status in ('draft','pending','approved','rejected','cancelled','archived'));

-- Backfill source_type from the writers that exist today:
-- createEventAsAdmin stamps submitter_name = 'Salsa Segura' (eventsRepo.ts:133),
-- import-ics.mjs stamps submitter_name = 'ICS import (golatindance.com)' and
-- submitter_email = '<city>@import.local', seed.sql uses 'Seed Data'.
update public.events set source_type = case
  when submitter_email like '%@import.local' then 'imported'
  when submitter_name in ('Salsa Segura', 'Seed Data') then 'admin'
  else 'user_submission'
end;

-- Backfill dance_styles by case-insensitive regex over title + description.
-- These patterns are the literals the Dance Style filter reads — fixed here.
update public.events
  set dance_styles = array_remove(array[
    case when (title || ' ' || coalesce(description, '')) ~* 'salsa|casino|rueda|on1|on2|mambo|timba' then 'salsa' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'bachata' then 'bachata' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'kizomba|urban kiz' then 'kizomba' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'merengue' then 'merengue' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'cha[ -]?cha' then 'cha-cha' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'zouk' then 'zouk' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'afro[ -]?cuban|rumba' then 'afro-cuban' end
  ], null);

create index if not exists events_dance_styles_idx
  on public.events using gin (dance_styles);

-- Reuse Phase 2's set_updated_at() function (profiles.sql:49) — no new function needed.
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Extend the audit trigger so the two new terminal states get their own
-- action literals. draft intentionally keeps falling through to
-- event.status_changed — it's reachable from both Unpublish and Restore,
-- and a single literal would misdescribe one of them.
create or replace function public.log_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action      text;
  v_entity_id   uuid;
  v_title       text;
  v_from_status text;
  v_to_status   text;
begin
  if tg_op = 'INSERT' then
    v_action      := 'event.created';
    v_entity_id   := new.id;
    v_title       := new.title;
    v_from_status := null;
    v_to_status   := new.status;
  elsif tg_op = 'DELETE' then
    v_action      := 'event.deleted';
    v_entity_id   := old.id;
    v_title       := old.title;
    v_from_status := old.status;
    v_to_status   := null;
  else
    v_entity_id   := new.id;
    v_title       := new.title;
    v_from_status := old.status;
    v_to_status   := new.status;
    if old.status is distinct from new.status then
      v_action := case new.status
        when 'approved' then 'event.approved'
        when 'rejected' then 'event.rejected'
        when 'cancelled' then 'event.cancelled'
        when 'archived' then 'event.archived'
        else 'event.status_changed'
      end;
    else
      v_action := 'event.updated';
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    v_action,
    'event',
    v_entity_id,
    jsonb_build_object(
      'title', v_title,
      'from_status', v_from_status,
      'to_status', v_to_status
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

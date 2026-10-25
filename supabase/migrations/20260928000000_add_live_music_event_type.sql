-- Add Live Music as a first-class event type while preserving existing rows.
alter table public.events
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_type_check
  check (event_type in ('social', 'workshop', 'class', 'live_music'));

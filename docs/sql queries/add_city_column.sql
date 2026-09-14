-- Migration: add `city` column to public.events.
-- Idempotent — safe to re-run.
-- Default 'boston' so any existing rows stay valid against the CHECK constraint.

alter table public.events
  add column if not exists city text
    check (city in ('boston', 'new-york-city'))
    default 'boston';

create index if not exists events_city_idx on public.events (city);

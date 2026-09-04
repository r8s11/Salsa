-- Add venue_id column to events table
-- Phase 14 — Venue Consolidation
-- Links events to the canonical venues table

alter table public.events
  add column if not exists venue_id uuid;

-- Add foreign key constraint to venues table
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_venue_id_fkey'
    and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_venue_id_fkey
      foreign key (venue_id) references public.venues(id);
  end if;
end;
$$;

-- Add index for venue_id lookups
create index if not exists events_venue_id_idx on public.events(venue_id);

notify pgrst, 'reload schema';
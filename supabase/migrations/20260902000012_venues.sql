-- Venues table for managing event locations
-- Phase 14 — Venue Consolidation

create table if not exists public.venues (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  slug                 text unique,
  address_line1        text,
  address_line2        text,
  city                 text,
  state_region         text,
  postal_code          text,
  country              text not null default 'US',
  latitude             numeric(10, 8),
  longitude            numeric(11, 8),
  timezone             text,
  website              text,
  instagram            text,
  phone                text,
  status               text not null default 'active' check (status in ('active', 'needs_review', 'archived')),
  normalized_name      text,
  normalized_address   text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Comments
comment on table public.venues is 'Canonical venue records for events';
comment on column public.venues.name is 'Human-readable venue name';
comment on column public.venues.slug is 'URL-friendly unique identifier';
comment on column public.venues.address_line1 is 'First line of street address';
comment on column public.venues.address_line2 is 'Second line of street address (suite, unit, etc.)';
comment on column public.venues.city is 'City name';
comment on column public.venues.state_region is 'State or region';
comment on column public.venues.postal_code is 'Postal/ZIP code';
comment on column public.venues.country is 'Country code';
comment on column public.venues.latitude is 'Latitude coordinate';
comment on column public.venues.longitude is 'Longitude coordinate';
comment on column public.venues.timezone is 'IANA timezone identifier';
comment on column public.venues.website is 'Venue website URL';
comment on column public.venues.instagram is 'Instagram handle';
comment on column public.venues.phone is 'Contact phone number';
comment on column public.venues.status is 'Venue lifecycle status';
comment on column public.venues.normalized_name is 'Lowercased, trimmed name for duplicate detection';
comment on column public.venues.normalized_address is 'Lowercased, trimmed address for duplicate detection';

-- Indexes
create unique index if not exists venues_slug_unique_idx on public.venues(slug);
create index if not exists venues_normalized_name_idx on public.venues(normalized_name);
create index if not exists venues_city_idx on public.venues(city);
create index if not exists venues_status_idx on public.venues(status);

-- Row Level Security
alter table public.venues enable row level security;

-- Policies: admins are the sole reader/writer. Public/organizer surfaces reach
-- venue data only through the admin_venue_* SECURITY DEFINER RPCs (which bypass
-- RLS deliberately), never through a direct table SELECT.
drop policy if exists "Venues are viewable by authenticated users" on public.venues;
drop policy if exists "Admins read venues" on public.venues;
create policy "Admins read venues"
  on public.venues
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert venues" on public.venues;
create policy "Admins can insert venues"
  on public.venues
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update venues" on public.venues;
create policy "Admins can update venues"
  on public.venues
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete venues" on public.venues;
create policy "Admins can delete venues"
  on public.venues
  for delete
  to authenticated
  using (public.is_admin());

-- Grants
grant select, insert, update, delete on public.venues to authenticated;

-- Trigger to set updated_at
drop trigger if exists venues_set_updated_at on public.venues;
create trigger venues_set_updated_at
  before update on public.venues
  for each row
  execute function public.set_updated_at();

notify pgrst, 'reload schema';

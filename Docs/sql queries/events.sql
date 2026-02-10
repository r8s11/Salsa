--Create event table
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text check (event_type in ('social', 'workshop', 'class')),
  event_date timestamp with time zone not null,
  event_time text,
  location text,
  address text,
  price_type text check(price_type in ('free','paid')),
  price_amaount numeric(10, 2),
  rsvp_link text,
  image_url text,
  status text default 'approved',
  created_at timestamp with time zone default now()
);

--Create index on event_date for faster queries
create index events_event_date_idx on public.events (event_date);

-- Enable Row Level Security (it will be configure on Phase 5)
after table public.events enable row level security;

-- For now, allow public read access to approved events
create policy "Public events are viewable by everyone"
  on public.events
  for select
  using( status = 'approved');

--Allow inserting events (we'll restrict this in Phase 5)
create policy "Anyone can insert events"
  on public.events
  for insert
  with check (true);

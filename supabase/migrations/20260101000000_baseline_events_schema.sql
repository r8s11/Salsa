-- Baseline schema for public.events, reconstructed from the hand-applied
-- history in Docs/sql queries/ (events.sql + add_submitter_columns.sql +
-- fix_price_amount_typo.sql + add_city_column.sql).
--
-- Back-dated so it sorts before 20260714T000000_add_event_module_fields.sql,
-- which adds host/recurrence/gallery on top of this.
--
-- Not yet reconciled against the hosted production project — see the
-- reconciliation note in this migration's plan before running `db push`.

create table public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  event_type      text check (event_type in ('social', 'workshop', 'class')),
  event_date      timestamp with time zone not null,
  event_time      text,
  location        text,
  address         text,
  price_type      text check (price_type in ('free', 'paid')),
  price_amount    numeric(10, 2),
  rsvp_link       text,
  image_url       text,
  status          text default 'approved',
  submitter_name  text,
  submitter_email text,
  created_at      timestamp with time zone default now(),
  city            text check (city in ('boston', 'new-york-city')) default 'boston'
);

create index events_event_date_idx on public.events (event_date);
create index events_city_idx on public.events (city);

alter table public.events enable row level security;

-- Grants sit below policies — without grant select, RLS policy is never evaluated.
grant select on public.events to anon, authenticated;

-- Public read access, approved events only.
create policy "Public events are viewable by everyone"
  on public.events
  for select
  using (status = 'approved');

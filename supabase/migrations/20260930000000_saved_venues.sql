create table public.saved_venues (
  user_id uuid not null references public.profiles(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

comment on table public.saved_venues is 'User-to-venue favorites (saved venues)';
comment on column public.saved_venues.user_id is 'Owner of the save';
comment on column public.saved_venues.venue_id is 'Venue being saved';

-- RLS
alter table public.saved_venues enable row level security;

create policy "Users can read own saved venues"
  on public.saved_venues for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved venues"
  on public.saved_venues for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own saved venues"
  on public.saved_venues for delete
  using (auth.uid() = user_id);

-- RPC to fetch saved venues for current user with minimal venue columns
create or replace function public.saved_venues_for_current_user()
returns table (
  venue_id uuid,
  name text,
  slug text,
  city text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id as venue_id,
    v.name,
    v.slug,
    v.city,
    v.status,
    sv.created_at
  from public.saved_venues sv
  join public.venues v on v.id = sv.venue_id
  where sv.user_id = auth.uid()
    and v.status = 'active'
  order by sv.created_at desc;
$$;

grant execute on function public.saved_venues_for_current_user() to authenticated;
grant select, insert, update, delete on public.saved_venues to authenticated;

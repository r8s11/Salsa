-- Dynamic metropolitan discovery.
--
-- Until now the city vocabulary was a CHECK constraint repeated on three
-- tables ('boston' | 'new-york-city') plus a literal list inside
-- set_onboarding_profile(). Adding a city meant a migration and a frontend
-- deploy. This replaces the literal lists with one small reference table.
--
-- events.city already stores a canonical metro slug (boroughs and suburbs
-- were folded into 'new-york-city' / 'boston' at entry time), so the slug
-- stays the join key: no events backfill, no new column on events, and
-- every existing `city = '...'` filter keeps working.
--
-- A metro becomes *discoverable* only through public_active_metros, which
-- counts approved upcoming events. Registering a metro row alone surfaces
-- nothing; approving an event in it does.

create table if not exists public.metros (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text not null check (length(btrim(name)) > 0),
  state_region  text,
  country_code  text not null default 'US' check (country_code ~ '^[A-Z]{2}$'),
  latitude      double precision check (latitude between -90 and 90),
  longitude     double precision check (longitude between -180 and 180),
  created_at    timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

comment on table public.metros is
  'Canonical metropolitan areas. events.city, profiles.city and platform_settings.default_city reference metros.slug. Coordinates are the metro centroid used for nearest-metro discovery.';

insert into public.metros (slug, name, state_region, country_code, latitude, longitude)
values
  ('new-york-city', 'New York City', 'NY', 'US', 40.7128, -74.0060),
  ('boston',        'Boston',        'MA', 'US', 42.3601, -71.0589)
on conflict (slug) do nothing;

-- Reference data: readable by everyone (the anonymous submission form needs
-- the full list), writable only by platform admins.
alter table public.metros enable row level security;

drop policy if exists metros_select_all on public.metros;
create policy metros_select_all on public.metros
  for select to anon, authenticated
  using (true);

drop policy if exists metros_admin_write on public.metros;
create policy metros_admin_write on public.metros
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

revoke all on table public.metros from anon, authenticated;
grant select on table public.metros to anon, authenticated;
grant insert, update, delete on table public.metros to authenticated;

-- Swap the literal vocabularies for foreign keys. ON UPDATE CASCADE lets an
-- admin correct a slug once without orphaning rows.
alter table public.events drop constraint if exists events_city_check;
alter table public.events
  add constraint events_city_metro_fkey
  foreign key (city) references public.metros (slug) on update cascade;

alter table public.profiles drop constraint if exists profiles_city_known;
alter table public.profiles
  add constraint profiles_city_metro_fkey
  foreign key (city) references public.metros (slug) on update cascade;

comment on column public.profiles.city is 'Owner-selected home metro slug (references metros.slug)';

alter table public.platform_settings drop constraint if exists platform_settings_default_city_check;
alter table public.platform_settings
  add constraint platform_settings_default_city_metro_fkey
  foreign key (default_city) references public.metros (slug) on update cascade;

-- Active metros: approved events that have not started yet, grouped by metro.
-- Built on public_events so it can never count an unapproved row, and run
-- with the owner's privileges like public_events itself (anon has no access
-- to raw events).
create or replace view public.public_active_metros as
select
  metro.slug,
  metro.name,
  metro.state_region,
  metro.country_code,
  metro.latitude,
  metro.longitude,
  count(event.id)::integer as upcoming_event_count,
  min(event.event_date)    as next_event_at
from public.metros metro
join public.public_events event on event.city = metro.slug
where event.event_date >= now()
group by metro.id;

alter view public.public_active_metros set (security_invoker = false);

comment on view public.public_active_metros is
  'Metros with at least one approved upcoming event. Drives homepage metro selection and the city explorer; a metro with no future events drops out automatically.';

revoke all on table public.public_active_metros from anon, authenticated;
grant select on table public.public_active_metros to anon, authenticated;

-- Onboarding validated the city against a literal list. Validate against the
-- registry instead; the body is otherwise unchanged from 20260917000000.
create or replace function public.set_onboarding_profile(
  p_display_name text,
  p_username     text,
  p_city         text,
  p_bio          text default null,
  p_avatar_url   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_username text := nullif(btrim(p_username), '');
  v_display  text := nullif(btrim(p_display_name), '');
  v_city     text := nullif(btrim(p_city), '');
  v_bio      text := nullif(btrim(p_bio), '');
  v_avatar   text := nullif(btrim(p_avatar_url), '');
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Required fields
  if v_display is null or length(v_display) = 0 then
    raise exception 'Display name is required.' using errcode = '22023';
  end if;
  if v_username is null then
    raise exception 'Username is required.' using errcode = '22023';
  end if;
  if v_city is null then
    raise exception 'City is required.' using errcode = '22023';
  end if;

  -- Username format (same constraint as profiles_username_format)
  if v_username !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 letters, numbers, or underscores.'
      using errcode = '22023';
  end if;

  -- Username uniqueness (case-insensitive, same unique index)
  if exists (select 1 from public.profiles where lower(username) = lower(v_username) and id <> v_uid) then
    raise exception 'That username is already taken.' using errcode = '23505';
  end if;

  -- City vocabulary: any registered metro
  if not exists (select 1 from public.metros where slug = v_city) then
    raise exception 'Unknown city.' using errcode = '22023';
  end if;

  -- Avatar must be http(s) when present
  if v_avatar is not null and v_avatar !~* '^https?://' then
    raise exception 'Avatar URL must start with https://' using errcode = '22023';
  end if;

  -- Bio length
  if v_bio is not null and length(v_bio) > 600 then
    raise exception 'Bio must be 600 characters or fewer.' using errcode = '22023';
  end if;

  update public.profiles
     set display_name            = v_display,
         username                = v_username,
         city                    = v_city,
         bio                     = nullif(v_bio, ''),
         avatar_url              = v_avatar,
         onboarding_completed_at = now()
   where id = v_uid;

  if not found then
    raise exception 'No profile found for current user.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_onboarding_profile(text, text, text, text, text) from public, anon;
grant  execute on function public.set_onboarding_profile(text, text, text, text, text) to authenticated;

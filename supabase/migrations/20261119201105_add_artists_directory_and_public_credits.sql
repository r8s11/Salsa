-- Applied to production outside the repo (recorded as 20261119201105_add_artists_directory_and_public_credits).
-- Statements copied verbatim from supabase_migrations.schema_migrations so fresh databases match production.

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  entity_type text not null default 'person',
  roles text[] not null,
  aliases text[] not null default '{}'::text[],
  description text,
  image_url text,
  city text,
  state_region text,
  country text,
  website text,
  instagram text,
  status text not null default 'needs_review',
  source_type text not null default 'admin',
  source_url text,
  instructor_id uuid unique references public.instructors(id) on delete set null,
  dj_id uuid unique references public.djs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artists_name_valid check (char_length(btrim(name)) between 2 and 200),
  constraint artists_slug_valid check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint artists_entity_type_valid check (entity_type in ('person','group')),
  constraint artists_roles_valid check (cardinality(roles)>0 and roles <@ array['singer','musician','band','dance_performer']::text[]),
  constraint artists_country_valid check (country is null or country ~ '^[A-Z]{2}$'),
  constraint artists_status_valid check (status in ('active','needs_review','archived')),
  constraint artists_source_type_valid check (source_type in ('admin','import','submission_approval','flyer_extraction'))
);
create index if not exists artists_status_city_idx on public.artists(status,city);
create index if not exists artists_aliases_gin_idx on public.artists using gin(aliases);

create table if not exists public.event_artists (
  event_id uuid not null references public.events(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete restrict,
  position integer not null default 0 check (position >= 0),
  credit_role text,
  source_url text,
  created_at timestamptz not null default now(),
  primary key (event_id,artist_id)
);
create index if not exists event_artists_artist_id_idx on public.event_artists(artist_id,event_id);

alter table public.artists enable row level security;
alter table public.event_artists enable row level security;

revoke all on table public.artists from public,anon,authenticated;
revoke all on table public.event_artists from public,anon,authenticated;
grant select,insert,update,delete on table public.artists to authenticated;
grant select,insert,update,delete on table public.event_artists to authenticated;

create policy artists_admin_crud on public.artists
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy event_artists_admin_crud on public.event_artists
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy event_artists_moderator_read on public.event_artists
  for select to authenticated using (public.is_moderator());

create trigger artists_set_updated_at
  before update on public.artists for each row execute function public.set_updated_at();

create or replace view public.public_artists
with (security_invoker = false, security_barrier = true) as
select
  'artist'::text as kind,
  a.id,a.name,a.slug,a.description,a.image_url,a.city,a.state_region,a.country,
  null::text as address,a.website,a.instagram,a.entity_type,a.roles,
  case
    when upper(a.state_region)='MA' and lower(a.city) in
      ('boston','cambridge','malden','lynn','newton','brighton','allston',
       'dorchester','west roxbury','woburn','somerville','brookline')
      then 'boston'
    when (upper(a.state_region) in ('NY','NJ') and lower(a.city) in
      ('new york','new-york-city','manhattan','brooklyn','bronx','queens',
       'long island city','glendale','staten island','astoria','jersey city'))
      or (a.state_region is null and lower(a.city)='new-york-city')
      then 'new-york-city'
    else lower(replace(coalesce(a.city,''),' ','-'))
  end as metro_slug
from public.artists a
where a.status='active';

create or replace view public.public_djs
with (security_invoker = false, security_barrier = true) as
select
  'dj'::text as kind,
  d.id,d.name,d.slug,d.description,d.image_url,d.city,d.state_region,d.country,
  null::text as address,d.website,d.instagram,
  case
    when upper(d.state_region)='MA' and lower(d.city) in
      ('boston','cambridge','malden','lynn','newton','brighton','allston',
       'dorchester','west roxbury','woburn','somerville','brookline')
      then 'boston'
    when (upper(d.state_region) in ('NY','NJ') and lower(d.city) in
      ('new york','new-york-city','manhattan','brooklyn','bronx','queens',
       'long island city','glendale','staten island','astoria','jersey city'))
      or (d.state_region is null and lower(d.city)='new-york-city')
      then 'new-york-city'
    else lower(replace(coalesce(d.city,''),' ','-'))
  end as metro_slug
from public.djs d
where d.status='active';

create or replace view public.public_event_artists
with (security_invoker = false, security_barrier = true) as
select ea.event_id, ea.artist_id, ea.position, ea.credit_role,
       a.name as artist_name, a.slug as artist_slug, a.entity_type, a.roles,
       e.slug as event_slug, e.event_date, e.title as event_title
from public.event_artists ea
join public.artists a on a.id=ea.artist_id
join public.events e on e.id=ea.event_id
where a.status='active' and e.status='approved';

revoke all on table public.public_artists from public,anon,authenticated;
revoke all on table public.public_djs from public,anon,authenticated;
revoke all on table public.public_event_artists from public,anon,authenticated;
grant select on table public.public_artists to anon,authenticated;
grant select on table public.public_djs to anon,authenticated;
grant select on table public.public_event_artists to anon,authenticated;

comment on view public.public_artists is
  'Allowlisted read-only projection of active artists; raw artist records remain admin-managed.';
comment on view public.public_djs is
  'Allowlisted read-only projection of active DJs; raw DJ records remain admin-managed.';
comment on view public.public_event_artists is
  'Public artist credits for approved events and active artists only.';


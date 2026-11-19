
alter table public.schools
  add column if not exists metro_slug text references public.metros(slug),
  add column if not exists borough text;

alter table public.schools
  add constraint schools_borough_in_nyc_check
  check (borough is null or (metro_slug='new-york-city' and borough in
    ('manhattan','brooklyn','queens','bronx','staten-island')));

-- This is a one-time conservative backfill, not a change to school approval status.
update public.schools s set metro_slug = case
  when s.metro_slug is not null then s.metro_slug
  when lower(trim(coalesce(s.city,''))) in ('new-york-city','new york city')
    and upper(trim(coalesce(s.state_region,''))) in ('NY','NEW YORK') then 'new-york-city'
  when upper(trim(coalesce(s.state_region,''))) in ('NY','NEW YORK')
    and lower(trim(coalesce(s.city,''))) in
      ('new york','manhattan','brooklyn','bronx','queens','long island city',
       'glendale','staten island','astoria','jackson heights') then 'new-york-city'
  when upper(trim(coalesce(s.state_region,'')))='NJ'
    and lower(trim(coalesce(s.city,'')))='jersey city' then 'new-york-city'
  when upper(trim(coalesce(s.state_region,'')))='MA'
    and lower(trim(coalesce(s.city,''))) in
      ('boston','cambridge','malden','lynn','newton','brighton','allston','dorchester',
       'west roxbury','woburn','somerville','brookline') then 'boston'
  when upper(trim(coalesce(s.state_region,'')))='FL'
    and lower(trim(coalesce(s.city,''))) in
      ('miami','miami beach','north miami beach','doral') then 'miami'
  when upper(trim(coalesce(s.state_region,'')))='FL'
    and lower(trim(coalesce(s.city,''))) in
      ('orlando','fern park') then 'orlando'
  else null end
where s.metro_slug is null;

update public.schools s set borough=case
  when lower(trim(coalesce(s.city,''))) in ('bronx','the bronx') or s.postal_code ~ '^104[0-9][0-9]$' then 'bronx'
  when lower(trim(coalesce(s.city,'')))='brooklyn' or s.postal_code ~ '^112[0-9][0-9]$' then 'brooklyn'
  when lower(trim(coalesce(s.city,''))) in ('queens','long island city','glendale','astoria','jackson heights')
    or s.postal_code ~ '^(111|113|114|116)[0-9][0-9]$' then 'queens'
  when lower(trim(coalesce(s.city,'')))='staten island' or s.postal_code ~ '^103[0-9][0-9]$' then 'staten-island'
  when lower(trim(coalesce(s.city,''))) in ('new york','manhattan')
    or s.postal_code ~ '^(100|101|102)[0-9][0-9]$' then 'manhattan'
  else null end
where s.metro_slug='new-york-city' and s.borough is null;

-- Fix the address city only where a matching ZIP makes the borough unambiguous.
update public.schools s set city=case
  when s.borough='manhattan' then 'New York'
  when s.borough='brooklyn' then 'Brooklyn'
  when s.borough='queens' then 'Queens'
  when s.borough='bronx' then 'Bronx'
  when s.borough='staten-island' then 'Staten Island'
  else s.city end
where lower(s.city)='new-york-city'
  and s.postal_code is not null
  and s.borough is not null;

create index if not exists schools_active_metro_borough_idx
  on public.schools(metro_slug,borough,name) where status='active';

-- Keep the public view's existing columns and order; append borough at the end.
create or replace view public.public_schools
with (security_invoker = false, security_barrier = true) as
select
  'school'::text as kind,
  s.id,s.name,s.slug,s.description,s.image_url,
  s.city,s.state_region,s.country,s.address_line1 as address,s.website,s.instagram,
  coalesce(s.metro_slug,
    case
      when upper(s.state_region)='MA' and lower(s.city) in
        ('boston','cambridge','malden','lynn','newton','brighton','allston',
         'dorchester','west roxbury','woburn','somerville','brookline') then 'boston'
      when (upper(s.state_region) in ('NY','NEW YORK') and lower(s.city) in
        ('new york','new-york-city','manhattan','brooklyn','bronx','queens',
         'long island city','glendale','staten island','astoria','jackson heights'))
        or (upper(s.state_region)='NJ' and lower(s.city)='jersey city') then 'new-york-city'
      else lower(replace(coalesce(s.city,''),' ','-'))
    end) as metro_slug,
  s.borough
from public.schools s
where s.status='active';

revoke all on table public.public_schools from public,anon,authenticated;
grant select on table public.public_schools to anon,authenticated;

comment on column public.schools.city is
  'Physical address locality (e.g. Brooklyn, Long Island City, Cambridge), NOT a metro slug.';
comment on column public.schools.metro_slug is
  'Discovery metro slug backed by public.metros; distinct from physical city.';
comment on column public.schools.borough is
  'NYC borough slug for geographic grouping; null means unassigned or non-NYC.';

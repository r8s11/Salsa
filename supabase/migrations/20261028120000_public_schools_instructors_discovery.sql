-- Public-facing, allowlisted school and instructor discovery projections.
-- Keep anonymous access revoked on public.schools and public.instructors.
-- The view owner reads underlying RLS-protected records; visitors can read only
-- the explicit, already-published columns below, and only active entities.
create or replace view public.public_schools
with (security_invoker = false, security_barrier = true) as
select
  'school'::text as kind,
  s.id, s.name, s.slug, s.description, s.image_url,
  s.city, s.state_region, s.country,
  s.address_line1 as address, s.website, s.instagram,
  case
    when upper(s.state_region) = 'MA' and lower(s.city) in
      ('boston','cambridge','malden','lynn','newton','brighton','allston',
       'dorchester','west roxbury','woburn','somerville','brookline')
      then 'boston'
    when (upper(s.state_region) = 'NY' and lower(s.city) in
      ('new york','new-york-city','manhattan','brooklyn','bronx','queens',
       'long island city','glendale','staten island','astoria'))
      or (upper(s.state_region) = 'NJ' and lower(s.city) = 'jersey city')
      then 'new-york-city'
    else lower(replace(coalesce(s.city,''),' ','-'))
  end as metro_slug
from public.schools s
where s.status = 'active';

create or replace view public.public_instructors
with (security_invoker = false, security_barrier = true) as
select
  'instructor'::text as kind,
  i.id, i.name, i.slug, coalesce(i.description, i.organization) as description,
  i.image_url, i.city, i.state_region, i.country,
  null::text as address, i.website, i.instagram,
  case
    when upper(i.state_region) = 'MA' and lower(i.city) in
      ('boston','cambridge','malden','lynn','newton','brighton','allston',
       'dorchester','west roxbury','woburn','somerville','brookline')
      then 'boston'
    when (upper(i.state_region) in ('NY','NJ') and lower(i.city) in
      ('new york','new-york-city','manhattan','brooklyn','bronx','queens',
       'long island city','glendale','staten island','astoria','jersey city'))
      or (i.state_region is null and lower(i.city) = 'new-york-city')
      then 'new-york-city'
    else lower(replace(coalesce(i.city,''),' ','-'))
  end as metro_slug
from public.instructors i
where i.status = 'active';

revoke all on table public.public_schools from public, anon, authenticated;
revoke all on table public.public_instructors from public, anon, authenticated;
grant select on table public.public_schools to anon, authenticated;
grant select on table public.public_instructors to anon, authenticated;

comment on view public.public_schools is 'Allowlisted active-school discovery. Raw schools permissions remain unchanged.';
comment on view public.public_instructors is 'Allowlisted active-instructor discovery. Raw instructor permissions remain unchanged.';

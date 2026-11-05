-- Discovery inventory mirrors public_active_metros: only approved events that
-- have not started, in active metros. Never grant access to raw events.
create or replace view public.public_active_locations as
select
  event.city,
  event.sublocation,
  event.neighborhood,
  count(event.id)::integer as upcoming_event_count
from public.public_events event
join public.metros metro on metro.slug = event.city
where event.event_date >= now() and metro.status = 'active'
group by event.city, event.sublocation, event.neighborhood;

alter view public.public_active_locations set (security_invoker = false);

comment on view public.public_active_locations is
  'Approved upcoming event counts by city, borough and neighborhood. Null areas retain parent inventory without inventing child locations.';

revoke all on table public.public_active_locations from public, anon, authenticated;
grant select on table public.public_active_locations to anon, authenticated;

-- Lock raw application tables to authenticated users while keeping the
-- approved public projections available to anonymous visitors.
--
-- Public reads must use public_events/public_profiles. Authenticated raw-table
-- access remains unchanged for account, organizer, moderation, and admin flows.
-- The projections run with their owner's privileges so revoking anonymous
-- access to the raw tables does not make the public projections unusable.
--
-- The two views are DEFINED here, immediately before they are locked down.
-- They were originally created by hand in the SQL editor and never tracked,
-- so every database built from this repo revoked anonymous access to the raw
-- tables while the replacement projections did not exist: `alter view` aborted
-- this migration, and the client's read of public_events hit a missing
-- relation. An approved submission created its events row and still had no
-- public event page.

-- Approved events only, with submitter contact details withheld — the public
-- pages never read them (src/pages/EventDetailPage.tsx).
--
-- event_taxonomy_terms is aggregated into the same shape PostgREST returns for
-- the raw-table embed, so projectEventTaxonomy() in
-- src/features/events/api/eventsRepo.ts projects dance styles and attributes
-- from the view exactly as it does from public.events.
create or replace view public.public_events as
select
  event.id,
  event.title,
  event.description,
  event.event_type,
  event.event_date,
  event.event_time,
  event.location,
  event.address,
  event.price_type,
  event.price_amount,
  event.rsvp_link,
  event.image_url,
  event.poster_image_url,
  event.status,
  event.source_type,
  event.city,
  event.host,
  event.recurrence,
  event.gallery,
  event.dance_styles,
  event.contact_email,
  event.contact_instagram,
  event.contact_website,
  event.venue_id,
  event.organizer_id,
  event.cancellation_reason,
  event.created_at,
  event.updated_at,
  coalesce(taxonomy.terms, '[]'::jsonb) as event_taxonomy_terms
from public.events event
left join lateral (
  select jsonb_agg(
           jsonb_build_object(
             'taxonomy_term_id', term.id,
             'taxonomy_terms', jsonb_build_object(
               'id',       term.id,
               'name',     term.name,
               'slug',     term.slug,
               'category', term.category,
               'status',   term.status
             )
           )
           order by term.category, term.name
         ) as terms
  from public.event_taxonomy_terms link
  join public.taxonomy_terms term on term.id = link.taxonomy_term_id
  where link.event_id = event.id
    and term.status = 'active'
) taxonomy on true
where event.status = 'approved';

-- Owner-published profile fields only. Privacy toggles, role, status, and
-- notification preferences stay on the raw table.
create or replace view public.public_profiles as
select
  profile.id,
  profile.display_name,
  profile.username,
  profile.avatar_url,
  profile.cover_url,
  profile.bio,
  profile.city,
  profile.dance_styles,
  profile.instagram,
  profile.website,
  profile.created_at
from public.profiles profile
where profile.public_profile;

alter view public.public_events set (security_invoker = false);
alter view public.public_profiles set (security_invoker = false);

revoke select on table public.events from anon;
revoke select on table public.profiles from anon;

grant select on table public.public_events to anon, authenticated;
grant select on table public.public_profiles to anon, authenticated;

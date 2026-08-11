-- Local development seed. Dates are relative to "today in America/New_York"
-- so seeded events never age out of the calendar's forward-looking query
-- (fetchApprovedEvents filters event_date >= yesterday).
--
-- event_date is a timestamptz; the app (convert.ts) reads only event_date to
-- derive the displayed time and ignores event_time (a display-only label).
-- The DB session runs in UTC, so plain current_date would be the UTC date —
-- during the UTC/America-New_York date gap (roughly 20:00-24:00 UTC, when
-- New York is still "yesterday") that silently shifts every seeded event one
-- calendar day. The `base` CTE below anchors "today" to the New York wall
-- clock instead, and each row combines that date with its day offset and
-- stated local time, converting through `AT TIME ZONE 'America/New_York'` so
-- the displayed time always matches event_time regardless of when this seed
-- runs.
--
-- image_url uses picsum.photos (Lorem Picsum, no API key required) seeded per
-- event so each row gets a distinct, stable, deterministic generic photo for
-- the event card thumbnail and modal poster background.

with base as (
  select (now() AT TIME ZONE 'America/New_York')::date as ny_today
)
insert into public.events
  (title, description, event_type, city, event_date, event_time, location, address,
   price_type, price_amount, rsvp_link, image_url, status, submitter_name, submitter_email,
   contact_email, contact_instagram, contact_website)
select
  v.title, v.description, v.event_type, v.city,
  (b.ny_today + v.day_offset + v.time_of_day) AT TIME ZONE 'America/New_York',
  v.event_time_label, v.location, v.address,
  v.price_type, v.price_amount, v.rsvp_link,
  'https://picsum.photos/seed/' || v.image_seed || '/800/600',
  v.status, v.submitter_name, v.submitter_email,
  v.contact_email, v.contact_instagram, v.contact_website
from base b, (values
  ('Bachata Sensual Social', 'Weekly social with a beginner lesson at 8pm.',
   'social', 'boston', 2, time '20:00', '8:00 PM',
   'Dance Union', '16 Bow St, Somerville, MA',
   'paid', 15.00::numeric, 'https://example.com/rsvp/1', 'salsa-event-1', 'approved',
   'Seed Data', 'seed@local.dev', 'hola@studioazul.test', '@studioazul', null),

  ('Salsa On2 Workshop', 'Intermediate shines and partnerwork.',
   'workshop', 'boston', 5, time '14:00', '2:00 PM',
   'Metromovers', '373 Somerville Ave, Somerville, MA',
   'paid', 35.00::numeric, 'https://example.com/rsvp/2', 'salsa-event-2', 'approved',
   'Seed Data', 'seed@local.dev', null, null, null),

  ('Beginner Salsa Class', 'Six-week series, drop-ins welcome.',
   'class', 'boston', 8, time '19:00', '7:00 PM',
   'Salsa y Control', '1 Westinghouse Plaza, Boston, MA',
   'free', null::numeric, null, 'salsa-event-3', 'approved',
   'Seed Data', 'seed@local.dev', null, null, null),

  ('Mambo City Friday', 'NYC on2 social, live percussion.',
   'social', 'new-york-city', 3, time '21:00', '9:00 PM',
   'You Should Be Dancing', '412 8th Ave, New York, NY',
   'paid', 20.00::numeric, 'https://example.com/rsvp/4', 'salsa-event-4', 'approved',
   'Seed Data', 'seed@local.dev', null, null, 'https://example.test/mambo'),

  ('Rumba y Timbal Workshop', 'Afro-Cuban body movement.',
   'workshop', 'new-york-city', 11, time '13:00', '1:00 PM',
   'Ailey Extension', '405 W 55th St, New York, NY',
   'paid', 40.00::numeric, 'https://example.com/rsvp/5', 'salsa-event-5', 'approved',
   'Seed Data', 'seed@local.dev', null, null, null),

  ('On1 Foundations', 'Beginner-friendly on1 timing and basics.',
   'class', 'new-york-city', 6, time '18:30', '6:30 PM',
   'Dance Manhattan', '39 W 19th St, New York, NY',
   'paid', 25.00::numeric, 'https://example.com/rsvp/6', 'salsa-event-6', 'approved',
   'Seed Data', 'seed@local.dev', null, null, null),

  ('Sunday Salsa Social', 'Relaxed Sunday social with a rotating DJ lineup.',
   'social', 'new-york-city', 9, time '19:00', '7:00 PM',
   'SOB''s', '204 Varick St, New York, NY',
   'free', null::numeric, 'https://example.com/rsvp/7', 'salsa-event-7', 'approved',
   'Seed Data', 'seed@local.dev', null, null, null),

  ('Advanced Partnerwork Intensive', 'Fast-paced turn patterns for experienced dancers.',
   'workshop', 'new-york-city', 14, time '15:00', '3:00 PM',
   'Dance Manhattan', '39 W 19th St, New York, NY',
   'paid', 45.00::numeric, 'https://example.com/rsvp/8', 'salsa-event-8', 'approved',
   'Seed Data', 'seed@local.dev', null, null, null),

  ('Timba Thursdays', 'High-energy Cuban timba social with live band.',
   'social', 'boston', 6, time '21:00', '9:00 PM',
   'Havana Club at Villa Victoria', '85 W Newton St, Boston, MA',
   'paid', 12.00::numeric, 'https://example.com/rsvp/9', 'salsa-event-9', 'approved',
   'Seed Data', 'seed@local.dev', null, null, null),

  ('Cuban Salsa Fundamentals', 'Four-week series covering Casino basics and rueda calls.',
   'class', 'boston', 9, time '19:30', '7:30 PM',
   'Masacote Dance Studio', '25 Chester St, Somerville, MA',
   'paid', 60.00::numeric, null, 'salsa-event-10', 'approved',
   'Seed Data', 'seed@local.dev', null, null, null),

  ('Ladies Styling Workshop', 'Solo styling drills for shines and body movement.',
   'workshop', 'boston', 13, time '11:00', '11:00 AM',
   'Salsa y Control', '1 Westinghouse Plaza, Boston, MA',
   'paid', 30.00::numeric, 'https://example.com/rsvp/10', 'salsa-event-11', 'approved',
   'Seed Data', 'seed@local.dev', null, null, null),

  -- One pending row per city so the moderation path is exercisable locally.
  ('Unapproved Test Social', 'Should NOT appear on the public calendar.',
   'social', 'boston', 4, time '22:00', '10:00 PM',
   'Pending Venue', '1 Test St, Boston, MA',
   'free', null::numeric, null, 'salsa-event-12', 'pending',
   'Seed Data', 'seed@local.dev', null, null, null),

  ('Unapproved NYC Bachata Night', 'Should NOT appear on the public calendar.',
   'social', 'new-york-city', 7, time '21:30', '9:30 PM',
   'Pending Venue NYC', '1 Test Ave, New York, NY',
   'free', null::numeric, null, 'salsa-event-13', 'pending',
   'Seed Data', 'seed@local.dev', null, null, null)
) as v(title, description, event_type, city, day_offset, time_of_day, event_time_label,
       location, address, price_type, price_amount, rsvp_link, image_seed, status,
       submitter_name, submitter_email, contact_email, contact_instagram, contact_website);

-- supabase db reset applies migrations BEFORE running this seed, so the
-- 20260814000000_events_management_fields.sql backfill (which targets
-- pre-existing rows) never sees these inserts. Mirror it here so local dev
-- data matches what the same migration produces against real prod rows.
update public.events set source_type = case
  when submitter_email like '%@import.local' then 'imported'
  when submitter_name in ('Salsa Segura', 'Seed Data') then 'admin'
  else 'user_submission'
end;

update public.events
  set dance_styles = array_remove(array[
    case when (title || ' ' || coalesce(description, '')) ~* 'salsa|casino|rueda|on1|on2|mambo|timba' then 'salsa' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'bachata' then 'bachata' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'kizomba|urban kiz' then 'kizomba' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'merengue' then 'merengue' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'cha[ -]?cha' then 'cha-cha' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'zouk' then 'zouk' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'afro[ -]?cuban|rumba' then 'afro-cuban' end
  ], null);

-- Sanitized placeholder events for the hosted (production) Supabase project.
--
-- THIS IS NOT `seed.sql`. Never run `supabase db reset` or `supabase db push`
-- against production — reset drops and recreates the database, and the
-- baseline migration is explicitly not reconciled with the hosted project.
-- This script only INSERTs into public.events and touches nothing else.
--
-- Safety properties:
--   * Transactional  — wrapped in begin/commit; partial application is impossible.
--   * Idempotent     — re-running produces the same 10 rows, never duplicates.
--   * Scoped         — the delete is filtered to MARKER_EMAIL below, so it can
--                      only ever remove rows this script itself created. Real
--                      user submissions are never matched.
--
-- Marker: submitter_email = 'placeholder@salsasegura.com'
--
-- To remove all placeholder rows later:
--   delete from public.events where submitter_email = 'placeholder@salsasegura.com';
--
-- Content is deliberately fictional: invented venue names and generic street
-- addresses, so no real business is listed as hosting an event it never agreed
-- to. No RSVP links (a dead example.com link is worse than none). All rows are
-- status='approved' so they render publicly; no test/pending fixtures.
--
-- event_date is a timestamptz and the app (convert.ts) derives the displayed
-- time solely from it, ignoring the event_time label. Day offsets are anchored
-- to "today in America/New_York" rather than the session's UTC current_date,
-- so a run during the UTC/New-York date gap (~20:00-24:00 UTC) cannot shift
-- every event by a day.
--
-- image_url uses picsum.photos (Lorem Picsum, no API key required) seeded per
-- event so each row gets a distinct, stable, deterministic generic photo for
-- the event card thumbnail and modal poster background.

begin;

delete from public.events
where submitter_email = 'placeholder@salsasegura.com';

with base as (
  select (now() AT TIME ZONE 'America/New_York')::date as ny_today
)
insert into public.events
  (title, description, event_type, city, event_date, event_time, location, address,
   price_type, price_amount, rsvp_link, image_url, status, submitter_name, submitter_email)
select
  v.title, v.description, v.event_type, v.city,
  (b.ny_today + v.day_offset + v.time_of_day) AT TIME ZONE 'America/New_York',
  v.event_time_label, v.location, v.address,
  v.price_type, v.price_amount, null,
  'https://picsum.photos/seed/' || v.image_seed || '/800/600',
  'approved', 'Salsa Segura', 'placeholder@salsasegura.com'
from base b, (values
  ('Bachata Sensual Social', 'Weekly social with a beginner lesson before the floor opens.',
   'social', 'boston', 2, time '20:00', '8:00 PM',
   'Studio Azul', '150 Commercial St, Boston, MA',
   'paid', 15.00::numeric, 'salsa-prod-1'),

  ('Mambo City Friday', 'On2 social with live percussion all night.',
   'social', 'new-york-city', 3, time '21:00', '9:00 PM',
   'Manhattan Mambo Loft', '1200 Broadway, New York, NY',
   'paid', 20.00::numeric, 'salsa-prod-2'),

  ('Salsa On2 Workshop', 'Intermediate shines and partnerwork fundamentals.',
   'workshop', 'boston', 5, time '14:00', '2:00 PM',
   'Riverbend Dance Hall', '88 Prospect St, Cambridge, MA',
   'paid', 35.00::numeric, 'salsa-prod-3'),

  ('Timba Thursdays', 'High-energy Cuban timba social with a live band.',
   'social', 'boston', 6, time '21:00', '9:00 PM',
   'The Clave Room', '310 Washington St, Boston, MA',
   'paid', 12.00::numeric, 'salsa-prod-4'),

  ('On1 Foundations', 'Beginner-friendly on1 timing, basics, and lead-follow.',
   'class', 'new-york-city', 6, time '18:30', '6:30 PM',
   'Uptown Rhythm Studio', '560 W 45th St, New York, NY',
   'paid', 25.00::numeric, 'salsa-prod-5'),

  ('Beginner Salsa Class', 'Six-week series, drop-ins welcome.',
   'class', 'boston', 8, time '19:00', '7:00 PM',
   'Casa del Ritmo', '245 Elm St, Somerville, MA',
   'free', null::numeric, 'salsa-prod-6'),

  ('Sunday Salsa Social', 'Relaxed Sunday social with a rotating DJ lineup.',
   'social', 'new-york-city', 9, time '19:00', '7:00 PM',
   'Studio Guaguanco', '78 Ludlow St, New York, NY',
   'free', null::numeric, 'salsa-prod-7'),

  ('Rumba y Timbal Workshop', 'Afro-Cuban body movement and percussion phrasing.',
   'workshop', 'new-york-city', 11, time '13:00', '1:00 PM',
   'Uptown Rhythm Studio', '560 W 45th St, New York, NY',
   'paid', 40.00::numeric, 'salsa-prod-8'),

  ('Ladies Styling Workshop', 'Solo styling drills for shines and body movement.',
   'workshop', 'boston', 13, time '11:00', '11:00 AM',
   'Studio Azul', '150 Commercial St, Boston, MA',
   'paid', 30.00::numeric, 'salsa-prod-9'),

  ('Advanced Partnerwork Intensive', 'Fast-paced turn patterns for experienced dancers.',
   'workshop', 'new-york-city', 14, time '15:00', '3:00 PM',
   'Manhattan Mambo Loft', '1200 Broadway, New York, NY',
   'paid', 45.00::numeric, 'salsa-prod-10')
) as v(title, description, event_type, city, day_offset, time_of_day, event_time_label,
       location, address, price_type, price_amount, image_seed);

commit;

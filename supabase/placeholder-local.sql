-- Placeholder data for the LOCAL Supabase stack only (127.0.0.1:54332).
--
-- Never run against the hosted project; production has its own
-- events-only script (placeholder-prod.sql).
--
-- Fills the entity graph the public pages read: venues, organizers, schools,
-- instructors, series, events, and the event_schools / event_instructors /
-- event_taxonomy_terms links between them.
--
-- Safety properties:
--   * Transactional  — begin/commit; partial application is impossible.
--   * Idempotent     — re-running replaces the same rows, never duplicates.
--   * Scoped         — cleanup only matches this script's markers:
--       events:   submitter_email = 'placeholder@local.dev'
--       entities: ids beginning 'dddddddd-' (fixed below)
--
-- Run:
--   docker exec -i supabase_db_Salsa psql -U postgres -v ON_ERROR_STOP=1 < supabase/placeholder-local.sql
--
-- Content is fictional: invented school, venue, organizer and instructor
-- names and generic street addresses, so no real business is shown hosting
-- something it never agreed to. Schools vary on purpose — one fully filled,
-- one with no photo, one with almost nothing and no upcoming classes — so the
-- school page's sparse and empty states have data to render.
--
-- Dates are offsets from "today in America/New_York" (see seed.sql for why
-- the anchor is not the UTC current_date). Negative offsets are past nights.
-- Images are Lorem Picsum, seeded per row so they are stable.

begin;

-- ---------------------------------------------------------------------------
-- Cleanup (events first: their link rows cascade, and the entity delete
-- guards refuse while links remain)
-- ---------------------------------------------------------------------------
delete from public.events where submitter_email = 'placeholder@local.dev';
delete from public.event_series where id::text like 'dddddddd-%';
delete from public.schools where id::text like 'dddddddd-%';
delete from public.instructors where id::text like 'dddddddd-%';
delete from public.organizers where id::text like 'dddddddd-%';
delete from public.venues where id::text like 'dddddddd-%';

-- ---------------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------------
insert into public.venues
  (id, name, slug, address_line1, city, state_region, postal_code, country, timezone,
   website, instagram, status, source_type)
values
  ('dddddddd-0001-4000-8000-000000000001', 'Clave Studio Loft', 'clave-studio-loft',
   '120 Harbor Point Ave, Floor 3', 'Boston', 'MA', '02127', 'US', 'America/New_York',
   'https://clave-studio.example', 'clavestudio.bos', 'active', 'admin'),
  ('dddddddd-0001-4000-8000-000000000002', 'The Copper Room', 'the-copper-room',
   '33 Linden Terrace', 'Cambridge', 'MA', '02139', 'US', 'America/New_York',
   null, 'copperroom.cambridge', 'active', 'admin'),
  ('dddddddd-0001-4000-8000-000000000003', 'Brasa Ballroom', 'brasa-ballroom',
   '415 Westline Ave', 'New York', 'NY', '10001', 'US', 'America/New_York',
   'https://brasa-ballroom.example', 'brasaballroom', 'active', 'admin'),
  ('dddddddd-0001-4000-8000-000000000004', 'Loft 9 Movement Space', 'loft-9-movement-space',
   '9 Orchard Mill St', 'Brooklyn', 'NY', '11211', 'US', 'America/New_York',
   null, null, 'active', 'admin');

-- ---------------------------------------------------------------------------
-- Organizers
-- ---------------------------------------------------------------------------
insert into public.organizers
  (id, name, slug, description, logo_url, website, instagram, organizer_type,
   primary_city, state_region, country, status, source_type)
values
  ('dddddddd-0002-4000-8000-000000000001', 'Noche Clave Productions', 'noche-clave-productions',
   'Runs the Tuesday and Saturday socials at Clave Studio Loft.',
   'https://picsum.photos/seed/org-noche-clave/400/400', null, 'nocheclave', 'promoter',
   'boston', 'MA', 'US', 'active', 'admin'),
  ('dddddddd-0002-4000-8000-000000000002', 'Brasa Socials NYC', 'brasa-socials-nyc',
   'Friday night socials with a live DJ rotation in Midtown.',
   'https://picsum.photos/seed/org-brasa/400/400', 'https://brasa-socials.example', 'brasasocials',
   'promoter', 'new-york-city', 'NY', 'US', 'active', 'admin');

-- ---------------------------------------------------------------------------
-- Schools (deliberately uneven completeness)
-- ---------------------------------------------------------------------------
insert into public.schools
  (id, name, slug, address_line1, postal_code, city, state_region, country,
   website, instagram, phone, description, image_url, status, source_type)
values
  -- Fully filled: photo, description, links, several classes and socials.
  ('dddddddd-0003-4000-8000-000000000001', 'Clave Studio Boston', 'clave-studio-boston',
   '120 Harbor Point Ave, Floor 3', '02127', 'Boston', 'MA', 'US',
   'https://clave-studio.example', 'clavestudio.bos', '(617) 555-0142',
   'Salsa On2 and Cuban timba taught in progressive eight-week levels, from first basic to performance team. Every Tuesday class ends in a short practica, and the studio hosts a Saturday social once a month.',
   'https://picsum.photos/seed/school-clave/1600/900', 'active', 'admin'),
  -- No photo: exercises the image fallback.
  ('dddddddd-0003-4000-8000-000000000002', 'Ritmo Norte Dance Academy', 'ritmo-norte-dance-academy',
   '33 Linden Terrace', '02139', 'Cambridge', 'MA', 'US',
   null, 'ritmonorte.academy', null,
   'Bachata and salsa On1 for adults, with a dedicated beginners'' track that starts every month.',
   null, 'active', 'admin'),
  -- Almost nothing, and no upcoming classes: exercises the empty state.
  ('dddddddd-0003-4000-8000-000000000003', 'Escuela Sabor Somerville', 'escuela-sabor-somerville',
   null, null, 'Somerville', 'MA', 'US',
   null, null, null, null, null, 'active', 'admin'),
  ('dddddddd-0003-4000-8000-000000000004', 'Mambo Corner Dance School', 'mambo-corner-dance-school',
   '415 Westline Ave, Studio B', '10001', 'New York', 'NY', 'US',
   'https://mambo-corner.example', 'mambocorner.nyc', '(212) 555-0187',
   'New York mambo On2 in the Palladium tradition: shines, partnerwork and styling, taught by working performers. Drop-in classes every weeknight.',
   'https://picsum.photos/seed/school-mambo-corner/1600/900', 'active', 'admin'),
  ('dddddddd-0003-4000-8000-000000000005', 'Bachata Lab Brooklyn', 'bachata-lab-brooklyn',
   '9 Orchard Mill St', '11211', 'Brooklyn', 'NY', 'US',
   null, 'bachatalab.bk', null,
   'Sensual and Dominican bachata in small groups. Wednesday labs drill one figure for the whole hour.',
   'https://picsum.photos/seed/school-bachata-lab/1600/900', 'active', 'admin');

-- ---------------------------------------------------------------------------
-- Instructors
-- ---------------------------------------------------------------------------
insert into public.instructors
  (id, name, slug, organization, city, state_region, country, website, instagram,
   description, image_url, status, source_type)
values
  ('dddddddd-0004-4000-8000-000000000001', 'Ana Lucía Ferrer', 'ana-lucia-ferrer',
   'Clave Studio Boston', 'Boston', 'MA', 'US', null, 'analucia.baila',
   'Teaches On2 levels 2–4 and coaches the Clave performance team.',
   'https://picsum.photos/seed/inst-ana-lucia/600/800', 'active', 'admin'),
  ('dddddddd-0004-4000-8000-000000000002', 'Marcus Delgado', 'marcus-delgado',
   'Clave Studio Boston', 'Boston', 'MA', 'US', null, 'marcusdelgado.dance',
   'Cuban timba and rueda; guest teacher at Ritmo Norte.',
   'https://picsum.photos/seed/inst-marcus/600/800', 'active', 'admin'),
  ('dddddddd-0004-4000-8000-000000000003', 'Yesenia Ortiz', 'yesenia-ortiz',
   'Ritmo Norte Dance Academy', 'Cambridge', 'MA', 'US', null, null,
   null, null, 'active', 'admin'),
  ('dddddddd-0004-4000-8000-000000000004', 'Tomás Rivera', 'tomas-rivera',
   'Mambo Corner Dance School', 'New York', 'NY', 'US', 'https://tomas-rivera.example', 'tomasrivera.mambo',
   'Mambo On2 shines and partnerwork. Twenty years on New York stages.',
   'https://picsum.photos/seed/inst-tomas/600/800', 'active', 'admin'),
  ('dddddddd-0004-4000-8000-000000000005', 'Keiko Álvarez', 'keiko-alvarez',
   'Bachata Lab Brooklyn', 'Brooklyn', 'NY', 'US', null, 'keiko.bachata',
   'Runs the Wednesday bachata labs.',
   'https://picsum.photos/seed/inst-keiko/600/800', 'active', 'admin');

-- ---------------------------------------------------------------------------
-- Series
-- ---------------------------------------------------------------------------
insert into public.event_series
  (id, name, slug, description, image_url, status, city, venue_id, organizer_id)
values
  ('dddddddd-0005-4000-8000-000000000001', 'Tuesday On2 Foundations', 'tuesday-on2-foundations',
   'Weekly On2 level 1 class followed by a short practica.',
   'https://picsum.photos/seed/series-tuesday-on2/1200/800', 'active', 'boston',
   'dddddddd-0001-4000-8000-000000000001', 'dddddddd-0002-4000-8000-000000000001'),
  ('dddddddd-0005-4000-8000-000000000002', 'Friday Brasa Social', 'friday-brasa-social',
   'Salsa and bachata social, two rooms, until 2am.',
   'https://picsum.photos/seed/series-brasa/1200/800', 'active', 'new-york-city',
   'dddddddd-0001-4000-8000-000000000003', 'dddddddd-0002-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create temp table placeholder_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  event_type  text not null,
  city        text not null,
  day_offset  int  not null,
  time_of_day time not null,
  time_label  text not null,
  venue_id    uuid,
  organizer_id uuid,
  series_id   uuid,
  price_type  text not null,
  price_amount numeric,
  image_seed  text not null,
  styles      text[] not null default '{}',
  school_ids  uuid[] not null default '{}',
  instructor_ids uuid[] not null default '{}'
) on commit drop;

-- Weekly Tuesday class at Clave (two past, three upcoming).
insert into placeholder_events
  (title, description, event_type, city, day_offset, time_of_day, time_label, venue_id,
   organizer_id, series_id, price_type, price_amount, image_seed, styles, school_ids, instructor_ids)
select 'Salsa On2 Foundations · Level 1',
       'Week-by-week On2 basics: timing, the break on two, and the first turn patterns. Practica after.',
       'class', 'boston', o, time '19:30', '7:30 PM',
       'dddddddd-0001-4000-8000-000000000001', 'dddddddd-0002-4000-8000-000000000001',
       'dddddddd-0005-4000-8000-000000000001', 'paid', 20, 'clave-on2-' || o,
       '{salsa}',
       '{dddddddd-0003-4000-8000-000000000001}',
       '{dddddddd-0004-4000-8000-000000000001}'
from unnest(array[-13, -6, 1, 8, 15]) as o;

-- Weekly Friday social at Brasa (two past, three upcoming).
insert into placeholder_events
  (title, description, event_type, city, day_offset, time_of_day, time_label, venue_id,
   organizer_id, series_id, price_type, price_amount, image_seed, styles, school_ids, instructor_ids)
select 'Friday Brasa Social',
       'Salsa room and bachata room, DJ rotation, mambo shines warm-up at 9pm.',
       'social', 'new-york-city', o, time '21:00', '9:00 PM',
       'dddddddd-0001-4000-8000-000000000003', 'dddddddd-0002-4000-8000-000000000002',
       'dddddddd-0005-4000-8000-000000000002', 'paid', 25, 'brasa-friday-' || o,
       '{salsa,bachata}',
       '{dddddddd-0003-4000-8000-000000000004}',
       '{dddddddd-0004-4000-8000-000000000004}'
from unnest(array[-11, -4, 3, 10, 17]) as o;

-- Weekly Wednesday bachata lab in Brooklyn (one past, three upcoming).
insert into placeholder_events
  (title, description, event_type, city, day_offset, time_of_day, time_label, venue_id,
   price_type, price_amount, image_seed, styles, school_ids, instructor_ids)
select 'Bachata Lab · One Figure Hour',
       'One sensual bachata figure drilled for the full hour, then filmed.',
       'class', 'new-york-city', o, time '19:00', '7:00 PM',
       'dddddddd-0001-4000-8000-000000000004',
       'paid', 18, 'bachata-lab-' || o,
       '{bachata}',
       '{dddddddd-0003-4000-8000-000000000005}',
       '{dddddddd-0004-4000-8000-000000000005}'
from unnest(array[-5, 2, 9, 16]) as o;

-- One-offs.
insert into placeholder_events
  (title, description, event_type, city, day_offset, time_of_day, time_label, venue_id,
   organizer_id, price_type, price_amount, image_seed, styles, school_ids, instructor_ids)
values
  ('Clave Saturday Social', 'Monthly studio social. Beginner lesson at 8:30, open floor until 1am.',
   'social', 'boston', 5, time '20:30', '8:30 PM',
   'dddddddd-0001-4000-8000-000000000001', 'dddddddd-0002-4000-8000-000000000001',
   'paid', 15, 'clave-saturday', '{salsa,bachata,cha-cha}',
   '{dddddddd-0003-4000-8000-000000000001}',
   '{dddddddd-0004-4000-8000-000000000001,dddddddd-0004-4000-8000-000000000002}'),
  ('Timba Rueda Workshop', 'Two hours of rueda calls with Marcus. Some salsa experience needed.',
   'workshop', 'boston', 12, time '14:00', '2:00 PM',
   'dddddddd-0001-4000-8000-000000000002', null,
   'paid', 35, 'timba-rueda', '{salsa,afro-cuban}',
   '{dddddddd-0003-4000-8000-000000000001,dddddddd-0003-4000-8000-000000000002}',
   '{dddddddd-0004-4000-8000-000000000002}'),
  ('Beginner Bachata · Month Start', 'First class of the monthly beginners'' track. No partner needed.',
   'class', 'boston', 4, time '19:00', '7:00 PM',
   'dddddddd-0001-4000-8000-000000000002', null,
   'paid', 15, 'ritmo-norte-bachata', '{bachata}',
   '{dddddddd-0003-4000-8000-000000000002}',
   '{dddddddd-0004-4000-8000-000000000003}'),
  ('Salsa On1 Drop-in', 'Mixed-level On1 class. Pay at the door.',
   'class', 'boston', 6, time '18:30', '6:30 PM',
   'dddddddd-0001-4000-8000-000000000002', null,
   'free', null, 'ritmo-norte-on1', '{salsa}',
   '{dddddddd-0003-4000-8000-000000000002}',
   '{dddddddd-0004-4000-8000-000000000003}'),
  -- Escuela Sabor: past only, so its page has no upcoming classes.
  ('Escuela Sabor Open House', 'Free trial class and studio tour.',
   'class', 'boston', -20, time '18:00', '6:00 PM',
   null, null,
   'free', null, 'sabor-open-house', '{salsa,merengue}',
   '{dddddddd-0003-4000-8000-000000000003}', '{}'),
  ('Mambo Shines Intensive', 'Ninety minutes of Palladium-era shines, footwork only.',
   'workshop', 'new-york-city', 7, time '13:00', '1:00 PM',
   'dddddddd-0001-4000-8000-000000000003', null,
   'paid', 40, 'mambo-shines', '{salsa}',
   '{dddddddd-0003-4000-8000-000000000004}',
   '{dddddddd-0004-4000-8000-000000000004}'),
  ('Mambo Corner Weeknight Drop-in', 'Level 2 On2 partnerwork.',
   'class', 'new-york-city', 1, time '20:00', '8:00 PM',
   'dddddddd-0001-4000-8000-000000000003', null,
   'paid', 22, 'mambo-dropin', '{salsa}',
   '{dddddddd-0003-4000-8000-000000000004}',
   '{dddddddd-0004-4000-8000-000000000004}'),
  ('Kizomba & Zouk Night', 'Late social in the loft. No school attached.',
   'social', 'new-york-city', 6, time '22:00', '10:00 PM',
   'dddddddd-0001-4000-8000-000000000004', null,
   'paid', 15, 'kizomba-zouk', '{kizomba,zouk}', '{}', '{}'),
  -- Live music (needs the live_music event type, migration 20260928000000).
  ('Son Cubano en Vivo', 'Eight-piece son and timba band, two sets, dancing between.',
   'live_music', 'boston', 9, time '21:00', '9:00 PM',
   'dddddddd-0001-4000-8000-000000000002', 'dddddddd-0002-4000-8000-000000000001',
   'paid', 25, 'son-cubano-live', '{salsa,afro-cuban}',
   '{dddddddd-0003-4000-8000-000000000001}', '{}'),
  ('Orquesta Night at Brasa', 'Live salsa dura orchestra; DJ between sets until 2am.',
   'live_music', 'new-york-city', 13, time '21:30', '9:30 PM',
   'dddddddd-0001-4000-8000-000000000003', 'dddddddd-0002-4000-8000-000000000002',
   'paid', 30, 'brasa-orquesta', '{salsa}', '{}', '{}'),
  -- New metros (migration 20261007120000): one event each makes them active.
  ('Miami Descarga Live', 'Open descarga with a house band and guest soneros.',
   'live_music', 'miami', 4, time '21:00', '9:00 PM',
   null, null, 'paid', 20, 'miami-descarga', '{salsa}', '{}', '{}'),
  ('Atlanta Bachata Social', 'Monthly bachata social with a beginner lesson at 8.',
   'social', 'atlanta', 6, time '20:00', '8:00 PM',
   null, null, 'paid', 15, 'atlanta-bachata', '{bachata}', '{}', '{}'),
  ('DMV Salsa On2 Workshop', 'Two-hour On2 partnerwork workshop.',
   'workshop', 'washington-dc', 11, time '14:00', '2:00 PM',
   null, null, 'paid', 35, 'dc-on2', '{salsa}', '{}', '{}');

insert into public.events
  (id, title, description, event_type, city, event_date, event_time, location, address,
   price_type, price_amount, image_url, status, source_type, submitter_name, submitter_email,
   dance_styles, venue_id, organizer_id, series_id)
select
  p.id, p.title, p.description, p.event_type, p.city,
  (b.ny_today + p.day_offset + p.time_of_day) at time zone 'America/New_York',
  p.time_label, v.name,
  nullif(concat_ws(', ', v.address_line1, v.city, v.state_region), ''),
  p.price_type, p.price_amount,
  'https://picsum.photos/seed/' || p.image_seed || '/800/600',
  'approved', 'admin', 'Seed Data', 'placeholder@local.dev',
  p.styles, p.venue_id, p.organizer_id, p.series_id
from placeholder_events p
cross join (select (now() at time zone 'America/New_York')::date as ny_today) b
left join public.venues v on v.id = p.venue_id;

insert into public.event_schools (event_id, school_id)
select p.id, s from placeholder_events p, unnest(p.school_ids) s;

insert into public.event_instructors (event_id, instructor_id, position)
select p.id, i.id, i.ord - 1
from placeholder_events p, unnest(p.instructor_ids) with ordinality as i(id, ord);

insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
select p.id, t.id
from placeholder_events p
join public.taxonomy_terms t
  on t.category = 'dance_style' and t.slug = any (p.styles);

-- Level and format attributes for class/workshop rows.
insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
select p.id, t.id
from placeholder_events p
join public.taxonomy_terms t on t.category = 'event_attribute'
  and t.slug = case
    when p.title like '%Level 1%' or p.title like 'Beginner%' then 'beginner-friendly'
    when p.event_type = 'workshop' then 'workshop'
    when p.event_type = 'social' then 'social'
  end;

commit;

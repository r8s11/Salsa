-- Register seven more metros. A metro row alone does not surface a city:
-- public_active_metros still requires an approved upcoming event there, so
-- these appear in discovery as soon as their first event is published.
--
-- Coordinates are the metro centroid used for nearest-metro discovery.
-- "Texas" is one statewide metro by request, centred on Austin; split it
-- into Houston / Dallas / Austin / San Antonio later by renaming the slug
-- (events.city follows via ON UPDATE CASCADE) and inserting the rest.
insert into public.metros (slug, name, state_region, country_code, latitude, longitude)
values
  ('miami',         'Miami',          'FL', 'US', 25.7617, -80.1918),
  ('orlando',       'Orlando',        'FL', 'US', 28.5383, -81.3792),
  ('los-angeles',   'Los Angeles',    'CA', 'US', 34.0522, -118.2437),
  ('atlanta',       'Atlanta',        'GA', 'US', 33.7490, -84.3880),
  ('washington-dc', 'Washington, DC', 'DC', 'US', 38.9072, -77.0369),
  ('san-francisco', 'San Francisco',  'CA', 'US', 37.7749, -122.4194),
  ('texas',         'Texas',          'TX', 'US', 30.2672, -97.7431)
on conflict (slug) do nothing;

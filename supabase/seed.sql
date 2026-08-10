-- Local development seed. Dates are relative to now() so seeded events never
-- age out of the calendar's forward-looking query
-- (fetchApprovedEvents filters event_date >= yesterday).

insert into public.events
  (title, description, event_type, city, event_date, event_time, location, address,
   price_type, price_amount, rsvp_link, status, submitter_name, submitter_email)
values
  ('Bachata Sensual Social', 'Weekly social with a beginner lesson at 8pm.',
   'social', 'boston', now() + interval '2 days', '8:00 PM',
   'Dance Union', '16 Bow St, Somerville, MA',
   'paid', 15.00, 'https://example.com/rsvp/1', 'approved',
   'Seed Data', 'seed@local.dev'),

  ('Salsa On2 Workshop', 'Intermediate shines and partnerwork.',
   'workshop', 'boston', now() + interval '5 days', '2:00 PM',
   'Metromovers', '373 Somerville Ave, Somerville, MA',
   'paid', 35.00, 'https://example.com/rsvp/2', 'approved',
   'Seed Data', 'seed@local.dev'),

  ('Beginner Salsa Class', 'Six-week series, drop-ins welcome.',
   'class', 'boston', now() + interval '8 days', '7:00 PM',
   'Salsa y Control', '1 Westinghouse Plaza, Boston, MA',
   'free', null, null, 'approved',
   'Seed Data', 'seed@local.dev'),

  ('Mambo City Friday', 'NYC on2 social, live percussion.',
   'social', 'new-york-city', now() + interval '3 days', '9:00 PM',
   'You Should Be Dancing', '412 8th Ave, New York, NY',
   'paid', 20.00, 'https://example.com/rsvp/4', 'approved',
   'Seed Data', 'seed@local.dev'),

  ('Rumba y Timbal Workshop', 'Afro-Cuban body movement.',
   'workshop', 'new-york-city', now() + interval '11 days', '1:00 PM',
   'Ailey Extension', '405 W 55th St, New York, NY',
   'paid', 40.00, 'https://example.com/rsvp/5', 'approved',
   'Seed Data', 'seed@local.dev'),

  -- One pending row so the moderation path is exercisable locally.
  ('Unapproved Test Social', 'Should NOT appear on the public calendar.',
   'social', 'boston', now() + interval '4 days', '10:00 PM',
   'Pending Venue', '1 Test St, Boston, MA',
   'free', null, null, 'pending',
   'Seed Data', 'seed@local.dev');

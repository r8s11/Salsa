-- Phase 10 — canonical taxonomy seeds.
-- REQUIRED. Run manually after 001 and 002. Existing admin-edited names and
-- descriptions are deliberately not overwritten.

insert into public.taxonomy_terms (category, name, slug, display_order)
values
  ('dance_style', 'Salsa', 'salsa', 10),
  ('dance_style', 'Bachata', 'bachata', 20),
  ('dance_style', 'Merengue', 'merengue', 30),
  ('dance_style', 'Cha-Cha', 'cha-cha', 40),
  ('dance_style', 'Kizomba', 'kizomba', 50),
  ('dance_style', 'Zouk', 'zouk', 60),
  ('dance_style', 'Afro-Cuban', 'afro-cuban', 70),
  ('event_attribute', 'Beginner Friendly', 'beginner-friendly', 10),
  ('event_attribute', 'Outdoor', 'outdoor', 20),
  ('event_attribute', 'Live Music', 'live-music', 30),
  ('event_attribute', 'DJ', 'dj', 40),
  ('event_attribute', 'Free', 'free', 50),
  ('event_attribute', 'Lesson Included', 'lesson-included', 60),
  ('event_attribute', 'Social Dancing', 'social-dancing', 70)
on conflict (slug) do nothing;

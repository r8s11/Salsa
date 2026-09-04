-- Seed initial taxonomy terms
-- Phase 14 — Seed Data
-- This migration adds the standard dance styles and event attributes that are
-- commonly used in the application. Idempotent using ON CONFLICT.

-- Dance Styles
insert into public.taxonomy_terms (category, name, slug, display_order, status, description)
values
  ('dance_style', 'Salsa', 'salsa', 1, 'active', 'Salsa dancing - includes Casino, Rueda, On1, On2, Mambo, Timba'),
  ('dance_style', 'Bachata', 'bachata', 2, 'active', 'Bachata dancing - includes traditional, sensual, and modern styles'),
  ('dance_style', 'Kizomba', 'kizomba', 3, 'active', 'Kizomba dancing - includes Urban Kiz'),
  ('dance_style', 'Merengue', 'merengue', 4, 'active', 'Traditional Merengue'),
  ('dance_style', 'Cha-Cha', 'cha-cha', 5, 'active', 'Cha-Cha dancing'),
  ('dance_style', 'Zouk', 'zouk', 6, 'active', 'Brazilian Zouk dancing'),
  ('dance_style', 'Afro-Cuban', 'afro-cuban', 7, 'active', 'Afro-Cuban dancing - includes Rumba')
on conflict (slug) do nothing;

-- Event Attributes
insert into public.taxonomy_terms (category, name, slug, display_order, status, description)
values
  ('event_attribute', 'Beginner-Friendly', 'beginner-friendly', 1, 'active', 'Suitable for beginners'),
  ('event_attribute', 'Intermediate', 'intermediate', 2, 'active', 'Suitable for intermediate dancers'),
  ('event_attribute', 'Advanced', 'advanced', 3, 'active', 'Suitable for advanced dancers'),
  ('event_attribute', 'Workshop', 'workshop', 4, 'active', 'Workshop or class format'),
  ('event_attribute', 'Social', 'social', 5, 'active', 'Social dancing event'),
  ('event_attribute', 'Live Music', 'live-music', 6, 'active', 'Features live music or band'),
  ('event_attribute', 'Outdoor', 'outdoor', 7, 'active', 'Outdoor venue or event')
on conflict (slug) do nothing;

-- Backfill event_taxonomy_terms from existing events.dance_styles array
-- This bridges the legacy dance_styles column to the new taxonomy system
insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
select e.id, t.id
from public.events e
cross join lateral unnest(e.dance_styles) as dance_style_slug
join public.taxonomy_terms t on t.slug = dance_style_slug and t.category = 'dance_style'
on conflict (event_id, taxonomy_term_id) do nothing;

notify pgrst, 'reload schema';
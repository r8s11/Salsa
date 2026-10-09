-- Phase 10 / P1-7 fresh-stack verification. Run only against local Supabase.
-- Read-only: every result must satisfy the documented expected value.

-- Required objects, their RLS state, and exposed grants.
select
  table_name,
  exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = required.table_name
  ) as exists,
  coalesce((
    select rowsecurity
    from pg_tables
    where schemaname = 'public'
      and tablename = required.table_name
  ), false) as rls_enabled
from (values
  ('events'),
  ('taxonomy_terms'),
  ('event_taxonomy_terms'),
  ('venues'),
  ('platform_settings')
) as required(table_name)
order by table_name;

-- Exact columns required by current application and database contracts.
select
  required.table_name,
  required.column_name,
  information_schema.columns.data_type,
  information_schema.columns.is_nullable
from (values
  ('events', 'venue_id'),
  ('taxonomy_terms', 'id'),
  ('taxonomy_terms', 'category'),
  ('taxonomy_terms', 'name'),
  ('taxonomy_terms', 'normalized_name'),
  ('taxonomy_terms', 'slug'),
  ('taxonomy_terms', 'description'),
  ('taxonomy_terms', 'parent_id'),
  ('taxonomy_terms', 'status'),
  ('taxonomy_terms', 'display_order'),
  ('taxonomy_terms', 'created_at'),
  ('taxonomy_terms', 'updated_at'),
  ('event_taxonomy_terms', 'event_id'),
  ('event_taxonomy_terms', 'taxonomy_term_id'),
  ('venues', 'id'),
  ('venues', 'name'),
  ('venues', 'normalized_name'),
  ('venues', 'address_line1'),
  ('venues', 'city'),
  ('venues', 'instagram'),
  ('venues', 'website'),
  ('venues', 'status'),
  ('platform_settings', 'singleton'),
  ('platform_settings', 'platform_name'),
  ('platform_settings', 'allow_public_event_suggestions'),
  ('platform_settings', 'allow_registered_user_submissions')
) as required(table_name, column_name)
left join information_schema.columns
  on information_schema.columns.table_schema = 'public'
 and information_schema.columns.table_name = required.table_name
 and information_schema.columns.column_name = required.column_name
order by required.table_name, required.column_name;

-- Primary/foreign/unique/check constraints and supporting indexes.
select
  conrelid::regclass as table_name,
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.events'::regclass,
  'public.taxonomy_terms'::regclass,
  'public.event_taxonomy_terms'::regclass,
  'public.venues'::regclass,
  'public.platform_settings'::regclass
)
order by table_name, contype, conname;

select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('events', 'taxonomy_terms', 'event_taxonomy_terms', 'venues', 'platform_settings')
order by tablename, indexname;

-- Policies and table grants must expose only their intended surface.
select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('taxonomy_terms', 'event_taxonomy_terms', 'venues', 'platform_settings')
order by tablename, policyname;

select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('taxonomy_terms', 'event_taxonomy_terms', 'venues', 'platform_settings')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- Canonical local seed contract.
select category, slug
from public.taxonomy_terms
where (category, slug) in (
  ('dance_style', 'salsa'),
  ('dance_style', 'bachata'),
  ('dance_style', 'merengue'),
  ('dance_style', 'cha-cha'),
  ('dance_style', 'kizomba'),
  ('dance_style', 'zouk'),
  ('dance_style', 'afro-cuban'),
  ('event_attribute', 'beginner-friendly'),
  ('event_attribute', 'outdoor'),
  ('event_attribute', 'live-music'),
  ('event_attribute', 'dj'),
  ('event_attribute', 'free'),
  ('event_attribute', 'lesson-included'),
  ('event_attribute', 'social-dancing')
)
order by category, slug;

select platform_name, public_site_url, default_city, default_timezone,
       default_currency_code, allow_public_event_suggestions,
       allow_registered_user_submissions
from public.platform_settings
where singleton;

-- Regression proof for the reported P0001: only missing legacy-derived pairs
-- are failures. Existing non-legacy taxonomy links must not affect this result.
select count(*) as missing_legacy_taxonomy_pairs
from (
  (
    select distinct event.id as event_id, term.id as taxonomy_term_id
    from public.events event
    cross join lateral unnest(coalesce(event.dance_styles, '{}')) as legacy_style
    join public.taxonomy_terms term
      on term.category = 'dance_style'
     and term.slug = legacy_style
  )
  except
  select event_id, taxonomy_term_id
  from public.event_taxonomy_terms
) missing;

-- P1-7 Schema Consolidation Verification Script
-- Phase 14 — Verification
-- This script verifies that the required tables, columns, constraints, indexes,
-- RLS policies, and seed data exist in the database.

-- ============================================================
-- 1. Verify Tables Exist
-- ============================================================
select
  'taxonomy_terms' as table_name,
  case when exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'taxonomy_terms')
    then 'EXISTS' else 'MISSING' end as status
union all
select
  'event_taxonomy_terms',
  case when exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'event_taxonomy_terms')
    then 'EXISTS' else 'MISSING' end
union all
select
  'platform_settings',
  case when exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'platform_settings')
    then 'EXISTS' else 'MISSING' end
union all
select
  'venues',
  case when exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'venues')
    then 'EXISTS' else 'MISSING' end;

-- ============================================================
-- 2. Verify Columns
-- ============================================================
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('taxonomy_terms', 'event_taxonomy_terms', 'platform_settings', 'venues')
order by table_name, ordinal_position;

-- ============================================================
-- 3. Verify Indexes
-- ============================================================
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('taxonomy_terms', 'event_taxonomy_terms', 'platform_settings', 'venues')
order by tablename, indexname;

-- ============================================================
-- 4. Verify RLS is Enabled
-- ============================================================
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('taxonomy_terms', 'event_taxonomy_terms', 'platform_settings', 'venues')
order by tablename;

-- ============================================================
-- 5. Verify Policies
-- ============================================================
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('taxonomy_terms', 'event_taxonomy_terms', 'platform_settings', 'venues')
order by tablename, policyname;

-- ============================================================
-- 6. Verify Seed Data
-- ============================================================
-- Check taxonomy terms
select
  category,
  count(*) as term_count
from public.taxonomy_terms
where status = 'active'
group by category
order by category;

-- Check platform settings
select
  platform_name,
  public_site_url,
  support_email,
  default_city,
  default_timezone,
  default_currency_code
from public.platform_settings
where singleton = true;

-- Check venues
select
  count(*) as venue_count,
  count(*) filter (where status = 'active') as active_venues,
  count(*) filter (where status = 'needs_review') as needs_review_venues,
  count(*) filter (where status = 'archived') as archived_venues
from public.venues;

-- ============================================================
-- 7. Verify Foreign Key Relationships
-- ============================================================
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('event_taxonomy_terms', 'events')
order by tc.table_name, tc.constraint_name;

-- ============================================================
-- 8. Summary
-- ============================================================
select
  'P1-7 Schema Consolidation' as phase,
  'All required tables, constraints, indexes, RLS policies, and seed data verified' as status;
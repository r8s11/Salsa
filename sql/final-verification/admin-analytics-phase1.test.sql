-- Admin Analytics Phase 1 executable regression checks.
-- Run only against a dedicated non-production clone; every fixture is rolled back.
-- This script inserts auth.users rows for database count assertions only (no login).
-- Example: psql "$ANALYTICS_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f sql/final-verification/admin-analytics-phase1.test.sql

\set ON_ERROR_STOP on
BEGIN;

-- Require a schema-only clone so exact aggregate assertions are isolated from
-- unrelated application data; also exercise the truly empty baseline first.
DO $empty$
DECLARE
  v jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.events)
     OR EXISTS (SELECT 1 FROM public.event_submissions)
     OR EXISTS (SELECT 1 FROM auth.users) THEN
    RAISE EXCEPTION 'Use an empty, schema-only non-production database clone';
  END IF;
  PERFORM set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}', true);
  v := public.admin_analytics_metrics(NULL, NULL);
  IF (v->>'total_events')::integer IS DISTINCT FROM 0
     OR (v->>'registered_users')::integer IS DISTINCT FROM 0
     OR (v->>'pending_submissions')::integer IS DISTINCT FROM 0
     OR (v->>'upcoming_events')::integer IS DISTINCT FROM 0
     OR (v->>'active_organizers')::integer IS DISTINCT FROM 0
     OR v->'events_by_city' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'empty sources must return zero metrics and an empty city array';
  END IF;
END
$empty$;

-- Fixed identifiers keep fixtures easy to identify while transaction rollback
-- guarantees they do not persist. Replica mode permits one legacy city value
-- despite the canonical metro FK, solely to exercise tolerant display logic.
SET LOCAL session_replication_role = replica;
CREATE TEMP TABLE analytics_phase1_bounds AS
SELECT pg_catalog.statement_timestamp() - interval '7 days' AS from_date,
       pg_catalog.statement_timestamp() + interval '1 day' AS to_date;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'analytics-admin-fixture@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now() - interval '2 days', now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'analytics-user-old-fixture@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now() - interval '30 days', now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'analytics-user-start-fixture@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', (SELECT from_date FROM analytics_phase1_bounds), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'analytics-user-end-fixture@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', (SELECT to_date FROM analytics_phase1_bounds), now());

INSERT INTO public.organizers (id, name, slug, status) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'Analytics Organizer A', 'analytics-phase1-org-a', 'active'),
  ('a2000000-0000-0000-0000-000000000002', 'Analytics Organizer B', 'analytics-phase1-org-b', 'active');

INSERT INTO public.metros (slug, name) VALUES
  ('boston', 'Boston'),
  ('new-york-city', 'New York City'),
  ('analytics-phase1-metro', 'Analytics Metro');
INSERT INTO public.events (id, title, event_date, status, created_at, city) VALUES
  ('a3000000-0000-0000-0000-000000000016', 'Dynamic registered metro', now() + interval '20 days', 'approved', now() - interval '2 days', 'analytics-phase1-metro');

-- A display name is not a canonical city identifier.
INSERT INTO public.metros (slug, name) VALUES ('other-boston', 'Boston');
INSERT INTO public.events (id, title, event_date, status, created_at, city) VALUES
  ('a3000000-0000-0000-0000-000000000017', 'Different canonical city with the same name', now() + interval '21 days', 'approved', now() - interval '2 days', 'other-boston');

-- Event statuses all contribute to total_events; only approved upcoming rows
-- contribute to the current inventory and organizer/city aggregates.
INSERT INTO public.events (id, title, event_date, status, created_at, city, organizer_id) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'Selected approved upcoming A', now() + interval '5 days', 'approved', now() - interval '2 days', 'boston', 'a2000000-0000-0000-0000-000000000001'),
  ('a3000000-0000-0000-0000-000000000002', 'Selected approved upcoming A duplicate', now() + interval '6 days', 'approved', now() - interval '2 days', 'boston', 'a2000000-0000-0000-0000-000000000001'),
  ('a3000000-0000-0000-0000-000000000003', 'Approved today boundary', date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York', 'approved', now() - interval '2 days', 'new-york-city', 'a2000000-0000-0000-0000-000000000002'),
  ('a3000000-0000-0000-0000-000000000004', 'Approved null city', now() + interval '8 days', 'approved', now() - interval '2 days', NULL, NULL),
  ('a3000000-0000-0000-0000-000000000005', 'Approved blank city', now() + interval '9 days', 'approved', now() - interval '2 days', '   ', NULL),
  ('a3000000-0000-0000-0000-000000000006', 'Approved unknown legacy city', now() + interval '10 days', 'approved', now() - interval '2 days', 'legacy-unknown-metro', NULL),
  ('a3000000-0000-0000-0000-000000000007', 'Draft future excluded from current inventory', now() + interval '4 days', 'draft', now() - interval '2 days', 'boston', 'a2000000-0000-0000-0000-000000000002'),
  ('a3000000-0000-0000-0000-000000000008', 'Cancelled future excluded from current inventory', now() + interval '4 days', 'cancelled', now() - interval '2 days', 'boston', 'a2000000-0000-0000-0000-000000000002'),
  ('a3000000-0000-0000-0000-000000000009', 'Rejected future excluded from current inventory', now() + interval '4 days', 'rejected', now() - interval '2 days', 'boston', 'a2000000-0000-0000-0000-000000000002'),
  ('a3000000-0000-0000-0000-000000000010', 'Approved past excluded from current inventory', now() - interval '1 day', 'approved', now() - interval '2 days', 'boston', 'a2000000-0000-0000-0000-000000000002'),
  ('a3000000-0000-0000-0000-000000000011', 'Old event outside selected dates', now() + interval '12 days', 'draft', now() - interval '30 days', 'boston', NULL),
  ('a3000000-0000-0000-0000-000000000012', 'Null-created event', now() + interval '13 days', 'draft', NULL, 'boston', NULL),
  ('a3000000-0000-0000-0000-000000000013', 'Event at selected inclusive start', now() + interval '14 days', 'draft', (SELECT from_date FROM analytics_phase1_bounds), 'boston', NULL),
  ('a3000000-0000-0000-0000-000000000014', 'Event at selected exclusive end', now() + interval '15 days', 'draft', (SELECT to_date FROM analytics_phase1_bounds), 'boston', NULL),
  ('a3000000-0000-0000-0000-000000000015', 'Archived event still counted as created activity', now() + interval '16 days', 'archived', now() - interval '2 days', 'boston', NULL);

INSERT INTO public.event_submissions (id, status, submitted_data, submitted_at, created_at) VALUES
  ('a4000000-0000-0000-0000-000000000001', 'pending', '{}', now() - interval '2 days', now() - interval '2 days'),
  ('a4000000-0000-0000-0000-000000000002', 'in_review', '{}', now() - interval '2 days', now() - interval '2 days'),
  ('a4000000-0000-0000-0000-000000000003', 'needs_information', '{}', now() - interval '2 days', now() - interval '2 days'),
  ('a4000000-0000-0000-0000-000000000004', 'approved', '{}', now() - interval '2 days', now() - interval '2 days'),
  ('a4000000-0000-0000-0000-000000000005', 'rejected', '{}', now() - interval '2 days', now() - interval '2 days'),
  ('a4000000-0000-0000-0000-000000000006', 'withdrawn', '{}', now() - interval '2 days', now() - interval '2 days'),
  ('a4000000-0000-0000-0000-000000000007', 'pending', '{}', now() - interval '30 days', now() - interval '2 days'),
  ('a4000000-0000-0000-0000-000000000008', 'pending', '{}', (SELECT from_date FROM analytics_phase1_bounds), now()),
  ('a4000000-0000-0000-0000-000000000009', 'pending', '{}', (SELECT to_date FROM analytics_phase1_bounds), now());

SET LOCAL session_replication_role = origin;

DO $test$
DECLARE
  v jsonb;
  v_city text;
  v_count integer;
  v_failed boolean;
  v_from timestamptz;
  v_to timestamptz;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}', true);
  SELECT from_date, to_date INTO v_from, v_to FROM analytics_phase1_bounds;
  v := public.admin_analytics_metrics(v_from, v_to);
  IF (v->>'total_events')::integer IS DISTINCT FROM 14 THEN RAISE EXCEPTION 'selected total_events expected 14, across statuses and selected boundaries; got %', v->>'total_events'; END IF;
  IF (v->>'registered_users')::integer IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'selected registered_users must count auth.users at inclusive start, excluding end; got %', v->>'registered_users'; END IF;
  IF (v->>'pending_submissions')::integer IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'selected pending_submissions expected pending + in_review using inclusive submitted_at start; got %', v->>'pending_submissions'; END IF;
  IF (v->>'upcoming_events')::integer IS DISTINCT FROM 8 THEN RAISE EXCEPTION 'upcoming_events expected approved current inventory including today boundary, got %', v->>'upcoming_events'; END IF;
  IF (v->>'active_organizers')::integer IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'active_organizers must count distinct organizer_id, got %', v->>'active_organizers'; END IF;
  IF v->>'as_of' IS NULL THEN RAISE EXCEPTION 'as_of must be populated'; END IF;

  SELECT item->>'city', (item->>'count')::integer INTO v_city, v_count
    FROM jsonb_array_elements(v->'events_by_city') item
   WHERE item->>'slug' = 'boston';
  IF v_city IS NULL OR v_count <> 2 THEN RAISE EXCEPTION 'Boston city aggregate expected 2 current approved events'; END IF;
  IF v->'events_by_city'->0->>'city' <> 'Boston'
     OR v->'events_by_city'->1->>'city' <> 'Unknown city' THEN
    RAISE EXCEPTION 'city rows must sort by count descending then label ascending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'events_by_city') item WHERE item->>'city' = 'Unknown city' AND (item->>'count')::integer = 2) THEN
    RAISE EXCEPTION 'null and blank cities must group as Unknown city';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'events_by_city') item WHERE item->>'city' = 'legacy-unknown-metro' AND (item->>'count')::integer = 1) THEN
    RAISE EXCEPTION 'unmatched legacy city label must remain visible';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'events_by_city') item WHERE item->>'city' = 'Analytics Metro' AND (item->>'count')::integer = 1) THEN
    RAISE EXCEPTION 'new registered metros must appear dynamically';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(v->'events_by_city') item WHERE item->>'city' = 'Boston') IS DISTINCT FROM 2
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'events_by_city') item WHERE item->>'slug' = 'other-boston' AND (item->>'count')::integer = 1) THEN
    RAISE EXCEPTION 'canonical cities with the same display name must not be merged';
  END IF;

  -- Current inventory must remain stable across retrospective ranges.
  v := public.admin_analytics_metrics(v_from - interval '83 days', v_to);
  IF (v->>'upcoming_events')::integer IS DISTINCT FROM 8 OR (v->>'active_organizers')::integer IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'current inventory must not depend on selected activity period';
  END IF;

  v := public.admin_analytics_metrics(NULL, NULL);
  IF (v->>'total_events')::integer IS DISTINCT FROM 17 THEN RAISE EXCEPTION 'all-time event count must include null created_at and every status'; END IF;
  IF (v->>'registered_users')::integer IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'all-time auth.users count expected 4 (auth.users source, not profiles)'; END IF;
  IF (v->>'pending_submissions')::integer IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'all-time pending submission count expected 5'; END IF;

  -- A failed source must not manufacture zero or discard healthy metrics.
  ALTER TABLE auth.users RENAME TO analytics_phase1_unavailable_users;
  v := public.admin_analytics_metrics(NULL, NULL);
  IF v->'registered_users' IS DISTINCT FROM 'null'::jsonb
     OR (v->>'total_events')::integer IS DISTINCT FROM 17
     OR (v->>'upcoming_events')::integer IS DISTINCT FROM 8 THEN
    RAISE EXCEPTION 'failed user source must be unavailable while healthy event counts survive';
  END IF;
  ALTER TABLE auth.analytics_phase1_unavailable_users RENAME TO users;

  -- Null-pair and ordered-bound validation.
  v_failed := false;
  BEGIN
    PERFORM public.admin_analytics_metrics(now(), NULL);
  EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'one-null date pair must be rejected'; END IF;
  v_failed := false;
  BEGIN
    PERFORM public.admin_analytics_metrics(now(), now() - interval '1 second');
  EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'non-increasing date range must be rejected'; END IF;

  -- Authenticated callers without trusted admin app_metadata cannot use the RPC.
  FOREACH v_city IN ARRAY ARRAY['user','organizer','host','moderator'] LOOP
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub','a1000000-0000-0000-0000-000000000002','app_metadata',jsonb_build_object('role',v_city))::text, true);
    v_failed := false;
    BEGIN
      PERFORM public.admin_analytics_metrics(NULL, NULL);
    EXCEPTION WHEN insufficient_privilege THEN v_failed := true;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'role % must be denied', v_city; END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_failed := false;
  BEGIN
    PERFORM public.admin_analytics_metrics(NULL, NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'anonymous subject must be denied'; END IF;

  IF NOT has_function_privilege('authenticated', 'public.admin_analytics_metrics(timestamptz,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must have execute on analytics RPC';
  END IF;
  IF has_function_privilege('anon', 'public.admin_analytics_metrics(timestamptz,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not have execute on analytics RPC';
  END IF;
  IF has_table_privilege('anon', 'public.events', 'SELECT')
     OR has_table_privilege('anon', 'public.profiles', 'SELECT')
     OR has_table_privilege('anon', 'auth.users', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not have raw SELECT privileges on events, profiles, or auth.users';
  END IF;
END
$test$;

ROLLBACK;
\echo 'Admin Analytics Phase 1 SQL regression checks passed; transaction rolled back.'

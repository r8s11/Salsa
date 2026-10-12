-- Admin Analytics Phase 2 executable regression.
-- Run only on an empty, isolated, non-production schema clone. All fixtures roll back.
-- Example: psql "$ANALYTICS_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f sql/final-verification/admin-analytics-phase2-regression.sql
\set ON_ERROR_STOP on
BEGIN;

DO $empty$
DECLARE
  v jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.events)
     OR EXISTS (SELECT 1 FROM public.event_submissions)
     OR EXISTS (SELECT 1 FROM auth.users)
     OR EXISTS (SELECT 1 FROM public.taxonomy_terms)
     OR EXISTS (SELECT 1 FROM public.event_taxonomy_terms) THEN
    RAISE EXCEPTION 'Use an empty, schema-only non-production database clone';
  END IF;
  PERFORM set_config('request.jwt.claims', '{"sub":"a2100000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}', true);
  v := public.admin_analytics_timeseries(NULL, NULL, 'monthly');
  IF (v->'events'->>'current')::integer IS DISTINCT FROM 0
     OR (v->'users'->>'total_accounts')::integer IS DISTINCT FROM 0
     OR (v->'submissions'->>'received')::integer IS DISTINCT FROM 0
     OR (v->'geography'->>'active_metros')::integer IS DISTINCT FROM 0
     OR (v->'styles'->>'upcoming_total')::integer IS DISTINCT FROM 0
     OR v->'events'->'series' IS DISTINCT FROM '[]'::jsonb
     OR v->'styles'->'distribution' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'empty sources must return zero counts and empty arrays';
  END IF;
END
$empty$;


-- Suppress app triggers while inserting aggregate-only fixture rows. This is
-- an isolated DB-clone test; rollback is mandatory and no login is attempted.
SET LOCAL session_replication_role = replica;
CREATE TEMP TABLE analytics_phase2_dates AS
SELECT pg_catalog.statement_timestamp() AS as_of,
       (pg_catalog.statement_timestamp() AT TIME ZONE 'America/New_York')::date AS today_et;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'a2100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'analytics-admin-fixture@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', (SELECT (today_et - 2)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'analytics-user-prev-fixture@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', (SELECT (today_et - 10)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2100000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'analytics-user-old-fixture@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', (SELECT (today_et - 40)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2100000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'analytics-user-undated-fixture@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', NULL, now());

INSERT INTO public.metros (slug, name) VALUES
  ('analytics-phase2-metro-a', 'Analytics Same Name'),
  ('analytics-phase2-metro-b', 'Analytics Same Name');

INSERT INTO public.taxonomy_terms (id, category, name, slug, status) VALUES
  ('a2200000-0000-0000-0000-000000000001', 'dance_style', 'Phase Two Canonical', 'phase-two-canonical', 'active'),
  ('a2200000-0000-0000-0000-000000000002', 'dance_style', 'Phase Two Partner', 'phase-two-partner', 'active'),
  ('a2200000-0000-0000-0000-000000000003', 'dance_style', 'Legacy Registry Match', 'legacy-registry-match', 'active');

INSERT INTO public.events (id, title, event_date, status, created_at, city, dance_styles) VALUES
  -- Created-window cohort, current approved status; canonical style overrides stale legacy style.
  ('a2300000-0000-0000-0000-000000000001', 'Current approved canonical', (SELECT (today_et)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'approved', (SELECT (today_et - 2)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'analytics-phase2-metro-a', ARRAY['stale-legacy-style']),
  -- Current style inventory and a separately registered metro with identical display name.
  ('a2300000-0000-0000-0000-000000000002', 'Current approved legacy fallback', (SELECT (today_et)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'approved', (SELECT (today_et - 2)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'analytics-phase2-metro-b', ARRAY['legacy-registry-match','Unregistered Legacy Label']),
  -- Approved and upcoming, but no style assignments.
  ('a2300000-0000-0000-0000-000000000003', 'Current approved unspecified', (SELECT (today_et)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'approved', (SELECT (today_et - 1)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), NULL, ARRAY[]::text[]),
  -- Past event has no current inventory contribution, despite approved status.
  ('a2300000-0000-0000-0000-000000000004', 'Past approved', (SELECT (today_et - 1)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'approved', (SELECT (today_et - 2)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'analytics-phase2-metro-a', ARRAY[]::text[]),
  -- Pending/draft currently contribute only their event creation cohorts.
  ('a2300000-0000-0000-0000-000000000005', 'Current pending', (SELECT (today_et + 5)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'pending', (SELECT (today_et - 2)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'analytics-phase2-metro-a', ARRAY[]::text[]),
  ('a2300000-0000-0000-0000-000000000006', 'Current draft', (SELECT (today_et + 6)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'draft', (SELECT (today_et - 2)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'analytics-phase2-metro-a', ARRAY[]::text[]),
  -- Prior 7-day creation cohort for comparison.
  ('a2300000-0000-0000-0000-000000000007', 'Previous cohort', (SELECT (today_et + 7)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'rejected', (SELECT (today_et - 9)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'analytics-phase2-metro-a', ARRAY[]::text[]),
  -- Future beyond selected activity range; exercises all-time scheduled output.
  ('a2300000-0000-0000-0000-000000000008', 'Far future approved', (SELECT (today_et + 45)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'approved', (SELECT (today_et - 20)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'analytics-phase2-metro-a', ARRAY[]::text[]),
  -- Inclusive start and exclusive end on Eastern midnights.
  ('a2300000-0000-0000-0000-000000000009', 'Inclusive start boundary', (SELECT (today_et + 8)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'draft', (SELECT (today_et - 6)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'analytics-phase2-metro-a', ARRAY[]::text[]),
  ('a2300000-0000-0000-0000-000000000010', 'Exclusive end boundary', (SELECT (today_et + 9)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'draft', (SELECT (today_et + 1)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'analytics-phase2-metro-a', ARRAY[]::text[]),
  -- Legacy fallback on an event without canonical style links.
  ('a2300000-0000-0000-0000-000000000011', 'Current approved legacy-only styles', (SELECT (today_et)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'approved', (SELECT (today_et - 2)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'analytics-phase2-metro-b', ARRAY['legacy-registry-match','Unregistered Legacy Label']),
  -- Null creation timestamps contribute to all-time totals but have no series bucket.
  ('a2300000-0000-0000-0000-000000000012', 'Null creation timestamp', (SELECT (today_et + 12)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), 'draft', NULL, 'analytics-phase2-metro-a', ARRAY[]::text[]);

INSERT INTO public.event_taxonomy_terms (event_id, taxonomy_term_id) VALUES
  ('a2300000-0000-0000-0000-000000000001', 'a2200000-0000-0000-0000-000000000001'),
  ('a2300000-0000-0000-0000-000000000001', 'a2200000-0000-0000-0000-000000000002'),
  ('a2300000-0000-0000-0000-000000000002', 'a2200000-0000-0000-0000-000000000003');

INSERT INTO public.event_submissions (id, status, submitted_data, submitted_at, created_at) VALUES
  ('a2400000-0000-0000-0000-000000000001', 'pending', '{"private_marker":"never expose"}', (SELECT (today_et - 2)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), now()),
  ('a2400000-0000-0000-0000-000000000002', 'in_review', '{}', (SELECT (today_et - 3)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), now()),
  ('a2400000-0000-0000-0000-000000000003', 'needs_information', '{}', (SELECT (today_et - 4)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), now()),
  ('a2400000-0000-0000-0000-000000000004', 'approved', '{}', (SELECT (today_et - 1)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), now()),
  ('a2400000-0000-0000-0000-000000000005', 'rejected', '{}', (SELECT (today_et - 1)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), now()),
  ('a2400000-0000-0000-0000-000000000006', 'withdrawn', '{}', (SELECT (today_et - 1)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), now()),
  ('a2400000-0000-0000-0000-000000000007', 'pending', '{}', (SELECT (today_et - 10)::timestamp AT TIME ZONE 'America/New_York' FROM analytics_phase2_dates), now());
SET LOCAL session_replication_role = origin;

DO $test$
DECLARE
  v jsonb;
  v_daily jsonb;
  v_bad boolean;
  v_from timestamptz;
  v_to timestamptz;
  v_today date;
BEGIN
  SELECT today_et INTO v_today FROM analytics_phase2_dates;
  v_from := (v_today - 6)::timestamp AT TIME ZONE 'America/New_York';
  v_to := (v_today + 1)::timestamp AT TIME ZONE 'America/New_York';
  PERFORM set_config('request.jwt.claims', '{"sub":"a2100000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}', true);

  -- Empty-schema baseline is covered before fixtures; selected cohort checks all-time totals,
  -- canonical metro identity, current-status cohorts, and independent source aggregations.
  v := public.admin_analytics_timeseries(v_from, v_to, 'daily');
  IF v->>'granularity' IS DISTINCT FROM 'daily' OR v->>'as_of' IS NULL THEN
    RAISE EXCEPTION 'payload must include selected granularity and as_of';
  END IF;
  IF (v->'events'->>'current')::integer IS DISTINCT FROM 8
     OR (v->'events'->>'previous')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'event current/previous cohorts expected 8/1 including the inclusive start boundary';
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(v->'events'->'series') x
        WHERE x->>'period' = pg_catalog.to_char(v_today - 2, 'YYYY-MM-DD')
          AND (x->>'created')::integer = 6
          AND (x->>'approved')::integer = 4
          AND (x->>'pending_draft')::integer = 2
     ) THEN
    RAISE EXCEPTION 'event creation cohorts must classify current approved and pending/draft statuses';
  END IF;
  IF (v->'users'->>'current')::integer IS DISTINCT FROM 1
     OR (v->'users'->>'previous')::integer IS DISTINCT FROM 1
     OR (v->'users'->>'total_accounts')::integer IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'user counts must use auth.users, expected current 1, previous 1, total 4';
  END IF;
  IF (v->'submissions'->>'received')::integer IS DISTINCT FROM 6
     OR (v->'submissions'->>'approved')::integer IS DISTINCT FROM 1
     OR (v->'submissions'->>'rejected')::integer IS DISTINCT FROM 1
     OR (v->'submissions'->>'pending')::integer IS DISTINCT FROM 2
     OR (v->'submissions'->>'needs_information')::integer IS DISTINCT FROM 1
     OR (v->'submissions'->>'withdrawn')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'submission current-cohort status counts are incorrect';
  END IF;
  IF (v->'geography'->>'active_metros')::integer IS DISTINCT FROM 2
     OR v->'geography'->>'inventory_history_available' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'active metros must count canonical registered slugs; history stays unavailable';
  END IF;
  IF (SELECT count(DISTINCT x->>'slug') FROM jsonb_array_elements(v->'geography'->'scheduled') x WHERE x->>'city' = 'Analytics Same Name') IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'distinct canonical metro slugs with duplicate display names must remain separate';
  END IF;
  IF (v->'styles'->>'upcoming_total')::integer IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'upcoming style denominator must include exactly five approved upcoming events';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'styles'->'distribution') x WHERE x->>'slug' = 'phase-two-canonical' AND (x->>'count')::integer = 1)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'styles'->'distribution') x WHERE x->>'slug' = 'phase-two-partner' AND (x->>'count')::integer = 1)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'styles'->'distribution') x WHERE x->>'slug' = 'legacy-registry-match' AND (x->>'count')::integer = 2)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'styles'->'distribution') x WHERE x->>'style' = 'unregistered legacy label' AND x->>'slug' = 'unregistered legacy label' AND (x->>'count')::integer = 1)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'styles'->'distribution') x WHERE x->>'style' = 'Unspecified' AND x->>'slug' IS NULL AND (x->>'count')::integer = 2)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v->'styles'->'distribution') x WHERE x->>'style' = 'stale-legacy-style') THEN
    RAISE EXCEPTION 'style output must honor canonical authority, fallback labels, and unspecified events';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(v->'styles'->'distribution') x WHERE x->>'slug' IN ('phase-two-canonical','phase-two-partner')) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'multi-style event must appear once per canonical style';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(v->'geography'->'emerging')) IS DISTINCT FROM 1
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'geography'->'emerging') x WHERE x->>'slug' = 'analytics-phase2-metro-b') THEN
    RAISE EXCEPTION 'emerging metros must use first currently-approved creation date within selection';
  END IF;
  IF pg_catalog.strpos(v::text, 'analytics-admin-fixture@example.invalid') > 0
     OR pg_catalog.strpos(v::text, 'never expose') > 0 THEN
    RAISE EXCEPTION 'RPC must not expose auth or submission row data';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(v->'events'->'series')) IS DISTINCT FROM 7 THEN
    RAISE EXCEPTION 'daily series must zero-fill all seven Eastern calendar buckets';
  END IF;

  -- Spring DST: boundaries span the Eastern offset change. Calendar-day windows
  -- remain 7 days; elapsed-duration subtraction would produce the wrong boundary.
  v_from := timestamp '2026-03-08 00:00:00' AT TIME ZONE 'America/New_York';
  v_to := timestamp '2026-03-15 00:00:00' AT TIME ZONE 'America/New_York';
  v := public.admin_analytics_timeseries(v_from, v_to, 'daily');
  IF v->'users' IS NOT DISTINCT FROM 'null'::jsonb OR (SELECT count(*) FROM jsonb_array_elements(v->'users'->'series')) IS DISTINCT FROM 7 THEN
    RAISE EXCEPTION 'DST-crossing window must retain seven Eastern local-date buckets';
  END IF;
  -- A preceding window with no source rows must remain numeric zero; consumers
  -- treat zero as an unavailable growth denominator rather than divide by it.
  v_from := (v_today + 10)::timestamp AT TIME ZONE 'America/New_York';
  v_to := (v_today + 11)::timestamp AT TIME ZONE 'America/New_York';
  v := public.admin_analytics_timeseries(v_from, v_to, 'daily');
  IF (v->'events'->>'current')::integer IS DISTINCT FROM 0
     OR (v->'events'->>'previous')::integer IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'empty current and prior activity windows must report zero counts';
  END IF;

  -- All time includes undated accounts in totals, without inventing series dates.
  -- Monthly labels must be Eastern first-of-month dates.
  v := public.admin_analytics_timeseries(NULL, NULL, 'monthly');
  IF v->'events'->'previous' IS DISTINCT FROM 'null'::jsonb
     OR v->'users'->'previous' IS DISTINCT FROM 'null'::jsonb
     OR (v->'users'->>'total_accounts')::integer IS DISTINCT FROM 4
     OR (v->'users'->>'current')::integer IS DISTINCT FROM 4
     OR (v->'events'->>'current')::integer IS DISTINCT FROM 12 THEN
    RAISE EXCEPTION 'all-time totals and unavailable previous comparisons are incorrect';
  END IF;
  IF (SELECT sum((x->>'created')::integer) FROM jsonb_array_elements(v->'events'->'series') x) IS DISTINCT FROM 11 THEN
    RAISE EXCEPTION 'null creation timestamp must count in all-time total without a series bucket';
  END IF;
  IF (SELECT sum((x->>'count')::integer) FROM jsonb_array_elements(v->'users'->'series') x) IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'undated Auth account must not receive a manufactured registration bucket';
  END IF;
  v_daily := public.admin_analytics_timeseries(NULL, NULL, 'daily');
  IF NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_daily->'geography'->'scheduled') x
        WHERE x->>'slug' = 'analytics-phase2-metro-a'
          AND x->>'period' = pg_catalog.to_char(v_today - 1, 'YYYY-MM-DD')
          AND (x->>'count')::integer = 1
     )
     OR NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_daily->'styles'->'scheduled') x
        WHERE x->>'style' = 'Unspecified' AND x->>'slug' IS NULL
          AND x->>'period' = pg_catalog.to_char(v_today - 1, 'YYYY-MM-DD')
          AND (x->>'count')::integer = 1
     ) THEN
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v->'users'->'series') x WHERE (x->>'period') !~ '^\d{4}-\d{2}-01$') THEN
    RAISE EXCEPTION 'all-time monthly series labels must be first day of each month';
  END IF;

  -- Each source failure is isolated: unavailable section null, healthy peer survives.
  ALTER TABLE auth.users RENAME TO analytics_phase2_unavailable_users;
  v := public.admin_analytics_timeseries(NULL, NULL, 'monthly');
  IF v->'users' IS DISTINCT FROM 'null'::jsonb
     OR (v->'events'->>'current')::integer IS DISTINCT FROM 12
     OR v->'submissions' IS NOT DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'auth.users failure must null only users section';
  END IF;
  ALTER TABLE auth.analytics_phase2_unavailable_users RENAME TO users;

  ALTER TABLE public.taxonomy_terms RENAME TO analytics_phase2_unavailable_terms;
  v := public.admin_analytics_timeseries(v_from, v_to, 'daily');
  IF v->'styles' IS DISTINCT FROM 'null'::jsonb
     OR v->'events' IS NOT DISTINCT FROM 'null'::jsonb
     OR v->'geography' IS NOT DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'taxonomy source failure must null only styles section';
  END IF;
  ALTER TABLE public.analytics_phase2_unavailable_terms RENAME TO taxonomy_terms;
  ALTER TABLE public.metros RENAME TO analytics_phase2_unavailable_metros;
  v := public.admin_analytics_timeseries(v_from, v_to, 'daily');
  IF v->'geography' IS DISTINCT FROM 'null'::jsonb
     OR v->'events' IS NOT DISTINCT FROM 'null'::jsonb
     OR v->'users' IS NOT DISTINCT FROM 'null'::jsonb
     OR v->'styles' IS NOT DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'metro source failure must null only geography section';
  END IF;
  ALTER TABLE public.analytics_phase2_unavailable_metros RENAME TO metros;

  -- Range and granularity validation return SQLSTATE 22023.
  v_bad := false;
  BEGIN PERFORM public.admin_analytics_timeseries(now(), NULL, 'daily');
  EXCEPTION WHEN invalid_parameter_value THEN v_bad := true; END;
  IF NOT v_bad THEN RAISE EXCEPTION 'one-null boundary must be rejected'; END IF;
  v_bad := false;
  BEGIN PERFORM public.admin_analytics_timeseries(now(), now() - interval '1 second', 'daily');
  EXCEPTION WHEN invalid_parameter_value THEN v_bad := true; END;
  IF NOT v_bad THEN RAISE EXCEPTION 'reversed boundary must be rejected'; END IF;
  v_bad := false;
  BEGIN PERFORM public.admin_analytics_timeseries(NULL, NULL, 'yearly');
  EXCEPTION WHEN invalid_parameter_value THEN v_bad := true; END;
  IF NOT v_bad THEN RAISE EXCEPTION 'unsupported granularity must be rejected'; END IF;

  -- Trusted app_metadata is mandatory; user_metadata cannot forge admin access.
  PERFORM set_config('request.jwt.claims', '{"sub":"a2100000-0000-0000-0000-000000000002","app_metadata":{"role":"user"},"user_metadata":{"role":"admin"}}', true);
  v_bad := false;
  BEGIN PERFORM public.admin_analytics_timeseries(NULL, NULL, 'monthly');
  EXCEPTION WHEN insufficient_privilege THEN v_bad := true; END;
  IF NOT v_bad THEN RAISE EXCEPTION 'user_metadata admin claim must not authorize RPC'; END IF;
  PERFORM set_config('request.jwt.claims', '{"sub":"a2100000-0000-0000-0000-000000000002","user_metadata":{"role":"admin"}}', true);
  v_bad := false;
  BEGIN PERFORM public.admin_analytics_timeseries(NULL, NULL, 'monthly');
  EXCEPTION WHEN insufficient_privilege THEN v_bad := true; END;
  IF NOT v_bad THEN RAISE EXCEPTION 'missing app_metadata admin claim must be denied'; END IF;
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_bad := false;
  BEGIN PERFORM public.admin_analytics_timeseries(NULL, NULL, 'monthly');
  EXCEPTION WHEN insufficient_privilege THEN v_bad := true; END;
  IF NOT v_bad THEN RAISE EXCEPTION 'anonymous request must be denied'; END IF;

  IF NOT has_function_privilege('authenticated', 'public.admin_analytics_timeseries(timestamptz,timestamptz,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_analytics_timeseries(timestamptz,timestamptz,text)', 'EXECUTE')
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.pg_proc p
         CROSS JOIN LATERAL pg_catalog.aclexplode(
           coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
         ) acl
        WHERE p.oid = 'public.admin_analytics_timeseries(timestamptz,timestamptz,text)'::regprocedure
          AND acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'analytics RPC execute privilege boundary is incorrect';
  END IF;
  IF has_table_privilege('anon', 'auth.users', 'SELECT')
     OR has_table_privilege('anon', 'public.events', 'SELECT')
     OR has_table_privilege('anon', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not have raw SELECT privileges on accounts, events, or profiles';
  END IF;
END
$test$;

-- Boundary rows make elapsed-UTC comparison arithmetic observably wrong at
-- both DST transitions. Keep this after the cohort fixture assertions above.
SET LOCAL session_replication_role = replica;
INSERT INTO public.events (id, title, event_date, status, created_at, dance_styles) VALUES
  ('a2300000-0000-0000-0000-000000000100', 'Spring included prior boundary', '2026-03-01T05:30:00Z', 'draft', '2026-03-01T05:30:00Z', ARRAY[]::text[]),
  ('a2300000-0000-0000-0000-000000000101', 'Spring excluded prior boundary', '2026-03-01T04:30:00Z', 'draft', '2026-03-01T04:30:00Z', ARRAY[]::text[]),
  ('a2300000-0000-0000-0000-000000000102', 'Fall included prior boundary', '2026-10-25T04:30:00Z', 'draft', '2026-10-25T04:30:00Z', ARRAY[]::text[]),
  ('a2300000-0000-0000-0000-000000000103', 'Fall excluded prior boundary', '2026-10-25T03:30:00Z', 'draft', '2026-10-25T03:30:00Z', ARRAY[]::text[]);
SET LOCAL session_replication_role = origin;
DO $dst$
DECLARE
  v jsonb;
  v_from timestamptz;
  v_to timestamptz;
  v_previous_from timestamptz;
  v_expected bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"a2100000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}', true);
  FOR v_from, v_to, v_previous_from IN
    SELECT * FROM (VALUES
      ('2026-03-08T05:00:00Z'::timestamptz, '2026-03-15T04:00:00Z'::timestamptz, '2026-03-01T05:00:00Z'::timestamptz),
      ('2026-11-01T04:00:00Z'::timestamptz, '2026-11-08T05:00:00Z'::timestamptz, '2026-10-25T04:00:00Z'::timestamptz)
    ) AS boundaries(current_from, current_to, previous_from)
  LOOP
    SELECT count(*) INTO v_expected FROM public.events
      WHERE created_at >= v_previous_from AND created_at < v_from;
    v := public.admin_analytics_timeseries(v_from, v_to, 'daily');
    IF (v->'events'->>'previous')::bigint IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'DST comparison must use the preceding seven Eastern calendar days';
    END IF;
  END LOOP;
END
$dst$;

ROLLBACK;
\echo 'Admin Analytics Phase 2 SQL regression checks passed; transaction rolled back.'

-- Admin Analytics Phase 1 release preflight: read-only catalog queries only.
-- Run using an authorized read-only connection to the intended production DB.
-- No event rows, identity rows, credentials, or private submission data returned.
-- A passing local result does not establish production compatibility.
BEGIN TRANSACTION READ ONLY;

WITH required(schema_name, relation_name, column_name, expected_type) AS (
  VALUES
    ('public', 'events', 'created_at', 'timestamp with time zone'),
    ('public', 'events', 'event_date', 'timestamp with time zone'),
    ('public', 'events', 'status', NULL),
    ('public', 'events', 'city', 'text'),
    ('public', 'events', 'organizer_id', 'uuid'),
    ('public', 'event_submissions', 'submitted_at', 'timestamp with time zone'),
    ('public', 'event_submissions', 'status', NULL),
    ('public', 'metros', 'slug', 'text'),
    ('public', 'metros', 'name', 'text'),
    ('auth', 'users', 'created_at', 'timestamp with time zone')
), columns_checked AS (
  SELECT r.*, a.attname IS NOT NULL AS present,
         pg_catalog.format_type(a.atttypid, a.atttypmod) AS actual_type,
         a.attname IS NOT NULL AND (r.expected_type IS NULL OR
           pg_catalog.format_type(a.atttypid, a.atttypmod) = r.expected_type) AS compatible
    FROM required r
    LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = r.schema_name
    LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = r.relation_name
    LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
      AND a.attname = r.column_name AND a.attnum > 0 AND NOT a.attisdropped
), rpc AS (
  SELECT p.*, r.rolsuper, r.rolbypassrls
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
   WHERE p.oid = pg_catalog.to_regprocedure('public.admin_analytics_metrics(timestamptz,timestamptz)')
), sources(schema_name, relation_name) AS (
  VALUES ('public', 'events'), ('public', 'event_submissions'),
         ('public', 'metros'), ('auth', 'users')
), owner_access AS (
  SELECT s.*, pg_catalog.has_table_privilege(p.proowner, c.oid, 'SELECT') AS can_select,
         NOT c.relrowsecurity OR p.rolsuper OR p.rolbypassrls OR
           (p.proowner = c.relowner AND NOT c.relforcerowsecurity) AS unfiltered,
         c.relrowsecurity, c.relforcerowsecurity
    FROM sources s
    LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = s.schema_name
    LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = s.relation_name
    LEFT JOIN rpc p ON true
)
SELECT pg_catalog.jsonb_build_object(
  'columns_compatible', (SELECT pg_catalog.bool_and(compatible) FROM columns_checked),
  'columns', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) ORDER BY schema_name, relation_name, column_name) FROM columns_checked c),
  'existing_rpc_identity', (SELECT pg_catalog.pg_get_function_identity_arguments(oid) FROM rpc),
  'existing_rpc_result', (SELECT pg_catalog.pg_get_function_result(oid) FROM rpc),
  'existing_rpc_owner', (SELECT pg_catalog.pg_get_userbyid(proowner) FROM rpc),
  'owner_can_read_all_sources', (SELECT pg_catalog.bool_and(coalesce(can_select AND unfiltered, false)) FROM owner_access),
  'owner_access', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a) ORDER BY schema_name, relation_name) FROM owner_access a),
  'auth_helpers_exist', pg_catalog.to_regprocedure('auth.uid()') IS NOT NULL AND pg_catalog.to_regprocedure('auth.jwt()') IS NOT NULL,
  'roles_exist', (SELECT count(*) = 2 FROM pg_catalog.pg_roles WHERE rolname IN ('anon', 'authenticated')),
  'anonymous_raw_select_denied', NOT coalesce(pg_catalog.has_table_privilege('anon', pg_catalog.to_regclass('public.events'), 'SELECT'), true)
    AND NOT coalesce(pg_catalog.has_table_privilege('anon', pg_catalog.to_regclass('public.profiles'), 'SELECT'), true)
    AND NOT coalesce(pg_catalog.has_table_privilege('anon', pg_catalog.to_regclass('auth.users'), 'SELECT'), true)
) AS analytics_release_preflight;

-- Verify approved/pending/in_review exist when status columns use enums.
-- For text statuses, review the constraints returned by the next query instead.
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS status_type,
       e.enumlabel AS allowed_status
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_catalog.pg_enum e ON e.enumtypid = a.atttypid
 WHERE n.nspname = 'public' AND c.relname IN ('events', 'event_submissions')
   AND a.attname = 'status' AND NOT a.attisdropped
 ORDER BY c.relname, e.enumsortorder;

-- The metro slug must be unique to avoid multiplying event counts in the join.
-- Verify events.city's canonical FK and the status constraints against live schema.
SELECT c.relname AS relation_name, k.conname, k.contype,
       pg_catalog.pg_get_constraintdef(k.oid) AS definition
  FROM pg_catalog.pg_constraint k
  JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('events', 'event_submissions', 'metros')
   AND k.contype IN ('p', 'u', 'f', 'c')
 ORDER BY c.relname, k.conname;

COMMIT;

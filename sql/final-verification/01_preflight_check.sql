-- =====================================================================
-- SalsaSegura Admin Dashboard — Final Verification (Phase 14)
-- READ-ONLY PREFLIGHT CHECK — run BEFORE applying any final SQL changes
-- =====================================================================
-- This script does NOT modify any data or schema. It only reads.
-- =====================================================================

-- === SalsaSegura Admin — Phase 14 Preflight Check ===

-- --- 1. Core tables present ---
SELECT tbl, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) AS exists
FROM (VALUES
  ('events'), ('event_submissions'), ('profiles'), ('audit_logs'),
  ('venues'), ('taxonomy_terms'), ('organizer_requests'),
  ('platform_settings'), ('taxonomy_term_events')
) AS v(tbl)
ORDER BY tbl;

-- --- 2. Admin RPC functions present ---
SELECT routine_name,
       EXISTS(
         SELECT 1 FROM information_schema.parameters p
         WHERE p.specific_schema = 'public'
           AND p.specific_name = r.specific_name
           AND p.ordinal_position = 1
       ) AS has_params
FROM information_schema.routines r
WHERE r.routine_schema = 'public'
  AND r.routine_name IN (
    'admin_audit_log', 'category_of',
    'admin_analytics_metrics', 'admin_analytics_timeseries',
    'admin_user_directory', 'admin_set_user_role', 'admin_set_user_status',
    'admin_invite_user',
    'is_moderator', 'account_is_active',
    'log_event_change', 'log_submission_change', 'log_user_change',
    'set_updated_at'
  )
ORDER BY routine_name;

-- --- 3. Audit log columns present ---
SELECT col, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name=col) AS exists
FROM (VALUES
  ('id'), ('actor_id'), ('action'), ('entity_type'), ('entity_id'),
  ('metadata'), ('created_at'), ('before_state'), ('after_state'),
  ('reason'), ('target_type'), ('target_id'), ('target_name')
) AS v(col)
ORDER BY col;

-- --- 4. Platform settings columns present ---
SELECT col, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_settings' AND column_name=col) AS exists
FROM (VALUES
  ('singleton'), ('platform_name'), ('public_site_url'), ('support_email'),
  ('default_city'), ('default_country_code'), ('default_timezone'),
  ('default_locale'), ('default_currency_code'),
  ('default_event_duration_minutes'), ('allow_public_event_suggestions'),
  ('allow_registered_user_submissions'), ('updated_by'), ('updated_at')
) AS v(col)
ORDER BY col;

-- --- 5. Analytics prerequisite columns ---
SELECT col, tbl, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name=col) AS exists
FROM (VALUES
  ('event_date', 'events'), ('status', 'events'), ('rsvp_link', 'events'),
  ('submitted_at', 'event_submissions'), ('created_at', 'event_submissions'),
  ('created_at', 'profiles')
) AS v(col, tbl)
ORDER BY tbl, col;

-- --- 6. NULL submitted_at count (determines if backfill needed) ---
SELECT count(*) AS null_submitted_at_count
FROM public.event_submissions
WHERE submitted_at IS NULL;

-- --- 7. RLS enabled on key tables ---
SELECT relname AS table_name,
       relrowsecurity AS rls_enabled,
       relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('events', 'event_submissions', 'profiles', 'audit_logs', 'venues')
ORDER BY relname;

-- --- 8. Current user role ---
SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'none') AS current_role;

-- --- 9. Admin functions granted to authenticated only ---
SELECT p.proname AS function_name,
       grantee_role.rolname AS grantee,
       'EXECUTE' AS privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN aclexplode(p.proacl) AS r(grantor_oid, grantee_oid, privileges, privileges_granted_by)
  ON true
LEFT JOIN pg_roles grantee_role ON grantee_role.oid = r.grantee_oid
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_audit_log', 'admin_analytics_metrics', 'admin_analytics_timeseries',
                     'admin_user_directory', 'admin_set_user_role', 'admin_set_user_status',
                     'admin_invite_user')
  AND grantee_role.rolname IN ('public', 'anon', 'authenticated')
ORDER BY p.proname, grantee_role.rolname;

-- --- 10. Trigger functions not exposed to public/anon ---
SELECT p.proname AS function_name, grantee_role.rolname AS grantee
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN aclexplode(p.proacl) AS r(grantor_oid, grantee_oid, privileges, privileges_granted_by)
  ON true
LEFT JOIN pg_roles grantee_role ON grantee_role.oid = r.grantee_oid
WHERE n.nspname = 'public'
  AND p.proname IN ('log_event_change', 'log_submission_change', 'log_user_change', 'set_updated_at')
  AND r.grantee_oid IN (
    (SELECT oid FROM pg_roles WHERE rolname = 'public'),
    (SELECT oid FROM pg_roles WHERE rolname = 'anon')
  )
ORDER BY p.proname;

-- Expected: no rows returned for trigger functions granted to public/anon

-- === Preflight Check Complete ===

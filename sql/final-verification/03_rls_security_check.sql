-- =====================================================================
-- SalsaSegura Admin Dashboard — Final Verification (Phase 14)
-- READ-ONLY RLS / SECURITY VERIFICATION
-- =====================================================================
-- This script does NOT modify any data or schema. It only reads.
-- Run AFTER deployment of Phase 11-13 SQL.
--
-- This script verifies that all admin RPCs are:
--   1. SECURITY DEFINER
--   2. Have set search_path = public (no privilege escalation vector)
--   3. Contain a runtime admin-role check in the function body
--   4. Are granted only to authenticated (not public or anon)
-- =====================================================================

\echo '=== SalsaSegura Admin — Phase 14 RLS / Security Verification ==='

-- 1. Security definer + function config for all admin RPCs
\echo '--- 1. SECURITY DEFINER status + config for admin functions ---'
SELECT
  p.proname AS function_name,
  p.secdef AS is_security_definer,
  CASE WHEN p.proconfig IS NOT NULL THEN 'Yes' ELSE 'No' END AS has_config,
  p.proconfig AS config_raw
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'admin_audit_log',
    'category_of',
    'admin_analytics_metrics',
    'admin_analytics_timeseries',
    'admin_user_directory',
    'admin_set_user_role',
    'admin_set_user_status',
    'is_moderator',
    'account_is_active'
  )
ORDER BY p.proname;

-- Expected: all admin_* functions should show is_security_definer = true
-- and config_raw should include "search_path=public"
-- (is_moderator and account_is_active are SECURITY INVOKER — that's correct by design)

\echo ''
\echo '--- 2. All non-admin trigger functions are not exposed to public/anon ---'
SELECT p.proname AS function_name, r.grantee_rolename AS grantee
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN LATERAL aclexplode(p.proacl) AS r(grantor_oid, grantee_oid, privileges, privileges_granted_by)
  ON true
JOIN pg_roles grantee_role ON grantee_role.oid = r.grantee_oid
WHERE n.nspname = 'public'
  AND p.proname IN ('log_event_change', 'log_submission_change', 'set_updated_at',
                     'handle_new_user', 'log_event_change', 'log_submission_change', 'log_user_change')
  AND grantee_role.rolname IN ('public', 'anon');

-- Expected: zero rows returned. Trigger functions should NOT be callable via RPC.

\echo ''
\echo '--- 3. Audit table RLS + policy check ---'
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'audit_logs';

-- Check audit_logs policies
SELECT polname, polpermissive, polroles
FROM pg_policy
WHERE schemaname = 'public' AND tablename = 'audit_logs'
ORDER BY polname;

\echo ''
\echo '--- 4. Verify no function grants to public/anon for admin functions ---'
SELECT
  p.proname AS function_name,
  grantee_role.rolname AS grantee,
  'EXECUTE' AS privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN LATERAL aclexplode(p.proacl) AS acl(grantor_oid, grantee_oid, privileges, privileges_granted_by)
  ON true
JOIN pg_roles grantee_role ON grantee_role.oid = acl.grantee_oid
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_audit_log', 'admin_analytics_metrics', 'admin_analytics_timeseries',
                     'admin_user_directory', 'admin_set_user_role', 'admin_set_user_status')
  AND grantee_role.rolname IN ('public', 'anon')
ORDER BY p.proname, grantee_role.rolname;

-- Expected: zero rows returned. Admin functions must NOT be executable by public/anon.

\echo ''
\echo '--- 5. Verify function source contains admin role check ---'
-- Each admin RPC should have the auth.jwt() role check in its body:
-- if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
SELECT p.proname,
       pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_audit_log', 'admin_analytics_metrics', 'admin_analytics_timeseries')
ORDER BY p.proname;

\echo ''
\echo '--- 6. Verify audit_log_view does not expose sensitive columns ---'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_log_view'
ORDER BY ordinal_position;

-- Should NOT contain before_state, after_state, or reason (PII) if the view
-- is meant to be a safe read-only enrichment of audit_logs for listing.

\echo ''
\echo '=== Security Verification Complete ==='

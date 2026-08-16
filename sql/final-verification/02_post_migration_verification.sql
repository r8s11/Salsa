-- =====================================================================
-- SalsaSegura Admin Dashboard — Final Verification (Phase 14)
-- READ-ONLY POST-MIGRATION VERIFICATION — run AFTER all SQL is applied
-- =====================================================================
-- This script does NOT modify any data or schema. It only reads.
-- All Phase 12 and Phase 13 SQL must already be deployed.
-- =====================================================================

\echo '=== SalsaSegura Admin — Phase 14 Post-Migration Verification ==='

\echo ''
\echo '--- 1. Audit log view + RPC exist ---'
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('admin_audit_log', 'category_of')
ORDER BY routine_name;

SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'audit_log_view';

\echo ''
\echo '--- 2. Analytics view + RPCs exist ---'
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('admin_analytics_metrics', 'admin_analytics_timeseries')
ORDER BY routine_name;

SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'v_analytics_event_counts';

\echo ''
\echo '--- 3. Analytics indexes exist ---'
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'events_event_date_status_idx',
    'event_submissions_submitted_at_idx',
    'profiles_created_at_idx'
  )
ORDER BY tablename, indexname;

\echo ''
\echo '--- 4. Analytics RPC grants (should NOT include public or anon) ---'
SELECT p.proname AS function_name,
       grantee_role.rolname AS grantee,
       'EXECUTE' AS privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN LATERAL aclexplode(p.proacl) AS r(grantor_oid, grantee_oid, privileges, privileges_granted_by)
  ON true
JOIN pg_roles grantee_role ON grantee_role.oid = r.grantee_oid
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_analytics_metrics', 'admin_analytics_timeseries')
ORDER BY p.proname, grantee_role.rolname;

\echo ''
\echo '--- 5. All RPCs are SECURITY DEFINER with set search_path = public ---'
SELECT p.proname,
       p.prosecdef AS security_definer,
       pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_audit_log', 'admin_analytics_metrics', 'admin_analytics_timeseries')
ORDER BY p.proname;

\echo ''
\echo '--- 6. Smoke-test analytics metrics RPC ---'
SELECT jsonb_pretty(
  public.admin_analytics_metrics(
    now() - interval '30 days',
    now()
  )
) AS metrics_json;

\echo ''
\echo '--- 7. Smoke-test analytics timeseries RPC ---'
SELECT jsonb_pretty(
  public.admin_analytics_timeseries(
    now() - interval '30 days',
    now(),
    'weekly'
  )
) AS series_json;

\echo ''
\echo '--- 8. Verify audit_logs has entries for sensitive actions ---'
SELECT action, count(*) AS cnt
FROM public.audit_logs
WHERE action IN ('user.banned', 'user.suspended', 'user.role_changed',
                 'submission.approved', 'submission.rejected',
                 'event.approved', 'event.rejected',
                 'platform_settings.access_policy_changed')
GROUP BY action
ORDER BY cnt DESC;

\echo ''
\echo '--- 9. Verify profiles.role column exists for RLS ---'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('role', 'status', 'status_reason')
ORDER BY column_name;

\echo ''
\echo '--- 10. Quick aggregate sanity checks ---'
SELECT 'events_approved_30d' AS metric, count(*) AS value
FROM events
WHERE status = 'approved' AND event_date >= now() - interval '30 days'
UNION ALL
SELECT 'new_users_30d', count(*)
FROM profiles
WHERE created_at >= now() - interval '30 days'
UNION ALL
SELECT 'submissions_30d', count(*)
FROM event_submissions
WHERE submitted_at >= now() - interval '30 days'
UNION ALL
SELECT 'rsvps_30d', count(*)
FROM events
WHERE status = 'approved' AND rsvp_link IS NOT NULL AND rsvp_link <> ''
  AND event_date >= now() - interval '30 days';

\echo ''
\echo '=== Post-Migration Verification Complete ==='

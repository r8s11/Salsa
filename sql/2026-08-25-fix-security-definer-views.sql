-- =====================================================================
-- Fix: Supabase linter 0010_security_definer_view (2 ERROR findings)
--
--   public.audit_log_view
--   public.v_analytics_event_counts
--
-- Run in the Supabase SQL Editor (production project).
--
-- WHAT THE LINTER MEANS
-- A Postgres view runs with the privileges of its OWNER unless it is
-- created with `security_invoker = on` (PG15+). These views are owned by
-- `postgres`, so any query against them bypasses Row Level Security on the
-- underlying tables and returns rows the caller could never select directly.
--
-- WHY audit_log_view IS THE URGENT ONE
-- 20260818000000_phase12_audit_view_and_rpc.sql grants it to `authenticated`:
--
--     revoke select on public.audit_log_view from public, anon;
--     grant  select on public.audit_log_view to authenticated;
--
-- Combined with owner-privilege execution, EVERY SIGNED-IN USER can read the
-- entire audit log — before_state, after_state, reason, plus each actor's
-- display_name / username / avatar_url from profiles. Revoking `anon` only
-- stopped logged-out visitors. The real admin gate lives in the
-- admin_audit_log() RPC; this grant let a client bypass that RPC completely.
--
-- v_analytics_event_counts was never granted to anon/authenticated, so it is
-- only readable by the owner and exposes aggregate counts with no PII. It is
-- hardened here for correctness, not because it is currently reachable.
--
-- SAFE FOR THE APP: nothing in src/ reads either view. The Activity UI calls
-- admin_audit_log / admin_audit_log_detail and the Analytics UI calls
-- admin_analytics_metrics / admin_analytics_timeseries — all SECURITY DEFINER
-- RPCs that keep their own admin-role gate and keep working unchanged.
--
-- Idempotent: re-running changes nothing. No table, view, or row is dropped.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Make both views run as the CALLER, so the underlying tables' RLS
--    applies. This is what clears the linter finding.
-- ---------------------------------------------------------------------
alter view public.audit_log_view            set (security_invoker = on);
alter view public.v_analytics_event_counts  set (security_invoker = on);

-- ---------------------------------------------------------------------
-- 2. Remove the grant that made the audit log broadly readable.
--
--    The admin Activity UI does NOT need this grant — it goes through the
--    admin_audit_log() / admin_audit_log_detail() RPCs, which are
--    SECURITY DEFINER and gate on the admin role internally.
--
--    With security_invoker = on the grant would already be far less
--    dangerous (audit_logs RLS would apply), but the view has no reason to
--    be client-reachable at all: least privilege.
-- ---------------------------------------------------------------------
revoke select on public.audit_log_view           from anon, authenticated;
revoke select on public.v_analytics_event_counts from anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- =====================================================================
-- Verification — run separately
-- =====================================================================

-- 2a. Both views should now report security_invoker=true.
--     Expect exactly 2 rows, each with invoker_on = true.
-- select
--   c.relname                                as view_name,
--   'security_invoker=true' = any(c.reloptions) as invoker_on,
--   c.reloptions
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relkind = 'v'
--   and c.relname in ('audit_log_view', 'v_analytics_event_counts');

-- 2b. No client role should hold SELECT on either view.
--     Expect ZERO rows.
-- select table_name, grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in ('audit_log_view', 'v_analytics_event_counts')
--   and grantee in ('anon', 'authenticated');

-- 2c. The RPCs the admin UI actually uses must still exist.
--     Expect 4 rows.
-- select routine_name, security_type
-- from information_schema.routines
-- where routine_schema = 'public'
--   and routine_name in (
--     'admin_audit_log', 'admin_audit_log_detail',
--     'admin_analytics_metrics', 'admin_analytics_timeseries'
--   );

-- =====================================================================
-- After applying: re-run the Supabase linter. Both
-- 0010_security_definer_view findings should be gone.
--
-- Then smoke-test as an admin in the app:
--   /admin/activity   — list + a detail page still load
--   /admin/analytics  — metric cards + charts still load
-- Both go through the RPCs, so they are expected to be unaffected.
-- =====================================================================

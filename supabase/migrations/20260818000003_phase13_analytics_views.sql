-- Phase 13 — analytics views backing the admin analytics RPCs.
-- REQUIRED after 001_create_analytics_views.sql and the baseline schema.
-- Non-destructive: views only.
--
-- These views are internal helpers for the RPCs in 002. The admin
-- page never queries them directly — it calls the RPCs, which
-- return JSON.

-- ============================================================
-- 1. v_analytics_event_counts (parameterized by date range at RPC level)
--    The RPC admin_analytics_metrics() does the real parameterized work.
--    This view is a convenience for ad-hoc SQL inspection.
-- ============================================================

create or replace view v_analytics_event_counts as
select
  count(*) filter (where status = 'approved')         as approved_count,
  count(*) filter (where status = 'pending')          as pending_count,
  count(*) filter (where status = 'rejected')         as rejected_count,
  count(*) filter (where rsvp_link is not null)       as rsvp_count,
  count(*)                                            as total_count
from events
where event_date >= current_date - interval '30 days'
  and event_date <  current_date + interval '1 day';

-- security_invoker: without it the view runs as its owner and bypasses RLS on
-- events. Flagged as ERROR by the Supabase linter
-- (0010_security_definer_view). No client role is granted SELECT — the admin
-- Analytics UI reads admin_analytics_metrics() / admin_analytics_timeseries(),
-- which are SECURITY DEFINER and admin-gated internally.
alter view public.v_analytics_event_counts set (security_invoker = on);
revoke select on public.v_analytics_event_counts from public, anon, authenticated;

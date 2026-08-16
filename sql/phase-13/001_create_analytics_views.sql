-- Phase 13 — analytics views backing the admin analytics RPCs.
-- REQUIRED after the baseline schema (20260101000000) — reads
-- events, event_submissions, profiles. Non-destructive: views only.
--
-- These views are internal helpers for the RPCs in 002. The admin
-- page never queries them directly — it calls the RPCs, which
-- return JSON.

-- ============================================================
-- 1. v_analytics_event_counts (parameterized by date range at RPC level)
-- ============================================================
-- The RPC admin_analytics_metrics() does the real parameterized work.
-- This view is a convenience for ad-hoc SQL inspection.
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

-- Phase 13 — optional backfill of submitted_at from created_at.
-- OPTIONAL. REVIEW BEFORE RUNNING. This UPDATEs existing event_submissions rows.
--
-- WHY: The analytics metrics RPC filters event_submissions by submitted_at.
-- If any rows have submitted_at = NULL (possible for very early import paths),
-- they would be excluded from submission counts and trend charts.
-- Backfill them from created_at to ensure complete historical data.

-- Safety: only backfill NULL submitted_at values; never overwrite existing timestamps.
update public.event_submissions
   set submitted_at = created_at
 where submitted_at is null;

-- Verify: any remaining NULLs?
-- select count(*) from event_submissions where submitted_at is null;
-- Should return 0 after this runs.

-- Phase 13 — indexes to support analytics query performance.
-- REQUIRED after 001 and 002. Additive only: creates indexes if they
-- do not already exist. Non-blocking on PostgreSQL.

-- Events date + status — supports publshed-events count and trend charts.
create index if not exists events_event_date_status_idx
  on public.events (event_date, status);

-- Event submissions date — supports submission funnel metrics and chart.
create index if not exists event_submissions_submitted_at_idx
  on public.event_submissions (submitted_at);

-- Profiles creation date — supports new-user growth metrics.
create index if not exists profiles_created_at_idx
  on public.profiles (created_at);

-- RSVP link is not-null check — covered by the events index above,
-- but this helps ad-hoc filtering.
-- (No separate index needed — rsvp_link is low-cardinality text.)

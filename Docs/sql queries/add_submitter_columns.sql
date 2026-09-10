-- Add submitter_name + submitter_email columns to public.events.
-- Both are written by SubmitEventPage and scripts/import-ics.mjs but were
-- never added to the original table definition in events.sql.
-- Idempotent — safe to re-run.

alter table public.events
  add column if not exists submitter_name text;

alter table public.events
  add column if not exists submitter_email text;

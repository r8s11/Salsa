-- Moderator CSV Event Import — batch audit trail.
-- MANUAL REVIEW REQUIRED before running against production.
--
-- Per-event audit already happens automatically via the existing
-- events_audit_log trigger (log_event_change(), 20260813000100_audit_logs.sql)
-- — every event created by an import gets its own audit_logs row with the
-- real importing user's id (auth.uid() reflects the actual caller even
-- though this feature uses a plain client-side insert, not a SECURITY
-- DEFINER RPC).
--
-- What per-row audit_logs rows *can't* capture: batch-level facts about
-- rows that never became events (skipped duplicates, failed validation) —
-- those never fire the trigger. This table is the minimal addition to
-- answer "who imported this CSV, when, from what file, and what happened
-- to all 28 rows" as a single summary, without storing the raw file.
--
-- Additive only: new table, does not touch any existing table.

create table public.event_import_batches (
  id                      uuid primary key default gen_random_uuid(),
  imported_by             uuid references auth.users(id),
  filename                text not null,
  total_rows              integer not null,
  created_count           integer not null,
  duplicate_skipped_count integer not null,
  failed_count            integer not null,
  created_at              timestamptz not null default now()
);

create index event_import_batches_created_at_idx
  on public.event_import_batches (created_at desc);

create index event_import_batches_imported_by_idx
  on public.event_import_batches (imported_by);

alter table public.event_import_batches enable row level security;

-- Grants sit below policies — without grant select/insert, RLS is never evaluated.
grant select, insert on public.event_import_batches to authenticated;

-- Admins see every batch; moderators see only their own imports.
create policy "Admins read all import batches"
  on public.event_import_batches
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Moderators read own import batches"
  on public.event_import_batches
  for select
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'moderator'
    and imported_by = auth.uid()
  );

-- Insert is gated to admin/moderator and to the caller's own id — matches
-- the same role set granted event-insert access by
-- moderator_csv_import_permissions.sql, and prevents a client from writing
-- a fabricated importer id.
create policy "Admins and moderators insert own import batch"
  on public.event_import_batches
  for insert
  to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator')
    and imported_by = auth.uid()
  );

-- Rollback:
--   drop table public.event_import_batches;

-- =====================================================================
-- Flyer Automation — Phase 1 — Preflight (READ-ONLY)
-- Run BEFORE 002_update_submission_approval_image.sql to confirm the
-- production state matches assumptions.
-- Safe: contains only SELECT statements. No writes.
-- =====================================================================

-- 1. Storage bucket exists, is public, has the right limit + mime types?
select
  id,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'event-flyers';
-- Expect: 1 row, public = true, file_size_limit = 5242880,
-- allowed_mime_types contains image/jpeg, image/png, image/webp.

-- 2. Does event_submissions carry an image_url column today?
select
  count(*) as has_image_url_column
from information_schema.columns
where table_schema = 'public'
  and table_name = 'event_submissions'
  and column_name = 'image_url';
-- Expect: 0  (Phase 1 persists the flyer URL inside submitted_data JSONB
-- instead, so no column is required for the public submit flow yet).

-- 3. Does the canonical events table expose image_url?
select
  count(*) as events_has_image_url
from information_schema.columns
where table_schema = 'public'
  and table_name = 'events'
  and column_name = 'image_url';
-- Expect: 1  (the approval RPC must copy the flyer into this column).

-- 4. What does the approval RPC currently copy into events?
select pg_get_functiondef(oid) as approve_fn
from pg_proc
where proname = 'approve_event_submission';
-- Expect: the INSERT into events does NOT reference image_url.
-- 002_update_submission_approval_image.sql adds the carry-through.

-- 5. Storage policies present and owner-scoped? (bucket_id is not a
--    pg_policies column; the policy set is read via qual/withcheck.)
select
  policyname,
  cmd,
  qual::text as using_expr
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname ilike '%event flyer%';
-- Expect: ALL(admin) / INSERT(owner) / UPDATE(owner) / DELETE(owner) /
-- SELECT(public). No storage-policy change required — this matches the audit
-- in 002_update_submission_approval_image.sql.

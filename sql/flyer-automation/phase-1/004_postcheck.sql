-- =====================================================================
-- Flyer Automation — Phase 1 — Postcheck (READ-ONLY)
-- Run AFTER 002_update_submission_approval_image.sql. Confirms the
-- carry-through is wired and storage authorization is owner-scoped.
-- Safe: SELECT-only.
-- =====================================================================

-- 1. Approval RPC now copies image_url?
select pg_get_functiondef(oid) as approve_fn
from pg_proc
where proname = 'approve_event_submission';
-- Expect: the events INSERT includes image_url and nullif(d->>'image_url','').

-- 2. Storage policies present and correct? (bucket_id is not a pg_policies
--    column; the per-bucket policy set is read via the qual/withcheck below.)
select policyname, cmd, qual::text as using_expr
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname ilike '%event flyer%'
order by cmd;
-- Expect: the policy set listed in 002's audit note:
--   ALL(admin), INSERT(owner), UPDATE(owner), DELETE(owner), SELECT(public).
--   No storage-policy change is required: these already exist in production.

-- 3. Confirm no cross-user delete/select grant exists (owner-only).
select count(*) as broad_policies
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname ilike '%event flyer%'
  and cmd in ('DELETE','SELECT')
  and qual::text not ilike '%auth.uid()%';
-- Expect: 0. (The public SELECT policy is intentional: the bucket is public
-- and public URL rendering is what the calendar uses.)

-- 4. Events still expose image_url for the canonical render path.
select count(*) as events_image_url_present
from information_schema.columns
where table_schema = 'public' and table_name = 'events' and column_name = 'image_url';
-- Expect: 1.
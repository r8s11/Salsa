# Phase 1 Flyer Storage — SQL Preflight

Purpose: Confirm bucket / RLS exists; document the existing infrastructure.
Required / Optional: Required (audit only — no changes to SQL needed for Phase 1).
Execution order: Before any Phase 1 upload testing.
Tables / buckets affected: storage.buckets (event-flyers), storage.objects policies.
Data impact: None — audit / verify only.
Security impact: Confirm policy 001-004 from sql/2026-08-21_event_flyers_storage.sql active.
Rollback considerations: None (no mutations).

Status: SQL NOT EXECUTED. Existing file sql/2026-08-21_event_flyers_storage.sql already defines:
- bucket event-flyers (public, 5MB, jpeg/png/webp)
- SELECT (public read), INSERT (owner), UPDATE (owner path-1 = auth.uid()), DELETE (owner path-1)
- Admin policy on app_metadata.role = admin

Phase 1 doesn't require new SQL — uses existing bucket + existing event_submissions/submitted_data + events.image_url.

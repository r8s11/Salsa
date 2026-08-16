-- Phase 12 — supporting indexes for the admin Activity UI.
-- REQUIRED after 20260813000100_audit_logs.sql.
-- Additive only: creates indexes that did not previously exist.

-- Already exists from 20260813000100:
--   create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- -----------------------------------------------------------------
-- Additional indexes for Activity-page query patterns
-- -----------------------------------------------------------------

-- Filter by entity_type + entity_id (target lookup, "View History for…" features)
create index if not exists audit_logs_entity_type_id_idx
  on public.audit_logs (entity_type, entity_id)
  where entity_id is not null;

-- Filter by actor_id (User History, "Actions by…")
create index if not exists audit_logs_actor_id_created_idx
  on public.audit_logs (actor_id, created_at desc)
  where actor_id is not null;

-- Filter by action (Security preset, action filter drawer)
create index if not exists audit_logs_action_idx
  on public.audit_logs (action);

-- Deterministic ordering tie-break (created_at DESC, id DESC)
create index if not exists audit_logs_created_at_id_idx
  on public.audit_logs (created_at desc, id desc);

-- GIN index on metadata for the search-as-text fallback in the RPC
create index if not exists audit_logs_metadata_gin
  on public.audit_logs using gin (metadata);

-- Phase 12 — constraints for audit_logs data integrity.
-- REQUIRED after 20260813000100_audit_logs.sql and 002.
-- Additive only: tightens an existing table without removing data.

-- -----------------------------------------------------------------
-- 1. Enforce non-null action — every audit row must carry an action key.
--    (The existing trigger functions always insert one, but this prevents
--     accidental direct INSERTs from producing blank-action rows.)
-- -----------------------------------------------------------------
alter table public.audit_logs
  alter column action set not null,
  alter column entity_type set not null;

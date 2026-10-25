-- Phase 12 — constraints for audit_logs data integrity.
-- REQUIRED after 20260813000100_audit_logs.sql and 002.
-- Additive only: tightens an existing table without removing data.
--
-- The columns `before_state`, `after_state`, `reason`, `target_type`,
-- `target_id`, `target_name` were added in migration
-- 20260818000000_phase12_audit_view_and_rpc.sql as nullable.
-- Here we add only CHECK constraints that are safe for existing data.

-- -----------------------------------------------------------------
-- 1. target_type must be one of the known entity types when set.
--    Allows NULL (not all audit entries have a target).
--    PostgreSQL does not support IF NOT EXISTS on ADD CONSTRAINT,
--    so we guard with a DO block.
-- -----------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_target_type_check'
  ) then
    alter table public.audit_logs
      add constraint audit_logs_target_type_check
      check (target_type is null or target_type in (
        'event', 'event_submission', 'profile', 'organizer',
        'venue', 'taxonomy_term', 'platform_settings'
      ));
  end if;
end;
$$;

-- -----------------------------------------------------------------
-- 2. action and entity_type are NOT NULL (enforce at the table level
--    in addition to the trigger guarantees). These are already NOT NULL
--    from the base migration, but set NOT NULL explicitly for safety
--    in case of direct INSERTs. Using SET NOT NULL is idempotent.
-- -----------------------------------------------------------------

alter table public.audit_logs
  alter column action set not null,
  alter column entity_type set not null;

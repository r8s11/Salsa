-- Read-only diagnostic — no inserts/updates/deletes/DDL. Safe to run against
-- production. Run in Supabase Studio SQL Editor (hosted project) and share
-- the single result row back so the actual reconciliation script can be
-- written from real state instead of guesswork.
--
-- Checks whether the Phase 2 (profiles/audit_logs) and Phase 3
-- (events_management_fields) migrations were ever applied to this database.

select
  (select exists (select 1 from information_schema.tables
     where table_schema='public' and table_name='profiles'))        as profiles_table_exists,
  (select exists (select 1 from information_schema.tables
     where table_schema='public' and table_name='audit_logs'))      as audit_logs_table_exists,
  (select exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='set_updated_at'))      as set_updated_at_fn_exists,
  (select exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
     where c.relname='profiles' and t.tgname='profiles_set_updated_at'
       and not t.tgisinternal))                                     as profiles_trigger_exists,
  (select exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
     where c.relname='events' and t.tgname='events_set_updated_at'
       and not t.tgisinternal))                                     as events_trigger_exists,
  (select exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='events' and column_name='source_type')) as events_source_type_exists,
  (select exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='profiles' and column_name='username'))  as profiles_username_exists;

-- salsa_dev_readonly — production read-only role for development analysis.
--
-- THIS IS NOT A MIGRATION. It lives outside supabase/migrations so `supabase
-- db push` never applies it. A production owner runs it once, by hand:
--
--   psql "$PRODUCTION_OWNER_DATABASE_URL" \
--     -v readonly_password="$(openssl rand -base64 32)" \
--     -f supabase/ops/salsa_dev_readonly_role.sql
--
-- then stores the resulting connection string ONLY in a worktree's local
-- environment (never committed, never bundled into browser code):
--
--   SUPABASE_DEV_READONLY_DATABASE_URL=postgresql://salsa_dev_readonly.<project-ref>:<password>@<pooler-host>:5432/postgres
--
-- Scope: SELECT on the anonymous-safe projections only. No raw events or
-- profiles, no SELECT ON ALL TABLES, no pg_read_all_data.

\set ON_ERROR_STOP on

begin;

create role salsa_dev_readonly
  with login
       nosuperuser
       nocreatedb
       nocreaterole
       noinherit
       noreplication
       nobypassrls
       connection limit 3
       password :'readonly_password';

-- Every session starts read-only and short-lived. This is a default the
-- client could override, so the privilege grants below are the real fence.
alter role salsa_dev_readonly set default_transaction_read_only = on;
alter role salsa_dev_readonly set statement_timeout = '30s';
alter role salsa_dev_readonly set idle_in_transaction_session_timeout = '60s';

-- Name resolution in public, nothing else. No CREATE on the schema or the
-- database, so no DDL and no temp-table staging.
revoke create on schema public from salsa_dev_readonly;
revoke all on database postgres from salsa_dev_readonly;
grant connect on database postgres to salsa_dev_readonly;
grant usage on schema public to salsa_dev_readonly;

-- The approved projections. public_events and public_profiles are owner-run
-- views that already withhold submitter contact data and unpublished rows.
grant select on table public.public_events to salsa_dev_readonly;
grant select on table public.public_profiles to salsa_dev_readonly;

-- Uncomment only after 20260925000000_dynamic_metros.sql is applied to
-- production under separate authorization.
-- grant select on table public.metros to salsa_dev_readonly;
-- grant select on table public.public_active_metros to salsa_dev_readonly;

commit;

-- Verification (run as the owner right after provisioning). Every row of the
-- first query must be false; the second lists the only relations readable.
select c.relname,
       has_table_privilege('salsa_dev_readonly', c.oid, 'INSERT')   as can_insert,
       has_table_privilege('salsa_dev_readonly', c.oid, 'UPDATE')   as can_update,
       has_table_privilege('salsa_dev_readonly', c.oid, 'DELETE')   as can_delete,
       has_table_privilege('salsa_dev_readonly', c.oid, 'TRUNCATE') as can_truncate
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth', 'storage')
  and c.relkind in ('r', 'v', 'm', 'p')
  and (has_table_privilege('salsa_dev_readonly', c.oid, 'INSERT')
    or has_table_privilege('salsa_dev_readonly', c.oid, 'UPDATE')
    or has_table_privilege('salsa_dev_readonly', c.oid, 'DELETE')
    or has_table_privilege('salsa_dev_readonly', c.oid, 'TRUNCATE'));

select n.nspname, c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth', 'storage')
  and c.relkind in ('r', 'v', 'm', 'p')
  and has_table_privilege('salsa_dev_readonly', c.oid, 'SELECT')
order by 1, 2;

select rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolinherit
from pg_roles
where rolname = 'salsa_dev_readonly';

-- Residual risk to review: functions still EXECUTE-able through the PUBLIC
-- pseudo-role. Security-definer entries here should each refuse a caller
-- with no auth.uid(); revoke from public any that do not.
select p.oid::regprocedure as function, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('salsa_dev_readonly', p.oid, 'EXECUTE')
  and p.prosecdef
order by 1;

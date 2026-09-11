-- =====================================================================
-- Phase 2 — Audit View + Venue Authorization verification script
--
-- NOT part of any deploy. Run manually against a disposable/local Supabase
-- instance AFTER applying
-- supabase/migrations/20260910000000_release_security_audit_view_venues.sql.
--
-- It proves, at the database layer (real Postgres role switches + faked
-- JWT claims, not application code, not service role):
--   1. public.audit_log_view has security_invoker=on.
--   2. Neither anon, authenticated (regular), authenticated (moderator),
--      nor authenticated (admin) can SELECT public.audit_log_view directly
--      — access exists only through admin_audit_log()/admin_audit_log_detail().
--   3. admin_audit_log() still succeeds for an admin caller and still
--      raises for a moderator caller (moderator != admin for audit access).
--   4. public.venues SELECT/INSERT/UPDATE/DELETE:
--        anon        -> denied (no grant + RLS)
--        regular     -> denied (RLS filters all rows; INSERT rejected)
--        moderator   -> denied (RLS filters all rows; INSERT rejected —
--                       this is the SEC-06 regression proof)
--        admin       -> allowed for all four operations
--
-- Runs entirely inside one transaction and rolls back at the end: no
-- fixture row or grant/role change survives the script.
-- =====================================================================

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_venue_id uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_count    int;
  v_caught   boolean;
  v_invoker  boolean;
begin
  select 'security_invoker=on' = any(c.reloptions)
    into v_invoker
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'audit_log_view';
  assert coalesce(v_invoker, false), 'FAIL: audit_log_view must have security_invoker=on';

  select count(*) into v_count
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name = 'audit_log_view'
     and privilege_type = 'SELECT'
     and grantee in ('anon', 'authenticated', 'public');
  assert v_count = 0, 'FAIL: audit_log_view must have zero client-role SELECT grants';


  select count(*) into v_count
    from pg_policies
   where schemaname = 'public' and tablename = 'venues'
     and policyname in ('Anyone can read venues', 'Staff manage venues',
                         'Admins manage venues', 'Venues are viewable by authenticated users');
  assert v_count = 0, 'FAIL: legacy/duplicate venue policies must not exist';

  select count(*) into v_count
    from pg_policies
   where schemaname = 'public' and tablename = 'venues'
     and policyname in ('Admins read venues', 'Admins can insert venues',
                         'Admins can update venues', 'Admins can delete venues');
  assert v_count = 4, 'FAIL: all four canonical admin-only venue policies must exist';

  -- ---------- fixture (idempotent) ----------
  delete from public.venues where id = v_venue_id;
  insert into public.venues (id, name, country, status)
  values (v_venue_id, 'Phase2 Verification Venue', 'US', 'active');

  -- ---------- 1. anon ----------
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  v_caught := false;
  begin
    perform 1 from public.audit_log_view limit 1;
  exception when insufficient_privilege then v_caught := true;
  end;
  assert v_caught, 'FAIL: anon direct SELECT on audit_log_view must be denied';

  v_caught := false;
  begin
    perform 1 from public.venues limit 1;
  exception when insufficient_privilege then v_caught := true;
  end;
  assert v_caught, 'FAIL: anon direct SELECT on venues must be denied';

  v_caught := false;
  begin
    insert into public.venues (name, country, status) values ('Anon Hijack', 'US', 'active');
  exception when insufficient_privilege then v_caught := true;
  end;
  assert v_caught, 'FAIL: anon INSERT on venues must be denied';

  -- ---------- 2. authenticated regular user ----------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    jsonb_build_object('role', 'authenticated',
                       'app_metadata', jsonb_build_object('role', 'user'))::text, true);

  v_caught := false;
  begin
    perform 1 from public.audit_log_view limit 1;
  exception when insufficient_privilege then v_caught := true;
  end;
  assert v_caught, 'FAIL: regular authenticated direct SELECT on audit_log_view must be denied';

  select count(*) into v_count from public.venues where id = v_venue_id;
  assert v_count = 0, 'FAIL: regular authenticated must not see venues via RLS';

  v_caught := false;
  begin
    insert into public.venues (name, country, status) values ('Regular Hijack', 'US', 'active');
  exception when insufficient_privilege then v_caught := true;
  end;
  assert v_caught, 'FAIL: regular authenticated INSERT on venues must be rejected by RLS';

  update public.venues set name = 'Regular Update Attempt' where id = v_venue_id;
  get diagnostics v_count = row_count;
  assert v_count = 0, 'FAIL: regular authenticated UPDATE must affect zero rows';

  delete from public.venues where id = v_venue_id;
  get diagnostics v_count = row_count;
  assert v_count = 0, 'FAIL: regular authenticated DELETE must affect zero rows';

  -- ---------- 3. authenticated moderator ----------
  perform set_config('request.jwt.claims',
    jsonb_build_object('role', 'authenticated',
                       'app_metadata', jsonb_build_object('role', 'moderator'))::text, true);

  v_caught := false;
  begin
    perform 1 from public.audit_log_view limit 1;
  exception when insufficient_privilege then v_caught := true;
  end;
  assert v_caught, 'FAIL: moderator direct SELECT on audit_log_view must be denied (no elevated access merely by being authenticated)';

  select count(*) into v_count from public.venues where id = v_venue_id;
  assert v_count = 0, 'FAIL: moderator must not see venues via RLS';

  v_caught := false;
  begin
    insert into public.venues (name, country, status) values ('Moderator Hijack', 'US', 'active');
  exception when insufficient_privilege then v_caught := true;
  end;
  assert v_caught, 'FAIL (SEC-06 regression): moderator INSERT on venues must be rejected';

  update public.venues set name = 'Moderator Update Attempt' where id = v_venue_id;
  get diagnostics v_count = row_count;
  assert v_count = 0, 'FAIL (SEC-06 regression): moderator UPDATE on venues must affect zero rows';

  delete from public.venues where id = v_venue_id;
  get diagnostics v_count = row_count;
  assert v_count = 0, 'FAIL (SEC-06 regression): moderator DELETE on venues must affect zero rows';

  v_caught := false;
  begin
    perform public.admin_audit_log();
  exception when insufficient_privilege then v_caught := true;
  end;
  assert v_caught, 'FAIL: moderator calling admin_audit_log() must be rejected (admin-only, not moderator)';

  -- ---------- 4. authenticated admin ----------
  perform set_config('request.jwt.claims',
    jsonb_build_object('role', 'authenticated',
                       'app_metadata', jsonb_build_object('role', 'admin'))::text, true);

  v_caught := false;
  begin
    perform 1 from public.audit_log_view limit 1;
  exception when insufficient_privilege then v_caught := true;
  end;
  assert v_caught, 'FAIL: admin direct SELECT on audit_log_view must also be denied — the intended path is the RPC';

  perform public.admin_audit_log();
  -- no exception: admin_audit_log() must still succeed for an admin caller

  select count(*) into v_count from public.venues where id = v_venue_id;
  assert v_count = 1, 'FAIL: admin must see venues via RLS';

  insert into public.venues (name, country, status) values ('Admin Insert', 'US', 'active');
  get diagnostics v_count = row_count;
  assert v_count = 1, 'FAIL: admin INSERT on venues must succeed';

  update public.venues set name = 'Admin Update' where id = v_venue_id;
  get diagnostics v_count = row_count;
  assert v_count = 1, 'FAIL: admin UPDATE on venues must succeed';

  delete from public.venues where id = v_venue_id;
  get diagnostics v_count = row_count;
  assert v_count = 1, 'FAIL: admin DELETE on venues must succeed';

  raise notice 'PHASE 2 VERIFICATION PASSED';

end;
$$;

rollback;

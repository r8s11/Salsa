-- =====================================================================
-- Phase 6 — Host Organizer Access verification script
--
-- NOT part of any deploy. Run manually as postgres against a local
-- Supabase instance (or a production copy) AFTER applying
-- supabase/migrations/20260830000000_phase6_host_organizer_access.sql.
--
-- It proves, at the database layer, that:
--   1. an active member sees their organizer and its events (any status);
--   2. a non-member / removed member sees neither;
--   3. organizer_update_event permits owner/manager on own-organizer events;
--   4. organizer_update_event denies cross-organizer, editor, anonymous,
--      and any attempt to touch status/ownership/submitter fields;
--   5. admin/moderator behavior is unchanged.
--
-- The script raises an exception on the first failed assertion and
-- cleans up its fixture rows at the end. Re-runnable.
-- =====================================================================

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_user_a   uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b   uuid := '22222222-2222-2222-2222-222222222222';
  v_user_ed  uuid := '33333333-3333-3333-3333-333333333333';
  v_org_a    uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_org_b    uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_evt_a1   uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_evt_b1   uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_count    int;
begin
  -- ---------- fixture (idempotent) ----------
  delete from public.audit_logs
   where entity_id in (v_evt_a1, v_evt_b1)
      or actor_id in (v_user_a, v_user_b, v_user_ed);
  delete from public.events where id in (v_evt_a1, v_evt_b1);
  delete from public.organizer_members where organizer_id in (v_org_a, v_org_b);
  delete from public.organizers where id in (v_org_a, v_org_b);
  delete from public.profiles where id in (v_user_a, v_user_b, v_user_ed);
  delete from auth.users where id in (v_user_a, v_user_b, v_user_ed);

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data)
  values
    (v_user_a, 'phase6-a@test.local', crypt('x', gen_salt('bf')), now(), '{"role":"organizer"}'),
    (v_user_b, 'phase6-b@test.local', crypt('x', gen_salt('bf')), now(), '{"role":"user"}'),
    (v_user_ed, 'phase6-ed@test.local', crypt('x', gen_salt('bf')), now(), '{"role":"organizer"}');

  insert into public.profiles (id, display_name, role, status)
  values
    (v_user_a, 'Phase Six A', 'organizer', 'active'),
    (v_user_b, 'Phase Six B', 'user', 'active'),
    (v_user_ed, 'Phase Six Editor', 'organizer', 'active')
  on conflict (id) do update
    set display_name = excluded.display_name,
        role = excluded.role,
        status = excluded.status;

  insert into public.organizers (id, name, status) values
    (v_org_a, 'Phase6 Organizer A', 'active'),
    (v_org_b, 'Phase6 Organizer B', 'active');

  insert into public.organizer_members (organizer_id, user_id, member_role, status) values
    (v_org_a, v_user_a, 'owner', 'active'),
    (v_org_a, v_user_ed, 'editor', 'active'),
    (v_org_b, v_user_a, 'manager', 'removed');

  insert into public.events (id, title, event_type, city, event_date, status, source_type, organizer_id)
  values
    (v_evt_a1, 'Phase6 A Draft', 'social', 'boston', now() + interval '1 day', 'draft', 'organizer', v_org_a),
    (v_evt_b1, 'Phase6 B Draft', 'social', 'boston', now() + interval '1 day', 'draft', 'organizer', v_org_b);

  -- ---------- 1+2. read visibility per membership ----------
  -- Superuser bypasses RLS; drop to the authenticated role so policies apply.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user_a, 'role', 'authenticated',
                       'app_metadata', jsonb_build_object('role', 'organizer'))::text, true);

  select count(*) into v_count from public.organizer_members where organizer_id = v_org_a;
  assert v_count = 1, 'FAIL: active member must see own membership';

  select count(*) into v_count from public.organizers where id = v_org_a;
  assert v_count = 1, 'FAIL: active member must read managed organizer';

  select count(*) into v_count from public.events where id = v_evt_a1;
  assert v_count = 1, 'FAIL: member must read own-organizer draft event';

  select count(*) into v_count from public.events where id = v_evt_b1;
  assert v_count = 0, 'FAIL: removed membership must not read other organizer event';

  -- editor also reads
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user_ed, 'role', 'authenticated',
                       'app_metadata', jsonb_build_object('role', 'organizer'))::text, true);
  select count(*) into v_count from public.events where id = v_evt_a1;
  assert v_count = 1, 'FAIL: editor must read own-organizer events';

  -- plain user sees nothing organizer-scoped
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user_b, 'role', 'authenticated',
                       'app_metadata', jsonb_build_object('role', 'user'))::text, true);
  select count(*) into v_count from public.organizer_members;
  assert v_count = 0, 'FAIL: non-member must see no memberships';
  select count(*) into v_count from public.organizers where id in (v_org_a, v_org_b);
  assert v_count = 0, 'FAIL: non-member must not read organizers';
  select count(*) into v_count from public.events where id = v_evt_a1;
  assert v_count = 0, 'FAIL: non-member must not read draft organizer event';

  -- ---------- 3+4. mutation seam ----------
  -- owner updates own-organizer event
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user_a, 'role', 'authenticated',
                       'app_metadata', jsonb_build_object('role', 'organizer'))::text, true);
  perform public.organizer_update_event(v_evt_a1, jsonb_build_object('title', 'Phase6 A Renamed'));
  select count(*) into v_count from public.events where id = v_evt_a1 and title = 'Phase6 A Renamed';
  assert v_count = 1, 'FAIL: owner update must apply';

  -- cross-organizer denied
  begin
    perform public.organizer_update_event(v_evt_b1, jsonb_build_object('title', 'hijack'));
    raise exception 'FAIL: cross-organizer update must raise';
  exception when insufficient_privilege then null;
  end;

  -- editor denied mutation
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user_ed, 'role', 'authenticated',
                       'app_metadata', jsonb_build_object('role', 'organizer'))::text, true);
  begin
    perform public.organizer_update_event(v_evt_a1, jsonb_build_object('title', 'editor hijack'));
    raise exception 'FAIL: editor update must raise';
  exception when insufficient_privilege then null;
  end;

  -- status / ownership / submitter fields denied for owner
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user_a, 'role', 'authenticated',
                       'app_metadata', jsonb_build_object('role', 'organizer'))::text, true);
  begin
    perform public.organizer_update_event(v_evt_a1, jsonb_build_object('status', 'approved'));
    raise exception 'FAIL: status mutation must raise';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.organizer_update_event(v_evt_a1, jsonb_build_object('organizer_id', v_org_b));
    raise exception 'FAIL: ownership mutation must raise';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.organizer_update_event(v_evt_a1, jsonb_build_object('submitter_id', v_user_b));
    raise exception 'FAIL: submitter mutation must raise';
  exception when insufficient_privilege then null;
  end;

  -- anonymous denied
  perform set_config('request.jwt.claims', '{"sub": null, "role": "anon"}', true);
  begin
    perform public.organizer_update_event(v_evt_a1, jsonb_build_object('title', 'anon hijack'));
    raise exception 'FAIL: anonymous update must raise';
  exception when insufficient_privilege then null;
  end;

  -- ---------- 5. admin unchanged ----------
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user_b, 'role', 'authenticated',
                       'app_metadata', jsonb_build_object('role', 'admin'))::text, true);
  select count(*) into v_count from public.organizers;
  assert v_count >= 2, 'FAIL: admin must still read all organizers';
  perform public.organizer_update_event(v_evt_a1, jsonb_build_object('title', 'Phase6 A Draft'));

  raise notice 'PHASE 6 VERIFICATION PASSED';

end;
$$;

rollback;

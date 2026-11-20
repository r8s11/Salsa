-- Disposable migrated database only; all fixture changes roll back.
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_organizer_assignment.sql
\set ON_ERROR_STOP on
begin;
create schema oa_test;

create function oa_test.ok(p_ok boolean, p_label text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'FAILED: %', p_label; end if; end $$;

-- Runs one statement as a client role with the given JWT, returning its single text result.
create function oa_test.run(p_role text, p_uid uuid, p_admin boolean, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', case when p_uid is null then '' else jsonb_build_object(
    'sub', p_uid, 'role', p_role, 'app_metadata', jsonb_build_object('role', case when p_admin then 'admin' else 'user' end))::text end, true);
  execute format('set local role %I', p_role);
  execute p_sql into v;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;

create function oa_test.fails(p_role text, p_uid uuid, p_admin boolean, p_sql text, p_state text, p_label text)
returns void language plpgsql as $$
declare s text; m text;
begin
  begin
    perform oa_test.run(p_role, p_uid, p_admin, p_sql);
  exception when others then
    get stacked diagnostics s = returned_sqlstate, m = message_text;
    if s = p_state then return; end if;
    raise exception 'FAILED: % (expected %, got %: %)', p_label, p_state, s, m;
  end;
  raise exception 'FAILED: % (expected %, but it succeeded)', p_label, p_state;
end $$;

do $$
#variable_conflict use_variable
declare
  admin_u uuid := gen_random_uuid(); candidate uuid := gen_random_uuid(); mgr uuid := gen_random_uuid();
  editor uuid := gen_random_uuid(); stranger uuid := gen_random_uuid(); other_owner uuid := gen_random_uuid();
  suspended_u uuid := gen_random_uuid();
  tag text := 'oa-' || gen_random_uuid();
  org uuid := gen_random_uuid(); other_org uuid := gen_random_uuid(); archived_org uuid := gen_random_uuid();
  new_org uuid; ev uuid := gen_random_uuid(); ev2 uuid := gen_random_uuid(); inst uuid := gen_random_uuid();
  res jsonb; before_ev record; after_ev record; n bigint; members_before bigint;
begin
  insert into auth.users (id, email, email_confirmed_at)
  select u, 'oa-' || u || '@example.test', now() from unnest(array[admin_u, candidate, mgr, editor, stranger, other_owner, suspended_u]) u;
  insert into public.profiles (id, status, display_name)
  select u, case when u = suspended_u then 'suspended' else 'active' end, 'User ' || left(u::text, 4)
    from unnest(array[admin_u, candidate, mgr, editor, stranger, other_owner, suspended_u]) u
  on conflict (id) do update set status = excluded.status;

  insert into public.organizers (id, name, status) values
    (org, 'Existing Org ' || tag, 'active'), (other_org, 'Unrelated Org ' || tag, 'active'),
    (archived_org, 'Archived Org ' || tag, 'archived');
  insert into public.organizer_members (organizer_id, user_id, member_role) values
    (org, other_owner, 'owner'), (other_org, stranger, 'owner');
  insert into public.instructors (id, name, slug, status) values (inst, 'Inst ' || tag, 'i-' || tag, 'active');
  insert into public.events (id, title, city, event_date, status, event_type, organizer_id, location) values
    (ev, 'Unassigned ' || tag, 'boston', now() + interval '3 days', 'approved', 'social', null, 'Main Hall'),
    (ev2, 'Other ' || tag, 'boston', now() + interval '4 days', 'draft', 'social', other_org, null);
  insert into public.event_instructors (event_id, instructor_id, position) values (ev, inst, 0);

  -- 1-2. Promotion alone grants no membership.
  perform oa_test.run('authenticated', admin_u, true, format('select public.admin_set_user_role(%L, ''organizer'')::text', candidate));
  perform oa_test.ok((select role = 'organizer' from public.profiles where id = candidate), 'promotion did not set role');
  perform oa_test.ok(not exists (select 1 from public.organizer_members where user_id = candidate), 'promotion created a membership');
  perform oa_test.ok(oa_test.run('authenticated', admin_u, true, format('select public.admin_user_organizer_memberships(%L)::text', candidate)) = '[]', 'membership read model not empty');

  -- Authorization: non-admins and anonymous callers cannot assign or link.
  perform oa_test.fails('authenticated', stranger, false, format('select public.admin_assign_organizer_member(%L, %L, ''owner'')::text', candidate, org), '42501', 'non-admin assign');
  perform oa_test.fails('authenticated', other_owner, false, format('select public.admin_assign_organizer_member(%L, %L, ''owner'')::text', candidate, org), '42501', 'organizer owner assigns members through admin RPC');
  perform oa_test.fails('anon', null, false, format('select public.admin_assign_organizer_member(%L, %L, ''owner'')::text', candidate, org), '42501', 'anonymous assign');
  perform oa_test.fails('anon', null, false, format('select public.admin_set_event_organizer(%L, %L)::text', ev, org), '42501', 'anonymous event link');
  perform oa_test.fails('authenticated', stranger, false, format('select public.admin_set_event_organizer(%L, %L)::text', ev, other_org), '42501', 'non-admin event link');
  perform oa_test.fails('authenticated', stranger, false, format('select public.admin_organizer_team(%L)::text', other_org), '42501', 'non-admin team read');
  -- 12. Direct client writes cannot create or edit memberships.
  perform oa_test.fails('anon', null, false, format('insert into public.organizer_members (organizer_id, user_id, member_role) values (%L, %L, ''owner'') returning user_id::text', org, candidate), '42501', 'anonymous membership insert');
  perform oa_test.fails('authenticated', candidate, false, format('insert into public.organizer_members (organizer_id, user_id, member_role) values (%L, %L, ''owner'') returning user_id::text', org, candidate), '42501', 'self-granted membership');
  perform oa_test.fails('authenticated', other_owner, false, format('insert into public.organizer_members (organizer_id, user_id, member_role) values (%L, %L, ''editor'') returning user_id::text', org, candidate), '42501', 'owner direct membership insert');
  perform oa_test.run('authenticated', other_owner, false, format('update public.organizer_members set member_role = ''editor'' where organizer_id = %L and user_id = %L returning user_id::text', org, other_owner));
  perform oa_test.ok((select member_role = 'owner' from public.organizer_members where organizer_id = org and user_id = other_owner), 'direct role change by member took effect');
  perform oa_test.run('authenticated', stranger, false, format('update public.events set organizer_id = %L where id = %L returning id::text', other_org, ev));
  perform oa_test.ok((select organizer_id is null from public.events where id = ev), 'direct event link persisted');

  -- Validation.
  perform oa_test.fails('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, %L, ''superuser'')::text', candidate, org), '22023', 'invalid role');
  perform oa_test.fails('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, null, ''owner'')::text', candidate), '22023', 'no organizer and no new organizer');
  perform oa_test.fails('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, %L, ''owner'')::text', suspended_u, org), '22023', 'suspended account');
  -- 10. Archived organizers are rejected.
  perform oa_test.fails('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, %L, ''owner'')::text', candidate, archived_org), '22023', 'member on archived organizer');
  perform oa_test.fails('authenticated', admin_u, true, format('select public.admin_set_event_organizer(%L, %L)::text', ev, archived_org), '22023', 'event on archived organizer');
  perform oa_test.fails('authenticated', admin_u, true, format('update public.events set organizer_id = %L where id = %L returning id::text', archived_org, ev), '22023', 'direct admin event update to archived organizer');
  perform oa_test.ok((select organizer_id is null from public.events where id = ev), 'archived organizer link persisted');

  -- 3. Assign to an existing organizer as Manager.
  res := oa_test.run('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, %L, ''manager'')::text', candidate, org))::jsonb;
  perform oa_test.ok(res->>'outcome' = 'created' and res->>'member_role' = 'manager' and res->>'user_platform_role' = 'organizer', 'assign result');
  perform oa_test.ok(exists (select 1 from public.organizer_members where organizer_id = org and user_id = candidate and member_role = 'manager' and status = 'active'), 'membership missing');
  perform oa_test.ok(exists (select 1 from public.audit_logs where action = 'organizer.member_assigned' and entity_id = org and actor_id = admin_u and metadata->>'user_id' = candidate::text), 'assignment not audited');
  -- Idempotent repeat writes no second audit row.
  select count(*) into n from public.audit_logs where action = 'organizer.member_assigned' and entity_id = org;
  res := oa_test.run('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, %L, ''manager'')::text', candidate, org))::jsonb;
  perform oa_test.ok(res->>'outcome' = 'unchanged' and (select count(*) from public.audit_logs where action = 'organizer.member_assigned' and entity_id = org) = n, 'repeat not idempotent');
  -- Existing owner membership untouched; the only owner cannot be demoted.
  perform oa_test.fails('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, %L, ''editor'')::text', other_owner, org), '23514', 'demoting only owner');
  perform oa_test.ok((select member_role = 'owner' and status = 'active' from public.organizer_members where organizer_id = org and user_id = other_owner), 'existing owner changed');

  -- 4. Create a new organizer and assign the user as Owner in one call.
  res := oa_test.run('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, null, ''owner'', %L::jsonb)::text', candidate, jsonb_build_object('name', 'Brand New Org ' || tag)))::jsonb;
  new_org := (res->>'organizer_id')::uuid;
  perform oa_test.ok((res->>'organizer_created')::boolean and exists (select 1 from public.organizers where id = new_org and status = 'active' and name = 'Brand New Org ' || tag), 'organizer not created');
  perform oa_test.ok(exists (select 1 from public.organizer_members where organizer_id = new_org and user_id = candidate and member_role = 'owner'), 'new organizer owner missing');
  perform oa_test.fails('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, null, ''owner'', %L::jsonb)::text', mgr, jsonb_build_object('name', 'Brand New Org ' || tag)), '23505', 'duplicate organizer');
  perform oa_test.ok((select count(*) from public.organizers where name = 'Brand New Org ' || tag) = 1 and not exists (select 1 from public.organizer_members where user_id = mgr), 'failed create left partial writes');

  -- 5/11. Link an existing event; only organizer_id changes.
  select status, event_date, title, venue_id, event_type into before_ev from public.events where id = ev;
  res := oa_test.run('authenticated', admin_u, true, format('select public.admin_set_event_organizer(%L, %L)::text', ev, new_org))::jsonb;
  perform oa_test.ok((res->>'changed')::boolean, 'link reported unchanged');
  select status, event_date, title, venue_id, event_type, organizer_id into after_ev from public.events where id = ev;
  perform oa_test.ok(after_ev.status = before_ev.status and after_ev.event_date = before_ev.event_date and after_ev.title = before_ev.title
    and after_ev.venue_id is not distinct from before_ev.venue_id and after_ev.event_type = before_ev.event_type and after_ev.organizer_id = new_org, 'link changed other event fields');
  perform oa_test.ok(exists (select 1 from public.event_instructors where event_id = ev and instructor_id = inst), 'unrelated association lost');
  perform oa_test.ok(exists (select 1 from public.audit_logs where action = 'event.organizer_changed' and entity_id = ev and actor_id = admin_u and (metadata->>'from_organizer_id') is null and metadata->>'to_organizer_id' = new_org::text), 'organizer link not audited');

  -- Changing an existing organizer needs confirmation; unchanged is a no-op.
  perform oa_test.fails('authenticated', admin_u, true, format('select public.admin_set_event_organizer(%L, %L)::text', ev, org), '22023', 'change without confirmation');
  perform oa_test.ok((select organizer_id = new_org from public.events where id = ev), 'unconfirmed change persisted');
  res := oa_test.run('authenticated', admin_u, true, format('select public.admin_set_event_organizer(%L, %L)::text', ev, new_org))::jsonb;
  perform oa_test.ok(not (res->>'changed')::boolean, 'same organizer not a no-op');

  -- 6. Owner can edit the event.
  perform oa_test.run('authenticated', candidate, false, format('select public.organizer_update_event(%L, ''{"title":"Owner Edit"}''::jsonb)::text', ev));
  perform oa_test.ok((select title = 'Owner Edit' from public.events where id = ev), 'owner edit failed');
  -- 7. Manager can edit permitted fields; status stays immutable through the seam.
  perform oa_test.run('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, %L, ''manager'')::text', mgr, new_org));
  perform oa_test.run('authenticated', mgr, false, format('select public.organizer_update_event(%L, ''{"description":"By manager"}''::jsonb)::text', ev));
  perform oa_test.ok((select description = 'By manager' from public.events where id = ev), 'manager edit failed');
  perform oa_test.fails('authenticated', mgr, false, format('select public.organizer_update_event(%L, ''{"status":"cancelled"}''::jsonb)::text', ev), '42501', 'manager edited status');
  perform oa_test.fails('authenticated', mgr, false, format('select public.organizer_update_event(%L, jsonb_build_object(''organizer_id'', %L))::text', ev, other_org), '42501', 'manager moved event');
  -- 8. Editor cannot use owner/manager operations or administer the team.
  perform oa_test.run('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, %L, ''editor'')::text', editor, new_org));
  perform oa_test.fails('authenticated', editor, false, format('select public.organizer_update_event(%L, ''{"title":"Editor Edit"}''::jsonb)::text', ev), '42501', 'editor edit');
  perform oa_test.fails('authenticated', editor, false, format('select public.organizer_delete_event(%L)::text', ev), '42501', 'editor delete');
  perform oa_test.fails('authenticated', editor, false, format('select public.admin_assign_organizer_member(%L, %L, ''owner'')::text', editor, new_org), '42501', 'editor self-promotes');
  perform oa_test.run('authenticated', editor, false, format('update public.organizer_members set member_role = ''owner'' where user_id = %L returning user_id::text', editor));
  perform oa_test.ok((select member_role = 'editor' from public.organizer_members where organizer_id = new_org and user_id = editor), 'editor role changed');
  -- 9. An unrelated organizer's owner cannot modify the event.
  perform oa_test.fails('authenticated', stranger, false, format('select public.organizer_update_event(%L, ''{"title":"Hijack"}''::jsonb)::text', ev), '42501', 'unrelated organizer edit');
  perform oa_test.fails('authenticated', stranger, false, format('select public.organizer_delete_event(%L)::text', ev), '42501', 'unrelated organizer delete');
  perform oa_test.ok((select title = 'Owner Edit' from public.events where id = ev), 'unrelated edit persisted');

  -- Confirmed change moves the event and audits both sides.
  perform oa_test.run('authenticated', admin_u, true, format('select public.admin_set_event_organizer(%L, %L, true)::text', ev, org));
  perform oa_test.ok(exists (select 1 from public.audit_logs where action = 'event.organizer_changed' and entity_id = ev and metadata->>'from_organizer_id' = new_org::text and metadata->>'to_organizer_id' = org::text), 'organizer change not audited');
  perform oa_test.fails('authenticated', mgr, false, format('select public.organizer_update_event(%L, ''{"title":"Stale"}''::jsonb)::text', ev), '42501', 'previous organizer team still edits moved event');

  -- Team read model: active members first, with role and email.
  res := oa_test.run('authenticated', admin_u, true, format('select public.admin_organizer_team(%L)::text', new_org))::jsonb;
  perform oa_test.ok(res->>'organizer_status' = 'active' and jsonb_array_length(res->'members') = 3 and res->'members'->0->>'member_role' = 'owner' and res->'members'->2->>'member_role' = 'editor' and res->'members'->0->>'email' is not null, 'team read model');
  res := oa_test.run('authenticated', admin_u, true, format('select public.admin_user_organizer_memberships(%L)::text', candidate))::jsonb;
  perform oa_test.ok(jsonb_array_length(res) = 2, 'membership read model');
  -- The unrelated organizer's event and membership are untouched throughout.
  perform oa_test.ok((select organizer_id = other_org and status = 'draft' from public.events where id = ev2), 'unrelated event changed');

  -- Duplicate guard: normalized name, city and website, regardless of status.
  perform oa_test.fails('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, null, ''owner'', %L::jsonb)::text', mgr, jsonb_build_object('name', '  BRAND   new org ' || tag || ' ')), '23505', 'case/whitespace duplicate via RPC');
  begin
    perform oa_test.run('authenticated', admin_u, true, format('select public.admin_assign_organizer_member(%L, null, ''owner'', %L::jsonb)::text', mgr, jsonb_build_object('name', 'Brand New Org ' || tag)));
    raise exception 'FAILED: duplicate create accepted';
  exception when unique_violation then
    perform oa_test.ok(sqlerrm like 'An organizer named Brand New Org % already exists. Assign the user to it instead.', 'duplicate message not actionable: ' || sqlerrm);
  end;
  perform oa_test.ok(not exists (select 1 from public.organizer_members where user_id = mgr and organizer_id <> new_org), 'rejected duplicate left a membership');
  begin
    insert into public.organizers (name, status) values (' brand NEW org ' || tag, 'active');
    raise exception 'FAILED: direct duplicate insert accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.organizers (name, status, primary_city) values ('Brand New Org ' || tag, 'active', 'boston');
    insert into public.organizers (name, status, primary_city) values ('Brand New Org ' || tag, 'needs_review', 'boston');
    raise exception 'FAILED: duplicate in same city accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.organizers (name, status, website) values ('Brand New Org ' || tag, 'archived', '');
    raise exception 'FAILED: archived duplicate with empty website accepted';
  exception when unique_violation then null; end;
  -- Same name in a different city or with a distinct website remains valid.
  insert into public.organizers (name, status, primary_city) values ('Brand New Org ' || tag, 'active', 'chicago');
  insert into public.organizers (name, status, website) values ('Brand New Org ' || tag, 'active', 'https://distinct.example.test');
  insert into public.organizers (name, status) values ('Brand New Org 2 ' || tag, 'active');
  perform oa_test.ok((select count(*) from public.organizers where name = 'Brand New Org ' || tag) = 3, 'distinct organizers affected');
  perform oa_test.ok(exists (select 1 from public.organizers where id = org and name = 'Existing Org ' || tag), 'existing organizer changed');
end $$;
rollback;
\echo 'PASS admin organizer assignment: authority, hierarchy, audit, archived guard and data preservation'

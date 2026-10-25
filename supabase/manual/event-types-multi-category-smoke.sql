-- Multi-category events + Concert: real-Postgres smoke test (single session).
--
--   docker exec -i supabase_db_Salsa psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/manual/event-types-multi-category-smoke.sql
--
-- Requires migration 20261024120000_event_types_multi_category.sql. Runs inside a
-- transaction that is ROLLED BACK (auth users, events, submissions are fixtures).
-- Success prints "EVENT TYPES SMOKE OK". Roles/JWTs are simulated the way
-- PostgREST does it (request.jwt.claims + SET LOCAL ROLE), so RLS, grants and
-- auth.uid()/is_moderator() are the real ones.

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000000b1', 'et-admin@example.test', 'authenticated', 'authenticated', '{"role":"admin"}'),
  ('00000000-0000-4000-8000-0000000000b2', 'et-mod@example.test', 'authenticated', 'authenticated', '{"role":"moderator"}'),
  ('00000000-0000-4000-8000-0000000000b4', 'et-host@example.test', 'authenticated', 'authenticated', '{"role":"organizer"}');
insert into public.profiles (id)
select id from auth.users where email like 'et-%@example.test'
on conflict (id) do nothing;
insert into public.organizers (name, slug, instagram, primary_city)
values ('ET Host Org', 'et-host-org', 'ethostorg', 'Boston');
insert into public.organizer_members (organizer_id, user_id, member_role)
select o.id, '00000000-0000-4000-8000-0000000000b4', 'owner' from public.organizers o where o.slug = 'et-host-org';

-- ---------- 1. schema-level invariants + pure helpers ----------
do $$
begin
  assert not exists (select 1 from public.events where event_types is null or event_type is distinct from event_types[1]),
    'backfill: every event has event_types with event_type as the first member';
  assert exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'public_events' and column_name = 'event_types'),
    'public_events exposes event_types';
  assert public.event_types_valid(array['concert', 'social']), 'valid pair';
  assert not public.event_types_valid('{}'::text[]), 'empty rejected';
  assert not public.event_types_valid(null), 'null rejected';
  assert not public.event_types_valid(array['concert', 'concert']), 'duplicates rejected by validator';
  assert not public.event_types_valid(array['concert', null]), 'null member rejected';
  assert not public.event_types_valid(array['nightclub']), 'unknown rejected';
  assert public.event_types_dedupe(array['b', 'a', 'b']) = array['b', 'a'], 'dedupe keeps first-seen order';
  assert public.event_types_from_payload('{"event_type":"concert"}') = array['concert'], 'singular payload -> one-element';
  assert public.event_types_from_payload('{"event_types":["live_music","concert","live_music"],"event_type":"social"}')
    = array['live_music', 'concert'], 'array wins over singular, deduped';
  assert public.event_types_from_payload('{"title":"x"}') is null, 'absent keys -> null';
  assert public.event_types_from_payload('{"event_type":""}', false) is null, 'non-strict blank -> null';
end $$;

-- ---------- 2. moderator: save_event_with_entities (create / edit / singular-only) ----------
do $$
declare
  v_id uuid;
  r record;
  v_ok boolean;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","email":"et-mod@example.test","app_metadata":{"role":"moderator"}}', true);
  execute 'set local role authenticated';

  v_id := public.save_event_with_entities(null,
    '{"title":"ET Concert Night","event_type":"social","event_types":["concert","social","concert"],"city":"boston","event_date":"2030-05-01T20:00:00Z"}', true);
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_type = 'concert' and r.event_types = array['concert', 'social'],
    format('create: primary=first selected, deduped (got %s %s)', r.event_type, r.event_types);

  -- public view (anon) exposes the array and the concert primary
  execute 'reset role';
  execute 'set local role anon';
  select event_type, event_types into r from public.public_events where id = v_id;
  assert r.event_type = 'concert' and r.event_types = array['concert', 'social'], 'public_events exposes event_types';
  execute 'reset role';
  execute 'set local role authenticated';

  perform public.save_event_with_entities(v_id, '{"event_types":["social","live_music","workshop"]}', null);
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_type = 'social' and r.event_types = array['social', 'live_music', 'workshop'], 'edit: arrays replace + primary resync';

  perform public.save_event_with_entities(v_id, '{"title":"ET Concert Night v2"}', null);
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_types = array['social', 'live_music', 'workshop'], 'edit without type keys preserves array';

  perform public.save_event_with_entities(v_id, '{"event_type":"class"}', null);
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_type = 'class' and r.event_types = array['class'], 'singular-only producer = single-category write';

  v_ok := false;
  begin perform public.save_event_with_entities(v_id, '{"event_types":[]}', null);
  exception when sqlstate '22023' then v_ok := true; end;
  assert v_ok, 'empty array rejected';
  v_ok := false;
  begin perform public.save_event_with_entities(v_id, '{"event_types":["nightclub"]}', null);
  exception when sqlstate '22023' then v_ok := true; end;
  assert v_ok, 'unknown type rejected';
  v_ok := false;
  begin perform public.save_event_with_entities(v_id, '{"event_types":"concert"}', null);
  exception when sqlstate '22023' then v_ok := true; end;
  assert v_ok, 'non-array rejected';
  v_ok := false;
  begin perform public.save_event_with_entities(null, '{"title":"x","city":"boston","event_date":"2030-05-01T20:00:00Z"}', false);
  exception when sqlstate '22023' then v_ok := true; end;
  assert v_ok, 'create without any type rejected';

  v_id := public.save_event_with_entities(null,
    '{"title":"ET Singular Concert","event_type":"concert","city":"boston","event_date":"2030-05-02T20:00:00Z"}', false);
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_type = 'concert' and r.event_types = array['concert'], 'singular concert accepted';
  execute 'reset role';
end $$;

-- ---------- 3. direct table writes (PostgREST): admin insert/update, singular producers ----------
do $$
declare
  v_id uuid;
  r record;
  v_ok boolean;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated","email":"et-admin@example.test","app_metadata":{"role":"admin"}}', true);
  execute 'set local role authenticated';

  insert into public.events (title, event_types, event_date, city, status, source_type)
  values ('ET Direct Arr', array['workshop', 'concert'], '2030-06-01T20:00:00Z', 'boston', 'draft', 'admin')
  returning id into v_id;
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_type = 'workshop' and r.event_types = array['workshop', 'concert'], 'insert array-only -> primary derived';

  insert into public.events (title, event_type, event_types, event_date, city, status, source_type)
  values ('ET Direct Both', 'social', array['live_music', 'social'], '2030-06-02T20:00:00Z', 'boston', 'draft', 'admin')
  returning id into v_id;
  select event_type into r from public.events where id = v_id;
  assert r.event_type = 'live_music', 'insert with both: array order wins';

  insert into public.events (title, event_type, event_date, city, status, source_type)
  values ('ET Direct Singular', 'class', '2030-06-03T20:00:00Z', 'boston', 'draft', 'admin')
  returning id into v_id;
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_types = array['class'], 'singular-only insert -> one-element array';

  update public.events set event_types = array['concert', 'class'], event_type = 'class' where id = v_id;
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_type = 'concert' and r.event_types = array['concert', 'class'], 'update array wins over stale primary';

  update public.events set event_type = 'social' where id = v_id;
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_types = array['social'], 'update singular-only -> one-element array';

  update public.events set title = 'ET Direct Singular 2' where id = v_id;
  select event_types into r from public.events where id = v_id;
  assert r.event_types = array['social'], 'unrelated update leaves types alone';

  v_ok := false;
  begin update public.events set event_types = '{}' where id = v_id;
  exception when check_violation then v_ok := true; end;
  assert v_ok, 'update to empty array rejected';
  v_ok := false;
  begin update public.events set event_types = array['social', 'bogus'] where id = v_id;
  exception when check_violation then v_ok := true; end;
  assert v_ok, 'update with unknown member rejected';
  v_ok := false;
  begin
    insert into public.events (title, event_types, event_date, city, status, source_type)
    values ('ET Bad Insert', '{}', '2030-06-04T20:00:00Z', 'boston', 'draft', 'admin');
  exception when check_violation then v_ok := true; end;
  assert v_ok, 'insert with empty array rejected';
  v_ok := false;
  begin
    insert into public.events (title, event_type, event_date, city, status, source_type)
    values ('ET Bad Singular', 'nightclub', '2030-06-04T20:00:00Z', 'boston', 'draft', 'admin');
  exception when check_violation then v_ok := true; end;
  assert v_ok, 'singular unknown type rejected';
  execute 'reset role';
end $$;

-- ---------- 4. submissions: normalise at the door, approve preserves the array ----------
do $$
declare
  v_arr uuid := '00000000-0000-4000-8000-0000000000c1';
  v_single uuid := '00000000-0000-4000-8000-0000000000c2';
  v_edit_single uuid := '00000000-0000-4000-8000-0000000000c3';
  v_edit_arr uuid := '00000000-0000-4000-8000-0000000000c4';
  v_ev uuid;
  r record;
  v_ok boolean;
begin
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  insert into public.event_submissions (id, submitted_data) values
    (v_arr, '{"title":"ET Sub Arr","event_type":"social","event_types":["concert","class","concert"],"city":"boston","event_date":"2030-07-01T20:00:00Z"}'),
    (v_single, '{"title":"ET Sub Single","event_type":"concert","city":"boston","event_date":"2030-07-02T20:00:00Z"}'),
    (v_edit_single, '{"title":"ET Sub Edit1","event_type":"social","event_types":["social","class"],"city":"boston","event_date":"2030-07-03T20:00:00Z"}'),
    (v_edit_arr, '{"title":"ET Sub Edit2","event_type":"social","city":"boston","event_date":"2030-07-04T20:00:00Z"}');
  v_ok := false;
  begin
    insert into public.event_submissions (submitted_data)
    values ('{"title":"ET Bad","event_types":["bogus"],"city":"boston","event_date":"2030-07-05T20:00:00Z"}');
  exception when sqlstate '22023' then v_ok := true; end;
  assert v_ok, 'submission with unknown event_types rejected';
  execute 'reset role';

  select submitted_data into r from public.event_submissions where id = v_arr;
  assert r.submitted_data -> 'event_types' = '["concert","class"]'::jsonb and r.submitted_data ->> 'event_type' = 'concert',
    'submitted_data normalised: deduped, event_type = first';

  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","email":"et-mod@example.test","app_metadata":{"role":"moderator"}}', true);
  execute 'set local role authenticated';
  update public.event_submissions set edited_data = '{"event_type":"class"}' where id = v_edit_single;
  update public.event_submissions set edited_data = '{"event_types":["workshop","concert"]}' where id = v_edit_arr;

  v_ev := public.approve_event_submission(v_arr, '{}');
  select event_type, event_types, status into r from public.events where id = v_ev;
  assert r.event_type = 'concert' and r.event_types = array['concert', 'class'] and r.status = 'approved', 'approve preserves submitted array';

  v_ev := public.approve_event_submission(v_single, '{}');
  select event_type, event_types into r from public.events where id = v_ev;
  assert r.event_type = 'concert' and r.event_types = array['concert'], 'approve singular-only submission';

  v_ev := public.approve_event_submission(v_edit_single, '{}');
  select event_type, event_types into r from public.events where id = v_ev;
  assert r.event_type = 'class' and r.event_types = array['class'], 'singular moderator edit overrides submitted array';

  v_ev := public.approve_event_submission(v_edit_arr, '{}');
  select event_type, event_types into r from public.events where id = v_ev;
  assert r.event_type = 'workshop' and r.event_types = array['workshop', 'concert'], 'moderator array edit wins';
  execute 'reset role';
end $$;

-- ---------- 5. host (organizer) create / update ----------
do $$
declare
  v_org uuid;
  v_id uuid;
  r record;
  v_ok boolean;
begin
  select id into v_org from public.organizers where slug = 'et-host-org';
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000b4","role":"authenticated","email":"et-host@example.test","app_metadata":{"role":"organizer"}}', true);
  execute 'set local role authenticated';

  v_id := public.organizer_create_event(v_org,
    '{"title":"ET Host Night","event_type":"social","event_types":["concert","live_music"],"city":"boston","event_date":"2030-08-01T20:00:00Z"}'::jsonb, true);
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_type = 'concert' and r.event_types = array['concert', 'live_music'], 'host create keeps array';

  perform public.organizer_update_event(v_id, '{"event_types":["workshop","class","social"]}'::jsonb);
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_type = 'workshop' and r.event_types = array['workshop', 'class', 'social'], 'host update keeps array';

  perform public.organizer_update_event(v_id, '{"title":"ET Host Night 2"}'::jsonb);
  select event_types into r from public.events where id = v_id;
  assert r.event_types = array['workshop', 'class', 'social'], 'host update without types preserves array';

  perform public.organizer_update_event(v_id, '{"event_type":"concert"}'::jsonb);
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_type = 'concert' and r.event_types = array['concert'], 'host singular-only update';

  v_ok := false;
  begin perform public.organizer_update_event(v_id, '{"event_types":[]}'::jsonb);
  exception when sqlstate '22023' then v_ok := true; end;
  assert v_ok, 'host empty array rejected';
  v_ok := false;
  begin perform public.organizer_create_event(v_org,
    '{"title":"x","event_types":["bogus"],"city":"boston","event_date":"2030-08-02T20:00:00Z"}'::jsonb, false);
  exception when sqlstate '22023' then v_ok := true; end;
  assert v_ok, 'host create with unknown type rejected';

  v_id := public.organizer_create_event(v_org,
    '{"title":"ET Host Singular","event_type":"concert","city":"boston","event_date":"2030-08-03T20:00:00Z"}'::jsonb, false);
  select event_type, event_types into r from public.events where id = v_id;
  assert r.event_type = 'concert' and r.event_types = array['concert'], 'host singular create';
  execute 'reset role';
end $$;

-- ---------- 6. audit/backfill hygiene + grants ----------
do $$
begin
  assert has_column_privilege('authenticated', 'public.events', 'event_types', 'update'), 'authenticated can update event_types column (matches event_type)';
  assert has_column_privilege('authenticated', 'public.events', 'event_type', 'update'), 'authenticated can update event_type column';
  assert not has_column_privilege('authenticated', 'public.events', 'source_type', 'update'), 'source_type still not client-updatable';
  assert has_table_privilege('anon', 'public.public_events', 'select'), 'public_events still readable by anon';
  assert has_table_privilege('authenticated', 'public.public_events', 'select'), 'public_events still readable by authenticated';
  assert has_function_privilege('authenticated', 'public.save_event_with_entities(uuid,jsonb,boolean)', 'execute'), 'save grant kept';
  assert not has_function_privilege('anon', 'public.save_event_with_entities(uuid,jsonb,boolean)', 'execute'), 'save not granted to anon';
  assert has_function_privilege('authenticated', 'public.organizer_create_event(uuid,jsonb,boolean)', 'execute'), 'organizer_create grant kept';
  assert not has_function_privilege('anon', 'public.organizer_update_event(uuid,jsonb)', 'execute'), 'organizer_update not granted to anon';
  assert has_function_privilege('authenticated', 'public.approve_event_submission(uuid,uuid[])', 'execute'), 'approve grant kept';
  assert not has_function_privilege('anon', 'public.approve_event_submission(uuid,uuid[])', 'execute'), 'approve not granted to anon';
end $$;

rollback;
\echo EVENT TYPES SMOKE OK

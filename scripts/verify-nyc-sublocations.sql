-- NYC borough (events.sublocation) database regression smoke.
--
-- Runs entirely inside a transaction that is ROLLED BACK. Requires the
-- 20261025120000_nyc_event_sublocations migration to be present in the same
-- transaction or already applied, and the local seed users
-- (admin@salsa.local, owner@salsa.local) plus a seeded active organizer.
--
-- Asserts borough behaviour only. It works on the baseline schema (event types
-- migration, single flyer) and on a database that also has the multiple-flyers
-- migration: flyer checks run only when events.image_urls AND
-- event_flyers_from_payload() exist (psql variable :has_flyers) and only prove
-- the borough patch did not disturb them. Requires psql (\gset / \if).
--
-- DB whose history lacks the migration (also proves idempotence by applying it
-- twice, then runs every check; nothing is committed):
--   { echo 'begin;'; cat supabase/migrations/20261025120000_nyc_event_sublocations.sql \
--       supabase/migrations/20261025120000_nyc_event_sublocations.sql scripts/verify-nyc-sublocations.sql; } \
--     | docker exec -i supabase_db_Salsa psql -U postgres -d postgres -v ON_ERROR_STOP=1
--   (this file ends with ROLLBACK; it intentionally contains no BEGIN)
--
-- Already-applied DB:
--   { echo 'begin;'; cat scripts/verify-nyc-sublocations.sql; } \
--     | docker exec -i supabase_db_Salsa psql -U postgres -d postgres -v ON_ERROR_STOP=1
--
-- Baseline (single-flyer) schema without touching the working DB: replay the
-- migrations up to 20261024120000_event_types_multi_category into a scratch
-- database (createdb / dropdb), seed the two users + an organizer, then run the
-- same pipeline against it with -d <scratch>.
--
-- Every check prints "ok  <label>"; any failure raises and aborts (exit != 0).

-- ---------------------------------------------------------------------------
-- helpers (pg_temp: vanish with the session)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.expect(p_sql text, p_state text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate <> p_state then
      raise exception 'FAIL %: expected SQLSTATE % got % (%)', p_label, p_state, sqlstate, sqlerrm;
    end if;
    raise notice 'ok  % [%]', p_label, sqlstate;
    return;
  end;
  raise exception 'FAIL %: expected SQLSTATE %, nothing raised', p_label, p_state;
end $$;

create or replace function pg_temp.eq(p_label text, p_actual anyelement, p_expected anyelement)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: expected <%> got <%>', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok  %', p_label;
end $$;

create or replace function pg_temp.as_user(p_uid uuid, p_app_role text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_uid, 'role', 'authenticated', 'email', 'smoke@salsa.local',
                       'app_metadata', jsonb_build_object('role', p_app_role))::text, true);
  execute 'set local role authenticated';
end $$;

create temp table smoke_ids(k text primary key, v uuid);
grant all on smoke_ids to public;

select id as admin_id from auth.users where email = 'admin@salsa.local' \gset
select id as owner_id from auth.users where email = 'owner@salsa.local' \gset
select id as org_id from public.organizers where status = 'active' order by id limit 1 \gset
insert into smoke_ids values ('admin', :'admin_id'), ('owner', :'owner_id'), ('org', :'org_id');
create or replace function pg_temp.id(p_k text) returns uuid language sql stable as $$ select v from smoke_ids where k = p_k $$;

-- Multi-flyer layout present? (column AND payload helper; borough checks never depend on it)
select (exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'events' and column_name = 'image_urls')
        and to_regprocedure('public.event_flyers_from_payload(jsonb)') is not null) as has_flyers \gset

-- ---------------------------------------------------------------------------
-- 1. Schema: column, constraint, index, grant, public view
-- ---------------------------------------------------------------------------
select pg_temp.eq('column exists', (select data_type from information_schema.columns
  where table_schema = 'public' and table_name = 'events' and column_name = 'sublocation'), 'text');
select pg_temp.eq('check constraint exists', (select count(*)::int from pg_constraint
  where conrelid = 'public.events'::regclass and conname = 'events_sublocation_check'), 1);
select pg_temp.eq('partial index exists', (select count(*)::int from pg_indexes
  where schemaname = 'public' and indexname = 'events_approved_city_sublocation_event_date_idx'), 1);
select pg_temp.eq('authenticated can UPDATE sublocation', has_column_privilege('authenticated', 'public.events', 'sublocation', 'UPDATE'), true);
select pg_temp.eq('public_events last column is sublocation', (select attname from pg_attribute
  where attrelid = 'public.public_events'::regclass and attnum > 0 and not attisdropped order by attnum desc limit 1), 'sublocation');
select pg_temp.eq('public_events keeps existing column ordinals, sublocation appended last', (select string_agg(attname::text, ',' order by attnum)
  from pg_attribute where attrelid = 'public.public_events'::regclass and attnum > 0 and not attisdropped),
  'id,title,description,event_type,event_date,event_time,location,address,price_type,price_amount,rsvp_link,image_url,poster_image_url,status,source_type,'
  || 'city,host,recurrence,gallery,dance_styles,venue_id,organizer_id,created_at,updated_at,event_taxonomy_terms,slug,series_id,public_entities,event_types'
  || case when :'has_flyers'::boolean then ',image_urls' else '' end || ',sublocation');
select pg_temp.eq('public_events is security definer view (security_invoker off)',
  coalesce((select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.public_events'::regclass), false), false);
select pg_temp.eq('resolver not executable by anon/authenticated',
  has_function_privilege('anon', 'public.event_sublocation_resolve(text,text,boolean)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.event_sublocation_resolve(text,text,boolean)', 'EXECUTE'), false);
select pg_temp.eq('anon cannot execute approve_event_submission', has_function_privilege('anon', 'public.approve_event_submission(uuid,uuid[])', 'EXECUTE'), false);
select pg_temp.eq('authenticated can execute approve_event_submission', has_function_privilege('authenticated', 'public.approve_event_submission(uuid,uuid[])', 'EXECUTE'), true);
select pg_temp.eq('anon cannot execute save_event_with_entities', has_function_privilege('anon', 'public.save_event_with_entities(uuid,jsonb,boolean)', 'EXECUTE'), false);
select pg_temp.eq('authenticated can execute save_event_with_entities', has_function_privilege('authenticated', 'public.save_event_with_entities(uuid,jsonb,boolean)', 'EXECUTE'), true);
select pg_temp.eq('anon cannot execute organizer_create_event', has_function_privilege('anon', 'public.organizer_create_event(uuid,jsonb,boolean)', 'EXECUTE'), false);
select pg_temp.eq('anon cannot execute organizer_update_event', has_function_privilege('anon', 'public.organizer_update_event(uuid,jsonb)', 'EXECUTE'), false);

-- ---------------------------------------------------------------------------
-- 2. Moderator save_event_with_entities (create + update)
-- ---------------------------------------------------------------------------
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
insert into smoke_ids select 'e_bk', public.save_event_with_entities(null,
  '{"title":"Smoke Brooklyn","event_types":["social"],"city":"new-york-city","event_date":"2026-12-01T20:00:00Z",
    "sublocation":"brooklyn"}'::jsonb, true);
insert into smoke_ids select 'e_all', public.save_event_with_entities(null,
  '{"title":"Smoke All NYC","event_types":["social"],"city":"new-york-city","event_date":"2026-12-02T20:00:00Z"}'::jsonb, true);
insert into smoke_ids select 'e_bos', public.save_event_with_entities(null,
  '{"title":"Smoke Boston","event_types":["social"],"city":"boston","event_date":"2026-12-03T20:00:00Z"}'::jsonb, true);
select pg_temp.expect($q$select public.save_event_with_entities(null,
  '{"title":"x","event_types":["social"],"city":"boston","event_date":"2026-12-03T20:00:00Z","sublocation":"brooklyn"}'::jsonb, false)$q$,
  '22023', 'save create: boston + borough rejected');
select pg_temp.expect($q$select public.save_event_with_entities(null,
  '{"title":"x","event_types":["social"],"city":"new-york-city","event_date":"2026-12-03T20:00:00Z","sublocation":"jersey"}'::jsonb, false)$q$,
  '22023', 'save create: unknown borough rejected');
select pg_temp.expect($q$select public.save_event_with_entities(null,
  '{"title":"x","event_types":["social"],"city":"new-york-city","event_date":"2026-12-03T20:00:00Z","sublocation":"Brooklyn"}'::jsonb, false)$q$,
  '22023', 'save create: non-slug (case) borough rejected');
reset role;
select pg_temp.eq('save create persists borough', (select sublocation from public.events where id = pg_temp.id('e_bk')), 'brooklyn');
select pg_temp.eq('save create All NYC stays NULL', (select sublocation from public.events where id = pg_temp.id('e_all')), null::text);
select pg_temp.eq('save create non-NYC NULL', (select sublocation from public.events where id = pg_temp.id('e_bos')), null::text);
select pg_temp.eq('rejected creates inserted nothing', (select count(*)::int from public.events where title = 'x' and event_date = '2026-12-03T20:00:00Z'), 0);

select pg_temp.as_user(pg_temp.id('admin'), 'admin');
-- unrelated edit keeps borough
select public.save_event_with_entities(pg_temp.id('e_bk'), '{"title":"Smoke Brooklyn 2"}'::jsonb, null);
reset role;
select pg_temp.eq('save update: unrelated edit keeps borough', (select sublocation from public.events where id = pg_temp.id('e_bk')), 'brooklyn');
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
select public.save_event_with_entities(pg_temp.id('e_bk'), '{"sublocation":"queens"}'::jsonb, null);
reset role;
select pg_temp.eq('save update: borough change persists', (select sublocation from public.events where id = pg_temp.id('e_bk')), 'queens');
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
select pg_temp.expect($q$select public.save_event_with_entities(pg_temp.id('e_bk'), '{"city":"boston","sublocation":"queens"}'::jsonb, null)$q$,
  '22023', 'save update: explicit stale borough with non-NYC city rejected');
reset role;
select pg_temp.eq('save update: rejected edit changed nothing (city)', (select city from public.events where id = pg_temp.id('e_bk')), 'new-york-city');
select pg_temp.eq('save update: rejected edit changed nothing (borough)', (select sublocation from public.events where id = pg_temp.id('e_bk')), 'queens');
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
select pg_temp.expect($q$select public.save_event_with_entities(pg_temp.id('e_bos'), '{"sublocation":"bronx"}'::jsonb, null)$q$,
  '22023', 'save update: borough on a non-NYC event rejected');
select pg_temp.expect($q$select public.save_event_with_entities(pg_temp.id('e_bk'), '{"sublocation":"narnia"}'::jsonb, null)$q$,
  '22023', 'save update: unknown borough rejected');
-- city moves away from NYC without a borough -> stale borough cleared
select public.save_event_with_entities(pg_temp.id('e_bk'), '{"city":"boston"}'::jsonb, null);
reset role;
select pg_temp.eq('save update: NYC->Boston clears stale borough', (select sublocation from public.events where id = pg_temp.id('e_bk')), null::text);
select pg_temp.eq('save update: NYC->Boston city saved', (select city from public.events where id = pg_temp.id('e_bk')), 'boston');
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
-- explicit city + borough together into NYC
select public.save_event_with_entities(pg_temp.id('e_bk'), '{"city":"new-york-city","sublocation":"manhattan"}'::jsonb, null);
reset role;
select pg_temp.eq('save update: Boston->NYC with explicit borough', (select sublocation from public.events where id = pg_temp.id('e_bk')), 'manhattan');
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
-- explicit empty string clears to All NYC
select public.save_event_with_entities(pg_temp.id('e_bk'), '{"sublocation":""}'::jsonb, null);
reset role;
select pg_temp.eq('save update: empty string clears to All NYC', (select sublocation from public.events where id = pg_temp.id('e_bk')), null::text);

-- public view exposure (anon, approved only)
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
select public.save_event_with_entities(pg_temp.id('e_bk'), '{"sublocation":"bronx"}'::jsonb, true);
reset role;

-- ---------------------------------------------------------------------------
-- 3. Public projection (anon, approved rows only)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.eq('anon view exposes borough', (select sublocation from public.public_events where id = pg_temp.id('e_bk')), 'bronx');
select pg_temp.eq('anon view All NYC is NULL', (select count(*)::int from public.public_events where id = pg_temp.id('e_all') and sublocation is null), 1);
select pg_temp.eq('anon can filter view by city+borough', (select count(*)::int from public.public_events
  where city = 'new-york-city' and sublocation = 'bronx' and id = pg_temp.id('e_bk')), 1);
reset role;

-- ---------------------------------------------------------------------------
-- 4. Direct table writes (trigger safety net + check constraint), as postgres
-- ---------------------------------------------------------------------------
update public.events set city = 'boston' where id = pg_temp.id('e_bk');
select pg_temp.eq('direct: city NYC->Boston with untouched borough clears it', (select sublocation from public.events where id = pg_temp.id('e_bk')), null::text);
update public.events set city = 'new-york-city', sublocation = 'bronx' where id = pg_temp.id('e_bk');
select pg_temp.eq('direct: Boston->NYC with borough ok', (select sublocation from public.events where id = pg_temp.id('e_bk')), 'bronx');
select pg_temp.expect($q$update public.events set city = 'boston', sublocation = 'queens' where id = pg_temp.id('e_bk')$q$,
  '23514', 'direct: explicit changed borough with non-NYC city hits check constraint');
select pg_temp.expect($q$update public.events set sublocation = 'brooklyn' where id = pg_temp.id('e_bos')$q$,
  '23514', 'direct: borough on non-NYC event hits check constraint');
select pg_temp.expect($q$update public.events set sublocation = 'nj' where id = pg_temp.id('e_bk')$q$,
  '23514', 'direct: unknown borough hits check constraint');
select pg_temp.expect($q$insert into public.events (title, event_type, event_date, city, status, sublocation)
  values ('Smoke Missing City', 'social', '2026-12-06T20:00:00Z', null, 'pending', 'brooklyn')$q$,
  '23514', 'direct: borough without a city is rejected');
update public.events set sublocation = '   ' where id = pg_temp.id('e_bk');
select pg_temp.eq('direct: blank borough normalised to NULL', (select sublocation from public.events where id = pg_temp.id('e_bk')), null::text);

-- owner edits their own pending event straight through RLS (updateEventForUser path)
with ev as (
  insert into public.events (title, event_type, event_date, city, status, source_type, submitter_id, sublocation)
  values ('Smoke Owner Pending', 'social', '2026-12-04T20:00:00Z', 'new-york-city', 'pending', 'user_submission', pg_temp.id('owner'), 'queens')
  returning id)
insert into smoke_ids select 'e_own', id from ev;
select pg_temp.as_user(pg_temp.id('owner'), 'user');
update public.events set city = 'boston' where id = pg_temp.id('e_own');
reset role;
select pg_temp.eq('owner direct edit: leaving NYC clears stale borough', (select sublocation from public.events where id = pg_temp.id('e_own')), null::text);
select pg_temp.as_user(pg_temp.id('owner'), 'user');
select pg_temp.expect($q$update public.events set sublocation = 'queens' where id = pg_temp.id('e_own')$q$,
  '23514', 'owner direct edit: borough on Boston event rejected');
update public.events set city = 'new-york-city', sublocation = 'brooklyn' where id = pg_temp.id('e_own');
reset role;
select pg_temp.eq('owner direct edit: Boston->NYC with borough persists', (select sublocation from public.events where id = pg_temp.id('e_own')), 'brooklyn');


-- ---------------------------------------------------------------------------
-- 5. Organizer RPCs (admin acts as platform)
-- ---------------------------------------------------------------------------
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
insert into smoke_ids select 'o_nyc', public.organizer_create_event(pg_temp.id('org'),
  '{"title":"Smoke Org NYC","event_types":["social"],"city":"new-york-city","event_date":"2026-12-07T20:00:00Z",
    "sublocation":"staten-island"}'::jsonb, true);
insert into smoke_ids select 'o_all', public.organizer_create_event(pg_temp.id('org'),
  '{"title":"Smoke Org All","event_types":["social"],"city":"new-york-city","event_date":"2026-12-08T20:00:00Z"}'::jsonb, false);
select pg_temp.expect($q$select public.organizer_create_event(pg_temp.id('org'),
  '{"title":"x","event_types":["social"],"event_date":"2026-12-08T20:00:00Z","sublocation":"queens"}'::jsonb, false)$q$,
  '22023', 'organizer create: borough with defaulted (boston) city rejected');
select pg_temp.expect($q$select public.organizer_create_event(pg_temp.id('org'),
  '{"title":"x","event_types":["social"],"city":"boston","event_date":"2026-12-08T20:00:00Z","sublocation":"queens"}'::jsonb, false)$q$,
  '22023', 'organizer create: borough with Boston rejected');
select pg_temp.expect($q$select public.organizer_create_event(pg_temp.id('org'),
  '{"title":"x","event_types":["social"],"city":"new-york-city","event_date":"2026-12-08T20:00:00Z","sublocation":"jersey"}'::jsonb, false)$q$,
  '22023', 'organizer create: unknown borough rejected');
select pg_temp.expect($q$select public.organizer_create_event(pg_temp.id('org'),
  '{"title":"x","event_types":["social"],"city":"new-york-city","event_date":"2026-12-08T20:00:00Z","status":"approved"}'::jsonb, false)$q$,
  '42501', 'organizer create: field allowlist still enforced');
reset role;
select pg_temp.eq('organizer create persists borough', (select sublocation from public.events where id = pg_temp.id('o_nyc')), 'staten-island');
select pg_temp.eq('organizer create All NYC NULL', (select sublocation from public.events where id = pg_temp.id('o_all')), null::text);
select pg_temp.eq('organizer create stays organizer-sourced', (select source_type from public.events where id = pg_temp.id('o_nyc')), 'organizer');

select pg_temp.as_user(pg_temp.id('admin'), 'admin');
select public.organizer_update_event(pg_temp.id('o_nyc'), '{"title":"Smoke Org NYC 2"}'::jsonb);
reset role;
select pg_temp.eq('organizer update: unrelated edit keeps borough', (select sublocation from public.events where id = pg_temp.id('o_nyc')), 'staten-island');
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
select public.organizer_update_event(pg_temp.id('o_nyc'), '{"sublocation":"queens"}'::jsonb);
reset role;
select pg_temp.eq('organizer update: borough change persists', (select sublocation from public.events where id = pg_temp.id('o_nyc')), 'queens');
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
select pg_temp.expect($q$select public.organizer_update_event(pg_temp.id('o_nyc'), '{"city":"boston","sublocation":"queens"}'::jsonb)$q$,
  '22023', 'organizer update: explicit stale borough with Boston rejected');
select pg_temp.expect($q$select public.organizer_update_event(pg_temp.id('o_nyc'), '{"sublocation":"jersey"}'::jsonb)$q$,
  '22023', 'organizer update: unknown borough rejected');
select pg_temp.expect($q$select public.organizer_update_event(pg_temp.id('o_nyc'), '{"status":"approved"}'::jsonb)$q$,
  '42501', 'organizer update: field allowlist still enforced');
select public.organizer_update_event(pg_temp.id('o_nyc'), '{"city":"boston"}'::jsonb);
reset role;
select pg_temp.eq('organizer update: NYC->Boston clears stale borough', (select sublocation from public.events where id = pg_temp.id('o_nyc')), null::text);
select pg_temp.eq('organizer update: NYC->Boston city saved', (select city from public.events where id = pg_temp.id('o_nyc')), 'boston');
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
select pg_temp.expect($q$select public.organizer_update_event(pg_temp.id('o_nyc'), '{"sublocation":"queens"}'::jsonb)$q$,
  '22023', 'organizer update: borough on Boston event rejected');
select public.organizer_update_event(pg_temp.id('o_nyc'), '{"city":"new-york-city","sublocation":"manhattan"}'::jsonb);
reset role;
select pg_temp.eq('organizer update: Boston->NYC with explicit borough', (select sublocation from public.events where id = pg_temp.id('o_nyc')), 'manhattan');
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
select public.organizer_update_event(pg_temp.id('o_nyc'), '{"sublocation":""}'::jsonb);
reset role;
select pg_temp.eq('organizer update: empty string clears to All NYC', (select sublocation from public.events where id = pg_temp.id('o_nyc')), null::text);

-- authorization regressions: a plain signed-in user stays locked out
select pg_temp.as_user(pg_temp.id('owner'), 'user');
select pg_temp.expect($q$select public.organizer_create_event('dddddddd-ffff-4000-8000-00000000ffff'::uuid,
  '{"title":"x","event_types":["social"],"city":"new-york-city","event_date":"2026-12-08T20:00:00Z","sublocation":"queens"}'::jsonb, false)$q$,
  '42501', 'non-member cannot organizer_create_event with borough');
select pg_temp.expect($q$select public.save_event_with_entities(null,
  '{"title":"x","event_types":["social"],"city":"new-york-city","event_date":"2026-12-08T20:00:00Z","sublocation":"queens"}'::jsonb, false)$q$,
  '42501', 'non-moderator cannot save_event_with_entities');
select pg_temp.expect($q$select public.approve_event_submission(gen_random_uuid(), '{}'::uuid[])$q$,
  '42501', 'non-moderator cannot approve_event_submission');
reset role;

-- ---------------------------------------------------------------------------
-- 6. Submission approval (edited_data overlay provenance preserved)
-- ---------------------------------------------------------------------------
with s as (insert into public.event_submissions (submitted_data) values
  ('{"title":"Smoke S1","event_type":"social","event_types":["social"],"city":"new-york-city","event_date":"2026-12-10T20:00:00Z","sublocation":"bronx"}') returning id)
insert into smoke_ids select 's1', id from s;
with s as (insert into public.event_submissions (submitted_data) values
  ('{"title":"Smoke S2","event_type":"social","event_types":["social"],"city":"new-york-city","event_date":"2026-12-10T20:00:00Z","sublocation":"manhattan"}') returning id)
insert into smoke_ids select 's2', id from s;
with s as (insert into public.event_submissions (submitted_data) values
  ('{"title":"Smoke S3","event_type":"social","event_types":["social"],"city":"boston","event_date":"2026-12-10T20:00:00Z","sublocation":"brooklyn"}') returning id)
insert into smoke_ids select 's3', id from s;
with s as (insert into public.event_submissions (submitted_data) values
  ('{"title":"Smoke S4","event_type":"social","event_types":["social"],"city":"new-york-city","event_date":"2026-12-10T20:00:00Z","sublocation":"brooklyn"}') returning id)
insert into smoke_ids select 's4', id from s;
with s as (insert into public.event_submissions (submitted_data) values
  ('{"title":"Smoke S5","event_type":"social","event_types":["social"],"city":"new-york-city","event_date":"2026-12-10T20:00:00Z","sublocation":"queens"}') returning id)
insert into smoke_ids select 's5', id from s;
with s as (insert into public.event_submissions (submitted_data) values
  ('{"title":"Smoke S6","event_type":"social","event_types":["social"],"city":"new-york-city","event_date":"2026-12-10T20:00:00Z"}') returning id)
insert into smoke_ids select 's6', id from s;
with s as (insert into public.event_submissions (submitted_data) values
  ('{"title":"Smoke S7","event_type":"social","event_types":["social"],"city":"new-york-city","event_date":"2026-12-10T20:00:00Z","sublocation":"queens"}') returning id)
insert into smoke_ids select 's7', id from s;
with s as (insert into public.event_submissions (submitted_data) values
  ('{"title":"Smoke S8","event_type":"social","event_types":["social"],"city":"new-york-city","event_date":"2026-12-10T20:00:00Z","sublocation":"jersey"}') returning id)
insert into smoke_ids select 's8', id from s;

select pg_temp.as_user(pg_temp.id('admin'), 'admin');
update public.event_submissions set edited_data = '{"city":"boston"}' where id = pg_temp.id('s2');
update public.event_submissions set edited_data = '{"city":"boston","sublocation":"brooklyn"}' where id = pg_temp.id('s4');
update public.event_submissions set edited_data = '{"title":"Smoke S5 edited"}' where id = pg_temp.id('s5');
update public.event_submissions set edited_data = '{"sublocation":null}' where id = pg_temp.id('s7');
insert into smoke_ids select 'ev_s1', public.approve_event_submission(pg_temp.id('s1'), '{}'::uuid[]);
insert into smoke_ids select 'ev_s2', public.approve_event_submission(pg_temp.id('s2'), '{}'::uuid[]);
insert into smoke_ids select 'ev_s5', public.approve_event_submission(pg_temp.id('s5'), '{}'::uuid[]);
insert into smoke_ids select 'ev_s6', public.approve_event_submission(pg_temp.id('s6'), '{}'::uuid[]);
insert into smoke_ids select 'ev_s7', public.approve_event_submission(pg_temp.id('s7'), '{}'::uuid[]);
select pg_temp.expect($q$select public.approve_event_submission(pg_temp.id('s3'), '{}'::uuid[])$q$,
  '22023', 'approve: submitted Boston + borough rejected');
select pg_temp.expect($q$select public.approve_event_submission(pg_temp.id('s4'), '{}'::uuid[])$q$,
  '22023', 'approve: explicit edited Boston + borough rejected');
select pg_temp.expect($q$select public.approve_event_submission(pg_temp.id('s8'), '{}'::uuid[])$q$,
  '22023', 'approve: unknown borough rejected');
select pg_temp.eq('approve replay returns same event', public.approve_event_submission(pg_temp.id('s1'), '{}'::uuid[]), pg_temp.id('ev_s1'));
reset role;
select pg_temp.eq('approve persists borough', (select sublocation from public.events where id = pg_temp.id('ev_s1')), 'bronx');
select pg_temp.eq('approve keeps moderator provenance', (select source_type from public.events where id = pg_temp.id('ev_s1')), 'moderator');
select pg_temp.eq('approve: edit moved city off NYC -> borough cleared', (select sublocation from public.events where id = pg_temp.id('ev_s2')), null::text);
select pg_temp.eq('approve: edit moved city off NYC -> city saved', (select city from public.events where id = pg_temp.id('ev_s2')), 'boston');
select pg_temp.eq('approve: unrelated edit keeps submitted borough', (select sublocation from public.events where id = pg_temp.id('ev_s5')), 'queens');
select pg_temp.eq('approve: unrelated edit applied', (select title from public.events where id = pg_temp.id('ev_s5')), 'Smoke S5 edited');
select pg_temp.eq('approve: All NYC stays NULL', (select sublocation from public.events where id = pg_temp.id('ev_s6')), null::text);
select pg_temp.eq('approve: edited null borough clears', (select sublocation from public.events where id = pg_temp.id('ev_s7')), null::text);
select pg_temp.eq('approve: rejected submissions stay pending', (select count(*)::int from public.event_submissions
  where id in (pg_temp.id('s3'), pg_temp.id('s4'), pg_temp.id('s8')) and status = 'pending' and approved_event_id is null), 3);
select pg_temp.eq('approve: rejected submissions created no events', (select count(*)::int from public.events
  where title in ('Smoke S3', 'Smoke S4', 'Smoke S8')), 0);

-- ---------------------------------------------------------------------------
-- 7. Multiple-flyer layout only: the borough patch must not disturb flyers
-- ---------------------------------------------------------------------------
\if :has_flyers
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
insert into smoke_ids select 'e_fly', public.save_event_with_entities(null,
  '{"title":"Smoke Flyers","event_types":["social"],"city":"new-york-city","event_date":"2026-12-11T20:00:00Z",
    "sublocation":"brooklyn","image_urls":["https://example.test/a.jpg","https://example.test/b.jpg"]}'::jsonb, true);
insert into smoke_ids select 'o_fly', public.organizer_create_event(pg_temp.id('org'),
  '{"title":"Smoke Org Flyers","event_types":["social"],"city":"new-york-city","event_date":"2026-12-12T20:00:00Z",
    "sublocation":"staten-island","image_urls":["https://example.test/o1.jpg","https://example.test/o2.jpg"]}'::jsonb, true);
select public.save_event_with_entities(pg_temp.id('e_fly'), '{"sublocation":"queens"}'::jsonb, null);
select public.organizer_update_event(pg_temp.id('o_fly'), '{"sublocation":"queens"}'::jsonb);
reset role;
select pg_temp.eq('flyers: save create keeps list + borough', (select image_urls from public.events where id = pg_temp.id('e_fly')),
  array['https://example.test/a.jpg','https://example.test/b.jpg']);
select pg_temp.eq('flyers: save borough-only update keeps list', (select sublocation || ':' || cardinality(image_urls) from public.events where id = pg_temp.id('e_fly')), 'queens:2');
select pg_temp.eq('flyers: organizer create keeps list + borough', (select sublocation || ':' || cardinality(image_urls) from public.events where id = pg_temp.id('o_fly')), 'queens:2');
select pg_temp.eq('flyers: primary image_url still image_urls[1]', (select image_url from public.events where id = pg_temp.id('e_fly')), 'https://example.test/a.jpg');
select pg_temp.as_user(pg_temp.id('admin'), 'admin');
select public.save_event_with_entities(pg_temp.id('e_fly'), '{"city":"boston"}'::jsonb, null);
reset role;
select pg_temp.eq('flyers: leaving NYC clears borough, keeps list', (select coalesce(sublocation, 'null') || ':' || cardinality(image_urls) from public.events where id = pg_temp.id('e_fly')), 'null:2');
\else
do $$ begin raise notice 'skip  flyer checks (no multiple-flyers layout)'; end $$;
\endif

do $$ begin raise notice 'ALL NYC SUBLOCATION CHECKS PASSED (rolling back)'; end $$;
rollback;

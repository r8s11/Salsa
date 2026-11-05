-- Curated neighborhood persistence: transaction-wrapped local Supabase smoke.
-- Requires 20261028120200_event_neighborhoods.sql; all fixtures roll back.
-- Run with: docker exec -i supabase_db_Salsa psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/manual/event-neighborhoods-smoke.sql

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, aud, role, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000000c1', 'neighborhood-mod@example.test', 'authenticated', 'authenticated', '{"role":"moderator"}'),
  ('00000000-0000-4000-8000-0000000000c2', 'neighborhood-host@example.test', 'authenticated', 'authenticated', '{"role":"organizer"}');
insert into public.profiles (id)
select id from auth.users where email like 'neighborhood-%@example.test'
on conflict (id) do nothing;
insert into public.organizers (name, slug, instagram, primary_city)
values ('Neighborhood Smoke Org', 'neighborhood-smoke-org', 'neighborhoodsmoke', 'Boston');
insert into public.organizer_members (organizer_id, user_id, member_role)
select o.id, '00000000-0000-4000-8000-0000000000c2', 'owner'
from public.organizers o where o.slug = 'neighborhood-smoke-org';

insert into public.event_submissions (id, submitted_data) values
  ('00000000-0000-4000-8000-0000000000c3',
   '{"title":"Submission Neighborhood Smoke","event_type":"social","city":"new-york-city","sublocation":"manhattan","neighborhood":"harlem","event_date":"2030-05-04T20:00:00Z"}'),
  ('00000000-0000-4000-8000-0000000000c4',
   '{"title":"Submission Parent Edit Smoke","event_type":"social","city":"new-york-city","sublocation":"manhattan","neighborhood":"harlem","event_date":"2030-05-05T20:00:00Z"}');

do $$
declare
  v_id uuid;
  v_ok boolean := false;
  v_area text;
begin
  assert (select count(*) from public.event_neighborhood_catalog()) = 51,
    'database catalog matches curated application catalog';
  assert public.event_neighborhood_valid('new-york-city', 'manhattan', 'harlem'), 'valid NYC child';
  assert not public.event_neighborhood_valid('new-york-city', 'brooklyn', 'harlem'), 'borough mismatch rejected';
  assert public.event_neighborhood_valid('boston', null, 'back-bay'), 'valid city-level child';
  assert not public.event_neighborhood_valid('boston', 'brooklyn', 'back-bay'), 'borough unsupported outside NYC';

  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated","email":"neighborhood-mod@example.test","app_metadata":{"role":"moderator"}}', true);
  execute 'set local role authenticated';
  v_id := public.save_event_with_entities(null,
    '{"title":"Neighborhood Smoke","event_type":"social","city":"new-york-city","sublocation":"manhattan","neighborhood":"harlem","event_date":"2030-05-01T20:00:00Z"}', true);
  assert (select neighborhood = 'harlem' from public.events where id = v_id), 'moderator RPC persists curated child';

  -- Public projection exposes the stored child to anonymous readers.
  execute 'reset role';
  execute 'set local role anon';
  select neighborhood into v_area from public.public_events where id = v_id;
  assert v_area = 'harlem', 'approved public view exposes neighborhood';
  execute 'reset role';
  execute 'set local role authenticated';

  -- Moving the parent without a new child clears stale assignment.
  perform public.save_event_with_entities(v_id, '{"sublocation":"brooklyn"}', null);
  assert (select neighborhood is null from public.events where id = v_id), 'borough change clears old neighborhood';
  perform public.save_event_with_entities(v_id, '{"neighborhood":"bushwick"}', null);
  assert (select neighborhood = 'bushwick' from public.events where id = v_id), 'valid replacement persists';

  begin
    perform public.save_event_with_entities(v_id, '{"neighborhood":"harlem"}', null);
  exception when sqlstate '22023' then v_ok := true;
  end;
  assert v_ok, 'RPC rejects child from another borough';

  -- Moving the city and borough without an explicit child also clears it.
  perform public.save_event_with_entities(v_id, '{"city":"boston","sublocation":null}', null);
  assert (select neighborhood is null and sublocation is null from public.events where id = v_id), 'city change clears stale child and borough';
  perform public.save_event_with_entities(v_id, '{"neighborhood":"back-bay"}', null);
  assert (select neighborhood = 'back-bay' from public.events where id = v_id), 'non-NYC city-level child persists';

  v_ok := false;
  begin
    perform public.save_event_with_entities(v_id, '{"neighborhood":"astoria"}', null);
  exception when sqlstate '22023' then v_ok := true;
  end;
  assert v_ok, 'RPC rejects child from another city';
  execute 'reset role';
  update public.events set city = 'atlanta' where id = v_id;
  assert (select neighborhood is null from public.events where id = v_id), 'direct parent update clears stale neighborhood';
end $$;

-- Submission approval persists trusted neighborhood data and clears a stale child on moderator parent edits.
do $$
declare
  v_id uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated","email":"neighborhood-mod@example.test","app_metadata":{"role":"moderator"}}', true);
  execute 'set local role authenticated';
  v_id := public.approve_event_submission('00000000-0000-4000-8000-0000000000c3', '{}');
  assert (select neighborhood = 'harlem' and sublocation = 'manhattan' from public.events where id = v_id),
    'submission approval persists neighborhood';

  update public.event_submissions
     set edited_data = '{"sublocation":"brooklyn"}'
   where id = '00000000-0000-4000-8000-0000000000c4';
  v_id := public.approve_event_submission('00000000-0000-4000-8000-0000000000c4', '{}');
  assert (select neighborhood is null and sublocation = 'brooklyn' from public.events where id = v_id),
    'submission approval clears neighborhood when edited borough changes';
  execute 'reset role';
end $$;

-- Organizer create/edit RPCs accept only catalog-consistent children.
do $$
declare
  v_org uuid;
  v_id uuid;
  v_ok boolean := false;
begin
  select id into v_org from public.organizers where slug = 'neighborhood-smoke-org';
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated","email":"neighborhood-host@example.test","app_metadata":{"role":"organizer"}}', true);
  execute 'set local role authenticated';

  v_id := public.organizer_create_event(v_org,
    '{"title":"Organizer Neighborhood Smoke","event_type":"social","city":"new-york-city","sublocation":"queens","neighborhood":"astoria","event_date":"2030-05-06T20:00:00Z"}'::jsonb, false);
  assert (select neighborhood = 'astoria' and sublocation = 'queens' from public.events where id = v_id),
    'organizer create persists neighborhood';

  perform public.organizer_update_event(v_id, '{"sublocation":"brooklyn"}'::jsonb);
  assert (select neighborhood is null and sublocation = 'brooklyn' from public.events where id = v_id),
    'organizer borough edit clears stale neighborhood';
  perform public.organizer_update_event(v_id, '{"neighborhood":"bushwick"}'::jsonb);
  assert (select neighborhood = 'bushwick' from public.events where id = v_id),
    'organizer edit persists replacement neighborhood';

  begin
    perform public.organizer_update_event(v_id, '{"neighborhood":"harlem"}'::jsonb);
  exception when sqlstate '22023' then v_ok := true;
  end;
  assert v_ok, 'organizer RPC rejects neighborhood outside current borough';
  execute 'reset role';
end $$;

-- Table constraints independently reject invalid direct writes (no RPC bypass).
do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.events (title, event_type, event_types, event_date, city, status, source_type, neighborhood)
    values ('Invalid Neighborhood Smoke', 'social', array['social'], '2030-05-03T20:00:00Z',
            'boston', 'draft', 'imported', 'harlem');
  exception when check_violation or sqlstate '22023' then v_rejected := true;
  end;
  assert v_rejected, 'table constraint rejects invalid direct city/neighborhood pairing';
end $$;

-- Trigger order: moving an event out of NYC with an explicit new neighborhood
-- must succeed even though the old borough is still on the row when validation
-- would otherwise run (normalizers clear the stale borough first).
do $$
declare
  v_id uuid;
  v_row public.events%rowtype;
begin
  insert into public.events (title, event_type, event_types, event_date, city, sublocation, neighborhood, status, source_type)
  values ('Trigger Order Smoke', 'social', array['social'], '2030-05-06T20:00:00Z',
          'new-york-city', 'brooklyn', 'williamsburg', 'draft', 'imported')
  returning id into v_id;
  update public.events set city = 'boston', neighborhood = 'back-bay' where id = v_id;
  select * into v_row from public.events where id = v_id;
  assert v_row.city = 'boston' and v_row.sublocation is null and v_row.neighborhood = 'back-bay',
    'city move clears stale borough and accepts the explicit new neighborhood';
  update public.events set city = 'new-york-city', sublocation = 'manhattan' where id = v_id;
  select * into v_row from public.events where id = v_id;
  assert v_row.neighborhood is null, 'a changed parent clears the previous child';
end $$;


-- Grants/provenance boundaries remain intact.
do $$
begin
  assert has_column_privilege('authenticated', 'public.events', 'neighborhood', 'update'), 'authenticated can update neighborhood column';
  assert not has_column_privilege('authenticated', 'public.events', 'source_type', 'update'), 'source_type remains protected';
  assert has_table_privilege('anon', 'public.public_events', 'select'), 'anonymous public projection read retained';
  assert has_function_privilege('authenticated', 'public.save_event_with_entities(uuid,jsonb,boolean)', 'execute'), 'moderator/admin RPC grant retained';
  assert not has_function_privilege('anon', 'public.save_event_with_entities(uuid,jsonb,boolean)', 'execute'), 'write RPC not exposed to anon';
end $$;

rollback;
\echo 'EVENT NEIGHBORHOODS SMOKE OK'

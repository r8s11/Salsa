-- Run as postgres (or an equivalent migration owner able to SET ROLE):
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/weekly_itineraries.sql
-- Requires the actual migrated schema; no pgTAP, permanent fixtures or storage files.
\set ON_ERROR_STOP on
begin;

-- Test-only helper: execute with the caller's role and require the exact SQLSTATE.
create function pg_temp.expect_sqlstate(statement text, expected text)
returns void language plpgsql as $$
declare actual text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual = expected then return; end if;
    raise exception 'Expected SQLSTATE %, got %: %', expected, actual, sqlerrm;
  end;
  raise exception 'Expected SQLSTATE %, statement succeeded: %', expected, statement;
end $$;
grant execute on function pg_temp.expect_sqlstate(text, text) to anon, authenticated;

-- Like expect_sqlstate, but accepts any of several codes. Writes against the
-- public projections are rejected by permission (42501) or by the view being
-- non-auto-updatable (0A000/42809/55000) depending on Postgres' evaluation
-- order; the invariant is only that the write never happens.
create function pg_temp.expect_refused(statement text, variadic expected text[])
returns void language plpgsql as $$
declare actual text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual = any (expected) then return; end if;
    raise exception 'Expected one of SQLSTATE %, got %: %', expected, actual, sqlerrm;
  end;
  raise exception 'Expected refusal, statement succeeded: %', statement;
end $$;
grant execute on function pg_temp.expect_refused(text, text[]) to anon, authenticated;

do $$
#variable_conflict use_variable
declare
  moderator_id uuid := gen_random_uuid();
  suspended_id uuid := gen_random_uuid();
  ordinary_id uuid := gen_random_uuid();
  city text := 'itinerary-test-' || gen_random_uuid();
  other_city text := 'itinerary-other-' || gen_random_uuid();
  friday_id uuid := gen_random_uuid();
  same_night_id uuid := gen_random_uuid();
  saturday_id uuid := gen_random_uuid();
  sunday_id uuid := gen_random_uuid();
  itinerary_id uuid;
  replacement_id uuid;
  payload jsonb;
  cover_url text;
  first_published_at timestamptz;
  columns text[];
  changed text;
begin
  execute format('grant usage on schema %I to anon, authenticated',
    (select nspname from pg_namespace where oid = pg_my_temp_schema()));
  -- Check the real public contract, not SQL source layout. No creator/item IDs
  -- or internal timestamps may accidentally become new public columns.
  select array_agg(column_name::text order by ordinal_position) into columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_itineraries';
  if columns is distinct from array['id','city','week_start','time_zone','title',
      'description','recommendations','unfeatured_days','cover_image_url','published_at','updated_at'] then
    raise exception 'Unexpected public_itineraries columns: %', columns;
  end if;
  select array_agg(column_name::text order by ordinal_position) into columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_itinerary_items';
  if columns is distinct from array['itinerary_id','event_id','role','position','note'] then
    raise exception 'Unexpected public_itinerary_items columns: %', columns;
  end if;

  -- Grant boundary: no client role holds a write grant on a raw table or a
  -- projection, anon keeps read access only through the two projections, and
  -- anon never reaches the raw itinerary rows directly.
  if exists (
    select 1
    from (values ('anon'), ('authenticated')) r(grantee),
         (values ('itineraries'), ('itinerary_items')) t(tbl),
         (values ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
    where has_table_privilege(r.grantee::name, 'public.' || t.tbl, p.priv)
  ) or exists (
    select 1
    from (values ('anon'), ('authenticated')) r(grantee),
         (values ('public_itineraries'), ('public_itinerary_items')) v(vw),
         (values ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
    where has_table_privilege(r.grantee::name, 'public.' || v.vw, p.priv)
  ) or not has_table_privilege('anon', 'public.public_itineraries', 'SELECT')
    or not has_table_privilege('anon', 'public.public_itinerary_items', 'SELECT')
    or has_table_privilege('anon', 'public.itineraries', 'SELECT')
    or has_table_privilege('anon', 'public.itinerary_items', 'SELECT') then
    raise exception 'Itinerary privilege boundary changed';
  end if;

  -- Wall-clock cutoff: Sunday 00:30 and Monday 01:00 remain previous nights;
  -- exactly 05:00 starts the next night, even across DST in ET and PT.
  if public.itinerary_night('2026-11-15T05:30Z','America/New_York') <> date '2026-11-14'
     or public.itinerary_night('2026-11-16T06:00Z','America/New_York') <> date '2026-11-15'
     or public.itinerary_night('2026-11-16T09:59:59Z','America/New_York') <> date '2026-11-15'
     or public.itinerary_night('2026-11-16T10:00Z','America/New_York') <> date '2026-11-16'
     or public.itinerary_night('2027-03-14T09:30Z','America/New_York') <> date '2027-03-14'
     or public.itinerary_night('2026-11-01T09:30Z','America/New_York') <> date '2026-10-31'
     or public.itinerary_night('2026-11-01T10:30Z','America/New_York') <> date '2026-11-01'
     or public.itinerary_night('2027-03-14T11:30Z','America/Los_Angeles') <> date '2027-03-13'
     or public.itinerary_night('2027-03-14T12:00Z','America/Los_Angeles') <> date '2027-03-14'
     or public.itinerary_night('2026-11-01T12:30Z','America/Los_Angeles') <> date '2026-10-31'
     or public.itinerary_night('2026-11-01T13:00Z','America/Los_Angeles') <> date '2026-11-01' then
    raise exception 'Dance-night cutoff/DST regression';
  end if;

  -- All fixtures are real rows and disappear at ROLLBACK. Random IDs/slugs avoid
  -- collisions with operator data; auth signup triggers may create profiles.
  insert into auth.users(id) values (moderator_id), (suspended_id), (ordinary_id);
  insert into public.profiles(id,status) values (moderator_id,'active'),
    (suspended_id,'suspended'), (ordinary_id,'active')
  on conflict (id) do update set status = excluded.status;
  insert into public.metros(slug,name) values (city,'Itinerary SQL check'),
    (other_city,'Other itinerary SQL check');
  insert into public.events(id,title,city,event_date,status) values
    (friday_id,'Friday fixture',city,'2026-11-14T02:00Z','approved'),
    (same_night_id,'Friday alternative fixture',city,'2026-11-14T03:00Z','approved'),
    (saturday_id,'Sunday 00:30 fixture',city,'2026-11-15T05:30Z','approved'),
    (sunday_id,'Monday 01:00 fixture',city,'2026-11-16T06:00Z','approved');

  payload := jsonb_build_object('city',city,'week_start','2026-11-09',
    'time_zone','America/New_York','title','SQL behavior week',
    'status','published','created_by',ordinary_id,
    'items',jsonb_build_array(
      jsonb_build_object('event_id',friday_id,'role','featured','position',0,'note','Friday note'),
      jsonb_build_object('event_id',same_night_id,'role','alternative','position',1),
      jsonb_build_object('event_id',saturday_id,'role','featured','position',0),
      jsonb_build_object('event_id',sunday_id,'role','featured','position',0)));

  execute 'set local role anon';
  perform pg_temp.expect_sqlstate('select * from public.itineraries','42501');
  perform pg_temp.expect_sqlstate('select * from public.itinerary_items','42501');
  perform pg_temp.expect_sqlstate('select public.save_itinerary(null,''{}''::jsonb)','42501');
  perform pg_temp.expect_refused('insert into public.public_itineraries(id) values (gen_random_uuid())','42501','0A000','42809','55000');
  perform pg_temp.expect_refused('delete from public.public_itinerary_items','42501','0A000','42809','55000');
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',ordinary_id,
    'app_metadata',jsonb_build_object('role','user'))::text,true);
  perform pg_temp.expect_sqlstate(format('select public.save_itinerary(null,%L::jsonb)',payload),'42501');
  perform pg_temp.expect_sqlstate('select public.set_itinerary_cover(gen_random_uuid(),''https://example.test/x'')','42501');
  perform pg_temp.expect_sqlstate('select public.set_itinerary_status(gen_random_uuid(),''published'')','42501');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',suspended_id,
    'app_metadata',jsonb_build_object('role','moderator'))::text,true);
  perform pg_temp.expect_sqlstate(format('select public.save_itinerary(null,%L::jsonb)',payload),'42501');
  perform pg_temp.expect_sqlstate('select public.set_itinerary_cover(gen_random_uuid(),''https://example.test/x'')','42501');
  perform pg_temp.expect_sqlstate('select public.set_itinerary_status(gen_random_uuid(),''published'')','42501');

  perform set_config('request.jwt.claims',jsonb_build_object('sub',moderator_id,
    'app_metadata',jsonb_build_object('role','moderator'))::text,true);
  perform pg_temp.expect_sqlstate(format('select public.save_itinerary(null,%L::jsonb)',
    payload || jsonb_build_object('title','   ')),'23514');
  perform pg_temp.expect_sqlstate(format('select public.save_itinerary(null,%L::jsonb)',
    payload || jsonb_build_object('title',repeat('x',121))),'23514');
  perform pg_temp.expect_sqlstate(format('select public.save_itinerary(null,%L::jsonb)',
    payload || jsonb_build_object('time_zone','Mars/Base')),'22023');
  perform pg_temp.expect_sqlstate(format('select public.save_itinerary(null,%L::jsonb)',
    jsonb_set(payload,'{items,1,role}','"featured"')),'22023');

  itinerary_id := public.save_itinerary(null,payload);
  if not exists (select 1 from public.itineraries where id = itinerary_id
      and status = 'draft' and created_by = moderator_id and updated_by = moderator_id) then
    raise exception 'Moderator create must force draft and authenticated authorship';
  end if;
  perform pg_temp.expect_sqlstate(format('select public.save_itinerary(null,%L::jsonb)',payload),'23505');
  perform pg_temp.expect_sqlstate(format('insert into public.itineraries(city,week_start,time_zone,title) values (%L,''2026-11-16'',''America/New_York'',''bypass'')',city),'42501');
  perform pg_temp.expect_sqlstate(format('update public.itineraries set title = ''bypass'' where id = %L',itinerary_id),'42501');
  perform pg_temp.expect_sqlstate(format('delete from public.itineraries where id = %L',itinerary_id),'42501');
  perform pg_temp.expect_sqlstate(format('insert into public.itinerary_items(itinerary_id,event_id,role,position) values (%L,%L,''featured'',2)',itinerary_id,friday_id),'42501');
  perform pg_temp.expect_sqlstate(format('update public.itinerary_items set note = ''bypass'' where itinerary_id = %L',itinerary_id),'42501');
  perform pg_temp.expect_sqlstate(format('delete from public.itinerary_items where itinerary_id = %L',itinerary_id),'42501');
  perform pg_temp.expect_sqlstate(format('select public.set_itinerary_status(%L,''published'')',itinerary_id),'22023');
  execute 'reset role';

  execute 'set local role anon';
  if exists (select 1 from public.public_itineraries where id = itinerary_id)
     or exists (select 1 from public.public_itinerary_items where public_itinerary_items.itinerary_id = itinerary_id) then
    raise exception 'Draft must be invisible anonymously';
  end if;
  execute 'reset role';

  execute 'set local role authenticated';
  cover_url := 'https://arbitrary-host.example:443/storage/v1/object/public/itinerary-covers/' || itinerary_id || '/abcdef12.jpg';
  foreach changed in array array['http://example.test','https://evil?','https://evil#','https://evil@'] loop
    perform pg_temp.expect_sqlstate(format('select public.set_itinerary_cover(%L,%L)',itinerary_id,
      changed || '/storage/v1/object/public/itinerary-covers/' || itinerary_id || '/abcdef12.jpg'),'22023');
  end loop;
  perform pg_temp.expect_sqlstate(format('select public.set_itinerary_cover(%L,%L)',itinerary_id,
    'https://example.test/storage/v1/object/public/itinerary-covers/' || gen_random_uuid() || '/abcdef12.jpg'),'22023');
  perform public.set_itinerary_cover(itinerary_id,cover_url);
  first_published_at := public.set_itinerary_status(itinerary_id,'published');
  if first_published_at is null then raise exception 'Publish must return published_at'; end if;
  perform pg_temp.expect_sqlstate(format('select public.set_itinerary_status(%L,''published'')',itinerary_id),'22023');
  perform pg_temp.expect_sqlstate(format('select public.save_itinerary(%L,%L::jsonb)',itinerary_id,
    payload || jsonb_build_object('items','[]'::jsonb)),'22023');
  foreach changed in array array['city','week_start','time_zone'] loop
    perform pg_temp.expect_sqlstate(format('select public.save_itinerary(%L,%L::jsonb)',itinerary_id,
      payload || jsonb_build_object(changed,case changed when 'city' then other_city
        when 'week_start' then '2026-11-16' else 'America/Los_Angeles' end)),'22023');
  end loop;
  execute 'reset role';

  execute 'set local role anon';
  if (select cover_image_url from public.public_itineraries where id = itinerary_id) is distinct from cover_url
     or (select count(*) from public.public_itinerary_items where public_itinerary_items.itinerary_id = itinerary_id) <> 4 then
    raise exception 'Published guide and fresh cover must be public';
  end if;
  execute 'reset role';

  -- Each independent change must remove the row AND suppress old JPEG facts on
  -- fresh anonymous reads, even though the stored cover URL remains present.
  foreach changed in array array['pending','cancelled','city','week'] loop
    update public.events set status = case when changed in ('pending','cancelled') then changed else 'approved' end,
      city = case when changed = 'city' then other_city else city end,
      event_date = case when changed = 'week' then '2026-11-16T10:00Z'::timestamptz else '2026-11-14T02:00Z'::timestamptz end
    where id = friday_id;
    execute 'set local role anon';
    if exists (select 1 from public.public_itinerary_items where public_itinerary_items.itinerary_id = itinerary_id and event_id = friday_id)
       or (select cover_image_url from public.public_itineraries where id = itinerary_id) is not null then
      raise exception 'Public event/cover leaked after % change', changed;
    end if;
    execute 'reset role';
    execute 'set local role authenticated';
    perform public.set_itinerary_status(itinerary_id,'draft');
    perform pg_temp.expect_sqlstate(format('select public.set_itinerary_status(%L,''published'')',itinerary_id),'22023');
    execute 'reset role';
    update public.events set status = 'approved', city = payload->>'city', event_date = '2026-11-14T02:00Z' where id = friday_id;
    execute 'set local role authenticated';
    perform public.set_itinerary_cover(itinerary_id,cover_url);
    if public.set_itinerary_status(itinerary_id,'published') is distinct from first_published_at then
      raise exception 'Republish must retain original published_at';
    end if;
    execute 'reset role';
  end loop;

  -- Use a deterministic older generation instant: now() is transaction-stable,
  -- so sleeping would not test updated_at freshness in this rollback transaction.
  update public.itineraries set cover_generated_at = now() - interval '1 day' where id = itinerary_id;
  update public.events set title = 'Updated featured fixture' where id = friday_id;
  execute 'set local role anon';
  if (select cover_image_url from public.public_itineraries where id = itinerary_id) is not null
     or not exists (select 1 from public.public_itinerary_items where public_itinerary_items.itinerary_id = itinerary_id and event_id = friday_id) then
    raise exception 'Featured fact change must suppress only stale cover, not valid item';
  end if;
  execute 'reset role';
  execute 'set local role authenticated';
  perform public.set_itinerary_cover(itinerary_id,cover_url);
  execute 'reset role';

  -- Hard delete cascades the item away: no remaining join can detect its old
  -- printed facts, so the delete trigger must clear the stored reference itself.
  delete from public.events where id = saturday_id;
  if exists (select 1 from public.itinerary_items where event_id = saturday_id)
     or exists (select 1 from public.itineraries where id = itinerary_id
       and (cover_image_url is not null or cover_generated_at is not null)) then
    raise exception 'Hard-deleted item must invalidate parent cover and generation time';
  end if;
  execute 'set local role anon';
  if (select cover_image_url from public.public_itineraries where id = itinerary_id) is not null
     or exists (select 1 from public.public_itinerary_items where event_id = saturday_id)
     or (select count(*) from public.public_itinerary_items where public_itinerary_items.itinerary_id = itinerary_id) <> 3 then
    raise exception 'Deletion must remove only the deleted event and suppress cover';
  end if;
  execute 'reset role';

  execute 'set local role authenticated';
  -- Normal save replaces items; old cover must also be invalidated atomically.
  payload := jsonb_set(payload,'{items}',(payload->'items') - 2);
  perform public.set_itinerary_cover(itinerary_id,cover_url);
  perform public.save_itinerary(itinerary_id,payload);
  if exists (select 1 from public.itineraries where id = itinerary_id and cover_image_url is not null) then
    raise exception 'Full item replacement must invalidate old cover';
  end if;
  perform public.set_itinerary_status(itinerary_id,'archived');
  perform pg_temp.expect_sqlstate(format('select public.set_itinerary_status(%L,''draft'')',itinerary_id),'22023');
  perform pg_temp.expect_sqlstate(format('select public.set_itinerary_status(%L,''published'')',itinerary_id),'22023');
  perform pg_temp.expect_sqlstate(format('select public.save_itinerary(%L,%L::jsonb)',itinerary_id,payload),'22023');
  perform pg_temp.expect_sqlstate(format('select public.set_itinerary_cover(%L,%L)',itinerary_id,cover_url),'22023');
  replacement_id := public.save_itinerary(null,payload);
  perform public.set_itinerary_status(replacement_id,'archived');
  execute 'reset role';

  execute 'set local role anon';
  if exists (select 1 from public.public_itineraries where id in (itinerary_id,replacement_id))
     or exists (select 1 from public.public_itinerary_items where public_itinerary_items.itinerary_id in (itinerary_id,replacement_id)) then
    raise exception 'Archived guides and their items must be invisible';
  end if;
  execute 'reset role';
  raise notice 'Weekly itinerary SQL behavior assertions passed; all fixtures will roll back';
end $$;

rollback;

-- Disposable migrated database only; all fixture changes roll back.
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/listing_requests.sql
\set ON_ERROR_STOP on
begin;
create schema lr_test;

create function lr_test.ok(p_ok boolean, p_label text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'FAILED: %', p_label; end if; end $$;

-- Runs one statement as a client role with the given JWT, returning its single text result.
create function lr_test.run(p_role text, p_uid uuid, p_admin boolean, p_sql text) returns text language plpgsql as $$
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

create function lr_test.fails(p_role text, p_uid uuid, p_admin boolean, p_sql text, p_state text, p_label text)
returns void language plpgsql as $$
declare s text; m text;
begin
  begin
    perform lr_test.run(p_role, p_uid, p_admin, p_sql);
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
  manager uuid := gen_random_uuid(); editor uuid := gen_random_uuid(); venue_mgr uuid := gen_random_uuid();
  admin_u uuid := gen_random_uuid(); stranger uuid := gen_random_uuid(); suspended uuid := gen_random_uuid();
  organizer_user uuid := gen_random_uuid();
  artist uuid := gen_random_uuid(); dj uuid := gen_random_uuid(); venue uuid := gen_random_uuid();
  organizer uuid := gen_random_uuid();
  ev uuid := gen_random_uuid(); ev_cancel uuid := gen_random_uuid(); ev_draft uuid := gen_random_uuid();
  ev_linked uuid := gen_random_uuid(); ev_dj uuid := gen_random_uuid();
  tag text := 'lrq-' || gen_random_uuid();
  city text := 'Lrq City ' || tag;
  link_req uuid; cancel_req uuid; dj_req uuid; missing_req uuid; change_req uuid; spare uuid;
  event_before text; members_before bigint; organizer_members_before bigint; rows_before bigint;
  listed jsonb; mine jsonb; i int;
begin
  insert into auth.users (id, email, email_confirmed_at)
  select u, 'lrq-' || u || '@example.test', now()
    from unnest(array[manager, editor, venue_mgr, admin_u, stranger, suspended, organizer_user]) u;
  insert into public.profiles (id, status, display_name)
  select u, case when u = suspended then 'suspended' else 'active' end, case when u = manager then 'Ana Manager' end
    from unnest(array[manager, editor, venue_mgr, admin_u, stranger, suspended, organizer_user]) u
  on conflict (id) do update set status = excluded.status, display_name = coalesce(excluded.display_name, profiles.display_name);

  insert into public.instructors (id, name, slug, status, city) values (artist, 'Ritmo Artist ' || tag, 'a-' || tag, 'active', city);
  insert into public.djs (id, name, slug, status, city) values (dj, 'DJ ' || tag, 'd-' || tag, 'active', city);
  insert into public.venues (id, name, slug, status, city) values (venue, 'Casa Cuba ' || tag, 'v-' || tag, 'active', city);
  insert into public.organizers (id, name) values (organizer, 'Unrelated Promotions');
  insert into public.organizer_members (organizer_id, user_id) values (organizer, organizer_user);
  insert into public.entity_members (entity_kind, entity_id, user_id, member_role) values
    ('instructor', artist, manager, 'manager'), ('instructor', artist, editor, 'editor'),
    ('dj', dj, manager, 'owner'), ('venue', venue, venue_mgr, 'manager');
  insert into public.events (id, title, city, event_date, status, event_type, organizer_id, location) values
    (ev, 'Friday Social ' || tag, 'boston', now() + interval '3 days', 'approved', 'social', organizer, 'Main Hall'),
    (ev_cancel, 'Cancelled Later ' || tag, 'boston', now() + interval '4 days', 'approved', 'social', organizer, null),
    (ev_draft, 'Draft Night ' || tag, 'boston', now() + interval '5 days', 'draft', 'social', organizer, null),
    (ev_linked, 'Already Linked ' || tag, 'boston', now() + interval '6 days', 'approved', 'social', organizer, null),
    (ev_dj, 'DJ Night ' || tag, 'boston', now() + interval '7 days', 'approved', 'social', organizer, null);
  insert into public.event_instructors (event_id, instructor_id, position) values (ev_linked, artist, 0);

  -- Anonymous callers and direct table access.
  perform lr_test.fails('anon', null, false,
    format('select public.listing_request_submit_missing(%L, %L, null, null, null, null, true)::text', 'venue', 'Anon Place'),
    '42501', 'anonymous missing-listing submit');
  perform lr_test.fails('anon', null, false, 'select public.my_listing_requests()::text', '42501', 'anonymous read');
  perform lr_test.fails('authenticated', manager, false, 'select count(*)::text from public.listing_requests', '42501', 'direct table read');
  perform lr_test.fails('authenticated', manager, false,
    format('insert into public.listing_requests (request_type, requester_id, entity_kind, proposed_name) values (%L, %L, %L, %L) returning id::text',
      'missing_listing', manager, 'venue', 'Direct Write'), '42501', 'direct table write');
  perform lr_test.fails('authenticated', suspended, false,
    format('select public.listing_request_submit_missing(%L, %L, null, null, null, null, true)::text', 'venue', 'Suspended Place'),
    '42501', 'suspended account submit');
  perform lr_test.ok(not has_function_privilege('authenticated', 'public.listing_request_assert_can_submit()', 'execute'), 'internal guard is callable by clients');
  perform lr_test.ok(not has_function_privilege('anon', 'public.admin_review_listing_request(uuid,boolean,text,uuid)', 'execute'), 'anon can execute review');

  -- Missing listing: input boundaries and the existing-listing check.
  perform lr_test.fails('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, null, null, null, false)::text', 'venue', 'Casa Habana ' || tag, city),
    '22023', 'missing listing without the searched confirmation');
  perform lr_test.fails('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, null, null, null, true)::text', 'organizer', 'Casa Habana ' || tag, city),
    '22023', 'missing listing of an unsupported kind');
  perform lr_test.fails('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, null, null, null, true)::text', 'venue', '   ', city),
    '22023', 'missing listing with a blank name');
  perform lr_test.fails('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, null, null, null, true)::text',
      'venue', '  casa   CUBA ' || upper(tag) || '!! ', upper(city)),
    '23505', 'missing listing matching an existing name by case, spacing and punctuation');
  perform lr_test.fails('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, null, null, null, null, true)::text', 'venue', 'CASA CUBA ' || tag || '.'),
    '23505', 'missing listing matching an existing name with no city given');
  perform lr_test.fails('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, null, null, null, true)::text', 'venue', repeat('x', 201), city),
    '23514', 'missing listing name over 200 characters');
  perform lr_test.fails('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, null, null, %L, true)::text', 'venue', 'Casa Habana ' || tag, city, repeat('d', 2001)),
    '23514', 'missing listing details over 2000 characters');
  perform lr_test.fails('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, %L, null, null, true)::text', 'venue', 'Casa Habana ' || tag, city, 'javascript:alert(1)'),
    '22023', 'missing listing with a non-https website');
  -- The same name as a venue is fine for a different kind.
  spare := lr_test.run('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, null, null, null, true)::text', 'school', 'Casa Cuba ' || tag, city))::uuid;
  missing_req := lr_test.run('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, %L, %L, %L, true)::text',
      'venue', '  Casa Habana ' || tag || ' ', city, 'https://casahabana.example', '@casahabana', '<b>markup</b> stays text'))::uuid;
  perform lr_test.ok((select proposed_name = 'Casa Habana ' || tag and status = 'pending' and requester_id = stranger
    and details = '<b>markup</b> stays text' from public.listing_requests where id = missing_req), 'missing listing stored trimmed and pending');
  perform lr_test.fails('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, null, null, null, true)::text', 'venue', 'casa habana ' || tag, city),
    '23505', 'repeat of a pending missing-listing request');

  -- Pending cap: ten waiting requests per person; a withdrawal frees a slot but keeps history.
  for i in 3..10 loop
    perform lr_test.run('authenticated', stranger, false,
      format('select public.listing_request_submit_missing(%L, %L, %L, null, null, null, true)::text', 'dj', 'Cap ' || i || ' ' || tag, city));
  end loop;
  perform lr_test.fails('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, null, null, null, true)::text', 'dj', 'Cap 11 ' || tag, city),
    '23514', 'eleventh pending request');
  perform lr_test.run('authenticated', stranger, false, format('select public.listing_request_withdraw(%L)::text', spare));
  perform lr_test.ok((select status = 'withdrawn' from public.listing_requests where id = spare), 'withdrawal erased or left the request pending');
  perform lr_test.fails('authenticated', stranger, false, format('select public.listing_request_withdraw(%L)::text', spare),
    '23514', 'withdrawing twice');
  perform lr_test.run('authenticated', stranger, false,
    format('select public.listing_request_submit_missing(%L, %L, %L, null, null, null, true)::text', 'dj', 'Cap 11 ' || tag, city));

  -- Event links: only an owner or manager of that Artist/DJ.
  select count(*) into rows_before from public.listing_requests;
  perform lr_test.fails('authenticated', venue_mgr, false,
    format('select public.listing_request_submit_event_link(%L, %L, %L, null)::text', 'venue', venue, ev), '42501', 'venue manager linking an event to their venue');
  perform lr_test.fails('authenticated', venue_mgr, false,
    format('select public.listing_request_submit_event_link(%L, %L, %L, null)::text', 'instructor', artist, ev), '42501', 'venue manager linking an event to an artist');
  perform lr_test.fails('authenticated', editor, false,
    format('select public.listing_request_submit_event_link(%L, %L, %L, null)::text', 'instructor', artist, ev), '42501', 'editor linking an event');
  perform lr_test.fails('authenticated', manager, false,
    format('select public.listing_request_submit_event_link(%L, %L, %L, null)::text', 'instructor', artist, ev_draft), 'P0002', 'link to an unapproved event');
  perform lr_test.fails('authenticated', manager, false,
    format('select public.listing_request_submit_event_link(%L, %L, %L, null)::text', 'instructor', artist, ev_linked), '23505', 'link that already exists');
  perform lr_test.fails('authenticated', venue_mgr, false,
    format('select public.listing_request_event_candidates(%L, %L, %L)::text', 'instructor', artist, tag), '42501', 'venue manager searching artist candidates');
  perform lr_test.ok((select count(*) from public.listing_requests) = rows_before, 'a refused event link wrote a row');

  listed := lr_test.run('authenticated', manager, false,
    format('select public.listing_request_event_candidates(%L, %L, %L)::text', 'instructor', artist, tag))::jsonb;
  perform lr_test.ok(listed @> jsonb_build_array(jsonb_build_object('id', ev, 'location', 'Main Hall')), 'approved unlinked event missing from candidates');
  perform lr_test.ok(not listed @> jsonb_build_array(jsonb_build_object('id', ev_linked))
    and not listed @> jsonb_build_array(jsonb_build_object('id', ev_draft)), 'linked or draft event offered as a candidate');

  link_req := lr_test.run('authenticated', manager, false,
    format('select public.listing_request_submit_event_link(%L, %L, %L, %L)::text', 'instructor', artist, ev, '  Teaching the pre-social class  '))::uuid;
  perform lr_test.fails('authenticated', manager, false,
    format('select public.listing_request_submit_event_link(%L, %L, %L, null)::text', 'instructor', artist, ev), '23505', 'repeat of a pending event link');
  cancel_req := lr_test.run('authenticated', manager, false,
    format('select public.listing_request_submit_event_link(%L, %L, %L, null)::text', 'instructor', artist, ev_cancel))::uuid;
  dj_req := lr_test.run('authenticated', manager, false,
    format('select public.listing_request_submit_event_link(%L, %L, %L, null)::text', 'dj', dj, ev_dj))::uuid;

  -- Identity changes.
  perform lr_test.fails('authenticated', manager, false,
    format('select public.listing_request_submit_profile_change(%L, %L, %L, %L, %L)::text', 'instructor', artist, ' ', '', null), '22023', 'identity change with nothing asked');
  perform lr_test.fails('authenticated', editor, false,
    format('select public.listing_request_submit_profile_change(%L, %L, %L, null, null)::text', 'instructor', artist, 'New Name'), '42501', 'editor asking for an identity change');
  change_req := lr_test.run('authenticated', venue_mgr, false,
    format('select public.listing_request_submit_profile_change(%L, %L, %L, null, %L)::text', 'venue', venue, 'Casa de Cuba', 'We rebranded'))::uuid;
  perform lr_test.fails('authenticated', venue_mgr, false,
    format('select public.listing_request_submit_profile_change(%L, %L, null, %L, null)::text', 'venue', venue, 'Cambridge'), '23505', 'second pending identity change');

  -- Requests are private to their requester.
  mine := lr_test.run('authenticated', manager, false, 'select public.my_listing_requests()::text')::jsonb;
  perform lr_test.ok(jsonb_array_length(mine) = 3, 'manager does not see exactly their three requests');
  perform lr_test.ok(mine @> jsonb_build_array(jsonb_build_object('id', link_req, 'status', 'pending', 'request_type', 'event_link',
    'entity_name', 'Ritmo Artist ' || tag, 'event_title', 'Friday Social ' || tag, 'details', 'Teaching the pre-social class')), 'own event link lacks its listing and event context');
  mine := lr_test.run('authenticated', venue_mgr, false, 'select public.my_listing_requests()::text')::jsonb;
  perform lr_test.ok(jsonb_array_length(mine) = 1 and mine->0->>'id' = change_req::text, 'another caller''s requests are visible');
  perform lr_test.fails('authenticated', venue_mgr, false, format('select public.listing_request_withdraw(%L)::text', link_req), 'P0002', 'withdrawing someone else''s request');
  perform lr_test.ok((select status = 'pending' from public.listing_requests where id = link_req), 'someone else withdrew the request');

  -- Decisions: administrators only.
  perform lr_test.fails('authenticated', manager, false, format('select public.admin_review_listing_request(%L, true)::text', link_req), '42501', 'requester approving their own request');
  perform lr_test.fails('authenticated', organizer_user, false, format('select public.admin_review_listing_request(%L, true)::text', link_req), '42501', 'organizer approving a request');
  perform lr_test.fails('authenticated', manager, false, 'select public.admin_listing_requests()::text', '42501', 'non-admin reading the queue');
  perform lr_test.fails('authenticated', manager, false, 'select public.admin_pending_listing_request_count()::text', '42501', 'non-admin reading the pending count');

  listed := lr_test.run('authenticated', admin_u, true, format('select public.admin_listing_requests(%L, %L, %L)::text', 'pending', 'instructor', artist))::jsonb;
  perform lr_test.ok(jsonb_array_length(listed) = 2, 'listing-scoped queue does not hold exactly that listing''s pending requests');
  perform lr_test.ok(listed @> jsonb_build_array(jsonb_build_object('id', link_req, 'requester_id', manager, 'display_name', 'Ana Manager',
    'member_role', 'manager', 'event_organizer_name', 'Unrelated Promotions', 'event_status', 'approved', 'event_location', 'Main Hall',
    'already_linked', false)), 'reviewer context (requester, role, organizer) missing');
  perform lr_test.ok(lr_test.run('authenticated', admin_u, true, 'select public.admin_pending_listing_request_count()::text')::int
    = (select count(*) from public.listing_requests where status = 'pending'), 'pending count is wrong');

  -- Approving a link for an unrelated organizer's event changes the association only.
  select md5(e::text) into event_before from public.events e where e.id = ev;
  select count(*) into members_before from public.entity_members;
  select count(*) into organizer_members_before from public.organizer_members;
  perform lr_test.ok(lr_test.run('authenticated', admin_u, true, format('select public.admin_review_listing_request(%L, true, %L)::text', link_req, ' Confirmed with the flyer '))::jsonb
    = jsonb_build_object('request_id', link_req, 'approved', true, 'request_type', 'event_link'), 'review result shape');
  perform lr_test.ok((select count(*) = 1 from public.event_instructors where event_id = ev and instructor_id = artist), 'approval did not create exactly one association');
  perform lr_test.ok((select md5(e::text) from public.events e where e.id = ev) = event_before, 'approval changed the event');
  perform lr_test.ok((select count(*) from public.entity_members) = members_before
    and (select count(*) from public.organizer_members) = organizer_members_before, 'approval changed memberships');
  perform lr_test.ok((select status = 'approved' and reviewer_id = admin_u and review_note = 'Confirmed with the flyer' and reviewed_at is not null
    from public.listing_requests where id = link_req), 'approval not recorded on the request');
  perform lr_test.ok(exists (select 1 from public.audit_logs where entity_type = 'listing_request' and entity_id = link_req
    and action = 'listing_request.approved' and actor_id = admin_u and target_type = 'instructor' and target_id = artist), 'approval not audited');
  perform lr_test.fails('authenticated', admin_u, true, format('select public.admin_review_listing_request(%L, false)::text', link_req), '23514', 'deciding a request twice');
  perform lr_test.fails('authenticated', manager, false, format('select public.listing_request_withdraw(%L)::text', link_req), '23514', 'withdrawing a decided request');

  -- State changed between submit and review: approval refuses and the request stays pending.
  update public.events set status = 'cancelled' where id = ev_cancel;
  perform lr_test.fails('authenticated', admin_u, true, format('select public.admin_review_listing_request(%L, true)::text', cancel_req), '23514', 'approving a link to a cancelled event');
  perform lr_test.ok((select status = 'pending' from public.listing_requests where id = cancel_req)
    and not exists (select 1 from public.event_instructors where event_id = ev_cancel), 'refused approval left a trace');
  update public.entity_members set status = 'removed' where entity_kind = 'dj' and entity_id = dj;
  update public.djs set status = 'archived' where id = dj;
  perform lr_test.fails('authenticated', admin_u, true, format('select public.admin_review_listing_request(%L, true)::text', dj_req), '23514', 'approving a link to an archived listing');
  perform lr_test.ok((select status = 'pending' from public.listing_requests where id = dj_req)
    and not exists (select 1 from public.event_djs where event_id = ev_dj), 'refused archived-listing approval left a trace');
  perform lr_test.run('authenticated', admin_u, true, format('select public.admin_review_listing_request(%L, false, %L)::text', dj_req, 'Profile was archived'));
  perform lr_test.ok((select status = 'rejected' and review_note = 'Profile was archived' from public.listing_requests where id = dj_req), 'rejection not recorded');

  -- Missing listing: approval records an existing active listing and grants nothing.
  perform lr_test.fails('authenticated', admin_u, true, format('select public.admin_review_listing_request(%L, true)::text', missing_req), '22023', 'approving a missing listing without the created listing');
  perform lr_test.fails('authenticated', admin_u, true, format('select public.admin_review_listing_request(%L, true, null, %L)::text', missing_req, artist), '22023', 'recording a listing of another kind');
  select count(*) into members_before from public.entity_members where status = 'active';
  perform lr_test.run('authenticated', admin_u, true, format('select public.admin_review_listing_request(%L, true, null, %L)::text', missing_req, venue));
  perform lr_test.ok((select status = 'approved' and resulting_entity_id = venue from public.listing_requests where id = missing_req), 'created listing not recorded');
  perform lr_test.ok((select count(*) from public.entity_members where status = 'active') = members_before
    and not exists (select 1 from public.entity_claims where user_id = stranger), 'missing-listing approval granted access');
  mine := lr_test.run('authenticated', stranger, false, 'select public.my_listing_requests()::text')::jsonb;
  perform lr_test.ok(mine @> jsonb_build_array(jsonb_build_object('id', missing_req, 'status', 'approved', 'resulting_entity_slug', 'v-' || tag)), 'requester cannot find the listing to claim');

  -- Identity change approval records the decision only.
  perform lr_test.run('authenticated', admin_u, true, format('select public.admin_review_listing_request(%L, true)::text', change_req));
  perform lr_test.ok((select name = 'Casa Cuba ' || tag from public.venues where id = venue), 'identity change approval edited the listing');
end $$;
rollback;
\echo 'PASS listing requests: authority, privacy, limits, duplicates and admin decisions'

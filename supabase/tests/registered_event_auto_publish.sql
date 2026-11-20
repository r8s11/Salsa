-- Disposable migrated database only; all fixture changes roll back.
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/registered_event_auto_publish.sql
\set ON_ERROR_STOP on
begin;
create schema ap_test;

create function ap_test.ok(p_ok boolean, p_label text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'FAILED: %', p_label; end if; end $$;

-- Runs one statement as a client role with the given JWT, returning its single text result.
create function ap_test.run(p_role text, p_uid uuid, p_admin boolean, p_sql text) returns text language plpgsql as $$
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

create function ap_test.fails(p_role text, p_uid uuid, p_admin boolean, p_sql text, p_state text, p_label text)
returns void language plpgsql as $$
declare s text; m text;
begin
  begin
    perform ap_test.run(p_role, p_uid, p_admin, p_sql);
  exception when others then
    get stacked diagnostics s = returned_sqlstate, m = message_text;
    execute 'reset role';
    if s = p_state then return; end if;
    raise exception 'FAILED: % (expected %, got %: %)', p_label, p_state, s, m;
  end;
  raise exception 'FAILED: % (expected %, but it succeeded)', p_label, p_state;
end $$;

-- A pending submission owned by p_owner, inserted the way the client does.
create function ap_test.submit(p_owner uuid, p_title text, p_extra jsonb default '{}') returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  perform ap_test.run('authenticated', p_owner, false, format(
    'insert into public.event_submissions (id, submitter_id, status, submitted_data) values (%L, %L, ''pending'', %L) returning id::text',
    v, p_owner, jsonb_build_object(
      'title', p_title, 'event_type', 'social', 'event_types', jsonb_build_array('social'),
      'city', 'boston', 'event_date', (now() + interval '5 days')::text, 'recurrence', '',
      'rsvp_link', 'https://tickets.example.test/night',
      'dance_styles', jsonb_build_array('salsa', 'Bachata', 'not-a-style'),
      'entity_review', jsonb_build_object('venue', jsonb_build_object('name', 'Spoofed Venue'))) || p_extra));
  return v;
end $$;

create function ap_test.publish(p_uid uuid, p_submission uuid) returns jsonb language plpgsql as $$
begin
  return ap_test.run('authenticated', p_uid, false,
    format('select public.publish_own_event_submission(%L)::text', p_submission))::jsonb;
end $$;

create function ap_test.pending(p_submission uuid) returns boolean language sql as $$
  select status = 'pending' and approved_event_id is null from public.event_submissions where id = p_submission
$$;

do $$
#variable_conflict use_variable
declare
  member uuid := gen_random_uuid(); unverified uuid := gen_random_uuid(); suspended uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid(); admin_u uuid := gen_random_uuid();
  tag text := 'ap-' || gen_random_uuid();
  sub uuid; sub2 uuid; first_event uuid; result jsonb; ev public.events%rowtype; terms text[]; events_before bigint;
  audit public.audit_logs%rowtype;
begin
  insert into auth.users (id, email, email_confirmed_at) values
    (member, tag || '-m@example.test', now()),
    (unverified, tag || '-u@example.test', null),
    (suspended, tag || '-s@example.test', now()),
    (stranger, tag || '-x@example.test', now()),
    (admin_u, tag || '-a@example.test', now());
  insert into public.profiles (id, status) values
    (member, 'active'), (unverified, 'active'), (suspended, 'active'), (stranger, 'active'), (admin_u, 'active')
  on conflict (id) do update set status = excluded.status;

  update public.platform_settings
     set allow_registered_user_submissions = true, registered_auto_publish_enabled = false
   where singleton;

  -- Switch off: normal review.
  sub := ap_test.submit(member, 'Off Switch ' || tag);
  result := ap_test.publish(member, sub);
  perform ap_test.ok(result = '{"published": false, "reason": "disabled"}', 'switch off -> disabled: ' || result::text);
  perform ap_test.ok(ap_test.pending(sub), 'switch off keeps pending');
  perform ap_test.ok(ap_test.run('authenticated', member, false, 'select public.my_auto_publish_block_reason()') = 'disabled',
    'eligibility RPC reports disabled');

  update public.platform_settings set registered_auto_publish_enabled = true where singleton;
  perform ap_test.ok(ap_test.run('authenticated', member, false, 'select public.my_auto_publish_block_reason()') is null,
    'eligible member has no block reason');

  -- Eligible member publishes: live, user_submission, styles mapped, no spoofed links, audited.
  result := ap_test.publish(member, sub);
  perform ap_test.ok((result ->> 'published')::boolean and result ->> 'event_status' = 'approved',
    'eligible member publishes: ' || result::text);
  first_event := (result ->> 'event_id')::uuid;
  select * into ev from public.events where id = first_event;
  perform ap_test.ok(ev.status = 'approved' and ev.source_type = 'user_submission', 'event approved as user_submission');
  perform ap_test.ok(ev.venue_id is null and ev.organizer_id is null, 'submitter entity_review links nothing');
  select array_agg(t.slug order by t.slug) into terms
    from public.event_taxonomy_terms ett join public.taxonomy_terms t on t.id = ett.taxonomy_term_id
   where ett.event_id = ev.id;
  perform ap_test.ok(terms = array['bachata', 'salsa'], 'known styles mapped, unknown dropped: ' || coalesce(terms::text, 'null'));
  perform ap_test.ok((select status = 'approved' and approved_event_id = ev.id and reviewed_by = member
                        from public.event_submissions where id = sub), 'submission recorded as self-approved');
  perform ap_test.ok(exists (select 1 from public.audit_logs where action = 'event.auto_published' and entity_id = ev.id
                               and actor_id = member and target_id = sub), 'publish audited with actor and submission');

  -- Replay returns the same event and creates nothing new.
  result := ap_test.publish(member, sub);
  perform ap_test.ok(result ->> 'event_id' = ev.id::text and (result ->> 'published')::boolean, 'replay returns the same event');
  perform ap_test.ok((select count(*) from public.events where title = 'Off Switch ' || tag) = 1, 'replay creates no duplicate');

  -- Another member cannot publish it, and it reads as missing.
  sub2 := ap_test.submit(member, 'Second ' || tag);
  perform ap_test.fails('authenticated', stranger, false,
    format('select public.publish_own_event_submission(%L)::text', sub2), 'P0002', 'stranger publishing someone else''s submission');
  perform ap_test.ok(ap_test.pending(sub2), 'stranger attempt leaves it pending');

  -- Anonymous callers and direct access to the internal functions are refused.
  perform ap_test.fails('anon', null, false,
    format('select public.publish_own_event_submission(%L)::text', sub2), '42501', 'anon cannot publish');
  perform ap_test.fails('authenticated', member, false,
    format('select public.materialize_event_submission(%L, ''{}'', ''user_submission'', %L)::text', sub2, member),
    '42501', 'materializer is not client-callable');
  perform ap_test.fails('authenticated', member, false,
    format('select public.auto_publish_block_reason(%L)', member), '42501', 'block-reason helper is not client-callable');
  perform ap_test.fails('authenticated', member, false,
    format('select public.approve_event_submission(%L, ''{}'')::text', sub2), '42501', 'members still cannot use moderator approval');

  -- Repeating events, past dates and unsafe links stay in review without using quota.
  sub2 := ap_test.submit(member, 'Weekly ' || tag, '{"recurrence": "weekly"}');
  result := ap_test.publish(member, sub2);
  perform ap_test.ok(result = '{"published": false, "reason": "recurring"}', 'recurring -> review: ' || result::text);
  perform ap_test.ok(ap_test.pending(sub2), 'recurring stays pending');
  sub2 := ap_test.submit(member, 'Past ' || tag, jsonb_build_object('event_date', (now() - interval '3 days')::text));
  result := ap_test.publish(member, sub2);
  perform ap_test.ok(result = '{"published": false, "reason": "needs_review"}', 'past date -> review: ' || result::text);
  sub2 := ap_test.submit(member, 'Bad Link ' || tag, '{"rsvp_link": "javascript:alert(1)"}');
  result := ap_test.publish(member, sub2);
  perform ap_test.ok(result = '{"published": false, "reason": "needs_review"}', 'unsafe rsvp link -> review: ' || result::text);
  sub2 := ap_test.submit(member, 'Bad Flyer ' || tag, '{"image_url": "http://evil.example.test/x.png", "image_urls": ["http://evil.example.test/x.png"]}');
  result := ap_test.publish(member, sub2);
  perform ap_test.ok(result = '{"published": false, "reason": "needs_review"}', 'non-https flyer -> review: ' || result::text);
  perform ap_test.ok(ap_test.pending(sub2), 'unsafe flyer stays pending');
  sub2 := ap_test.submit(stranger, 'Incomplete ' || tag, '{"city": ""}');
  result := ap_test.publish(stranger, sub2);
  perform ap_test.ok(result = '{"published": false, "reason": "needs_review"}', 'incomplete -> review: ' || result::text);
  perform ap_test.ok(ap_test.pending(sub2) and not exists (select 1 from public.events where title = 'Incomplete ' || tag),
    'failed publish leaves no partial event or approval');

  perform ap_test.ok(ap_test.run('anon', null, false,
    format('select count(*)::text from public.public_events where id = %L', first_event)) = '1', 'published event is public');
  -- Admin takedown: guarded, reasoned, audited, idempotent; archived events are never republished.
  perform ap_test.fails('authenticated', member, false,
    format('select public.admin_take_down_event(%L, ''spam spam'')', first_event), '42501', 'members cannot take down');
  perform ap_test.fails('authenticated', admin_u, true,
    format('select public.admin_take_down_event(%L, ''  '')', first_event), '22023', 'takedown needs a reason');
  perform ap_test.ok(ap_test.run('authenticated', admin_u, true,
    format('select public.admin_take_down_event(%L, ''  Duplicate of an existing listing  '')', first_event)) = 'archived',
    'admin takes down the event');
  select * into audit from public.audit_logs where action = 'event.taken_down' and entity_id = first_event;
  perform ap_test.ok(audit.actor_id = admin_u and audit.reason = 'Duplicate of an existing listing'
    and audit.metadata ->> 'submission_id' = sub::text, 'takedown audited with actor, trimmed reason and submission');
  perform ap_test.ok(ap_test.run('authenticated', admin_u, true,
    format('select public.admin_take_down_event(%L, ''again please'')', first_event)) = 'archived', 'takedown is idempotent');
  perform ap_test.ok((select count(*) from public.audit_logs where action = 'event.taken_down' and entity_id = first_event) = 1,
    'repeat takedown writes no second audit row');
  perform ap_test.ok(ap_test.run('anon', null, false,
    format('select count(*)::text from public.public_events where id = %L', first_event)) = '0', 'archived event hidden from the public');
  result := ap_test.publish(member, sub);
  perform ap_test.ok(result ->> 'event_status' = 'archived' and not (result ->> 'published')::boolean,
    'replay after takedown reports archived without republishing: ' || result::text);
  perform ap_test.ok((select status from public.events where id = first_event) = 'archived', 'archived event stays archived');

  -- Quota: 3 successful self-publishes per 24 hours, and the taken-down one still counts.
  sub2 := ap_test.submit(member, 'Second Live ' || tag);
  perform ap_test.ok((ap_test.publish(member, sub2) ->> 'published')::boolean, 'second publish');
  sub2 := ap_test.submit(member, 'Third Live ' || tag);
  perform ap_test.ok((ap_test.publish(member, sub2) ->> 'published')::boolean, 'third publish');
  sub2 := ap_test.submit(member, 'Fourth ' || tag);
  result := ap_test.publish(member, sub2);
  perform ap_test.ok(result = '{"published": false, "reason": "daily_limit"}', 'fourth hits the cap: ' || result::text);
  perform ap_test.ok(ap_test.pending(sub2), 'over-limit stays pending');

  -- Unverified email and suspended account stay pending.
  sub2 := ap_test.submit(unverified, 'Unverified ' || tag);
  result := ap_test.publish(unverified, sub2);
  perform ap_test.ok(result = '{"published": false, "reason": "email_unverified"}', 'unverified email blocked: ' || result::text);
  sub2 := ap_test.submit(suspended, 'Suspended ' || tag);
  update public.profiles set status = 'suspended' where id = suspended;
  result := ap_test.publish(suspended, sub2);
  perform ap_test.ok(result = '{"published": false, "reason": "inactive"}', 'suspended account blocked: ' || result::text);
  perform ap_test.ok(ap_test.pending(sub2), 'suspended stays pending');

  -- A withdrawn submission is not publishable.
  sub2 := ap_test.submit(stranger, 'Withdrawn ' || tag);
  update public.event_submissions set status = 'withdrawn' where id = sub2;
  result := ap_test.publish(stranger, sub2);
  perform ap_test.ok(result = '{"published": false, "reason": "not_pending"}', 'withdrawn -> not_pending: ' || result::text);

  -- Moderator approval keeps its source, does not count toward member quota,
  -- and a later self-publish attempt returns that one event.
  sub2 := ap_test.submit(stranger, 'Moderated ' || tag);
  events_before := (select count(*) from public.events);
  result := to_jsonb(ap_test.run('authenticated', admin_u, true,
    format('select public.approve_event_submission(%L, ''{}'')::text', sub2)));
  perform ap_test.ok((select source_type = 'moderator' and status = 'approved' from public.events where id = (result #>> '{}')::uuid),
    'moderator approval unchanged');
  result := ap_test.publish(stranger, sub2);
  perform ap_test.ok((result ->> 'published')::boolean and (select count(*) from public.events) = events_before + 1,
    'self-publish after moderator approval returns the one event');
  perform ap_test.ok(ap_test.run('authenticated', stranger, false, 'select public.my_auto_publish_block_reason()') is null,
    'moderator approvals do not use member quota');

  -- Only member-published events go through takedown.
  perform ap_test.fails('authenticated', admin_u, true,
    format('select public.admin_take_down_event(%L, ''not a member event'')', (result ->> 'event_id')), '22023',
    'moderator-sourced events are not taken down here');

  raise notice 'registered_event_auto_publish: all checks passed';
end $$;

rollback;

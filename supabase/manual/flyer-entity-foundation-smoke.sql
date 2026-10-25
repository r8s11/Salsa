-- Flyer -> entity foundation: real-Postgres smoke test (single session).
--
--   docker exec -i supabase_db_Salsa psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/manual/flyer-entity-foundation-smoke.sql
--
-- Requires migration 20260929000000_flyer_entity_foundation.sql. Runs inside a
-- transaction that is ROLLED BACK, so it leaves nothing behind (auth users,
-- events, entities, submissions are all fixtures). Each section raises on the
-- first violated assertion; success prints "FLYER ENTITY SMOKE OK".
--
-- Roles/JWTs are simulated the way PostgREST does it: request.jwt.claims plus
-- SET LOCAL ROLE, so RLS, grants and auth.uid()/is_moderator() are the real ones.
-- The concurrency half lives in flyer-entity-foundation-concurrency.sh.

\set ON_ERROR_STOP on
begin;

-- ---------- fixtures ----------
insert into auth.users (id, email, aud, role, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'smoke-admin@example.test', 'authenticated', 'authenticated', '{"role":"admin"}'),
  ('00000000-0000-4000-8000-0000000000a2', 'smoke-mod@example.test', 'authenticated', 'authenticated', '{"role":"moderator"}'),
  ('00000000-0000-4000-8000-0000000000a3', 'smoke-user@example.test', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-4000-8000-0000000000a4', 'smoke-host@example.test', 'authenticated', 'authenticated', '{"role":"organizer"}');
insert into public.profiles (id)
select id from auth.users where email like 'smoke-%@example.test'
on conflict (id) do nothing;

insert into public.venues (name, slug, address_line1, city, state_region, website, instagram)
values ('Casa Salsa', 'smoke-casa-salsa', '288 Green Street', 'Boston', 'MA', 'https://casasalsa.example.test', '@casasalsa');
insert into public.organizers (name, slug, instagram, primary_city)
values ('Smoke Host Org', 'smoke-host-org', 'smokehostorg', 'Boston');
insert into public.organizer_members (organizer_id, user_id, member_role)
select o.id, '00000000-0000-4000-8000-0000000000a4', 'owner' from public.organizers o where o.slug = 'smoke-host-org';
insert into public.taxonomy_terms (category, name, slug) values ('dance_style', 'Smoke Bachata', 'smoke-bachata');

-- ---------- 1. normalization ----------
do $$
begin
  assert public.flyer_norm_text('  Café  Rio & Sons! ') = 'cafe rio and sons', 'norm_text diacritics/&/punct';
  assert public.flyer_norm_text('O’Brien''s') = 'obriens', 'norm_text apostrophes';
  assert public.flyer_norm_text('Èèé Ñandú Çà Ōtōri') = 'eee nandu ca otori',
    'norm_text maps every accented vowel/consonant (grave e included)';
  assert public.flyer_norm_text('Crème Brûlée Café') = 'creme brulee cafe', 'norm_text accents e/u/e';
  assert public.flyer_norm_text('東京') <> public.flyer_norm_text('大阪'), 'non-Latin names retain distinct identities';
  assert public.flyer_slugify('東京') = 'item', 'non-Latin names use the ASCII slug fallback';
  assert public.flyer_norm_address('288 Green St.') = public.flyer_norm_address('288 green STREET'), 'address St = Street';
  assert public.flyer_norm_address('5 Elm Ave') = '5 elm avenue', 'address Ave';
  assert public.flyer_norm_handle('https://www.instagram.com/Casa.Salsa/?hl=en') = 'casa.salsa', 'IG url -> handle';
  assert public.flyer_norm_handle('@Casa.Salsa') = 'casa.salsa', 'IG @handle';
  assert public.flyer_norm_host('https://www.CasaSalsa.example.test/events?x=1') = 'casasalsa.example.test', 'website host';
  assert public.flyer_norm_host('https://www.instagram.com/foo') is null, 'shared platforms are not identity';
  assert public.flyer_slugify('Café Rio & Sons') = 'cafe-rio-and-sons', 'slugify';
  assert public.flyer_clean_website('javascript:alert(1)') is null, 'unsafe website dropped';
  assert public.flyer_clean_website('example.com/x') = 'https://example.com/x', 'website gets scheme';
end $$;

-- ---------- 2. strength rules (pure) ----------
-- args: candidate(name,addr,city,state,country,host,ig,flyer) existing(same) linked
do $$
begin
  assert public.flyer_match_strength('a b','','','','','','','', 'a b','','','','','','','', false) = 'possible', 'name only is NOT strong';
  assert public.flyer_match_strength('a b','','boston','ma','us','','','', 'a b','','boston','ma','us','','','', false) = 'possible', 'name+city(+state+country) alone is NOT strong';
  assert public.flyer_match_strength('a b','1 main street','','','','','','', 'a b','1 main street','','','','','','', false) = 'strong', 'name+address strong';
  assert public.flyer_match_strength('a b','1 main street','boston','ma','us','','','', 'a b','1 main street','boston','ma','us','','','', false) = 'strong', 'name+address+same region strong';
  assert public.flyer_match_strength('a b','1 main street','boston','ma','us','','','', 'a b','1 main street','boston','fl','us','','','', false) = 'conflict', 'same street, different state -> review';
  assert public.flyer_match_strength('a b','1 main street','boston','','us','','','', 'a b','1 main street','boston','','ca','','','', false) = 'conflict', 'same street, different country -> review';
  assert public.flyer_match_strength('a b','1 main street','','','','','','', 'a b','2 elm street','','','','','','', false) = 'possible', 'address conflict never strong';
  assert public.flyer_match_strength('a b','','boston','','','','','', 'a b','','miami','','','','','', false) = 'possible', 'different city is a distinct record';
  assert public.flyer_match_strength('a b','','','','','x.test','ig','', 'a b','','','','','x.test','ig','', false) = 'strong', 'host+ig strong';
  assert public.flyer_match_strength('a b','','','','','x.test','ig','', 'a b','','','','','y.test','ig','', false) = 'conflict', 'same IG different website -> review';
  assert public.flyer_match_strength('a b','','','','','','','f1', 'a b','','','','','','','f1', false) = 'possible', 'same source flyer is only a hint';
  -- shared event/submission provenance (p_linked) never overrides a contradiction
  assert public.flyer_match_strength('sam lee','','','','','','a','', 'sam lee','','','','','','b','', true) = 'possible', 'linked + different IG stays distinct';
  assert public.flyer_match_strength('sam lee','','','','','x.test','','', 'sam lee','','','','','','a','', true) = 'possible', 'linked, website-only vs IG-only stays distinct';
  assert public.flyer_match_strength('sam lee','','','','','','a','', 'sam lee','','','','','','a','', true) = 'strong', 'linked replay with same IG reuses';
  assert public.flyer_match_strength('sam lee','','','','','','','', 'sam lee','','','','','','a','', true) = 'strong', 'linked replay without identity fields reuses';
  assert public.flyer_match_strength('sam lee','','','','','','','', 'sam lee','','','','','','a','', false) = 'possible', 'unlinked bare name never reuses';
  assert public.flyer_match_strength('a b','','','','','x.test','','', 'c d','','','','','x.test','','', false) = 'possible', 'shared host with a different name is only possible';
end $$;

-- ---------- 3. reconcile (authenticated only, deterministic) ----------
do $$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
  execute 'set local role authenticated';

  r := public.reconcile_flyer_entities(jsonb_build_object(
    'venue', jsonb_build_object('name', 'CASA SALSA', 'address', '288 green st'),
    'organizer', jsonb_build_object('name', 'Brand New Org', 'instagram', 'brandneworg'),
    'instructors', jsonb_build_array(
      jsonb_build_object('name', 'Ana Perez'), jsonb_build_object('name', 'ana  perez'), jsonb_build_object('name', 'Luis Ortiz')),
    'school', null));
  assert r -> 'venue' ->> 'state' = 'MATCHED' and r -> 'venue' ->> 'decision' = 'existing'
     and r -> 'venue' ->> 'selected_id' is not null, 'normalized venue strong match auto-selects';
  assert r -> 'organizer' ->> 'state' = 'NEW' and r -> 'organizer' ->> 'decision' = 'pending', 'unknown organizer is NEW/pending';
  assert jsonb_array_length(r -> 'instructors') = 2, 'identical instructor candidates collapse';
  r := public.reconcile_flyer_entities(jsonb_build_object('instructors', jsonb_build_array(
    jsonb_build_object('name', 'Sam Lee', 'instagram', 'samlee_a'), jsonb_build_object('name', 'Sam Lee', 'instagram', 'samlee_b'),
    jsonb_build_object('name', 'Sam Lee', 'organization', 'Studio X'), jsonb_build_object('name', 'sam  LEE', 'organization', 'studio x'))));
  assert jsonb_array_length(r -> 'instructors') = 3, 'same-name people with different identifying context stay distinct';
  r := public.reconcile_flyer_entities(jsonb_build_object('instructors', jsonb_build_array(
    jsonb_build_object('name', 'Pat Kim', 'city', 'Springfield', 'state_region', 'MA', 'country', 'US'),
    jsonb_build_object('name', 'Pat Kim', 'city', 'Springfield', 'state_region', 'IL', 'country', 'US'),
    jsonb_build_object('name', 'Pat Kim', 'city', 'Springfield', 'state_region', 'MA', 'country', 'Canada'),
    jsonb_build_object('name', 'Pat Kim', 'city', 'Springfield', 'state_region', 'MA', 'country', 'US', 'address', '1 Main St'),
    jsonb_build_object('name', 'pat kim', 'city', 'springfield', 'state_region', 'ma', 'country', 'usa'))));
  assert jsonb_array_length(r -> 'instructors') = 4,
    'same name+city in different state/country/address stay distinct; identical ones (usa = US) collapse';
  assert r -> 'school' = 'null'::jsonb, 'absent school stays null';

  r := public.reconcile_flyer_entities(jsonb_build_object('venue', jsonb_build_object('name', 'Casa Salsa')));
  assert r -> 'venue' ->> 'state' = 'POSSIBLE MATCH' and r -> 'venue' ->> 'decision' = 'pending'
     and r -> 'venue' ->> 'selected_id' is null, 'name-only never auto-links';

  r := public.reconcile_flyer_entities(jsonb_build_object('venue', jsonb_build_object('name', 'Casa Salsa', 'address', '99 Other Ave', 'city', 'Boston')));
  assert r -> 'venue' ->> 'decision' = 'pending', 'conflicting address never auto-links';

  r := public.reconcile_flyer_entities(jsonb_build_object('venue', jsonb_build_object(
    'name', 'Casa Salsa', 'instagram', 'https://instagram.com/casasalsa', 'website', 'https://other.example.test')));
  assert r -> 'venue' ->> 'state' = 'NEEDS REVIEW' and r -> 'venue' ->> 'decision' = 'pending',
    'same name + same IG + different website needs review';

  r := public.search_flyer_entities('venue', 'casa');
  assert jsonb_array_length(r) = 1 and (r -> 0) ?& array['id','name','city','instagram'], 'search returns safe fields';
  assert public.search_flyer_entities('venue', 'a') = '[]'::jsonb, 'short search is empty';
  execute 'reset role';

  execute 'set local role anon';
  begin
    perform public.reconcile_flyer_entities('{}'::jsonb);
    raise exception 'anon reconcile must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.search_flyer_entities('venue', 'casa');
    raise exception 'anon search must fail';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

-- ---------- 4. authorization + RLS on new surfaces ----------
do $$
declare v_ok boolean;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"u@x.test","app_metadata":{}}', true);
  execute 'set local role authenticated';
  begin
    perform public.save_event_with_entities(null, '{"title":"x","event_type":"social","city":"boston","event_date":"2030-01-01T20:00:00Z"}', true);
    raise exception 'plain user save must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.approve_event_submission(gen_random_uuid(), '{}');
    raise exception 'plain user approve must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.instructors (name, slug) values ('Hax', 'hax');
    raise exception 'plain user insert must fail';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.instructors) = 0, 'plain user reads no instructors';
  execute 'reset role';

  execute 'set local role anon';
  begin
    perform 1 from public.instructors;
    raise exception 'anon table read must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.schools;
    raise exception 'anon table read must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_event_with_entities(null, '{}', true);
    raise exception 'anon save must fail';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

-- ---------- 5. moderator save: create, replay, precedence, gallery, status ----------
create temp table smoke_ids (k text primary key, v uuid);
grant all on smoke_ids to public;

do $$
declare
  v_event uuid;
  v_event2 uuid;
  v_review jsonb;
  v_before int;
  v_ev public.events%rowtype;
  v_term uuid := (select id from public.taxonomy_terms where slug = 'smoke-bachata');
  v_casa uuid := (select id from public.venues where slug = 'smoke-casa-salsa');
  v_other uuid;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","email":"mod@x.test","app_metadata":{"role":"moderator"}}', true);
  execute 'set local role authenticated';

  v_review := jsonb_build_object(
    'venue', jsonb_build_object('candidate', jsonb_build_object('name', 'Salon Rumba', 'address', '10 Elm Street, Boston, MA 02110',
        'city', 'Boston', 'state_region', 'MA', 'country', 'USA', 'phone', '555-0100', 'email', 'secret@x.test'),
        'state', 'NEW', 'matches', '[]'::jsonb, 'decision', 'new', 'selected_id', null),
    'organizer', jsonb_build_object('candidate', jsonb_build_object('name', 'Rumba Collective', 'instagram', 'https://instagram.com/rumbacollective'),
        'state', 'NEW', 'matches', '[]'::jsonb, 'decision', 'new', 'selected_id', null),
    'instructors', jsonb_build_array(
      jsonb_build_object('candidate', jsonb_build_object('name', 'Ana Perez', 'instagram', '@anaperez'),
        'state', 'NEW', 'matches', '[]'::jsonb, 'decision', 'new', 'selected_id', null),
      jsonb_build_object('candidate', jsonb_build_object('name', 'Luis Ortiz'),
        'state', 'NEW', 'matches', '[]'::jsonb, 'decision', 'pending', 'selected_id', null)),
    'school', jsonb_build_object('candidate', jsonb_build_object('name', 'Rumba Academy', 'website', 'rumbaacademy.example.test', 'address', '10 Elm St'),
        'state', 'NEW', 'matches', '[]'::jsonb, 'decision', 'new', 'selected_id', null));

  v_event := public.save_event_with_entities(null, jsonb_build_object(
      'title', 'Rumba Night', 'event_type', 'social', 'city', 'boston', 'event_date', '2030-03-01T20:00:00Z',
      'location', 'Manual Location Text', 'address', 'Manual Address Text', 'image_url', 'https://flyers.example.test/rumba.png',
      'gallery', jsonb_build_array('https://g.example.test/1.png', 'https://g.example.test/2.png'),
      'taxonomy_term_ids', jsonb_build_array(v_term),
      -- spoofed provenance must be ignored
      'submitter_id', '00000000-0000-4000-8000-0000000000a1', 'source_type', 'imported', 'status', 'approved',
      'entity_review', v_review), true);
  insert into smoke_ids values ('event', v_event);
  execute 'reset role';

  select * into v_ev from public.events where id = v_event;
  assert v_ev.status = 'approved', 'publish=true -> approved';
  assert v_ev.submitter_id = '00000000-0000-4000-8000-0000000000a2' and v_ev.submitter_email = 'mod@x.test', 'submitter derived from caller';
  assert v_ev.source_type = 'moderator', 'source_type derived from caller role, not payload';
  assert v_ev.location = 'Manual Location Text' and v_ev.address = 'Manual Address Text', 'manual location/address preserved';
  assert v_ev.gallery = array['https://g.example.test/1.png', 'https://g.example.test/2.png'], 'gallery stored';
  assert v_ev.venue_id is not null and v_ev.organizer_id is not null, 'venue/organizer linked';
  assert (select count(*) from public.event_taxonomy_terms where event_id = v_event) = 1, 'taxonomy saved';
  assert (select count(*) from public.event_instructors where event_id = v_event) = 1, 'only decided instructor linked';
  assert not exists (select 1 from public.instructors where name = 'Luis Ortiz'), 'pending instructor creates nothing';
  assert (select count(*) from public.event_schools where event_id = v_event) = 1, 'school linked';

  assert (select slug from public.venues where id = v_ev.venue_id) = 'salon-rumba', 'venue slug';
  assert (select postal_code from public.venues where id = v_ev.venue_id) = '02110'
     and (select address_line1 from public.venues where id = v_ev.venue_id) = '10 Elm Street'
     and (select country from public.venues where id = v_ev.venue_id) = 'US'
     and (select phone from public.venues where id = v_ev.venue_id) = '555-0100', 'venue geography parsed';
  assert (select source_type from public.venues where id = v_ev.venue_id) = 'flyer_extraction'
     and (select source_event_id from public.venues where id = v_ev.venue_id) = v_event
     and (select source_flyer_url from public.venues where id = v_ev.venue_id) = 'https://flyers.example.test/rumba.png', 'source attribution';
  assert (select instagram from public.organizers where id = v_ev.organizer_id) = 'rumbacollective', 'IG url stored as handle';
  assert v_ev.entity_review is not null and v_ev.entity_review::text not like '%secret@x.test%' and v_ev.entity_review::text not like '%555-0100%',
    'stored review has no email/phone';
  assert v_ev.entity_review -> 'venue' ->> 'decision' = 'existing' and v_ev.entity_review -> 'venue' ->> 'selected_id' = v_ev.venue_id::text,
    'stored review reflects resolved ids';

  -- replay: identical review, same event id -> nothing new
  select (select count(*) from public.venues) + (select count(*) from public.organizers) + (select count(*) from public.instructors)
         + (select count(*) from public.schools) into v_before;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","email":"mod@x.test","app_metadata":{"role":"moderator"}}', true);
  perform public.save_event_with_entities(v_event, jsonb_build_object('entity_review', v_review), null);
  -- and the same flyer on a different event reuses (strong via same flyer + name)
  v_event2 := public.save_event_with_entities(null, jsonb_build_object(
      'title', 'Rumba Night 2', 'event_type', 'social', 'city', 'boston', 'event_date', '2030-03-08T20:00:00Z',
      'image_url', 'https://flyers.example.test/rumba.png', 'entity_review', v_review), false);
  execute 'reset role';
  assert (select count(*) from public.venues) + (select count(*) from public.organizers) + (select count(*) from public.instructors)
         + (select count(*) from public.schools) = v_before, 'replay / same flyer creates no duplicate entities';
  assert (select venue_id from public.events where id = v_event2) = v_ev.venue_id, 'second event links same venue';
  assert (select status from public.events where id = v_event2) = 'draft', 'publish=false creates draft';
  assert (select status from public.events where id = v_event) = 'approved', 'publish=null update keeps status';
  assert (select gallery from public.events where id = v_event) = v_ev.gallery, 'update without gallery key retains gallery';
  assert (select location from public.events where id = v_event) = 'Manual Location Text', 'update keeps untouched fields';

  -- new without a uniqueness signal is rejected; pending is the escape hatch
  execute 'set local role authenticated';
  begin
    perform public.save_event_with_entities(v_event, jsonb_build_object('entity_review', jsonb_build_object(
      'instructors', jsonb_build_array(jsonb_build_object('candidate', jsonb_build_object('name', 'Luis Ortiz'), 'decision', 'new')))), null);
    raise exception 'name-only new must be rejected';
  exception when invalid_parameter_value then
    assert sqlerrm like 'new_entity_needs_signal:%', 'signal error code message';
  end;
  execute 'reset role';
  assert not exists (select 1 from public.instructors where name = 'Luis Ortiz'), 'rejected create left nothing behind';

  -- manual venue wins over an auto-MATCHED review; a deliberate NEW overrides it
  execute 'set local role authenticated';
  perform public.save_event_with_entities(v_event, jsonb_build_object('venue_id', v_casa, 'entity_review', jsonb_build_object(
    'venue', jsonb_build_object('candidate', jsonb_build_object('name', 'Salon Rumba', 'address', '10 Elm Street'),
      'state', 'MATCHED', 'decision', 'existing', 'selected_id', v_ev.venue_id))), null);
  assert (select venue_id from public.events where id = v_event) = v_casa, 'manual venue_id wins over MATCHED review';
  perform public.save_event_with_entities(v_event, jsonb_build_object('venue_id', v_casa, 'entity_review', jsonb_build_object(
    'venue', jsonb_build_object('candidate', jsonb_build_object('name', 'Salon Rumba', 'address', '10 Elm Street'),
      'state', 'POSSIBLE MATCH', 'decision', 'existing', 'selected_id', v_ev.venue_id))), null);
  assert (select venue_id from public.events where id = v_event) = v_ev.venue_id, 'explicit human selection overrides manual venue';

  -- removed instructor unlinks; undecided keeps an existing link
  perform public.save_event_with_entities(v_event, jsonb_build_object('entity_review', jsonb_build_object(
    'instructors', jsonb_build_array(jsonb_build_object('candidate', jsonb_build_object('name', 'Ana Perez'), 'decision', 'pending',
       'selected_id', (select instructor_id from public.event_instructors where event_id = v_event limit 1))))), null);
  assert (select count(*) from public.event_instructors where event_id = v_event) = 1, 'pending item keeps existing link';
  perform public.save_event_with_entities(v_event, jsonb_build_object('entity_review', jsonb_build_object(
    'instructors', jsonb_build_array(jsonb_build_object('candidate', jsonb_build_object('name', 'Ana Perez'), 'decision', 'removed')))), null);
  assert (select count(*) from public.event_instructors where event_id = v_event) = 0, 'removed item unlinks';

  -- invalid ids are rejected, atomically
  begin
    perform public.save_event_with_entities(v_event, jsonb_build_object('title', 'SHOULD ROLL BACK', 'entity_review', jsonb_build_object(
      'school', jsonb_build_object('decision', 'existing', 'selected_id', gen_random_uuid()))), null);
    raise exception 'unknown selected_id must be rejected';
  exception when invalid_parameter_value then null;
  end;
  execute 'reset role';
  assert (select title from public.events where id = v_event) = 'Rumba Night', 'failed save leaves event unchanged (atomic)';

  -- explicit gallery replaces; null clears
  execute 'set local role authenticated';
  perform public.save_event_with_entities(v_event, '{"gallery":["https://g.example.test/3.png"]}', null);
  execute 'reset role';
  assert (select gallery from public.events where id = v_event) = array['https://g.example.test/3.png'], 'explicit gallery replaces';
end $$;

-- ---------- 6. approval: submitter suggestions are never trusted ----------
do $$
declare
  v_sub uuid := gen_random_uuid();
  v_sub2 uuid := gen_random_uuid();
  v_sub3 uuid := gen_random_uuid();
  v_sub4 uuid := gen_random_uuid();
  v_suggest jsonb := jsonb_build_object('venue', jsonb_build_object(
      'candidate', jsonb_build_object('name', 'Sneaky Club', 'address', '1 Fake Road', 'city', 'Boston'),
      'state', 'NEW', 'matches', '[]'::jsonb, 'decision', 'new', 'selected_id', null));
  v_data jsonb;
  v_e1 uuid; v_e1b uuid; v_e2 uuid; v_e3 uuid; v_e4 uuid;
  v_before int;
begin
  v_data := jsonb_build_object('title', 'Submitted Night', 'event_type', 'social', 'city', 'boston',
    'event_date', '2030-04-01T20:00:00Z', 'image_url', 'https://flyers.example.test/sneaky.png', 'entity_review', v_suggest);
  insert into public.event_submissions (id, submitter_id, submitter_email, submitter_name, status, submitted_data)
  values (v_sub, null, 'anon@x.test', 'Anon', 'pending', v_data),
         (v_sub2, null, 'anon2@x.test', 'Anon2', 'pending', v_data),
         (v_sub3, null, 'anon3@x.test', 'Anon3', 'pending', v_data),
         (v_sub4, null, 'anon4@x.test', 'Anon4', 'pending', v_data);

  -- (a) moderator approves without touching the review: nothing canonical
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","email":"mod@x.test","app_metadata":{"role":"moderator"}}', true);
  execute 'set local role authenticated';
  v_e1 := public.approve_event_submission(v_sub, '{}');
  v_e1b := public.approve_event_submission(v_sub, '{}');
  execute 'reset role';
  assert v_e1 = v_e1b, 'approval replay returns the same event';
  assert (select count(*) from public.events where title = 'Submitted Night' and source_type = 'moderator') = 1, 'replay creates no second event';
  assert not exists (select 1 from public.venues where name = 'Sneaky Club'), 'unreviewed submitter suggestion creates nothing';
  assert (select venue_id from public.events where id = v_e1) is null, 'no venue linked without moderator review';

  -- (b) non-moderator edit of edited_data.entity_review is not promoted
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","app_metadata":{}}', true);
  update public.event_submissions set edited_data = jsonb_build_object('entity_review', v_suggest) where id = v_sub2;
  assert (select moderator_entity_review from public.event_submissions where id = v_sub2) is null, 'submitter edit not trusted';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","app_metadata":{"role":"moderator"}}', true);
  -- snapshot columns cannot be forged
  update public.event_submissions set moderator_entity_review = v_suggest where id = v_sub2;
  assert (select moderator_entity_review from public.event_submissions where id = v_sub2) is null, 'snapshot cannot be set directly';

  -- (c) moderator copies the suggestion verbatim: recorded as theirs, but still not a decision
  execute 'set local role authenticated';
  update public.event_submissions set edited_data = jsonb_build_object('entity_review', v_suggest, 'internal', 1) where id = v_sub4;
  execute 'reset role';
  assert (select entity_review_confirmed_by from public.event_submissions where id = v_sub4) = '00000000-0000-4000-8000-0000000000a2', 'server records moderator provenance';
  assert (select moderator_entity_review from public.event_submissions where id = v_sub4) = v_suggest, 'moderator snapshot captured';
  execute 'set local role authenticated';
  v_e4 := public.approve_event_submission(v_sub4, '{}');
  execute 'reset role';
  assert not exists (select 1 from public.venues where name = 'Sneaky Club'), 'verbatim copy is downgraded to pending';

  -- (d) moderator confirms explicitly: canonical creation, attributed to the submission
  execute 'set local role authenticated';
  update public.event_submissions set edited_data = jsonb_build_object('entity_review', jsonb_build_object('venue',
      (v_suggest -> 'venue') || '{"moderator_confirmed": true}')) where id = v_sub3;
  v_e3 := public.approve_event_submission(v_sub3, '{}');
  execute 'reset role';
  assert exists (select 1 from public.venues where name = 'Sneaky Club' and source_type = 'submission_approval' and source_submission_id = v_sub3),
    'confirmed new venue created with submission attribution';
  assert (select venue_id from public.events where id = v_e3) = (select id from public.venues where name = 'Sneaky Club'), 'approved event linked';
  select count(*) into v_before from public.venues where name = 'Sneaky Club';
  execute 'set local role authenticated';
  perform public.approve_event_submission(v_sub3, '{}');
  execute 'reset role';
  assert (select count(*) from public.venues where name = 'Sneaky Club') = v_before and v_before = 1, 'approval replay creates no duplicate';

  -- non-moderator cannot approve
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","app_metadata":{}}', true);
  execute 'set local role authenticated';
  begin
    perform public.approve_event_submission(gen_random_uuid(), '{}');
    raise exception 'must fail';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

-- ---------- 7. public read surface exposes safe fields only ----------
do $$
declare
  r jsonb;
  v_event uuid := (select v from smoke_ids where k = 'event');
  v_draft uuid := (select id from public.events where title = 'Rumba Night 2');
begin
  execute 'set local role anon';
  r := public.public_flyer_entity('venue', 'salon-rumba');
  assert r is not null, 'anon can resolve a venue by slug';
  assert (select array_agg(k order by k) from jsonb_object_keys(r) k) =
         array['address','city','country','id','instagram','name','origin','slug','state_region','status','website'], 'exactly the safe fields';
  assert r ->> 'origin' = 'flyer', 'origin from source attribution';
  assert public.public_flyer_entity('venue', 'no-such-slug') is null, 'missing -> null';
  assert public.public_flyer_entity('bogus', 'salon-rumba') is null, 'unknown kind -> null';
  assert public.public_flyer_entity('school', 'rumba-academy') ->> 'name' = 'Rumba Academy', 'school resolves';
  assert public.public_event_entities(v_event) -> 'venue' ->> 'name' = 'Salon Rumba', 'approved event entities visible';
  assert public.public_event_entities(v_draft) is null, 'draft event entities hidden';
  execute 'reset role';

  update public.venues set status = 'archived' where slug = 'salon-rumba';
  update public.organizers set status = 'suspended' where slug = 'rumba-collective';
  execute 'set local role anon';
  assert public.public_flyer_entity('venue', 'salon-rumba') is null, 'archived venue hidden';
  assert public.public_flyer_entity('organizer', 'rumba-collective') is null, 'suspended organizer hidden';
  execute 'reset role';
end $$;

-- ---------- 8. slug collisions get geographic disambiguation ----------
do $$
declare a uuid; b uuid; c uuid;
begin
  a := public.flyer_entity_create('instructor', '{"name":"Sam Lee","city":"Boston","state_region":"MA","instagram":"samlee1"}', '{}');
  b := public.flyer_entity_create('instructor', '{"name":"Sam Lee","city":"Miami","state_region":"FL","instagram":"samlee2"}', '{}');
  c := public.flyer_entity_create('instructor', '{"name":"Sam Lee","city":"Miami","state_region":"FL","instagram":"samlee3"}', '{}');
  assert (select slug from public.instructors where id = a) = 'sam-lee', 'first slug';
  assert (select slug from public.instructors where id = b) = 'sam-lee-miami', 'city slug on collision';
  assert (select slug from public.instructors where id = c) = 'sam-lee-miami-fl', 'city+state slug on second collision';
end $$;

-- ---------- 9. organizer host keeps suggestions only ----------
do $$
declare
  v_org uuid := (select id from public.organizers where slug = 'smoke-host-org');
  v_ev uuid;
  v_before int;
begin
  select (select count(*) from public.venues) + (select count(*) from public.instructors) into v_before;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated","email":"h@x.test","app_metadata":{"role":"organizer"}}', true);
  execute 'set local role authenticated';
  v_ev := public.organizer_create_event(v_org, jsonb_build_object('title', 'Host Night', 'event_type', 'social', 'city', 'boston',
    'event_date', '2030-05-01T20:00:00Z', 'entity_review', jsonb_build_object(
      'venue', jsonb_build_object('candidate', jsonb_build_object('name', 'Host Hall', 'address', '5 Main St', 'email', 'x@y.test'),
         'state', 'NEW', 'decision', 'new', 'selected_id', gen_random_uuid()),
      'instructors', jsonb_build_array(jsonb_build_object('candidate', jsonb_build_object('name', 'Host Teacher'), 'decision', 'existing')))), false);
  begin
    perform public.organizer_create_event(v_org, '{"title":"x","event_type":"social","event_date":"2030-05-01T20:00:00Z","status":"approved"}', false);
    raise exception 'non-whitelisted field must still be rejected';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  assert (select count(*) from public.venues) + (select count(*) from public.instructors) = v_before, 'host path creates no canonical entity';
  assert (select organizer_id from public.events where id = v_ev) = v_org and (select venue_id from public.events where id = v_ev) is null, 'host path links nothing';
  assert (select entity_review -> 'venue' ->> 'decision' from public.events where id = v_ev) = 'pending'
     and (select entity_review -> 'venue' ->> 'selected_id' from public.events where id = v_ev) is null
     and (select entity_review::text from public.events where id = v_ev) not like '%x@y.test%', 'suggestions stored pending and sanitized';
end $$;

-- ---------- 10. security regressions ----------
do $$
declare
  c_mod constant text := '00000000-0000-4000-8000-0000000000a2';
  c_mod_claims constant text := '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","email":"mod@x.test","app_metadata":{"role":"moderator"}}';
  s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); s3 uuid := gen_random_uuid();
  s4 uuid := gen_random_uuid(); s5 uuid := gen_random_uuid();
  e1 uuid; e2 uuid; e3 uuid; e5 uuid; ev uuid; ids_before uuid[]; ids_after uuid[];
  base jsonb := '{"event_type":"social","city":"boston","event_date":"2030-06-01T20:00:00Z"}';
  rv jsonb;
begin
  -- (1) a public INSERT cannot pre-seed moderator-only columns.
  -- The anon JWT must replace the previous section's claims: a leftover `sub`
  -- makes auth.uid() non-null, so normalize_authenticated_submission_email
  -- stamps submitter_id and the "Anon can submit" policy (submitter_id IS NULL)
  -- correctly rejects the row.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  insert into public.event_submissions (id, submitter_id, submitter_email, status, submitted_data, edited_data, internal_note)
  values (s1, null, 'forge@x.test', 'pending', base || '{"title":"Benign Title"}',
    '{"title":"FORGED TITLE","entity_review":{"venue":{"candidate":{"name":"Forged Venue","address":"9 Fake St"},"state":"NEW","decision":"new"}}}',
    'forged note');
  execute 'reset role';
  assert (select edited_data is null and edited_data_by is null and internal_note is null from public.event_submissions where id = s1),
    'public INSERT: edited_data and moderator-only columns cleared';
  perform set_config('request.jwt.claims', c_mod_claims, true);
  execute 'set local role authenticated';
  e1 := public.approve_event_submission(s1, '{}');
  execute 'reset role';
  assert (select title from public.events where id = e1) = 'Benign Title', 'forged overlay never reaches the event';
  assert not exists (select 1 from public.venues where name = 'Forged Venue'), 'forged entity review creates nothing';

  -- (1b) legacy row: overlay with no write provenance is ignored at approval
  alter table public.event_submissions disable trigger event_submissions_entity_review_guard;
  insert into public.event_submissions (id, submitter_email, status, submitted_data, edited_data)
  values (s2, 'legacy@x.test', 'pending', base || '{"title":"Legacy Benign"}', '{"title":"LEGACY FORGED"}');
  alter table public.event_submissions enable trigger event_submissions_entity_review_guard;
  execute 'set local role authenticated';
  e2 := public.approve_event_submission(s2, '{}');
  execute 'reset role';
  assert (select title from public.events where id = e2) = 'Legacy Benign', 'overlay without provenance is ignored';

  -- (1b2) legacy hardening: unproven edited_data is cleared ENTIRELY; audited edits survive
  declare
    l1 uuid := gen_random_uuid(); l2 uuid := gen_random_uuid(); l3 uuid := gen_random_uuid(); e_l uuid;
  begin
    alter table public.event_submissions disable trigger event_submissions_entity_review_guard;
    alter table public.event_submissions disable trigger event_submissions_audit_log;
    insert into public.event_submissions (id, submitter_email, status, submitted_data, edited_data) values
      (l1, 'l1@x.test', 'pending', base || '{"title":"Legacy Clean"}',
        '{"title":"FORGED","description":"forged desc","entity_review":{"venue":{"candidate":{"name":"Legacy Forged Venue","address":"3 C St"},"decision":"new","state":"NEW"}}}'),
      (l2, 'l2@x.test', 'pending', base || '{"title":"Legacy Audited"}', '{"description":"moderator wrote this"}'),
      (l3, 'l3@x.test', 'approved', base || '{"title":"Legacy Closed"}', '{"title":"history"}');
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (c_mod::uuid, 'submission.edited', 'event_submission', l2, '{}');
    alter table public.event_submissions enable trigger event_submissions_entity_review_guard;
    alter table public.event_submissions enable trigger event_submissions_audit_log;
    perform public.flyer_harden_legacy_submissions();
    assert (select edited_data is null from public.event_submissions where id = l1), 'unproven legacy edited_data cleared entirely';
    assert (select edited_data = '{"description":"moderator wrote this"}'::jsonb and edited_data_by = c_mod::uuid
              from public.event_submissions where id = l2), 'audited legacy edit preserved with provenance';
    assert (select edited_data = '{"title":"history"}'::jsonb from public.event_submissions where id = l3), 'closed submissions untouched';

    -- an entity-only moderator update on a cleaned row keeps the benign title
    perform set_config('request.jwt.claims', c_mod_claims, true);
    execute 'set local role authenticated';
    update public.event_submissions set edited_data = jsonb_build_object('entity_review', jsonb_build_object('venue',
      jsonb_build_object('candidate', jsonb_build_object('name', 'Legacy Real Venue', 'address', '4 D St'),
        'state', 'NEW', 'decision', 'new', 'moderator_confirmed', true))) where id = l1;
    e_l := public.approve_event_submission(l1, '{}');
    execute 'reset role';
    assert (select title from public.events where id = e_l) = 'Legacy Clean', 'entity-only moderator update keeps the benign title';
    assert (select description from public.events where id = e_l) is null, 'forged description did not survive';
    assert not exists (select 1 from public.venues where name = 'Legacy Forged Venue'), 'forged legacy review created nothing';
    assert exists (select 1 from public.venues where name = 'Legacy Real Venue'), 'moderator-confirmed review applied';
  end;

  -- (1c) an UPDATE by the submitter has provenance (existing owner-edit flow) but can never carry entity_review
  insert into public.event_submissions (id, submitter_email, status, submitted_data)
  values (s3, 'owner@x.test', 'pending', base || '{"title":"Owner Original"}');
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","app_metadata":{}}', true);
  update public.event_submissions set edited_data = '{"title":"Owner Fix","entity_review":{"venue":{"candidate":{"name":"Owner Venue","address":"1 A St"},"decision":"new","state":"NEW"}}}' where id = s3;
  assert (select edited_data_by from public.event_submissions where id = s3) = '00000000-0000-4000-8000-0000000000a3', 'edit provenance recorded';
  assert (select not jsonb_exists(edited_data, 'entity_review') and moderator_entity_review is null from public.event_submissions where id = s3),
    'submitter cannot write entity_review';
  perform set_config('request.jwt.claims', c_mod_claims, true);
  execute 'set local role authenticated';
  e3 := public.approve_event_submission(s3, '{}');
  execute 'reset role';
  assert (select title from public.events where id = e3) = 'Owner Fix', 'provenanced edit is applied';
  assert not exists (select 1 from public.venues where name = 'Owner Venue'), 'submitter entity review creates nothing';

  -- (2) a suspended moderator keeps a valid JWT but loses every write path
  insert into public.event_submissions (id, submitter_email, status, submitted_data)
  values (s4, 'susp@x.test', 'pending', base || '{"title":"Suspended Case"}');
  update public.profiles set status = 'suspended' where id = c_mod::uuid;
  perform set_config('request.jwt.claims', c_mod_claims, true);
  execute 'set local role authenticated';
  begin
    perform public.approve_event_submission(s4, '{}');
    raise exception 'suspended moderator must not approve';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_event_with_entities(null, base || '{"title":"Suspended Save"}', true);
    raise exception 'suspended moderator must not save';
  exception when insufficient_privilege then null;
  end;
  update public.event_submissions set edited_data = '{"entity_review":{"venue":{"candidate":{"name":"Suspended Venue","address":"2 B St"},"decision":"new","state":"NEW","moderator_confirmed":true}}}' where id = s4;
  execute 'reset role';
  assert (select moderator_entity_review is null from public.event_submissions where id = s4), 'suspended moderator snapshot is not promoted';
  update public.profiles set status = 'active' where id = c_mod::uuid;

  -- (3) two NEW same-name instructors with different identities, SAVE path
  perform set_config('request.jwt.claims', c_mod_claims, true);
  execute 'set local role authenticated';
  rv := jsonb_build_object('instructors', jsonb_build_array(
    jsonb_build_object('candidate', jsonb_build_object('name', 'Sam Rowe', 'instagram', '@samrowe_a'), 'state', 'NEW', 'decision', 'new'),
    jsonb_build_object('candidate', jsonb_build_object('name', 'Sam Rowe', 'instagram', '@samrowe_b'), 'state', 'NEW', 'decision', 'new'),
    jsonb_build_object('candidate', jsonb_build_object('name', 'Sam Rowe', 'website', 'https://samrowe.example.test'), 'state', 'NEW', 'decision', 'new')));
  ev := public.save_event_with_entities(null, base || jsonb_build_object('title', 'Sam Rowe Night', 'entity_review', rv), false);
  execute 'reset role';
  assert (select count(*) from public.instructors where name = 'Sam Rowe') = 3, 'three distinct same-name instructors created';
  assert (select count(*) from public.event_instructors where event_id = ev) = 3, 'all three linked to the event';
  select array_agg(instructor_id order by instructor_id) into ids_before from public.event_instructors where event_id = ev;
  execute 'set local role authenticated';
  perform public.save_event_with_entities(ev, jsonb_build_object('entity_review', rv), null);
  execute 'reset role';
  select array_agg(instructor_id order by instructor_id) into ids_after from public.event_instructors where event_id = ev;
  assert ids_before = ids_after and (select count(*) from public.instructors where name = 'Sam Rowe') = 3, 'identical replay reuses each, creates none';

  -- (3b) same, APPROVAL path
  insert into public.event_submissions (id, submitter_email, status, submitted_data)
  values (s5, 'pat@x.test', 'pending', base || '{"title":"Pat Moss Night"}');
  execute 'set local role authenticated';
  update public.event_submissions set edited_data = jsonb_build_object('entity_review', jsonb_build_object('instructors', jsonb_build_array(
    jsonb_build_object('candidate', jsonb_build_object('name', 'Pat Moss', 'instagram', 'patmoss_a'), 'state', 'NEW', 'decision', 'new'),
    jsonb_build_object('candidate', jsonb_build_object('name', 'Pat Moss', 'instagram', 'patmoss_b'), 'state', 'NEW', 'decision', 'new')))) where id = s5;
  e5 := public.approve_event_submission(s5, '{}');
  execute 'reset role';
  assert (select count(*) from public.instructors where name = 'Pat Moss') = 2, 'approval creates both same-name instructors';
  assert (select count(*) from public.event_instructors where event_id = e5) = 2, 'approval links both';
end $$;

rollback;
select 'FLYER ENTITY SMOKE OK' as result;

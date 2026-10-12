-- Phase 3 Admin Analytics regression — transactional, rolls back all fixtures.
-- Run against a disposable clone. Must pass after Phase 3 migration applied.
-- Prerequisites: event_touches table + record_event_touch exist (from 20260922000000).

begin;

-- ============================================================================
-- Fixtures
-- ============================================================================

-- Temporarily bypass RLS for fixture setup
set local session_replication_role = replica;

-- Clean any prior test data
delete from public.event_touches where event_id in (
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  '00000000-0000-0000-0000-0000000000a2'::uuid,
  '00000000-0000-0000-0000-0000000000a3'::uuid,
  '00000000-0000-0000-0000-0000000000a4'::uuid,
  '00000000-0000-0000-0000-0000000000a5'::uuid,
  '00000000-0000-0000-0000-0000000000b1'::uuid,
  '00000000-0000-0000-0000-0000000000b2'::uuid
);

insert into public.events (id, title, event_date, status, city, organizer_id, dance_styles, rsvp_link, price_type, price_amount) values
  -- Approved paid event with RSVP link → ticket_click
  ('00000000-0000-0000-0000-0000000000a1', 'Paid Salsa Night', '2026-10-20T00:30:00Z', 'approved', 'boston', null, array[]::text[], 'https://tickets.example.com/1', 'paid', 25.00),
  -- Approved free event with RSVP link → rsvp_click
  ('00000000-0000-0000-0000-0000000000a2', 'Free Bachata Social', '2026-10-21T00:30:00Z', 'approved', 'nyc', null, array['Bachata',' bachata ','Bachata']::text[], 'https://rsvp.example.com/2', 'free', null),
  -- Approved event, no link — still gets views
  ('00000000-0000-0000-0000-0000000000a3', 'Community Practice', '2026-10-22T00:30:00Z', 'approved', 'boston', null, array[null,'',' ']::text[], null, 'free', null),
  -- Pending event — views should not be recorded (record_event_touch no-ops)
  ('00000000-0000-0000-0000-0000000000a4', 'Pending Workshop', '2026-10-23T00:30:00Z', 'pending', 'nyc', null, array[]::text[], null, 'free', null),
  -- Approved with canonical taxonomy override
  ('00000000-0000-0000-0000-0000000000a5', 'Mambo Social', '2026-10-24T00:30:00Z', 'approved', 'nyc', null, array['Salsa','Mambo']::text[], 'https://tickets.example.com/3', 'paid', 15.00);

-- Reuse canonical taxonomy term IDs if they already exist; insert isolated terms only when absent.
DO $tax$
DECLARE
  salsa_id uuid;
  bachata_id uuid;
BEGIN
  SELECT id INTO salsa_id FROM public.taxonomy_terms WHERE category = 'dance_style' AND slug = 'salsa' LIMIT 1;
  IF salsa_id IS NULL THEN
    INSERT INTO public.taxonomy_terms (id, slug, name, category, status, display_order)
    VALUES ('00000000-0000-0000-0000-0000000000c1', 'salsa', 'Salsa', 'dance_style', 'active', 1)
    ON CONFLICT (slug) DO UPDATE SET slug = excluded.slug
    RETURNING id INTO salsa_id;
  END IF;
  SELECT id INTO bachata_id FROM public.taxonomy_terms WHERE category = 'dance_style' AND slug = 'bachata' LIMIT 1;
  IF bachata_id IS NULL THEN
    INSERT INTO public.taxonomy_terms (id, slug, name, category, status, display_order)
    VALUES ('00000000-0000-0000-0000-0000000000c2', 'bachata', 'Bachata', 'dance_style', 'active', 2)
    ON CONFLICT (slug) DO UPDATE SET slug = excluded.slug
    RETURNING id INTO bachata_id;
  END IF;
  INSERT INTO public.event_taxonomy_terms (event_id, taxonomy_term_id) VALUES
    ('00000000-0000-0000-0000-0000000000a5', salsa_id),
    ('00000000-0000-0000-0000-0000000000a5', bachata_id)
  ON CONFLICT (event_id, taxonomy_term_id) DO NOTHING;
END
$tax$;

-- Insert touches (simulating what the frontend would call via record_event_touch)
insert into public.event_touches (event_id, kind, touched_at) values
  -- Paid event: 5 views, 2 ticket_click, 1 share
  ('00000000-0000-0000-0000-0000000000a1', 'view', '2026-10-14T10:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a1', 'view', '2026-10-14T11:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a1', 'view', '2026-10-14T12:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a1', 'view', '2026-10-14T13:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a1', 'view', '2026-10-14T14:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a1', 'ticket_click', '2026-10-14T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a1', 'ticket_click', '2026-10-14T16:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a1', 'share', '2026-10-14T17:00:00Z'),
  -- Free event: 3 views, 1 rsvp_click, 0 shares
  ('00000000-0000-0000-0000-0000000000a2', 'view', '2026-10-14T10:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a2', 'view', '2026-10-14T11:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a2', 'view', '2026-10-14T12:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a2', 'rsvp_click', '2026-10-14T13:00:00Z'),
  -- No-link event: 2 views only
  ('00000000-0000-0000-0000-0000000000a3', 'view', '2026-10-14T10:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a3', 'view', '2026-10-14T11:00:00Z'),
  -- Taxonomy event: 4 views, 0 clicks, 0 shares
  ('00000000-0000-0000-0000-0000000000a5', 'view', '2026-10-14T10:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a5', 'view', '2026-10-14T11:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a5', 'view', '2026-10-14T12:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a5', 'view', '2026-10-14T13:00:00Z'),
  -- Touches outside date range (should be excluded for 7d filter)
  ('00000000-0000-0000-0000-0000000000a1', 'view', '2026-09-01T10:00:00Z'),
  ('00000000-0000-0000-0000-0000000000a1', 'ticket_click', '2026-09-01T11:00:00Z');

set local session_replication_role = origin;

-- ============================================================================
-- Assertions
-- ============================================================================

do $$
declare
  v_result jsonb;
  v_summary jsonb;
  v_events jsonb;
  v_metros jsonb;
  v_styles jsonb;
  v_minute timestamptz := pg_catalog.date_trunc('minute', pg_catalog.statement_timestamp());
  v_before bigint;
begin
  -- ------------------------------------------------------------------
  -- Test 1: Admin can read engagement data
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}', true);
  v_result := public.admin_event_engagement(null, null, 'detail_views');
  v_summary := v_result->'summary';
  v_events := v_result->'events';
  v_metros := v_result->'metros';
  v_styles := v_result->'styles';

  -- All-time summary: 15 views, 1 rsvp_click, 3 ticket_click, 1 share
  if (v_summary->>'detail_views')::bigint is distinct from 15 then
    raise exception 'Expected 15 detail_views, got %', v_summary->>'detail_views';
  end if;
  if (v_summary->>'rsvp_clicks')::bigint is distinct from 1 then
    raise exception 'Expected 1 rsvp_click, got %', v_summary->>'rsvp_clicks';
  end if;
  if (v_summary->>'ticket_clicks')::bigint is distinct from 3 then
    raise exception 'Expected 3 ticket_clicks, got %', v_summary->>'ticket_clicks';
  end if;
  if (v_summary->>'shares')::bigint is distinct from 1 then
    raise exception 'Expected 1 share, got %', v_summary->>'shares';
  end if;
  if (v_summary->>'outbound_clicks')::bigint is distinct from 4 then
    raise exception 'Expected 4 outbound_clicks, got %', v_summary->>'outbound_clicks';
  end if;
  -- Ratio = 4 / 15 * 100 = 26.67 (rounded to two decimal places).
  if (v_summary->>'click_to_view_ratio')::numeric is distinct from 26.67 then
    raise exception 'Expected click_to_view_ratio 26.67, got %', v_summary->>'click_to_view_ratio';
  end if;

  -- saves_available must be false
  if (v_result->>'saves_available')::boolean is not false then
    raise exception 'saves_available must be false';
  end if;

  -- Event array: 4 events (a1, a2, a3, a5 — a4 is pending, no touches)
  if jsonb_array_length(v_events) <> 4 then
    raise exception 'Expected 4 events, got %', jsonb_array_length(v_events);
  end if;

  -- First event sorted by detail_views desc should be a1 (5 views in all-time)
  if (v_events->0->>'id')::uuid is distinct from '00000000-0000-0000-0000-0000000000a1'::uuid then
    raise exception 'First event should be a1 (most views), got %', v_events->0->>'id';
  end if;

  -- Event-city attribution remains distinct even when venue records are absent.
  if jsonb_array_length(v_metros) <> 2 then
    raise exception 'Expected 2 metros, got %', jsonb_array_length(v_metros);
  end if;
  if not exists (select 1 from jsonb_array_elements(v_metros) m where m->>'slug' = 'boston' and (m->>'detail_views')::int = 8)
     or not exists (select 1 from jsonb_array_elements(v_metros) m where m->>'slug' = 'nyc' and (m->>'detail_views')::int = 7) then
    raise exception 'Metro engagement attribution was incorrect: %', v_metros;
  end if;

  -- Canonical taxonomy overrides legacy arrays. a2 falls back to canonical Bachata;
  -- a3, which has no styles, is attributed once to Unspecified.
  if jsonb_array_length(v_styles) <> 3 then
    raise exception 'Expected Salsa, Bachata, and Unspecified rows, got %', v_styles;
  end if;
  if not exists (select 1 from jsonb_array_elements(v_styles) s where s->>'slug' = 'salsa' and (s->>'detail_views')::int = 4)
     or not exists (select 1 from jsonb_array_elements(v_styles) s where s->>'slug' = 'bachata' and (s->>'detail_views')::int = 7)
     or not exists (select 1 from jsonb_array_elements(v_styles) s where s->>'slug' = 'unspecified' and (s->>'detail_views')::int = 8) then
    raise exception 'Dance-style attribution was incorrect: %', v_styles;
  end if;

  -- ------------------------------------------------------------------
  -- Test 2: Date range filter (7d from 2026-10-14)
  -- ------------------------------------------------------------------
  v_result := public.admin_event_engagement('2026-10-08T04:00:00Z', '2026-10-15T04:00:00Z', 'detail_views');
  v_summary := v_result->'summary';
  -- The range excludes one historical September view and includes all October touches.
  if (v_summary->>'detail_views')::bigint is distinct from 14 then
    raise exception '7d: Expected 14 detail_views, got %', v_summary->>'detail_views';
  end if;
  if (v_summary->>'ticket_clicks')::bigint is distinct from 2 then
    raise exception '7d: Expected 2 ticket_clicks, got %', v_summary->>'ticket_clicks';
  end if;

  -- ------------------------------------------------------------------
  -- Test 3: Sort by ticket_clicks
  -- ------------------------------------------------------------------
  v_result := public.admin_event_engagement(null, null, 'ticket_clicks');
  v_events := v_result->'events';
  -- a1 has 3 ticket_clicks, a2/a3/a5 have 0 → a1 first
  if (v_events->0->>'id')::uuid is distinct from '00000000-0000-0000-0000-0000000000a1'::uuid then
    raise exception 'ticket_clicks sort: first should be a1';
  end if;

  -- ------------------------------------------------------------------
  -- Test 4: Saves sort must be rejected
  -- ------------------------------------------------------------------
  begin
    perform public.admin_event_engagement(null, null, 'saves');
    raise exception 'saves sort should have been rejected';
  exception when others then
    if sqlerrm not like '%invalid sort_by%' then
      raise exception 'Unexpected error for saves sort: %', sqlerrm;
    end if;
  end;

  -- ------------------------------------------------------------------
  -- Test 5: Anon denied
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"sub":null,"app_metadata":{}}', true);
  begin
    perform public.admin_event_engagement(null, null, 'detail_views');
    raise exception 'Anon should have been denied';
  exception when others then
    if sqlerrm not like '%admin role required%' then
      raise exception 'Unexpected error for anon: %', sqlerrm;
    end if;
  end;

  -- ------------------------------------------------------------------
  -- Test 6: Regular user denied
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","app_metadata":{"role":"user"}}', true);
  begin
    perform public.admin_event_engagement(null, null, 'detail_views');
    raise exception 'Regular user should have been denied';
  exception when others then
    if sqlerrm not like '%admin role required%' then
      raise exception 'Unexpected error for regular user: %', sqlerrm;
    end if;
  end;

  -- Public clients retain only the collection RPC, never direct table or report access.
  if has_table_privilege('anon', 'public.event_touches', 'select')
     or has_table_privilege('anon', 'public.event_touches', 'insert')
     or has_table_privilege('authenticated', 'public.event_touches', 'select')
     or has_table_privilege('authenticated', 'public.event_touches', 'insert') then
    raise exception 'Client table privileges must remain revoked';
  end if;
  if has_function_privilege('anon', 'public.admin_event_engagement(timestamptz,timestamptz,text)', 'execute')
     or not has_function_privilege('anon', 'public.record_event_touch(uuid,text)', 'execute') then
    raise exception 'Analytics RPC privileges are incorrect';
  end if;

  -- Moderator and organizer roles are not administrator roles.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","app_metadata":{"role":"moderator"}}', true);
  begin
    perform public.admin_event_engagement(null, null, 'detail_views');
    raise exception 'Moderator should have been denied';
  exception when others then
    if sqlerrm not like '%admin role required%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","app_metadata":{"role":"organizer"}}', true);
  begin
    perform public.admin_event_engagement(null, null, 'detail_views');
    raise exception 'Organizer should have been denied';
  exception when others then
    if sqlerrm not like '%admin role required%' then raise; end if;
  end;

  -- ------------------------------------------------------------------
  -- Test 7: record_event_touch rejects invalid kind
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"sub":null,"app_metadata":{}}', true);
  begin
    perform public.record_event_touch('00000000-0000-0000-0000-0000000000a1', 'invalid_kind');
    raise exception 'Invalid kind should have been rejected';
  exception when others then
    if sqlerrm not like '%invalid touch%' then
      raise exception 'Unexpected error for invalid kind: %', sqlerrm;
    end if;
  end;

  -- ------------------------------------------------------------------
  -- Test 8: record_event_touch no-ops for non-approved event
  -- ------------------------------------------------------------------
  perform public.record_event_touch('00000000-0000-0000-0000-0000000000a4', 'view');
  if exists (select 1 from public.event_touches where event_id = '00000000-0000-0000-0000-0000000000a4') then
    raise exception 'Pending event should not have recorded a touch';
  end if;

  -- ------------------------------------------------------------------
  -- Test 9: record_event_touch accepts new kinds for approved events
  -- ------------------------------------------------------------------
  select count(*) into v_before from public.event_touches
  where event_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'ticket_click';
  perform public.record_event_touch('00000000-0000-0000-0000-0000000000a1', 'ticket_click');
  if (select count(*) from public.event_touches where event_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'ticket_click') <> v_before + 1 then
    raise exception 'ticket_click should have been recorded exactly once';
  end if;
  select count(*) into v_before from public.event_touches
  where event_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'share';
  perform public.record_event_touch('00000000-0000-0000-0000-0000000000a1', 'share');
  if (select count(*) from public.event_touches where event_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'share') <> v_before + 1 then
    raise exception 'share should have been recorded exactly once';
  end if;
  -- Per-event/kind UTC-minute cap is atomic and silently discards excess writes.
  -- Fill the current and next minute to avoid a boundary race in this test.
  insert into public.event_touches (event_id, kind, touched_at)
  select '00000000-0000-0000-0000-0000000000a1'::uuid, 'share', v_minute + (minute_offset * interval '1 minute')
  from pg_catalog.generate_series(0, 1) minute_offset
  cross join pg_catalog.generate_series(1, 120);
  select pg_catalog.count(*) into v_before from public.event_touches
  where event_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'share'
    and touched_at >= v_minute and touched_at < v_minute + interval '2 minutes';
  perform public.record_event_touch('00000000-0000-0000-0000-0000000000a1', 'share');
  if (select pg_catalog.count(*) from public.event_touches
      where event_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'share'
        and touched_at >= v_minute and touched_at < v_minute + interval '2 minutes') <> v_before then
    raise exception 'Per-minute share cap was not enforced';

  end if;
  -- ------------------------------------------------------------------
  -- Test 10: first_recorded_at is set
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}', true);
  v_result := public.admin_event_engagement(null, null, 'detail_views');
  if (v_result->>'first_recorded_at')::timestamptz is distinct from '2026-09-01T10:00:00Z'::timestamptz then
    raise exception 'first_recorded_at should be 2026-09-01T10:00:00Z, got %', v_result->>'first_recorded_at';
  end if;

  -- Null payload fields are rejected; unknown UUIDs produce no rows.
  begin
    perform public.record_event_touch(null, 'view');
    raise exception 'Null event ID should have been rejected';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_event_touch('00000000-0000-0000-0000-0000000000a1', null);
    raise exception 'Null kind should have been rejected';
  exception when invalid_parameter_value then null;
  end;
  perform public.record_event_touch('00000000-0000-0000-0000-0000000000ff', 'view');
  if exists (select 1 from public.event_touches where event_id = '00000000-0000-0000-0000-0000000000ff') then
    raise exception 'Unknown event must not be recorded';
  end if;

  -- A taxonomy-source failure leaves summary/event/metro data available, not zeroed.
  alter table public.event_taxonomy_terms rename to phase3_missing_taxonomy_terms;
  v_result := public.admin_event_engagement(null, null, 'detail_views');
  if v_result->'styles' is distinct from 'null'::jsonb or v_result->'summary' = 'null'::jsonb
     or v_result->'events' = 'null'::jsonb or v_result->'metros' = 'null'::jsonb then
    raise exception 'Partial-source failure contract violated: %', v_result;
  end if;
  alter table public.phase3_missing_taxonomy_terms rename to event_taxonomy_terms;
  -- Empty retained history is distinct from a failed source.
  delete from public.event_touches where event_id in (
    '00000000-0000-0000-0000-0000000000a1'::uuid,
    '00000000-0000-0000-0000-0000000000a2'::uuid,
    '00000000-0000-0000-0000-0000000000a3'::uuid,
    '00000000-0000-0000-0000-0000000000a5'::uuid
  );
  v_result := public.admin_event_engagement(null, null, 'detail_views');
  if v_result->'events' is distinct from '[]'::jsonb
     or v_result->'metros' is distinct from '[]'::jsonb
     or v_result->'styles' is distinct from '[]'::jsonb
     or (v_result->'summary'->>'detail_views')::int is distinct from 0
     or v_result->'summary'->'click_to_view_ratio' is distinct from 'null'::jsonb then
    raise exception 'Empty-history contract violated: %', v_result;
  end if;
  raise notice 'All Phase 3 SQL assertions passed';
end $$;

-- Roll back all fixtures
rollback;

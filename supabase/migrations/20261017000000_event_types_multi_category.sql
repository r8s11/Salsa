-- Multi-category events + Concert.
--
-- events.event_types is the ordered, de-duplicated full category selection;
-- events.event_type remains the PRIMARY category (calendar colour, legacy
-- readers) and is always event_types[1]. A BEFORE trigger keeps the pair in
-- sync for every writer (RPCs, PostgREST inserts/updates, imports):
--   * insert with event_types          -> event_type := event_types[1]
--   * insert with only event_type      -> event_types := array[event_type]
--   * update that changes event_types  -> event_type := event_types[1]
--   * update that changes only event_type (singular-only producer)
--                                       -> event_types := array[event_type]
-- Empty / duplicate / unknown / NULL-element arrays are rejected.

-- ---------------------------------------------------------------------------
-- 1. Pure helpers
-- ---------------------------------------------------------------------------
create or replace function public.allowed_event_types()
returns text[]
language sql
immutable
parallel safe
as $$ select array['social', 'class', 'workshop', 'live_music', 'concert']::text[] $$;

-- Order-preserving de-duplication (first occurrence wins). NULL elements are
-- kept so event_types_valid() can reject them instead of silently dropping.
create or replace function public.event_types_dedupe(p_types text[])
returns text[]
language sql
immutable
parallel safe
as $$
  select array_agg(d.t order by d.first_ord)
    from (select u.t, min(u.ord) as first_ord
            from unnest(p_types) with ordinality as u(t, ord)
           group by u.t) d
$$;

create or replace function public.event_types_valid(p_types text[])
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(
    array_ndims(p_types) = 1
    and cardinality(p_types) >= 1
    and not exists (select 1 from unnest(p_types) as u(t)
                     where u.t is null or u.t <> all (public.allowed_event_types()))
    and cardinality(p_types) = (select count(distinct u.t) from unnest(p_types) as u(t)),
    false)
$$;

-- Reads the category selection out of a JSON payload (RPC payloads and
-- submission data). `event_types` (array) wins; otherwise the singular
-- `event_type` becomes a one-element selection. Returns NULL when neither key
-- is present. When a key is present but yields nothing usable, p_strict raises
-- (22023); non-strict returns NULL so callers can emit their own message.
-- Unknown / duplicate / non-string members always raise.
create or replace function public.event_types_from_payload(p_payload jsonb, p_strict boolean default true)
returns text[]
language plpgsql
stable
parallel safe
set search_path = public, pg_temp
as $$
declare
  v_raw jsonb;
  v_types text[];
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return null;
  end if;
  if not (jsonb_exists(p_payload, 'event_types') or jsonb_exists(p_payload, 'event_type')) then
    return null;
  end if;

  v_raw := p_payload -> 'event_types';
  if v_raw is not null and jsonb_typeof(v_raw) <> 'null' then
    if jsonb_typeof(v_raw) <> 'array' then
      raise exception 'event_types must be an array' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(v_raw) as e where jsonb_typeof(e) <> 'string') then
      raise exception 'event_types must contain only strings' using errcode = '22023';
    end if;
    v_types := public.event_types_dedupe(
      array(select a.x from jsonb_array_elements_text(v_raw) with ordinality as a(x, ord) order by a.ord));
  elsif jsonb_typeof(p_payload -> 'event_type') = 'string'
        and nullif(btrim(p_payload ->> 'event_type'), '') is not null then
    v_types := array[btrim(p_payload ->> 'event_type')];
  end if;

  if v_types is null then
    if p_strict then
      raise exception 'event type is required: event_types must be a non-empty array' using errcode = '22023';
    end if;
    return null;
  end if;
  if not public.event_types_valid(v_types) then
    raise exception 'unsupported event types: %', v_types using errcode = '22023';
  end if;
  return v_types;
end $$;

-- ---------------------------------------------------------------------------
-- 2. events: Concert in the primary check, event_types column, backfill
-- ---------------------------------------------------------------------------
alter table public.events drop constraint if exists events_event_type_check;
alter table public.events
  add constraint events_event_type_check
  check (event_type = any (public.allowed_event_types()));

alter table public.events add column if not exists event_types text[];

do $$
declare
  v_null_type bigint;
begin
  select count(*) into v_null_type from public.events where event_type is null and event_types is null;
  if v_null_type > 0 then
    raise exception 'cannot backfill event_types: % events have NULL event_type; assign a category first', v_null_type;
  end if;
end $$;

-- Backfill is bookkeeping, not an edit: keep it out of audit_logs and updated_at.
alter table public.events disable trigger events_audit_log;
alter table public.events disable trigger events_set_updated_at;
update public.events set event_types = array[event_type] where event_types is null;
alter table public.events enable trigger events_set_updated_at;
alter table public.events enable trigger events_audit_log;

create or replace function public.events_sync_event_types()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.event_types is null then
      new.event_types := case when new.event_type is null then null else array[new.event_type] end;
    else
      new.event_types := public.event_types_dedupe(new.event_types);
      new.event_type := new.event_types[1];
    end if;
  elsif new.event_types is distinct from old.event_types then
    new.event_types := public.event_types_dedupe(new.event_types);
    new.event_type := new.event_types[1];
  elsif new.event_type is distinct from old.event_type then
    new.event_types := case when new.event_type is null then null else array[new.event_type] end;
  end if;

  if not public.event_types_valid(new.event_types) then
    raise exception 'event_types must be a non-empty list of unique known event types (got %)', new.event_types
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists events_sync_event_types on public.events;
create trigger events_sync_event_types
before insert or update on public.events
for each row execute function public.events_sync_event_types();
revoke all on function public.events_sync_event_types() from public, anon, authenticated;

alter table public.events alter column event_types set not null;
alter table public.events drop constraint if exists events_event_types_check;
alter table public.events
  add constraint events_event_types_check check (public.event_types_valid(event_types));
alter table public.events drop constraint if exists events_event_type_primary_check;
alter table public.events
  add constraint events_event_type_primary_check check (event_type is not distinct from event_types[1]);

-- authenticated's UPDATE on events is column-scoped (20260914 provenance hardening);
-- event_types must be writable exactly where event_type is (RLS still gates rows).
grant update (event_types) on public.events to authenticated;

comment on column public.events.event_types is
  'Ordered, de-duplicated category selection. event_type is the primary category and always equals event_types[1].';

-- ---------------------------------------------------------------------------
-- 3. Public projection: append event_types (existing ordinals unchanged)
-- ---------------------------------------------------------------------------
create or replace view public.public_events as
select
 event.id,event.title,event.description,event.event_type,event.event_date,event.event_time,event.location,event.address,
 event.price_type,event.price_amount,event.rsvp_link,event.image_url,event.poster_image_url,event.status,event.source_type,
 event.city,event.host,event.recurrence,event.gallery,event.dance_styles,event.venue_id,event.organizer_id,
 event.created_at,event.updated_at,coalesce(taxonomy.terms,'[]'::jsonb) as event_taxonomy_terms,
 event.slug,event.series_id,public.public_event_entities(event.id) as public_entities,
 event.event_types
from public.events event
left join lateral (
 select jsonb_agg(jsonb_build_object('taxonomy_term_id',term.id,'taxonomy_terms',jsonb_build_object(
  'id',term.id,'name',term.name,'slug',term.slug,'category',term.category,'status',term.status
 )) order by term.category,term.name) as terms
 from public.event_taxonomy_terms link join public.taxonomy_terms term on term.id=link.taxonomy_term_id
 where link.event_id=event.id and term.status='active'
) taxonomy on true
where event.status='approved';
alter view public.public_events set (security_invoker=false);
revoke all on table public.public_events from public;
grant select on table public.public_events to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Submission JSON: normalise + validate event_types at the door
-- ---------------------------------------------------------------------------
create or replace function public.event_submissions_normalize_event_types()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_types text[];
begin
  if jsonb_typeof(new.submitted_data) = 'object'
     and (tg_op = 'INSERT' or new.submitted_data is distinct from old.submitted_data)
     and jsonb_typeof(new.submitted_data -> 'event_types') is distinct from 'null'
     and new.submitted_data -> 'event_types' is not null then
    v_types := public.event_types_from_payload(new.submitted_data);
    new.submitted_data := new.submitted_data
      || jsonb_build_object('event_types', to_jsonb(v_types), 'event_type', v_types[1]);
  end if;
  if jsonb_typeof(new.edited_data) = 'object'
     and (tg_op = 'INSERT' or new.edited_data is distinct from old.edited_data)
     and jsonb_typeof(new.edited_data -> 'event_types') is distinct from 'null'
     and new.edited_data -> 'event_types' is not null then
    v_types := public.event_types_from_payload(new.edited_data);
    new.edited_data := new.edited_data
      || jsonb_build_object('event_types', to_jsonb(v_types), 'event_type', v_types[1]);
  end if;
  return new;
end $$;

-- Name sorts before event_submissions_entity_review_guard so that guard sees normalised data.
drop trigger if exists event_submissions_aa_normalize_event_types on public.event_submissions;
create trigger event_submissions_aa_normalize_event_types
before insert or update on public.event_submissions
for each row execute function public.event_submissions_normalize_event_types();
revoke all on function public.event_submissions_normalize_event_types() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPCs: patch the latest effective definitions in place (exact, single
--    occurrence assertions; any drift fails the migration instead of
--    silently skipping a mutation path). CREATE OR REPLACE keeps grants.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.patch_fn(p_src text, p_old text, p_new text)
returns text
language plpgsql
as $$
begin
  if p_old = '' or (length(p_src) - length(replace(p_src, p_old, ''))) / length(p_old) <> 1 then
    raise exception 'event_types migration: expected exactly one occurrence of: %', p_old;
  end if;
  return replace(p_src, p_old, p_new);
end $$;

do $patch$
declare
  v text;
begin
  -- save_event_with_entities (admin/moderator create + edit, CSV import)
  v := pg_get_functiondef('public.save_event_with_entities(uuid,jsonb,boolean)'::regprocedure);
  v := pg_temp.patch_fn(v, 'v_event_type text;', 'v_event_type text; v_event_types text[];');
  v := pg_temp.patch_fn(v, 'v_event_type:=nullif(btrim(p_payload->>''event_type''),'''');',
    'v_event_type:=nullif(btrim(p_payload->>''event_type''),''''); v_event_types:=public.event_types_from_payload(p_payload); if v_event_types is not null then v_event_type:=v_event_types[1]; end if;');
  v := pg_temp.patch_fn(v, 'insert into events(title,description,event_type,event_date,',
    'insert into events(title,description,event_type,event_types,event_date,');
  v := pg_temp.patch_fn(v, 'values(v_title,v_description,v_event_type,v_event_date,',
    'values(v_title,v_description,v_event_type,v_event_types,v_event_date,');
  v := pg_temp.patch_fn(v, 'event_type=case when p_payload?''event_type'' then v_event_type else event_type end,',
    'event_type=case when v_event_types is not null then v_event_types[1] else event_type end,event_types=case when v_event_types is not null then v_event_types else event_types end,');
  execute v;

  -- approve_event_submission (JSON submission -> event)
  v := pg_get_functiondef('public.approve_event_submission(uuid,uuid[])'::regprocedure);
  v := pg_temp.patch_fn(v, E'  v_ctx jsonb;\nbegin', E'  v_ctx jsonb;\n  v_types text[];\nbegin');
  v := pg_temp.patch_fn(v, 'if coalesce(btrim(d ->> ''title''), '''') = '''' or coalesce(d ->> ''event_type'', '''') = ''''',
    E'v_types := case\n'
    '    when s.edited_data_by is not null\n'
    '     and (jsonb_exists(coalesce(s.edited_data, ''{}''::jsonb), ''event_types'') or jsonb_exists(coalesce(s.edited_data, ''{}''::jsonb), ''event_type''))\n'
    '      then public.event_types_from_payload(s.edited_data, false)\n'
    '    else public.event_types_from_payload(s.submitted_data, false)\n'
    '  end;\n'
    '  if coalesce(btrim(d ->> ''title''), '''') = '''' or v_types is null');
  v := pg_temp.patch_fn(v, '    title, description, event_type, event_date,', '    title, description, event_type, event_types, event_date,');
  v := pg_temp.patch_fn(v, 'd ->> ''event_type'', (d ->> ''event_date'')::timestamptz,',
    'v_types[1], v_types, (d ->> ''event_date'')::timestamptz,');
  execute v;

  -- organizer_create_event (host create)
  v := pg_get_functiondef('public.organizer_create_event(uuid,jsonb,boolean)'::regprocedure);
  v := pg_temp.patch_fn(v, '''title'',''description'',''event_type'',''city'',', '''title'',''description'',''event_type'',''event_types'',''city'',');
  v := pg_temp.patch_fn(v, 'if nullif(btrim(p_payload ->> ''event_type''), '''') is null then',
    'if public.event_types_from_payload(p_payload) is null then');
  v := pg_temp.patch_fn(v, '    title, description, event_type, city, event_date,', '    title, description, event_type, event_types, city, event_date,');
  v := pg_temp.patch_fn(v, E'    p_payload ->> ''event_type'',\n',
    E'    (public.event_types_from_payload(p_payload))[1],\n    public.event_types_from_payload(p_payload),\n');
  execute v;

  -- organizer_update_event (host edit)
  v := pg_get_functiondef('public.organizer_update_event(uuid,jsonb)'::regprocedure);
  v := pg_temp.patch_fn(v, '''title'',''description'',''event_type'',''city'',', '''title'',''description'',''event_type'',''event_types'',''city'',');
  v := pg_temp.patch_fn(v,
    E'    event_type         = case when p_payload ? ''event_type''         then p_payload ->> ''event_type''         else e.event_type         end,\n',
    E'    event_type         = case when p_payload ? ''event_types'' or p_payload ? ''event_type'' then (public.event_types_from_payload(p_payload))[1] else e.event_type end,\n'
    '    event_types        = case when p_payload ? ''event_types'' or p_payload ? ''event_type'' then public.event_types_from_payload(p_payload) else e.event_types end,\n');
  execute v;
end $patch$;

NOTIFY pgrst, 'reload schema';

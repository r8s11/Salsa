-- Optional NYC boroughs on events.
--
-- events.sublocation holds a borough slug (manhattan | brooklyn | queens |
-- bronx | staten-island). NULL means "All NYC" (and, for every other city,
-- "no sublocation"). Existing NYC rows are intentionally NOT backfilled: they
-- stay NULL = All NYC until a human assigns a borough.
--
-- Invariants (enforced in the database, not just the UI):
--   * only new-york-city events may carry a borough (check constraint);
--   * the borough must be one of the five slugs (check constraint);
--   * a write path that changes an event's city away from NYC without sending
--     an explicit borough clears the now-stale borough (RPC resolver + trigger);
--   * an explicit borough that contradicts the city is rejected, never silently
--     dropped (RPC resolver raises 22023; direct writes hit the constraint).
--
-- Follows the event_types convention: existing RPCs are patched in place from
-- their live definitions (exact single-occurrence anchors, idempotent re-run) so
-- security, provenance and entity-review behaviour is inherited from production
-- instead of re-typed here.
--
-- Independent of the multiple-flyers migration: deployable straight after
-- 20261024120000_event_types_multi_category (single-flyer layout) and also on a
-- database that already carries events.image_urls / event_flyers_from_payload
-- (multi-flyer layout). Every RPC anchor is an insertion point that exists
-- unchanged in both layouts and overlaps none of the flyer migration's own
-- anchors. The public_events view is rebuilt from its live column list:
-- image_urls is carried only if the view already exposes it, and sublocation
-- is always appended last.

-- ---------------------------------------------------------------------------
-- 1. Column, constraint, index, grant
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists sublocation text;

alter table public.events drop constraint if exists events_sublocation_check;
alter table public.events
  add constraint events_sublocation_check check (
    sublocation is null
    or (
      city is not distinct from 'new-york-city'
      and sublocation in ('manhattan', 'brooklyn', 'queens', 'bronx', 'staten-island')
    )
  );

create index if not exists events_approved_city_sublocation_event_date_idx
  on public.events (city, sublocation, event_date)
  where status = 'approved';

-- authenticated's UPDATE on events is column-scoped (20260914 provenance
-- hardening); sublocation must be writable exactly where city is (RLS still
-- gates rows).
grant update (sublocation) on public.events to authenticated;

comment on column public.events.sublocation is
  'Optional NYC borough slug. NULL means All NYC; only NYC events may have a borough.';

-- ---------------------------------------------------------------------------
-- 2. Resolver shared by every event-writing RPC
--    p_stale_ok = true  -> the caller did not send a borough; a borough carried
--                          over from the previous state is dropped when the
--                          effective city is not NYC.
--    p_stale_ok = false -> the borough is explicit; a contradiction is an error.
-- ---------------------------------------------------------------------------
create or replace function public.event_sublocation_resolve(p_city text, p_value text, p_stale_ok boolean default false)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := nullif(btrim(p_value), '');
begin
  if v is null then
    return null;
  end if;
  if p_city is distinct from 'new-york-city' then
    if coalesce(p_stale_ok, false) then
      return null;
    end if;
    raise exception 'sublocation is only allowed for new-york-city events' using errcode = '22023';
  end if;
  if v not in ('manhattan', 'brooklyn', 'queens', 'bronx', 'staten-island') then
    raise exception 'invalid NYC sublocation: %', v using errcode = '22023';
  end if;
  return v;
end $$;
revoke all on function public.event_sublocation_resolve(text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Direct-write safety net (owner edits go straight to the table under RLS)
-- ---------------------------------------------------------------------------
create or replace function public.events_normalize_sublocation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.sublocation := nullif(btrim(new.sublocation), '');
  -- City moved away from NYC while the borough was left untouched: it is stale.
  -- An explicit, changed borough is left alone so the check constraint rejects it.
  if tg_op = 'UPDATE'
     and new.city is distinct from old.city
     and new.city is distinct from 'new-york-city'
     and new.sublocation is not distinct from old.sublocation then
    new.sublocation := null;
  end if;
  return new;
end $$;

drop trigger if exists events_normalize_sublocation on public.events;
create trigger events_normalize_sublocation
before insert or update on public.events
for each row execute function public.events_normalize_sublocation();
revoke all on function public.events_normalize_sublocation() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Public projection: append sublocation (existing ordinals unchanged)
--    Rebuilt from the view's live column list so it works on either layout:
--      event_types                      (baseline: event types migration)
--      event_types, image_urls          (database that also has multiple flyers)
--    Any other shape fails loudly instead of silently dropping a column.
--    Re-runnable: a trailing sublocation column is stripped before matching.
-- ---------------------------------------------------------------------------
do $view$
declare
  v_base constant text[] := array[
    'id','title','description','event_type','event_date','event_time','location','address',
    'price_type','price_amount','rsvp_link','image_url','poster_image_url','status','source_type',
    'city','host','recurrence','gallery','dance_styles','venue_id','organizer_id',
    'created_at','updated_at','event_taxonomy_terms','slug','series_id','public_entities','event_types'
  ];
  v_cols text[];
  v_has_flyers boolean;
begin
  select array_agg(a.attname::text order by a.attnum)
    into v_cols
    from pg_attribute a
   where a.attrelid = 'public.public_events'::regclass and a.attnum > 0 and not a.attisdropped;

  if v_cols[cardinality(v_cols)] = 'sublocation' then
    v_cols := v_cols[1:cardinality(v_cols) - 1];
  end if;

  if v_cols = v_base then
    v_has_flyers := false;
  elsif v_cols = v_base || array['image_urls'] then
    v_has_flyers := true;
  else
    raise exception 'event sublocation migration: unexpected public_events columns: %', v_cols;
  end if;

  execute format($sql$
create or replace view public.public_events as
select
 event.id,event.title,event.description,event.event_type,event.event_date,event.event_time,event.location,event.address,
 event.price_type,event.price_amount,event.rsvp_link,event.image_url,event.poster_image_url,event.status,event.source_type,
 event.city,event.host,event.recurrence,event.gallery,event.dance_styles,event.venue_id,event.organizer_id,
 event.created_at,event.updated_at,coalesce(taxonomy.terms,'[]'::jsonb) as event_taxonomy_terms,
 event.slug,event.series_id,public.public_event_entities(event.id) as public_entities,
 event.event_types%s,
 event.sublocation
from public.events event
left join lateral (
 select jsonb_agg(jsonb_build_object('taxonomy_term_id',term.id,'taxonomy_terms',jsonb_build_object(
  'id',term.id,'name',term.name,'slug',term.slug,'category',term.category,'status',term.status
 )) order by term.category,term.name) as terms
 from public.event_taxonomy_terms link join public.taxonomy_terms term on term.id=link.taxonomy_term_id
 where link.event_id=event.id and term.status='active'
) taxonomy on true
where event.status='approved'
$sql$, case when v_has_flyers then E',\n event.image_urls' else '' end);
end $view$;
alter view public.public_events set (security_invoker=false);
revoke all on table public.public_events from public;
grant select on table public.public_events to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPCs: patch the latest effective definitions in place (exact, single
--    occurrence assertions; any drift fails the migration instead of silently
--    skipping a mutation path). CREATE OR REPLACE keeps grants.
--
--    Anchors are insertion points that are identical with and without the
--    multiple-flyers migration, and none overlaps a flyer anchor (image_url /
--    image_urls text), so this works on the single-flyer baseline AND on a
--    database already carrying events.image_urls, and leaves the flyer
--    migration's own patches applicable.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.patch_fn(p_src text, p_old text, p_new text)
returns text
language plpgsql
as $$
begin
  if p_old = '' or (length(p_src) - length(replace(p_src, p_old, ''))) / length(p_old) <> 1 then
    raise exception 'event sublocation migration: expected exactly one occurrence of: %', p_old;
  end if;
  return replace(p_src, p_old, p_new);
end $$;

-- Same contract as patch_fn, for an anchor that exists in two layouts (the
-- repo's organizer_update_event is padded; production's is one item per line).
-- p_olds[i] is replaced by p_news[i]; exactly one layout must match, exactly once.
create or replace function pg_temp.patch_one_of(p_src text, p_olds text[], p_news text[])
returns text
language plpgsql
as $$
declare
  v_hit int;
  v_hits int := 0;
begin
  if cardinality(p_olds) <> cardinality(p_news) then
    raise exception 'event sublocation migration: patch_one_of needs one replacement per layout';
  end if;
  for i in 1 .. cardinality(p_olds) loop
    if p_olds[i] <> '' and (length(p_src) - length(replace(p_src, p_olds[i], ''))) / length(p_olds[i]) = 1 then
      v_hits := v_hits + 1;
      v_hit := i;
    end if;
  end loop;
  if v_hits <> 1 then
    raise exception 'event sublocation migration: expected exactly one layout to match once, got % of: %', v_hits, p_olds;
  end if;
  return replace(p_src, p_olds[v_hit], p_news[v_hit]);
end $$;

do $patch$
declare
  v text;
begin
  -- Each block is skipped once its function already references
  -- event_sublocation_resolve (only this migration introduces it), so a retried
  -- deploy is a no-op. The exact-match anchors still guard the first application.

  -- save_event_with_entities (admin/moderator create + edit, bulk import, CSV).
  -- v_sublocation is the final value: explicit payload value, or the stored one
  -- (dropped if the effective city is no longer NYC).
  v := pg_get_functiondef('public.save_event_with_entities(uuid,jsonb,boolean)'::regprocedure);
  if v !~ 'event_sublocation_resolve' then
    v := pg_temp.patch_fn(v, 'v_event_type text; v_event_types text[];', 'v_event_type text; v_event_types text[]; v_sublocation text;');
    v := pg_temp.patch_fn(v, 'v_has_review:=jsonb_exists(p_payload,''entity_review'');',
      'v_sublocation:=public.event_sublocation_resolve(case when p_payload?''city'' then v_city when p_event_id is not null then e.city end,'
      || ' case when p_payload?''sublocation'' then nullif(btrim(p_payload->>''sublocation''),'''') when p_event_id is not null then e.sublocation end,'
      || ' p_event_id is not null and not p_payload?''sublocation''); v_has_review:=jsonb_exists(p_payload,''entity_review'');');
    v := pg_temp.patch_fn(v, ',venue_id,organizer_id,series_id)', ',venue_id,organizer_id,series_id,sublocation)');
    v := pg_temp.patch_fn(v, ',v_venue,v_org,v_series) returning id into v_id;', ',v_venue,v_org,v_series,v_sublocation) returning id into v_id;');
    v := pg_temp.patch_fn(v, 'city=case when p_payload?''city'' then v_city else city end,',
      'sublocation=v_sublocation,city=case when p_payload?''city'' then v_city else city end,');
    execute v;
  end if;

  -- approve_event_submission (JSON submission -> event). A borough left over in
  -- submitted_data is dropped only when the moderator's (provenance-trusted)
  -- edit moved the city without also sending a borough; any other contradiction
  -- (e.g. a public submission claiming Boston + Brooklyn) fails the approval.
  v := pg_get_functiondef('public.approve_event_submission(uuid,uuid[])'::regprocedure);
  if v !~ 'event_sublocation_resolve' then
    v := pg_temp.patch_fn(v, 'rsvp_link, city, status,', 'rsvp_link, city, sublocation, status,');
    v := pg_temp.patch_fn(v, 'd ->> ''city'', ''approved'',',
      'd ->> ''city'','
      || ' public.event_sublocation_resolve(d ->> ''city'', d ->> ''sublocation'','
      || ' s.edited_data_by is not null and jsonb_exists(coalesce(s.edited_data, ''{}''::jsonb), ''city'')'
      || ' and not jsonb_exists(coalesce(s.edited_data, ''{}''::jsonb), ''sublocation'')'
      || ' and (s.edited_data ->> ''city'') is distinct from (s.submitted_data ->> ''city'')),'
      || ' ''approved'',');
    execute v;
  end if;

  -- organizer_create_event (host create). The field allowlist is widened at its
  -- single use site; the INSERT stays one coherent column/value pair.
  v := pg_get_functiondef('public.organizer_create_event(uuid,jsonb,boolean)'::regprocedure);
  if v !~ 'event_sublocation_resolve' then
    v := pg_temp.patch_fn(v, 'any(v_allowed)', 'any(v_allowed || array[''sublocation''])');
    v := pg_temp.patch_fn(v, 'venue_id, status,', 'venue_id, sublocation, status,');
    v := pg_temp.patch_fn(v, 'case when nullif(p_payload ->> ''venue_id'', '''') is null then null else (p_payload ->> ''venue_id'')::uuid end,',
      'case when nullif(p_payload ->> ''venue_id'', '''') is null then null else (p_payload ->> ''venue_id'')::uuid end,'
      || E'\n    public.event_sublocation_resolve(coalesce(nullif(p_payload ->> ''city'', ''''), ''boston''), p_payload ->> ''sublocation''),');
    execute v;
  end if;

  -- organizer_update_event (host edit). The repo defines it padded; production
  -- may be reformatted one item per line, so the SET anchor accepts both layouts
  -- (it is the event_types item written by the event types migration).
  v := pg_get_functiondef('public.organizer_update_event(uuid,jsonb)'::regprocedure);
  if v !~ 'event_sublocation_resolve' then
    v := pg_temp.patch_fn(v, 'any(v_allowed)', 'any(v_allowed || array[''sublocation''])');
    v := pg_temp.patch_one_of(v,
      array[E'    event_types        = case when p_payload ? ''event_types'' or p_payload ? ''event_type'' then public.event_types_from_payload(p_payload) else e.event_types end,\n',
            E'    event_types =\n      case\n        when p_payload ? ''event_types'' or p_payload ? ''event_type''\n        then public.event_types_from_payload(p_payload)\n        else e.event_types\n      end,\n'],
      array[E'    event_types        = case when p_payload ? ''event_types'' or p_payload ? ''event_type'' then public.event_types_from_payload(p_payload) else e.event_types end,\n'
            || E'    sublocation        = public.event_sublocation_resolve(case when p_payload ? ''city'' then p_payload ->> ''city'' else e.city end,'
            || E' case when p_payload ? ''sublocation'' then p_payload ->> ''sublocation'' else e.sublocation end,'
            || E' not (p_payload ? ''sublocation'')),\n',
            E'    event_types =\n      case\n        when p_payload ? ''event_types'' or p_payload ? ''event_type''\n        then public.event_types_from_payload(p_payload)\n        else e.event_types\n      end,\n'
            || E'    sublocation =\n      public.event_sublocation_resolve(\n        case when p_payload ? ''city'' then p_payload ->> ''city'' else e.city end,\n'
            || E'        case when p_payload ? ''sublocation'' then p_payload ->> ''sublocation'' else e.sublocation end,\n'
            || E'        not (p_payload ? ''sublocation'')),\n']);
    execute v;
  end if;
end $patch$;

notify pgrst, 'reload schema';

-- Curated event neighborhoods. Existing rows stay NULL; no location is inferred.
-- This migration extends the established sublocation RPC patching pattern so
-- authorization, provenance, entity review, and existing grants remain intact.

alter table public.events add column if not exists neighborhood text;

create or replace function public.event_neighborhood_catalog()
returns table(city text, borough text, slug text)
language sql
immutable
set search_path = public, pg_temp
as $$
  values
    ('new-york-city','manhattan','harlem'),('new-york-city','manhattan','washington-heights'),('new-york-city','manhattan','east-village'),('new-york-city','manhattan','chelsea'),('new-york-city','manhattan','midtown'),
    ('new-york-city','brooklyn','williamsburg'),('new-york-city','brooklyn','bushwick'),('new-york-city','brooklyn','downtown-brooklyn'),('new-york-city','brooklyn','park-slope'),
    ('new-york-city','queens','astoria'),('new-york-city','queens','long-island-city'),('new-york-city','queens','jackson-heights'),('new-york-city','queens','flushing'),
    ('new-york-city','bronx','mott-haven'),('new-york-city','bronx','fordham'),('new-york-city','bronx','kingsbridge'),
    ('new-york-city','staten-island','st-george'),('new-york-city','staten-island','tompkinsville'),('new-york-city','staten-island','stapleton'),
    ('boston',null,'allston'),('boston',null,'brighton'),('boston',null,'back-bay'),('boston',null,'south-end'),('boston',null,'jamaica-plain'),('boston',null,'dorchester'),('boston',null,'roxbury'),('boston',null,'east-boston'),
    ('atlanta',null,'midtown-atlanta'),('atlanta',null,'downtown-atlanta'),('atlanta',null,'buckhead'),('atlanta',null,'old-fourth-ward'),
    ('los-angeles',null,'hollywood'),('los-angeles',null,'downtown-los-angeles'),('los-angeles',null,'silver-lake'),('los-angeles',null,'echo-park'),
    ('miami',null,'little-havana'),('miami',null,'wynwood'),('miami',null,'brickell'),('miami',null,'downtown-miami'),
    ('orlando',null,'downtown-orlando'),('orlando',null,'mills-50'),('orlando',null,'college-park'),('orlando',null,'thornton-park'),
    ('san-francisco',null,'mission-district'),('san-francisco',null,'soma'),('san-francisco',null,'castro'),('san-francisco',null,'north-beach'),
    ('washington-dc',null,'adams-morgan'),('washington-dc',null,'columbia-heights'),('washington-dc',null,'dupont-circle'),('washington-dc',null,'u-street')
$$;
revoke all on function public.event_neighborhood_catalog() from public, anon, authenticated;

create or replace function public.event_neighborhood_valid(p_city text, p_borough text, p_value text)
returns boolean
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.event_neighborhood_catalog() n
    where n.city = p_city and n.borough is not distinct from p_borough and n.slug = p_value
  )
$$;
revoke all on function public.event_neighborhood_valid(text,text,text) from public;
grant execute on function public.event_neighborhood_valid(text,text,text) to anon, authenticated, service_role;

create or replace function public.event_neighborhood_resolve(
  p_city text, p_borough text, p_value text, p_stale_ok boolean default false
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := nullif(btrim(p_value), '');
begin
  if v is null then return null; end if;
  if public.event_neighborhood_valid(p_city, p_borough, v) then return v; end if;
  if coalesce(p_stale_ok, false) then return null; end if;
  raise exception 'invalid neighborhood for city and borough: %', v using errcode = '22023';
end $$;
revoke all on function public.event_neighborhood_resolve(text,text,text,boolean) from public, anon, authenticated;

alter table public.events drop constraint if exists events_neighborhood_check;
alter table public.events add constraint events_neighborhood_check check (
  neighborhood is null or public.event_neighborhood_valid(city, sublocation, neighborhood)
);
create index if not exists events_approved_city_sublocation_neighborhood_event_date_idx
  on public.events (city, sublocation, neighborhood, event_date) where status = 'approved';
grant update (neighborhood) on public.events to authenticated;
comment on column public.events.neighborhood is
  'Optional curated neighborhood slug valid only for its catalog city and borough; NULL means unassigned.';

-- Direct owner writes (including submitter edits) cannot retain a stale child
-- when a city or borough moves. An explicit replacement is validated by CHECK.
create or replace function public.events_normalize_neighborhood()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.neighborhood := nullif(btrim(new.neighborhood), '');
  if (new.city is distinct from old.city or new.sublocation is distinct from old.sublocation)
     and new.neighborhood is not distinct from old.neighborhood then
    new.neighborhood := null;
  end if;
  return new;
end $$;
revoke all on function public.events_normalize_neighborhood() from public, anon, authenticated;

create or replace function public.events_validate_neighborhood()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.neighborhood := nullif(btrim(new.neighborhood), '');
  if new.neighborhood is not null
     and not public.event_neighborhood_valid(new.city, new.sublocation, new.neighborhood) then
    raise exception 'invalid neighborhood for city and borough: %', new.neighborhood using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function public.events_validate_neighborhood() from public, anon, authenticated;
-- Trigger order is alphabetical. Validation must run after both normalizers
-- (events_normalize_neighborhood, events_normalize_sublocation) so a stale
-- child or borough cleared by them is never rejected first; the CHECK
-- constraint remains the final guarantee.
drop trigger if exists events_neighborhood_validate on public.events;
drop trigger if exists events_validate_neighborhood on public.events;
create trigger events_validate_neighborhood before insert or update of neighborhood on public.events
for each row execute function public.events_validate_neighborhood();
drop trigger if exists events_normalize_neighborhood on public.events;
create trigger events_normalize_neighborhood before update of city, sublocation on public.events
for each row execute function public.events_normalize_neighborhood();

-- Append column to keep all existing public_events column ordinals stable.
create or replace view public.public_events as
select
 event.id,event.title,event.description,event.event_type,event.event_date,event.event_time,event.location,event.address,
 event.price_type,event.price_amount,event.rsvp_link,event.image_url,event.poster_image_url,event.status,event.source_type,
 event.city,event.host,event.recurrence,event.gallery,event.dance_styles,event.venue_id,event.organizer_id,
 event.created_at,event.updated_at,coalesce(taxonomy.terms,'[]'::jsonb) as event_taxonomy_terms,
 event.slug,event.series_id,public.public_event_entities(event.id) as public_entities,
 event.event_types,
 event.image_urls,
 event.sublocation,
 event.neighborhood
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

create or replace function pg_temp.neighborhood_patch(p_src text, p_old text, p_new text)
returns text language plpgsql as $$
begin
  if p_old = '' or (length(p_src) - length(replace(p_src, p_old, ''))) / length(p_old) <> 1 then
    raise exception 'event neighborhood migration: expected exactly one occurrence of: %', p_old;
  end if;
  return replace(p_src, p_old, p_new);
end $$;

-- For an anchor that exists in two layouts (the repo's organizer_update_event is
-- padded; production's may be one item per line). Exactly one layout must match, once.
create or replace function pg_temp.neighborhood_patch_one_of(p_src text, p_olds text[], p_news text[])
returns text language plpgsql as $$
declare
  v_hit int;
  v_hits int := 0;
begin
  if cardinality(p_olds) <> cardinality(p_news) then
    raise exception 'event neighborhood migration: one replacement per layout required';
  end if;
  for i in 1 .. cardinality(p_olds) loop
    if p_olds[i] <> '' and (length(p_src) - length(replace(p_src, p_olds[i], ''))) / length(p_olds[i]) = 1 then
      v_hits := v_hits + 1;
      v_hit := i;
    end if;
  end loop;
  if v_hits <> 1 then
    raise exception 'event neighborhood migration: expected exactly one layout to match once, got % of: %', v_hits, p_olds;
  end if;
  return replace(p_src, p_olds[v_hit], p_news[v_hit]);
end $$;

do $patch$
declare
  v text;
begin
  -- Admin/moderator create and edit, bulk imports, and CSV all use this RPC.
  v := pg_get_functiondef('public.save_event_with_entities(uuid,jsonb,boolean)'::regprocedure);
  if v !~ 'event_neighborhood_resolve' then
    v := pg_temp.neighborhood_patch(v, 'v_sublocation text;', 'v_sublocation text; v_neighborhood text;');
    v := pg_temp.neighborhood_patch(v,
      'v_sublocation:=public.event_sublocation_resolve(case when p_payload?''city'' then v_city when p_event_id is not null then e.city end, case when p_payload?''sublocation'' then nullif(btrim(p_payload->>''sublocation''),'''') when p_event_id is not null then e.sublocation end, p_event_id is not null and not p_payload?''sublocation''); v_has_review:=jsonb_exists(p_payload,''entity_review'');',
      'v_sublocation:=public.event_sublocation_resolve(case when p_payload?''city'' then v_city when p_event_id is not null then e.city end, case when p_payload?''sublocation'' then nullif(btrim(p_payload->>''sublocation''),'''') when p_event_id is not null then e.sublocation end, p_event_id is not null and not p_payload?''sublocation'');'
      || ' v_neighborhood:=public.event_neighborhood_resolve(case when p_payload?''city'' then v_city when p_event_id is not null then e.city end, v_sublocation,'
      || ' case when p_payload?''neighborhood'' then nullif(btrim(p_payload->>''neighborhood''),'''')'
      || ' when p_event_id is not null and ((case when p_payload?''city'' then v_city else e.city end) is distinct from e.city or v_sublocation is distinct from e.sublocation) then null'
      || ' when p_event_id is not null then e.neighborhood end, false); v_has_review:=jsonb_exists(p_payload,''entity_review'');');
    v := pg_temp.neighborhood_patch(v, ',venue_id,organizer_id,series_id,sublocation)', ',venue_id,organizer_id,series_id,sublocation,neighborhood)');
    v := pg_temp.neighborhood_patch(v, ',v_venue,v_org,v_series,v_sublocation) returning id into v_id;', ',v_venue,v_org,v_series,v_sublocation,v_neighborhood) returning id into v_id;');
    v := pg_temp.neighborhood_patch(v, 'sublocation=v_sublocation,city=case when p_payload?''city'' then v_city else city end,',
      'sublocation=v_sublocation,neighborhood=v_neighborhood,city=case when p_payload?''city'' then v_city else city end,');
    execute v;
  end if;

  -- Submission approval materializes only the trusted effective JSON snapshot.
  v := pg_get_functiondef('public.approve_event_submission(uuid,uuid[])'::regprocedure);
  if v !~ 'event_neighborhood_resolve' then
    v := pg_temp.neighborhood_patch(v, 'rsvp_link, city, sublocation, status,', 'rsvp_link, city, sublocation, neighborhood, status,');
    v := pg_temp.neighborhood_patch(v,
      '(s.edited_data ->> ''city'') is distinct from (s.submitted_data ->> ''city'')), ''approved'', ''moderator'',',
      '(s.edited_data ->> ''city'') is distinct from (s.submitted_data ->> ''city'')), public.event_neighborhood_resolve(d ->> ''city'', d ->> ''sublocation'', case when s.edited_data_by is not null and not jsonb_exists(coalesce(s.edited_data, ''{}''::jsonb), ''neighborhood'') and ((d ->> ''city'') is distinct from (s.submitted_data ->> ''city'') or (d ->> ''sublocation'') is distinct from (s.submitted_data ->> ''sublocation'')) then null else d ->> ''neighborhood'' end, false), ''approved'', ''moderator'',');
    execute v;
  end if;

  -- Host create remains SECURITY DEFINER with its original allowlist and grants.
  v := pg_get_functiondef('public.organizer_create_event(uuid,jsonb,boolean)'::regprocedure);
  if v !~ 'event_neighborhood_resolve' then
    v := pg_temp.neighborhood_patch(v, 'any(v_allowed || array[''sublocation''])', 'any(v_allowed || array[''sublocation'',''neighborhood''])');
    v := pg_temp.neighborhood_patch(v, 'venue_id, sublocation, status,', 'venue_id, sublocation, neighborhood, status,');
    v := pg_temp.neighborhood_patch(v,
      'public.event_sublocation_resolve(coalesce(nullif(p_payload ->> ''city'', ''''), ''boston''), p_payload ->> ''sublocation''),',
      'public.event_sublocation_resolve(coalesce(nullif(p_payload ->> ''city'', ''''), ''boston''), p_payload ->> ''sublocation''), public.event_neighborhood_resolve(coalesce(nullif(p_payload ->> ''city'', ''''), ''boston''), public.event_sublocation_resolve(coalesce(nullif(p_payload ->> ''city'', ''''), ''boston''), p_payload ->> ''sublocation''), p_payload ->> ''neighborhood''),');
    execute v;
  end if;

  -- Host edits retain only explicit valid neighborhoods; stale children clear.
  v := pg_get_functiondef('public.organizer_update_event(uuid,jsonb)'::regprocedure);
  if v !~ 'event_neighborhood_resolve' then
    v := pg_temp.neighborhood_patch(v, 'any(v_allowed || array[''sublocation''])', 'any(v_allowed || array[''sublocation'',''neighborhood''])');
    v := pg_temp.neighborhood_patch_one_of(v,
      array[
        'sublocation        = public.event_sublocation_resolve(case when p_payload ? ''city'' then p_payload ->> ''city'' else e.city end, case when p_payload ? ''sublocation'' then p_payload ->> ''sublocation'' else e.sublocation end, not (p_payload ? ''sublocation'')),',
        E'    sublocation =\n      public.event_sublocation_resolve(\n        case when p_payload ? ''city'' then p_payload ->> ''city'' else e.city end,\n        case when p_payload ? ''sublocation'' then p_payload ->> ''sublocation'' else e.sublocation end,\n        not (p_payload ? ''sublocation'')),'
      ],
      array[
        'sublocation        = public.event_sublocation_resolve(case when p_payload ? ''city'' then p_payload ->> ''city'' else e.city end, case when p_payload ? ''sublocation'' then p_payload ->> ''sublocation'' else e.sublocation end, not (p_payload ? ''sublocation'')), neighborhood = public.event_neighborhood_resolve(case when p_payload ? ''city'' then p_payload ->> ''city'' else e.city end, case when p_payload ? ''sublocation'' then p_payload ->> ''sublocation'' else e.sublocation end, case when p_payload ? ''neighborhood'' then p_payload ->> ''neighborhood'' when (case when p_payload ? ''city'' then p_payload ->> ''city'' else e.city end) is distinct from e.city or (case when p_payload ? ''sublocation'' then p_payload ->> ''sublocation'' else e.sublocation end) is distinct from e.sublocation then null else e.neighborhood end, not (p_payload ? ''neighborhood'')),',
        E'    sublocation =\n      public.event_sublocation_resolve(\n        case when p_payload ? ''city'' then p_payload ->> ''city'' else e.city end,\n        case when p_payload ? ''sublocation'' then p_payload ->> ''sublocation'' else e.sublocation end,\n        not (p_payload ? ''sublocation'')),\n    neighborhood = public.event_neighborhood_resolve(case when p_payload ? ''city'' then p_payload ->> ''city'' else e.city end, case when p_payload ? ''sublocation'' then p_payload ->> ''sublocation'' else e.sublocation end, case when p_payload ? ''neighborhood'' then p_payload ->> ''neighborhood'' when (case when p_payload ? ''city'' then p_payload ->> ''city'' else e.city end) is distinct from e.city or (case when p_payload ? ''sublocation'' then p_payload ->> ''sublocation'' else e.sublocation end) is distinct from e.sublocation then null else e.neighborhood end, not (p_payload ? ''neighborhood'')),'
      ]);
    execute v;
  end if;
end $patch$;

notify pgrst, 'reload schema';

-- Multiple flyers per event.
--
-- events.image_urls is the ordered, de-duplicated flyer list (max 5);
-- events.image_url remains the PRIMARY flyer (posters, cards, list thumbnails,
-- extraction, legacy readers) and always equals image_urls[1]. A BEFORE trigger
-- keeps the pair in sync for every writer (RPCs, PostgREST, imports):
--   * insert with image_urls            -> image_url := image_urls[1]
--   * insert with only image_url        -> image_urls := array[image_url]
--   * update that changes image_urls    -> image_url := image_urls[1]
--   * update that changes only image_url -> image_urls := array[image_url]
--                                          (legacy single-flyer producer)
-- NULL / empty image_urls normalise to NULL for both columns. Blank, NULL,
-- duplicate, or > 5 entries are rejected.

-- ---------------------------------------------------------------------------
-- 1. Pure helpers
-- ---------------------------------------------------------------------------
create or replace function public.max_event_flyers()
returns int
language sql
immutable
parallel safe
as $$ select 5 $$;

-- Order-preserving de-duplication (first occurrence wins); blank strings and
-- NULLs are dropped; returns NULL for an empty result.
create or replace function public.event_flyers_clean(p_urls text[])
returns text[]
language sql
immutable
parallel safe
as $$
  select array_agg(d.u order by d.first_ord)
    from (select btrim(x.u) as u, min(x.ord) as first_ord
            from unnest(p_urls) with ordinality as x(u, ord)
           where nullif(btrim(x.u), '') is not null
           group by btrim(x.u)) d
$$;

create or replace function public.event_flyers_valid(p_urls text[])
returns boolean
language sql
immutable
parallel safe
as $$
  select p_urls is null
      or (array_ndims(p_urls) = 1
          and cardinality(p_urls) between 1 and public.max_event_flyers()
          and not exists (select 1 from unnest(p_urls) as u(x) where nullif(btrim(u.x), '') is null)
          and cardinality(p_urls) = (select count(distinct u.x) from unnest(p_urls) as u(x)))
$$;

-- Reads the flyer list out of a JSON payload (RPC payloads and submission
-- data). `image_urls` (array) wins; otherwise the singular `image_url` becomes
-- a one-element list. Returns NULL when neither key is present OR the value is
-- empty/blank (callers decide with `p_payload ? 'image_urls'` whether that
-- means "clear"). Non-array / non-string members and > max raise 22023.
create or replace function public.event_flyers_from_payload(p_payload jsonb)
returns text[]
language plpgsql
immutable
parallel safe
as $$
declare
  v_raw text[];
  v_clean text[];
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return null;
  end if;

  if p_payload ? 'image_urls' and jsonb_typeof(p_payload -> 'image_urls') <> 'null' then
    if jsonb_typeof(p_payload -> 'image_urls') <> 'array' then
      raise exception 'image_urls must be an array of URLs' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(p_payload -> 'image_urls') e
                where jsonb_typeof(e) <> 'string') then
      raise exception 'image_urls must contain only strings' using errcode = '22023';
    end if;
    select array_agg(e) into v_raw from jsonb_array_elements_text(p_payload -> 'image_urls') e;
  elsif p_payload ? 'image_url' and jsonb_typeof(p_payload -> 'image_url') = 'string' then
    v_raw := array[p_payload ->> 'image_url'];
  else
    return null;
  end if;

  v_clean := public.event_flyers_clean(v_raw);
  if v_clean is not null and cardinality(v_clean) > public.max_event_flyers() then
    raise exception 'an event can have at most % flyers', public.max_event_flyers() using errcode = '22023';
  end if;
  return v_clean;
end $$;

-- ---------------------------------------------------------------------------
-- 2. events: image_urls column, backfill, sync trigger, constraints
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists image_urls text[];

-- Backfill is bookkeeping, not an edit: keep it out of audit_logs, updated_at,
-- and the poster-cache invalidation trigger (image_url itself is unchanged).
alter table public.events disable trigger events_audit_log;
alter table public.events disable trigger events_set_updated_at;
update public.events
   set image_urls = array[btrim(image_url)]
 where image_urls is null and nullif(btrim(image_url), '') is not null;
alter table public.events enable trigger events_set_updated_at;
alter table public.events enable trigger events_audit_log;

create or replace function public.events_sync_event_flyers()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.image_urls is null then
      new.image_urls := case when nullif(btrim(new.image_url), '') is null then null
                             else array[btrim(new.image_url)] end;
    else
      new.image_urls := public.event_flyers_clean(new.image_urls);
    end if;
  elsif new.image_urls is distinct from old.image_urls then
    new.image_urls := public.event_flyers_clean(new.image_urls);
  elsif new.image_url is distinct from old.image_url then
    new.image_urls := case when nullif(btrim(new.image_url), '') is null then null
                           else array[btrim(new.image_url)] end;
  end if;

  if not public.event_flyers_valid(new.image_urls) then
    raise exception 'image_urls must be 1-% unique non-blank URLs (got %)',
      public.max_event_flyers(), new.image_urls using errcode = '23514';
  end if;
  new.image_url := new.image_urls[1];
  return new;
end $$;

drop trigger if exists events_sync_event_flyers on public.events;
create trigger events_sync_event_flyers
before insert or update on public.events
for each row execute function public.events_sync_event_flyers();
revoke all on function public.events_sync_event_flyers() from public, anon, authenticated;

alter table public.events drop constraint if exists events_image_urls_check;
alter table public.events
  add constraint events_image_urls_check check (public.event_flyers_valid(image_urls));
alter table public.events drop constraint if exists events_image_url_primary_check;
alter table public.events
  add constraint events_image_url_primary_check check (image_url is not distinct from image_urls[1]);

-- authenticated's UPDATE on events is column-scoped (20260914 provenance hardening);
-- image_urls must be writable exactly where image_url is (RLS still gates rows).
grant update (image_urls) on public.events to authenticated;

comment on column public.events.image_urls is
  'Ordered, de-duplicated flyer list (max 5). image_url is the primary flyer and always equals image_urls[1].';

-- ---------------------------------------------------------------------------
-- 3. Public projection: append image_urls (existing ordinals unchanged)
-- ---------------------------------------------------------------------------
create or replace view public.public_events as
select
 event.id,event.title,event.description,event.event_type,event.event_date,event.event_time,event.location,event.address,
 event.price_type,event.price_amount,event.rsvp_link,event.image_url,event.poster_image_url,event.status,event.source_type,
 event.city,event.host,event.recurrence,event.gallery,event.dance_styles,event.venue_id,event.organizer_id,
 event.created_at,event.updated_at,coalesce(taxonomy.terms,'[]'::jsonb) as event_taxonomy_terms,
 event.slug,event.series_id,public.public_event_entities(event.id) as public_entities,
 event.event_types,
 event.image_urls
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
-- 4. Submission JSON: normalise + validate flyers at the door
-- ---------------------------------------------------------------------------
create or replace function public.event_submissions_normalize_flyers()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_urls text[];
begin
  if jsonb_typeof(new.submitted_data) = 'object'
     and (tg_op = 'INSERT' or new.submitted_data is distinct from old.submitted_data)
     and (new.submitted_data ? 'image_urls' or new.submitted_data ? 'image_url') then
    v_urls := public.event_flyers_from_payload(new.submitted_data);
    new.submitted_data := new.submitted_data
      || jsonb_build_object('image_urls', coalesce(to_jsonb(v_urls), 'null'::jsonb),
                            'image_url', coalesce(to_jsonb(v_urls[1]), 'null'::jsonb));
  end if;
  if jsonb_typeof(new.edited_data) = 'object'
     and (tg_op = 'INSERT' or new.edited_data is distinct from old.edited_data)
     and (new.edited_data ? 'image_urls' or new.edited_data ? 'image_url') then
    v_urls := public.event_flyers_from_payload(new.edited_data);
    new.edited_data := new.edited_data
      || jsonb_build_object('image_urls', coalesce(to_jsonb(v_urls), 'null'::jsonb),
                            'image_url', coalesce(to_jsonb(v_urls[1]), 'null'::jsonb));
  end if;
  return new;
end $$;

drop trigger if exists event_submissions_ab_normalize_flyers on public.event_submissions;
create trigger event_submissions_ab_normalize_flyers
before insert or update on public.event_submissions
for each row execute function public.event_submissions_normalize_flyers();
revoke all on function public.event_submissions_normalize_flyers() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPCs: patch the latest effective definitions in place (exact, single
--    occurrence assertions; any drift fails the migration instead of
--    silently skipping a mutation path). CREATE OR REPLACE keeps grants.
--    The events trigger derives image_url from image_urls, so each RPC only
--    has to accept `image_urls` and pass it through.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.patch_fn(p_src text, p_old text, p_new text)
returns text
language plpgsql
as $$
begin
  if p_old = '' or (length(p_src) - length(replace(p_src, p_old, ''))) / length(p_old) <> 1 then
    raise exception 'event flyers migration: expected exactly one occurrence of: %', p_old;
  end if;
  return replace(p_src, p_old, p_new);
end $$;

-- Same contract as patch_fn, for an anchor that exists in two layouts.
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
    raise exception 'event flyers migration: patch_one_of needs one replacement per layout';
  end if;
  for i in 1 .. cardinality(p_olds) loop
    if p_olds[i] <> '' and (length(p_src) - length(replace(p_src, p_olds[i], ''))) / length(p_olds[i]) = 1 then
      v_hits := v_hits + 1;
      v_hit := i;
    end if;
  end loop;
  if v_hits <> 1 then
    raise exception 'event flyers migration: expected exactly one layout to match once, got % of: %', v_hits, p_olds;
  end if;
  return replace(p_src, p_olds[v_hit], p_news[v_hit]);
end $$;

do $patch$
declare
  v text;
begin
  -- Each block is skipped once its function already references
  -- event_flyers_from_payload (only this migration introduces it), so a retried
  -- deploy is a no-op. The exact-match anchors still guard the first application.

  -- save_event_with_entities (admin/moderator create + edit, bulk import, CSV)
  v := pg_get_functiondef('public.save_event_with_entities(uuid,jsonb,boolean)'::regprocedure);
  if v !~ 'event_flyers_from_payload' then
    v := pg_temp.patch_fn(v, 'v_image text;', 'v_image text; v_images text[];');
    v := pg_temp.patch_fn(v, 'v_image:=nullif(btrim(p_payload->>''image_url''),'''');',
      'v_image:=nullif(btrim(p_payload->>''image_url''),''''); v_images:=public.event_flyers_from_payload(p_payload);');
    v := pg_temp.patch_fn(v, 'host,image_url,recurrence,contact_email,contact_instagram,contact_website,gallery,city,status,source_typ',
      'host,image_url,image_urls,recurrence,contact_email,contact_instagram,contact_website,gallery,city,status,source_typ');
    v := pg_temp.patch_fn(v, 'v_host,v_image,v_recurrence,', 'v_host,v_images[1],v_images,v_recurrence,');
    v := pg_temp.patch_fn(v, 'image_url=case when p_payload?''image_url'' then v_image else image_url end,',
      'image_urls=case when p_payload?''image_urls'' or p_payload?''image_url'' then v_images else image_urls end,');
    execute v;
  end if;

  -- approve_event_submission (JSON submission -> event)
  v := pg_get_functiondef('public.approve_event_submission(uuid,uuid[])'::regprocedure);
  if v !~ 'event_flyers_from_payload' then
    v := pg_temp.patch_fn(v, 'submitter_name, submitter_email, image_url)', 'submitter_name, submitter_email, image_url, image_urls)');
    v := pg_temp.patch_fn(v, 's.submitter_email, nullif(d ->> ''image_url'', ''''))',
      's.submitter_email, (public.event_flyers_from_payload(d))[1], public.event_flyers_from_payload(d))');
    execute v;
  end if;

  -- organizer_create_event (host create)
  v := pg_get_functiondef('public.organizer_create_event(uuid,jsonb,boolean)'::regprocedure);
  if v !~ 'event_flyers_from_payload' then
    v := pg_temp.patch_fn(v, '''contact_website'',''image_url'',''host'',', '''contact_website'',''image_url'',''image_urls'',''host'',');
    v := pg_temp.patch_fn(v, 'contact_website, image_url, host, dance_styles,', 'contact_website, image_url, image_urls, host, dance_styles,');
    v := pg_temp.patch_fn(v, 'nullif(btrim(p_payload ->> ''image_url''), ''''),',
      '(public.event_flyers_from_payload(p_payload))[1], public.event_flyers_from_payload(p_payload),');
    execute v;
  end if;

  -- organizer_update_event (host edit). The repo defines it padded; production
  -- may be reformatted one item per line, so each anchor accepts both layouts.
  v := pg_get_functiondef('public.organizer_update_event(uuid,jsonb)'::regprocedure);
  if v !~ 'event_flyers_from_payload' then
    v := pg_temp.patch_one_of(v,
      array['''contact_website'',''image_url'',''host'',',
            E'    ''contact_website'',\n    ''image_url'',\n    ''host'','],
      array['''contact_website'',''image_url'',''image_urls'',''host'',',
            E'    ''contact_website'',\n    ''image_url'',\n    ''image_urls'',\n    ''host'',']);
    v := pg_temp.patch_one_of(v,
      array[E'    image_url          = case when p_payload ? ''image_url''          then p_payload ->> ''image_url''          else e.image_url          end,\n',
            E'    image_url =\n      case\n        when p_payload ? ''image_url''\n        then p_payload ->> ''image_url''\n        else e.image_url\n      end,\n'],
      array[E'    image_urls         = case when p_payload ? ''image_urls'' or p_payload ? ''image_url'' then public.event_flyers_from_payload(p_payload) else e.image_urls end,\n',
            E'    image_urls =\n      case\n        when p_payload ? ''image_urls'' or p_payload ? ''image_url''\n        then public.event_flyers_from_payload(p_payload)\n        else e.image_urls\n      end,\n']);
    execute v;
  end if;
end $patch$;

NOTIFY pgrst, 'reload schema';

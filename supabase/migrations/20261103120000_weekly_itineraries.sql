-- Weekly itineraries: a curated Monday–Sunday guide to dancing in one metro,
-- built only from approved events. Admins and moderators curate; the public
-- reads published itineraries through two projection views only.
--
-- Every write goes through the security-definer RPCs below; no client role
-- holds a write grant on the raw tables, and anon cannot read them at all.

-- 1. Dance-night helper -------------------------------------------------------

-- An event belongs to the night of its local start date, except that starts
-- before 05:00 local belong to the previous night. Mirrors the TypeScript
-- danceNightOf (NIGHT_CUTOFF_HOUR = 5).
create or replace function public.itinerary_night(p_at timestamptz, p_tz text)
returns date
language sql
immutable
set search_path = public, pg_temp
as $$
  select ((p_at at time zone p_tz) - interval '5 hours')::date
$$;
revoke all on function public.itinerary_night(timestamptz, text) from public;
grant execute on function public.itinerary_night(timestamptz, text) to anon, authenticated;

-- 2. Tables -------------------------------------------------------------------

create table public.itineraries (
  id                 uuid primary key default gen_random_uuid(),
  city               text not null references public.metros (slug) on update cascade,
  week_start         date not null check (extract(isodow from week_start) = 1),
  time_zone          text not null,
  title              text not null check (char_length(btrim(title)) between 1 and 120),
  description        text check (char_length(description) <= 1000),
  recommendations    text check (char_length(recommendations) <= 2000),
  unfeatured_days    smallint[] not null default '{}'
                       check (unfeatured_days <@ '{1,2,3,4,5,6,7}'),
  status             text not null default 'draft'
                       check (status in ('draft', 'published', 'archived')),
  cover_image_url    text,
  cover_generated_at timestamptz,
  -- Exact public render inputs, not an upload timestamp or private event row.
  cover_source_snapshot jsonb,
  created_by         uuid references auth.users (id) on delete set null,
  updated_by         uuid references auth.users (id) on delete set null,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.itineraries is
  'Curated weekly dance guides per metro. Written only through save_itinerary, set_itinerary_status and set_itinerary_cover; read publicly through public_itineraries.';

-- One live itinerary per metro-week, so the public URL is unambiguous.
create unique index itineraries_live_week_key
  on public.itineraries (city, week_start)
  where status <> 'archived';

create table public.itinerary_items (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  event_id     uuid not null references public.events (id) on delete cascade,
  role         text not null check (role in ('featured', 'alternative')),
  position     smallint not null,
  note         text check (char_length(note) <= 280),
  unique (itinerary_id, event_id)
);

create index itinerary_items_event_id_idx on public.itinerary_items (event_id);

-- 3. Triggers -----------------------------------------------------------------

-- Check constraints cannot run subqueries, so the zone is validated here.
create or replace function public.itineraries_check_time_zone()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.time_zone) then
    raise exception 'Unknown time zone' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function public.itineraries_check_time_zone() from public, anon, authenticated;

create trigger itineraries_check_time_zone
  before insert or update of time_zone on public.itineraries
  for each row execute function public.itineraries_check_time_zone();

create trigger itineraries_set_updated_at
  before update on public.itineraries
  for each row execute function public.set_updated_at();

-- A hard-deleted event cascades to its items. Its old facts may still be
-- printed in the stored JPEG, so stop referencing that cover on fresh reads.
-- Full item replacement on save also invalidates the cover before regeneration.
create or replace function public.itinerary_items_invalidate_cover()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.itineraries
  set cover_image_url = null, cover_generated_at = null, cover_source_snapshot = null
  where id = old.itinerary_id and cover_image_url is not null;
  return old;
end $$;
revoke all on function public.itinerary_items_invalidate_cover() from public, anon, authenticated;

create trigger itinerary_items_invalidate_cover
  after delete on public.itinerary_items
  for each row execute function public.itinerary_items_invalidate_cover();

-- 4. RLS and grants -----------------------------------------------------------

alter table public.itineraries enable row level security;
alter table public.itinerary_items enable row level security;

-- Writes go only through the security-definer RPCs below, which run as the
-- owner. Active curators may read the raw rows (drafts included); nobody
-- else can see them.
revoke all on table public.itineraries from public, anon, authenticated;
revoke all on table public.itinerary_items from public, anon, authenticated;
grant select on table public.itineraries to authenticated;
grant select on table public.itinerary_items to authenticated;

create policy "Curators read itineraries"
  on public.itineraries
  for select
  to authenticated
  using (public.is_moderator() and public.account_is_active(auth.uid()));

create policy "Curators read itinerary items"
  on public.itinerary_items
  for select
  to authenticated
  using (public.is_moderator() and public.account_is_active(auth.uid()));

-- 5. Public projections -------------------------------------------------------

-- Owner-only canonical render source. Every header/item/event fact comes from
-- ONE statement snapshot. Keep this JSON contract in sync with
-- buildItineraryCoverSnapshot; never add private raw-event columns here.
-- Semantic item identity is event_id/role/position/note, not replacement row IDs.
create view public.itinerary_cover_sources as
select itinerary.id,
  case when selected.valid then jsonb_build_object(
    'city', itinerary.city,
    'city_name', metro.name,
    'week_start', itinerary.week_start,
    'time_zone', itinerary.time_zone,
    'title', itinerary.title,
    'items', selected.items
  ) end as snapshot
from public.itineraries itinerary
join public.metros metro on metro.slug = itinerary.city
cross join lateral (
  select
    count(*) > 0 and bool_and(
      event.id is not null and event.status = 'approved'
      and event.city = itinerary.city
      and public.itinerary_night(event.event_date, itinerary.time_zone)
          between itinerary.week_start and itinerary.week_start + 6
    ) as valid,
    jsonb_agg(jsonb_build_object(
      'event_id', item.event_id,
      'role', item.role,
      'position', item.position,
      'note', item.note,
      'event', jsonb_build_object(
        'id', event.id,
        'city', event.city,
        'status', event.status,
        'title', event.title,
        'event_date_ms', floor(extract(epoch from event.event_date) * 1000),
        'event_type', event.event_type,
        'location', event.location,
        -- Cache warming for an unchanged original is not a new artwork source.
        'artwork_source', coalesce(event.image_url, event.image_urls[1], event.poster_image_url),
        'dance_styles', case when jsonb_array_length(event.event_taxonomy_terms) > 0 then (
          select coalesce(jsonb_agg(term.value->'taxonomy_terms'->'name' order by term.ordinality), '[]'::jsonb)
          from jsonb_array_elements(event.event_taxonomy_terms) with ordinality term(value, ordinality)
          where term.value->'taxonomy_terms'->>'category' = 'dance_style'
        ) else to_jsonb(coalesce(event.dance_styles, '{}'::text[])) end
      )
    ) order by item.event_id) as items
  from public.itinerary_items item
  left join public.public_events event on event.id = item.event_id
  where item.itinerary_id = itinerary.id
) selected;
alter view public.itinerary_cover_sources set (security_invoker = false);
revoke all on table public.itinerary_cover_sources from public, anon, authenticated;

-- Published rows only, with no curator identity or internal timestamps.
create or replace view public.public_itineraries as
select
  itinerary.id,
  itinerary.city,
  itinerary.week_start,
  itinerary.time_zone,
  itinerary.title,
  itinerary.description,
  itinerary.recommendations,
  itinerary.unfeatured_days,
  case when itinerary.cover_source_snapshot = source.snapshot
    then itinerary.cover_image_url else null end as cover_image_url,
  published_at,
  updated_at
from public.itineraries itinerary
join public.itinerary_cover_sources source on source.id = itinerary.id
where status = 'published';

alter view public.public_itineraries set (security_invoker = false);

-- Revoke from every role first. The stale-cover projection makes this view
-- non-auto-updatable, and neither projection carries a write grant, so no
-- caller can write raw rows through a public view at any privilege level.
revoke all on table public.public_itineraries from public, anon, authenticated;
grant select on table public.public_itineraries to anon, authenticated;

-- Items disappear when their event is no longer public or moves outside the
-- itinerary's city or dance week; stored editorial notes cannot leak either.
create or replace view public.public_itinerary_items as
select
  item.itinerary_id,
  item.event_id,
  item.role,
  item.position,
  item.note
from public.itinerary_items item
join public.public_itineraries itinerary on itinerary.id = item.itinerary_id
join public.public_events event on event.id = item.event_id
  and event.status = 'approved'
  and event.city = itinerary.city
  and public.itinerary_night(event.event_date, itinerary.time_zone)
      between itinerary.week_start and itinerary.week_start + 6;

alter view public.public_itinerary_items set (security_invoker = false);

revoke all on table public.public_itinerary_items from public, anon, authenticated;
grant select on table public.public_itinerary_items to anon, authenticated;

-- 6. Item validation (shared by save_itinerary and publishing) ----------------

create or replace function public.itinerary_validate_items(p_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
begin
  select item.event_id into v_event_id
  from public.itinerary_items item
  join public.itineraries itinerary on itinerary.id = item.itinerary_id
  join public.events event on event.id = item.event_id
  where item.itinerary_id = p_id
    and (event.status is distinct from 'approved' or event.city is distinct from itinerary.city)
  order by event.event_date, item.event_id
  limit 1;
  if found then
    raise exception 'Event % is not an approved event in this city', v_event_id using errcode = '22023';
  end if;

  select item.event_id into v_event_id
  from public.itinerary_items item
  join public.itineraries itinerary on itinerary.id = item.itinerary_id
  join public.events event on event.id = item.event_id
  where item.itinerary_id = p_id
    and public.itinerary_night(event.event_date, itinerary.time_zone)
        not between itinerary.week_start and itinerary.week_start + 6
  order by event.event_date, item.event_id
  limit 1;
  if found then
    raise exception 'Event % is outside this week', v_event_id using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.itinerary_items item
    join public.itineraries itinerary on itinerary.id = item.itinerary_id
    join public.events event on event.id = item.event_id
    where item.itinerary_id = p_id and item.role = 'featured'
    group by public.itinerary_night(event.event_date, itinerary.time_zone)
    having count(*) > 1
  ) then
    raise exception 'Only one featured event per night' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.itinerary_items item
    join public.itineraries itinerary on itinerary.id = item.itinerary_id
    join public.events event on event.id = item.event_id
    where item.itinerary_id = p_id
    group by public.itinerary_night(event.event_date, itinerary.time_zone), item.position
    having count(*) > 1
  ) then
    raise exception 'Duplicate position within a night' using errcode = '22023';
  end if;
end $$;
revoke all on function public.itinerary_validate_items(uuid) from public, anon, authenticated;

-- 7. RPCs ---------------------------------------------------------------------

-- Audit rows name the kind of thing they touched.
alter table public.audit_logs drop constraint audit_logs_target_type_check;
alter table public.audit_logs add constraint audit_logs_target_type_check check (
  target_type is null or target_type = any (array[
    'event', 'event_submission', 'profile', 'organizer', 'venue', 'taxonomy_term', 'platform_settings',
    'school', 'instructor', 'dj', 'itinerary'
  ])
);

-- Creates (p_id null) or updates the header and replaces the full item set.
-- New rows start as drafts; the payload never sets status or authorship.
create or replace function public.save_itinerary(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current public.itineraries%rowtype;
  v_id uuid;
  v_city text;
  v_week_start date;
  v_time_zone text;
  v_title text;
  v_item_count integer;
begin
  if v_uid is null or not public.is_moderator() or not public.account_is_active(v_uid) then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'p_payload must be an object' using errcode = '22023';
  end if;

  v_city := p_payload ->> 'city';
  v_week_start := (p_payload ->> 'week_start')::date;
  v_title := p_payload ->> 'title';
  v_time_zone := p_payload ->> 'time_zone';

  if p_id is null then
    insert into public.itineraries (
      city, week_start, time_zone, title, description, recommendations, unfeatured_days,
      status, created_by, updated_by
    )
    values (
      v_city,
      v_week_start,
      v_time_zone,
      v_title,
      p_payload ->> 'description',
      p_payload ->> 'recommendations',
      array(select jsonb_array_elements_text(coalesce(p_payload -> 'unfeatured_days', '[]'::jsonb))::smallint),
      'draft',
      v_uid,
      v_uid
    )
    returning id into v_id;
  else
    select * into v_current from public.itineraries where id = p_id for update;
    if not found then
      raise exception 'Itinerary not found' using errcode = 'P0002';
    end if;
    if v_current.status = 'archived' then
      raise exception 'Archived itineraries cannot be edited' using errcode = '22023';
    end if;
    if v_current.status = 'published'
       and (v_city is distinct from v_current.city
            or v_week_start is distinct from v_current.week_start
            or v_time_zone is distinct from v_current.time_zone) then
      raise exception 'Unpublish before changing the city or week' using errcode = '22023';
    end if;

    update public.itineraries
    set city = v_city,
        week_start = v_week_start,
        time_zone = v_time_zone,
        title = v_title,
        description = p_payload ->> 'description',
        recommendations = p_payload ->> 'recommendations',
        unfeatured_days = array(
          select jsonb_array_elements_text(coalesce(p_payload -> 'unfeatured_days', '[]'::jsonb))::smallint
        ),
        updated_by = v_uid
    where id = p_id;
    v_id := p_id;
  end if;

  delete from public.itinerary_items where itinerary_id = v_id;

  insert into public.itinerary_items (itinerary_id, event_id, role, position, note)
  select v_id, item.event_id, item.role, item.position, item.note
  from jsonb_to_recordset(coalesce(p_payload -> 'items', '[]'::jsonb))
    as item(event_id uuid, role text, position smallint, note text);
  get diagnostics v_item_count = row_count;
  if v_current.status = 'published' and v_item_count = 0 then
    raise exception 'Published itineraries need at least one event' using errcode = '22023';
  end if;

  perform public.itinerary_validate_items(v_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, target_type, target_id, target_name)
  values (
    v_uid,
    'itinerary.saved',
    'itinerary',
    v_id,
    jsonb_build_object(
      'created', p_id is null,
      'city', v_city,
      'week_start', v_week_start,
      'item_count', v_item_count
    ),
    'itinerary',
    v_id,
    v_title
  );

  return v_id;
end $$;
revoke all on function public.save_itinerary(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_itinerary(uuid, jsonb) to authenticated;

-- Records the link-preview card (it becomes og:image). The URL must be an
-- https Storage URL in this itinerary's folder of the itinerary-covers bucket.
create or replace function public.set_itinerary_cover(p_id uuid, p_url text, p_snapshot jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current public.itineraries%rowtype;
  v_generated_at timestamptz;
begin
  if v_uid is null or not public.is_moderator() or not public.account_is_active(v_uid) then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;

  select * into v_current from public.itineraries where id = p_id for update;
  if not found then
    raise exception 'Itinerary not found' using errcode = 'P0002';
  end if;
  if v_current.status = 'archived' then
    raise exception 'Archived itineraries cannot be edited' using errcode = '22023';
  end if;

  if p_url is null
     or p_url !~ ('^https://[^/\s"''<>?#@]+/storage/v1/object/public/itinerary-covers/'
                  || p_id || '/[0-9a-f]{8}\.jpg$') then
    raise exception 'Cover must be stored in this itinerary''s folder' using errcode = '22023';
  end if;

  -- Compare and retain the same canonical source in one statement snapshot.
  -- Later/older concurrent transactions cannot make a stale JPEG public:
  -- public reads compare retained facts, never transaction timestamp ordering.
  update public.itineraries itinerary
  set cover_image_url = p_url,
      cover_generated_at = now(),
      cover_source_snapshot = source.snapshot,
      updated_by = v_uid
  from public.itinerary_cover_sources source
  where itinerary.id = p_id and source.id = itinerary.id
    and source.snapshot = p_snapshot
  returning itinerary.cover_generated_at into v_generated_at;
  if not found then
    raise exception 'The itinerary or its events changed. Reload and regenerate the link preview image.'
      using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, target_type, target_id, target_name)
  values (
    v_uid,
    'itinerary.cover_set',
    'itinerary',
    p_id,
    jsonb_build_object('cover_image_url', p_url, 'previous_cover_image_url', v_current.cover_image_url),
    'itinerary',
    p_id,
    v_current.title
  );

  return v_generated_at;
end $$;
revoke all on function public.set_itinerary_cover(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.set_itinerary_cover(uuid, text, jsonb) to authenticated;

-- draft -> published, published -> draft (unpublish), draft|published -> archived.
-- Publishing re-runs the item validations and needs at least one event and a
-- link-preview image. published_at is set the first time only. Returns it.
create or replace function public.set_itinerary_status(p_id uuid, p_status text)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current public.itineraries%rowtype;
  v_published_at timestamptz;
begin
  if v_uid is null or not public.is_moderator() or not public.account_is_active(v_uid) then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;

  select * into v_current from public.itineraries where id = p_id for update;
  if not found then
    raise exception 'Itinerary not found' using errcode = 'P0002';
  end if;

  if (
    (v_current.status = 'draft' and p_status = 'published')
    or (v_current.status = 'published' and p_status = 'draft')
    or (v_current.status in ('draft', 'published') and p_status = 'archived')
  ) is not true then
    raise exception 'Invalid status change' using errcode = '22023';
  end if;

  if p_status = 'published' then
    if not exists (select 1 from public.itinerary_items where itinerary_id = p_id) then
      raise exception 'Publishing needs at least one event' using errcode = '22023';
    end if;
    perform public.itinerary_validate_items(p_id);
    if v_current.cover_image_url is null then
      raise exception 'Publishing needs a link preview image' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.itinerary_cover_sources source
      where source.id = p_id and source.snapshot = v_current.cover_source_snapshot
    ) then
      raise exception 'The itinerary or its events changed. Reload and regenerate the link preview image.'
        using errcode = '22023';
    end if;
  end if;

  update public.itineraries
  set status = p_status,
      published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
      updated_by = v_uid
  where id = p_id
  returning published_at into v_published_at;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, target_type, target_id, target_name)
  values (
    v_uid,
    case p_status
      when 'published' then 'itinerary.published'
      when 'draft' then 'itinerary.unpublished'
      else 'itinerary.archived'
    end,
    'itinerary',
    p_id,
    jsonb_build_object(
      'from_status', v_current.status,
      'to_status', p_status,
      'city', v_current.city,
      'week_start', v_current.week_start
    ),
    'itinerary',
    p_id,
    v_current.title
  );

  return v_published_at;
end $$;
revoke all on function public.set_itinerary_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_itinerary_status(uuid, text) to authenticated;

-- 8. Storage ------------------------------------------------------------------

-- Public-read link cards at <itinerary_id>/<sha8>.jpg. Only active curators
-- write, and only into the folder of a non-archived itinerary. Curators may also read
-- object rows, which Storage needs for overwrite (upsert), update and delete.
-- No public listing policy: object names would reveal draft itinerary ids.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'itinerary-covers',
  'itinerary-covers',
  true,
  5242880,
  array['image/jpeg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Curators read itinerary covers" on storage.objects;
create policy "Curators read itinerary covers"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'itinerary-covers'
  and public.is_moderator()
  and public.account_is_active(auth.uid())
);

drop policy if exists "Curators insert itinerary covers" on storage.objects;
create policy "Curators insert itinerary covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'itinerary-covers'
  and public.is_moderator()
  and public.account_is_active(auth.uid())
  and (storage.foldername(name))[1] in (
    select itinerary.id::text from public.itineraries itinerary where itinerary.status <> 'archived'
  )
);

drop policy if exists "Curators update itinerary covers" on storage.objects;
create policy "Curators update itinerary covers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'itinerary-covers'
  and public.is_moderator()
  and public.account_is_active(auth.uid())
  and (storage.foldername(name))[1] in (
    select itinerary.id::text from public.itineraries itinerary where itinerary.status <> 'archived'
  )
)
with check (
  bucket_id = 'itinerary-covers'
  and public.is_moderator()
  and public.account_is_active(auth.uid())
  and (storage.foldername(name))[1] in (
    select itinerary.id::text from public.itineraries itinerary where itinerary.status <> 'archived'
  )
);

drop policy if exists "Curators delete itinerary covers" on storage.objects;
create policy "Curators delete itinerary covers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'itinerary-covers'
  and public.is_moderator()
  and public.account_is_active(auth.uid())
  and (storage.foldername(name))[1] in (
    select itinerary.id::text from public.itineraries itinerary where itinerary.status <> 'archived'
  )
);

notify pgrst, 'reload schema';

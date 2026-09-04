-- Venue directory/search/merge RPCs and platform_settings submission-gate
-- RPCs. Ported verbatim (same signatures, same logic) from the verified
-- production reconciliation script (supabase/reconcile-prod-schema.sql),
-- which never had a migration-file counterpart — a fresh local stack could
-- not reproduce them, so every venue admin page and the anonymous/
-- registered Submit Event flow 404'd on a missing function.
-- Phase 14 — Venue + Platform Settings Consolidation

-- ------------------------------------------------------------
-- Venue quality-issue helper (used by directory/detail/search)
-- ------------------------------------------------------------
create or replace function public.venue_quality_issues(p_venue public.venues)
returns text[]
language sql
stable
set search_path = public
as $$
  select array_remove(array[
    case when nullif(btrim(coalesce(p_venue.address_line1, '')), '') is null then 'missing_address'::text end,
    case when p_venue.latitude is null or p_venue.longitude is null then 'missing_coordinates'::text end,
    case when nullif(btrim(coalesce(p_venue.timezone, '')), '') is null then 'no_timezone'::text end,
    case when nullif(btrim(coalesce(p_venue.website, '')), '') is not null and p_venue.website !~* '^https?://' then 'invalid_website'::text end,
    case when exists (
      select 1 from public.venues other
      where other.id <> p_venue.id
        and other.normalized_name = p_venue.normalized_name
        and nullif(other.normalized_name, '') is not null
    ) then 'possible_duplicate'::text end
  ], null)::text[];
$$;

revoke execute on function public.venue_quality_issues(public.venues) from public, anon;
grant execute on function public.venue_quality_issues(public.venues) to authenticated;

-- ------------------------------------------------------------
-- admin_venue_directory — filtered, sorted, paginated venue list
-- ------------------------------------------------------------
drop function if exists public.admin_venue_directory(text, text[], text[], text[], boolean, text, integer, integer);
create function public.admin_venue_directory(
  p_search text default '',
  p_status text[] default null,
  p_city text[] default null,
  p_state text[] default null,
  p_has_upcoming boolean default null,
  p_sort text default 'name-asc',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  slug text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country text,
  latitude numeric,
  longitude numeric,
  timezone text,
  website text,
  instagram text,
  phone text,
  status text,
  upcoming_count integer,
  quality_issues text[],
  updated_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required' using errcode = '42501'; end if;
  return query
  with rows as (
    select v.*,
           coalesce((select count(*)::int from public.events e where e.venue_id = v.id and e.status = 'approved' and e.event_date >= now()), 0)::int as upcoming_count,
           public.venue_quality_issues(v) as quality_issues
      from public.venues v
     where (coalesce(btrim(p_search), '') = '' or v.name ilike '%' || p_search || '%' or coalesce(v.address_line1, '') ilike '%' || p_search || '%' or coalesce(v.city, '') ilike '%' || p_search || '%' or coalesce(v.postal_code, '') ilike '%' || p_search || '%')
       and (p_status is null or cardinality(p_status) = 0 or v.status = any(p_status))
       and (p_city is null or cardinality(p_city) = 0 or v.city = any(p_city))
       and (p_state is null or cardinality(p_state) = 0 or v.state_region = any(p_state))
  )
  select rows.id, rows.name, rows.slug, rows.address_line1, rows.address_line2, rows.city, rows.state_region, rows.postal_code, rows.country,
         rows.latitude, rows.longitude, rows.timezone, rows.website, rows.instagram, rows.phone, rows.status, rows.upcoming_count, rows.quality_issues, rows.updated_at, rows.created_at
    from rows
   where p_has_upcoming is null or (p_has_upcoming and rows.upcoming_count > 0) or (not p_has_upcoming and rows.upcoming_count = 0)
   order by
     case when p_sort = 'name-asc' then rows.name end asc,
     case when p_sort = 'name-desc' then rows.name end desc,
     case when p_sort = 'city-asc' then rows.city end asc nulls last,
     case when p_sort = 'city-desc' then rows.city end desc nulls last,
     case when p_sort = 'updated-desc' then rows.updated_at end desc,
     case when p_sort = 'updated-asc' then rows.updated_at end asc,
     case when p_sort = 'upcoming-desc' then rows.upcoming_count end desc,
     case when p_sort = 'upcoming-asc' then rows.upcoming_count end asc,
     rows.name asc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ------------------------------------------------------------
-- admin_venue_detail — single venue with computed stats
-- ------------------------------------------------------------
drop function if exists public.admin_venue_detail(uuid);
create function public.admin_venue_detail(p_id uuid)
returns table (
  id uuid,
  name text,
  slug text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country text,
  latitude numeric,
  longitude numeric,
  timezone text,
  website text,
  instagram text,
  phone text,
  status text,
  upcoming_count integer,
  quality_issues text[],
  updated_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required' using errcode = '42501'; end if;
  return query
  select v.id, v.name, v.slug, v.address_line1, v.address_line2, v.city, v.state_region, v.postal_code, v.country,
         v.latitude, v.longitude, v.timezone, v.website, v.instagram, v.phone, v.status,
         coalesce((select count(*)::int from public.events e where e.venue_id = v.id and e.status = 'approved' and e.event_date >= now()), 0)::int,
         public.venue_quality_issues(v), v.updated_at, v.created_at
    from public.venues v
   where v.id = p_id;
end;
$$;

-- ------------------------------------------------------------
-- admin_venue_search — combobox search (event-form venue picker)
-- ------------------------------------------------------------
drop function if exists public.admin_venue_search(text, integer);
create function public.admin_venue_search(p_query text, p_limit integer default 10)
returns table (
  id uuid,
  name text,
  slug text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country text,
  latitude numeric,
  longitude numeric,
  timezone text,
  website text,
  instagram text,
  phone text,
  status text,
  upcoming_count integer,
  quality_issues text[],
  updated_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.admin_venue_directory(p_query, array['active','needs_review'], null, null, null, 'name-asc', greatest(coalesce(p_limit, 10), 1), 0)
  where nullif(btrim(coalesce(p_query, '')), '') is not null;
$$;

-- ------------------------------------------------------------
-- merge_venues — atomic merge, reassign events, archive the source
-- ------------------------------------------------------------
drop function if exists public.merge_venues(uuid, uuid);
create function public.merge_venues(p_keep_id uuid, p_merge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required' using errcode = '42501'; end if;
  if p_keep_id = p_merge_id then raise exception 'Choose two different venues.' using errcode = '22023'; end if;
  if not exists (select 1 from public.venues where id = p_keep_id) then raise exception 'Venue to keep not found.' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.venues where id = p_merge_id) then raise exception 'Venue to merge not found.' using errcode = 'P0002'; end if;

  update public.events set venue_id = p_keep_id where venue_id = p_merge_id;

  update public.venues keep
     set address_line1 = coalesce(keep.address_line1, merge.address_line1),
         address_line2 = coalesce(keep.address_line2, merge.address_line2),
         city = coalesce(keep.city, merge.city),
         state_region = coalesce(keep.state_region, merge.state_region),
         postal_code = coalesce(keep.postal_code, merge.postal_code),
         country = coalesce(keep.country, merge.country),
         latitude = coalesce(keep.latitude, merge.latitude),
         longitude = coalesce(keep.longitude, merge.longitude),
         timezone = coalesce(keep.timezone, merge.timezone),
         website = coalesce(keep.website, merge.website),
         instagram = coalesce(keep.instagram, merge.instagram),
         phone = coalesce(keep.phone, merge.phone)
    from public.venues merge
   where keep.id = p_keep_id and merge.id = p_merge_id;

  update public.venues set status = 'archived' where id = p_merge_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'venue.merged', 'venue', p_keep_id, jsonb_build_object('merged_venue_id', p_merge_id));
end;
$$;

revoke execute on function public.admin_venue_directory(text, text[], text[], text[], boolean, text, integer, integer) from public, anon;
grant  execute on function public.admin_venue_directory(text, text[], text[], text[], boolean, text, integer, integer) to authenticated;

revoke execute on function public.admin_venue_detail(uuid) from public, anon;
grant  execute on function public.admin_venue_detail(uuid) to authenticated;

revoke execute on function public.admin_venue_search(text, integer) from public, anon;
grant  execute on function public.admin_venue_search(text, integer) to authenticated;

revoke execute on function public.merge_venues(uuid, uuid) from public, anon;
grant  execute on function public.merge_venues(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- platform_settings submission-gate RPCs — SECURITY DEFINER so anon can
-- read the two boolean flags without any direct table grant. Drive the
-- Submit Event page's access check (anonymous suggestions vs. registered
-- submissions).
-- ------------------------------------------------------------
create or replace function public.public_event_suggestions_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select allow_public_event_suggestions
    from public.platform_settings
    where singleton
  ), false);
$$;

create or replace function public.registered_event_submissions_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select allow_registered_user_submissions
    from public.platform_settings
    where singleton
  ), false);
$$;

revoke execute on function public.public_event_suggestions_enabled() from public;
grant  execute on function public.public_event_suggestions_enabled() to anon, authenticated;

revoke execute on function public.registered_event_submissions_enabled() from public, anon;
grant  execute on function public.registered_event_submissions_enabled() to authenticated;

notify pgrst, 'reload schema';

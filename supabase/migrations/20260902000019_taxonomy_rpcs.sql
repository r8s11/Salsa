-- Taxonomy directory/detail/search and relationship mutation RPCs.
-- Phase 14 — Taxonomy Consolidation
--
-- The frontend calls these RPCs for /admin/tags and the admin event editor.
-- Keep all administrative reads and relationship writes behind the existing
-- is_admin() guard; public calendar tag reads use the table SELECT policy.

-- ------------------------------------------------------------
-- admin_taxonomy_directory — filtered taxonomy management list
-- ------------------------------------------------------------
drop function if exists public.admin_taxonomy_directory(text, text, text, text);
create function public.admin_taxonomy_directory(
  p_search   text default '',
  p_category text default null,
  p_status   text default null,
  p_view     text default 'all'
)
returns table (
  id           uuid,
  category     text,
  name         text,
  slug         text,
  description  text,
  parent_id    uuid,
  status       text,
  display_order integer,
  usage_count  integer,
  updated_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  with term_rows as (
    select
      t.id,
      t.category,
      t.name,
      t.slug,
      t.description,
      t.parent_id,
      t.status,
      t.display_order,
      (
        select count(*)::integer
          from public.event_taxonomy_terms ett
         where ett.taxonomy_term_id = t.id
      ) as usage_count,
      t.updated_at
    from public.taxonomy_terms t
  )
  select r.id, r.category, r.name, r.slug, r.description, r.parent_id,
         r.status, r.display_order, r.usage_count, r.updated_at
    from term_rows r
   where (nullif(btrim(coalesce(p_search, '')), '') is null
          or r.name ilike '%' || btrim(p_search) || '%'
          or r.slug ilike '%' || btrim(p_search) || '%')
     and (nullif(btrim(coalesce(p_category, '')), '') is null
          or r.category = p_category)
     and (nullif(btrim(coalesce(p_status, '')), '') is null
          or r.status = p_status)
     and case coalesce(nullif(btrim(p_view), ''), 'all')
           when 'active' then r.status = 'active'
           when 'dance_styles' then r.category = 'dance_style'
           when 'attributes' then r.category = 'event_attribute'
           when 'unused' then r.usage_count = 0
           when 'needs_review' then r.status = 'needs_review'
           when 'archived' then r.status = 'archived'
           else true
         end
   order by r.display_order asc, r.name asc;
end;
$$;

-- ------------------------------------------------------------
-- admin_taxonomy_detail — one taxonomy term with live usage count
-- ------------------------------------------------------------
drop function if exists public.admin_taxonomy_detail(uuid);
create function public.admin_taxonomy_detail(p_id uuid)
returns table (
  id           uuid,
  category     text,
  name         text,
  slug         text,
  description  text,
  parent_id    uuid,
  status       text,
  display_order integer,
  usage_count  integer,
  updated_at   timestamptz,
  created_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  select t.id, t.category, t.name, t.slug, t.description, t.parent_id,
         t.status, t.display_order,
         (
           select count(*)::integer
             from public.event_taxonomy_terms ett
            where ett.taxonomy_term_id = t.id
         ),
         t.updated_at, t.created_at
    from public.taxonomy_terms t
   where t.id = p_id;
end;
$$;

-- ------------------------------------------------------------
-- admin_taxonomy_search — active term picker for admin event editing
-- ------------------------------------------------------------
drop function if exists public.admin_taxonomy_search(text, text);
create function public.admin_taxonomy_search(
  p_category text,
  p_search   text default ''
)
returns table (
  id           uuid,
  category     text,
  name         text,
  slug         text,
  description  text,
  parent_id    uuid,
  status       text,
  display_order integer,
  usage_count  integer,
  updated_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  with term_rows as (
    select
      t.id,
      t.category,
      t.name,
      t.slug,
      t.description,
      t.parent_id,
      t.status,
      t.display_order,
      (
        select count(*)::integer
          from public.event_taxonomy_terms ett
         where ett.taxonomy_term_id = t.id
      ) as usage_count,
      t.updated_at
    from public.taxonomy_terms t
   where t.category = p_category
     and t.status = 'active'
  )
  select r.id, r.category, r.name, r.slug, r.description, r.parent_id,
         r.status, r.display_order, r.usage_count, r.updated_at
    from term_rows r
   where nullif(btrim(coalesce(p_search, '')), '') is null
      or r.name ilike '%' || btrim(p_search) || '%'
      or r.slug ilike '%' || btrim(p_search) || '%'
   order by r.display_order asc, r.name asc;
end;
$$;

-- ------------------------------------------------------------
-- merge_taxonomy_terms — reassign relationships and archive source term
-- ------------------------------------------------------------
drop function if exists public.merge_taxonomy_terms(uuid, uuid);
create function public.merge_taxonomy_terms(
  p_keep_id  uuid,
  p_merge_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_keep_id = p_merge_id then
    raise exception 'Choose two different taxonomy terms.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.taxonomy_terms where id = p_keep_id) then
    raise exception 'Taxonomy term to keep not found.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.taxonomy_terms where id = p_merge_id) then
    raise exception 'Taxonomy term to merge not found.' using errcode = 'P0002';
  end if;

  insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
  select ett.event_id, p_keep_id
    from public.event_taxonomy_terms ett
   where ett.taxonomy_term_id = p_merge_id
  on conflict (event_id, taxonomy_term_id) do nothing;

  delete from public.event_taxonomy_terms
   where taxonomy_term_id = p_merge_id;

  update public.taxonomy_terms
     set status = 'archived'
   where id = p_merge_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'taxonomy_term.merged',
    'taxonomy_term',
    p_keep_id,
    jsonb_build_object('merged_taxonomy_term_id', p_merge_id)
  );
end;
$$;

-- ------------------------------------------------------------
-- replace_event_taxonomy_terms — atomic complete relationship replacement
-- ------------------------------------------------------------
drop function if exists public.replace_event_taxonomy_terms(uuid, uuid[]);
create function public.replace_event_taxonomy_terms(
  p_event_id          uuid,
  p_taxonomy_term_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;

  delete from public.event_taxonomy_terms
   where event_id = p_event_id;

  insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
  select p_event_id, requested.taxonomy_term_id
    from unnest(coalesce(p_taxonomy_term_ids, '{}'::uuid[])) as requested(taxonomy_term_id)
  on conflict (event_id, taxonomy_term_id) do nothing;
end;
$$;

revoke execute on function public.admin_taxonomy_directory(text, text, text, text) from public, anon;
grant execute on function public.admin_taxonomy_directory(text, text, text, text) to authenticated;

revoke execute on function public.admin_taxonomy_detail(uuid) from public, anon;
grant execute on function public.admin_taxonomy_detail(uuid) to authenticated;

revoke execute on function public.admin_taxonomy_search(text, text) from public, anon;
grant execute on function public.admin_taxonomy_search(text, text) to authenticated;

revoke execute on function public.merge_taxonomy_terms(uuid, uuid) from public, anon;
grant execute on function public.merge_taxonomy_terms(uuid, uuid) to authenticated;

revoke execute on function public.replace_event_taxonomy_terms(uuid, uuid[]) from public, anon;
grant execute on function public.replace_event_taxonomy_terms(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';

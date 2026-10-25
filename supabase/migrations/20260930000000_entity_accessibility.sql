-- Entity accessibility: explicit, non-inferred public identities and guarded admin lifecycle.
-- Existing entity rows and relationships are preserved; no relationship backfills are performed.

create table if not exists public.event_series (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_url text,
  status text not null default 'active' check (status in ('active','needs_review','archived')),
  city text references public.metros(slug) on update cascade on delete set null,
  venue_id uuid references public.venues(id) on delete set null,
  organizer_id uuid references public.organizers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.metros add column if not exists status text not null default 'active';
alter table public.organizers drop constraint if exists organizers_status_check;
alter table public.organizers add constraint organizers_status_check check (status in ('active','needs_review','suspended','archived'));
alter table public.metros drop constraint if exists metros_status_check;
alter table public.metros add constraint metros_status_check check (status in ('active','needs_review','archived'));
update public.metros set status='active' where status is null;
alter table public.metros alter column status set default 'active';
alter table public.metros alter column status set not null;
alter table public.schools add column if not exists description text;
alter table public.schools add column if not exists image_url text;
alter table public.instructors add column if not exists description text;
alter table public.instructors add column if not exists image_url text;

drop policy if exists metros_select_all on public.metros;
create policy metros_select_all on public.metros for select to anon,authenticated using (status='active');
drop policy if exists metros_admin_select on public.metros;
create policy metros_admin_select on public.metros for select to authenticated using (public.is_platform_admin());

-- Active metro discovery continues to require an approved upcoming event.
drop view public.public_active_metros;

alter table public.events add column if not exists slug text;
alter table public.events add column if not exists series_id uuid references public.event_series(id) on delete set null;
-- Preserve existing event routes; only missing slugs receive an opaque stable suffix.
update public.events e set slug =
  coalesce(nullif(left(trim(both '-' from regexp_replace(lower(coalesce(nullif(btrim(e.title),''),'event')), '[^a-z0-9]+', '-', 'g')),100),''),'event')
  || '-' || replace(e.id::text,'-','')
where e.slug is null or btrim(e.slug) = '';
create unique index if not exists events_slug_key on public.events(slug);
create index if not exists events_series_date_status_idx on public.events(series_id,event_date,id) where series_id is not null;
create index if not exists event_series_city_status_idx on public.event_series(city,status);
create index if not exists event_series_venue_idx on public.event_series(venue_id) where venue_id is not null;
create index if not exists event_series_organizer_idx on public.event_series(organizer_id) where organizer_id is not null;
create index if not exists events_venue_date_status_idx on public.events(venue_id,event_date,id) where venue_id is not null;
create index if not exists events_organizer_date_status_idx on public.events(organizer_id,event_date,id) where organizer_id is not null;
create index if not exists events_approved_city_date_idx on public.events(city,event_date,id) where status='approved';

alter table public.event_series enable row level security;
revoke all on public.event_series from anon, authenticated;
grant select on public.event_series to authenticated;
drop policy if exists "Admins manage event series" on public.event_series;
create policy "Admins manage event series" on public.event_series for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop trigger if exists event_series_set_updated_at on public.event_series;
create trigger event_series_set_updated_at before update on public.event_series
for each row execute function public.set_updated_at();

-- Compact, explicit field allowlist shared by every public entity surface.
create or replace function public.entity_access_public_ref(p_kind text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r jsonb;
begin
  case p_kind
  when 'series' then select jsonb_build_object('kind',p_kind,'id',s.id,'name',s.name,'slug',s.slug,'description',s.description,'image_url',s.image_url,'city',s.city,'state_region',null,'country',null,'address',null,'website',null,'instagram',null,'origin',null,'category',null) into r from event_series s where s.id=p_id and s.status='active';
  when 'organizer' then select jsonb_build_object('kind',p_kind,'id',o.id,'name',o.name,'slug',o.slug,'description',o.description,'image_url',o.logo_url,'city',o.primary_city,'state_region',o.state_region,'country',o.country,'address',null,'website',o.website,'instagram',o.instagram,'origin',null,'category',o.organizer_type) into r from organizers o where o.id=p_id and o.status='active';
  when 'venue' then select jsonb_build_object('kind',p_kind,'id',v.id,'name',v.name,'slug',v.slug,'description',null,'image_url',null,'city',v.city,'state_region',v.state_region,'country',v.country,'address',v.address_line1,'website',v.website,'instagram',v.instagram,'origin',null,'category',null) into r from venues v where v.id=p_id and v.status='active';
  when 'school' then select jsonb_build_object('kind',p_kind,'id',s.id,'name',s.name,'slug',s.slug,'description',s.description,'image_url',s.image_url,'city',s.city,'state_region',s.state_region,'country',s.country,'address',s.address_line1,'website',s.website,'instagram',s.instagram,'origin',null,'category',null) into r from schools s where s.id=p_id and s.status='active';
  when 'instructor' then select jsonb_build_object('kind',p_kind,'id',i.id,'name',i.name,'slug',i.slug,'description',coalesce(i.description,i.organization),'image_url',i.image_url,'city',i.city,'state_region',i.state_region,'country',i.country,'address',null,'website',i.website,'instagram',i.instagram,'origin',null,'category',null) into r from instructors i where i.id=p_id and i.status='active';
  when 'city' then select jsonb_build_object('kind',p_kind,'id',m.id,'name',m.name,'slug',m.slug,'description',null,'image_url',null,'city',m.slug,'state_region',m.state_region,'country',m.country_code,'address',null,'website',null,'instagram',null,'origin',null,'category',null) into r from metros m where m.id=p_id and m.status='active';
  when 'style' then select jsonb_build_object('kind',p_kind,'id',t.id,'name',t.name,'slug',t.slug,'description',t.description,'image_url',null,'city',null,'state_region',null,'country',null,'address',null,'website',null,'instagram',null,'origin',null,'category',t.category) into r from taxonomy_terms t where t.id=p_id and t.status='active';
  when 'event' then select jsonb_build_object('kind',p_kind,'id',e.id,'name',e.title,'slug',e.slug,'description',e.description,'image_url',coalesce(e.image_url,e.poster_image_url),'city',e.city,'state_region',null,'country',null,'address',e.address,'website',null,'instagram',null,'origin',null,'category',e.event_type,'event_date',e.event_date) into r from events e where e.id=p_id and e.status='approved';
  else return null;
  end case;
  return r;
end $$;

create or replace function public.public_entity_detail(p_kind text,p_slug text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_ref jsonb; v_up jsonb; v_past jsonb; v_related jsonb;
begin
  if p_slug is null or btrim(p_slug)='' then return null; end if;
  case p_kind
    when 'event' then select id into v_id from events where slug=p_slug and status='approved';
    when 'series' then select id into v_id from event_series where slug=p_slug and status='active';
    when 'organizer' then select id into v_id from organizers where slug=p_slug and status='active';
    when 'venue' then select id into v_id from venues where slug=p_slug and status='active';
    when 'school' then select id into v_id from schools where slug=p_slug and status='active';
    when 'instructor' then select id into v_id from instructors where slug=p_slug and status='active';
    when 'city' then select id into v_id from metros where slug=p_slug and status='active';
    when 'style' then select id into v_id from taxonomy_terms where slug=p_slug and status='active';
    else return null;
  end case;
  if v_id is null then return null; end if;
  v_ref:=public.entity_access_public_ref(p_kind,v_id);
  if v_ref is null then return null; end if;
  if p_kind='event' then
    select coalesce(jsonb_agg(public.entity_access_event_summary(e) order by e.event_date,e.id),'[]'::jsonb) into v_up from events e where e.id=v_id and e.event_date>=now();
    select coalesce(jsonb_agg(public.entity_access_event_summary(e) order by e.event_date desc,e.id),'[]'::jsonb) into v_past from events e where e.id=v_id and e.event_date<now();
  else
    select coalesce(jsonb_agg(public.entity_access_event_summary(e) order by e.event_date,e.id),'[]'::jsonb) into v_up from public.entity_access_events(p_kind,v_id) e where e.event_date>=now();
    select coalesce(jsonb_agg(public.entity_access_event_summary(e) order by e.event_date desc,e.id),'[]'::jsonb) into v_past from public.entity_access_events(p_kind,v_id) e where e.event_date<now();
  end if;
  select coalesce(jsonb_agg(x.ref order by x.name,x.id),'[]'::jsonb) into v_related from public.entity_access_related(p_kind,v_id) x;
  return jsonb_build_object('entity',v_ref,'upcoming',v_up,'past',v_past,'related',v_related);
end $$;

create or replace function public.entity_access_event_summary(e public.events)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',e.id,'slug',e.slug,'title',e.title,'event_date',e.event_date,'city',e.city,'location',e.location,'image_url',coalesce(e.image_url,e.poster_image_url))
$$;

create or replace function public.entity_access_events(p_kind text,p_id uuid)
returns setof public.events language sql stable security definer set search_path=public,pg_temp as $$
 select e.* from events e
 where e.status='approved' and case p_kind
  when 'event' then e.id=p_id
  when 'series' then e.series_id=p_id
  when 'organizer' then e.organizer_id=p_id
  when 'venue' then e.venue_id=p_id
  when 'school' then exists(select 1 from event_schools es where es.event_id=e.id and es.school_id=p_id)
  when 'instructor' then exists(select 1 from event_instructors ei where ei.event_id=e.id and ei.instructor_id=p_id)
  when 'city' then e.city=(select m.slug from metros m where m.id=p_id and m.status='active')
  when 'style' then exists(select 1 from event_taxonomy_terms ett join taxonomy_terms t on t.id=ett.taxonomy_term_id where ett.event_id=e.id and ett.taxonomy_term_id=p_id and t.status='active')
  else false end
$$;

create or replace function public.entity_access_related(p_kind text,p_id uuid)
returns table(ref jsonb,name text,id text) language sql stable security definer set search_path=public,pg_temp as $$
 with linked_events as materialized (
  select e.id,e.series_id,e.venue_id,e.organizer_id,e.city
  from events e where e.status='approved' and case p_kind
   when 'event' then e.id=p_id
   when 'series' then e.series_id=p_id
   when 'organizer' then e.organizer_id=p_id
   when 'venue' then e.venue_id=p_id
   when 'school' then exists(select 1 from event_schools es where es.event_id=e.id and es.school_id=p_id)
   when 'instructor' then exists(select 1 from event_instructors ei where ei.event_id=e.id and ei.instructor_id=p_id)
   when 'city' then e.city=(select m.slug from metros m where m.id=p_id and m.status='active')
   when 'style' then exists(select 1 from event_taxonomy_terms et join taxonomy_terms t on t.id=et.taxonomy_term_id where et.event_id=e.id and et.taxonomy_term_id=p_id and t.status='active')
   else false end
 ), refs as (
  select public.entity_access_public_ref('series',le.series_id) ref from linked_events le where le.series_id is not null
  union all select public.entity_access_public_ref('venue',le.venue_id) from linked_events le where le.venue_id is not null
  union all select public.entity_access_public_ref('organizer',le.organizer_id) from linked_events le where le.organizer_id is not null
  union all select public.entity_access_public_ref('city',m.id) from linked_events le join metros m on m.slug=le.city and m.status='active'
  union all select public.entity_access_public_ref('school',es.school_id) from linked_events le join event_schools es on es.event_id=le.id where p_kind<>'school' or es.school_id<>p_id
  union all select public.entity_access_public_ref('instructor',ei.instructor_id) from linked_events le join event_instructors ei on ei.event_id=le.id where p_kind<>'instructor' or ei.instructor_id<>p_id
  union all select public.entity_access_public_ref('style',et.taxonomy_term_id) from linked_events le join event_taxonomy_terms et on et.event_id=le.id join taxonomy_terms t on t.id=et.taxonomy_term_id where t.status='active'
  union all select public.entity_access_public_ref('event',le.id) from linked_events le where p_kind='style'
  union all select public.entity_access_public_ref('venue',s.venue_id) from event_series s where p_kind='series' and s.id=p_id and s.status='active' and s.venue_id is not null
  union all select public.entity_access_public_ref('organizer',s.organizer_id) from event_series s where p_kind='series' and s.id=p_id and s.status='active' and s.organizer_id is not null
  union all select public.entity_access_public_ref('series',s.id) from event_series s where p_kind='organizer' and s.organizer_id=p_id and s.status='active'
 )
 select distinct refs.ref,refs.ref->>'name',refs.ref->>'id' from refs where refs.ref is not null
$$;

create or replace function public.public_entity_directory(p_kind text default null,p_query text default '',p_city text default null,p_limit int default 50,p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_kind is not null and p_kind not in ('event','series','organizer','venue','school','instructor','city','style') then return '[]'::jsonb; end if;
 if coalesce(p_limit,50)<1 or coalesce(p_offset,0)<0 then raise exception 'invalid pagination' using errcode='22023'; end if;
 with candidates as (
   select 'event' k,e.id,e.title n,e.slug,e.city c,e.description d from events e where e.status='approved'
   union all select 'series',s.id,s.name,s.slug,s.city,s.description from event_series s where s.status='active'
   union all select 'organizer',o.id,o.name,o.slug,o.primary_city,o.description from organizers o where o.status='active'
   union all select 'venue',v.id,v.name,v.slug,v.city,null::text from venues v where v.status='active'
   union all select 'school',s.id,s.name,s.slug,s.city,s.description from schools s where s.status='active'
   union all select 'instructor',i.id,i.name,i.slug,i.city,coalesce(i.description,i.organization) from instructors i where i.status='active'
   union all select 'city',m.id,m.name,m.slug,m.slug,null::text from metros m where m.status='active'
   union all select 'style',t.id,t.name,t.slug,null::text,t.description from taxonomy_terms t where t.status='active'
 ), refs as (
   select c.k,c.n,c.slug,c.id,public.entity_access_public_ref(c.k,c.id) ref from candidates c
   where (p_kind is null or p_kind=c.k) and (coalesce(p_query,'')='' or c.n ilike '%'||coalesce(p_query,'')||'%' or coalesce(c.d,'') ilike '%'||coalesce(p_query,'')||'%')
     and (p_city is null or c.c=p_city or exists(select 1 from public.entity_access_events(c.k,c.id) e where e.city=p_city))
 ) select coalesce(jsonb_agg(q.ref order by q.k,q.n,q.id),'[]'::jsonb) into result from (select k,n,id,ref from refs where ref is not null order by k,n,id offset coalesce(p_offset,0) limit least(coalesce(p_limit,50),100)) q;
 return result;
end $$;

create or replace function public.public_event_entities(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 select jsonb_build_object(
 'venue',public.entity_access_public_ref('venue',e.venue_id),
 'organizer',public.entity_access_public_ref('organizer',e.organizer_id),
 'school',coalesce((select public.entity_access_public_ref('school',es.school_id) from event_schools es join schools s on s.id=es.school_id where es.event_id=e.id and s.status='active' order by es.created_at limit 1),null),
 'schools',coalesce((select jsonb_agg(public.entity_access_public_ref('school',es.school_id) order by s.name) from event_schools es join schools s on s.id=es.school_id where es.event_id=e.id and s.status='active'),'[]'::jsonb),
 'instructors',coalesce((select jsonb_agg(public.entity_access_public_ref('instructor',ei.instructor_id) order by ei.position,ei.instructor_id) from event_instructors ei join instructors i on i.id=ei.instructor_id where ei.event_id=e.id and i.status='active'),'[]'::jsonb),
 'series',public.entity_access_public_ref('series',e.series_id),
 'city',(select public.entity_access_public_ref('city',m.id) from metros m where m.slug=e.city),
 'styles',coalesce((select jsonb_agg(public.entity_access_public_ref('style',ett.taxonomy_term_id) order by t.display_order,t.name) from event_taxonomy_terms ett join taxonomy_terms t on t.id=ett.taxonomy_term_id where ett.event_id=e.id and t.category='dance_style' and t.status='active'),'[]'::jsonb)) into result from events e where e.id=p_event_id and e.status='approved';
 return result;
end $$;

-- Keep existing external RPC, but return active entities only through the tightened allowlist.
create or replace function public.public_flyer_entity(p_kind text,p_slug text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 case p_kind when 'venue' then select id into v_id from venues where slug=p_slug and status='active';
 when 'organizer' then select id into v_id from organizers where slug=p_slug and status='active';
 when 'school' then select id into v_id from schools where slug=p_slug and status='active';
 when 'instructor' then select id into v_id from instructors where slug=p_slug and status='active'; else return null; end case;
 return public.entity_access_public_ref(p_kind,v_id);
end $$;

-- Admin-only entity RPCs use native table field names in payloads, reject unknown keys,
-- and never create or alter organizer membership/account rows.
create or replace function public.entity_access_quality_issues(p_kind text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_city text; v_description text; v_image text; v_website text; v_address text; v_contact text; v_organization text;
begin
 if p_kind='series' then select city,description,image_url,null::text,null::text,null::text,null::text into v_city,v_description,v_image,v_website,v_address,v_contact,v_organization from event_series where id=p_id;
 elsif p_kind='organizer' then select primary_city,description,logo_url,website,null::text,null::text,null::text into v_city,v_description,v_image,v_website,v_address,v_contact,v_organization from organizers where id=p_id;
 elsif p_kind='school' then select city,description,image_url,website,address_line1,phone,null::text into v_city,v_description,v_image,v_website,v_address,v_contact,v_organization from schools where id=p_id;
 elsif p_kind='instructor' then select city,description,image_url,website,null::text,null::text,organization into v_city,v_description,v_image,v_website,v_address,v_contact,v_organization from instructors where id=p_id;
 else return '[]'::jsonb;
 end if;
 return to_jsonb(array_remove(array[
  case when v_city is null then 'missing_city' end,
  case when p_kind in ('series','organizer','school','instructor') and v_description is null then 'missing_description' end,
  case when p_kind in ('series','organizer','school','instructor') and v_image is null then 'missing_image' end,
  case when p_kind in ('organizer','school','instructor') and v_website is null then 'missing_website' end,
  case when p_kind='school' and v_address is null then 'missing_location' end,
  case when p_kind='school' and v_contact is null then 'missing_contact' end,
  case when p_kind='instructor' and v_organization is null then 'missing_organization' end
 ]::text[],null));
end $$;

create or replace function public.admin_entity_directory(p_kind text,p_query text default '',p_status text default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.is_admin() or not public.account_is_active(auth.uid()) then raise exception 'Administrator role required' using errcode='42501'; end if;
 if p_kind not in ('series','organizer','school','instructor') then raise exception 'Unsupported entity kind' using errcode='22023'; end if;
 with rows as (
 select 'series' kind,s.id,s.name,s.slug,s.status,s.description,s.image_url,s.city,s.venue_id,s.organizer_id,null::text address,null::text state_region,null::text country,s.updated_at from event_series s where p_kind='series' and (p_status is null or s.status=p_status) and (p_query='' or s.name ilike '%'||p_query||'%' or s.slug ilike '%'||p_query||'%')
 union all select 'organizer',o.id,o.name,o.slug,o.status,o.description,o.logo_url,o.primary_city,null::uuid,null::uuid,null::text,o.state_region,o.country,o.updated_at from organizers o where p_kind='organizer' and (p_status is null or o.status=p_status) and (p_query='' or o.name ilike '%'||p_query||'%' or o.slug ilike '%'||p_query||'%')
 union all select 'school',s.id,s.name,s.slug,s.status,s.description,s.image_url,s.city,null::uuid,null::uuid,s.address_line1,s.state_region,s.country,s.updated_at from schools s where p_kind='school' and (p_status is null or s.status=p_status) and (p_query='' or s.name ilike '%'||p_query||'%' or s.slug ilike '%'||p_query||'%')
 union all select 'instructor',i.id,i.name,i.slug,i.status,coalesce(i.description,i.organization),i.image_url,i.city,null::uuid,null::uuid,null::text,i.state_region,i.country,i.updated_at from instructors i where p_kind='instructor' and (p_status is null or i.status=p_status) and (p_query='' or i.name ilike '%'||p_query||'%' or i.slug ilike '%'||p_query||'%')
 ) select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'name',r.name,'slug',r.slug,'status',r.status,'description',r.description,'image_url',r.image_url,'city',r.city,'website',case r.kind when 'organizer' then (select website from organizers where id=r.id) when 'school' then (select website from schools where id=r.id) when 'instructor' then (select website from instructors where id=r.id) else null end,'instagram',case r.kind when 'organizer' then (select instagram from organizers where id=r.id) when 'school' then (select instagram from schools where id=r.id) when 'instructor' then (select instagram from instructors where id=r.id) else null end,'address',r.address,'state_region',r.state_region,'country',r.country,'venue_id',r.venue_id,'organizer_id',r.organizer_id,'quality_issues','[]'::jsonb,'linked_events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'status',e.status,'event_date',e.event_date) order by e.event_date,e.id) from events e where e.status<>'deleted' and case r.kind when 'series' then e.series_id=r.id when 'organizer' then e.organizer_id=r.id when 'school' then exists(select 1 from event_schools es where es.event_id=e.id and es.school_id=r.id) when 'instructor' then exists(select 1 from event_instructors ei where ei.event_id=e.id and ei.instructor_id=r.id) end),'[]'::jsonb)) order by r.name,r.id),'[]'::jsonb) into result from rows r;
 select coalesce(jsonb_agg(x.value||jsonb_build_object(
  'quality_issues',public.entity_access_quality_issues(x.value->>'kind',(x.value->>'id')::uuid),
  'phone',case when x.value->>'kind'='school' then (select phone from schools where id=(x.value->>'id')::uuid) end,
  'organization',case when x.value->>'kind'='instructor' then (select organization from instructors where id=(x.value->>'id')::uuid) end,
  'category',case when x.value->>'kind'='organizer' then (select organizer_type from organizers where id=(x.value->>'id')::uuid) end
 )),'[]'::jsonb) into result from jsonb_array_elements(result) x(value);
 return result;
end $$;

create or replace function public.admin_entity_detail(p_kind text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.is_admin() or not public.account_is_active(auth.uid()) then raise exception 'Administrator role required' using errcode='42501'; end if;
 select x.value into result from (select public.admin_entity_directory(p_kind,'',null) as value) d cross join lateral jsonb_array_elements(d.value) x(value) where x.value->>'id'=p_id::text limit 1;
 return result;
end $$;

create or replace function public.admin_entity_save(p_kind text,p_id uuid default null,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; v_name text; v_slug text; v_city text; v_status text; v_existing_slug text;
begin
 if not public.is_admin() or not public.account_is_active(auth.uid()) then raise exception 'Administrator role required' using errcode='42501'; end if;
 if p_kind not in ('series','organizer','school','instructor') or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid kind or payload' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_payload) as keys(key) where key not in ('name','slug','description','image_url','status','city','venue_id','organizer_id','website','instagram','address','address_line1','phone','state_region','country','organization','category','organizer_type','primary_city')) then raise exception 'Unsupported entity field' using errcode='22023'; end if;
 v_name:=nullif(btrim(p_payload->>'name'),''); v_slug:=nullif(btrim(p_payload->>'slug'),''); v_city:=coalesce(nullif(btrim(p_payload->>'city'),''),nullif(btrim(p_payload->>'primary_city'),'')); v_status:=nullif(btrim(p_payload->>'status'),'');
 if p_id is null then
  if v_name is null then raise exception 'Name is required' using errcode='22023'; end if;
  v_status:=coalesce(v_status,'active');
 else
  -- Partial updates (e.g. archive-only) inherit identity fields from the row.
  if p_kind='series' then select coalesce(v_name,name),coalesce(v_status,status),coalesce(v_city,city) into v_name,v_status,v_city from event_series where id=p_id;
  elsif p_kind='organizer' then select coalesce(v_name,name),coalesce(v_status,status),coalesce(v_city,primary_city) into v_name,v_status,v_city from organizers where id=p_id;
  elsif p_kind='school' then select coalesce(v_name,name),coalesce(v_status,status),coalesce(v_city,city) into v_name,v_status,v_city from schools where id=p_id;
  else select coalesce(v_name,name),coalesce(v_status,status),coalesce(v_city,city) into v_name,v_status,v_city from instructors where id=p_id; end if;
  if v_name is null then raise exception 'Entity not found' using errcode='P0002'; end if;
 end if;
 if p_id is not null then
  if p_kind='series' then select slug into v_existing_slug from event_series where id=p_id;
  elsif p_kind='organizer' then select slug into v_existing_slug from organizers where id=p_id;
  elsif p_kind='school' then select slug into v_existing_slug from schools where id=p_id;
  else select slug into v_existing_slug from instructors where id=p_id; end if;
  if v_existing_slug is not null and v_slug is not null and v_slug<>v_existing_slug then
   raise exception 'Existing public URL cannot be changed' using errcode='22023';
  end if;
  v_slug:=coalesce(v_existing_slug,v_slug);
 end if;
 if v_slug is null then v_slug:=coalesce(nullif(trim(both '-' from regexp_replace(lower(v_name),'[^a-z0-9]+','-','g')),''),'entity'); end if;
 if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Invalid slug' using errcode='22023'; end if;
 if p_id is null and nullif(btrim(p_payload->>'slug'),'') is null then
  if (p_kind='series' and exists(select 1 from event_series where slug=v_slug))
   or (p_kind='organizer' and exists(select 1 from organizers where slug=v_slug))
   or (p_kind='school' and exists(select 1 from schools where slug=v_slug))
   or (p_kind='instructor' and exists(select 1 from instructors where slug=v_slug)) then
   v_slug:=v_slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,10);
  end if;
 end if;
 if p_kind='series' then
  if v_status not in ('active','needs_review','archived') then raise exception 'Invalid status' using errcode='22023'; end if;
  if v_city is not null and not exists(select 1 from metros where slug=v_city) then raise exception 'Unknown city' using errcode='22023'; end if;
  if (p_id is null or p_payload ? 'name' or p_payload ? 'slug') and exists(select 1 from event_series x where x.id is distinct from p_id and (x.slug=v_slug or (public.flyer_norm_text(x.name)=public.flyer_norm_text(v_name) and x.city is not distinct from v_city))) then raise exception 'Duplicate or ambiguous series' using errcode='23505'; end if;
  if p_id is null then insert into event_series(name,slug,description,image_url,status,city,venue_id,organizer_id) values(v_name,v_slug,p_payload->>'description',p_payload->>'image_url',v_status,v_city,nullif(p_payload->>'venue_id','')::uuid,nullif(p_payload->>'organizer_id','')::uuid) returning to_jsonb(event_series.*) into result;
  else update event_series set name=v_name,slug=v_slug,description=case when p_payload ? 'description' then p_payload->>'description' else description end,image_url=case when p_payload ? 'image_url' then p_payload->>'image_url' else image_url end,status=v_status,city=case when p_payload ? 'city' then v_city else city end,venue_id=case when p_payload ? 'venue_id' then nullif(p_payload->>'venue_id','')::uuid else venue_id end,organizer_id=case when p_payload ? 'organizer_id' then nullif(p_payload->>'organizer_id','')::uuid else organizer_id end where id=p_id returning to_jsonb(event_series.*) into result; end if;
 elsif p_kind='organizer' then
  if v_status not in ('active','needs_review','suspended','archived') then raise exception 'Invalid organizer status' using errcode='22023'; end if;
  if (p_id is null or p_payload ? 'name' or p_payload ? 'slug') and exists(select 1 from organizers x where x.id is distinct from p_id and (x.slug=v_slug or (public.flyer_norm_text(x.name)=public.flyer_norm_text(v_name) and x.primary_city is not distinct from v_city and coalesce(x.website,'')=coalesce(p_payload->>'website',x.website,'')))) then raise exception 'Duplicate or ambiguous organizer' using errcode='23505'; end if;
  if p_id is null then insert into organizers(name,slug,description,logo_url,status,primary_city,website,instagram,organizer_type,state_region,country) values(v_name,v_slug,p_payload->>'description',p_payload->>'image_url',v_status,v_city,p_payload->>'website',p_payload->>'instagram',coalesce(p_payload->>'category',p_payload->>'organizer_type'),p_payload->>'state_region',p_payload->>'country') returning to_jsonb(organizers.*) into result;
  else update organizers set name=v_name,slug=v_slug,description=case when p_payload?'description' then p_payload->>'description' else description end,logo_url=case when p_payload?'image_url' then p_payload->>'image_url' else logo_url end,status=v_status,primary_city=case when p_payload?'city' then v_city else primary_city end,website=case when p_payload?'website' then p_payload->>'website' else website end,instagram=case when p_payload?'instagram' then p_payload->>'instagram' else instagram end,organizer_type=case when p_payload?'category' then p_payload->>'category' when p_payload?'organizer_type' then p_payload->>'organizer_type' else organizer_type end,state_region=case when p_payload?'state_region' then p_payload->>'state_region' else state_region end,country=case when p_payload?'country' then p_payload->>'country' else country end where id=p_id returning to_jsonb(organizers.*) into result; end if;
 elsif p_kind='school' then
  if v_status not in ('active','needs_review','archived') then raise exception 'Invalid status' using errcode='22023'; end if;
  if (p_id is null or p_payload ? 'name' or p_payload ? 'slug') and exists(select 1 from schools x where x.id is distinct from p_id and (x.slug=v_slug or (public.flyer_norm_text(x.name)=public.flyer_norm_text(v_name) and x.city is not distinct from v_city))) then raise exception 'Duplicate or ambiguous school' using errcode='23505'; end if;
  if p_id is null then insert into schools(name,slug,status,description,image_url,city,state_region,country,address_line1,website,instagram,phone) values(v_name,v_slug,v_status,p_payload->>'description',p_payload->>'image_url',v_city,p_payload->>'state_region',p_payload->>'country',coalesce(p_payload->>'address',p_payload->>'address_line1'),p_payload->>'website',p_payload->>'instagram',p_payload->>'phone') returning to_jsonb(schools.*) into result;
  else update schools set name=v_name,slug=v_slug,status=v_status,description=case when p_payload?'description' then p_payload->>'description' else description end,image_url=case when p_payload?'image_url' then p_payload->>'image_url' else image_url end,city=case when p_payload?'city' then v_city else city end,state_region=case when p_payload?'state_region' then p_payload->>'state_region' else state_region end,country=case when p_payload?'country' then p_payload->>'country' else country end,address_line1=case when p_payload?'address' then p_payload->>'address' when p_payload?'address_line1' then p_payload->>'address_line1' else address_line1 end,website=case when p_payload?'website' then p_payload->>'website' else website end,instagram=case when p_payload?'instagram' then p_payload->>'instagram' else instagram end,phone=case when p_payload?'phone' then p_payload->>'phone' else phone end where id=p_id returning to_jsonb(schools.*) into result; end if;
 else
  if v_status not in ('active','needs_review','archived') then raise exception 'Invalid status' using errcode='22023'; end if;
  if (p_id is null or p_payload ? 'name' or p_payload ? 'slug') and exists(select 1 from instructors x where x.id is distinct from p_id and (x.slug=v_slug or (public.flyer_norm_text(x.name)=public.flyer_norm_text(v_name) and x.city is not distinct from v_city))) then raise exception 'Duplicate or ambiguous instructor' using errcode='23505'; end if;
  if p_id is null then insert into instructors(name,slug,status,description,image_url,city,state_region,country,organization,website,instagram) values(v_name,v_slug,v_status,p_payload->>'description',p_payload->>'image_url',v_city,p_payload->>'state_region',p_payload->>'country',p_payload->>'organization',p_payload->>'website',p_payload->>'instagram') returning to_jsonb(instructors.*) into result;
  else update instructors set name=v_name,slug=v_slug,status=v_status,description=case when p_payload?'description' then p_payload->>'description' else description end,image_url=case when p_payload?'image_url' then p_payload->>'image_url' else image_url end,city=case when p_payload?'city' then v_city else city end,state_region=case when p_payload?'state_region' then p_payload->>'state_region' else state_region end,country=case when p_payload?'country' then p_payload->>'country' else country end,organization=case when p_payload?'organization' then p_payload->>'organization' else organization end,website=case when p_payload?'website' then p_payload->>'website' else website end,instagram=case when p_payload?'instagram' then p_payload->>'instagram' else instagram end where id=p_id returning to_jsonb(instructors.*) into result; end if;
 end if;
 if result is null then raise exception 'Entity not found' using errcode='P0002'; end if;
 -- Same normalized shape as admin_entity_detail so callers get linked events,
 -- quality issues, and mapped public fields immediately after save/archive.
 return public.admin_entity_detail(p_kind,(result->>'id')::uuid);
end $$;

create or replace function public.admin_entity_merge(p_kind text,p_keep_id uuid,p_merge_id uuid,p_confirm boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_admin() or not public.account_is_active(auth.uid()) then raise exception 'Administrator role required' using errcode='42501'; end if;
 if not p_confirm or p_keep_id is null or p_merge_id is null or p_keep_id=p_merge_id then raise exception 'Explicit confirmation and distinct ids required' using errcode='22023'; end if;
 if p_kind='series' then
  if not exists(select 1 from event_series where id=p_keep_id and status<>'archived') or not exists(select 1 from event_series where id=p_merge_id and status<>'archived') then raise exception 'Series not found' using errcode='P0002'; end if;
  update event_series keep set venue_id=coalesce(keep.venue_id,donor.venue_id),organizer_id=coalesce(keep.organizer_id,donor.organizer_id) from event_series donor where keep.id=p_keep_id and donor.id=p_merge_id;
  update events set series_id=p_keep_id where series_id=p_merge_id;
  update event_series set status='archived' where id=p_merge_id;
 elsif p_kind='organizer' then
  if exists(select 1 from organizer_members where organizer_id=p_merge_id) then raise exception 'Organizer with members cannot be merged' using errcode='23514'; end if;
  if not exists(select 1 from organizers where id=p_keep_id and status<>'archived') or not exists(select 1 from organizers where id=p_merge_id and status<>'archived') then raise exception 'Organizer not found' using errcode='P0002'; end if;
  update events set organizer_id=p_keep_id where organizer_id=p_merge_id;
  update event_series set organizer_id=p_keep_id where organizer_id=p_merge_id;
  update organizers set status='archived' where id=p_merge_id;
 elsif p_kind='school' then
  if not exists(select 1 from schools where id=p_keep_id and status<>'archived') or not exists(select 1 from schools where id=p_merge_id and status<>'archived') then raise exception 'School not found' using errcode='P0002'; end if;
  insert into event_schools(event_id,school_id,created_at) select event_id,p_keep_id,created_at from event_schools where school_id=p_merge_id on conflict(event_id,school_id) do nothing;
  delete from event_schools where school_id=p_merge_id;
  update schools set status='archived' where id=p_merge_id;
 elsif p_kind='instructor' then
  if not exists(select 1 from instructors where id=p_keep_id and status<>'archived') or not exists(select 1 from instructors where id=p_merge_id and status<>'archived') then raise exception 'Instructor not found' using errcode='P0002'; end if;
  insert into event_instructors(event_id,instructor_id,position,created_at) select event_id,p_keep_id,position,created_at from event_instructors where instructor_id=p_merge_id on conflict(event_id,instructor_id) do nothing;
  delete from event_instructors where instructor_id=p_merge_id;
  update instructors set status='archived' where id=p_merge_id;
 else raise exception 'Unsupported entity kind' using errcode='22023'; end if;
 return jsonb_build_object('merged',true,'kind',p_kind,'keep_id',p_keep_id,'archived_id',p_merge_id);
end $$;

-- Replace the event-save RPC atomically to persist explicit series selection while keeping
-- manual entity choices and existing entity-review reconciliation semantics intact.
create or replace function public.save_event_with_entities(p_event_id uuid,p_payload jsonb,p_publish boolean default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_uid uuid:=auth.uid(); e public.events%rowtype; v_id uuid; v_series uuid; v_venue uuid; v_org uuid; v_result jsonb; v_ctx jsonb; v_review jsonb; v_term_ids uuid[]; v_has_review boolean; v_image text;
 v_title text; v_description text; v_event_type text; v_city text; v_event_date timestamptz; v_event_time text; v_location text; v_address text; v_price_type text; v_price_amount numeric; v_rsvp text; v_host text; v_recurrence text; v_c_email text; v_c_ig text; v_c_web text; v_gallery text[];
begin
 if v_uid is null or not public.is_moderator() or not public.account_is_active(v_uid) then raise exception 'Moderator role required' using errcode='42501'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'payload must be a JSON object' using errcode='22023'; end if;
 if p_event_id is not null then select * into e from events where id=p_event_id for update; if not found then raise exception 'Event not found' using errcode='P0002'; end if; end if;
 v_title:=nullif(btrim(p_payload->>'title'),''); v_description:=nullif(btrim(p_payload->>'description'),''); v_event_type:=nullif(btrim(p_payload->>'event_type'),''); v_city:=nullif(btrim(p_payload->>'city'),''); v_event_date:=nullif(btrim(p_payload->>'event_date'),'')::timestamptz; v_event_time:=nullif(btrim(p_payload->>'event_time'),''); v_location:=nullif(btrim(p_payload->>'location'),''); v_address:=nullif(btrim(p_payload->>'address'),''); v_price_type:=nullif(btrim(p_payload->>'price_type'),''); v_price_amount:=nullif(btrim(p_payload->>'price_amount'),'')::numeric; v_rsvp:=nullif(btrim(p_payload->>'rsvp_link'),''); v_host:=nullif(btrim(p_payload->>'host'),''); v_image:=nullif(btrim(p_payload->>'image_url'),''); v_recurrence:=nullif(btrim(p_payload->>'recurrence'),''); v_c_email:=nullif(btrim(p_payload->>'contact_email'),''); v_c_ig:=nullif(btrim(p_payload->>'contact_instagram'),''); v_c_web:=nullif(btrim(p_payload->>'contact_website'),'');
 v_gallery:=case when jsonb_typeof(p_payload->'gallery')='array' then array(select jsonb_array_elements_text(p_payload->'gallery')) else null end;
 if jsonb_exists(p_payload,'taxonomy_term_ids') and jsonb_typeof(p_payload->'taxonomy_term_ids')<>'null' then if jsonb_typeof(p_payload->'taxonomy_term_ids')<>'array' then raise exception 'taxonomy_term_ids must be an array' using errcode='22023'; end if; v_term_ids:=array(select distinct x::uuid from jsonb_array_elements_text(p_payload->'taxonomy_term_ids') x); if (select count(*) from taxonomy_terms where id=any(v_term_ids))<>cardinality(v_term_ids) then raise exception 'Unknown taxonomy term' using errcode='22023'; end if; elsif jsonb_exists(p_payload,'taxonomy_term_ids') then v_term_ids:='{}'; end if;
 if p_event_id is null and (v_title is null or v_event_type is null or v_city is null or v_event_date is null) then raise exception 'title, event_type, city and event_date are required' using errcode='22023'; end if;
 if p_event_id is not null and ((p_payload?'title' and v_title is null) or (p_payload?'event_type' and v_event_type is null) or (p_payload?'city' and v_city is null) or (p_payload?'event_date' and v_event_date is null)) then raise exception 'Required event fields cannot be blank' using errcode='22023'; end if;
 v_venue:=case when p_payload?'venue_id' then public.flyer_uuid_or_null(p_payload->>'venue_id') when p_event_id is not null then e.venue_id end;
 v_org:=case when p_payload?'organizer_id' then public.flyer_uuid_or_null(p_payload->>'organizer_id') when p_event_id is not null then e.organizer_id end;
 v_series:=case when p_payload?'series_id' then public.flyer_uuid_or_null(p_payload->>'series_id') when p_event_id is not null then e.series_id end;
 if p_payload?'venue_id' and nullif(p_payload->>'venue_id','') is not null and v_venue is null then raise exception 'Invalid venue_id' using errcode='22023'; end if;
 if p_payload?'organizer_id' and nullif(p_payload->>'organizer_id','') is not null and v_org is null then raise exception 'Invalid organizer_id' using errcode='22023'; end if;
 if p_payload?'series_id' and nullif(p_payload->>'series_id','') is not null and v_series is null then raise exception 'Invalid series_id' using errcode='22023'; end if;
 if v_series is not null and not exists(select 1 from event_series where id=v_series and status<>'archived') then raise exception 'Series not found or archived' using errcode='22023'; end if;
 v_has_review:=jsonb_exists(p_payload,'entity_review'); v_review:=case when v_has_review and jsonb_typeof(p_payload->'entity_review')='object' then p_payload->'entity_review' end;
 if v_has_review and jsonb_typeof(p_payload->'entity_review') not in ('object','null') then raise exception 'entity_review must be object or null' using errcode='22023'; end if;
 if p_event_id is null then
  insert into events(title,description,event_type,event_date,event_time,location,address,price_type,price_amount,rsvp_link,host,image_url,recurrence,contact_email,contact_instagram,contact_website,gallery,city,status,source_type,submitter_id,submitter_email,submitter_name,venue_id,organizer_id,series_id)
  values(v_title,v_description,v_event_type,v_event_date,v_event_time,v_location,v_address,v_price_type,v_price_amount,v_rsvp,v_host,v_image,v_recurrence,v_c_email,v_c_ig,v_c_web,v_gallery,v_city,case when coalesce(p_publish,false) then 'approved' else 'draft' end,case when public.is_admin() then 'admin' else 'moderator' end,v_uid,auth.jwt()->>'email','Salsa Segura',v_venue,v_org,v_series) returning id into v_id;
 else
  v_id:=p_event_id;
  update events set title=case when p_payload?'title' then v_title else title end,description=case when p_payload?'description' then v_description else description end,event_type=case when p_payload?'event_type' then v_event_type else event_type end,city=case when p_payload?'city' then v_city else city end,event_date=case when p_payload?'event_date' then v_event_date else event_date end,event_time=case when p_payload?'event_time' then v_event_time else event_time end,location=case when p_payload?'location' then v_location else location end,address=case when p_payload?'address' then v_address else address end,price_type=case when p_payload?'price_type' then v_price_type else price_type end,price_amount=case when p_payload?'price_amount' then v_price_amount else price_amount end,rsvp_link=case when p_payload?'rsvp_link' then v_rsvp else rsvp_link end,host=case when p_payload?'host' then v_host else host end,image_url=case when p_payload?'image_url' then v_image else image_url end,recurrence=case when p_payload?'recurrence' then v_recurrence else recurrence end,contact_email=case when p_payload?'contact_email' then v_c_email else contact_email end,contact_instagram=case when p_payload?'contact_instagram' then v_c_ig else contact_instagram end,contact_website=case when p_payload?'contact_website' then v_c_web else contact_website end,gallery=case when p_payload?'gallery' then v_gallery else gallery end,venue_id=v_venue,organizer_id=v_org,series_id=v_series,status=case when p_publish is null then status when p_publish then 'approved' else 'draft' end where id=v_id;
 end if;
 if v_review is not null then select image_url into v_image from events where id=v_id; v_ctx:=jsonb_build_object('source_type','flyer_extraction','event_id',v_id,'flyer_url',v_image); v_result:=public.flyer_apply_entity_review(v_review,v_ctx,v_venue,v_org); update events set venue_id=(v_result->>'venue_id')::uuid,organizer_id=(v_result->>'organizer_id')::uuid,entity_review=v_result->'review' where id=v_id; perform public.flyer_sync_event_links(v_id,v_result);
 elsif v_has_review then update events set entity_review=null where id=v_id; end if;
 if v_term_ids is not null then delete from event_taxonomy_terms where event_id=v_id; insert into event_taxonomy_terms(event_id,taxonomy_term_id) select v_id,unnest(v_term_ids) on conflict do nothing; end if;
 -- Entity review may have resolved or replaced canonical links; defaults follow that resolution.
 select venue_id,organizer_id into v_venue,v_org from events where id=v_id;
 if v_series is not null then update event_series set venue_id=coalesce(venue_id,v_venue),organizer_id=coalesce(organizer_id,v_org) where id=v_series; end if;
 return v_id;
end $$;

-- Preserve helper compatibility but tighten active-only fields. Public event JSON never
-- includes contact, submitter, moderation, or source provenance columns.
revoke all on function public.entity_access_public_ref(text,uuid) from public,anon,authenticated;
revoke all on function public.entity_access_event_summary(public.events) from public,anon,authenticated;
revoke all on function public.entity_access_events(text,uuid) from public,anon,authenticated;
revoke all on function public.entity_access_related(text,uuid) from public,anon,authenticated;
revoke all on function public.public_entity_detail(text,text) from public,anon,authenticated;
revoke all on function public.public_entity_directory(text,text,text,int,int) from public,anon,authenticated;
revoke all on function public.public_event_entities(uuid) from public,anon,authenticated;
revoke all on function public.public_flyer_entity(text,text) from public,anon,authenticated;
grant execute on function public.public_entity_detail(text,text),public.public_entity_directory(text,text,text,int,int),public.public_event_entities(uuid),public.public_flyer_entity(text,text) to anon,authenticated;
revoke all on function public.admin_entity_directory(text,text,text),public.admin_entity_detail(text,uuid),public.admin_entity_save(text,uuid,jsonb),public.admin_entity_merge(text,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_entity_directory(text,text,text),public.admin_entity_detail(text,uuid),public.admin_entity_save(text,uuid,jsonb),public.admin_entity_merge(text,uuid,uuid,boolean) to authenticated;
revoke all on function public.save_event_with_entities(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.save_event_with_entities(uuid,jsonb,boolean) to authenticated;
create or replace function public.entity_access_assign_event_slug()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.slug is null or btrim(new.slug)='' then
    new.slug:=coalesce(nullif(left(trim(both '-' from regexp_replace(lower(coalesce(nullif(btrim(new.title),''),'event')),'[^a-z0-9]+','-','g')),100),''),'event')||'-'||replace(new.id::text,'-','');
  end if;
  return new;
end $$;
drop trigger if exists events_assign_public_slug on public.events;
create trigger events_assign_public_slug before insert or update of title on public.events
for each row execute function public.entity_access_assign_event_slug();

-- Maintain the legacy public_events shape while removing private contact/cancellation values.
-- New card/detail data is appended so existing column ordinals remain stable.
drop view public.public_events;
create view public.public_events as
select
 event.id,event.title,event.description,event.event_type,event.event_date,event.event_time,event.location,event.address,
 event.price_type,event.price_amount,event.rsvp_link,event.image_url,event.poster_image_url,event.status,event.source_type,
 event.city,event.host,event.recurrence,event.gallery,event.dance_styles,event.venue_id,event.organizer_id,
 event.created_at,event.updated_at,coalesce(taxonomy.terms,'[]'::jsonb) as event_taxonomy_terms,
 event.slug,event.series_id,public.public_event_entities(event.id) as public_entities
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
grant select on table public.public_events to anon,authenticated;

create view public.public_active_metros as
select metro.slug,metro.name,metro.state_region,metro.country_code,metro.latitude,metro.longitude,
 count(event.id)::integer as upcoming_event_count,min(event.event_date) as next_event_at
from public.metros metro join public.public_events event on event.city=metro.slug
where event.event_date>=now() and metro.status='active'
group by metro.id;
alter view public.public_active_metros set (security_invoker=false);
comment on view public.public_active_metros is
 'Active metros with approved upcoming events. Registered metros without upcoming events remain absent from discovery.';
revoke all on table public.public_active_metros from public;
grant select on table public.public_active_metros to anon,authenticated;

-- Prevent a hard delete from silently erasing a live identity or any of its links.
create or replace function public.entity_access_guard_delete()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='event_series' and exists(select 1 from events where series_id=old.id) then
  raise exception 'Series with linked events must be archived' using errcode='23503';
 elsif tg_table_name='organizers' and (exists(select 1 from events where organizer_id=old.id) or exists(select 1 from organizer_members where organizer_id=old.id) or exists(select 1 from event_series where organizer_id=old.id)) then
  raise exception 'Organizer with linked events, series, or members must be archived' using errcode='23503';
 elsif tg_table_name='schools' and exists(select 1 from event_schools where school_id=old.id) then
  raise exception 'School with linked events must be archived' using errcode='23503';
 elsif tg_table_name='instructors' and exists(select 1 from event_instructors where instructor_id=old.id) then
  raise exception 'Instructor with linked events must be archived' using errcode='23503';
 end if;
 return old;
end $$;
drop trigger if exists event_series_guard_delete on public.event_series;
create trigger event_series_guard_delete before delete on public.event_series for each row execute function public.entity_access_guard_delete();
drop trigger if exists organizers_guard_entity_delete on public.organizers;
create trigger organizers_guard_entity_delete before delete on public.organizers for each row execute function public.entity_access_guard_delete();
drop trigger if exists schools_guard_entity_delete on public.schools;
create trigger schools_guard_entity_delete before delete on public.schools for each row execute function public.entity_access_guard_delete();
drop trigger if exists instructors_guard_entity_delete on public.instructors;
create trigger instructors_guard_entity_delete before delete on public.instructors for each row execute function public.entity_access_guard_delete();

-- The allowlisted projector remains callable only through public RPCs.
revoke all on function public.flyer_public_entity_json(text,uuid) from public,anon,authenticated;
revoke all on function public.entity_access_assign_event_slug() from public,anon,authenticated;
revoke all on function public.entity_access_guard_delete() from public,anon,authenticated;
drop policy if exists "Taxonomy terms are publicly viewable" on public.taxonomy_terms;
create policy "Taxonomy terms are publicly viewable" on public.taxonomy_terms
 for select to anon,authenticated using (status='active');
drop policy if exists taxonomy_terms_admin_read on public.taxonomy_terms;
create policy taxonomy_terms_admin_read on public.taxonomy_terms for select to authenticated using (public.is_admin());
revoke all on function public.entity_access_quality_issues(text,uuid) from public,anon,authenticated;

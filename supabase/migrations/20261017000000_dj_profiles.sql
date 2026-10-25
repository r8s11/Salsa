-- DJ profiles: a public `dj` entity kind modelled on `instructor`.
--
-- A DJ is a salsa / bachata DJ with a public profile (/dj/:slug), linked to the
-- events they play through event_djs, manageable by a team (entity_members) and
-- claimable by the DJ ("Is this you?"), exactly like an instructor listing.
-- Every function below is the latest definition of the same-named function
-- (20260930000000_entity_accessibility.sql, 20261008000000_entity_workspaces.sql)
-- with only the dj branches added.

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------

create table public.djs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 2 and 200),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description   text,
  image_url     text,
  city          text,
  state_region  text,
  country       text check (country is null or country ~ '^[A-Z]{2}$'),
  website       text,
  instagram     text,
  status        text not null default 'active' check (status in ('active', 'needs_review', 'archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger djs_set_updated_at
  before update on public.djs
  for each row execute function public.set_updated_at();

create table public.event_djs (
  event_id   uuid not null references public.events (id) on delete cascade,
  dj_id      uuid not null references public.djs (id) on delete restrict,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (event_id, dj_id)
);
create index event_djs_dj_idx on public.event_djs (dj_id, event_id);

alter table public.djs enable row level security;
alter table public.event_djs enable row level security;

revoke all on table public.djs, public.event_djs from anon, authenticated;
grant select, insert, update, delete on table public.djs, public.event_djs to authenticated;

create policy "Admins manage djs" on public.djs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Moderators read event djs" on public.event_djs
  for select to authenticated using (public.is_moderator());
create policy "Admins manage event djs" on public.event_djs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 2. Workspace tables accept the new kind
-- ------------------------------------------------------------

alter table public.entity_members drop constraint if exists entity_members_entity_kind_check;
alter table public.entity_members add constraint entity_members_entity_kind_check
  check (entity_kind in ('school', 'venue', 'instructor', 'dj'));
alter table public.entity_claims drop constraint if exists entity_claims_entity_kind_check;
alter table public.entity_claims add constraint entity_claims_entity_kind_check
  check (entity_kind in ('school', 'venue', 'instructor', 'dj'));

-- Audit rows name the listing kind they touched.
alter table public.audit_logs drop constraint audit_logs_target_type_check;
alter table public.audit_logs add constraint audit_logs_target_type_check check (
  target_type is null or target_type = any (array[
    'event', 'event_submission', 'profile', 'organizer', 'venue', 'taxonomy_term', 'platform_settings',
    'school', 'instructor', 'dj'
  ])
);

create trigger djs_block_archive_with_team before update of status on public.djs
  for each row execute function public.entity_members_block_archive('dj');

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
 elsif tg_table_name='djs' and exists(select 1 from event_djs where dj_id=old.id) then
  raise exception 'DJ with linked events must be archived' using errcode='23503';
 end if;
 return old;
end $$;
create trigger djs_guard_entity_delete before delete on public.djs for each row execute function public.entity_access_guard_delete();

-- ------------------------------------------------------------
-- 3. Public projections
-- ------------------------------------------------------------

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
  when 'dj' then select jsonb_build_object('kind',p_kind,'id',d.id,'name',d.name,'slug',d.slug,'description',d.description,'image_url',d.image_url,'city',d.city,'state_region',d.state_region,'country',d.country,'address',null,'website',d.website,'instagram',d.instagram,'origin',null,'category',null) into r from djs d where d.id=p_id and d.status='active';
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
    when 'dj' then select id into v_id from djs where slug=p_slug and status='active';
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
  when 'dj' then exists(select 1 from event_djs ed where ed.event_id=e.id and ed.dj_id=p_id)
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
   when 'dj' then exists(select 1 from event_djs ed where ed.event_id=e.id and ed.dj_id=p_id)
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
  union all select public.entity_access_public_ref('dj',ed.dj_id) from linked_events le join event_djs ed on ed.event_id=le.id where p_kind<>'dj' or ed.dj_id<>p_id
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
 if p_kind is not null and p_kind not in ('event','series','organizer','venue','school','instructor','dj','city','style') then return '[]'::jsonb; end if;
 if coalesce(p_limit,50)<1 or coalesce(p_offset,0)<0 then raise exception 'invalid pagination' using errcode='22023'; end if;
 with candidates as (
   select 'event' k,e.id,e.title n,e.slug,e.city c,e.description d from events e where e.status='approved'
   union all select 'series',s.id,s.name,s.slug,s.city,s.description from event_series s where s.status='active'
   union all select 'organizer',o.id,o.name,o.slug,o.primary_city,o.description from organizers o where o.status='active'
   union all select 'venue',v.id,v.name,v.slug,v.city,null::text from venues v where v.status='active'
   union all select 'school',s.id,s.name,s.slug,s.city,s.description from schools s where s.status='active'
   union all select 'instructor',i.id,i.name,i.slug,i.city,coalesce(i.description,i.organization) from instructors i where i.status='active'
   union all select 'dj',d.id,d.name,d.slug,d.city,d.description from djs d where d.status='active'
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
 'djs',coalesce((select jsonb_agg(public.entity_access_public_ref('dj',ed.dj_id) order by ed.position,ed.dj_id) from event_djs ed join djs d on d.id=ed.dj_id where ed.event_id=e.id and d.status='active'),'[]'::jsonb),
 'series',public.entity_access_public_ref('series',e.series_id),
 'city',(select public.entity_access_public_ref('city',m.id) from metros m where m.slug=e.city),
 'styles',coalesce((select jsonb_agg(public.entity_access_public_ref('style',ett.taxonomy_term_id) order by t.display_order,t.name) from event_taxonomy_terms ett join taxonomy_terms t on t.id=ett.taxonomy_term_id where ett.event_id=e.id and t.category='dance_style' and t.status='active'),'[]'::jsonb)) into result from events e where e.id=p_event_id and e.status='approved';
 return result;
end $$;

-- ------------------------------------------------------------
-- 4. Admin entity RPCs
-- ------------------------------------------------------------


create or replace function public.entity_access_quality_issues(p_kind text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_city text; v_description text; v_image text; v_website text; v_address text; v_contact text; v_organization text;
begin
 if p_kind='series' then select city,description,image_url,null::text,null::text,null::text,null::text into v_city,v_description,v_image,v_website,v_address,v_contact,v_organization from event_series where id=p_id;
 elsif p_kind='organizer' then select primary_city,description,logo_url,website,null::text,null::text,null::text into v_city,v_description,v_image,v_website,v_address,v_contact,v_organization from organizers where id=p_id;
 elsif p_kind='school' then select city,description,image_url,website,address_line1,phone,null::text into v_city,v_description,v_image,v_website,v_address,v_contact,v_organization from schools where id=p_id;
 elsif p_kind='instructor' then select city,description,image_url,website,null::text,null::text,organization into v_city,v_description,v_image,v_website,v_address,v_contact,v_organization from instructors where id=p_id;
 elsif p_kind='dj' then select city,description,image_url,website,null::text,null::text,null::text into v_city,v_description,v_image,v_website,v_address,v_contact,v_organization from djs where id=p_id;
 else return '[]'::jsonb;
 end if;
 return to_jsonb(array_remove(array[
  case when v_city is null then 'missing_city' end,
  case when p_kind in ('series','organizer','school','instructor','dj') and v_description is null then 'missing_description' end,
  case when p_kind in ('series','organizer','school','instructor','dj') and v_image is null then 'missing_image' end,
  case when p_kind in ('organizer','school','instructor','dj') and v_website is null then 'missing_website' end,
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
 if p_kind not in ('series','organizer','school','instructor','dj') then raise exception 'Unsupported entity kind' using errcode='22023'; end if;
 with rows as (
 select 'series' kind,s.id,s.name,s.slug,s.status,s.description,s.image_url,s.city,s.venue_id,s.organizer_id,null::text address,null::text state_region,null::text country,s.updated_at from event_series s where p_kind='series' and (p_status is null or s.status=p_status) and (p_query='' or s.name ilike '%'||p_query||'%' or s.slug ilike '%'||p_query||'%')
 union all select 'organizer',o.id,o.name,o.slug,o.status,o.description,o.logo_url,o.primary_city,null::uuid,null::uuid,null::text,o.state_region,o.country,o.updated_at from organizers o where p_kind='organizer' and (p_status is null or o.status=p_status) and (p_query='' or o.name ilike '%'||p_query||'%' or o.slug ilike '%'||p_query||'%')
 union all select 'school',s.id,s.name,s.slug,s.status,s.description,s.image_url,s.city,null::uuid,null::uuid,s.address_line1,s.state_region,s.country,s.updated_at from schools s where p_kind='school' and (p_status is null or s.status=p_status) and (p_query='' or s.name ilike '%'||p_query||'%' or s.slug ilike '%'||p_query||'%')
 union all select 'instructor',i.id,i.name,i.slug,i.status,coalesce(i.description,i.organization),i.image_url,i.city,null::uuid,null::uuid,null::text,i.state_region,i.country,i.updated_at from instructors i where p_kind='instructor' and (p_status is null or i.status=p_status) and (p_query='' or i.name ilike '%'||p_query||'%' or i.slug ilike '%'||p_query||'%')
union all select 'dj',d.id,d.name,d.slug,d.status,d.description,d.image_url,d.city,null::uuid,null::uuid,null::text,d.state_region,d.country,d.updated_at from djs d where p_kind='dj' and (p_status is null or d.status=p_status) and (p_query='' or d.name ilike '%'||p_query||'%' or d.slug ilike '%'||p_query||'%')
 ) select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'name',r.name,'slug',r.slug,'status',r.status,'description',r.description,'image_url',r.image_url,'city',r.city,'website',case r.kind when 'organizer' then (select website from organizers where id=r.id) when 'school' then (select website from schools where id=r.id) when 'instructor' then (select website from instructors where id=r.id) when 'dj' then (select website from djs where id=r.id) else null end,'instagram',case r.kind when 'organizer' then (select instagram from organizers where id=r.id) when 'school' then (select instagram from schools where id=r.id) when 'instructor' then (select instagram from instructors where id=r.id) when 'dj' then (select instagram from djs where id=r.id) else null end,'address',r.address,'state_region',r.state_region,'country',r.country,'venue_id',r.venue_id,'organizer_id',r.organizer_id,'quality_issues','[]'::jsonb,'linked_events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'status',e.status,'event_date',e.event_date) order by e.event_date,e.id) from events e where e.status<>'deleted' and case r.kind when 'series' then e.series_id=r.id when 'organizer' then e.organizer_id=r.id when 'school' then exists(select 1 from event_schools es where es.event_id=e.id and es.school_id=r.id) when 'instructor' then exists(select 1 from event_instructors ei where ei.event_id=e.id and ei.instructor_id=r.id) when 'dj' then exists(select 1 from event_djs ed where ed.event_id=e.id and ed.dj_id=r.id) end),'[]'::jsonb)) order by r.name,r.id),'[]'::jsonb) into result from rows r;
 select coalesce(jsonb_agg(x.value||jsonb_build_object(
  'quality_issues',public.entity_access_quality_issues(x.value->>'kind',(x.value->>'id')::uuid),
  'phone',case when x.value->>'kind'='school' then (select phone from schools where id=(x.value->>'id')::uuid) end,
  'organization',case when x.value->>'kind'='instructor' then (select organization from instructors where id=(x.value->>'id')::uuid) end,
  'category',case when x.value->>'kind'='organizer' then (select organizer_type from organizers where id=(x.value->>'id')::uuid) end
 )),'[]'::jsonb) into result from jsonb_array_elements(result) x(value);
 return result;
end $$;

create or replace function public.admin_entity_save(p_kind text,p_id uuid default null,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; v_name text; v_slug text; v_city text; v_status text; v_existing_slug text;
begin
 if not public.is_admin() or not public.account_is_active(auth.uid()) then raise exception 'Administrator role required' using errcode='42501'; end if;
 if p_kind not in ('series','organizer','school','instructor','dj') or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid kind or payload' using errcode='22023'; end if;
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
  elsif p_kind='instructor' then select coalesce(v_name,name),coalesce(v_status,status),coalesce(v_city,city) into v_name,v_status,v_city from instructors where id=p_id;
  else select coalesce(v_name,name),coalesce(v_status,status),coalesce(v_city,city) into v_name,v_status,v_city from djs where id=p_id; end if;
  if v_name is null then raise exception 'Entity not found' using errcode='P0002'; end if;
 end if;
 if p_id is not null then
  if p_kind='series' then select slug into v_existing_slug from event_series where id=p_id;
  elsif p_kind='organizer' then select slug into v_existing_slug from organizers where id=p_id;
  elsif p_kind='school' then select slug into v_existing_slug from schools where id=p_id;
  elsif p_kind='instructor' then select slug into v_existing_slug from instructors where id=p_id;
  else select slug into v_existing_slug from djs where id=p_id; end if;
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
   or (p_kind='instructor' and exists(select 1 from instructors where slug=v_slug))
   or (p_kind='dj' and exists(select 1 from djs where slug=v_slug)) then
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
 elsif p_kind='instructor' then
  if v_status not in ('active','needs_review','archived') then raise exception 'Invalid status' using errcode='22023'; end if;
  if (p_id is null or p_payload ? 'name' or p_payload ? 'slug') and exists(select 1 from instructors x where x.id is distinct from p_id and (x.slug=v_slug or (public.flyer_norm_text(x.name)=public.flyer_norm_text(v_name) and x.city is not distinct from v_city))) then raise exception 'Duplicate or ambiguous instructor' using errcode='23505'; end if;
  if p_id is null then insert into instructors(name,slug,status,description,image_url,city,state_region,country,organization,website,instagram) values(v_name,v_slug,v_status,p_payload->>'description',p_payload->>'image_url',v_city,p_payload->>'state_region',p_payload->>'country',p_payload->>'organization',p_payload->>'website',p_payload->>'instagram') returning to_jsonb(instructors.*) into result;
  else update instructors set name=v_name,slug=v_slug,status=v_status,description=case when p_payload?'description' then p_payload->>'description' else description end,image_url=case when p_payload?'image_url' then p_payload->>'image_url' else image_url end,city=case when p_payload?'city' then v_city else city end,state_region=case when p_payload?'state_region' then p_payload->>'state_region' else state_region end,country=case when p_payload?'country' then p_payload->>'country' else country end,organization=case when p_payload?'organization' then p_payload->>'organization' else organization end,website=case when p_payload?'website' then p_payload->>'website' else website end,instagram=case when p_payload?'instagram' then p_payload->>'instagram' else instagram end where id=p_id returning to_jsonb(instructors.*) into result; end if;
 else
  if v_status not in ('active','needs_review','archived') then raise exception 'Invalid status' using errcode='22023'; end if;
  if (p_id is null or p_payload ? 'name' or p_payload ? 'slug') and exists(select 1 from djs x where x.id is distinct from p_id and (x.slug=v_slug or (public.flyer_norm_text(x.name)=public.flyer_norm_text(v_name) and x.city is not distinct from v_city))) then raise exception 'Duplicate or ambiguous DJ' using errcode='23505'; end if;
  if p_id is null then insert into djs(name,slug,status,description,image_url,city,state_region,country,website,instagram) values(v_name,v_slug,v_status,p_payload->>'description',p_payload->>'image_url',v_city,p_payload->>'state_region',p_payload->>'country',p_payload->>'website',p_payload->>'instagram') returning to_jsonb(djs.*) into result;
  else update djs set name=v_name,slug=v_slug,status=v_status,description=case when p_payload?'description' then p_payload->>'description' else description end,image_url=case when p_payload?'image_url' then p_payload->>'image_url' else image_url end,city=case when p_payload?'city' then v_city else city end,state_region=case when p_payload?'state_region' then p_payload->>'state_region' else state_region end,country=case when p_payload?'country' then p_payload->>'country' else country end,website=case when p_payload?'website' then p_payload->>'website' else website end,instagram=case when p_payload?'instagram' then p_payload->>'instagram' else instagram end where id=p_id returning to_jsonb(djs.*) into result; end if;
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
elsif p_kind='dj' then
 if not exists(select 1 from djs where id=p_keep_id and status<>'archived') or not exists(select 1 from djs where id=p_merge_id and status<>'archived') then raise exception 'DJ not found' using errcode='P0002'; end if;
 insert into event_djs(event_id,dj_id,position,created_at) select event_id,p_keep_id,position,created_at from event_djs where dj_id=p_merge_id on conflict(event_id,dj_id) do nothing;
 delete from event_djs where dj_id=p_merge_id;
 update djs set status='archived' where id=p_merge_id;
 else raise exception 'Unsupported entity kind' using errcode='22023'; end if;
 return jsonb_build_object('merged',true,'kind',p_kind,'keep_id',p_keep_id,'archived_id',p_merge_id);
end $$;

-- ------------------------------------------------------------
-- 5. Admin DJ <-> event linking
-- ------------------------------------------------------------

create or replace function public.admin_dj_set_event(p_dj_id uuid, p_event_id uuid, p_linked boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.djs where id = p_dj_id and status <> 'archived') then
    raise exception 'DJ not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if p_linked then
    insert into public.event_djs (event_id, dj_id, position)
    values (p_event_id, p_dj_id,
      (select coalesce(max(position) + 1, 0) from public.event_djs where event_id = p_event_id))
    on conflict (event_id, dj_id) do nothing;
  else
    delete from public.event_djs where event_id = p_event_id and dj_id = p_dj_id;
  end if;
end $$;

-- Approved events an admin can attach to a DJ: upcoming soonest first, then past most recent first.
create or replace function public.admin_dj_event_candidates(p_query text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_q text := btrim(coalesce(p_query, ''));
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'title', q.title, 'event_date', q.event_date, 'location', q.location
    ) order by q.past, q.upcoming_date, q.past_date desc, q.id)
    from (
      select e.id, e.title, e.event_date, e.location,
             e.event_date < now() as past,
             case when e.event_date >= now() then e.event_date end as upcoming_date,
             case when e.event_date < now() then e.event_date end as past_date
        from public.events e
       where e.status = 'approved'
         and (v_q = '' or e.title ilike '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%')
       order by e.event_date < now(),
                case when e.event_date >= now() then e.event_date end,
                e.event_date desc, e.id
       limit 20
    ) q), '[]'::jsonb);
end $$;

-- ------------------------------------------------------------
-- 6. Workspaces and claims
-- ------------------------------------------------------------


create or replace function public.entity_workspace_ref(p_kind text, p_id uuid)
returns table (name text, slug text, status text, city text, image_url text)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.name, s.slug, s.status, s.city, s.image_url from public.schools s where p_kind = 'school' and s.id = p_id
  union all
  select v.name, v.slug, v.status, v.city, null::text from public.venues v where p_kind = 'venue' and v.id = p_id
  union all
  select i.name, i.slug, i.status, i.city, i.image_url from public.instructors i where p_kind = 'instructor' and i.id = p_id
  union all
  select d.name, d.slug, d.status, d.city, d.image_url from public.djs d where p_kind = 'dj' and d.id = p_id;
$$;

create or replace function public.my_entity_memberships()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', m.entity_kind, 'id', m.entity_id, 'name', r.name, 'slug', r.slug,
      'status', r.status, 'city', r.city, 'image_url', r.image_url, 'member_role', m.member_role
    ) order by array_position(array['school', 'venue', 'instructor', 'dj'], m.entity_kind), r.name), '[]'::jsonb)
    from public.entity_members m
    cross join lateral public.entity_workspace_ref(m.entity_kind, m.entity_id) r
   where m.user_id = auth.uid() and m.status = 'active' and r.status <> 'archived'
     and public.account_is_active(auth.uid());
$$;

create or replace function public.entity_workspace(p_kind text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_role text := public.entity_workspace_require(p_kind, p_id, array['owner', 'manager', 'editor']);
  v_entity jsonb;
  v_offerings jsonb := null;
begin
  if p_kind = 'school' then
    select jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'status', s.status, 'city', s.city,
      'state_region', s.state_region, 'country', s.country, 'address_line1', s.address_line1, 'postal_code', s.postal_code,
      'website', s.website, 'instagram', s.instagram, 'phone', s.phone, 'description', s.description, 'image_url', s.image_url)
      into v_entity from public.schools s where s.id = p_id;
    select jsonb_build_object(
      'classes', coalesce((select jsonb_agg(jsonb_build_object(
          'id', c.id, 'title', c.title, 'style_term_id', c.style_term_id, 'style_name', t.name, 'level', c.level,
          'weekday', c.weekday, 'start_time', to_char(c.start_time, 'HH24:MI'), 'duration_minutes', c.duration_minutes,
          'instructor_id', c.instructor_id, 'instructor_name', coalesce(i.name, c.instructor_name), 'instructor_slug', i.slug,
          'room', c.room, 'drop_in_cents', c.drop_in_cents, 'notes', c.notes, 'status', c.status
        ) order by c.weekday, c.start_time, c.title)
        from public.school_classes c
        left join public.taxonomy_terms t on t.id = c.style_term_id
        left join public.instructors i on i.id = c.instructor_id and i.status = 'active'
       where c.school_id = p_id), '[]'::jsonb),
      'privates', coalesce((select jsonb_agg(jsonb_build_object(
          'id', o.id, 'title', o.title, 'duration_minutes', o.duration_minutes, 'price_cents', o.price_cents,
          'instructor_id', o.instructor_id, 'instructor_name', coalesce(i.name, o.instructor_name), 'instructor_slug', i.slug,
          'notes', o.notes, 'status', o.status, 'position', o.position
        ) order by o.position, o.created_at)
        from public.school_private_offers o
        left join public.instructors i on i.id = o.instructor_id and i.status = 'active'
       where o.school_id = p_id), '[]'::jsonb),
      'plans', coalesce((select jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name, 'plan_type', p.plan_type, 'price_cents', p.price_cents, 'class_count', p.class_count,
          'valid_days', p.valid_days, 'notes', p.notes, 'status', p.status, 'position', p.position
        ) order by p.position, p.created_at)
        from public.school_price_plans p where p.school_id = p_id), '[]'::jsonb)
    ) into v_offerings;
  elsif p_kind = 'venue' then
    select jsonb_build_object('id', v.id, 'name', v.name, 'slug', v.slug, 'status', v.status, 'city', v.city,
      'state_region', v.state_region, 'country', v.country, 'address_line1', v.address_line1, 'address_line2', v.address_line2,
      'postal_code', v.postal_code, 'website', v.website, 'instagram', v.instagram, 'phone', v.phone)
      into v_entity from public.venues v where v.id = p_id;
  elsif p_kind = 'instructor' then
    select jsonb_build_object('id', i.id, 'name', i.name, 'slug', i.slug, 'status', i.status, 'city', i.city,
      'state_region', i.state_region, 'country', i.country, 'organization', i.organization, 'website', i.website,
      'instagram', i.instagram, 'description', i.description, 'image_url', i.image_url)
      into v_entity from public.instructors i where i.id = p_id;
  elsif p_kind = 'dj' then
    select jsonb_build_object('id', d.id, 'name', d.name, 'slug', d.slug, 'status', d.status, 'city', d.city,
      'state_region', d.state_region, 'country', d.country, 'website', d.website,
      'instagram', d.instagram, 'description', d.description, 'image_url', d.image_url)
      into v_entity from public.djs d where d.id = p_id;
  end if;

  return jsonb_build_object(
    'kind', p_kind,
    'role', v_role,
    'entity', v_entity,
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'email', u.email, 'display_name', pr.display_name,
        'member_role', m.member_role, 'created_at', m.created_at
      ) order by array_position(array['owner', 'manager', 'editor'], m.member_role), m.created_at)
      from public.entity_members m
      join auth.users u on u.id = m.user_id
      left join public.profiles pr on pr.id = m.user_id
     where m.entity_kind = p_kind and m.entity_id = p_id and m.status = 'active'), '[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(q.summary order by q.event_date)
      from (select public.entity_access_event_summary(x) as summary, x.event_date
              from public.entity_access_events(p_kind, p_id) x
             where x.event_date >= now() order by x.event_date limit 8) q), '[]'::jsonb),
    'offerings', v_offerings
  );
end $$;

create or replace function public.entity_profile_save(p_kind text, p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_allowed text[];
  v_key text;
begin
  perform public.entity_workspace_require(p_kind, p_id, array['owner', 'manager']);
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = '22023';
  end if;
  v_allowed := case p_kind
    when 'school' then array['description', 'image_url', 'website', 'instagram', 'phone', 'address_line1', 'postal_code']
    when 'venue' then array['website', 'instagram', 'phone', 'address_line1', 'address_line2', 'postal_code']
    when 'instructor' then array['description', 'image_url', 'website', 'instagram', 'organization']
    when 'dj' then array['description', 'image_url', 'website', 'instagram']
  end;
  for v_key in select jsonb_object_keys(p_payload) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'Field % cannot be edited here', v_key using errcode = '22023';
    end if;
  end loop;

  if p_kind = 'school' then
    update public.schools set
      description   = case when p_payload ? 'description'   then nullif(btrim(p_payload->>'description'), '')   else description end,
      image_url     = case when p_payload ? 'image_url'     then nullif(btrim(p_payload->>'image_url'), '')     else image_url end,
      website       = case when p_payload ? 'website'       then nullif(btrim(p_payload->>'website'), '')       else website end,
      instagram     = case when p_payload ? 'instagram'     then nullif(btrim(p_payload->>'instagram'), '')     else instagram end,
      phone         = case when p_payload ? 'phone'         then nullif(btrim(p_payload->>'phone'), '')         else phone end,
      address_line1 = case when p_payload ? 'address_line1' then nullif(btrim(p_payload->>'address_line1'), '') else address_line1 end,
      postal_code   = case when p_payload ? 'postal_code'   then nullif(btrim(p_payload->>'postal_code'), '')   else postal_code end,
      updated_at    = now()
     where id = p_id;
  elsif p_kind = 'venue' then
    update public.venues set
      website       = case when p_payload ? 'website'       then nullif(btrim(p_payload->>'website'), '')       else website end,
      instagram     = case when p_payload ? 'instagram'     then nullif(btrim(p_payload->>'instagram'), '')     else instagram end,
      phone         = case when p_payload ? 'phone'         then nullif(btrim(p_payload->>'phone'), '')         else phone end,
      address_line1 = case when p_payload ? 'address_line1' then nullif(btrim(p_payload->>'address_line1'), '') else address_line1 end,
      address_line2 = case when p_payload ? 'address_line2' then nullif(btrim(p_payload->>'address_line2'), '') else address_line2 end,
      postal_code   = case when p_payload ? 'postal_code'   then nullif(btrim(p_payload->>'postal_code'), '')   else postal_code end,
      updated_at    = now()
     where id = p_id;
  elsif p_kind = 'instructor' then
    update public.instructors set
      description  = case when p_payload ? 'description'  then nullif(btrim(p_payload->>'description'), '')  else description end,
      image_url    = case when p_payload ? 'image_url'    then nullif(btrim(p_payload->>'image_url'), '')    else image_url end,
      website      = case when p_payload ? 'website'      then nullif(btrim(p_payload->>'website'), '')      else website end,
      instagram    = case when p_payload ? 'instagram'    then nullif(btrim(p_payload->>'instagram'), '')    else instagram end,
      organization = case when p_payload ? 'organization' then nullif(btrim(p_payload->>'organization'), '') else organization end,
      updated_at   = now()
     where id = p_id;
  elsif p_kind = 'dj' then
    update public.djs set
      description  = case when p_payload ? 'description'  then nullif(btrim(p_payload->>'description'), '')  else description end,
      image_url    = case when p_payload ? 'image_url'    then nullif(btrim(p_payload->>'image_url'), '')    else image_url end,
      website      = case when p_payload ? 'website'      then nullif(btrim(p_payload->>'website'), '')      else website end,
      instagram    = case when p_payload ? 'instagram'    then nullif(btrim(p_payload->>'instagram'), '')    else instagram end,
      updated_at   = now()
     where id = p_id;
  end if;
end $$;

create or replace function public.entity_claim_submit(p_kind text, p_id uuid, p_relationship text, p_message text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.account_is_active(auth.uid()) then
    raise exception 'Sign in to claim a listing.' using errcode = '42501';
  end if;
  if p_kind not in ('school', 'venue', 'instructor', 'dj') then
    raise exception 'This kind of listing cannot be claimed.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.entity_workspace_ref(p_kind, p_id) r where r.status = 'active') then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.entity_members
     where entity_kind = p_kind and entity_id = p_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'You already manage this listing.' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.entity_claims
     where entity_kind = p_kind and entity_id = p_id and user_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'Your claim for this listing is already waiting for review.' using errcode = '23505';
  end if;
  insert into public.entity_claims (entity_kind, entity_id, user_id, relationship, message)
  values (p_kind, p_id, auth.uid(), p_relationship, nullif(btrim(p_message), ''))
  returning id into v_id;
  return v_id;
end $$;

-- ------------------------------------------------------------
-- 7. Grants (same as the originals)
-- ------------------------------------------------------------

revoke all on function public.entity_access_public_ref(text,uuid) from public,anon,authenticated;
revoke all on function public.entity_access_events(text,uuid) from public,anon,authenticated;
revoke all on function public.entity_access_related(text,uuid) from public,anon,authenticated;
revoke all on function public.public_entity_detail(text,text) from public,anon,authenticated;
revoke all on function public.public_entity_directory(text,text,text,int,int) from public,anon,authenticated;
revoke all on function public.public_event_entities(uuid) from public,anon,authenticated;
grant execute on function public.public_entity_detail(text,text),public.public_entity_directory(text,text,text,int,int),public.public_event_entities(uuid) to anon,authenticated;
revoke all on function public.entity_access_quality_issues(text,uuid) from public,anon,authenticated;
revoke all on function public.entity_access_guard_delete() from public,anon,authenticated;
revoke all on function public.admin_entity_directory(text,text,text),public.admin_entity_save(text,uuid,jsonb),public.admin_entity_merge(text,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_entity_directory(text,text,text),public.admin_entity_save(text,uuid,jsonb),public.admin_entity_merge(text,uuid,uuid,boolean) to authenticated;

revoke all on function public.entity_workspace_ref(text, uuid) from public, anon, authenticated;
revoke all on function
  public.my_entity_memberships(),
  public.entity_workspace(text, uuid),
  public.entity_profile_save(text, uuid, jsonb),
  public.entity_claim_submit(text, uuid, text, text),
  public.admin_dj_set_event(uuid, uuid, boolean),
  public.admin_dj_event_candidates(text)
from public, anon, authenticated;
grant execute on function
  public.my_entity_memberships(),
  public.entity_workspace(text, uuid),
  public.entity_profile_save(text, uuid, jsonb),
  public.entity_claim_submit(text, uuid, text, text),
  public.admin_dj_set_event(uuid, uuid, boolean),
  public.admin_dj_event_candidates(text)
to authenticated;

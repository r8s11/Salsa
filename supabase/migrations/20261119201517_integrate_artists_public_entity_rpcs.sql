-- Applied to production outside the repo (recorded as 20261119201517_integrate_artists_public_entity_rpcs).
-- Statements copied verbatim from supabase_migrations.schema_migrations so fresh databases match production.
CREATE OR REPLACE FUNCTION public.entity_access_public_ref(p_kind text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r jsonb;
begin
  case p_kind
  when 'series' then select jsonb_build_object('kind',p_kind,'id',s.id,'name',s.name,'slug',s.slug,'description',s.description,'image_url',s.image_url,'city',s.city,'state_region',null,'country',null,'address',null,'website',null,'instagram',null,'origin',null,'category',null) into r from event_series s where s.id=p_id and s.status='active';
  when 'organizer' then select jsonb_build_object('kind',p_kind,'id',o.id,'name',o.name,'slug',o.slug,'description',o.description,'image_url',o.logo_url,'city',o.primary_city,'state_region',o.state_region,'country',o.country,'address',null,'website',o.website,'instagram',o.instagram,'origin',null,'category',o.organizer_type) into r from organizers o where o.id=p_id and o.status='active';
  when 'venue' then select jsonb_build_object('kind',p_kind,'id',v.id,'name',v.name,'slug',v.slug,'description',null,'image_url',null,'city',v.city,'state_region',v.state_region,'country',v.country,'address',v.address_line1,'website',v.website,'instagram',v.instagram,'origin',null,'category',null) into r from venues v where v.id=p_id and v.status='active';
  when 'school' then select jsonb_build_object('kind',p_kind,'id',s.id,'name',s.name,'slug',s.slug,'description',s.description,'image_url',s.image_url,'city',s.city,'state_region',s.state_region,'country',s.country,'address',s.address_line1,'website',s.website,'instagram',s.instagram,'origin',null,'category',null) into r from schools s where s.id=p_id and s.status='active';
  when 'instructor' then select jsonb_build_object('kind',p_kind,'id',i.id,'name',i.name,'slug',i.slug,'description',coalesce(i.description,i.organization),'image_url',i.image_url,'city',i.city,'state_region',i.state_region,'country',i.country,'address',null,'website',i.website,'instagram',i.instagram,'origin',null,'category',null) into r from instructors i where i.id=p_id and i.status='active';
  when 'artist' then select jsonb_build_object('kind',p_kind,'id',a.id,'name',a.name,'slug',a.slug,'description',a.description,'image_url',a.image_url,'city',a.city,'state_region',a.state_region,'country',a.country,'address',null,'website',a.website,'instagram',a.instagram,'origin',null,'category',a.roles[1]) into r from public.artists a where a.id=p_id and a.status='active';
  when 'dj' then select jsonb_build_object('kind',p_kind,'id',d.id,'name',d.name,'slug',d.slug,'description',d.description,'image_url',d.image_url,'city',d.city,'state_region',d.state_region,'country',d.country,'address',null,'website',d.website,'instagram',d.instagram,'origin',null,'category',null) into r from djs d where d.id=p_id and d.status='active';
  when 'city' then select jsonb_build_object('kind',p_kind,'id',m.id,'name',m.name,'slug',m.slug,'description',null,'image_url',null,'city',m.slug,'state_region',m.state_region,'country',m.country_code,'address',null,'website',null,'instagram',null,'origin',null,'category',null) into r from metros m where m.id=p_id and m.status='active';
  when 'style' then select jsonb_build_object('kind',p_kind,'id',t.id,'name',t.name,'slug',t.slug,'description',t.description,'image_url',null,'city',null,'state_region',null,'country',null,'address',null,'website',null,'instagram',null,'origin',null,'category',t.category) into r from taxonomy_terms t where t.id=p_id and t.status='active';
  when 'event' then select jsonb_build_object('kind',p_kind,'id',e.id,'name',e.title,'slug',e.slug,'description',e.description,'image_url',coalesce(e.image_url,e.poster_image_url),'city',e.city,'state_region',null,'country',null,'address',e.address,'website',null,'instagram',null,'origin',null,'category',e.event_type,'event_date',e.event_date) into r from events e where e.id=p_id and e.status='approved';
  else return null;
  end case;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.entity_access_events(p_kind text, p_id uuid)
 RETURNS SETOF events
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select e.* from events e
 where e.status='approved' and case p_kind
  when 'event' then e.id=p_id
  when 'series' then e.series_id=p_id
  when 'organizer' then e.organizer_id=p_id
  when 'venue' then e.venue_id=p_id
  when 'school' then exists(select 1 from event_schools es where es.event_id=e.id and es.school_id=p_id)
  when 'instructor' then exists(select 1 from event_instructors ei where ei.event_id=e.id and ei.instructor_id=p_id)
  when 'artist' then exists(select 1 from public.event_artists ea where ea.event_id=e.id and ea.artist_id=p_id)
  when 'dj' then exists(select 1 from event_djs ed where ed.event_id=e.id and ed.dj_id=p_id)
  when 'city' then e.city=(select m.slug from metros m where m.id=p_id and m.status='active')
  when 'style' then exists(select 1 from event_taxonomy_terms ett join taxonomy_terms t on t.id=ett.taxonomy_term_id where ett.event_id=e.id and ett.taxonomy_term_id=p_id and t.status='active')
  else false end
$function$;

CREATE OR REPLACE FUNCTION public.entity_access_related(p_kind text, p_id uuid)
 RETURNS TABLE(ref jsonb, name text, id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 with linked_events as materialized (
  select e.id,e.series_id,e.venue_id,e.organizer_id,e.city
  from events e where e.status='approved' and case p_kind
   when 'event' then e.id=p_id
   when 'series' then e.series_id=p_id
   when 'organizer' then e.organizer_id=p_id
   when 'venue' then e.venue_id=p_id
   when 'school' then exists(select 1 from event_schools es where es.event_id=e.id and es.school_id=p_id)
   when 'instructor' then exists(select 1 from event_instructors ei where ei.event_id=e.id and ei.instructor_id=p_id)
   when 'artist' then exists(select 1 from public.event_artists ea where ea.event_id=e.id and ea.artist_id=p_id)
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
  union all select public.entity_access_public_ref('artist',ea.artist_id) from linked_events le join public.event_artists ea on ea.event_id=le.id where p_kind<>'artist' or ea.artist_id<>p_id
  union all select public.entity_access_public_ref('dj',ed.dj_id) from linked_events le join event_djs ed on ed.event_id=le.id where p_kind<>'dj' or ed.dj_id<>p_id
  union all select public.entity_access_public_ref('style',et.taxonomy_term_id) from linked_events le join event_taxonomy_terms et on et.event_id=le.id join taxonomy_terms t on t.id=et.taxonomy_term_id where t.status='active'
  union all select public.entity_access_public_ref('event',le.id) from linked_events le where p_kind='style'
  union all select public.entity_access_public_ref('venue',s.venue_id) from event_series s where p_kind='series' and s.id=p_id and s.status='active' and s.venue_id is not null
  union all select public.entity_access_public_ref('organizer',s.organizer_id) from event_series s where p_kind='series' and s.id=p_id and s.status='active' and s.organizer_id is not null
  union all select public.entity_access_public_ref('series',s.id) from event_series s where p_kind='organizer' and s.organizer_id=p_id and s.status='active'
 )
 select distinct refs.ref,refs.ref->>'name',refs.ref->>'id' from refs where refs.ref is not null
$function$;

CREATE OR REPLACE FUNCTION public.public_entity_directory(p_kind text DEFAULT NULL::text, p_query text DEFAULT ''::text, p_city text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare result jsonb;
begin
  if p_kind is not null and p_kind not in
    ('event','series','organizer','venue','school','instructor','artist','dj','city','style')
  then return '[]'::jsonb; end if;
  if coalesce(p_limit,50)<1 or coalesce(p_offset,0)<0 then
    raise exception 'invalid pagination' using errcode='22023';
  end if;
  with candidates as (
    select 'event' k,e.id,e.title n,e.slug,e.city c,e.description d,e.city metro from events e where e.status='approved'
    union all select 'series',s.id,s.name,s.slug,s.city,s.description,s.city from event_series s where s.status='active'
    union all select 'organizer',o.id,o.name,o.slug,o.primary_city,o.description,o.primary_city from organizers o where o.status='active'
    union all select 'venue',v.id,v.name,v.slug,v.city,null::text,v.city from venues v where v.status='active'
    union all select 'school',s.id,s.name,s.slug,s.city,s.description,s.metro_slug from public.public_schools s
    union all select 'instructor',i.id,i.name,i.slug,i.city,i.description,i.metro_slug from public.public_instructors i
    union all select 'artist',a.id,a.name,a.slug,a.city,a.description,a.metro_slug from public.public_artists a
    union all select 'dj',d.id,d.name,d.slug,d.city,d.description,d.metro_slug from public.public_djs d
    union all select 'city',m.id,m.name,m.slug,m.slug,null::text,m.slug from metros m where m.status='active'
    union all select 'style',t.id,t.name,t.slug,null::text,t.description,null::text from taxonomy_terms t where t.status='active'
  ), refs as (
    select c.k,c.n,c.slug,c.id,public.entity_access_public_ref(c.k,c.id) ref
    from candidates c
    where (p_kind is null or p_kind=c.k)
      and (coalesce(p_query,'')='' or c.n ilike '%'||coalesce(p_query,'')||'%' or coalesce(c.d,'') ilike '%'||coalesce(p_query,'')||'%')
      and (p_city is null or c.metro=p_city or c.c=p_city
        or exists(select 1 from public.entity_access_events(c.k,c.id) e where e.city=p_city))
  )
  select coalesce(jsonb_agg(q.ref order by q.k,q.n,q.id),'[]'::jsonb)
    into result
  from (
    select k,n,id,ref from refs where ref is not null
    order by k,n,id offset coalesce(p_offset,0) limit least(coalesce(p_limit,50),100)
  ) q;
  return result;
end $function$;

CREATE OR REPLACE FUNCTION public.public_entity_detail(p_kind text, p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    when 'artist' then select id into v_id from public.artists where slug=p_slug and status='active';
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
end $function$;

CREATE OR REPLACE FUNCTION public.public_event_entities(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare result jsonb;
begin
 select jsonb_build_object(
 'venue',public.entity_access_public_ref('venue',e.venue_id),
 'organizer',public.entity_access_public_ref('organizer',e.organizer_id),
 'school',coalesce((select public.entity_access_public_ref('school',es.school_id) from event_schools es join schools s on s.id=es.school_id where es.event_id=e.id and s.status='active' order by es.created_at limit 1),null),
 'schools',coalesce((select jsonb_agg(public.entity_access_public_ref('school',es.school_id) order by s.name) from event_schools es join schools s on s.id=es.school_id where es.event_id=e.id and s.status='active'),'[]'::jsonb),
 'instructors',coalesce((select jsonb_agg(public.entity_access_public_ref('instructor',ei.instructor_id) order by ei.position,ei.instructor_id) from event_instructors ei join instructors i on i.id=ei.instructor_id where ei.event_id=e.id and i.status='active'),'[]'::jsonb),
 'djs',coalesce((select jsonb_agg(public.entity_access_public_ref('dj',ed.dj_id) order by ed.position,ed.dj_id) from event_djs ed join djs d on d.id=ed.dj_id where ed.event_id=e.id and d.status='active'),'[]'::jsonb),
 'artists',coalesce((select jsonb_agg(public.entity_access_public_ref('artist',ea.artist_id) order by ea.position,ea.artist_id) from public.event_artists ea join public.artists a on a.id=ea.artist_id where ea.event_id=e.id and a.status='active'),'[]'::jsonb),
 'series',public.entity_access_public_ref('series',e.series_id),
 'city',(select public.entity_access_public_ref('city',m.id) from metros m where m.slug=e.city),
 'styles',coalesce((select jsonb_agg(public.entity_access_public_ref('style',ett.taxonomy_term_id) order by t.display_order,t.name) from event_taxonomy_terms ett join taxonomy_terms t on t.id=ett.taxonomy_term_id where ett.event_id=e.id and t.category='dance_style' and t.status='active'),'[]'::jsonb)) into result from events e where e.id=p_event_id and e.status='approved';
 return result;
end $function$;

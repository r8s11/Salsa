CREATE OR REPLACE FUNCTION public.admin_entity_save(p_kind text, p_id uuid DEFAULT NULL::uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare result jsonb; v_name text; v_slug text; v_city text; v_status text; v_existing_slug text;
begin
 if not public.is_admin() or not public.account_is_active(auth.uid()) then raise exception 'Administrator role required' using errcode='42501'; end if;
 if p_kind not in ('series','organizer','school','instructor','dj') or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid kind or payload' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_payload) as keys(key) where key not in ('name','slug','description','image_url','status','city','venue_id','organizer_id','website','instagram','address','address_line1','phone','state_region','country','organization','category','organizer_type','primary_city','metro_slug','borough')) then raise exception 'Unsupported entity field' using errcode='22023'; end if;
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
  if p_payload ? 'metro_slug' and nullif(p_payload->>'metro_slug','') is not null
     and not exists(select 1 from public.metros m where m.slug=p_payload->>'metro_slug' and m.status='active')
  then raise exception 'Unknown metropolitan area' using errcode='22023'; end if;
  if p_payload ? 'borough' and nullif(p_payload->>'borough','') is not null
     and (coalesce(nullif(p_payload->>'metro_slug',''),(select metro_slug from public.schools where id=p_id)) is distinct from 'new-york-city'
       or p_payload->>'borough' not in ('manhattan','brooklyn','queens','bronx','staten-island'))
  then raise exception 'Invalid NYC borough for metropolitan area' using errcode='22023'; end if;
  if v_status not in ('active','needs_review','archived') then raise exception 'Invalid status' using errcode='22023'; end if;
  if (p_id is null or p_payload ? 'name' or p_payload ? 'slug') and exists(select 1 from schools x where x.id is distinct from p_id and (x.slug=v_slug or (public.flyer_norm_text(x.name)=public.flyer_norm_text(v_name) and x.city is not distinct from v_city))) then raise exception 'Duplicate or ambiguous school' using errcode='23505'; end if;
  if p_id is null then insert into schools(name,slug,status,description,image_url,city,state_region,country,address_line1,website,instagram,phone,metro_slug,borough) values(v_name,v_slug,v_status,p_payload->>'description',p_payload->>'image_url',v_city,p_payload->>'state_region',p_payload->>'country',coalesce(p_payload->>'address',p_payload->>'address_line1'),p_payload->>'website',p_payload->>'instagram',p_payload->>'phone',nullif(p_payload->>'metro_slug',''),nullif(p_payload->>'borough','')) returning to_jsonb(schools.*) into result;
  else update schools set name=v_name,slug=v_slug,status=v_status,description=case when p_payload?'description' then p_payload->>'description' else description end,image_url=case when p_payload?'image_url' then p_payload->>'image_url' else image_url end,city=case when p_payload?'city' then v_city else city end,state_region=case when p_payload?'state_region' then p_payload->>'state_region' else state_region end,country=case when p_payload?'country' then p_payload->>'country' else country end,address_line1=case when p_payload?'address' then p_payload->>'address' when p_payload?'address_line1' then p_payload->>'address_line1' else address_line1 end,website=case when p_payload?'website' then p_payload->>'website' else website end,instagram=case when p_payload?'instagram' then p_payload->>'instagram' else instagram end,phone=case when p_payload?'phone' then p_payload->>'phone' else phone end,metro_slug=case when p_payload?'metro_slug' then nullif(p_payload->>'metro_slug','') else metro_slug end,borough=case when p_payload?'borough' then nullif(p_payload->>'borough','') when p_payload?'metro_slug' and nullif(p_payload->>'metro_slug','') is distinct from metro_slug then null else borough end where id=p_id returning to_jsonb(schools.*) into result; end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.admin_entity_directory(p_kind text, p_query text DEFAULT ''::text, p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
 ) select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'name',r.name,'slug',r.slug,'status',r.status,'description',r.description,'image_url',r.image_url,'city',r.city,'website',case r.kind when 'organizer' then (select website from organizers where id=r.id) when 'school' then (select website from schools where id=r.id) when 'instructor' then (select website from instructors where id=r.id) when 'dj' then (select website from djs where id=r.id) else null end,'instagram',case r.kind when 'organizer' then (select instagram from organizers where id=r.id) when 'school' then (select instagram from schools where id=r.id) when 'instructor' then (select instagram from instructors where id=r.id) when 'dj' then (select instagram from djs where id=r.id) else null end,'address',r.address,'metro_slug',case when r.kind='school' then (select metro_slug from public.schools where id=r.id) end,'borough',case when r.kind='school' then (select borough from public.schools where id=r.id) end,'state_region',r.state_region,'country',r.country,'venue_id',r.venue_id,'organizer_id',r.organizer_id,'quality_issues','[]'::jsonb,'linked_events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'status',e.status,'event_date',e.event_date) order by e.event_date,e.id) from events e where e.status<>'deleted' and case r.kind when 'series' then e.series_id=r.id when 'organizer' then e.organizer_id=r.id when 'school' then exists(select 1 from event_schools es where es.event_id=e.id and es.school_id=r.id) when 'instructor' then exists(select 1 from event_instructors ei where ei.event_id=e.id and ei.instructor_id=r.id) when 'dj' then exists(select 1 from event_djs ed where ed.event_id=e.id and ed.dj_id=r.id) end),'[]'::jsonb)) order by r.name,r.id),'[]'::jsonb) into result from rows r;
 select coalesce(jsonb_agg(x.value||jsonb_build_object(
  'quality_issues',public.entity_access_quality_issues(x.value->>'kind',(x.value->>'id')::uuid),
  'phone',case when x.value->>'kind'='school' then (select phone from schools where id=(x.value->>'id')::uuid) end,
  'organization',case when x.value->>'kind'='instructor' then (select organization from instructors where id=(x.value->>'id')::uuid) end,
  'category',case when x.value->>'kind'='organizer' then (select organizer_type from organizers where id=(x.value->>'id')::uuid) end
 )),'[]'::jsonb) into result from jsonb_array_elements(result) x(value);
 return result;
end $function$;

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
  when 'school' then select jsonb_build_object('kind',p_kind,'id',s.id,'name',s.name,'slug',s.slug,'description',s.description,'image_url',s.image_url,'city',s.city,'state_region',s.state_region,'country',s.country,'address',s.address_line1,'website',s.website,'instagram',s.instagram,'metro_slug',s.metro_slug,'borough',s.borough,'origin',null,'category',null) into r from schools s where s.id=p_id and s.status='active';
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
-- Keep the existing directory RPC contract used by /schools, /instructors and /discover.
-- Schools and teachers now originate from the explicit public views and use metro
-- normalized filters, without exposing raw tables or weakening RLS.
create or replace function public.public_entity_directory(
  p_kind text default null,
  p_query text default '',
  p_city text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if p_kind is not null and p_kind not in
    ('event','series','organizer','venue','school','instructor','dj','city','style')
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
    union all select 'dj',d.id,d.name,d.slug,d.city,d.description,d.city from djs d where d.status='active'
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
end $$;

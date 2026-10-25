-- Phase 4: canonical entity inventory and operational intelligence only.
-- No changes to public projections, policies, collection, or earlier analytics RPCs.
create or replace function public.admin_analytics_entity_performance(
  from_date timestamptz default null, to_date timestamptz default null,
  organizer_sort text default 'upcoming_events', venue_sort text default 'upcoming_events',
  organizer_offset integer default 0, venue_offset integer default 0, page_size integer default 25
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_today timestamptz := pg_catalog.date_trunc('day',v_now at time zone 'America/New_York') at time zone 'America/New_York';
  v_organizers jsonb; v_venues jsonb; v_coverage jsonb; v_quality jsonb; v_rows jsonb;
  v_organizers_touches jsonb; v_venues_touches jsonb;
  v_first_touch timestamptz; v_engagement_available boolean := false;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'admin' then
    raise exception 'admin role required' using errcode='42501';
  end if;
  if (from_date is null) <> (to_date is null) or (from_date is not null and from_date >= to_date)
    or organizer_sort is null or organizer_sort not in ('upcoming_events','total_events','detail_views','rsvp_clicks','ticket_clicks')
    or venue_sort is null or venue_sort not in ('upcoming_events','total_events','detail_views','rsvp_clicks')
    or organizer_offset is null or organizer_offset<0 or venue_offset is null or venue_offset<0
    or page_size is null or page_size<1 or page_size>100 then
    raise exception 'invalid entity analytics parameters' using errcode='22023';
  end if;

  -- Phase 3 may not be deployed. Missing/untracked history must not block inventory.
  begin
    if pg_catalog.to_regprocedure('public.admin_event_engagement(timestamptz,timestamptz,text)') is not null then
      select min(touched_at) into v_first_touch from public.event_touches;
      v_engagement_available:=v_first_touch is not null and (to_date is null or to_date>v_first_touch);
      if v_engagement_available then
        with grouped as (
          select e.organizer_id as id,count(*) filter(where t.kind='view') as detail_views,
            count(*) filter(where t.kind='rsvp_click') as rsvp_clicks,
            count(*) filter(where t.kind='ticket_click') as ticket_clicks,count(*) filter(where t.kind='share') as shares
          from public.event_touches t join public.events e on e.id=t.event_id
          where e.organizer_id is not null and (from_date is null or (t.touched_at>=from_date and t.touched_at<to_date))
          group by e.organizer_id
        ) select coalesce(jsonb_object_agg(id::text,to_jsonb(g)-'id'),'{}'::jsonb) into v_organizers_touches from grouped g;
        with grouped as (
          select e.venue_id as id,count(*) filter(where t.kind='view') as detail_views,
            count(*) filter(where t.kind='rsvp_click') as rsvp_clicks,
            count(*) filter(where t.kind='ticket_click') as ticket_clicks,count(*) filter(where t.kind='share') as shares
          from public.event_touches t join public.events e on e.id=t.event_id
          where e.venue_id is not null and (from_date is null or (t.touched_at>=from_date and t.touched_at<to_date))
          group by e.venue_id
        ) select coalesce(jsonb_object_agg(id::text,to_jsonb(g)-'id'),'{}'::jsonb) into v_venues_touches from grouped g;
      end if;
    end if;
  exception when others then v_engagement_available:=false; v_first_touch:=null;
  end;

  -- organizers: source failures do not erase the other entity's inventory.
  begin
    with counts as (
      select e.organizer_id as id, count(*) as total_events,
        count(*) filter (where e.status='approved' and e.event_date >= v_today) as upcoming_events,
        count(*) filter (where e.status='approved' and e.event_date < v_today) as past_events,
        count(*) filter (where from_date is null or (e.created_at >= from_date and e.created_at < to_date)) as created_events,
        max(e.event_date) as latest_scheduled_at,
        max(e.event_date) filter (where e.status='approved' and e.event_date < v_today) as last_occurred_at
      from public.events e where e.organizer_id is not null group by e.organizer_id
    ), all_rows as (
      select x.id,x.name,null::text as city,x.status,x.created_at,
        coalesce(c.total_events,0) as total_events,coalesce(c.upcoming_events,0) as upcoming_events,
        coalesce(c.past_events,0) as past_events,coalesce(c.created_events,0) as created_events,
        c.latest_scheduled_at,c.last_occurred_at,
        case when v_engagement_available then coalesce(v_organizers_touches->x.id::text,
          '{"detail_views":0,"rsvp_clicks":0,"ticket_clicks":0,"shares":0}'::jsonb) else null end as engagement
      from public.organizers x left join counts c on c.id=x.id
    ), ranked as (
      select * from all_rows order by
        case organizer_sort when 'upcoming_events' then upcoming_events when 'total_events' then total_events
          when 'detail_views' then (engagement->>'detail_views')::bigint
          when 'rsvp_clicks' then (engagement->>'rsvp_clicks')::bigint
          when 'ticket_clicks' then (engagement->>'ticket_clicks')::bigint end desc nulls last,
        name asc,id asc limit page_size offset organizer_offset
    ), page_rows as (
      select r.*, row_number() over (order by
        case organizer_sort when 'upcoming_events' then upcoming_events when 'total_events' then total_events
          when 'detail_views' then (engagement->>'detail_views')::bigint
          when 'rsvp_clicks' then (engagement->>'rsvp_clicks')::bigint
          when 'ticket_clicks' then (engagement->>'ticket_clicks')::bigint end desc nulls last,name,id) as position
      from ranked r
    )
    select jsonb_build_object('total',(select count(*) from all_rows),
      'active',(select count(*) from all_rows where upcoming_events>0),
      'created',(select count(*) from all_rows where from_date is null or (created_at >= from_date and created_at < to_date)),
      'offset',organizer_offset,'page_size',page_size,
      'rows',coalesce((select jsonb_agg(jsonb_build_object(
        'id',id,'name',name,'city',city,'status',status,'total_events',total_events,'upcoming_events',upcoming_events,
        'past_events',past_events,'created_events',created_events,'latest_scheduled_at',latest_scheduled_at,
        'last_occurred_at',last_occurred_at,'last_published_at',null,'engagement',engagement,
        'related',null,'related_total',null,'metros',null,'metro_total',null,'styles',null,'style_total',null
      ) order by position) from page_rows),'[]'::jsonb)) into v_organizers;
  exception when others then v_organizers:=null;
  end;

  -- Bounded canonical collaboration previews, independently unavailable.
  if v_organizers is not null then
    begin
      select coalesce(jsonb_agg(r || jsonb_build_object(
        'related_total',(select count(distinct e.venue_id) from public.events e where e.organizer_id=(r->>'id')::uuid),
        'related',coalesce((select jsonb_agg(to_jsonb(p) order by event_count desc,name,id) from (
          select x.id,x.name,count(*) as event_count from public.events e
          join public.venues x on x.id=e.venue_id where e.organizer_id=(r->>'id')::uuid
          group by x.id,x.name order by count(*) desc,x.name,x.id limit 10
        ) p),'[]'::jsonb)
      ) order by ord),'[]'::jsonb) into v_rows from jsonb_array_elements(v_organizers->'rows') with ordinality as a(r,ord);
      v_organizers:=jsonb_set(v_organizers,'{rows}',v_rows);
    exception when others then null; -- Preserve the inventory; null previews signal unavailable relationships.
    end;
    begin
      select coalesce(jsonb_agg(r || jsonb_build_object(
        'metro_total',(select count(distinct m.slug) from public.events e join public.metros m on m.slug=e.city
          where e.organizer_id=(r->>'id')::uuid and e.status='approved' and e.event_date>=v_today),
        'metros',coalesce((select jsonb_agg(to_jsonb(p) order by upcoming_events desc,slug) from (
          select m.slug,m.name,count(*) as upcoming_events from public.events e join public.metros m on m.slug=e.city
          where e.organizer_id=(r->>'id')::uuid and e.status='approved' and e.event_date>=v_today
          group by m.slug,m.name order by count(*) desc,m.slug limit 10
        ) p),'[]'::jsonb)
      ) order by ord),'[]'::jsonb) into v_rows from jsonb_array_elements(v_organizers->'rows') with ordinality as a(r,ord);
      v_organizers:=jsonb_set(v_organizers,'{rows}',v_rows);
    exception when others then null;
    end;
  end if;


  -- venues: source failures do not erase the other entity's inventory.
  begin
    with counts as (
      select e.venue_id as id, count(*) as total_events,
        count(*) filter (where e.status='approved' and e.event_date >= v_today) as upcoming_events,
        count(*) filter (where e.status='approved' and e.event_date < v_today) as past_events,
        count(*) filter (where from_date is null or (e.created_at >= from_date and e.created_at < to_date)) as created_events,
        max(e.event_date) as latest_scheduled_at,
        max(e.event_date) filter (where e.status='approved' and e.event_date < v_today) as last_occurred_at
      from public.events e where e.venue_id is not null group by e.venue_id
    ), all_rows as (
      select x.id,x.name,x.city as city,x.status,x.created_at,
        coalesce(c.total_events,0) as total_events,coalesce(c.upcoming_events,0) as upcoming_events,
        coalesce(c.past_events,0) as past_events,coalesce(c.created_events,0) as created_events,
        c.latest_scheduled_at,c.last_occurred_at,
        case when v_engagement_available then coalesce(v_venues_touches->x.id::text,
          '{"detail_views":0,"rsvp_clicks":0,"ticket_clicks":0,"shares":0}'::jsonb) else null end as engagement
      from public.venues x left join counts c on c.id=x.id
    ), ranked as (
      select * from all_rows order by
        case venue_sort when 'upcoming_events' then upcoming_events when 'total_events' then total_events
          when 'detail_views' then (engagement->>'detail_views')::bigint
          when 'rsvp_clicks' then (engagement->>'rsvp_clicks')::bigint
          when 'ticket_clicks' then (engagement->>'ticket_clicks')::bigint end desc nulls last,
        name asc,id asc limit page_size offset venue_offset
    ), page_rows as (
      select r.*, row_number() over (order by
        case venue_sort when 'upcoming_events' then upcoming_events when 'total_events' then total_events
          when 'detail_views' then (engagement->>'detail_views')::bigint
          when 'rsvp_clicks' then (engagement->>'rsvp_clicks')::bigint
          when 'ticket_clicks' then (engagement->>'ticket_clicks')::bigint end desc nulls last,name,id) as position
      from ranked r
    )
    select jsonb_build_object('total',(select count(*) from all_rows),
      'active',(select count(*) from all_rows where upcoming_events>0),
      'created',(select count(*) from all_rows where from_date is null or (created_at >= from_date and created_at < to_date)),
      'offset',venue_offset,'page_size',page_size,
      'rows',coalesce((select jsonb_agg(jsonb_build_object(
        'id',id,'name',name,'city',city,'status',status,'total_events',total_events,'upcoming_events',upcoming_events,
        'past_events',past_events,'created_events',created_events,'latest_scheduled_at',latest_scheduled_at,
        'last_occurred_at',last_occurred_at,'last_published_at',null,'engagement',engagement,
        'related',null,'related_total',null,'metros',null,'metro_total',null,'styles',null,'style_total',null
      ) order by position) from page_rows),'[]'::jsonb)) into v_venues;
  exception when others then v_venues:=null;
  end;

  -- Bounded canonical collaboration previews, independently unavailable.
  if v_venues is not null then
    begin
      select coalesce(jsonb_agg(r || jsonb_build_object(
        'related_total',(select count(distinct e.organizer_id) from public.events e where e.venue_id=(r->>'id')::uuid),
        'related',coalesce((select jsonb_agg(to_jsonb(p) order by event_count desc,name,id) from (
          select x.id,x.name,count(*) as event_count from public.events e
          join public.organizers x on x.id=e.organizer_id where e.venue_id=(r->>'id')::uuid
          group by x.id,x.name order by count(*) desc,x.name,x.id limit 10
        ) p),'[]'::jsonb)
      ) order by ord),'[]'::jsonb) into v_rows from jsonb_array_elements(v_venues->'rows') with ordinality as a(r,ord);
      v_venues:=jsonb_set(v_venues,'{rows}',v_rows);
    exception when others then null; -- Preserve the inventory; null previews signal unavailable relationships.
    end;
  end if;

  -- Current approved venue styles, canonical links authoritative over legacy arrays.
  if v_venues is not null then
    begin
      with canonical as (
        select distinct e.id as event_id,e.venue_id,tt.slug,tt.name from public.events e
        join public.event_taxonomy_terms ett on ett.event_id=e.id
        join public.taxonomy_terms tt on tt.id=ett.taxonomy_term_id and tt.category='dance_style'
        where e.status='approved' and e.venue_id is not null
      ), fallback as (
        select distinct e.id as event_id,e.venue_id,coalesce(tt.slug,s.slug) as slug,coalesce(tt.name,s.slug) as name
        from public.events e cross join lateral (
          select distinct regexp_replace(lower(btrim(style)),'[^a-z0-9]+','-','g') as slug
          from unnest(e.dance_styles) style where nullif(btrim(style),'') is not null
        ) s left join public.taxonomy_terms tt on tt.category='dance_style' and tt.slug=s.slug
        where e.status='approved' and e.venue_id is not null and not exists (
          select 1 from canonical c where c.event_id=e.id
        )
      ), styles as (select * from canonical union all select * from fallback), grouped as (
        select venue_id,slug,name,count(*) as event_count from styles group by venue_id,slug,name
      )
      select coalesce(jsonb_agg(r || jsonb_build_object(
        'style_total',(select count(*) from grouped g where g.venue_id=(r->>'id')::uuid),
        'styles',coalesce((select jsonb_agg(to_jsonb(p) order by event_count desc,slug) from (
          select slug,name,event_count from grouped g where g.venue_id=(r->>'id')::uuid
          order by event_count desc,slug limit 10
        ) p),'[]'::jsonb)
      ) order by ord),'[]'::jsonb) into v_rows from jsonb_array_elements(v_venues->'rows') with ordinality as a(r,ord);
      v_venues:=jsonb_set(v_venues,'{rows}',v_rows);
    exception when others then null;
    end;
  end if;

  begin
    with grouped as (
      select e.city,count(*) as upcoming_events,count(distinct e.organizer_id) as active_organizers,
        count(distinct e.venue_id) as active_venues from public.events e
      where e.status='approved' and e.event_date>=v_today group by e.city
    ), coverage as (
      select m.slug,m.name as city,coalesce(g.upcoming_events,0) as upcoming_events,
        coalesce(g.active_organizers,0) as active_organizers,coalesce(g.active_venues,0) as active_venues
      from public.metros m left join grouped g on g.city=m.slug
    ) select jsonb_build_object('active_metros',(select count(*) from coverage where upcoming_events>0),
      'inventory_history_available',false,
      'rows',coalesce((select jsonb_agg(to_jsonb(c) order by upcoming_events desc,city,slug) from coverage c),'[]'::jsonb)) into v_coverage;
  exception when others then v_coverage:=null;
  end;

  begin
    with checked as (
      select e.id,e.title,e.event_date,e.status,
        e.status='approved' as approved,e.status='approved' and e.event_date>=v_today as upcoming,
        e.venue_id is null as missing_venue,e.organizer_id is null as missing_organizer,
        nullif(btrim(e.poster_image_url),'') is null and nullif(btrim(e.image_url),'') is null as missing_flyer,
        nullif(btrim(e.location),'') is null and nullif(btrim(v.name),'') is null as missing_location,
        nullif(btrim(e.address),'') is null and nullif(btrim(v.address_line1),'') is null as missing_address,
        m.slug is null as missing_metro,
        nullif(btrim(e.city),'') is not null and (m.slug is null or e.city<>btrim(e.city)) as inconsistent_city,
        not exists(select 1 from public.event_taxonomy_terms ett join public.taxonomy_terms tt on tt.id=ett.taxonomy_term_id
          where ett.event_id=e.id and tt.category='dance_style')
          and not exists(select 1 from unnest(e.dance_styles) s where nullif(btrim(s),'') is not null) as missing_taxonomy,
        nullif(btrim(e.title),'') is null or e.event_date is null as invalid_required
      from public.events e left join public.venues v on v.id=e.venue_id left join public.metros m on m.slug=e.city
    ), issues as (
      select c.id,c.title,c.event_date,i.key,i.severity from checked c cross join lateral (values
        ('missing_venue','optional',c.approved and c.missing_venue),
        ('missing_organizer','optional',c.approved and c.missing_organizer),
        ('missing_flyer','recommended',c.upcoming and c.missing_flyer),
        ('missing_location','recommended',c.upcoming and c.missing_location),
        ('missing_address','recommended',c.upcoming and c.missing_address),
        ('missing_metro','recommended',c.missing_metro),
        ('inconsistent_city','recommended',c.inconsistent_city),
        ('missing_taxonomy','recommended',c.upcoming and c.missing_taxonomy),
        ('invalid_required','invalid',c.invalid_required)
      ) i(key,severity,affected) where i.affected
    ), definitions as (
      select * from (values ('missing_venue','optional'),('missing_organizer','optional'),('missing_flyer','recommended'),
        ('missing_location','recommended'),('missing_address','recommended'),('missing_metro','recommended'),
        ('inconsistent_city','recommended'),('missing_taxonomy','recommended'),('invalid_required','invalid')) d(key,severity)
    ) select jsonb_agg(jsonb_build_object('key',d.key,'severity',d.severity,
      'count',(select count(*) from issues i where i.key=d.key),
      'events',coalesce((select jsonb_agg(to_jsonb(p) order by event_date desc,id) from (
        select id,title,event_date from issues i where i.key=d.key order by event_date desc,id limit 10
      ) p),'[]'::jsonb)) order by d.key) into v_quality from definitions d;
  exception when others then v_quality:=null;
  end;

  return jsonb_build_object('as_of',v_now,'first_recorded_at',v_first_touch,'engagement_available',v_engagement_available,
    'organizers',v_organizers,'venues',v_venues,'coverage',v_coverage,'quality',v_quality);
end;
$$;
revoke execute on function public.admin_analytics_entity_performance(timestamptz,timestamptz,text,text,integer,integer,integer) from public,anon;
grant execute on function public.admin_analytics_entity_performance(timestamptz,timestamptz,text,text,integer,integer,integer) to authenticated;
notify pgrst,'reload schema';

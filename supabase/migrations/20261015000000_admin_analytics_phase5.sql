-- Phase 5 is read-only decision support. No policies, public projections or workflows change.
create or replace function public.admin_analytics_operations(
 from_date timestamptz default null, to_date timestamptz default null,
 metro_offset integer default 0, organizer_offset integer default 0,
 quality_offset integer default 0, engagement_offset integer default 0,
 page_size integer default 25, minimum_views integer default 25,
 maximum_ratio numeric default 5, healthy_inventory integer default 5,
 limited_inventory integer default 2
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_now timestamptz:=pg_catalog.statement_timestamp();
 v_today timestamptz:=pg_catalog.date_trunc('day',v_now at time zone 'America/New_York') at time zone 'America/New_York';
 v_submissions jsonb; v_metros jsonb; v_organizers jsonb; v_quality jsonb; v_opportunities jsonb;
 v_activity jsonb:='{}'; v_first timestamptz; v_count bigint; v_key text;
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' then
  raise exception 'admin role required' using errcode='42501';
 end if;
 if (from_date is null)<>(to_date is null) or from_date>=to_date
  or metro_offset is null or metro_offset<0 or organizer_offset is null or organizer_offset<0
  or quality_offset is null or quality_offset<0 or engagement_offset is null or engagement_offset<0
  or page_size is null or page_size<1 or page_size>10000 or minimum_views is null or minimum_views<1
  or maximum_ratio is null or maximum_ratio<0 or healthy_inventory is null or limited_inventory is null
  or limited_inventory<2 or healthy_inventory<=limited_inventory then
  raise exception 'invalid operational analytics parameters' using errcode='22023';
 end if;
 begin
  with pending as (
   select greatest(extract(epoch from (v_now-submitted_at))/3600,0) as hours
   from public.event_submissions where status in ('pending','in_review')
  ) select jsonb_build_object('pending',count(*),'average_hours',avg(hours),'oldest_hours',max(hours),
   'over_24',count(*) filter(where hours>24),'over_48',count(*) filter(where hours>48),'over_7d',count(*) filter(where hours>168),
   'under_24',count(*) filter(where hours<=24),'hours_24_48',count(*) filter(where hours>24 and hours<=48),
   'days_2_7',count(*) filter(where hours>48 and hours<=168)) into v_submissions from pending;
 exception when others then v_submissions:=null; end;
 begin
  with history as (
   select city,count(*) filter(where event_date>=v_today) as upcoming_events,
    count(*) filter(where event_date>=v_today and event_date<((v_today at time zone 'America/New_York')+interval '7 days') at time zone 'America/New_York') as events_7d,
    count(*) filter(where event_date>=v_today and event_date<((v_today at time zone 'America/New_York')+interval '30 days') at time zone 'America/New_York') as events_30d,
    count(distinct organizer_id) filter(where event_date>=v_today) as active_organizers,
    count(distinct venue_id) filter(where event_date>=v_today) as active_venues,
    count(*) filter(where event_date<v_today) as past_events,max(event_date) as last_event_at
   from public.events where status='approved' group by city
  ), classified as (
   select m.id,m.slug,m.name,h.*,
    case when h.upcoming_events=0 then 'previously_active' when h.past_events=0 then 'newly_emerging' else 'currently_active' end as activity,
    case when h.upcoming_events>=healthy_inventory then 'healthy' when h.upcoming_events>=limited_inventory then 'limited'
     when h.upcoming_events=1 then 'critical' else 'none' end as health
   from public.metros m join history h on h.city=m.slug
  ) select jsonb_build_object('total',count(*),'active',count(*) filter(where upcoming_events>0),
   'limited',count(*) filter(where health='limited'),'critical',count(*) filter(where health='critical'),
   'previously_active',count(*) filter(where activity='previously_active'),'low_inventory',count(*) filter(where health<>'healthy'),
   'rows',coalesce((select jsonb_agg(to_jsonb(p)-'city' order by upcoming_events,name,id) from
    (select * from classified order by upcoming_events,name,id limit page_size offset metro_offset) p),'[]')) into v_metros from classified;
 exception when others then v_metros:=null; end;
 begin
  with counts as (
   select organizer_id,count(*) as total_events,count(*) filter(where status='approved') as approved_events,
    count(*) filter(where status='approved' and event_date>=v_today) as upcoming_events,
    count(*) filter(where status='approved' and event_date<v_today) as past_events,
    max(event_date) filter(where status='approved' and event_date<v_today) as last_event_at
   from public.events where organizer_id is not null group by organizer_id
  ), classified as (
   select o.id,o.name,coalesce(c.total_events,0) as total_events,coalesce(c.upcoming_events,0) as upcoming_events,
    coalesce(c.past_events,0) as past_events,c.last_event_at,
    case when c.upcoming_events>0 then 'active' when c.approved_events>0 then 'no_upcoming'
     when c.total_events>0 then 'unpublished' else 'no_history' end as activity,
    coalesce(c.past_events>=5,false) as previously_frequent
   from public.organizers o left join counts c on c.organizer_id=o.id
  ) select jsonb_build_object('total',count(*),'active',count(*) filter(where upcoming_events>0),
   'no_upcoming',count(*) filter(where upcoming_events=0),'no_history',count(*) filter(where total_events=0),
   'past_only',count(*) filter(where total_events=past_events and past_events>0),
   'previously_frequent',count(*) filter(where previously_frequent),
   'rows',coalesce((select jsonb_agg(to_jsonb(p) order by upcoming_events,name,id) from
    (select * from classified order by upcoming_events,name,id limit page_size offset organizer_offset) p),'[]')) into v_organizers from classified;
 exception when others then v_organizers:=null; end;
 begin
  with checked as (
   select e.id,e.title,e.event_date,e.venue_id,e.organizer_id,
    not (coalesce(btrim(e.poster_image_url),'')~*'^(https?://[^[:space:]/?#]+([/?#]|$)|/[^/])' or coalesce(btrim(e.image_url),'')~*'^(https?://[^[:space:]/?#]+([/?#]|$)|/[^/])') as missing_flyer,
    nullif(btrim(e.location),'') is null and nullif(btrim(v.name),'') is null as missing_location,
    nullif(btrim(e.address),'') is null and nullif(btrim(v.address_line1),'') is null as missing_address,
    m.id is null as missing_metro,
    not exists(select 1 from public.event_taxonomy_terms et join public.taxonomy_terms t on t.id=et.taxonomy_term_id
      where et.event_id=e.id and t.category='dance_style')
     and not exists(select 1 from unnest(e.dance_styles) s where nullif(btrim(s),'') is not null) as missing_taxonomy,
    nullif(btrim(e.title),'') is null as invalid_required
   from public.events e left join public.venues v on v.id=e.venue_id left join public.metros m on m.slug=e.city
   where e.status='approved' and e.event_date>=v_today
  ), issues as (
   select c.id,c.title,c.event_date,i.key,i.severity from checked c cross join lateral (values
    ('missing_venue','informational',c.venue_id is null),('missing_organizer','informational',c.organizer_id is null),
    ('missing_flyer','attention',c.missing_flyer),('missing_location','attention',c.missing_location or c.missing_address),
    ('missing_metro','attention',c.missing_metro),('missing_taxonomy','attention',c.missing_taxonomy),
    ('invalid_required','critical',c.invalid_required)
   ) i(key,severity,affected) where i.affected
  ), grouped as (select key,count(*) as count from issues group by key)
  select jsonb_build_object('total',count(*),'affected_events',count(distinct id),'critical_events',count(distinct id) filter(where severity='critical'),
   'counts',jsonb_build_object('missing_venue',coalesce((select count from grouped where key='missing_venue'),0),
    'missing_organizer',coalesce((select count from grouped where key='missing_organizer'),0),
    'missing_flyer',coalesce((select count from grouped where key='missing_flyer'),0),
    'missing_location',coalesce((select count from grouped where key='missing_location'),0),
    'missing_metro',coalesce((select count from grouped where key='missing_metro'),0),
    'missing_taxonomy',coalesce((select count from grouped where key='missing_taxonomy'),0),
    'invalid_required',coalesce((select count from grouped where key='invalid_required'),0)),
   'rows',coalesce((select jsonb_agg(to_jsonb(p) order by priority,event_date,id,key) from
    (select *,case severity when 'critical' then 0 when 'attention' then 1 else 2 end as priority
     from issues order by priority,event_date,id,key limit page_size offset quality_offset) p),'[]')) into v_quality from issues;
 exception when others then v_quality:=null; end;
 begin
  if pg_catalog.to_regprocedure('public.admin_event_engagement(timestamptz,timestamptz,text)') is not null then
   select min(touched_at) into v_first from public.event_touches;
   if v_first is not null and (to_date is null or to_date>v_first) then
    with touches as (
     select event_id,count(*) filter(where kind='view') as detail_views,count(*) filter(where kind='rsvp_click') as rsvp_clicks,
      count(*) filter(where kind='ticket_click') as ticket_clicks,count(*) filter(where kind='share') as shares
     from public.event_touches where from_date is null or (touched_at>=from_date and touched_at<to_date) group by event_id
    ), screened as (
     select e.id,e.title,e.event_date,t.*,100.0*(t.rsvp_clicks+t.ticket_clicks)/nullif(t.detail_views,0) as ratio
     from touches t join public.events e on e.id=t.event_id where e.status='approved' and t.detail_views>=minimum_views
      and 100.0*(t.rsvp_clicks+t.ticket_clicks)/nullif(t.detail_views,0)<maximum_ratio
    ) select jsonb_build_object('total',count(*),'rows',coalesce((select jsonb_agg(to_jsonb(p)-'event_id' order by detail_views desc,id) from
     (select * from screened order by detail_views desc,id limit page_size offset engagement_offset) p),'[]')) into v_opportunities from screened;
   end if;
  end if;
 exception when others then v_opportunities:=null; v_first:=null; end;
 -- Each activity timestamp is authoritative; unavailable sources remain null.
 foreach v_key in array array['events','accounts','submissions','organizers','venues','new_metros'] loop
  begin
   case v_key
    when 'events' then select count(*) into v_count from public.events where created_at is not null and (from_date is null or (created_at>=from_date and created_at<to_date));
    when 'accounts' then select count(*) into v_count from auth.users where created_at is not null and (from_date is null or (created_at>=from_date and created_at<to_date));
    when 'submissions' then select count(*) into v_count from public.event_submissions where from_date is null or (submitted_at>=from_date and submitted_at<to_date);
    when 'organizers' then select count(*) into v_count from public.organizers where from_date is null or (created_at>=from_date and created_at<to_date);
    when 'venues' then select count(*) into v_count from public.venues where from_date is null or (created_at>=from_date and created_at<to_date);
    when 'new_metros' then select count(*) into v_count from (select m.id,min(e.created_at) as first_created from public.metros m join public.events e on e.city=m.slug group by m.id) a
     where first_created is not null and (from_date is null or (first_created>=from_date and first_created<to_date));
   end case;
  exception when others then v_count:=null; end;
  v_activity:=v_activity||jsonb_build_object(v_key,v_count);
 end loop;
 return jsonb_build_object('as_of',v_now,'first_recorded_at',v_first,'submissions',v_submissions,'metros',v_metros,
  'organizers',v_organizers,'quality',v_quality,'opportunities',v_opportunities,'activity',v_activity,
  'thresholds',jsonb_build_object('minimum_views',minimum_views,'maximum_ratio',maximum_ratio,'healthy_inventory',healthy_inventory,'limited_inventory',limited_inventory),
  'page_size',page_size);
end $$;
revoke all on function public.admin_analytics_operations(timestamptz,timestamptz,integer,integer,integer,integer,integer,integer,numeric,integer,integer) from public,anon;
grant execute on function public.admin_analytics_operations(timestamptz,timestamptz,integer,integer,integer,integer,integer,integer,numeric,integer,integer) to authenticated;

-- Export-only aggregate projection. A disclosed 10,000-row cap is not a complete-report claim.
create or replace function public.admin_analytics_report(
 report_name text, from_date timestamptz default null, to_date timestamptz default null,
 sort_by text default 'upcoming_events'
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_data jsonb; v_section jsonb; v_rows jsonb; v_headers jsonb; v_total bigint;
 v_limit integer:=10000; v_today timestamptz:=pg_catalog.date_trunc('day',pg_catalog.statement_timestamp() at time zone 'America/New_York') at time zone 'America/New_York';
 v_first timestamptz; v_available boolean:=false; v_touches jsonb:='{}'; v_metrics jsonb;
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' then raise exception 'admin role required' using errcode='42501'; end if;
 if report_name is null or report_name not in ('overview','events','organizers','venues','metros','quality','submissions')
  or (from_date is null)<>(to_date is null) or from_date>=to_date
  or sort_by is null or sort_by not in ('upcoming_events','total_events','detail_views','rsvp_clicks','ticket_clicks','shares','ratio') then
  raise exception 'invalid report parameters' using errcode='22023';
 end if;
 if report_name in ('overview','metros','quality','submissions') then
  v_data:=public.admin_analytics_operations(from_date,to_date,0,0,0,0,v_limit);
  if report_name='overview' then
   v_headers:='["Metric","Value"]';
   v_metrics:=public.admin_analytics_metrics(from_date,to_date);
   if exists(select 1 from jsonb_each(v_data->'activity') where value='null'::jsonb)
    or exists(select 1 from jsonb_each(v_metrics) where key not in ('as_of','events_by_city') and value='null'::jsonb)
    or v_metrics->'events_by_city'='null'::jsonb then raise exception 'report source unavailable' using errcode='55000'; end if;
   select jsonb_agg(jsonb_build_array(key,value) order by key) into v_rows from (
    select 'Activity: '||key as key,value from jsonb_each(v_data->'activity')
    union all select 'Overview: '||key,value from jsonb_each(v_metrics) where key not in ('as_of','events_by_city')
    union all select 'Upcoming metro: '||coalesce(r->>'slug','Unknown city'),r->'count' from jsonb_array_elements(v_metrics->'events_by_city') r
   ) a; v_total:=jsonb_array_length(v_rows);
  elsif report_name='submissions' then
   v_section:=v_data->'submissions'; v_headers:='["Metric","Value"]';
   if v_section='null'::jsonb then raise exception 'report source unavailable' using errcode='55000'; end if;
   select jsonb_agg(jsonb_build_array(key,value) order by key) into v_rows from jsonb_each(v_section); v_total:=jsonb_array_length(v_rows);
  elsif report_name='metros' then
   v_section:=v_data->'metros'; v_headers:='["Metro ID","Metro slug","Metro name","Upcoming approved events","Events within 7 days","Events within 30 days","Active organizers","Active venues","Last known event date","Activity","Inventory health"]';
   select coalesce(jsonb_agg(jsonb_build_array(r->'id',r->'slug',r->'name',r->'upcoming_events',r->'events_7d',r->'events_30d',r->'active_organizers',r->'active_venues',r->'last_event_at',r->'activity',r->'health') order by ord),'[]') into v_rows from jsonb_array_elements(v_section->'rows') with ordinality a(r,ord);
   v_total:=(v_section->>'total')::bigint;
  else
   v_section:=v_data->'quality'; v_headers:='["Event ID","Event","Scheduled date","Issue","Severity"]';
   select coalesce(jsonb_agg(jsonb_build_array(r->'id',r->'title',r->'event_date',r->'key',r->'severity') order by ord),'[]') into v_rows from jsonb_array_elements(v_section->'rows') with ordinality a(r,ord);
   v_total:=(v_section->>'total')::bigint;
  end if;
 else
  begin
   if pg_catalog.to_regprocedure('public.admin_event_engagement(timestamptz,timestamptz,text)') is not null then
    select min(touched_at) into v_first from public.event_touches;
    v_available:=v_first is not null and (to_date is null or to_date>v_first);
   end if;
  exception when others then v_available:=false; end;
  if report_name='events' then
   if not v_available then raise exception 'engagement tracking unavailable' using errcode='55000'; end if;
   with touches as (
    select event_id,count(*) filter(where kind='view') as detail_views,count(*) filter(where kind='rsvp_click') as rsvp_clicks,
     count(*) filter(where kind='ticket_click') as ticket_clicks,count(*) filter(where kind='share') as shares
    from public.event_touches where from_date is null or (touched_at>=from_date and touched_at<to_date) group by event_id
   ), all_rows as (
    select e.id,e.title,e.event_date,e.status,t.*,100.0*(rsvp_clicks+ticket_clicks)/nullif(detail_views,0) as ratio from touches t join public.events e on e.id=t.event_id
   ), ranked as (
    select * from all_rows order by case sort_by when 'rsvp_clicks' then rsvp_clicks when 'ticket_clicks' then ticket_clicks
     when 'shares' then shares when 'ratio' then ratio else detail_views end desc nulls last,id limit v_limit
   ) select (select count(*) from all_rows),coalesce(jsonb_agg(jsonb_build_array(id,title,event_date,status,detail_views,rsvp_clicks,ticket_clicks,shares,ratio) order by
    case sort_by when 'rsvp_clicks' then rsvp_clicks when 'ticket_clicks' then ticket_clicks when 'shares' then shares when 'ratio' then ratio else detail_views end desc nulls last,id),'[]') into v_total,v_rows from ranked;
   v_headers:='["Event ID","Event","Scheduled date","Current status","Detail views","RSVP clicks","Ticket clicks","Shares","Outbound click-to-view ratio (%)"]';
  else
   if v_available then
    with grouped as (
     select case report_name when 'organizers' then e.organizer_id else e.venue_id end as id,
      count(*) filter(where t.kind='view') as detail_views,count(*) filter(where t.kind='rsvp_click') as rsvp_clicks,
      count(*) filter(where t.kind='ticket_click') as ticket_clicks,count(*) filter(where t.kind='share') as shares
     from public.event_touches t join public.events e on e.id=t.event_id
     where from_date is null or (t.touched_at>=from_date and t.touched_at<to_date) group by 1
    ) select coalesce(jsonb_object_agg(id::text,to_jsonb(g)-'id') filter(where id is not null),'{}') into v_touches from grouped g;
   end if;
   with entities as (
    select id,name,created_at from public.organizers where report_name='organizers'
    union all select id,name,created_at from public.venues where report_name='venues'
   ), counts as (
    select case report_name when 'organizers' then organizer_id else venue_id end as id,count(*) as total_events,
     count(*) filter(where status='approved' and event_date>=v_today) as upcoming_events,
     count(*) filter(where status='approved' and event_date<v_today) as past_events,
     count(*) filter(where from_date is null or (created_at>=from_date and created_at<to_date)) as created_events
    from public.events group by 1
   ), touches as (
    select key::uuid as id,(value->>'detail_views')::bigint as detail_views,(value->>'rsvp_clicks')::bigint as rsvp_clicks,
     (value->>'ticket_clicks')::bigint as ticket_clicks,(value->>'shares')::bigint as shares from jsonb_each(v_touches)
   ), all_rows as (
    select x.id,x.name,x.created_at,coalesce(c.total_events,0) as total_events,coalesce(c.upcoming_events,0) as upcoming_events,
     coalesce(c.past_events,0) as past_events,coalesce(c.created_events,0) as created_events,
     case when v_available then coalesce(t.detail_views,0) end as detail_views,
     case when v_available then coalesce(t.rsvp_clicks,0) end as rsvp_clicks,
     case when v_available then coalesce(t.ticket_clicks,0) end as ticket_clicks,case when v_available then coalesce(t.shares,0) end as shares
    from entities x left join counts c on c.id=x.id left join touches t on t.id=x.id
   ), ranked as (
    select * from all_rows order by case sort_by when 'total_events' then total_events when 'detail_views' then detail_views
     when 'rsvp_clicks' then rsvp_clicks when 'ticket_clicks' then ticket_clicks else upcoming_events end desc nulls last,name,id limit v_limit
   ) select (select count(*) from all_rows),coalesce(jsonb_agg(jsonb_build_array(id,name,created_at,total_events,upcoming_events,past_events,created_events,detail_views,rsvp_clicks,ticket_clicks,shares) order by
    case sort_by when 'total_events' then total_events when 'detail_views' then detail_views when 'rsvp_clicks' then rsvp_clicks when 'ticket_clicks' then ticket_clicks else upcoming_events end desc nulls last,name,id),'[]') into v_total,v_rows from ranked;
   v_headers:='["Entity ID","Name","Created date","Associated events (all statuses)","Upcoming approved events","Past approved events","Events created in period","Detail views","RSVP clicks","Ticket clicks","Shares"]';
  end if;
 end if;
 if v_total is null then raise exception 'report source unavailable' using errcode='55000'; end if;
 return jsonb_build_object('headers',v_headers,'rows',v_rows,'total',v_total,'limit',v_limit,'as_of',pg_catalog.statement_timestamp(),
  'from_date',from_date,'to_date',to_date,'engagement_available',v_available,
  'scope',case when report_name in ('metros','quality','submissions') then 'Current state, independent of activity period'
   when report_name in ('organizers','venues') then 'Current canonical inventory; creation and interactions scoped to selected period'
   when report_name='events' then 'Recorded interactions in selected period; current event metadata'
   else 'Phase 1 overview definitions retained; Activity uses authoritative timestamps and excludes undated rows; upcoming inventory is current state' end);
end $$;
revoke all on function public.admin_analytics_report(text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.admin_analytics_report(text,timestamptz,timestamptz,text) to authenticated;
notify pgrst,'reload schema';

-- Recurring coverage score: read-only decision support. No tables, policies or
-- public projections change.
--
-- A recurring night is a series (event_series, when an event is linked to an
-- active one) or, for unlinked events, the same normalized title at the same
-- venue (or location text) on the same New York weekday. Events rarely carry
-- series_id or recurrence, so the inferred key is what makes the score
-- measurable on real inventory.
--
-- Tracked: a night with at least `minimum_occurrences` approved occurrences in
-- the `lookback_days` before today (New York). Listed: a tracked night with an
-- approved occurrence from today through `horizon_days` ahead. Score = listed
-- / tracked per metro. It measures whether known recurring nights stay
-- current, not the share of a city's real-world events the guide knows about.
create or replace function public.admin_coverage_score(
 lookback_days integer default 28,
 horizon_days integer default 14,
 minimum_occurrences integer default 2,
 gap_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_now timestamptz:=pg_catalog.statement_timestamp();
 -- Wall-clock New York midnight; windows compare local timestamps so DST
 -- transitions never shift a window by an hour.
 v_today timestamp:=pg_catalog.date_trunc('day',v_now at time zone 'America/New_York');
 v_result jsonb;
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' then
  raise exception 'admin role required' using errcode='42501';
 end if;
 if lookback_days is null or lookback_days<7 or lookback_days>365
  or horizon_days is null or horizon_days<1 or horizon_days>90
  or minimum_occurrences is null or minimum_occurrences<2 or minimum_occurrences>52
  or gap_limit is null or gap_limit<0 or gap_limit>500 then
  raise exception 'invalid coverage parameters' using errcode='22023';
 end if;

 with occurrences as (
  select e.id,e.title,e.event_date,
   e.event_date at time zone 'America/New_York' as local_at,
   coalesce(s.city,e.city) as metro,
   coalesce(nullif(btrim(v.name),''),nullif(btrim(e.location),'')) as place,
   s.slug as series_slug,
   coalesce('series:'||s.id::text,
    'night:'||pg_catalog.lower(pg_catalog.regexp_replace(btrim(e.title),'\s+',' ','g'))
     ||'|'||coalesce(e.venue_id::text,pg_catalog.lower(btrim(e.location)),'')
     ||'|'||extract(isodow from e.event_date at time zone 'America/New_York')::text) as night_key
  from public.events e
  left join public.event_series s on s.id=e.series_id and s.status='active'
  left join public.venues v on v.id=e.venue_id
  where e.status='approved' and e.event_date is not null
   and nullif(btrim(e.title),'') is not null
 ), nights as (
  select metro,night_key,
   (pg_catalog.array_agg(title order by event_date desc))[1] as title,
   (pg_catalog.array_agg(place order by event_date desc))[1] as place,
   max(series_slug) as series_slug,
   count(distinct local_at::date) filter(where local_at>=v_today-pg_catalog.make_interval(days=>lookback_days) and local_at<v_today) as recent,
   max(event_date) filter(where local_at<v_today) as last_at,
   min(event_date) filter(where local_at>=v_today and local_at<v_today+pg_catalog.make_interval(days=>horizon_days)) as next_at
  from occurrences group by metro,night_key
 ), tracked as (
  select * from nights where recent>=minimum_occurrences
 ), per_metro as (
  select t.metro,m.name,count(*) as tracked,count(t.next_at) as listed,
   coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'key',g.night_key,'title',g.title,'place',g.place,'series_slug',g.series_slug,
     'last_at',g.last_at,'recent_occurrences',g.recent) order by g.last_at desc,g.night_key)
    from (select * from tracked x where x.metro is not distinct from t.metro and x.next_at is null
          order by x.last_at desc,x.night_key limit gap_limit) g),'[]'::jsonb) as gaps
  from tracked t left join public.metros m on m.slug=t.metro
  group by t.metro,m.name
 )
 select pg_catalog.jsonb_build_object(
  'as_of',v_now,
  'lookback_days',lookback_days,'horizon_days',horizon_days,'minimum_occurrences',minimum_occurrences,
  'tracked',coalesce(sum(tracked),0),'listed',coalesce(sum(listed),0),
  'metros',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'slug',metro,'name',name,'tracked',tracked,'listed',listed,'gaps',gaps)
   order by tracked desc,listed,name nulls last),'[]'::jsonb))
 into v_result from per_metro;
 return v_result;
end $$;

revoke all on function public.admin_coverage_score(integer,integer,integer,integer) from public,anon;
grant execute on function public.admin_coverage_score(integer,integer,integer,integer) to authenticated;

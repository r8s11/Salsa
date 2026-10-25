-- Admin Analytics Phase 1: replace the metrics payload without changing the
-- existing function identity or any table/view permissions.
create or replace function public.admin_analytics_metrics(
  from_date timestamptz,
  to_date   timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total_events       bigint;
  v_upcoming_events    bigint;
  v_registered_users   bigint;
  v_pending_submissions bigint;
  v_active_organizers  bigint;
  v_events_by_city     jsonb;
  v_as_of              timestamptz := pg_catalog.now();
  v_today_start        timestamptz :=
    ((pg_catalog.now() at time zone 'America/New_York')::date::timestamp
      at time zone 'America/New_York');
begin
  -- Authentication and authorization are intentionally outside every
  -- protected aggregation block so failures can never become nullable data.
  if auth.uid() is null
     or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  if (from_date is null) <> (to_date is null)
     or (from_date is not null and to_date is not null and from_date >= to_date) then
    raise exception 'invalid analytics date range' using errcode = '22023';
  end if;

  -- Each source is isolated so an unavailable data source yields null for
  -- its metric rather than failing the complete dashboard response. STABLE
  -- gives all source reads the same statement snapshot.
  begin
    select pg_catalog.count(*)
      into v_total_events
      from public.events e
     where from_date is null
        or (e.created_at >= from_date and e.created_at < to_date);
  exception when others then
    v_total_events := null;
  end;

  begin
    select pg_catalog.count(*)
      into v_registered_users
      from auth.users u
     where from_date is null
        or (u.created_at >= from_date and u.created_at < to_date);
  exception when others then
    v_registered_users := null;
  end;

  begin
    select pg_catalog.count(*)
      into v_pending_submissions
      from public.event_submissions s
     where s.status in ('pending', 'in_review')
       and (from_date is null or (s.submitted_at >= from_date and s.submitted_at < to_date));
  exception when others then
    v_pending_submissions := null;
  end;

  begin
    select pg_catalog.count(*)
      into v_upcoming_events
      from public.events e
     where e.status = 'approved'
       and e.event_date >= v_today_start;
  exception when others then
    v_upcoming_events := null;
  end;

  begin
    select pg_catalog.count(distinct e.organizer_id)
      into v_active_organizers
      from public.events e
     where e.status = 'approved'
       and e.event_date >= v_today_start
       and e.organizer_id is not null;
  exception when others then
    v_active_organizers := null;
  end;

  begin
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('slug', city_slug, 'city', city_label, 'count', event_count)
        order by event_count desc, city_label asc, city_slug asc nulls last
      ),
      '[]'::jsonb
    )
      into v_events_by_city
      from (
        select case
                 when nullif(pg_catalog.btrim(e.city), '') is null then 'Unknown city'
                 else coalesce(m.name, e.city)
               end as city_label,
               nullif(pg_catalog.btrim(e.city), '') as city_slug,
               pg_catalog.count(*) as event_count
          from public.events e
          left join public.metros m on m.slug = e.city
         where e.status = 'approved'
           and e.event_date >= v_today_start
         group by 1, 2
      ) city_counts;
  exception when others then
    v_events_by_city := null;
  end;

  return pg_catalog.jsonb_build_object(
    'total_events', v_total_events,
    'upcoming_events', v_upcoming_events,
    'registered_users', v_registered_users,
    'pending_submissions', v_pending_submissions,
    'active_organizers', v_active_organizers,
    'events_by_city', v_events_by_city,
    'as_of', v_as_of
  );
end;
$$;

revoke execute on function public.admin_analytics_metrics(timestamptz, timestamptz)
  from public, anon;
grant execute on function public.admin_analytics_metrics(timestamptz, timestamptz)
  to authenticated;

notify pgrst, 'reload schema';

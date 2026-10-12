-- Admin Analytics Phase 2: replace only the unused timeseries payload RPC.
-- Aggregate-only output; no raw records or existing data permissions change.
create or replace function public.admin_analytics_timeseries(
  from_date timestamptz,
  to_date timestamptz,
  granularity text default 'weekly'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_today date := (pg_catalog.statement_timestamp() at time zone 'America/New_York')::date;
  v_start_local timestamp;
  v_end_local timestamp;
  v_start_date date;
  v_end_date date;
  v_period_days integer;
  v_prev_from timestamptz;
  v_prev_to timestamptz;
  v_bucket_unit text;
  v_events jsonb;
  v_users jsonb;
  v_submissions jsonb;
  v_geography jsonb;
  v_styles jsonb;
  v_json jsonb;
  v_first_date date;
  v_last_date date;
  v_counts jsonb;
begin
  -- Authorization must never be swallowed by section-level source handlers.
  if auth.uid() is null
     or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  if (from_date is null) <> (to_date is null)
     or (from_date is not null and from_date >= to_date) then
    raise exception 'invalid analytics date range' using errcode = '22023';
  end if;
  if granularity is null or granularity not in ('daily', 'weekly', 'monthly') then
    raise exception 'invalid analytics granularity' using errcode = '22023';
  end if;

  v_bucket_unit := case granularity when 'daily' then 'day' when 'weekly' then 'week' else 'month' end;
  if from_date is not null then
    v_start_local := from_date at time zone 'America/New_York';
    v_end_local := to_date at time zone 'America/New_York';
    v_start_date := v_start_local::date;
    v_end_date := v_end_local::date;
    v_period_days := v_end_date - v_start_date;
    -- The prior period uses Eastern calendar days, not elapsed UTC duration.
    v_prev_from := (v_start_date - v_period_days)::timestamp at time zone 'America/New_York';
    v_prev_to := from_date;
  end if;

  -- Event creation cohorts. Status subdivisions reflect current status, not a
  -- fabricated history of moderation transitions.
  begin
    if from_date is null then
      select min((e.created_at at time zone 'America/New_York')::date),
             max((e.created_at at time zone 'America/New_York')::date)
        into v_first_date, v_last_date
        from public.events e where e.created_at is not null;
      if v_first_date is not null then
        v_last_date := greatest(v_last_date, v_today);
      end if;
    else
      v_first_date := (pg_catalog.date_trunc(v_bucket_unit, v_start_local)::date);
      v_last_date := pg_catalog.date_trunc(v_bucket_unit, (v_end_local - interval '1 microsecond'))::date;
    end if;

    if from_date is null then
      select pg_catalog.to_jsonb(pg_catalog.count(*)) into v_counts from public.events e;
    else
      select pg_catalog.to_jsonb(pg_catalog.count(*)) into v_counts from public.events e where e.created_at >= from_date and e.created_at < to_date;
    end if;
    v_json := pg_catalog.jsonb_build_object(
      'current', coalesce(v_counts, '0'::jsonb)
    );
    if from_date is null then
      v_json := v_json || pg_catalog.jsonb_build_object('previous', null);
    else
      select pg_catalog.to_jsonb(pg_catalog.count(*)) into v_counts
        from public.events e where e.created_at >= v_prev_from and e.created_at < v_prev_to;
      v_json := v_json || pg_catalog.jsonb_build_object('previous', coalesce(v_counts, '0'::jsonb));
    end if;

    if v_first_date is null then
      v_json := v_json || pg_catalog.jsonb_build_object('series', '[]'::jsonb);
    else
      with buckets as (
        select g.bucket::date as bucket_date
          from pg_catalog.generate_series(
            pg_catalog.date_trunc(v_bucket_unit, v_first_date::timestamp),
            pg_catalog.date_trunc(v_bucket_unit, v_last_date::timestamp),
            case granularity when 'daily' then interval '1 day' when 'weekly' then interval '1 week' else interval '1 month' end
          ) as g(bucket)
      ), counts as (
        select pg_catalog.date_trunc(v_bucket_unit, e.created_at at time zone 'America/New_York')::date as bucket_date,
               pg_catalog.count(*) as created,
               pg_catalog.count(*) filter (where e.status = 'approved') as approved,
               pg_catalog.count(*) filter (where e.status in ('pending', 'draft')) as pending_draft
          from public.events e
         where e.created_at is not null
           and (from_date is null or (e.created_at >= from_date and e.created_at < to_date))
         group by 1
      )
      select coalesce(
               pg_catalog.jsonb_agg(
                 pg_catalog.jsonb_build_object('period', pg_catalog.to_char(b.bucket_date, 'YYYY-MM-DD'),
                   'created', coalesce(c.created, 0), 'approved', coalesce(c.approved, 0),
                   'pending_draft', coalesce(c.pending_draft, 0)) order by b.bucket_date
               ), '[]'::jsonb)
        into v_counts
        from buckets b left join counts c using (bucket_date);
      v_json := v_json || pg_catalog.jsonb_build_object('series', coalesce(v_counts, '[]'::jsonb));
    end if;
    v_events := v_json;
  exception when others then
    v_events := null;
  end;

  -- Auth account source, deliberately not profiles. The platform total is
  -- independent of the selected registration window.
  begin
    select pg_catalog.to_jsonb(pg_catalog.count(*)) into v_counts from auth.users;
    if from_date is null then
      select min((u.created_at at time zone 'America/New_York')::date),
             greatest(coalesce(max((u.created_at at time zone 'America/New_York')::date), v_today), v_today)
        into v_first_date, v_last_date
        from auth.users u where u.created_at is not null;
    else
      v_first_date := pg_catalog.date_trunc(v_bucket_unit, v_start_local)::date;
      v_last_date := pg_catalog.date_trunc(v_bucket_unit, (v_end_local - interval '1 microsecond'))::date;
    end if;
    v_json := pg_catalog.jsonb_build_object('total_accounts', coalesce(v_counts, '0'::jsonb));
    if from_date is null then
      v_json := v_json || pg_catalog.jsonb_build_object('current', coalesce(v_counts, '0'::jsonb), 'previous', null);
    else
      select pg_catalog.to_jsonb(pg_catalog.count(*)) into v_counts from auth.users u where u.created_at >= from_date and u.created_at < to_date;
      v_json := v_json || pg_catalog.jsonb_build_object('current', coalesce(v_counts, '0'::jsonb));
      select pg_catalog.to_jsonb(pg_catalog.count(*)) into v_counts from auth.users u where u.created_at >= v_prev_from and u.created_at < v_prev_to;
      v_json := v_json || pg_catalog.jsonb_build_object('previous', coalesce(v_counts, '0'::jsonb));
    end if;
    if v_first_date is null then
      v_json := v_json || pg_catalog.jsonb_build_object('series', '[]'::jsonb);
    else
      with buckets as (
        select g.bucket::date as bucket_date
          from pg_catalog.generate_series(
            pg_catalog.date_trunc(v_bucket_unit, v_first_date::timestamp),
            pg_catalog.date_trunc(v_bucket_unit, v_last_date::timestamp),
            case granularity when 'daily' then interval '1 day' when 'weekly' then interval '1 week' else interval '1 month' end
          ) as g(bucket)
      ), counts as (
        select pg_catalog.date_trunc(v_bucket_unit, u.created_at at time zone 'America/New_York')::date as bucket_date,
               pg_catalog.count(*) as account_count
          from auth.users u
         where u.created_at is not null
           and (from_date is null or (u.created_at >= from_date and u.created_at < to_date))
         group by 1
      )
      select coalesce(
               pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('period', pg_catalog.to_char(b.bucket_date, 'YYYY-MM-DD'),
                 'count', coalesce(c.account_count, 0)) order by b.bucket_date), '[]'::jsonb)
        into v_counts from buckets b left join counts c using (bucket_date);
      v_json := v_json || pg_catalog.jsonb_build_object('series', coalesce(v_counts, '[]'::jsonb));
    end if;
    v_users := v_json;
  exception when others then
    v_users := null;
  end;

  -- Submission cohort status counts are current-state attributes. reviewed_at
  -- is mutable, so no historical approval/rejection trend is asserted.
  begin
    if from_date is null then
      v_first_date := null;
      v_last_date := null;
      select min((s.submitted_at at time zone 'America/New_York')::date),
             max((s.submitted_at at time zone 'America/New_York')::date)
        into v_first_date, v_last_date from public.event_submissions s where s.submitted_at is not null;
      if v_first_date is not null then v_last_date := greatest(v_last_date, v_today); end if;
    else
      v_first_date := pg_catalog.date_trunc(v_bucket_unit, v_start_local)::date;
      v_last_date := pg_catalog.date_trunc(v_bucket_unit, (v_end_local - interval '1 microsecond'))::date;
    end if;
    select pg_catalog.jsonb_build_object(
      'received', pg_catalog.count(*),
      'approved', pg_catalog.count(*) filter (where s.status = 'approved'),
      'rejected', pg_catalog.count(*) filter (where s.status = 'rejected'),
      'pending', pg_catalog.count(*) filter (where s.status in ('pending', 'in_review')),
      'needs_information', pg_catalog.count(*) filter (where s.status = 'needs_information'),
      'withdrawn', pg_catalog.count(*) filter (where s.status = 'withdrawn')
    ) into v_json
      from public.event_submissions s
     where from_date is null or (s.submitted_at >= from_date and s.submitted_at < to_date);
    if v_first_date is null then
      v_json := v_json || pg_catalog.jsonb_build_object('series', '[]'::jsonb);
    else
      with buckets as (
        select g.bucket::date as bucket_date from pg_catalog.generate_series(
          pg_catalog.date_trunc(v_bucket_unit, v_first_date::timestamp),
          pg_catalog.date_trunc(v_bucket_unit, v_last_date::timestamp),
          case granularity when 'daily' then interval '1 day' when 'weekly' then interval '1 week' else interval '1 month' end
        ) as g(bucket)
      ), counts as (
        select pg_catalog.date_trunc(v_bucket_unit, s.submitted_at at time zone 'America/New_York')::date as bucket_date,
               pg_catalog.count(*) as submissions_count
          from public.event_submissions s
         where s.submitted_at is not null
           and (from_date is null or (s.submitted_at >= from_date and s.submitted_at < to_date))
         group by 1
      )
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'period', pg_catalog.to_char(b.bucket_date, 'YYYY-MM-DD'), 'count', coalesce(c.submissions_count, 0)
      ) order by b.bucket_date), '[]'::jsonb) into v_counts
        from buckets b left join counts c using (bucket_date);
      v_json := v_json || pg_catalog.jsonb_build_object('series', coalesce(v_counts, '[]'::jsonb));
    end if;
    v_submissions := v_json;
  exception when others then
    v_submissions := null;
  end;

  -- Scheduled trends use current approved status across the selected event-date
  -- range. Active metro inventory and emerging metros remain current/upcoming.
  begin
    select pg_catalog.to_jsonb(pg_catalog.count(distinct e.city)) into v_counts
      from public.events e
     where e.status = 'approved' and e.event_date >= (v_today::timestamp at time zone 'America/New_York')
       and e.city is not null and exists (select 1 from public.metros m where m.slug = e.city);
    v_json := pg_catalog.jsonb_build_object('active_metros', coalesce(v_counts, '0'::jsonb), 'inventory_history_available', false);
    if from_date is null then
      v_first_date := null;
      v_last_date := null;
      select min((e.event_date at time zone 'America/New_York')::date),
             greatest(coalesce(max((e.event_date at time zone 'America/New_York')::date), v_today), v_today)
        into v_first_date, v_last_date
        from public.events e
       where e.status = 'approved';
      if v_first_date is not null then
        v_first_date := pg_catalog.date_trunc(v_bucket_unit, v_first_date::timestamp)::date;
        v_last_date := pg_catalog.date_trunc(v_bucket_unit, v_last_date::timestamp)::date;
      end if;
    else
      v_first_date := pg_catalog.date_trunc(v_bucket_unit, v_start_local)::date;
      v_last_date := pg_catalog.date_trunc(v_bucket_unit, (v_end_local - interval '1 microsecond'))::date;
    end if;
    if v_first_date is null then
      v_counts := '[]'::jsonb;
    else
      with buckets as (
        select g.bucket::date as bucket_date from pg_catalog.generate_series(
          pg_catalog.date_trunc(v_bucket_unit, v_first_date::timestamp),
          pg_catalog.date_trunc(v_bucket_unit, v_last_date::timestamp),
          case granularity when 'daily' then interval '1 day' when 'weekly' then interval '1 week' else interval '1 month' end
        ) as g(bucket)
      ), counts as (
        select pg_catalog.date_trunc(v_bucket_unit, e.event_date at time zone 'America/New_York')::date as bucket_date,
               nullif(pg_catalog.btrim(e.city), '') as slug,
               case when nullif(pg_catalog.btrim(e.city), '') is null then 'Unknown city'
                    else coalesce(m.name, e.city) end as city,
               pg_catalog.count(*) as event_count
          from public.events e left join public.metros m on m.slug = e.city
         where e.status = 'approved'
           and (from_date is null or (e.event_date >= from_date and e.event_date < to_date))
         group by 1, 2, 3
      )
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'period', pg_catalog.to_char(b.bucket_date, 'YYYY-MM-DD'), 'slug', c.slug, 'city', c.city, 'count', c.event_count
      ) order by b.bucket_date, c.city, c.slug nulls last), '[]'::jsonb) into v_counts
        from buckets b left join counts c using (bucket_date)
       where c.bucket_date is not null;
      v_counts := coalesce(v_counts, '[]'::jsonb);
    end if;
    v_json := v_json || pg_catalog.jsonb_build_object('scheduled', v_counts);

    with active as (
      select e.city as slug,
             coalesce(m.name, e.city) as city,
             min(e.created_at) as first_created_at,
             pg_catalog.count(*) filter (where e.event_date >= (v_today::timestamp at time zone 'America/New_York')) as upcoming
        from public.events e left join public.metros m on m.slug = e.city
       where e.status = 'approved' and e.city is not null
         and exists (select 1 from public.metros mx where mx.slug = e.city)
       group by e.city, m.name
      )
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'slug', a.slug, 'city', a.city, 'first_created_at', a.first_created_at, 'upcoming', a.upcoming
    ) order by a.first_created_at, a.city, a.slug), '[]'::jsonb) into v_counts
      from active a
     where a.upcoming > 0 and a.first_created_at is not null
       and (from_date is null or (a.first_created_at >= from_date and a.first_created_at < to_date));
    v_json := v_json || pg_catalog.jsonb_build_object('emerging', coalesce(v_counts, '[]'::jsonb));
    v_geography := v_json;
  exception when others then
    v_geography := null;
  end;

  -- Canonical style assignments override legacy values per event. Historical
  -- scheduled trends use current approval/style associations; inventory counts
  -- below remain restricted to currently upcoming events.
  begin
    with approved_events as (
      select e.id, e.event_date, e.dance_styles
        from public.events e
       where e.status = 'approved'
    ), upcoming as (
      select a.id, a.event_date, a.dance_styles
        from approved_events a
       where a.event_date >= (v_today::timestamp at time zone 'America/New_York')
    ), canonical as (
      select distinct a.id as event_id, a.event_date, t.slug, t.name as style
        from approved_events a
        join public.event_taxonomy_terms ett on ett.event_id = a.id
        join public.taxonomy_terms t on t.id = ett.taxonomy_term_id and t.category = 'dance_style'
    ), legacy as (
      select distinct a.id as event_id, a.event_date,
             coalesce(t.slug, normalized.style) as slug,
             coalesce(t.name, normalized.style) as style
        from approved_events a
        cross join lateral unnest(coalesce(a.dance_styles, array[]::text[])) as old_style(style)
        cross join lateral (select nullif(pg_catalog.lower(pg_catalog.btrim(old_style.style)), '') as style) normalized
        left join public.taxonomy_terms t on t.category = 'dance_style' and t.slug = normalized.style
       where normalized.style is not null
         and not exists (
           select 1 from public.event_taxonomy_terms ett
           join public.taxonomy_terms ct on ct.id = ett.taxonomy_term_id and ct.category = 'dance_style'
           where ett.event_id = a.id
         )
    ), associations as (
      select * from canonical union all select * from legacy
    ), styled as (
      select a.id as event_id, a.event_date, x.slug, x.style
        from approved_events a join associations x on x.event_id = a.id
      union all
      select a.id, a.event_date, null::text, 'Unspecified'::text
        from approved_events a
       where not exists (select 1 from associations x where x.event_id = a.id)
    ), distribution as (
      select s.slug, s.style, pg_catalog.count(distinct s.event_id) as event_count
        from styled s
       where s.event_date >= (v_today::timestamp at time zone 'America/New_York')
       group by s.slug, s.style
    ), schedule as (
      select pg_catalog.date_trunc(v_bucket_unit, s.event_date at time zone 'America/New_York')::date as bucket_date,
             s.slug, s.style, pg_catalog.count(distinct s.event_id) as event_count
        from styled s
       where from_date is null or (s.event_date >= from_date and s.event_date < to_date)
       group by 1, 2, 3
    )
    select pg_catalog.jsonb_build_object(
      'upcoming_total', (select pg_catalog.count(*) from upcoming),
      'distribution', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'slug', d.slug, 'style', d.style, 'count', d.event_count
      ) order by d.event_count desc, d.style, d.slug nulls last) from distribution d), '[]'::jsonb),
      'scheduled', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'period', pg_catalog.to_char(s.bucket_date, 'YYYY-MM-DD'), 'slug', s.slug, 'style', s.style, 'count', s.event_count
      ) order by s.bucket_date, s.style, s.slug nulls last) from schedule s), '[]'::jsonb)
    ) into v_styles;
  exception when others then
    v_styles := null;
  end;

  return pg_catalog.jsonb_build_object(
    'granularity', granularity,
    'as_of', v_now,
    'events', v_events,
    'users', v_users,
    'submissions', v_submissions,
    'geography', v_geography,
    'styles', v_styles
  );
end;
$$;

revoke execute on function public.admin_analytics_timeseries(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_analytics_timeseries(timestamptz, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';

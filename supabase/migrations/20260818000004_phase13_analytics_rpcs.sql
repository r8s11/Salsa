-- Phase 13 — analytics RPCs for the admin analytics page.
-- REQUIRED after 001_create_analytics_views.sql and the baseline schema.
-- SECURITY DEFINER, granted to authenticated, admin-role-gated inside the function.

-- ============================================================
-- 1. admin_analytics_metrics(from_date, to_date)
--    Returns a JSON object with all metric-card values:
--    published_events, new_users, rsvps, submissions,
--    plus their previous-period counterparts and deltas.
-- ============================================================

create or replace function public.admin_analytics_metrics(
  from_date timestamptz,
  to_date   timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- Admin role check
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  -- Previous period boundaries (same length, immediately before)
  declare
    v_range_days interval := to_date - from_date;
    v_prev_from  timestamptz := from_date - v_range_days;
    v_prev_to    timestamptz := from_date;
  begin
    select jsonb_build_object(
      'published_events',    count(*) filter (where status = 'approved' and event_date >= from_date and event_date < to_date),
      'published_events_prev', count(*) filter (where status = 'approved' and event_date >= v_prev_from and event_date < v_prev_to),
      'new_users',           (select count(*) from profiles where created_at >= from_date and created_at < to_date),
      'new_users_prev',      (select count(*) from profiles where created_at >= v_prev_from and created_at < v_prev_to),
      'rsvps',               count(*) filter (where rsvp_link is not null and rsvp_link <> '' and event_date >= from_date and event_date < to_date),
      'rsvps_prev',          count(*) filter (where rsvp_link is not null and rsvp_link <> '' and event_date >= v_prev_from and event_date < v_prev_to),
      'submissions',         (select count(*) from event_submissions where submitted_at >= from_date and submitted_at < to_date),
      'submissions_prev',    (select count(*) from event_submissions where submitted_at >= v_prev_from and submitted_at < v_prev_to)
    )
    into v_result
    from events;

    -- Attach deltas
    v_result := v_result || jsonb_build_object(
      'published_events_delta',    (v_result->>'published_events')::int - (v_result->>'published_events_prev')::int,
      'new_users_delta',           (v_result->>'new_users')::int - (v_result->>'new_users_prev')::int,
      'rsvps_delta',               (v_result->>'rsvps')::int - (v_result->>'rsvps_prev')::int,
      'submissions_delta',         (v_result->>'submissions')::int - (v_result->>'submissions_prev')::int
    );
  end;

  return v_result;
end;
$$;

revoke execute on function public.admin_analytics_metrics(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_analytics_metrics(timestamptz, timestamptz) to authenticated;

-- ============================================================
-- 2. admin_analytics_timeseries(from_date, to_date, granularity)
--    Returns JSON with two series: "events_by_week" and "submissions_by_week".
--    Granularity: 'daily', 'weekly', 'monthly'.
--    Uses the correct date_trunc for each series and each granularity.
-- ============================================================

create or replace function public.admin_analytics_timeseries(
  from_date    timestamptz,
  to_date      timestamptz,
  granularity  text default 'weekly'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_events_series jsonb;
  v_submissions_series jsonb;
  v_bucket_fn text; -- the date_trunc unit: 'day', 'week', 'month'
  v_label_fmt text; -- to_char format for the label
begin
  -- Admin role check
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  -- Map granularity to date_trunc unit + label format
  if granularity = 'daily' then
    v_bucket_fn := 'day';
    v_label_fmt := 'Dy Mon DD';
  elsif granularity = 'monthly' then
    v_bucket_fn := 'month';
    v_label_fmt := 'Mon YYYY';
  else  -- weekly (default)
    v_bucket_fn := 'week';
    v_label_fmt := 'Mon DD';
  end if;

  -- Published events by bucket
  execute format($q$
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by sort_key), '[]'::jsonb)
    from (
      select to_char(date_trunc('%I', event_date), '%s') as label,
             date_trunc('%I', event_date) as sort_key,
             count(*) as cnt
      from events
      where status = 'approved'
        and event_date >= from_date and event_date < to_date
      group by date_trunc('%I', event_date)
      order by sort_key
    ) s
  $q$, v_bucket_fn, v_label_fmt)
  into v_events_series;

  -- Submissions by bucket (same granularity)
  execute format($q$
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by sort_key), '[]'::jsonb)
    from (
      select to_char(date_trunc('%I', submitted_at), '%s') as label,
             date_trunc('%I', submitted_at) as sort_key,
             count(*) as cnt
      from event_submissions
      where submitted_at >= from_date and submitted_at < to_date
      group by date_trunc('%I', submitted_at)
      order by sort_key
    ) s
  $q$, v_bucket_fn, v_label_fmt)
  into v_submissions_series;

  return jsonb_build_object(
    'events_by_week', v_events_series,
    'submissions_by_week', v_submissions_series
  );
end;
$$;

revoke execute on function public.admin_analytics_timeseries(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_analytics_timeseries(timestamptz, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';

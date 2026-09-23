-- Demand telemetry — anonymous event-detail views and outbound RSVP clicks.
--
-- Why: admin_analytics_metrics() exposed "rsvps" = events WITH an rsvp_link.
-- That is supply (listing coverage), not demand. This migration records what
-- dancers actually do: open an event detail surface, click the outbound
-- RSVP link — and re-exposes both as the real demand metrics.
--
-- Privacy posture: a row carries event_id, kind, touched_at. No user id, no
-- session id, no referrer, no user agent, no IP. Deduplication (one touch
-- per browser per event per UTC day) happens client-side before the RPC.
--
-- Write seam: record_event_touch() only — SECURITY DEFINER, granted to
-- anon + authenticated. The table gets zero client grants, matching
-- 20260915000000_lock_down_raw_public_tables.sql posture: PostgREST clients
-- cannot read or write event_touches at all. Admin reads happen inside the
-- SECURITY DEFINER analytics RPCs below.
--
-- Known limitation: no server-side rate limit, so a spammer can inflate the
-- counters. Blast radius is the counters themselves; honest traffic stays
-- accurate via client-side dedupe.

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------

create table if not exists public.event_touches (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  kind       text not null check (kind in ('view', 'rsvp_click')),
  touched_at timestamptz not null default now()
);

-- RLS on, zero policies: every direct table access is denied regardless of
-- role. The function below is the only write path; admin RPCs the only read.
alter table public.event_touches enable row level security;

-- Analytics scans filter kind + time range; the FK index (leading prefix)
-- covers event-scoped lookups and the cascade delete path.
create index if not exists event_touches_kind_time_idx
  on public.event_touches (kind, touched_at);
create index if not exists event_touches_event_id_idx
  on public.event_touches (event_id);

-- No client table access at all — default privileges in this stack grant
-- table rights to anon/authenticated, and RLS-with-no-policies alone would
-- still leave an API surface (empty reads, 403 writes). Both layers off:
-- everything moves through the SECURITY DEFINER functions below.
revoke all on table public.event_touches from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Ingest RPC
-- ---------------------------------------------------------------------

create or replace function public.record_event_touch(
  p_event_id uuid,
  p_kind     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('view', 'rsvp_click') then
    raise exception 'invalid touch kind' using errcode = '22023';
  end if;

  -- Silent no-op for unknown or non-approved events: the response shape is
  -- identical in every case, so callers cannot probe which uuids exist.
  insert into public.event_touches (event_id, kind)
  select e.id, p_kind
  from public.events e
  where e.id = p_event_id
    and e.status = 'approved';
end;
$$;

revoke execute on function public.record_event_touch(uuid, text) from public, anon;
grant  execute on function public.record_event_touch(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. admin_analytics_metrics — replace "rsvps" (supply) with
--    event_views + rsvp_clicks (demand), previous-period pair + deltas.
-- ---------------------------------------------------------------------

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
      'event_views',         (select count(*) from event_touches where kind = 'view'       and touched_at >= from_date and touched_at < to_date),
      'event_views_prev',    (select count(*) from event_touches where kind = 'view'       and touched_at >= v_prev_from and touched_at < v_prev_to),
      'rsvp_clicks',         (select count(*) from event_touches where kind = 'rsvp_click' and touched_at >= from_date and touched_at < to_date),
      'rsvp_clicks_prev',    (select count(*) from event_touches where kind = 'rsvp_click' and touched_at >= v_prev_from and touched_at < v_prev_to),
      'submissions',         (select count(*) from event_submissions where submitted_at >= from_date and submitted_at < to_date),
      'submissions_prev',    (select count(*) from event_submissions where submitted_at >= v_prev_from and submitted_at < v_prev_to)
    )
    into v_result
    from events;

    -- Attach deltas
    v_result := v_result || jsonb_build_object(
      'published_events_delta',    (v_result->>'published_events')::int - (v_result->>'published_events_prev')::int,
      'new_users_delta',           (v_result->>'new_users')::int - (v_result->>'new_users_prev')::int,
      'event_views_delta',         (v_result->>'event_views')::int - (v_result->>'event_views_prev')::int,
      'rsvp_clicks_delta',         (v_result->>'rsvp_clicks')::int - (v_result->>'rsvp_clicks_prev')::int,
      'submissions_delta',         (v_result->>'submissions')::int - (v_result->>'submissions_prev')::int
    );
  end;

  return v_result;
end;
$$;

revoke execute on function public.admin_analytics_metrics(timestamptz, timestamptz) from public, anon;
grant  execute on function public.admin_analytics_metrics(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 4. admin_analytics_timeseries — add views + rsvp_clicks series.
-- ---------------------------------------------------------------------

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
  v_events_series    jsonb;
  v_views_series     jsonb;
  v_clicks_series    jsonb;
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

  -- Dynamic EXECUTE cannot see plpgsql parameters, and format() does not
  -- cycle arguments — so params travel as $1/$2 (USING) and directives are
  -- positional (%1$I bucket unit, %2$s label format).
  execute format($q$
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by sort_key), '[]'::jsonb)
    from (
      select to_char(date_trunc('%1$I', event_date), '%2$s') as label,
             date_trunc('%1$I', event_date) as sort_key,
             count(*) as cnt
      from events
      where status = 'approved'
        and event_date >= $1 and event_date < $2
      group by date_trunc('%1$I', event_date)
      order by sort_key
    ) s
  $q$, v_bucket_fn, v_label_fmt)
  into v_events_series using from_date, to_date;

  -- Demand: event-detail views by bucket (touch time, not event date)
  execute format($q$
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by sort_key), '[]'::jsonb)
    from (
      select to_char(date_trunc('%1$I', touched_at), '%2$s') as label,
             date_trunc('%1$I', touched_at) as sort_key,
             count(*) as cnt
      from event_touches
      where kind = 'view'
        and touched_at >= $1 and touched_at < $2
      group by date_trunc('%1$I', touched_at)
      order by sort_key
    ) s
  $q$, v_bucket_fn, v_label_fmt)
  into v_views_series using from_date, to_date;

  -- Demand: outbound RSVP link clicks by bucket
  execute format($q$
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by sort_key), '[]'::jsonb)
    from (
      select to_char(date_trunc('%1$I', touched_at), '%2$s') as label,
             date_trunc('%1$I', touched_at) as sort_key,
             count(*) as cnt
      from event_touches
      where kind = 'rsvp_click'
        and touched_at >= $1 and touched_at < $2
      group by date_trunc('%1$I', touched_at)
      order by sort_key
    ) s
  $q$, v_bucket_fn, v_label_fmt)
  into v_clicks_series using from_date, to_date;

  -- Submissions by bucket (same granularity)
  execute format($q$
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by sort_key), '[]'::jsonb)
    from (
      select to_char(date_trunc('%1$I', submitted_at), '%2$s') as label,
             date_trunc('%1$I', submitted_at) as sort_key,
             count(*) as cnt
      from event_submissions
      where submitted_at >= $1 and submitted_at < $2
      group by date_trunc('%1$I', submitted_at)
      order by sort_key
    ) s
  $q$, v_bucket_fn, v_label_fmt)
  into v_submissions_series using from_date, to_date;

  return jsonb_build_object(
    'events_by_week', v_events_series,
    'views_by_week', v_views_series,
    'rsvp_clicks_by_week', v_clicks_series,
    'submissions_by_week', v_submissions_series
  );
end;
$$;

revoke execute on function public.admin_analytics_timeseries(timestamptz, timestamptz, text) from public, anon;
grant  execute on function public.admin_analytics_timeseries(timestamptz, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';

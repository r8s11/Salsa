-- Admin Analytics Phase 3: event engagement analytics.
-- Reuses the existing event_touches store and collection RPC. No visitor identity
-- or source metadata is collected. The public RPC is bounded against burst abuse;
-- it is not a unique-visitor or distributed-bot control.

alter table public.event_touches drop constraint if exists event_touches_kind_check;
alter table public.event_touches add constraint event_touches_kind_check
  check (kind in ('view', 'rsvp_click', 'ticket_click', 'share'));

create index if not exists event_touches_event_kind_time_idx
  on public.event_touches (event_id, kind, touched_at);

create or replace function public.record_event_touch(p_event_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_lock_key bigint;
  v_count integer;
begin
  if p_event_id is null or p_kind is null
     or p_kind not in ('view', 'rsvp_click', 'ticket_click', 'share') then
    raise exception 'invalid touch' using errcode = '22023';
  end if;

  v_lock_key := pg_catalog.hashtextextended(
    p_event_id::text || ':' || p_kind || ':' || pg_catalog.floor(extract(epoch from v_now) / 60)::text,
    42
  );
  perform pg_catalog.pg_advisory_xact_lock(v_lock_key);

  select pg_catalog.count(*) into v_count
  from public.event_touches t
  where t.event_id = p_event_id and t.kind = p_kind
    and t.touched_at >= pg_catalog.date_trunc('minute', v_now)
    and t.touched_at < pg_catalog.date_trunc('minute', v_now) + interval '1 minute';
  if v_count >= 120 then return; end if;

  -- Unknown and non-public events are a silent no-op (no existence oracle).
  insert into public.event_touches (event_id, kind, touched_at)
  select e.id, p_kind, v_now
  from public.events e
  where e.id = p_event_id and e.status = 'approved'
    and (
      p_kind in ('view', 'share')
      or (nullif(pg_catalog.btrim(e.rsvp_link), '') is not null and (
        (p_kind = 'ticket_click' and e.price_type = 'paid')
        or (p_kind = 'rsvp_click' and e.price_type is distinct from 'paid')
      ))
    );
end;
$$;
revoke execute on function public.record_event_touch(uuid, text) from public, anon;
grant execute on function public.record_event_touch(uuid, text) to anon, authenticated;

create or replace function public.admin_event_engagement(
  from_date timestamptz,
  to_date timestamptz,
  sort_by text default 'detail_views'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_events jsonb;
  v_metros jsonb;
  v_styles jsonb;
  v_summary jsonb;
  v_first_touch timestamptz;
begin
  -- Check authorization before any guarded aggregation section.
  if auth.uid() is null
     or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if (from_date is null) <> (to_date is null)
     or (from_date is not null and from_date >= to_date) then
    raise exception 'invalid analytics date range' using errcode = '22023';
  end if;
  if sort_by is null or sort_by not in ('detail_views', 'rsvp_clicks', 'ticket_clicks', 'shares') then
    raise exception 'invalid sort_by' using errcode = '22023';
  end if;

  begin
    select pg_catalog.min(t.touched_at) into v_first_touch from public.event_touches t;
  exception when others then v_first_touch := null;
  end;

  begin
    with filtered as (
      select t.kind from public.event_touches t
      where from_date is null or (t.touched_at >= from_date and t.touched_at < to_date)
    ), counts as (
      select
        pg_catalog.count(*) filter (where kind = 'view') as views,
        pg_catalog.count(*) filter (where kind = 'rsvp_click') as rsvp,
        pg_catalog.count(*) filter (where kind = 'ticket_click') as tickets,
        pg_catalog.count(*) filter (where kind = 'share') as shares
      from filtered
    )
    select pg_catalog.jsonb_build_object(
      'detail_views', views, 'rsvp_clicks', rsvp, 'ticket_clicks', tickets,
      'shares', shares, 'outbound_clicks', rsvp + tickets,
      'click_to_view_ratio', case when views = 0 then null
        else pg_catalog.round(((rsvp + tickets)::numeric / views) * 100, 2) end
    ) into v_summary from counts;
  exception when others then v_summary := null;
  end;

  begin
    with touches as (
      select t.event_id, t.kind from public.event_touches t
      where from_date is null or (t.touched_at >= from_date and t.touched_at < to_date)
    ), grouped as (
      select t.event_id,
        pg_catalog.count(*) filter (where t.kind = 'view') as detail_views,
        pg_catalog.count(*) filter (where t.kind = 'rsvp_click') as rsvp_clicks,
        pg_catalog.count(*) filter (where t.kind = 'ticket_click') as ticket_clicks,
        pg_catalog.count(*) filter (where t.kind = 'share') as shares
      from touches t group by t.event_id
    ), ranked as (
      select g.*, e.title, e.event_date, e.status,
        nullif(pg_catalog.btrim(e.city), '') as city_slug,
        case when nullif(pg_catalog.btrim(e.city), '') is null then 'Unknown city'
          else coalesce(m.name, e.city) end as city
      from grouped g join public.events e on e.id = g.event_id
      left join public.metros m on m.slug = e.city
      order by case sort_by when 'detail_views' then g.detail_views
        when 'rsvp_clicks' then g.rsvp_clicks when 'ticket_clicks' then g.ticket_clicks
        else g.shares end desc, e.title asc
      limit 50
    )
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', event_id, 'title', title, 'event_date', event_date, 'status', status,
      'city_slug', city_slug, 'city', city, 'detail_views', detail_views,
      'rsvp_clicks', rsvp_clicks, 'ticket_clicks', ticket_clicks, 'shares', shares
    ) order by case sort_by when 'detail_views' then detail_views
      when 'rsvp_clicks' then rsvp_clicks when 'ticket_clicks' then ticket_clicks
      else shares end desc, title asc), '[]'::jsonb)
    into v_events from ranked;
  exception when others then v_events := null;
  end;

  begin
    with touches as (
      select t.event_id, t.kind from public.event_touches t
      where from_date is null or (t.touched_at >= from_date and t.touched_at < to_date)
    ), cities as (
      select e.id, nullif(pg_catalog.btrim(e.city), '') as slug from public.events e
    ), grouped as (
      select c.slug,
        pg_catalog.count(*) filter (where t.kind = 'view') as detail_views,
        pg_catalog.count(*) filter (where t.kind = 'rsvp_click') as rsvp_clicks,
        pg_catalog.count(*) filter (where t.kind = 'ticket_click') as ticket_clicks,
        pg_catalog.count(*) filter (where t.kind = 'share') as shares
      from touches t join cities c on c.id = t.event_id group by c.slug
    )
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'slug', g.slug, 'city', case when g.slug is null then 'Unknown city' else coalesce(m.name, g.slug) end,
      'detail_views', g.detail_views, 'rsvp_clicks', g.rsvp_clicks,
      'ticket_clicks', g.ticket_clicks, 'shares', g.shares
    ) order by g.detail_views desc, g.slug asc nulls last), '[]'::jsonb)
    into v_metros from grouped g left join public.metros m on m.slug = g.slug;
  exception when others then v_metros := null;
  end;

  begin
    with touches as (
      select t.event_id, t.kind from public.event_touches t
      where from_date is null or (t.touched_at >= from_date and t.touched_at < to_date)
    ), canonical as (
      select t.event_id, t.kind, tt.slug, tt.name
      from touches t join public.event_taxonomy_terms ett on ett.event_id = t.event_id
      join public.taxonomy_terms tt on tt.id = ett.taxonomy_term_id and tt.category = 'dance_style'
    ), fallback as (
      select t.event_id, t.kind,
        coalesce(tt.slug, s.slug) as slug,
        coalesce(tt.name, s.slug) as name
      from touches t join public.events e on e.id = t.event_id
      cross join lateral (
        select distinct pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(style)), '[^a-z0-9]+', '-', 'g') as slug
        from pg_catalog.unnest(e.dance_styles) style
        where nullif(pg_catalog.btrim(style), '') is not null
      ) s
      left join public.taxonomy_terms tt on tt.category = 'dance_style' and tt.slug = s.slug
      where not exists (
        select 1 from public.event_taxonomy_terms ett join public.taxonomy_terms tx on tx.id = ett.taxonomy_term_id
        where ett.event_id = t.event_id and tx.category = 'dance_style'
      )
    ), no_style as (
      select t.event_id, t.kind, 'unspecified'::text as slug, 'Unspecified'::text as name
      from touches t join public.events e on e.id = t.event_id
      where not exists (
        select 1 from public.event_taxonomy_terms ett join public.taxonomy_terms tx on tx.id = ett.taxonomy_term_id
        where ett.event_id = t.event_id and tx.category = 'dance_style'
      ) and not exists (
        select 1 from pg_catalog.unnest(e.dance_styles) style where nullif(pg_catalog.btrim(style), '') is not null
      )
    ), attributed as (
      select * from canonical union all select * from fallback union all select * from no_style
    ), grouped as (
      select slug, name,
        pg_catalog.count(*) filter (where kind = 'view') as detail_views,
        pg_catalog.count(*) filter (where kind = 'rsvp_click') as rsvp_clicks,
        pg_catalog.count(*) filter (where kind = 'share') as shares
      from attributed group by slug, name
    )
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'slug', slug, 'style', name, 'detail_views', detail_views,
      'rsvp_clicks', rsvp_clicks, 'shares', shares
    ) order by detail_views desc, name asc), '[]'::jsonb)
    into v_styles from grouped;
  exception when others then v_styles := null;
  end;

  return pg_catalog.jsonb_build_object(
    'as_of', v_now, 'first_recorded_at', v_first_touch, 'summary', v_summary,
    'events', v_events, 'metros', v_metros, 'styles', v_styles, 'saves_available', false
  );
end;
$$;
revoke execute on function public.admin_event_engagement(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_event_engagement(timestamptz, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';

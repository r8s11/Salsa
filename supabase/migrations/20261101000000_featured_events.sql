-- Optional homepage featuring. An admin or moderator can mark an approved,
-- not-yet-started event as featured; the homepage spotlights the earliest
-- upcoming featured event in the selected area and otherwise keeps its
-- automatic next-event choice. Several events may be featured at once so a
-- run of nights can be queued: each hands over to the next when it starts.
--
-- Additive only. Every existing row stays NULL (not featured), so the homepage
-- behaves exactly as before until someone features an event.

alter table public.events add column if not exists featured_at timestamptz;

comment on column public.events.featured_at is
  'When an admin or moderator featured this event on the homepage; NULL means not featured. Written only by set_event_featured().';

-- No UPDATE grant on featured_at: the column-level grants from
-- 20260914000000_harden_event_source_type_provenance.sql leave it unwritable
-- for direct clients. INSERT is a table-level grant (anon and authenticated
-- may submit), which a column revoke cannot narrow, so new rows are cleared
-- here: a submitter must not pre-feature a pending event that is later
-- approved, and a duplicated event never inherits its source's feature. The
-- UPDATE branch keeps that true if table-level UPDATE is ever re-granted.
create or replace function public.events_guard_featured_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.featured_at := null;
  elsif new.featured_at is distinct from old.featured_at
        and current_user in ('anon', 'authenticated') then
    raise exception 'featured_at is managed by set_event_featured()' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.events_guard_featured_at() from public, anon, authenticated;

drop trigger if exists events_guard_featured_at on public.events;
create trigger events_guard_featured_at
before insert or update of featured_at on public.events
for each row execute function public.events_guard_featured_at();

-- The one write path. Same authority as editing an event
-- (save_event_with_entities): an active admin or moderator account.
-- Featuring requires a published event that has not started; unfeaturing is
-- always allowed so a stale flag can be cleared on any row. Repeating the
-- current state is a no-op that keeps the original featured_at.
create or replace function public.set_event_featured(p_event_id uuid, p_featured boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  e public.events%rowtype;
  v_featured_at timestamptz;
begin
  if v_uid is null or not public.is_moderator() or not public.account_is_active(v_uid) then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;
  if p_featured is null then
    raise exception 'p_featured is required' using errcode = '22023';
  end if;

  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  if p_featured then
    if e.status <> 'approved' then
      raise exception 'Only published events can be featured' using errcode = '22023';
    end if;
    if e.event_date < now() then
      raise exception 'Events that have already started cannot be featured' using errcode = '22023';
    end if;
  end if;

  v_featured_at := case when p_featured then coalesce(e.featured_at, now()) end;
  if v_featured_at is not distinct from e.featured_at then
    return v_featured_at;
  end if;

  update public.events set featured_at = v_featured_at where id = p_event_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, target_type, target_id, target_name)
  values (
    v_uid,
    case when p_featured then 'event.featured' else 'event.unfeatured' end,
    'event',
    p_event_id,
    jsonb_build_object('title', e.title, 'city', e.city, 'event_date', e.event_date),
    'event',
    p_event_id,
    e.title
  );

  return v_featured_at;
end $$;
revoke all on function public.set_event_featured(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_event_featured(uuid, boolean) to authenticated;

-- Append column to keep all existing public_events column ordinals stable
-- (public_active_metros and public_active_locations select from this view).
create or replace view public.public_events as
select
 event.id,event.title,event.description,event.event_type,event.event_date,event.event_time,event.location,event.address,
 event.price_type,event.price_amount,event.rsvp_link,event.image_url,event.poster_image_url,event.status,event.source_type,
 event.city,event.host,event.recurrence,event.gallery,event.dance_styles,event.venue_id,event.organizer_id,
 event.created_at,event.updated_at,coalesce(taxonomy.terms,'[]'::jsonb) as event_taxonomy_terms,
 event.slug,event.series_id,public.public_event_entities(event.id) as public_entities,
 event.event_types,
 event.image_urls,
 event.sublocation,
 event.neighborhood,
 event.featured_at
from public.events event
left join lateral (
 select jsonb_agg(jsonb_build_object('taxonomy_term_id',term.id,'taxonomy_terms',jsonb_build_object(
  'id',term.id,'name',term.name,'slug',term.slug,'category',term.category,'status',term.status
 )) order by term.category,term.name) as terms
 from public.event_taxonomy_terms link join public.taxonomy_terms term on term.id=link.taxonomy_term_id
 where link.event_id=event.id and term.status='active'
) taxonomy on true
where event.status='approved';
alter view public.public_events set (security_invoker=false);
revoke all on table public.public_events from public;
grant select on table public.public_events to anon, authenticated;

notify pgrst, 'reload schema';

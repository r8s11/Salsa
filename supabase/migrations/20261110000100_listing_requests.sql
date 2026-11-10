-- Guided listing requests.
--
-- Signed-in people ask, in-product, for:
--
--   missing_listing   a School, Venue, Artist or DJ that is not in the directory
--   event_link        an approved event to appear on an Artist or DJ they manage
--   profile_change    a change to the name, city or page address of a listing they manage
--
-- Every request waits for a platform administrator. Nothing here publishes on
-- its own, and no request path touches events, organizer_members or
-- entity_members: approving an event link writes event_djs / event_instructors
-- only, so the event's organizer keeps sole control of the event.
--
-- The table is RPC-only (no direct grants), like entity_claims.

-- ------------------------------------------------------------
-- 1. Table
-- ------------------------------------------------------------

-- Names compare without case, spacing or punctuation: "Casa  Cuba!" is "casa cuba".
create or replace function public.listing_request_name_key(p_name text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select btrim(lower(regexp_replace(coalesce(p_name, ''), '[[:space:][:punct:]]+', ' ', 'g')));
$$;

create table if not exists public.listing_requests (
  id                  uuid primary key default gen_random_uuid(),
  request_type        text not null check (request_type in ('missing_listing', 'event_link', 'profile_change')),
  requester_id        uuid not null references auth.users(id) on delete cascade,
  entity_kind         text check (entity_kind in ('school', 'venue', 'instructor', 'dj')),
  entity_id           uuid,
  event_id            uuid references public.events(id) on delete cascade,
  proposed_name       text check (proposed_name is null or length(proposed_name) <= 200),
  proposed_city       text check (proposed_city is null or length(proposed_city) <= 120),
  website             text check (website is null or length(website) <= 500),
  instagram           text check (instagram is null or length(instagram) <= 200),
  details             text check (details is null or length(details) <= 2000),
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewer_id         uuid references auth.users(id) on delete set null,
  reviewed_at         timestamptz,
  review_note         text check (review_note is null or length(review_note) <= 2000),
  resulting_entity_id uuid,
  created_at          timestamptz not null default now(),
  constraint listing_requests_shape_check check (
    entity_kind is not null and case request_type
      when 'missing_listing' then proposed_name is not null and entity_id is null and event_id is null
      when 'event_link' then entity_kind in ('instructor', 'dj') and entity_id is not null and event_id is not null
      when 'profile_change' then entity_id is not null and event_id is null
    end
  )
);

create unique index if not exists listing_requests_pending_missing_idx
  on public.listing_requests (requester_id, entity_kind, public.listing_request_name_key(proposed_name))
  where status = 'pending' and request_type = 'missing_listing';
create unique index if not exists listing_requests_pending_event_link_idx
  on public.listing_requests (requester_id, entity_kind, entity_id, event_id)
  where status = 'pending' and request_type = 'event_link';
create unique index if not exists listing_requests_pending_profile_change_idx
  on public.listing_requests (requester_id, entity_kind, entity_id)
  where status = 'pending' and request_type = 'profile_change';
create index if not exists listing_requests_status_idx on public.listing_requests (status, created_at);
create index if not exists listing_requests_requester_idx on public.listing_requests (requester_id, created_at desc);

alter table public.listing_requests enable row level security;
revoke all on table public.listing_requests from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2. Submit
-- ------------------------------------------------------------

-- Signed in, active, and under the waiting-request limit. The lock makes the
-- limit hold when one person submits from two tabs at once.
create or replace function public.listing_request_assert_can_submit()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.account_is_active(auth.uid()) then
    raise exception 'Sign in to send a request.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('listing_request:' || auth.uid()::text, 0));
  if (select count(*) from public.listing_requests where requester_id = auth.uid() and status = 'pending') >= 10 then
    raise exception 'You have 10 requests waiting for review. Withdraw one or wait for a decision.' using errcode = '23514';
  end if;
end $$;

create or replace function public.listing_request_submit_missing(
  p_kind text, p_name text, p_city text, p_website text, p_instagram text, p_details text, p_checked_existing boolean
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_name text := nullif(btrim(p_name), '');
  v_city text := nullif(btrim(p_city), '');
  v_website text := nullif(btrim(p_website), '');
begin
  perform public.listing_request_assert_can_submit();
  if p_kind is null or p_kind not in ('school', 'venue', 'instructor', 'dj') then
    raise exception 'This kind of listing cannot be requested here.' using errcode = '22023';
  end if;
  if p_checked_existing is not true then
    raise exception 'Search the directory first and confirm the listing is not there.' using errcode = '22023';
  end if;
  if v_name is null or public.listing_request_name_key(v_name) = '' then
    raise exception 'Enter the name of the listing.' using errcode = '22023';
  end if;
  if v_website is not null and v_website !~* '^https://[^[:space:]]+$' then
    raise exception 'Website must be a full link starting with https://' using errcode = '22023';
  end if;
  if exists (
    select 1 from (
      select s.name, s.city, s.status from public.schools s where p_kind = 'school'
      union all
      select v.name, v.city, v.status from public.venues v where p_kind = 'venue'
      union all
      select i.name, i.city, i.status from public.instructors i where p_kind = 'instructor'
      union all
      select d.name, d.city, d.status from public.djs d where p_kind = 'dj'
    ) x
    where x.status in ('active', 'needs_review')
      and public.listing_request_name_key(x.name) = public.listing_request_name_key(v_name)
      and (v_city is null or public.listing_request_name_key(x.city) = public.listing_request_name_key(v_city))
  ) then
    raise exception 'A listing with that name already exists. Search for it and claim it instead.' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.listing_requests
     where requester_id = auth.uid() and status = 'pending' and request_type = 'missing_listing' and entity_kind = p_kind
       and public.listing_request_name_key(proposed_name) = public.listing_request_name_key(v_name)
  ) then
    raise exception 'You already asked for this listing. It is waiting for review.' using errcode = '23505';
  end if;
  insert into public.listing_requests (request_type, requester_id, entity_kind, proposed_name, proposed_city, website, instagram, details)
  values ('missing_listing', auth.uid(), p_kind, v_name, v_city, v_website, nullif(btrim(p_instagram), ''), nullif(btrim(p_details), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.listing_request_submit_event_link(p_kind text, p_entity_id uuid, p_event_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  -- Venue and school links describe an organizer's event; they are not requestable.
  if p_kind is null or p_kind not in ('instructor', 'dj') then
    raise exception 'Event links can only be requested for an Artist or DJ profile.' using errcode = '42501';
  end if;
  perform public.entity_workspace_require(p_kind, p_entity_id, array['owner', 'manager']);
  perform public.listing_request_assert_can_submit();
  if not exists (select 1 from public.events e where e.id = p_event_id and e.status = 'approved') then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if (p_kind = 'dj' and exists (select 1 from public.event_djs where event_id = p_event_id and dj_id = p_entity_id))
     or (p_kind = 'instructor' and exists (select 1 from public.event_instructors where event_id = p_event_id and instructor_id = p_entity_id)) then
    raise exception 'This event is already on that profile.' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.listing_requests
     where requester_id = auth.uid() and status = 'pending' and request_type = 'event_link'
       and entity_kind = p_kind and entity_id = p_entity_id and event_id = p_event_id
  ) then
    raise exception 'You already asked for this link. It is waiting for review.' using errcode = '23505';
  end if;
  insert into public.listing_requests (request_type, requester_id, entity_kind, entity_id, event_id, details)
  values ('event_link', auth.uid(), p_kind, p_entity_id, p_event_id, nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.listing_request_submit_profile_change(
  p_kind text, p_entity_id uuid, p_requested_name text, p_requested_city text, p_note text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_name text := nullif(btrim(p_requested_name), '');
  v_city text := nullif(btrim(p_requested_city), '');
  v_note text := nullif(btrim(p_note), '');
begin
  if p_kind is null or p_kind not in ('school', 'venue', 'instructor', 'dj') then
    raise exception 'This kind of listing cannot be changed here.' using errcode = '22023';
  end if;
  perform public.entity_workspace_require(p_kind, p_entity_id, array['owner', 'manager']);
  perform public.listing_request_assert_can_submit();
  if v_name is null and v_city is null and v_note is null then
    raise exception 'Say what should change: a new name, a new city, or a note.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.listing_requests
     where requester_id = auth.uid() and status = 'pending' and request_type = 'profile_change'
       and entity_kind = p_kind and entity_id = p_entity_id
  ) then
    raise exception 'You already asked for a change to this listing. It is waiting for review.' using errcode = '23505';
  end if;
  insert into public.listing_requests (request_type, requester_id, entity_kind, entity_id, proposed_name, proposed_city, details)
  values ('profile_change', auth.uid(), p_kind, p_entity_id, v_name, v_city, v_note)
  returning id into v_id;
  return v_id;
end $$;

-- ------------------------------------------------------------
-- 3. Reads and withdraw
-- ------------------------------------------------------------

-- Approved events not yet on that Artist/DJ: upcoming soonest first, then past most recent first.
create or replace function public.listing_request_event_candidates(p_kind text, p_entity_id uuid, p_query text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_q text := btrim(coalesce(p_query, ''));
begin
  if p_kind is null or p_kind not in ('instructor', 'dj') then
    raise exception 'Event links can only be requested for an Artist or DJ profile.' using errcode = '42501';
  end if;
  perform public.entity_workspace_require(p_kind, p_entity_id, array['owner', 'manager']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'title', q.title, 'event_date', q.event_date, 'location', q.location
    ) order by q.past, q.upcoming_date, q.past_date desc, q.id)
    from (
      select e.id, e.title, e.event_date, e.location,
             e.event_date < now() as past,
             case when e.event_date >= now() then e.event_date end as upcoming_date,
             case when e.event_date < now() then e.event_date end as past_date
        from public.events e
       where e.status = 'approved'
         and (v_q = '' or e.title ilike '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%')
         and not (p_kind = 'dj' and exists (select 1 from public.event_djs x where x.event_id = e.id and x.dj_id = p_entity_id))
         and not (p_kind = 'instructor' and exists (select 1 from public.event_instructors x where x.event_id = e.id and x.instructor_id = p_entity_id))
       order by e.event_date < now(),
                case when e.event_date >= now() then e.event_date end,
                e.event_date desc, e.id
       limit 20
    ) q), '[]'::jsonb);
end $$;

-- One request with its listing and event context (shared by the requester and admin reads).
create or replace function public.listing_request_summary(r public.listing_requests)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', r.id, 'request_type', r.request_type, 'status', r.status,
    'entity_kind', r.entity_kind, 'entity_id', r.entity_id,
    'entity_name', (select x.name from public.entity_workspace_ref(r.entity_kind, r.entity_id) x),
    'entity_slug', (select x.slug from public.entity_workspace_ref(r.entity_kind, r.entity_id) x),
    'event_id', r.event_id,
    'event_title', (select e.title from public.events e where e.id = r.event_id),
    'event_date', (select e.event_date from public.events e where e.id = r.event_id),
    'proposed_name', r.proposed_name, 'proposed_city', r.proposed_city, 'website', r.website,
    'instagram', r.instagram, 'details', r.details, 'review_note', r.review_note,
    'resulting_entity_id', r.resulting_entity_id,
    'resulting_entity_slug', (select x.slug from public.entity_workspace_ref(r.entity_kind, r.resulting_entity_id) x where x.status = 'active'),
    'created_at', r.created_at, 'reviewed_at', r.reviewed_at
  );
$$;

-- The caller's own requests, newest first.
create or replace function public.my_listing_requests()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(public.listing_request_summary(r) order by r.created_at desc, r.id), '[]'::jsonb)
    from public.listing_requests r
   where r.requester_id = auth.uid();
$$;

create or replace function public.listing_request_withdraw(p_request_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to withdraw a request.' using errcode = '42501';
  end if;
  select status into v_status from public.listing_requests
   where id = p_request_id and requester_id = auth.uid() for update;
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'This request was already decided.' using errcode = '23514';
  end if;
  update public.listing_requests set status = 'withdrawn' where id = p_request_id;
end $$;

-- ------------------------------------------------------------
-- 4. Admin
-- ------------------------------------------------------------

create or replace function public.admin_listing_requests(
  p_status text default 'pending', p_entity_kind text default null, p_entity_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(public.listing_request_summary(r) || jsonb_build_object(
      'requester_id', r.requester_id, 'email', u.email, 'display_name', pr.display_name,
      'member_role', (select m.member_role from public.entity_members m
         where m.entity_kind = r.entity_kind and m.entity_id = r.entity_id and m.user_id = r.requester_id and m.status = 'active'),
      'event_status', e.status, 'event_location', e.location, 'event_organizer_name', o.name,
      'already_linked', case r.entity_kind
        when 'dj' then exists (select 1 from public.event_djs x where x.event_id = r.event_id and x.dj_id = r.entity_id)
        when 'instructor' then exists (select 1 from public.event_instructors x where x.event_id = r.event_id and x.instructor_id = r.entity_id)
        else false end
    ) order by r.created_at, r.id)
    from public.listing_requests r
    join auth.users u on u.id = r.requester_id
    left join public.profiles pr on pr.id = r.requester_id
    left join public.events e on e.id = r.event_id
    left join public.organizers o on o.id = e.organizer_id
   where (p_status is null or r.status = p_status)
     and (p_entity_id is null or (r.entity_kind = p_entity_kind and r.entity_id = p_entity_id))), '[]'::jsonb);
end $$;

create or replace function public.admin_pending_listing_request_count()
returns integer language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  return (select count(*)::int from public.listing_requests where status = 'pending');
end $$;

-- Approving an event link adds the association and nothing else. Approving a
-- missing listing records the listing the admin created; the requester claims
-- it through the normal claim flow. Approving an identity change records that
-- the admin made it on the listing's admin page.
create or replace function public.admin_review_listing_request(
  p_request_id uuid, p_approve boolean, p_note text default null, p_resulting_entity_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.listing_requests%rowtype;
  v_note text := nullif(btrim(p_note), '');
  v_result uuid;
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if p_approve is null then
    raise exception 'Choose approve or reject.' using errcode = '22023';
  end if;
  select * into r from public.listing_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request was already decided.' using errcode = '23514';
  end if;

  if p_approve and r.request_type = 'event_link' then
    if not exists (select 1 from public.entity_workspace_ref(r.entity_kind, r.entity_id) x where x.status <> 'archived') then
      raise exception 'That profile is archived and can no longer be linked.' using errcode = '23514';
    end if;
    -- Hold the event row so it cannot be cancelled or archived mid-approval.
    perform 1 from public.events e where e.id = r.event_id and e.status = 'approved' for share;
    if not found then
      raise exception 'That event can no longer be linked.' using errcode = '23514';
    end if;
    if r.entity_kind = 'dj' then
      insert into public.event_djs (event_id, dj_id, position)
      values (r.event_id, r.entity_id,
        (select coalesce(max(position) + 1, 0) from public.event_djs where event_id = r.event_id))
      on conflict (event_id, dj_id) do nothing;
    else
      insert into public.event_instructors (event_id, instructor_id, position)
      values (r.event_id, r.entity_id,
        (select coalesce(max(position) + 1, 0) from public.event_instructors where event_id = r.event_id))
      on conflict (event_id, instructor_id) do nothing;
    end if;
  elsif p_approve and r.request_type = 'missing_listing' then
    if p_resulting_entity_id is null or not exists (
      select 1 from public.entity_workspace_ref(r.entity_kind, p_resulting_entity_id) x where x.status = 'active'
    ) then
      raise exception 'Choose the active listing that was created for this request.' using errcode = '22023';
    end if;
    v_result := p_resulting_entity_id;
  end if;

  update public.listing_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewer_id = auth.uid(), reviewed_at = now(), review_note = v_note, resulting_entity_id = v_result
   where id = r.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, reason, target_type, target_id)
  values (auth.uid(), case when p_approve then 'listing_request.approved' else 'listing_request.rejected' end,
    'listing_request', r.id,
    jsonb_build_object('request_type', r.request_type, 'requester_id', r.requester_id, 'event_id', r.event_id,
      'resulting_entity_id', v_result),
    v_note, r.entity_kind, coalesce(r.entity_id, v_result));

  return jsonb_build_object('request_id', r.id, 'approved', p_approve, 'request_type', r.request_type);
end $$;

-- ------------------------------------------------------------
-- 5. Grants
-- ------------------------------------------------------------

revoke all on function
  public.listing_request_name_key(text),
  public.listing_request_assert_can_submit(),
  public.listing_request_summary(public.listing_requests),
  public.listing_request_submit_missing(text, text, text, text, text, text, boolean),
  public.listing_request_submit_event_link(text, uuid, uuid, text),
  public.listing_request_submit_profile_change(text, uuid, text, text, text),
  public.listing_request_event_candidates(text, uuid, text),
  public.my_listing_requests(),
  public.listing_request_withdraw(uuid),
  public.admin_listing_requests(text, text, uuid),
  public.admin_pending_listing_request_count(),
  public.admin_review_listing_request(uuid, boolean, text, uuid)
from public, anon, authenticated;
grant execute on function
  public.listing_request_submit_missing(text, text, text, text, text, text, boolean),
  public.listing_request_submit_event_link(text, uuid, uuid, text),
  public.listing_request_submit_profile_change(text, uuid, text, text, text),
  public.listing_request_event_candidates(text, uuid, text),
  public.my_listing_requests(),
  public.listing_request_withdraw(uuid),
  public.admin_listing_requests(text, text, uuid),
  public.admin_pending_listing_request_count(),
  public.admin_review_listing_request(uuid, boolean, text, uuid)
to authenticated;

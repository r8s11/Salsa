-- Entity workspaces.
--
-- Schools, venues and instructors gain managers the way organizers already
-- have them (phase 6: organizer_members + organizer_requests):
--
--   entity_members   who manages a listing, as owner / manager / editor
--   entity_claims    "I run this listing" requests, decided by an admin
--
-- and schools gain the offerings their managers keep current:
--
--   school_classes          the weekly timetable (kept off the events calendar)
--   school_private_offers   private-lesson formats and rates
--   school_price_plans      drop-ins, class packs, memberships, bootcamps
--
-- Organizers stay on organizer_members; their RPCs, RLS and Host pages are
-- unchanged. Every new table is RPC-only: no direct grants to anon or
-- authenticated, so authorization lives in the SECURITY DEFINER functions.
--
-- Role ladder inside one listing:
--   owner    everything, including the team
--   manager  profile + offerings
--   editor   offerings only (front-desk timetable upkeep)
-- Platform admins act as owner on every listing.

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------

create table public.entity_members (
  entity_kind text not null check (entity_kind in ('school', 'venue', 'instructor')),
  entity_id   uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'owner' check (member_role in ('owner', 'manager', 'editor')),
  status      text not null default 'active' check (status in ('active', 'removed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (entity_kind, entity_id, user_id)
);
create index entity_members_user_active_idx on public.entity_members (user_id) where status = 'active';

create table public.entity_claims (
  id           uuid primary key default gen_random_uuid(),
  entity_kind  text not null check (entity_kind in ('school', 'venue', 'instructor')),
  entity_id    uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  relationship text not null check (relationship in ('owner', 'manager', 'staff', 'self')),
  message      text check (message is null or length(message) <= 2000),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewer_id  uuid references auth.users(id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text check (review_note is null or length(review_note) <= 2000),
  created_at   timestamptz not null default now()
);
create unique index entity_claims_one_pending_idx on public.entity_claims (entity_kind, entity_id, user_id) where status = 'pending';
create index entity_claims_status_idx on public.entity_claims (status, created_at);

create table public.school_classes (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  title            text not null check (length(btrim(title)) between 2 and 120),
  style_term_id    uuid references public.taxonomy_terms(id) on delete set null,
  level            text not null default 'all' check (level in ('all', 'beginner', 'improver', 'intermediate', 'advanced', 'open')),
  weekday          smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  start_time       time not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 480),
  instructor_id    uuid references public.instructors(id) on delete set null,
  instructor_name  text check (instructor_name is null or length(instructor_name) <= 200),
  room             text check (room is null or length(room) <= 120),
  drop_in_cents    integer check (drop_in_cents is null or drop_in_cents between 0 and 1000000),
  notes            text check (notes is null or length(notes) <= 1000),
  status           text not null default 'active' check (status in ('active', 'paused')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index school_classes_school_idx on public.school_classes (school_id, weekday, start_time);

create table public.school_private_offers (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  title            text not null check (length(btrim(title)) between 2 and 120),
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 480),
  price_cents      integer not null check (price_cents between 0 and 1000000),
  instructor_id    uuid references public.instructors(id) on delete set null,
  instructor_name  text check (instructor_name is null or length(instructor_name) <= 200),
  notes            text check (notes is null or length(notes) <= 1000),
  status           text not null default 'active' check (status in ('active', 'paused')),
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index school_private_offers_school_idx on public.school_private_offers (school_id, position);

create table public.school_price_plans (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 120),
  plan_type   text not null default 'class_pack' check (plan_type in ('drop_in', 'class_pack', 'membership', 'bootcamp', 'other')),
  price_cents integer not null check (price_cents between 0 and 10000000),
  class_count integer check (class_count is null or class_count between 1 and 1000),
  valid_days  integer check (valid_days is null or valid_days between 1 and 3660),
  notes       text check (notes is null or length(notes) <= 1000),
  status      text not null default 'active' check (status in ('active', 'paused')),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index school_price_plans_school_idx on public.school_price_plans (school_id, position);

alter table public.entity_members        enable row level security;
alter table public.entity_claims         enable row level security;
alter table public.school_classes        enable row level security;
alter table public.school_private_offers enable row level security;
alter table public.school_price_plans    enable row level security;

revoke all on table public.entity_members, public.entity_claims, public.school_classes,
  public.school_private_offers, public.school_price_plans from public, anon, authenticated;

-- Audit rows name the listing kind they touched.
alter table public.audit_logs drop constraint audit_logs_target_type_check;
alter table public.audit_logs add constraint audit_logs_target_type_check check (
  target_type is null or target_type = any (array[
    'event', 'event_submission', 'profile', 'organizer', 'venue', 'taxonomy_term', 'platform_settings',
    'school', 'instructor'
  ])
);

-- ------------------------------------------------------------
-- 2. Guards
-- ------------------------------------------------------------

-- A listing someone manages cannot silently disappear under them: merges and
-- archiving both set status = 'archived', so both stop here until the team is
-- removed (the organizer merge already refuses organizers with members).
create or replace function public.entity_members_block_archive()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'archived' and old.status is distinct from 'archived' and exists (
    select 1 from public.entity_members m
     where m.entity_kind = tg_argv[0] and m.entity_id = new.id and m.status = 'active'
  ) then
    raise exception 'This listing has an active team. Remove its managers before archiving or merging it.'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger schools_block_archive_with_team before update of status on public.schools
  for each row execute function public.entity_members_block_archive('school');
create trigger venues_block_archive_with_team before update of status on public.venues
  for each row execute function public.entity_members_block_archive('venue');
create trigger instructors_block_archive_with_team before update of status on public.instructors
  for each row execute function public.entity_members_block_archive('instructor');

-- Name and status of a managed listing, null when it does not exist.
create or replace function public.entity_workspace_ref(p_kind text, p_id uuid)
returns table (name text, slug text, status text, city text, image_url text)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.name, s.slug, s.status, s.city, s.image_url from public.schools s where p_kind = 'school' and s.id = p_id
  union all
  select v.name, v.slug, v.status, v.city, null::text from public.venues v where p_kind = 'venue' and v.id = p_id
  union all
  select i.name, i.slug, i.status, i.city, i.image_url from public.instructors i where p_kind = 'instructor' and i.id = p_id;
$$;

-- The caller's standing on one listing: 'admin', a member role, or null.
-- Archived listings have no workspace for anyone but admins.
create or replace function public.entity_workspace_role(p_kind text, p_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when auth.uid() is null or not public.account_is_active(auth.uid()) then null
    when not exists (select 1 from public.entity_workspace_ref(p_kind, p_id)) then null
    when public.is_admin() then 'admin'
    when (select r.status from public.entity_workspace_ref(p_kind, p_id) r) = 'archived' then null
    else (
      select m.member_role from public.entity_members m
       where m.entity_kind = p_kind and m.entity_id = p_id and m.user_id = auth.uid() and m.status = 'active'
    )
  end;
$$;

create or replace function public.entity_workspace_require(p_kind text, p_id uuid, p_allowed text[])
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_role text := public.entity_workspace_role(p_kind, p_id);
begin
  if v_role is null then
    raise exception 'You do not manage this listing.' using errcode = '42501';
  end if;
  if v_role <> 'admin' and not (v_role = any (p_allowed)) then
    raise exception 'Your role on this listing cannot make this change.' using errcode = '42501';
  end if;
  return v_role;
end $$;

-- ------------------------------------------------------------
-- 3. Memberships and the workspace read
-- ------------------------------------------------------------

create or replace function public.my_entity_memberships()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', m.entity_kind, 'id', m.entity_id, 'name', r.name, 'slug', r.slug,
      'status', r.status, 'city', r.city, 'image_url', r.image_url, 'member_role', m.member_role
    ) order by array_position(array['school', 'venue', 'instructor'], m.entity_kind), r.name), '[]'::jsonb)
    from public.entity_members m
    cross join lateral public.entity_workspace_ref(m.entity_kind, m.entity_id) r
   where m.user_id = auth.uid() and m.status = 'active' and r.status <> 'archived'
     and public.account_is_active(auth.uid());
$$;

create or replace function public.entity_workspace(p_kind text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_role text := public.entity_workspace_require(p_kind, p_id, array['owner', 'manager', 'editor']);
  v_entity jsonb;
  v_offerings jsonb := null;
begin
  if p_kind = 'school' then
    select jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'status', s.status, 'city', s.city,
      'state_region', s.state_region, 'country', s.country, 'address_line1', s.address_line1, 'postal_code', s.postal_code,
      'website', s.website, 'instagram', s.instagram, 'phone', s.phone, 'description', s.description, 'image_url', s.image_url)
      into v_entity from public.schools s where s.id = p_id;
    select jsonb_build_object(
      'classes', coalesce((select jsonb_agg(jsonb_build_object(
          'id', c.id, 'title', c.title, 'style_term_id', c.style_term_id, 'style_name', t.name, 'level', c.level,
          'weekday', c.weekday, 'start_time', to_char(c.start_time, 'HH24:MI'), 'duration_minutes', c.duration_minutes,
          'instructor_id', c.instructor_id, 'instructor_name', coalesce(i.name, c.instructor_name), 'instructor_slug', i.slug,
          'room', c.room, 'drop_in_cents', c.drop_in_cents, 'notes', c.notes, 'status', c.status
        ) order by c.weekday, c.start_time, c.title)
        from public.school_classes c
        left join public.taxonomy_terms t on t.id = c.style_term_id
        left join public.instructors i on i.id = c.instructor_id and i.status = 'active'
       where c.school_id = p_id), '[]'::jsonb),
      'privates', coalesce((select jsonb_agg(jsonb_build_object(
          'id', o.id, 'title', o.title, 'duration_minutes', o.duration_minutes, 'price_cents', o.price_cents,
          'instructor_id', o.instructor_id, 'instructor_name', coalesce(i.name, o.instructor_name), 'instructor_slug', i.slug,
          'notes', o.notes, 'status', o.status, 'position', o.position
        ) order by o.position, o.created_at)
        from public.school_private_offers o
        left join public.instructors i on i.id = o.instructor_id and i.status = 'active'
       where o.school_id = p_id), '[]'::jsonb),
      'plans', coalesce((select jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name, 'plan_type', p.plan_type, 'price_cents', p.price_cents, 'class_count', p.class_count,
          'valid_days', p.valid_days, 'notes', p.notes, 'status', p.status, 'position', p.position
        ) order by p.position, p.created_at)
        from public.school_price_plans p where p.school_id = p_id), '[]'::jsonb)
    ) into v_offerings;
  elsif p_kind = 'venue' then
    select jsonb_build_object('id', v.id, 'name', v.name, 'slug', v.slug, 'status', v.status, 'city', v.city,
      'state_region', v.state_region, 'country', v.country, 'address_line1', v.address_line1, 'address_line2', v.address_line2,
      'postal_code', v.postal_code, 'website', v.website, 'instagram', v.instagram, 'phone', v.phone)
      into v_entity from public.venues v where v.id = p_id;
  else
    select jsonb_build_object('id', i.id, 'name', i.name, 'slug', i.slug, 'status', i.status, 'city', i.city,
      'state_region', i.state_region, 'country', i.country, 'organization', i.organization, 'website', i.website,
      'instagram', i.instagram, 'description', i.description, 'image_url', i.image_url)
      into v_entity from public.instructors i where i.id = p_id;
  end if;

  return jsonb_build_object(
    'kind', p_kind,
    'role', v_role,
    'entity', v_entity,
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'email', u.email, 'display_name', pr.display_name,
        'member_role', m.member_role, 'created_at', m.created_at
      ) order by array_position(array['owner', 'manager', 'editor'], m.member_role), m.created_at)
      from public.entity_members m
      join auth.users u on u.id = m.user_id
      left join public.profiles pr on pr.id = m.user_id
     where m.entity_kind = p_kind and m.entity_id = p_id and m.status = 'active'), '[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(q.summary order by q.event_date)
      from (select public.entity_access_event_summary(x) as summary, x.event_date
              from public.entity_access_events(p_kind, p_id) x
             where x.event_date >= now() order by x.event_date limit 8) q), '[]'::jsonb),
    'offerings', v_offerings
  );
end $$;

-- ------------------------------------------------------------
-- 4. Profile edits (identity fields — name, slug, city, status — stay admin-only)
-- ------------------------------------------------------------

create or replace function public.entity_profile_save(p_kind text, p_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_allowed text[];
  v_key text;
begin
  perform public.entity_workspace_require(p_kind, p_id, array['owner', 'manager']);
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = '22023';
  end if;
  v_allowed := case p_kind
    when 'school' then array['description', 'image_url', 'website', 'instagram', 'phone', 'address_line1', 'postal_code']
    when 'venue' then array['website', 'instagram', 'phone', 'address_line1', 'address_line2', 'postal_code']
    when 'instructor' then array['description', 'image_url', 'website', 'instagram', 'organization']
  end;
  for v_key in select jsonb_object_keys(p_payload) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'Field % cannot be edited here', v_key using errcode = '22023';
    end if;
  end loop;

  if p_kind = 'school' then
    update public.schools set
      description   = case when p_payload ? 'description'   then nullif(btrim(p_payload->>'description'), '')   else description end,
      image_url     = case when p_payload ? 'image_url'     then nullif(btrim(p_payload->>'image_url'), '')     else image_url end,
      website       = case when p_payload ? 'website'       then nullif(btrim(p_payload->>'website'), '')       else website end,
      instagram     = case when p_payload ? 'instagram'     then nullif(btrim(p_payload->>'instagram'), '')     else instagram end,
      phone         = case when p_payload ? 'phone'         then nullif(btrim(p_payload->>'phone'), '')         else phone end,
      address_line1 = case when p_payload ? 'address_line1' then nullif(btrim(p_payload->>'address_line1'), '') else address_line1 end,
      postal_code   = case when p_payload ? 'postal_code'   then nullif(btrim(p_payload->>'postal_code'), '')   else postal_code end,
      updated_at    = now()
     where id = p_id;
  elsif p_kind = 'venue' then
    update public.venues set
      website       = case when p_payload ? 'website'       then nullif(btrim(p_payload->>'website'), '')       else website end,
      instagram     = case when p_payload ? 'instagram'     then nullif(btrim(p_payload->>'instagram'), '')     else instagram end,
      phone         = case when p_payload ? 'phone'         then nullif(btrim(p_payload->>'phone'), '')         else phone end,
      address_line1 = case when p_payload ? 'address_line1' then nullif(btrim(p_payload->>'address_line1'), '') else address_line1 end,
      address_line2 = case when p_payload ? 'address_line2' then nullif(btrim(p_payload->>'address_line2'), '') else address_line2 end,
      postal_code   = case when p_payload ? 'postal_code'   then nullif(btrim(p_payload->>'postal_code'), '')   else postal_code end,
      updated_at    = now()
     where id = p_id;
  else
    update public.instructors set
      description  = case when p_payload ? 'description'  then nullif(btrim(p_payload->>'description'), '')  else description end,
      image_url    = case when p_payload ? 'image_url'    then nullif(btrim(p_payload->>'image_url'), '')    else image_url end,
      website      = case when p_payload ? 'website'      then nullif(btrim(p_payload->>'website'), '')      else website end,
      instagram    = case when p_payload ? 'instagram'    then nullif(btrim(p_payload->>'instagram'), '')    else instagram end,
      organization = case when p_payload ? 'organization' then nullif(btrim(p_payload->>'organization'), '') else organization end,
      updated_at   = now()
     where id = p_id;
  end if;
end $$;

-- ------------------------------------------------------------
-- 5. School offerings
-- ------------------------------------------------------------

create or replace function public.school_offering_save(p_school_id uuid, p_type text, p_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_style uuid;
  v_instructor uuid;
begin
  perform public.entity_workspace_require('school', p_school_id, array['owner', 'manager', 'editor']);
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = '22023';
  end if;

  v_instructor := nullif(p_payload->>'instructor_id', '')::uuid;
  if v_instructor is not null and not exists (select 1 from public.instructors where id = v_instructor and status = 'active') then
    raise exception 'Unknown instructor' using errcode = '22023';
  end if;

  if p_type = 'class' then
    v_style := nullif(p_payload->>'style_term_id', '')::uuid;
    if v_style is not null and not exists (
      select 1 from public.taxonomy_terms where id = v_style and category = 'dance_style' and status = 'active'
    ) then
      raise exception 'Unknown dance style' using errcode = '22023';
    end if;
    if p_id is null then
      insert into public.school_classes (school_id, title, style_term_id, level, weekday, start_time, duration_minutes,
        instructor_id, instructor_name, room, drop_in_cents, notes, status)
      values (p_school_id, btrim(p_payload->>'title'), v_style, coalesce(nullif(p_payload->>'level', ''), 'all'),
        (p_payload->>'weekday')::smallint, (p_payload->>'start_time')::time,
        coalesce(nullif(p_payload->>'duration_minutes', '')::int, 60), v_instructor,
        nullif(btrim(p_payload->>'instructor_name'), ''), nullif(btrim(p_payload->>'room'), ''),
        nullif(p_payload->>'drop_in_cents', '')::int, nullif(btrim(p_payload->>'notes'), ''),
        coalesce(nullif(p_payload->>'status', ''), 'active'))
      returning id into v_id;
    else
      update public.school_classes set
        title = btrim(p_payload->>'title'), style_term_id = v_style, level = coalesce(nullif(p_payload->>'level', ''), 'all'),
        weekday = (p_payload->>'weekday')::smallint, start_time = (p_payload->>'start_time')::time,
        duration_minutes = coalesce(nullif(p_payload->>'duration_minutes', '')::int, 60), instructor_id = v_instructor,
        instructor_name = nullif(btrim(p_payload->>'instructor_name'), ''), room = nullif(btrim(p_payload->>'room'), ''),
        drop_in_cents = nullif(p_payload->>'drop_in_cents', '')::int, notes = nullif(btrim(p_payload->>'notes'), ''),
        status = coalesce(nullif(p_payload->>'status', ''), 'active'), updated_at = now()
       where id = p_id and school_id = p_school_id
      returning id into v_id;
    end if;
  elsif p_type = 'private' then
    if p_id is null then
      insert into public.school_private_offers (school_id, title, duration_minutes, price_cents, instructor_id,
        instructor_name, notes, status, position)
      values (p_school_id, btrim(p_payload->>'title'), coalesce(nullif(p_payload->>'duration_minutes', '')::int, 60),
        (p_payload->>'price_cents')::int, v_instructor, nullif(btrim(p_payload->>'instructor_name'), ''),
        nullif(btrim(p_payload->>'notes'), ''), coalesce(nullif(p_payload->>'status', ''), 'active'),
        coalesce(nullif(p_payload->>'position', '')::int,
          (select coalesce(max(position) + 1, 0) from public.school_private_offers where school_id = p_school_id)))
      returning id into v_id;
    else
      update public.school_private_offers set
        title = btrim(p_payload->>'title'), duration_minutes = coalesce(nullif(p_payload->>'duration_minutes', '')::int, 60),
        price_cents = (p_payload->>'price_cents')::int, instructor_id = v_instructor,
        instructor_name = nullif(btrim(p_payload->>'instructor_name'), ''), notes = nullif(btrim(p_payload->>'notes'), ''),
        status = coalesce(nullif(p_payload->>'status', ''), 'active'),
        position = coalesce(nullif(p_payload->>'position', '')::int, position), updated_at = now()
       where id = p_id and school_id = p_school_id
      returning id into v_id;
    end if;
  elsif p_type = 'plan' then
    if p_id is null then
      insert into public.school_price_plans (school_id, name, plan_type, price_cents, class_count, valid_days, notes, status, position)
      values (p_school_id, btrim(p_payload->>'name'), coalesce(nullif(p_payload->>'plan_type', ''), 'class_pack'),
        (p_payload->>'price_cents')::int, nullif(p_payload->>'class_count', '')::int, nullif(p_payload->>'valid_days', '')::int,
        nullif(btrim(p_payload->>'notes'), ''), coalesce(nullif(p_payload->>'status', ''), 'active'),
        coalesce(nullif(p_payload->>'position', '')::int,
          (select coalesce(max(position) + 1, 0) from public.school_price_plans where school_id = p_school_id)))
      returning id into v_id;
    else
      update public.school_price_plans set
        name = btrim(p_payload->>'name'), plan_type = coalesce(nullif(p_payload->>'plan_type', ''), 'class_pack'),
        price_cents = (p_payload->>'price_cents')::int, class_count = nullif(p_payload->>'class_count', '')::int,
        valid_days = nullif(p_payload->>'valid_days', '')::int, notes = nullif(btrim(p_payload->>'notes'), ''),
        status = coalesce(nullif(p_payload->>'status', ''), 'active'),
        position = coalesce(nullif(p_payload->>'position', '')::int, position), updated_at = now()
       where id = p_id and school_id = p_school_id
      returning id into v_id;
    end if;
  else
    raise exception 'Unknown offering type' using errcode = '22023';
  end if;

  if v_id is null then
    raise exception 'Offering not found' using errcode = 'P0002';
  end if;
  return v_id;
end $$;

create or replace function public.school_offering_delete(p_school_id uuid, p_type text, p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.entity_workspace_require('school', p_school_id, array['owner', 'manager', 'editor']);
  if p_type = 'class' then
    delete from public.school_classes where id = p_id and school_id = p_school_id;
  elsif p_type = 'private' then
    delete from public.school_private_offers where id = p_id and school_id = p_school_id;
  elsif p_type = 'plan' then
    delete from public.school_price_plans where id = p_id and school_id = p_school_id;
  else
    raise exception 'Unknown offering type' using errcode = '22023';
  end if;
  if not found then
    raise exception 'Offering not found' using errcode = 'P0002';
  end if;
end $$;

-- What a dancer sees on /s/:slug: active offerings of an active school.
create or replace function public.public_school_offerings(p_slug text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'classes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'style_name', t.name, 'level', c.level, 'weekday', c.weekday,
        'start_time', to_char(c.start_time, 'HH24:MI'), 'duration_minutes', c.duration_minutes,
        'instructor_name', coalesce(i.name, c.instructor_name), 'instructor_slug', i.slug,
        'room', c.room, 'drop_in_cents', c.drop_in_cents, 'notes', c.notes
      ) order by c.weekday, c.start_time, c.title)
      from public.school_classes c
      left join public.taxonomy_terms t on t.id = c.style_term_id and t.status = 'active'
      left join public.instructors i on i.id = c.instructor_id and i.status = 'active'
     where c.school_id = s.id and c.status = 'active'), '[]'::jsonb),
    'privates', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'title', o.title, 'duration_minutes', o.duration_minutes, 'price_cents', o.price_cents,
        'instructor_name', coalesce(i.name, o.instructor_name), 'instructor_slug', i.slug, 'notes', o.notes
      ) order by o.position, o.created_at)
      from public.school_private_offers o
      left join public.instructors i on i.id = o.instructor_id and i.status = 'active'
     where o.school_id = s.id and o.status = 'active'), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'plan_type', p.plan_type, 'price_cents', p.price_cents,
        'class_count', p.class_count, 'valid_days', p.valid_days, 'notes', p.notes
      ) order by p.position, p.created_at)
      from public.school_price_plans p where p.school_id = s.id and p.status = 'active'), '[]'::jsonb)
  )
  from public.schools s where s.slug = p_slug and s.status = 'active';
$$;

-- ------------------------------------------------------------
-- 6. Team
-- ------------------------------------------------------------

create or replace function public.entity_member_add(p_kind text, p_id uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid;
begin
  perform public.entity_workspace_require(p_kind, p_id, array['owner']);
  if p_role not in ('owner', 'manager', 'editor') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No Salsa Segura account uses that email. Ask them to sign up first.' using errcode = 'P0002';
  end if;
  insert into public.entity_members (entity_kind, entity_id, user_id, member_role, status)
  values (p_kind, p_id, v_user, p_role, 'active')
  on conflict (entity_kind, entity_id, user_id)
    do update set member_role = excluded.member_role, status = 'active', updated_at = now();
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, target_type, target_id)
  values (auth.uid(), 'entity_member.added', p_kind, p_id, jsonb_build_object('user_id', v_user, 'member_role', p_role), p_kind, p_id);
  return v_user;
end $$;

create or replace function public.entity_member_update(p_kind text, p_id uuid, p_user_id uuid, p_role text, p_remove boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.entity_workspace_require(p_kind, p_id, array['owner']);
  if not p_remove and p_role not in ('owner', 'manager', 'editor') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  update public.entity_members
     set member_role = case when p_remove then member_role else p_role end,
         status = case when p_remove then 'removed' else 'active' end,
         updated_at = now()
   where entity_kind = p_kind and entity_id = p_id and user_id = p_user_id and status = 'active';
  if not found then
    raise exception 'Team member not found' using errcode = 'P0002';
  end if;
  -- An owned listing keeps an owner; only an admin may leave it ownerless.
  if not public.is_admin() and not exists (
    select 1 from public.entity_members
     where entity_kind = p_kind and entity_id = p_id and status = 'active' and member_role = 'owner'
  ) then
    raise exception 'A listing needs at least one owner.' using errcode = '23514';
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, target_type, target_id)
  values (auth.uid(), case when p_remove then 'entity_member.removed' else 'entity_member.updated' end, p_kind, p_id,
    jsonb_build_object('user_id', p_user_id, 'member_role', p_role), p_kind, p_id);
end $$;

-- ------------------------------------------------------------
-- 7. Claims
-- ------------------------------------------------------------

create or replace function public.entity_claim_submit(p_kind text, p_id uuid, p_relationship text, p_message text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.account_is_active(auth.uid()) then
    raise exception 'Sign in to claim a listing.' using errcode = '42501';
  end if;
  if p_kind not in ('school', 'venue', 'instructor') then
    raise exception 'This kind of listing cannot be claimed.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.entity_workspace_ref(p_kind, p_id) r where r.status = 'active') then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.entity_members
     where entity_kind = p_kind and entity_id = p_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'You already manage this listing.' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.entity_claims
     where entity_kind = p_kind and entity_id = p_id and user_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'Your claim for this listing is already waiting for review.' using errcode = '23505';
  end if;
  insert into public.entity_claims (entity_kind, entity_id, user_id, relationship, message)
  values (p_kind, p_id, auth.uid(), p_relationship, nullif(btrim(p_message), ''))
  returning id into v_id;
  return v_id;
end $$;

-- The caller's own claims, newest first, so a listing page can say "waiting for review".
create or replace function public.my_entity_claims()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'kind', c.entity_kind, 'entity_id', c.entity_id, 'name', r.name, 'slug', r.slug,
      'relationship', c.relationship, 'status', c.status, 'review_note', c.review_note,
      'created_at', c.created_at, 'reviewed_at', c.reviewed_at
    ) order by c.created_at desc), '[]'::jsonb)
    from public.entity_claims c
    cross join lateral public.entity_workspace_ref(c.entity_kind, c.entity_id) r
   where c.user_id = auth.uid();
$$;

create or replace function public.admin_entity_claims(p_status text default 'pending')
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'kind', c.entity_kind, 'entity_id', c.entity_id, 'entity_name', r.name, 'entity_slug', r.slug,
      'entity_city', r.city, 'entity_status', r.status,
      'user_id', c.user_id, 'email', u.email, 'display_name', pr.display_name,
      'relationship', c.relationship, 'message', c.message, 'status', c.status,
      'review_note', c.review_note, 'reviewed_at', c.reviewed_at, 'created_at', c.created_at,
      'active_owner_count', (select count(*) from public.entity_members m
         where m.entity_kind = c.entity_kind and m.entity_id = c.entity_id and m.status = 'active' and m.member_role = 'owner')
    ) order by c.created_at)
    from public.entity_claims c
    cross join lateral public.entity_workspace_ref(c.entity_kind, c.entity_id) r
    join auth.users u on u.id = c.user_id
    left join public.profiles pr on pr.id = c.user_id
   where p_status is null or c.status = p_status), '[]'::jsonb);
end $$;

create or replace function public.admin_pending_entity_claim_count()
returns integer language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  return (select count(*)::int from public.entity_claims where status = 'pending');
end $$;

-- Approval grants ownership, or management when the listing already has an
-- owner (that owner can promote them). Never touches app_metadata roles.
create or replace function public.admin_review_entity_claim(p_claim_id uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.entity_claims%rowtype;
  v_role text;
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  select * into c from public.entity_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;
  if c.status <> 'pending' then
    raise exception 'This claim was already decided.' using errcode = '23514';
  end if;

  if p_approve then
    v_role := case when exists (
      select 1 from public.entity_members
       where entity_kind = c.entity_kind and entity_id = c.entity_id and status = 'active' and member_role = 'owner'
    ) then 'manager' else 'owner' end;
    insert into public.entity_members (entity_kind, entity_id, user_id, member_role, status)
    values (c.entity_kind, c.entity_id, c.user_id, v_role, 'active')
    on conflict (entity_kind, entity_id, user_id)
      do update set member_role = excluded.member_role, status = 'active', updated_at = now();
  end if;

  update public.entity_claims
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewer_id = auth.uid(), reviewed_at = now(), review_note = nullif(btrim(p_note), '')
   where id = c.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, reason, target_type, target_id)
  values (auth.uid(), case when p_approve then 'entity_claim.approved' else 'entity_claim.rejected' end,
    c.entity_kind, c.entity_id, jsonb_build_object('claim_id', c.id, 'user_id', c.user_id, 'member_role', v_role),
    nullif(btrim(p_note), ''), c.entity_kind, c.entity_id);

  return jsonb_build_object('claim_id', c.id, 'approved', p_approve, 'member_role', v_role);
end $$;

-- Admin view of who manages a listing (admin entity detail pages).
create or replace function public.admin_entity_members(p_kind text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'email', u.email, 'display_name', pr.display_name,
      'member_role', m.member_role, 'created_at', m.created_at
    ) order by array_position(array['owner', 'manager', 'editor'], m.member_role), m.created_at)
    from public.entity_members m
    join auth.users u on u.id = m.user_id
    left join public.profiles pr on pr.id = m.user_id
   where m.entity_kind = p_kind and m.entity_id = p_id and m.status = 'active'), '[]'::jsonb);
end $$;

-- ------------------------------------------------------------
-- 8. Grants
-- ------------------------------------------------------------

revoke all on function public.entity_members_block_archive() from public, anon, authenticated;
revoke all on function public.entity_workspace_ref(text, uuid) from public, anon, authenticated;
revoke all on function public.entity_workspace_role(text, uuid) from public, anon, authenticated;
revoke all on function public.entity_workspace_require(text, uuid, text[]) from public, anon, authenticated;

revoke all on function
  public.my_entity_memberships(),
  public.entity_workspace(text, uuid),
  public.entity_profile_save(text, uuid, jsonb),
  public.school_offering_save(uuid, text, uuid, jsonb),
  public.school_offering_delete(uuid, text, uuid),
  public.entity_member_add(text, uuid, text, text),
  public.entity_member_update(text, uuid, uuid, text, boolean),
  public.entity_claim_submit(text, uuid, text, text),
  public.my_entity_claims(),
  public.admin_entity_claims(text),
  public.admin_pending_entity_claim_count(),
  public.admin_review_entity_claim(uuid, boolean, text),
  public.admin_entity_members(text, uuid),
  public.public_school_offerings(text)
from public, anon, authenticated;

grant execute on function
  public.my_entity_memberships(),
  public.entity_workspace(text, uuid),
  public.entity_profile_save(text, uuid, jsonb),
  public.school_offering_save(uuid, text, uuid, jsonb),
  public.school_offering_delete(uuid, text, uuid),
  public.entity_member_add(text, uuid, text, text),
  public.entity_member_update(text, uuid, uuid, text, boolean),
  public.entity_claim_submit(text, uuid, text, text),
  public.my_entity_claims(),
  public.admin_entity_claims(text),
  public.admin_pending_entity_claim_count(),
  public.admin_review_entity_claim(uuid, boolean, text),
  public.admin_entity_members(text, uuid)
to authenticated;

grant execute on function public.public_school_offerings(text) to anon, authenticated;

alter table public.profiles
  add column if not exists username      text,
  add column if not exists status_reason text;

create unique index profiles_username_lower_idx on public.profiles (lower(username));
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$');
create index profiles_created_at_idx on public.profiles (created_at desc);

create function public.admin_user_directory()
returns table (
  kind           text,
  id             text,
  user_id        uuid,
  email          text,
  display_name   text,
  username       text,
  avatar_url     text,
  role           text,
  status         text,
  status_reason  text,
  created_at     timestamptz,
  last_active_at timestamptz,
  contributions  integer,
  pending_count  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  with profile_stats as (
    select e.submitter_id                                        as uid,
           count(*)::int                                         as total,
           count(*) filter (where e.status = 'pending')::int      as pending,
           max(e.created_at)                                      as last_event_at
      from public.events e
     where e.submitter_id is not null
     group by e.submitter_id
  ),
  guest_stats as (
    select lower(btrim(e.submitter_email))                                        as email,
           min(coalesce(nullif(btrim(e.submitter_name), ''), 'Guest Submitter'))   as name,
           count(*)::int                                                          as total,
           count(*) filter (where e.status = 'pending')::int                       as pending,
           max(e.created_at)                                                       as last_event_at,
           min(e.created_at)                                                       as first_event_at
      from public.events e
     where e.submitter_id is null
       and e.source_type = 'user_submission'
       and btrim(coalesce(e.submitter_email, '')) <> ''
     group by lower(btrim(e.submitter_email))
  )
  select 'profile'::text, p.id::text, p.id, u.email::text,
         p.display_name, p.username, p.avatar_url,
         p.role, p.status, p.status_reason, p.created_at,
         greatest(coalesce(u.last_sign_in_at, p.created_at),
                  coalesce(s.last_event_at, p.created_at)),
         coalesce(s.total, 0), coalesce(s.pending, 0)
    from public.profiles p
    join auth.users u on u.id = p.id
    left join profile_stats s on s.uid = p.id
  union all
  select 'guest'::text, 'guest:' || g.email, null::uuid, g.email,
         g.name, null::text, null::text,
         null::text, 'active', null::text, g.first_event_at,
         g.last_event_at, g.total, g.pending
    from guest_stats g
   where not exists (select 1 from auth.users u2 where lower(u2.email) = g.email);
end;
$$;

create function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_admins  int;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role.' using errcode = '42501';
  end if;
  if p_role not in ('user', 'moderator', 'organizer', 'admin') then
    raise exception 'Unknown role %', p_role using errcode = '22023';
  end if;

  select role into v_current from public.profiles where id = p_user_id for update;
  if v_current is null then
    raise exception 'No profile for %', p_user_id using errcode = 'P0002';
  end if;

  if v_current = 'admin' and p_role <> 'admin' then
    select count(*) into v_admins from public.profiles where role = 'admin';
    if v_admins <= 1 then
      raise exception 'This is the only Admin account. Promote another Admin first.'
        using errcode = '42501';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', p_role)
   where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'user.role_changed', 'profile', p_user_id,
          jsonb_build_object('from_role', v_current, 'to_role', p_role));
end;
$$;

create function public.admin_set_user_status(p_user_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_role    text;
  v_admins  int;
  v_reason  text := nullif(btrim(p_reason), '');
  v_action  text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own account status.' using errcode = '42501';
  end if;
  if p_status not in ('active', 'flagged', 'suspended', 'banned') then
    raise exception 'Unknown status %', p_status using errcode = '22023';
  end if;
  if p_status = 'banned' and v_reason is null then
    raise exception 'A reason is required to ban an account.' using errcode = '22023';
  end if;

  select status, role into v_current, v_role
    from public.profiles where id = p_user_id for update;
  if v_current is null then
    raise exception 'No profile for %', p_user_id using errcode = 'P0002';
  end if;

  if v_role = 'admin' and p_status in ('suspended', 'banned') then
    select count(*) into v_admins
      from public.profiles where role = 'admin' and status = 'active';
    if v_admins <= 1 then
      raise exception 'This is the only active Admin account.' using errcode = '42501';
    end if;
  end if;

  update public.profiles
     set status        = p_status,
         status_reason = case when p_status = 'active' then null else v_reason end
   where id = p_user_id;

  update auth.users
     set banned_until = case when p_status = 'banned' then 'infinity'::timestamptz end
   where id = p_user_id;

  v_action := case
    when p_status = 'flagged'   then 'user.flagged'
    when p_status = 'suspended' then 'user.suspended'
    when p_status = 'banned'    then 'user.banned'
    when v_current = 'flagged'  then 'user.unflagged'
    else 'user.restored'
  end;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_action, 'profile', p_user_id,
          jsonb_build_object('from_status', v_current, 'to_status', p_status, 'reason', v_reason));
end;
$$;

create function public.account_is_active(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((select status = 'active' from public.profiles where id = p_user_id), true);
$$;

alter policy "Anon can submit pending events" on public.events
  with check (status = 'pending'
              and submitter_id is not distinct from auth.uid()
              and public.account_is_active(auth.uid()));

revoke execute on function public.admin_user_directory()                          from public, anon;
revoke execute on function public.admin_set_user_role(uuid, text)                 from public, anon;
revoke execute on function public.admin_set_user_status(uuid, text, text)         from public, anon;
revoke execute on function public.account_is_active(uuid)                         from public;
-- account_is_active is SECURITY INVOKER (safe for anon to call), but admin
-- functions must never be callable without authentication.
grant  execute on function public.admin_user_directory()                          to authenticated;
grant  execute on function public.admin_set_user_role(uuid, text)                 to authenticated;
grant  execute on function public.admin_set_user_status(uuid, text, text)         to authenticated;
grant  execute on function public.account_is_active(uuid)                         to anon, authenticated;

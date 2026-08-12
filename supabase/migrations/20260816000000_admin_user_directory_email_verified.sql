-- Phase 6 — admin_user_directory() gains email_confirmed_at (from
-- auth.users) for the User Detail page's Email Verified chip. Postgres
-- rejects changing a set-returning function's column list via CREATE OR
-- REPLACE, so this drops and recreates the function, then re-grants
-- (the grants from 20260815000000_users_management.sql do not survive a
-- drop — the function becomes a new catalog object).

drop function if exists public.admin_user_directory();

create function public.admin_user_directory()
returns table (
  kind                text,
  id                  text,
  user_id             uuid,
  email               text,
  display_name        text,
  username            text,
  avatar_url          text,
  role                text,
  status              text,
  status_reason       text,
  created_at          timestamptz,
  last_active_at      timestamptz,
  contributions       integer,
  pending_count       integer,
  email_confirmed_at  timestamptz
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
         coalesce(s.total, 0), coalesce(s.pending, 0),
         u.email_confirmed_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join profile_stats s on s.uid = p.id
  union all
  select 'guest'::text, 'guest:' || g.email, null::uuid, g.email,
         g.name, null::text, null::text,
         null::text, 'active', null::text, g.first_event_at,
         g.last_event_at, g.total, g.pending,
         null::timestamptz
    from guest_stats g
   where not exists (select 1 from auth.users u2 where lower(u2.email) = g.email);
end;
$$;

revoke execute on function public.admin_user_directory() from public;
grant  execute on function public.admin_user_directory() to authenticated;

notify pgrst, 'reload schema';

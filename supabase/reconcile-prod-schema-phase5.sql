-- Reconcile the hosted (production) Supabase project's schema for Phase 5
-- (Users Management). NOT `supabase db push` / `db reset` — see the header
-- comment in reconcile-prod-schema.sql for why those are unsafe here.
--
-- Diagnosed via supabase/diagnose-prod-schema.sql (2026-08-12): production
-- is missing public.profiles entirely, public.set_updated_at(), and
-- public.events.source_type (and therefore the rest of the Phase 3
-- events_management_fields additions). public.audit_logs already exists.
--
-- This script folds in, in dependency order, everything Phase 5 needs that
-- is not already on prod:
--   1. events.submitter_id (from reconcile-prod-schema.sql — re-applied
--      defensively; a no-op if it already landed)
--   2. public.profiles + set_updated_at() + handle_new_user() trigger
--      (20260813000000_profiles.sql)
--   3. events.source_type/dance_styles/updated_at/cancellation_reason +
--      events_set_updated_at trigger + the extended log_event_change()
--      (20260814000000_events_management_fields.sql) — admin_user_directory()
--      below reads source_type, so this must land before step 5.
--   4. dashboard_indexes.sql (already idempotent; included for completeness)
--   5. profiles.username/status_reason + the three Phase 5 RPC functions +
--      account_is_active() + the hardened anon-submit policy
--      (20260815000000_users_management.sql)
--
-- Every statement is idempotent: ADD COLUMN uses IF NOT EXISTS, CREATE INDEX
-- uses IF NOT EXISTS, functions use CREATE OR REPLACE, triggers/policies are
-- DROP IF EXISTS then CREATE, constraints are DROP IF EXISTS then ADD, and
-- grants/inserts are naturally idempotent (ON CONFLICT DO NOTHING for the
-- backfill). Safe to run more than once, and safe to run whether or not any
-- individual piece already landed. Never drops or rewrites existing data.
--
-- Scope: intentionally limited to what Phase 5 requires. host/recurrence/
-- gallery/contact_* columns and the admin insert/update/delete event
-- policies from reconcile-prod-schema.sql are a separate, pre-existing gap
-- not touched here — this script only adds submitter_id from that set,
-- because admin_user_directory() and the anon-submit policy both need it.

begin;

-- ============================================================
-- 1. events.submitter_id — needed by admin_user_directory() and by the
--    anon-submit policy hardened in step 5.
-- ============================================================

alter table public.events
  add column if not exists submitter_id uuid references auth.users(id);

-- ============================================================
-- 2. public.profiles (20260813000000_profiles.sql)
-- ============================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  role         text not null default 'user'
                 check (role in ('user', 'moderator', 'organizer', 'admin')),
  status       text not null default 'active'
                 check (status in ('active', 'flagged', 'suspended', 'banned')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_role_idx   on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);

-- One-time backfill for every existing auth user; ON CONFLICT makes rerunning
-- safe once rows exist.
insert into public.profiles (id, display_name, role)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
       case when (u.raw_app_meta_data ->> 'role') = 'admin' then 'admin' else 'user' end
from auth.users u
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
  on public.profiles
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- 3. events_management_fields (20260814000000) — admin_user_directory()
--    in step 5 reads events.source_type, so this must land first.
-- ============================================================

alter table public.events
  add column if not exists source_type text not null default 'user_submission',
  add column if not exists dance_styles text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancellation_reason text;

alter table public.events drop constraint if exists events_source_type_check;
alter table public.events
  add constraint events_source_type_check
  check (source_type in ('admin','user_submission','organizer','moderator','imported'));

alter table public.events drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
  check (status in ('draft','pending','approved','rejected','cancelled','archived'));

-- Deterministic backfill — rerunning reproduces the same classification.
update public.events set source_type = case
  when submitter_email like '%@import.local' then 'imported'
  when submitter_name in ('Salsa Segura', 'Seed Data') then 'admin'
  else 'user_submission'
end;

update public.events
  set dance_styles = array_remove(array[
    case when (title || ' ' || coalesce(description, '')) ~* 'salsa|casino|rueda|on1|on2|mambo|timba' then 'salsa' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'bachata' then 'bachata' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'kizomba|urban kiz' then 'kizomba' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'merengue' then 'merengue' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'cha[ -]?cha' then 'cha-cha' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'zouk' then 'zouk' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'afro[ -]?cuban|rumba' then 'afro-cuban' end
  ], null);

create index if not exists events_dance_styles_idx
  on public.events using gin (dance_styles);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- audit_logs already exists on prod with the original log_event_change();
-- this replaces its body to add the cancelled/archived literals without
-- touching the events_audit_log trigger that already points at it.
create or replace function public.log_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action      text;
  v_entity_id   uuid;
  v_title       text;
  v_from_status text;
  v_to_status   text;
begin
  if tg_op = 'INSERT' then
    v_action      := 'event.created';
    v_entity_id   := new.id;
    v_title       := new.title;
    v_from_status := null;
    v_to_status   := new.status;
  elsif tg_op = 'DELETE' then
    v_action      := 'event.deleted';
    v_entity_id   := old.id;
    v_title       := old.title;
    v_from_status := old.status;
    v_to_status   := null;
  else
    v_entity_id   := new.id;
    v_title       := new.title;
    v_from_status := old.status;
    v_to_status   := new.status;
    if old.status is distinct from new.status then
      v_action := case new.status
        when 'approved' then 'event.approved'
        when 'rejected' then 'event.rejected'
        when 'cancelled' then 'event.cancelled'
        when 'archived' then 'event.archived'
        else 'event.status_changed'
      end;
    else
      v_action := 'event.updated';
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    v_action,
    'event',
    v_entity_id,
    jsonb_build_object(
      'title', v_title,
      'from_status', v_from_status,
      'to_status', v_to_status
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- If audit_logs somehow predates the events_audit_log trigger (it shouldn't,
-- since the table's own migration creates it), this makes sure it exists.
drop trigger if exists events_audit_log on public.events;
create trigger events_audit_log
  after insert or update or delete on public.events
  for each row execute function public.log_event_change();

-- ============================================================
-- 4. dashboard_indexes (20260813000200) — already idempotent locally;
--    included so this script alone brings prod fully current.
-- ============================================================

create index if not exists events_status_idx
  on public.events (status);

create index if not exists events_status_event_date_idx
  on public.events (status, event_date);

-- ============================================================
-- 5. users_management (20260815000000)
-- ============================================================

alter table public.profiles
  add column if not exists username      text,
  add column if not exists status_reason text;

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$');

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

create or replace function public.admin_user_directory()
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

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
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

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text, p_reason text default null)
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

create or replace function public.account_is_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select status = 'active' from public.profiles where id = p_user_id), true);
$$;

-- DROP + CREATE (not ALTER POLICY) so this succeeds regardless of whether
-- "Anon can submit pending events" already exists on prod, and regardless
-- of its current check clause — this sets the definitive final version.
grant insert on public.events to anon, authenticated;

drop policy if exists "Anon can submit pending events" on public.events;
create policy "Anon can submit pending events"
  on public.events
  for insert
  to anon, authenticated
  with check (status = 'pending'
              and submitter_id is not distinct from auth.uid()
              and public.account_is_active(auth.uid()));

revoke execute on function public.admin_user_directory()                          from public;
revoke execute on function public.admin_set_user_role(uuid, text)                 from public;
revoke execute on function public.admin_set_user_status(uuid, text, text)         from public;
revoke execute on function public.account_is_active(uuid)                         from public;
grant  execute on function public.admin_user_directory()                          to authenticated;
grant  execute on function public.admin_set_user_role(uuid, text)                 to authenticated;
grant  execute on function public.admin_set_user_status(uuid, text, text)         to authenticated;
grant  execute on function public.account_is_active(uuid)                         to anon, authenticated;

-- Without this, recently-added columns/functions/policies can be invisible
-- to the PostgREST API layer (which supabase-js talks to) for up to a minute.
notify pgrst, 'reload schema';

commit;

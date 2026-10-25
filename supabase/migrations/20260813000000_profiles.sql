-- profiles: dashboard-facing user table. NOT an authorization source —
-- RequireAdmin and every RLS policy continue to read auth.jwt() ->
-- 'app_metadata' ->> 'role'. role/status here are display/derivation
-- fields only.
create table public.profiles (
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

create index profiles_role_idx   on public.profiles (role);
create index profiles_status_idx on public.profiles (status);

-- One-time backfill for every existing auth user, seeding role from
-- app_metadata so the new column agrees with the live authorization
-- source from day one.
insert into public.profiles (id, display_name, role)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
       case when (u.raw_app_meta_data ->> 'role') = 'admin' then 'admin' else 'user' end
from auth.users u
on conflict (id) do nothing;

-- Keep it populated for every future signup.
create function public.handle_new_user()
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger functions are not safe to call via RPC — revoke from public/anon.
revoke execute on function public.handle_new_user() from public, anon;

create function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Grants sit below policies — without grant select, RLS policy is never evaluated.
grant select on public.profiles to authenticated;

create policy "Users read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "Admins read all profiles"
  on public.profiles
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

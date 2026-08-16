-- Phase 14 — admin_invite_user RPC
-- Adds the ability for an admin to invite a new user from the Users page.
-- This function creates an auth.users row + matching profiles row,
-- and logs the action to audit_logs.
--
-- Run this AFTER 20260815000000_users_management.sql has been applied.
-- SECURITY: This RPC is SECURITY DEFINER and admin-gated via auth.jwt().

create or replace function public.admin_invite_user(
  p_email        text,
  p_display_name text default null,
  p_role         text  default 'user'
)
returns table (
  id             uuid,
  email          text,
  display_name   text,
  username       text,
  role           text,
  status         text,
  created_at     timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_display_name text := nullif(btrim(p_display_name), '');
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_role not in ('user', 'moderator', 'organizer', 'admin') then
    raise exception 'Unknown role %', p_role using errcode = '22023';
  end if;
  if trim(both from p_email) = '' then
    raise exception 'Email is required' using errcode = '22023';
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, role, app_metadata, raw_app_meta_data, raw_user_meta_data
  ) values (
    v_user_id, lower(trim(both from p_email)), crypt(gen_random_uuid()::text, gen_salt('bf')),
    now(), now(), 'authenticated',
    jsonb_build_object('role', p_role),
    jsonb_build_object('role', p_role),
    jsonb_build_object('name', v_display_name)
  );

  insert into public.profiles (id, display_name, role, status)
  values (v_user_id, v_display_name, p_role, 'active');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'user.invited', 'profile', v_user_id,
          jsonb_build_object('email', lower(trim(both from p_email)), 'role', p_role));

  return query
  select
    v_user_id,
    lower(trim(both from p_email)),
    v_display_name,
    null::text,
    p_role,
    'active',
    now();
end;
$$;

revoke execute on function public.admin_invite_user(text, text, text) from public, anon;
grant execute on function public.admin_invite_user(text, text, text) to authenticated;

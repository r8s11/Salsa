-- Fix public.admin_invite_user — it could never create a user.
--
-- Defects in 20260815000000_users_management.sql, in the order they fired:
--   1. INSERT listed a column `app_metadata` that does not exist on auth.users
--      (the real column is raw_app_meta_data) -> 42703 on every call.
--   2. `set search_path = public` made crypt()/gen_salt() unresolvable: pgcrypto
--      lives in the `extensions` schema -> 42883. Now schema-qualified.
--   3. The AFTER INSERT trigger auth.users -> public.handle_new_user() already
--      inserts the profile row, so the function's own plain INSERT into
--      public.profiles hit profiles_pkey -> 23505. Now ON CONFLICT DO UPDATE.
--   4. raw_user_meta_data used key `name`, but handle_new_user() reads
--      `display_name`, so the trigger fell back to the email local-part.
--   5. aud and the GoTrue token columns (confirmation_token, recovery_token,
--      email_change, email_change_token_new/current, reauthentication_token)
--      were left NULL. GoTrue scans those into Go strings; NULL breaks
--      sign-in with "converting NULL to string is unsupported". Now ''.
--   6. No auth.identities row was created, so the email provider was not
--      linked to the account.
--
-- Access model: this project is hosted on Azure Static Web Apps (no server
-- runtime) and has no custom SMTP (supabase/config.toml leaves
-- [auth.email.smtp] disabled, auth.rate_limit.email_sent = 2/hour), so a real
-- invite email via auth.admin.inviteUserByEmail is not available. The function
-- therefore provisions a confirmed account with a generated temporary password
-- and returns it once to the calling admin to hand over out of band. It is
-- never stored in plaintext — only the bcrypt hash lands in auth.users.
--
-- The return signature gains temp_password, so the old function must be
-- dropped: CREATE OR REPLACE cannot change OUT parameters.

drop function if exists public.admin_invite_user(text, text, text);

create function public.admin_invite_user(
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
  created_at     timestamptz,
  temp_password  text
)
language plpgsql
security definer
set search_path = public
as $$
-- RETURNS TABLE names (id, email, role, status, ...) are plpgsql variables and
-- would shadow the identically named profiles columns in `on conflict (id)`.
-- Every local below is v_-prefixed and no OUT parameter is ever read, so
-- resolving bare names to columns is unambiguously correct.
#variable_conflict use_column
declare
  v_user_id       uuid := gen_random_uuid();
  v_email         text := lower(btrim(p_email));
  v_display_name  text := nullif(btrim(p_display_name), '');
  v_password      text;
  v_now           timestamptz := now();
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_role not in ('user', 'moderator', 'organizer', 'admin') then
    raise exception 'Unknown role %', p_role using errcode = '22023';
  end if;
  if v_email = '' then
    raise exception 'Email is required' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception '% is not a valid email address', v_email using errcode = '22023';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'An account already exists for %', v_email using errcode = '23505';
  end if;

  -- 16 URL-safe characters from 12 random bytes; comfortably above
  -- auth.minimum_password_length and never persisted in plaintext.
  v_password := translate(
    encode(extensions.gen_random_bytes(12), 'base64'),
    '+/=', 'xyz'
  );

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    reauthentication_token, phone_change, phone_change_token,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated',
    'authenticated', v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    v_now, v_now, v_now, v_now,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', p_role),
    jsonb_build_object('display_name', v_display_name, 'email_verified', true),
    '', '', '', '', '', '', '', '',
    false, false
  );

  insert into auth.identities (
    provider_id, user_id, provider, identity_data, created_at, updated_at
  ) values (
    v_user_id::text, v_user_id, 'email',
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    v_now, v_now
  );

  -- handle_new_user() has already created this row with role 'user'; adopt the
  -- requested role and display name instead of colliding with it.
  insert into public.profiles as p (id, display_name, role, status)
  values (v_user_id, v_display_name, p_role, 'active')
  on conflict (id) do update
    set display_name = coalesce(excluded.display_name, p.display_name),
        role         = excluded.role,
        status       = excluded.status;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'user.invited', 'profile', v_user_id,
          jsonb_build_object('email', v_email, 'role', p_role));

  return query
  select v_user_id,
         v_email,
         v_display_name,
         null::text,
         p_role,
         'active'::text,
         v_now,
         v_password;
end;
$$;

revoke execute on function public.admin_invite_user(text, text, text) from public, anon;
grant  execute on function public.admin_invite_user(text, text, text) to authenticated;

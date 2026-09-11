-- === Phase 14 — admin_invite_user RPC (corrected) ===
--
-- Supersedes the original Phase 14 script, which could never create a user.
-- Apply this against the hosted project; it replaces one function and touches
-- no tables, no data and no RLS policy. Identical to
-- supabase/migrations/20260820000000_fix_admin_invite_user.sql.
--
-- Defects this corrects, in the order they fired:
--   1. INSERT named a column `app_metadata` that does not exist on auth.users
--      (the real column is raw_app_meta_data)                        -> 42703.
--   2. `set search_path = public` left crypt()/gen_salt() unresolvable,
--      because pgcrypto lives in the `extensions` schema             -> 42883.
--   3. The AFTER INSERT trigger auth.users -> public.handle_new_user() already
--      inserts the profile row, so the function's own plain INSERT into
--      public.profiles collided with profiles_pkey                   -> 23505.
--   4. raw_user_meta_data used key `name`, but handle_new_user() reads
--      `display_name`, so the trigger fell back to the email local-part.
--   5. aud and the GoTrue token columns were left NULL, which breaks sign-in
--      with "converting NULL to string is unsupported".
--   6. No auth.identities row linked the email provider to the account.
--
-- Access model: Azure Static Web Apps gives no server runtime and the project
-- has no custom SMTP ([auth.email.smtp] disabled, email_sent = 2/hour), so
-- auth.admin.inviteUserByEmail is unavailable. The function provisions a
-- confirmed account with a generated temporary password and returns it once to
-- the calling admin. Only the bcrypt hash is stored.
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

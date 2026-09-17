-- First-login onboarding support.
--
-- Adds onboarding_completed_at to public.profiles as the canonical
-- onboarding-completion flag. Existing profiles are marked complete so
-- no current user is unexpectedly forced through onboarding.
--
-- Also provides a SECURITY DEFINER RPC for setting the username during
-- onboarding, since the column-level UPDATE grant deliberately blocks
-- authenticated clients from writing username (see 20260830000000 and
-- 20260911000000).

-- 1. Column
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_completed_at
  is 'Set once when the user completes or skips the first-login onboarding flow.';

-- 2. Backfill every existing profile so no current user is forced through onboarding.
update public.profiles
   set onboarding_completed_at = now()
 where onboarding_completed_at is null;

-- 3. RLS: authenticated users may read their own onboarding_completed_at
--    (already covered by "Users read own profile" SELECT policy).

-- 4. Extend the column-level UPDATE grant so the owner can write onboarding_completed_at.
grant update (
  display_name,
  avatar_url,
  bio,
  city,
  dance_styles,
  instagram,
  website,
  cover_url,
  public_profile,
  stats_public,
  notification_prefs,
  onboarding_completed_at
) on public.profiles to authenticated;

-- 5. RPC: set onboarding profile fields atomically.
--    Only the owner (auth.uid()) may call this.
--    Validates username format and uniqueness before writing.
create or replace function public.set_onboarding_profile(
  p_display_name text,
  p_username     text,
  p_city         text,
  p_bio          text default null,
  p_avatar_url   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_username text := nullif(btrim(p_username), '');
  v_display  text := nullif(btrim(p_display_name), '');
  v_city     text := nullif(btrim(p_city), '');
  v_bio      text := nullif(btrim(p_bio), '');
  v_avatar   text := nullif(btrim(p_avatar_url), '');
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Required fields
  if v_display is null or length(v_display) = 0 then
    raise exception 'Display name is required.' using errcode = '22023';
  end if;
  if v_username is null then
    raise exception 'Username is required.' using errcode = '22023';
  end if;
  if v_city is null then
    raise exception 'City is required.' using errcode = '22023';
  end if;

  -- Username format (same constraint as profiles_username_format)
  if v_username !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 letters, numbers, or underscores.'
      using errcode = '22023';
  end if;

  -- Username uniqueness (case-insensitive, same unique index)
  if exists (select 1 from public.profiles where lower(username) = lower(v_username) and id <> v_uid) then
    raise exception 'That username is already taken.' using errcode = '23505';
  end if;

  -- City vocabulary
  if v_city not in ('boston', 'new-york-city') then
    raise exception 'Unknown city.' using errcode = '22023';
  end if;

  -- Avatar must be http(s) when present
  if v_avatar is not null and v_avatar !~* '^https?://' then
    raise exception 'Avatar URL must start with https://' using errcode = '22023';
  end if;

  -- Bio length
  if v_bio is not null and length(v_bio) > 600 then
    raise exception 'Bio must be 600 characters or fewer.' using errcode = '22023';
  end if;

  update public.profiles
     set display_name            = v_display,
         username                = v_username,
         city                    = v_city,
         bio                     = nullif(v_bio, ''),
         avatar_url              = v_avatar,
         onboarding_completed_at = now()
   where id = v_uid;

  if not found then
    raise exception 'No profile found for current user.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_onboarding_profile(text, text, text, text, text) from public, anon;
grant  execute on function public.set_onboarding_profile(text, text, text, text, text) to authenticated;

-- 6. RPC: check username availability (case-insensitive).
create or replace function public.check_username_available(p_username text)
returns boolean
language sql
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(btrim(p_username))
  );
$$;

revoke execute on function public.check_username_available(text) from public, anon;
grant  execute on function public.check_username_available(text) to authenticated;

-- 7. RPC: mark onboarding complete without writing profile fields (Skip path).
create or replace function public.mark_onboarding_complete()
returns void
language sql
set search_path = public
as $$
  update public.profiles
     set onboarding_completed_at = now()
   where id = auth.uid()
     and onboarding_completed_at is null;
$$;

revoke execute on function public.mark_onboarding_complete() from public, anon;
grant  execute on function public.mark_onboarding_complete() to authenticated;

notify pgrst, 'reload schema';
-- Profile redesign — public profile + editor fields.
--
-- Adds the owner-editable presentation columns the redesigned
-- /profile and /profile/edit screens render:
--   bio, city, dance_styles, instagram, website, cover_url
--   public_profile / stats_public   (privacy toggles)
--   notification_prefs              (notification toggles)
--
-- Scope rules follow 20260830000000_profile_owner_update.sql exactly:
--   1. The owner may only update rows where id = auth.uid()
--      (existing "Users update own profile fields" policy).
--   2. Column-level UPDATE grants — not a policy allow-list — decide
--      which columns the client may touch. role, status, status_reason,
--      username, created_at, updated_at, id all stay unwritable.
--
-- Forward-only and idempotent: every statement is add-column-if-not-exists
-- or a guarded constraint, so re-applying changes nothing.

alter table public.profiles
  add column if not exists bio                text,
  add column if not exists city               text,
  add column if not exists dance_styles       text[] not null default '{}',
  add column if not exists instagram          text,
  add column if not exists website            text,
  add column if not exists cover_url          text,
  add column if not exists public_profile     boolean not null default true,
  add column if not exists stats_public       boolean not null default true,
  add column if not exists notification_prefs jsonb   not null default '{}'::jsonb;

comment on column public.profiles.bio is 'Owner-written short profile bio';
comment on column public.profiles.city is 'Owner-selected home city slug (boston | new-york-city)';
comment on column public.profiles.dance_styles is 'Owner-selected dance-style slugs, same vocabulary as events.dance_styles';
comment on column public.profiles.instagram is 'Owner-supplied Instagram URL';
comment on column public.profiles.website is 'Owner-supplied website URL';
comment on column public.profiles.cover_url is 'Owner-supplied cover photo URL';
comment on column public.profiles.public_profile is 'Owner privacy toggle: profile visible to other members';
comment on column public.profiles.stats_public is 'Owner privacy toggle: activity numbers visible to other members';
comment on column public.profiles.notification_prefs is 'Owner notification toggles, keyed by preference slug';

-- City must stay inside the app's two-city vocabulary (src/features/events/model/types.ts).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_city_known'
  ) then
    alter table public.profiles
      add constraint profiles_city_known
      check (city is null or city in ('boston', 'new-york-city'));
  end if;
end
$$;

-- Bounded free text at the database boundary, matching what the editor
-- allows: the UI also caps these, but the promise belongs in the schema.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_bio_length'
  ) then
    alter table public.profiles
      add constraint profiles_bio_length
      check (bio is null or length(bio) <= 600);
  end if;
end
$$;

-- Link columns are rendered as anchors — only http(s) may ever be stored,
-- so a stored 'javascript:' value can never become a live href.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_instagram_http'
  ) then
    alter table public.profiles
      add constraint profiles_instagram_http
      check (instagram is null or instagram ~* '^https?://');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_website_http'
  ) then
    alter table public.profiles
      add constraint profiles_website_http
      check (website is null or website ~* '^https?://');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_cover_url_http'
  ) then
    alter table public.profiles
      add constraint profiles_cover_url_http
      check (cover_url is null or cover_url ~* '^https?://');
  end if;
end
$$;

-- Extend the owner-writable column set. display_name/avatar_url keep the
-- grants 20260830000000_profile_owner_update.sql established.
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
  notification_prefs
) on public.profiles to authenticated;

notify pgrst, 'reload schema';

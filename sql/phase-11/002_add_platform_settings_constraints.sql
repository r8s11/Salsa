-- Phase 11 — validation, ownership stamping, and admin-only access.
-- REQUIRED after 001. Review manually; this file is additive and idempotent.
-- The current supported event cities share America/New_York. Expanding to multiple
-- time zones requires an explicit product/data-model change, not free-form input.

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_singleton_check') then
    alter table public.platform_settings
      add constraint platform_settings_singleton_check check (singleton);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_name_check') then
    alter table public.platform_settings
      add constraint platform_settings_name_check check (btrim(platform_name) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_site_url_check') then
    alter table public.platform_settings
      add constraint platform_settings_site_url_check check (public_site_url ~ '^https://[^[:space:]]+$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_support_email_check') then
    alter table public.platform_settings
      add constraint platform_settings_support_email_check check (position('@' in support_email) > 1);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_city_check') then
    alter table public.platform_settings
      add constraint platform_settings_city_check check (default_city in ('boston', 'new-york-city'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_country_check') then
    alter table public.platform_settings
      add constraint platform_settings_country_check check (default_country_code = 'US');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_timezone_check') then
    alter table public.platform_settings
      add constraint platform_settings_timezone_check check (default_timezone = 'America/New_York');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_locale_check') then
    alter table public.platform_settings
      add constraint platform_settings_locale_check check (default_locale = 'en-US');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_currency_check') then
    alter table public.platform_settings
      add constraint platform_settings_currency_check check (default_currency_code = 'USD');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_duration_check') then
    alter table public.platform_settings
      add constraint platform_settings_duration_check check (default_event_duration_minutes between 30 and 720);
  end if;
end;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.stamp_platform_settings_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.stamp_platform_settings_update() from public, anon;

drop trigger if exists platform_settings_stamp_update on public.platform_settings;
create trigger platform_settings_stamp_update
  before update on public.platform_settings
  for each row execute function public.stamp_platform_settings_update();

alter table public.platform_settings enable row level security;
grant select, update on public.platform_settings to authenticated;

drop policy if exists "Admins read platform settings" on public.platform_settings;
create policy "Admins read platform settings"
  on public.platform_settings for select to authenticated
  using (public.is_platform_admin());

drop policy if exists "Admins update platform settings" on public.platform_settings;
create policy "Admins update platform settings"
  on public.platform_settings for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

notify pgrst, 'reload schema';

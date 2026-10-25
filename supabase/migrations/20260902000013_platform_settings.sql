-- Platform settings table for singleton runtime configuration
-- Phase 14 — Platform Settings Consolidation

create table if not exists public.platform_settings (
  singleton boolean primary key default true,
  platform_name text not null,
  public_site_url text not null,
  support_email text not null,
  default_city text not null check (default_city in ('boston', 'new-york-city')),
  default_country_code text not null check (default_country_code = 'US'),
  default_timezone text not null check (default_timezone = 'America/New_York'),
  default_locale text not null check (default_locale = 'en-US'),
  default_currency_code text not null check (default_currency_code = 'USD'),
  default_event_duration_minutes integer not null,
  allow_public_event_suggestions boolean not null,
  allow_registered_user_submissions boolean not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton_check check (singleton),
  constraint platform_settings_name_check check (char_length(btrim(platform_name)) between 2 and 80),
  constraint platform_settings_site_url_check check (public_site_url ~ '^https://[^[:space:]]+$'),
  constraint platform_settings_support_email_check check (position('@' in support_email) > 1),
  constraint platform_settings_duration_check check (
    default_event_duration_minutes between 30 and 720
    and mod(default_event_duration_minutes, 30) = 0
  )
);

-- Comments
comment on table public.platform_settings is 'Singleton table for platform-wide configuration';
comment on column public.platform_settings.singleton is 'Always true - ensures only one row exists';
comment on column public.platform_settings.platform_name is 'Display name of the platform';
comment on column public.platform_settings.public_site_url is 'Public-facing site URL';
comment on column public.platform_settings.support_email is 'Support contact email';
comment on column public.platform_settings.default_city is 'Default city for new events';
comment on column public.platform_settings.default_country_code is 'Default country code';
comment on column public.platform_settings.default_timezone is 'Default timezone';
comment on column public.platform_settings.default_locale is 'Default locale';
comment on column public.platform_settings.default_currency_code is 'Default currency code';
comment on column public.platform_settings.default_event_duration_minutes is 'Default event duration in minutes';
comment on column public.platform_settings.allow_public_event_suggestions is 'Whether anonymous users can suggest events';
comment on column public.platform_settings.allow_registered_user_submissions is 'Whether registered users can submit events';
comment on column public.platform_settings.updated_by is 'User who last updated the settings';
comment on column public.platform_settings.updated_at is 'Timestamp of last update';

-- Row Level Security
alter table public.platform_settings enable row level security;

-- Policies: Allow admins to read and update platform settings. The public
-- submission-gate flags are read by anon/authenticated visitors exclusively
-- through the SECURITY DEFINER public_event_suggestions_enabled() /
-- registered_event_submissions_enabled() RPCs (added in a later migration),
-- never through a direct table SELECT — so this table itself stays admin-only.
drop policy if exists "Admins read platform settings" on public.platform_settings;
create policy "Admins read platform settings"
  on public.platform_settings
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Admins update platform settings" on public.platform_settings;
create policy "Admins update platform settings"
  on public.platform_settings
  for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Grants
grant select, update on public.platform_settings to authenticated;

-- Trigger to set updated_at
drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row
  execute function public.set_updated_at();

notify pgrst, 'reload schema';

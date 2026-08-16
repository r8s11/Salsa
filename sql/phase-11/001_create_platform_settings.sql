-- Phase 11 — singleton, strongly typed runtime platform configuration.
-- REQUIRED. Review and run manually; do not execute from application deploys.
-- This table intentionally contains no secrets, connection strings, API keys,
-- service-role credentials, or arbitrary JSON configuration.

create table if not exists public.platform_settings (
  singleton boolean primary key default true,
  platform_name text not null,
  public_site_url text not null,
  support_email text not null,
  default_city text not null,
  default_country_code text not null,
  default_timezone text not null,
  default_locale text not null,
  default_currency_code text not null,
  default_event_duration_minutes integer not null,
  allow_public_event_suggestions boolean not null,
  allow_registered_user_submissions boolean not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

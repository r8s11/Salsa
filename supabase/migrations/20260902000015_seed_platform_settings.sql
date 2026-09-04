-- Seed default platform settings
-- Phase 14 — Seed Data
-- This migration inserts the default singleton row for platform_settings.
-- Idempotent: uses ON CONFLICT to avoid overwriting existing settings.

insert into public.platform_settings (
  singleton,
  platform_name,
  public_site_url,
  support_email,
  default_city,
  default_country_code,
  default_timezone,
  default_locale,
  default_currency_code,
  default_event_duration_minutes,
  allow_public_event_suggestions,
  allow_registered_user_submissions
) values (
  true,
  'Salsa Segura',
  'https://salsasegura.com',
  'support@salsasegura.com',
  'boston',
  'US',
  'America/New_York',
  'en-US',
  'USD',
  180,
  true,
  true
) on conflict (singleton) do nothing;

notify pgrst, 'reload schema';
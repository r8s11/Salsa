-- Phase 11 — reviewed SalsaSegura defaults.
-- REQUIRED after 001 and 002. This inserts the singleton once and never overwrites
-- an administrator's later changes. Review URLs and contact email before production use.

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
)
values (
  true,
  'Salsa Segura',
  'https://salsasegura.com',
  'info@salsasegura.com',
  'boston',
  'US',
  'America/New_York',
  'en-US',
  'USD',
  180,
  true,
  true
)
on conflict (singleton) do nothing;

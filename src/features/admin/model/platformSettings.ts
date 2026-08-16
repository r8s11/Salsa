import type { City } from "../../../types/events";

export type PlatformSettings = {
  singleton: true;
  platform_name: string;
  public_site_url: string;
  support_email: string;
  default_city: City;
  default_country_code: "US";
  default_timezone: "America/New_York";
  default_locale: "en-US";
  default_currency_code: "USD";
  default_event_duration_minutes: number;
  allow_public_event_suggestions: boolean;
  allow_registered_user_submissions: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type GeneralSettingsForm = Pick<
  PlatformSettings,
  "platform_name" | "public_site_url" | "support_email"
>;

export type EventDefaultsForm = Pick<
  PlatformSettings,
  "default_city" | "default_event_duration_minutes"
>;

export type SubmissionAccessForm = Pick<
  PlatformSettings,
  "allow_public_event_suggestions" | "allow_registered_user_submissions"
>;

export type FieldErrors<T extends object> = Partial<Record<keyof T, string>>;

export function generalSettingsFrom(settings: PlatformSettings): GeneralSettingsForm {
  return {
    platform_name: settings.platform_name,
    public_site_url: settings.public_site_url,
    support_email: settings.support_email,
  };
}

export function eventDefaultsFrom(settings: PlatformSettings): EventDefaultsForm {
  return {
    default_city: settings.default_city,
    default_event_duration_minutes: settings.default_event_duration_minutes,
  };
}

export function validateGeneralSettings(
  form: GeneralSettingsForm
): FieldErrors<GeneralSettingsForm> {
  const errors: FieldErrors<GeneralSettingsForm> = {};
  const name = form.platform_name.trim();
  if (name.length < 2 || name.length > 80) {
    errors.platform_name = "Platform name must be 2 to 80 characters.";
  }

  try {
    const url = new URL(form.public_site_url.trim());
    if (url.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    errors.public_site_url = "Enter a valid HTTPS URL.";
  }

  if (!/^\S+@\S+\.\S+$/.test(form.support_email.trim())) {
    errors.support_email = "Enter a valid support email address.";
  }

  return errors;
}

export function validateEventDefaults(form: EventDefaultsForm): FieldErrors<EventDefaultsForm> {
  const errors: FieldErrors<EventDefaultsForm> = {};
  if (!["boston", "new-york-city"].includes(form.default_city)) {
    errors.default_city = "Choose Boston or New York City.";
  }
  if (
    !Number.isInteger(form.default_event_duration_minutes) ||
    form.default_event_duration_minutes < 30 ||
    form.default_event_duration_minutes > 720 ||
    form.default_event_duration_minutes % 30 !== 0
  ) {
    errors.default_event_duration_minutes =
      "Choose a duration from 30 minutes to 12 hours in 30-minute increments.";
  }
  return errors;
}

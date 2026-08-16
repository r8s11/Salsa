import { describe, expect, it } from "vitest";
import {
  validateEventDefaults,
  validateGeneralSettings,
  type EventDefaultsForm,
  type GeneralSettingsForm,
} from "./platformSettings";

const validGeneral: GeneralSettingsForm = {
  platform_name: "Salsa Segura",
  public_site_url: "https://salsasegura.com",
  support_email: "info@salsasegura.com",
};

const validDefaults: EventDefaultsForm = {
  default_city: "boston",
  default_event_duration_minutes: 180,
};

describe("platform settings validation", () => {
  it("rejects a non-HTTPS public site URL without rejecting the other general fields", () => {
    expect(
      validateGeneralSettings({ ...validGeneral, public_site_url: "http://salsasegura.com" })
    ).toEqual({
      public_site_url: "Enter a valid HTTPS URL.",
    });
  });

  it("requires duration defaults to use 30-minute increments within the supported range", () => {
    expect(validateEventDefaults({ ...validDefaults, default_event_duration_minutes: 45 })).toEqual(
      {
        default_event_duration_minutes:
          "Choose a duration from 30 minutes to 12 hours in 30-minute increments.",
      }
    );
  });

  it("accepts valid persisted settings values", () => {
    expect(validateGeneralSettings(validGeneral)).toEqual({});
    expect(validateEventDefaults(validDefaults)).toEqual({});
  });
});

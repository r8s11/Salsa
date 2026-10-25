import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPlatformSettings,
  publicEventSuggestionsEnabled,
  registeredEventSubmissionsEnabled,
  updatePlatformSettings,
} from "./platformSettingsRepo";

const { from, eq, rpc, select, single, update } = vi.hoisted(() => ({
  from: vi.fn(),
  eq: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({ supabase: { from, rpc } }));

const settings = {
  singleton: true,
  platform_name: "Salsa Segura",
  public_site_url: "https://salsasegura.com",
  support_email: "info@salsasegura.com",
  default_city: "boston",
  default_country_code: "US",
  default_timezone: "America/New_York",
  default_locale: "en-US",
  default_currency_code: "USD",
  default_event_duration_minutes: 180,
  allow_public_event_suggestions: true,
  allow_registered_user_submissions: true,
  updated_by: null,
  updated_at: "2026-08-15T00:00:00.000Z",
};

describe("platformSettingsRepo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    from.mockReturnValue({ select, update });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ single });
  });

  it("loads only the singleton row", async () => {
    single.mockResolvedValue({ data: settings, error: null });

    await expect(fetchPlatformSettings()).resolves.toEqual(settings);
    expect(from).toHaveBeenCalledWith("platform_settings");
    expect(eq).toHaveBeenCalledWith("singleton", true);
  });

  it("updates only the requested settings fields on the singleton row", async () => {
    update.mockReturnValue({ eq });
    eq.mockReturnValue({ select });
    select.mockReturnValue({ single });
    single.mockResolvedValue({ data: settings, error: null });

    await updatePlatformSettings({ allow_public_event_suggestions: false });

    expect(update).toHaveBeenCalledWith({ allow_public_event_suggestions: false });
    expect(eq).toHaveBeenCalledWith("singleton", true);
  });

  it("calls the audience-specific submission access RPCs", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(publicEventSuggestionsEnabled()).resolves.toBe(true);
    await expect(registeredEventSubmissionsEnabled()).resolves.toBe(true);

    expect(rpc).toHaveBeenNthCalledWith(1, "public_event_suggestions_enabled");
    expect(rpc).toHaveBeenNthCalledWith(2, "registered_event_submissions_enabled");
  });
});

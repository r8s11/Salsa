import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminSettingsPage from "./AdminSettingsPage";

const { usePlatformSettings } = vi.hoisted(() => ({ usePlatformSettings: vi.fn() }));
vi.mock("../features/admin/hooks/usePlatformSettings", () => ({ usePlatformSettings }));

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

const mutateAsync = vi.fn();
const refetch = vi.fn();

function renderSettingsPage() {
  return render(
    <MemoryRouter>
      <AdminSettingsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue(settings);
  refetch.mockReset();
  vi.mocked(usePlatformSettings).mockReturnValue({
    settings,
    isLoading: false,
    error: null,
    update: { mutateAsync, isPending: false, error: null },
    refetch,
  });
});

describe("AdminSettingsPage", () => {
  it("saves only the General card's changed settings", async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.clear(screen.getByLabelText("Platform name"));
    await user.type(screen.getByLabelText("Platform name"), "Salsa Nights");
    await user.click(screen.getByRole("button", { name: "Save General settings" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      platform_name: "Salsa Nights",
      public_site_url: "https://salsasegura.com",
      support_email: "info@salsasegura.com",
    });
  });

  it("marks a changed card as unsaved and discards only that card's edits", async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.clear(screen.getByLabelText("Platform name"));
    await user.type(screen.getByLabelText("Platform name"), "Salsa Nights");

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByLabelText("Platform name")).toHaveValue("Salsa Segura");
  });

  it("requires confirmation before disabling public event suggestions", async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.click(screen.getByRole("switch", { name: "Public event suggestions" }));

    expect(
      screen.getByRole("dialog", { name: "Disable public event suggestions?" })
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Disable public suggestions" }));

    expect(mutateAsync).toHaveBeenCalledWith({ allow_public_event_suggestions: false });
  });

  it("shows a retry action instead of an endless skeleton when loading settings fails", () => {
    vi.mocked(usePlatformSettings).mockReturnValue({
      settings: null,
      isLoading: false,
      error: "Failed to load platform settings: forbidden",
      refetch,
      update: { mutateAsync, isPending: false, error: null },
    });

    renderSettingsPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to load platform settings: forbidden"
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

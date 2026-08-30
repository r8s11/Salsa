import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProfileEditPage from "./ProfileEditPage";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "user-1", email: "[EMAIL]" } as { id: string; email: string } | null,
  },
  profile: {
    profile: null as unknown,
    isLoading: false,
    error: null as string | null,
    refetch: vi.fn(),
  },
  update: {
    update: vi.fn(),
    isSaving: false,
    error: null as string | null,
  },
}));

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("../hooks/useOwnProfile", () => ({
  useOwnProfile: () => mocks.profile,
}));

vi.mock("../hooks/useUpdateOwnProfile", () => ({
  useUpdateOwnProfile: () => mocks.update,
}));

function renderPage(initialPath = "/profile/edit") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route path="/profile" element={<p>Profile destination</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    display_name: "Maria Santos",
    username: "mariasalsa",
    avatar_url: null,
    status: "active",
    status_reason: null,
    created_at: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

describe("ProfileEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "user-1", email: "[EMAIL]" };
    mocks.profile.profile = null;
    mocks.profile.isLoading = false;
    mocks.profile.error = null;
    mocks.profile.refetch.mockReset();
    mocks.update.update.mockReset();
    mocks.update.update.mockResolvedValue({});
    mocks.update.isSaving = false;
    mocks.update.error = null;
  });

  it("renders a single h1, the eyebrow, and the lede", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("PROFILE SETTINGS")).toBeInTheDocument();
    expect(
      screen.getByText(/manage the information people see when they visit your/i)
    ).toBeInTheDocument();
  });

  it("links back to the public profile", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    const back = screen.getByRole("link", { name: /back to my profile/i });
    expect(back).toHaveAttribute("href", "/profile");
  });

  it("prefills the existing profile values and disables Save until changed", async () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    const username = screen.getByLabelText(/username/i);
    const save = screen.getByRole("button", { name: "Save Changes" });

    expect((displayName as HTMLInputElement).value).toBe("Maria Santos");
    expect((username as HTMLInputElement).value).toBe("mariasalsa");
    expect(save).toBeDisabled();
  });

  it("shows the public URL hint with the current username", async () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(await screen.findByText("salsasegura.com/u/mariasalsa")).toBeInTheDocument();
  });

  it("renders the initials avatar fallback when no avatar_url is set", async () => {
    mocks.profile.profile = baseProfile({ display_name: "Maria Santos", avatar_url: null });
    renderPage();

    const heading = await screen.findByRole("heading", { name: "PHOTO & NAME" });
    const section = heading.closest("section") as HTMLElement;
    expect(within(section).getByText("M")).toBeInTheDocument();
  });

  it("renders the avatar image when avatar_url is set", async () => {
    mocks.profile.profile = baseProfile({ avatar_url: "https://cdn.test/maria.png" });
    renderPage();

    const heading = await screen.findByRole("heading", { name: "PHOTO & NAME" });
    const section = heading.closest("section") as HTMLElement;
    const img = within(section).getByRole("presentation", { hidden: true }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://cdn.test/maria.png");
    expect(img.getAttribute("alt")).toBe("");
  });

  it("does not render the v2-only fields that the existing schema does not support", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.queryByLabelText(/^bio$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^city$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^instagram$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^website$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^tagline$/i)).not.toBeInTheDocument();
  });

  it("sanitises username input as the user types", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    const username = await screen.findByLabelText(/username/i);
    await user.clear(username);
    await user.type(username, "  @Maria.Salsa 99");

    expect((username as HTMLInputElement).value).toBe("maria.salsa99");
  });

  it("rejects malformed photo URLs but enables Save when corrected", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    const photoUrl = await screen.findByLabelText(/photo url/i);
    await user.type(photoUrl, "not-a-url");

    expect(await screen.findByRole("alert")).toHaveTextContent(/use a full link starting with https/i);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();

    await user.clear(photoUrl);
    await user.type(photoUrl, "https://cdn.test/me.png");
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("saves trimmed display name and lowercased username via the update hook", async () => {
    mocks.profile.profile = baseProfile();
    mocks.update.update.mockResolvedValue(baseProfile());
    const user = userEvent.setup();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);
    await user.type(displayName, "  Maria Lucia  ");

    const username = screen.getByLabelText(/username/i);
    await user.clear(username);
    await user.type(username, "MARIA99");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.update.update).toHaveBeenCalled());
    const [patch] = mocks.update.update.mock.calls[0];
    expect(patch).toEqual({
      display_name: "Maria Lucia",
      username: "maria99",
      avatar_url: null,
    });
  });

  it("surfaces a success notice after a real save and shows the updated value", async () => {
    mocks.profile.profile = baseProfile();
    mocks.update.update.mockResolvedValue(baseProfile({ display_name: "Maria L." }));
    const user = userEvent.setup();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);
    await user.type(displayName, "Maria L.");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText(/your profile is up to date/i)).toBeInTheDocument();
  });

  it("shows a clean page error without leaking the raw Supabase message", async () => {
    mocks.profile.profile = baseProfile();
    mocks.update.update.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    mocks.update.error = "duplicate key value violates unique constraint";
    const user = userEvent.setup();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);
    await user.type(displayName, "Maria L.");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      await screen.findByText(/we couldn't save your changes\. please try again\./i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/duplicate key value/i)).not.toBeInTheDocument();
  });

  it("disables Save when the display name is blank", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);

    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });

  it("routes Cancel back to /profile without invoking the update hook", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Profile destination")).toBeInTheDocument();
    expect(mocks.update.update).not.toHaveBeenCalled();
  });

  it("renders a loading skeleton while the profile is pending", () => {
    mocks.profile.profile = null;
    mocks.profile.isLoading = true;
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(/loading your profile/i);
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
  });

  it("renders an error card with a Try Again retry affordance", async () => {
    mocks.profile.profile = null;
    mocks.profile.error = "Network unavailable";
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/we couldn't load your profile/i);

    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.profile.refetch).toHaveBeenCalledOnce();
  });
});

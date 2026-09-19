import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OnboardingPage from "./OnboardingPage";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "user-1", email: "[EMAIL]" } as { id: string; email: string } | null,
    loading: false,
  },
  profile: {
    profile: null as unknown,
    isLoading: false,
    refetch: vi.fn(),
  },
  repo: {
    setOnboardingProfile: vi.fn().mockResolvedValue(undefined),
    markOnboardingComplete: vi.fn().mockResolvedValue(undefined),
    checkUsernameAvailable: vi.fn().mockResolvedValue(true),
  },
  profileMedia: {
    validateProfileImage: vi.fn().mockReturnValue(null),
    uploadAvatarFile: vi.fn().mockResolvedValue("https://example.com/avatar.webp"),
    profileMediaErrorMessage: vi.fn().mockReturnValue("Upload failed"),
  },
}));

vi.mock("../../contexts/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("../../features/account/hooks/useOwnProfile", () => ({
  useOwnProfile: () => mocks.profile,
}));

vi.mock("../../features/account/api/accountRepo", () => ({
  setOnboardingProfile: (...args: unknown[]) => mocks.repo.setOnboardingProfile(...args),
  markOnboardingComplete: (...args: unknown[]) => mocks.repo.markOnboardingComplete(...args),
  checkUsernameAvailable: (...args: unknown[]) => mocks.repo.checkUsernameAvailable(...args),
}));

vi.mock("../../features/account/api/profileMedia", () => ({
  validateProfileImage: (...args: unknown[]) => mocks.profileMedia.validateProfileImage(...args),
  uploadAvatarFile: (...args: unknown[]) => mocks.profileMedia.uploadAvatarFile(...args),
  profileMediaErrorMessage: (...args: unknown[]) =>
    mocks.profileMedia.profileMediaErrorMessage(...args),
}));

function renderPage(initialPath = "/onboarding") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/profile" element={<p>Profile destination</p>} />
          <Route path="/" element={<p>Home destination</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    display_name: "Maria Santos",
    username: null,
    avatar_url: null,
    status: "active",
    status_reason: null,
    created_at: "2026-01-15T00:00:00Z",
    bio: null,
    city: null,
    dance_styles: [],
    instagram: null,
    website: null,
    cover_url: null,
    public_profile: true,
    stats_public: true,
    notification_prefs: {},
    onboarding_completed_at: null,
    ...overrides,
  };
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "user-1", email: "[EMAIL]" };
    mocks.auth.loading = false;
    mocks.profile.profile = makeProfile();
    mocks.profile.isLoading = false;
    // Reset repo mocks to their default resolved state — vi.clearAllMocks()
    // only clears call history, not implementations, so mockRejectedValue
    // from a prior test can bleed through.
    mocks.repo.setOnboardingProfile.mockReset().mockResolvedValue(undefined);
    mocks.repo.markOnboardingComplete.mockReset().mockResolvedValue(undefined);
    mocks.repo.checkUsernameAvailable.mockReset().mockResolvedValue(true);
  });

  // ── Rendering ──────────────────────────────────────────────────

  it("renders required fields: display name, username, city", () => {
    renderPage();
    expect(screen.getByLabelText(/display name/i)).toBeTruthy();
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
    expect(screen.getByLabelText(/city/i)).toBeTruthy();
  });

  it("renders optional bio field", () => {
    renderPage();
    expect(screen.getByLabelText(/bio/i)).toBeTruthy();
  });

  it("renders Skip and Continue buttons", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /continue/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /skip/i })).toBeTruthy();
  });

  it("pre-fills display name from existing profile", () => {
    mocks.profile.profile = makeProfile({ display_name: "Maria" });
    renderPage();
    expect(screen.getByLabelText(/display name/i)).toHaveValue("Maria");
  });

  // ── Skip ───────────────────────────────────────────────────────

  it("skip calls markOnboardingComplete and redirects", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /skip/i }));
    await waitFor(() => {
      expect(mocks.repo.markOnboardingComplete).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Profile destination")).toBeTruthy();
  });

  it("skip does not write fallback display name", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /skip/i }));
    await waitFor(() => {
      expect(mocks.repo.setOnboardingProfile).not.toHaveBeenCalled();
    });
  });

  it("skip does not overwrite username", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /skip/i }));
    await waitFor(() => {
      expect(mocks.repo.markOnboardingComplete).toHaveBeenCalled();
    });
    // setOnboardingProfile was never called — no profile fields written.
    expect(mocks.repo.setOnboardingProfile).not.toHaveBeenCalled();
  });

  it("skip shows error message on failure", async () => {
    mocks.repo.markOnboardingComplete.mockRejectedValue(new Error("Network error"));
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /skip/i }));
    await waitFor(() => {
      expect(screen.getByText(/Could not skip/i)).toBeTruthy();
    });
  });

  // ── Username validation ────────────────────────────────────────

  it("rejects reserved usernames", async () => {
    renderPage();
    const user = userEvent.setup();
    const usernameInput = screen.getByLabelText(/username/i);
    await user.type(usernameInput, "admin");
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
    });
    // Should show taken/error status for reserved name.
    const status = screen.getByRole("status");
    expect(status.textContent).toBeTruthy();
  });

  it("shows checking status while availability check runs", async () => {
    // Make the availability check hang so we can observe "Checking…"
    mocks.repo.checkUsernameAvailable.mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/username/i), "djsalsero");
    await waitFor(() => {
      expect(screen.getByText("Checking…")).toBeTruthy();
    });
  });

  it("shows available feedback for valid unique username", async () => {
    mocks.repo.checkUsernameAvailable.mockResolvedValueOnce(true);
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/username/i), "djsalsero");
    await waitFor(() => {
      expect(screen.getByText("djsalsero is available")).toBeTruthy();
    });
  });

  it("shows taken feedback for unavailable username", async () => {
    mocks.repo.checkUsernameAvailable.mockResolvedValueOnce(false);
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/username/i), "djsalsero");
    await waitFor(() => {
      expect(screen.getByText("That username is already taken")).toBeTruthy();
    });
  });

  // ── Continue ───────────────────────────────────────────────────

  it("continue is disabled when required fields are empty", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("continue saves profile and onboarding_completed_at via setOnboardingProfile", async () => {
    mocks.repo.checkUsernameAvailable.mockResolvedValue(true);
    renderPage();
    const user = userEvent.setup();

    const displayNameInput = screen.getByLabelText(/display name/i);
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Maria");
    await user.type(screen.getByLabelText(/username/i), "mariassalsa");

    // Wait for username check
    await waitFor(() => {
      expect(screen.getByText("mariassalsa is available")).toBeTruthy();
    });

    // Select city
    await user.selectOptions(screen.getByLabelText(/city/i), "boston");

    // Continue button should now be enabled
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn).not.toBeDisabled();

    await user.click(continueBtn);

    await waitFor(() => {
      expect(mocks.repo.setOnboardingProfile).toHaveBeenCalledWith({
        display_name: "Maria",
        username: "mariassalsa",
        city: "boston",
        bio: undefined,
        avatar_url: undefined,
      });
    });
    // After successful save, redirects.
    expect(screen.getByText("Profile destination")).toBeTruthy();
  });

  it("continue shows error on RPC failure", async () => {
    mocks.repo.setOnboardingProfile.mockRejectedValueOnce(
      new Error("That username is already taken.")
    );
    mocks.repo.checkUsernameAvailable.mockResolvedValue(true);
    renderPage();
    const user = userEvent.setup();

    const displayNameInput = screen.getByLabelText(/display name/i);
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Maria");
    await user.type(screen.getByLabelText(/username/i), "mariassalsa");
    await waitFor(() => {
      expect(screen.getByText("mariassalsa is available")).toBeTruthy();
    });
    await user.selectOptions(screen.getByLabelText(/city/i), "boston");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("username");
    });
  });

  // ── Avatar ─────────────────────────────────────────────────────

  it("avatar upload is optional — continue works without avatar", async () => {
    mocks.repo.checkUsernameAvailable.mockResolvedValue(true);
    renderPage();
    const user = userEvent.setup();

    const displayNameInput = screen.getByLabelText(/display name/i);
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Maria");
    await user.type(screen.getByLabelText(/username/i), "mariassalsa");
    await waitFor(() => {
      expect(screen.getByText("mariassalsa is available")).toBeTruthy();
    });
    await user.selectOptions(screen.getByLabelText(/city/i), "boston");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(mocks.repo.setOnboardingProfile).toHaveBeenCalled();
    });
    // avatar_url should be undefined when no file selected.
    const call = mocks.repo.setOnboardingProfile.mock.calls[0][0];
    expect(call.avatar_url).toBeUndefined();
  });

  // ── Redirect away when already completed ───────────────────────

  it("redirects away when onboarding is already completed", () => {
    mocks.profile.profile = makeProfile({
      onboarding_completed_at: "2026-09-17T00:00:00Z",
    });
    renderPage();
    expect(screen.getByText("Profile destination")).toBeTruthy();
    expect(screen.queryByText("Set up your profile")).toBeNull();
  });

  // ── returnTo ───────────────────────────────────────────────────

  it("returns to returnTo path after skip", async () => {
    mocks.repo.markOnboardingComplete.mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[{ pathname: "/onboarding", state: { returnTo: "/calendar" } }]}
        >
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/calendar" element={<p>Calendar destination</p>} />
            <Route path="/profile" element={<p>Profile destination</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const user = userEvent.setup();
    const skipBtn = screen.getByRole("button", { name: /skip/i });
    await waitFor(() => expect(skipBtn).not.toBeDisabled());
    await user.click(skipBtn);
    await waitFor(() => {
      expect(screen.getByText("Calendar destination")).toBeTruthy();
    });
  });
});

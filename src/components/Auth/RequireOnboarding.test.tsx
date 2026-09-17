import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RequireOnboarding from "./RequireOnboarding";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "user-1", email: "[EMAIL]" } as { id: string; email: string } | null,
    loading: false,
  },
  profile: {
    profile: null as unknown,
    isLoading: false,
  },
}));

vi.mock("../../contexts/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("../../features/account/hooks/useOwnProfile", () => ({
  useOwnProfile: () => mocks.profile,
}));

function renderWithGuard(initialPath = "/profile") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/profile"
            element={
              <RequireOnboarding>
                <p>Profile content</p>
              </RequireOnboarding>
            }
          />
          <Route path="/onboarding" element={<p>Onboarding destination</p>} />
          <Route path="/signin" element={<p>Sign in destination</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    display_name: "Maria Santos",
    username: "mariasalsa",
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

describe("RequireOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "user-1", email: "[EMAIL]" };
    mocks.auth.loading = false;
    mocks.profile.profile = null;
    mocks.profile.isLoading = false;
  });

  it("redirects incomplete user to /onboarding", () => {
    mocks.profile.profile = makeProfile({ onboarding_completed_at: null });
    renderWithGuard();
    expect(screen.getByText("Onboarding destination")).toBeTruthy();
    expect(screen.queryByText("Profile content")).toBeNull();
  });

  it("passes through completed user", () => {
    mocks.profile.profile = makeProfile({ onboarding_completed_at: "2026-09-17T00:00:00Z" });
    renderWithGuard();
    expect(screen.getByText("Profile content")).toBeTruthy();
    expect(screen.queryByText("Onboarding destination")).toBeNull();
  });

  it("does not trap anonymous user in onboarding", () => {
    mocks.auth.user = null;
    mocks.profile.profile = null;
    renderWithGuard();
    // Anonymous users pass through — RequireAuth handles auth redirect.
    expect(screen.getByText("Profile content")).toBeTruthy();
    expect(screen.queryByText("Onboarding destination")).toBeNull();
  });

  it("renders nothing during auth loading", () => {
    mocks.auth.loading = true;
    const { container } = renderWithGuard();
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing during profile loading", () => {
    mocks.profile.isLoading = true;
    mocks.profile.profile = null;
    const { container } = renderWithGuard();
    expect(container.innerHTML).toBe("");
  });

  it("passes returnTo state to /onboarding redirect", () => {
    mocks.profile.profile = makeProfile({ onboarding_completed_at: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route
              path="/profile"
              element={
                <RequireOnboarding>
                  <p>Profile content</p>
                </RequireOnboarding>
              }
            />
            <Route path="/onboarding" element={<p>Onboarding destination</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText("Onboarding destination")).toBeTruthy();
  });
});

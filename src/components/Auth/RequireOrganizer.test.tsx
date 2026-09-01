import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RequireOrganizer from "./RequireOrganizer";
import type { AuthContextValue } from "../../contexts/authContextObject";
import { useAuth } from "../../contexts/useAuth";
import type { User } from "@supabase/supabase-js";
import { useMyOrganizers } from "../../features/host/hooks/useMyOrganizers";

vi.mock("../../contexts/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../features/host/hooks/useMyOrganizers", () => ({
  useMyOrganizers: vi.fn(),
}));

function authValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    session: null,
    loading: false,
    isAdmin: false,
    isModerator: false,
    isOrganizer: false,
    role: null,
    signInWithPassword: vi.fn(),
    resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  } as AuthContextValue;
}

function renderAtHost() {
  return render(
    <MemoryRouter initialEntries={["/host"]}>
      <Routes>
        <Route
          path="/host"
          element={
            <RequireOrganizer>
              <div>Host Page</div>
            </RequireOrganizer>
          }
        />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderAtNestedRoute(organizers: unknown[]) {
  vi.mocked(useMyOrganizers).mockReturnValue({
    data: organizers,
    isLoading: false,
  } as unknown as ReturnType<typeof useMyOrganizers>);

  return render(
    <MemoryRouter initialEntries={["/host/events"]}>
      <Routes>
        <Route
          path="/host/events"
          element={
            <RequireOrganizer>
              <div>Host Events Page</div>
            </RequireOrganizer>
          }
        />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(useMyOrganizers).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useMyOrganizers>);
});

describe("RequireOrganizer", () => {
  it("shows a loading state while the session is resolving", () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ loading: true }));

    renderAtHost();

    expect(screen.getByText(/Checking session/i)).toBeInTheDocument();
  });

  it("redirects unauthenticated visitors to /signin", () => {
    vi.mocked(useAuth).mockReturnValue(authValue({}));

    renderAtHost();

    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
  });

  it("admits signed-in users without organizer access so the page can render the request state", () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ user: { id: "u1", app_metadata: {} } as unknown as User })
    );

    renderAtHost();

    expect(screen.getByText("Host Page")).toBeInTheDocument();
  });

  it("admits signed-in organizer-role accounts", () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        user: { id: "u1", app_metadata: { role: "organizer" } } as unknown as User,
        isOrganizer: true,
        role: "organizer",
      })
    );

    renderAtHost();

    expect(screen.getByText("Host Page")).toBeInTheDocument();
  });

  // Every test above renders only /host, the one route explicitly exempted
  // from the access check (isHostLanding). These close that gap: they
  // prove the actual authorization boundary for a NESTED route — which is
  // the property Phase 8's organizer_members-based provisioning depends on
  // (spec §2: "organization membership is authoritative", verified, not
  // assumed).

  it("admits a nested Host route on organizer_members alone — no global role required (Phase 8 spec §2)", () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ user: { id: "u1", app_metadata: {} } as unknown as User, isOrganizer: false, role: null })
    );

    renderAtNestedRoute([{ organizerId: "org-1", organizerName: "Riverside Salsa Co", memberRole: "owner" }]);

    expect(screen.getByText("Host Events Page")).toBeInTheDocument();
  });

  it("denies a nested Host route for a signed-in user with no role and no membership", () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ user: { id: "u1", app_metadata: {} } as unknown as User, isOrganizer: false, role: null })
    );

    renderAtNestedRoute([]);

    expect(screen.getByText("Home Page")).toBeInTheDocument();
    expect(screen.queryByText("Host Events Page")).not.toBeInTheDocument();
  });

  it("denies a nested Host route for a moderator with no organizer membership — moderator status alone is not ownership", () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        user: { id: "u1", app_metadata: { role: "moderator" } } as unknown as User,
        isOrganizer: false,
        isModerator: true,
        role: "moderator",
      })
    );

    renderAtNestedRoute([]);

    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("denies a nested Host route for an admin with no organizer membership — admin status alone is not ownership", () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        user: { id: "u1", app_metadata: { role: "admin" } } as unknown as User,
        isOrganizer: false,
        isAdmin: true,
        role: "admin",
      })
    );

    renderAtNestedRoute([]);

    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });
});

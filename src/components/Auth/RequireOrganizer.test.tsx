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
});

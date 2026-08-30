import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RequireAdmin from "./RequireAdmin";
import type { AuthContextValue } from "../../contexts/authContextObject";
import { useAuth } from "../../contexts/useAuth";
import type { User } from "@supabase/supabase-js";

vi.mock("../../contexts/useAuth", () => ({
  useAuth: vi.fn(),
}));

function renderAtAdmin() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <div>Admin Page</div>
            </RequireAdmin>
          }
        />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAdmin", () => {
  it("shows a loading state while the session is resolving", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: true,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      role: null,
      signInWithPassword: vi.fn(),
      resendConfirmation: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    } as AuthContextValue);

    renderAtAdmin();

    expect(screen.getByText(/Checking session/i)).toBeInTheDocument();
  });

  it("redirects unauthenticated visitors to /signin", () => {
    vi.mocked(useAuth).mockReturnValue({
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
      clearDeletedAccount: vi.fn(),
    } as AuthContextValue);

    renderAtAdmin();

    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
  });

  it("redirects signed-in non-admins to / silently", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1", app_metadata: {} } as unknown as User,
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
      clearDeletedAccount: vi.fn(),
    } as AuthContextValue);

    renderAtAdmin();

    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("renders children for signed-in admins", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1", app_metadata: { role: "admin" } } as unknown as User,
      session: null,
      loading: false,
      isAdmin: true,
      isModerator: true,
      isOrganizer: false,
      role: "admin",
      signInWithPassword: vi.fn(),
      resendConfirmation: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    } as AuthContextValue);

    renderAtAdmin();

    expect(screen.getByText("Admin Page")).toBeInTheDocument();
  });
});

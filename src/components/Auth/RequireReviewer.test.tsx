import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import type { AuthContextValue } from "../../contexts/authContextObject";
import { useAuth } from "../../contexts/useAuth";
import RequireReviewer from "./RequireReviewer";

vi.mock("../../contexts/useAuth", () => ({ useAuth: vi.fn() }));

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    session: null,
    loading: false,
    role: null,
    isAdmin: false,
    isModerator: false,
    isOrganizer: false,
    signInWithPassword: vi.fn(),
    resendConfirmation: vi.fn(),
    requestPasswordReset: vi.fn(),
    updateEmail: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    clearDeletedAccount: vi.fn(),
    ...overrides,
  } as AuthContextValue;
}

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <RequireReviewer>
              <div>Reviewer Page</div>
            </RequireReviewer>
          }
        />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("RequireReviewer", () => {
  it("redirects an anonymous visitor to sign in", () => {
    vi.mocked(useAuth).mockReturnValue(authValue());

    renderAdminRoute();

    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
  });

  it("admits moderators and admins without changing their route", () => {
    for (const role of ["moderator", "admin"] as const) {
      vi.mocked(useAuth).mockReturnValue(
        authValue({
          user: { id: role, app_metadata: { role } } as unknown as User,
          role,
          isModerator: true,
          isAdmin: role === "admin",
        })
      );

      const { unmount } = renderAdminRoute();
      expect(screen.getByText("Reviewer Page")).toBeInTheDocument();
      unmount();
    }
  });
});

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, type Mock } from "vitest";
import type { User } from "@supabase/supabase-js";
import RequireReviewer from "../components/Auth/RequireReviewer";
import { useAuth } from "../contexts/useAuth";
import type { AuthContextValue } from "../contexts/authContextObject";

vi.mock("../contexts/useAuth");

function userWithRole(role: string | undefined): User {
  return { id: "u1", email: "u@example.com", app_metadata: role ? { role } : {} } as User;
}

function authState(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    loading: false,
    isAdmin: false,
    isModerator: false,
    signInWithPassword: vi.fn(),
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  } as AuthContextValue;
}

/** Renders the same guard the /admin route tree wraps the import page in,
 *  with a stand-in for the page itself — the assertion under test is the
 *  authorization boundary, not the page's internals. */
function renderGuardedImportRoute() {
  return render(
    <MemoryRouter initialEntries={["/admin/events/import"]}>
      <Routes>
        <Route
          path="/admin/events/import"
          element={
            <RequireReviewer>
              <div>Import Events Page</div>
            </RequireReviewer>
          }
        />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route path="/" element={<div>Public Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Import Events route authorization (UI layer)", () => {
  it("blocks a signed-out visitor, redirecting to sign-in", () => {
    (useAuth as Mock).mockReturnValue(authState({ user: null }));
    renderGuardedImportRoute();
    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
    expect(screen.queryByText("Import Events Page")).not.toBeInTheDocument();
  });

  it("blocks a signed-in normal user, redirecting to the public site", () => {
    (useAuth as Mock).mockReturnValue(
      authState({ user: userWithRole(undefined), isAdmin: false, isModerator: false })
    );
    renderGuardedImportRoute();
    expect(screen.getByText("Public Home")).toBeInTheDocument();
    expect(screen.queryByText("Import Events Page")).not.toBeInTheDocument();
  });

  it("blocks an organizer — organizer is not a reviewer role", () => {
    (useAuth as Mock).mockReturnValue(
      authState({ user: userWithRole("organizer"), isAdmin: false, isModerator: false })
    );
    renderGuardedImportRoute();
    expect(screen.queryByText("Import Events Page")).not.toBeInTheDocument();
  });

  it("allows a moderator", () => {
    (useAuth as Mock).mockReturnValue(
      authState({ user: userWithRole("moderator"), isAdmin: false, isModerator: true })
    );
    renderGuardedImportRoute();
    expect(screen.getByText("Import Events Page")).toBeInTheDocument();
  });

  it("allows an admin", () => {
    (useAuth as Mock).mockReturnValue(
      authState({ user: userWithRole("admin"), isAdmin: true, isModerator: true })
    );
    renderGuardedImportRoute();
    expect(screen.getByText("Import Events Page")).toBeInTheDocument();
  });

  it("shows a session-checking state rather than leaking the page while auth resolves", () => {
    (useAuth as Mock).mockReturnValue(authState({ user: null, loading: true }));
    renderGuardedImportRoute();
    expect(screen.getByText("Checking session…")).toBeInTheDocument();
    expect(screen.queryByText("Import Events Page")).not.toBeInTheDocument();
  });
});

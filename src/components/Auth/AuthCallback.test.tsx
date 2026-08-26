import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthCallback from "./AuthCallback";
import { supabase } from "../../lib/supabase";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

const mockUser = { id: "u1" } as unknown as User;
const mockSession = { user: mockUser } as unknown as Session;

function userWithRole(role: string | null): User {
  return {
    id: "u1",
    app_metadata: role ? { role } : {},
  } as unknown as User;
}

function renderCallback() {
  return render(
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/signin" element={<div>Sign In Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderCallbackWithRoutes(extraRoutes: { path: string; text: string }[]) {
  return render(
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        {extraRoutes.map(({ path, text }) => (
          <Route key={path} path={path} element={<div>{text}</div>} />
        ))}
      </Routes>
    </MemoryRouter>
  );
}

describe("AuthCallback", () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.exchangeCodeForSession).mockReset();
    vi.mocked(supabase.auth.getSession).mockReset();
  });

  it("exchanges the code and navigates to a role-appropriate destination on success", async () => {
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    renderCallbackWithRoutes([{ path: "/profile", text: "Profile Page" }]);

    await waitFor(() =>
      expect(screen.getByText("Profile Page")).toBeInTheDocument()
    );
    expect(screen.queryByText(/couldn't complete/i)).not.toBeInTheDocument();
  });

  it("navigates an organizer session to /host", async () => {
    const session = { user: userWithRole("organizer") } as unknown as Session;
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    });

    renderCallbackWithRoutes([{ path: "/host", text: "Host Page" }]);

    await waitFor(() =>
      expect(screen.getByText("Host Page")).toBeInTheDocument()
    );
  });

  it("navigates an admin or moderator session to /admin", async () => {
    const session = { user: userWithRole("moderator") } as unknown as Session;
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    });

    renderCallbackWithRoutes([{ path: "/admin", text: "Admin Page" }]);

    await waitFor(() =>
      expect(screen.getByText("Admin Page")).toBeInTheDocument()
    );
  });

  it("navigates a regular user session (no role) to /profile", async () => {
    const session = { user: userWithRole(null) } as unknown as Session;
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    });

    renderCallbackWithRoutes([{ path: "/profile", text: "Profile Page" }]);

    await waitFor(() =>
      expect(screen.getByText("Profile Page")).toBeInTheDocument()
    );
  });

  it("shows a friendly error and link back to /signin on failed exchange", async () => {
    const authError = {
      message: "invalid grant",
      name: "AuthApiError",
      status: 400,
      code: "invalid_grant",
      __isAuthError: true,
      toJSON: () => ({ message: "invalid grant" }),
    } as unknown as AuthError;

    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: null, session: null },
      error: authError,
    });

    renderCallback();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
    expect(screen.getByText(/link may have expired/i)).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: /back to sign in/i });
    expect(backLink.getAttribute("href")).toBe("/signin");
  });

  it("fails gracefully when visited with no callback parameters", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderCallback();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
    expect(
      screen.getByRole("link", { name: /back to sign in/i })
    ).toBeInTheDocument();
  });
});

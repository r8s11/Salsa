import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthCallback from "./AuthCallback";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/useAuth";
import { setAuthIntent } from "../../lib/authIntent";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: vi.fn(),
      setSession: vi.fn(),
      getSession: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

vi.mock("../../contexts/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockUser = { id: "u1" } as unknown as User;
const mockSession = { user: mockUser } as unknown as Session;

function userWithRole(role: string | null): User {
  return {
    id: "u1",
    app_metadata: role ? { role } : {},
  } as unknown as User;
}

function renderCallback(initialEntry = "/auth/callback") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/signin" element={<div>Sign In Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderCallbackWithRoutes(
  extraRoutes: { path: string; text: string }[],
  initialEntry = "/auth/callback"
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
    window.sessionStorage.clear();
    vi.mocked(supabase.auth.exchangeCodeForSession).mockReset();
    vi.mocked(supabase.auth.setSession).mockReset();
    vi.mocked(supabase.auth.getSession).mockReset();
    vi.mocked(supabase.auth.updateUser).mockReset();
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      role: null,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      signInWithPassword: vi.fn(),
      resendConfirmation: vi.fn().mockResolvedValue({ error: null }),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
  });

  it("exchanges the code and navigates to a role-appropriate destination on success", async () => {
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: mockUser, session: mockSession, redirectType: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } as never);

    renderCallbackWithRoutes([{ path: "/profile", text: "Profile Page" }], "/auth/callback?code=abc123");

    await waitFor(() =>
      expect(screen.getByText("Profile Page")).toBeInTheDocument()
    );
    expect(screen.queryByText(/couldn't complete/i)).not.toBeInTheDocument();
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
  });

  it("navigates an organizer session to /host", async () => {
    const session = { user: userWithRole("organizer") } as unknown as Session;
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: session.user, session, redirectType: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    } as never);

    renderCallbackWithRoutes([{ path: "/host", text: "Host Page" }], "/auth/callback?code=abc123");

    await waitFor(() =>
      expect(screen.getByText("Host Page")).toBeInTheDocument()
    );
  });

  it("navigates an admin or moderator session to /admin", async () => {
    const session = { user: userWithRole("moderator") } as unknown as Session;
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: session.user, session, redirectType: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    } as never);

    renderCallbackWithRoutes([{ path: "/admin", text: "Admin Page" }], "/auth/callback?code=abc123");

    await waitFor(() =>
      expect(screen.getByText("Admin Page")).toBeInTheDocument()
    );
  });

  it("navigates a regular user session (no role) to /profile", async () => {
    const session = { user: userWithRole(null) } as unknown as Session;
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: session.user, session, redirectType: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    } as never);

    renderCallbackWithRoutes([{ path: "/profile", text: "Profile Page" }], "/auth/callback?code=abc123");

    await waitFor(() =>
      expect(screen.getByText("Profile Page")).toBeInTheDocument()
    );
  });

  it("honors a safe ?next= destination over the role default", async () => {
    const session = { user: userWithRole(null) } as unknown as Session;
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: session.user, session, redirectType: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    } as never);

    renderCallbackWithRoutes(
      [{ path: "/founders/accept", text: "Founder Acceptance Page" }],
      "/auth/callback?code=abc123&next=%2Ffounders%2Faccept"
    );

    await waitFor(() =>
      expect(screen.getByText("Founder Acceptance Page")).toBeInTheDocument()
    );
  });

  it("ignores an unsafe ?next= destination and falls back to the role default", async () => {
    const session = { user: userWithRole(null) } as unknown as Session;
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: session.user, session, redirectType: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    } as never);

    renderCallbackWithRoutes(
      [{ path: "/profile", text: "Profile Page" }],
      "/auth/callback?code=abc123&next=https%3A%2F%2Fevil.com"
    );

    await waitFor(() =>
      expect(screen.getByText("Profile Page")).toBeInTheDocument()
    );
  });

  it("shows a set-new-password form when the exchange reports a recovery redirect", async () => {
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: mockUser, session: mockSession, redirectType: "recovery" },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } as never);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: userWithRole(null) },
      error: null,
    } as never);

    const user = userEvent.setup();
    renderCallbackWithRoutes(
      [{ path: "/profile", text: "Profile Page" }],
      "/auth/callback?code=recovery-code"
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument()
    );
    expect(screen.queryByText("Profile Page")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/^new password$/i), "new-strong-password");
    await user.type(screen.getByLabelText(/confirm new password/i), "new-strong-password");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "new-strong-password" });
    await waitFor(() =>
      expect(screen.getByText("Profile Page")).toBeInTheDocument()
    );
  });

  it("shows a set-new-password form for a legacy implicit recovery hash link", async () => {
    vi.mocked(supabase.auth.setSession).mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } as never);

    renderCallback("/auth/callback#access_token=at&refresh_token=rt&type=recovery");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument()
    );
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: "at",
      refresh_token: "rt",
    });
  });

  it("rejects a too-short password on the recovery form without calling updateUser", async () => {
    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: mockUser, session: mockSession, redirectType: "recovery" },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } as never);

    const user = userEvent.setup();
    renderCallback("/auth/callback?code=recovery-code");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument()
    );

    await user.type(screen.getByLabelText(/^new password$/i), "short");
    await user.type(screen.getByLabelText(/confirm new password/i), "short");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/at least 8 characters/i);
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("shows recovery-specific copy and a resend link for an expired reset link", async () => {
    setAuthIntent("recovery", "user@example.com");

    renderCallback("/auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "We couldn't reset your password" })).toBeInTheDocument()
    );
    expect(screen.getByText(/password reset link has expired/i)).toBeInTheDocument();
    const resendLink = screen.getByRole("link", { name: /request a new reset email/i });
    expect(resendLink.getAttribute("href")).toBe("/signin");
  });

  it("shows signup-specific copy and an inline resend action for an expired confirmation link", async () => {
    setAuthIntent("signup", "user@example.com");
    const resendConfirmation = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      role: null,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      signInWithPassword: vi.fn(),
      resendConfirmation,
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    const user = userEvent.setup();
    renderCallback("/auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "We couldn't confirm your email" })).toBeInTheDocument()
    );
    expect(screen.getByText(/already confirmed your email, try signing in/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /resend confirmation email/i }));
    expect(resendConfirmation).toHaveBeenCalledWith("user@example.com");
    await waitFor(() =>
      expect(screen.getByText(/confirmation email sent/i)).toBeInTheDocument()
    );
  });

  it("shows a generic invalid-link message when the exchange fails and no intent hint was recorded", async () => {
    const authError = {
      message: "invalid grant",
      name: "AuthApiError",
      status: 400,
      code: "invalid_grant",
      __isAuthError: true,
      toJSON: () => ({ message: "invalid grant" }),
    } as unknown as AuthError;

    vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: null, session: null, redirectType: null },
      error: authError,
    } as never);

    renderCallback("/auth/callback?code=stale-code");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "We couldn't complete your sign-in" })).toBeInTheDocument()
    );
    expect(screen.getByText(/invalid or incomplete/i)).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: /back to sign in/i });
    expect(backLink.getAttribute("href")).toBe("/signin");
  });

  it("fails gracefully when visited with no callback parameters", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);

    renderCallback();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
    expect(
      screen.getByRole("link", { name: /back to sign in/i })
    ).toBeInTheDocument();
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });
});

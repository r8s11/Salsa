import { describe, expect, it, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ConfirmSignupPage from "./ConfirmSignupPage";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/useAuth";
import { setAuthIntent } from "../../lib/authIntent";
import { setAuthReturnDestination } from "../../lib/authReturnDestination";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      verifyOtp: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

vi.mock("../../contexts/useAuth", () => ({
  useAuth: vi.fn(),
}));

function userWithRole(role: string | null): User {
  return { id: "u1", app_metadata: role ? { role } : {} } as unknown as User;
}

function renderPage(initialEntry: string, extraRoutes: { path: string; text: string }[] = []) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth/confirm" element={<ConfirmSignupPage />} />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        {extraRoutes.map(({ path, text }) => (
          <Route key={path} path={path} element={<div>{text}</div>} />
        ))}
      </Routes>
    </MemoryRouter>
  );
}

describe("ConfirmSignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);
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
      updateEmail: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
  });

  it("never calls verifyOtp on mount — a plain GET must not consume the token", async () => {
    renderPage("/auth/confirm?token_hash=abc123&type=signup");
    expect(await screen.findByRole("button", { name: "Confirm email" })).toBeInTheDocument();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("shows an invalid-link error and no confirm button when token_hash is missing", async () => {
    renderPage("/auth/confirm?type=signup");
    expect(
      await screen.findByRole("heading", { name: "Invalid confirmation link" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm email" })).not.toBeInTheDocument();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("shows an invalid-link error when type is not signup", async () => {
    renderPage("/auth/confirm?token_hash=abc123&type=recovery");
    expect(
      await screen.findByRole("heading", { name: "Invalid confirmation link" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm email" })).not.toBeInTheDocument();
  });

  it("calls verifyOtp with the token_hash (never a raw token) only after an explicit click", async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { session: {}, user: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: userWithRole(null) } },
      error: null,
    } as never);
    renderPage("/auth/confirm?token_hash=abc123&type=signup", [
      { path: "/profile", text: "Profile Page" },
    ]);

    const button = await screen.findByRole("button", { name: "Confirm email" });
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    await user.click(button);

    await waitFor(() => expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(1));
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc123", type: "signup" });
    expect(await screen.findByText("Profile Page")).toBeInTheDocument();
  });

  it("routes an organizer to /host and an admin to /admin after confirming", async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { session: {}, user: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: userWithRole("organizer") } },
      error: null,
    } as never);
    renderPage("/auth/confirm?token_hash=abc123&type=signup", [
      { path: "/host", text: "Host Page" },
    ]);
    await user.click(await screen.findByRole("button", { name: "Confirm email" }));
    expect(await screen.findByText("Host Page")).toBeInTheDocument();
  });

  it("honors a safe ?next= destination over the role default", async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { session: {}, user: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: userWithRole(null) } },
      error: null,
    } as never);
    renderPage("/auth/confirm?token_hash=abc123&type=signup&next=%2Fabout", [
      { path: "/about", text: "About Page" },
    ]);
    await user.click(await screen.findByRole("button", { name: "Confirm email" }));
    expect(await screen.findByText("About Page")).toBeInTheDocument();
  });

  it("ignores an unsafe external ?next= and falls back to the role default", async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { session: {}, user: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: userWithRole(null) } },
      error: null,
    } as never);
    renderPage("/auth/confirm?token_hash=abc123&type=signup&next=https%3A%2F%2Fevil.com", [
      { path: "/profile", text: "Profile Page" },
    ]);
    await user.click(await screen.findByRole("button", { name: "Confirm email" }));
    expect(await screen.findByText("Profile Page")).toBeInTheDocument();
  });

  it("prefers a stored auth-return destination over ?next= and the role default", async () => {
    const user = userEvent.setup();
    setAuthReturnDestination("/founders/accept");
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { session: {}, user: null },
      error: null,
    } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: userWithRole(null) } },
      error: null,
    } as never);
    renderPage("/auth/confirm?token_hash=abc123&type=signup&next=%2Fabout", [
      { path: "/founders/accept", text: "Founder Acceptance Page" },
    ]);
    await user.click(await screen.findByRole("button", { name: "Confirm email" }));
    expect(await screen.findByText("Founder Acceptance Page")).toBeInTheDocument();
  });

  it("shows an expired/invalid-link error when verifyOtp fails, with a resend action", async () => {
    const user = userEvent.setup();
    setAuthIntent("signup", "person@example.com");
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Token has expired or is invalid", name: "AuthApiError", status: 403 },
    } as never);
    renderPage("/auth/confirm?token_hash=abc123&type=signup");
    await user.click(await screen.findByRole("button", { name: "Confirm email" }));

    expect(
      await screen.findByRole("heading", { name: "We couldn't confirm your email" })
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid or has already been used/i);
    expect(screen.getByRole("button", { name: "Resend confirmation email" })).toBeInTheDocument();
  });

  it("reusing an already-confirmed link fails on the second click, as expected", async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.auth.verifyOtp)
      .mockResolvedValueOnce({ data: { session: {}, user: null }, error: null } as never)
      .mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { message: "Token has expired or is invalid", name: "AuthApiError", status: 403 },
      } as never);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: userWithRole(null) } },
      error: null,
    } as never);
    const { unmount } = renderPage("/auth/confirm?token_hash=abc123&type=signup", [
      { path: "/profile", text: "Profile Page" },
    ]);
    await user.click(await screen.findByRole("button", { name: "Confirm email" }));
    await screen.findByText("Profile Page");
    unmount();

    renderPage("/auth/confirm?token_hash=abc123&type=signup");
    await user.click(await screen.findByRole("button", { name: "Confirm email" }));
    expect(
      await screen.findByRole("heading", { name: "We couldn't confirm your email" })
    ).toBeInTheDocument();
    expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(2);
  });

  it("never renders the raw token_hash value anywhere in the confirmation UI copy", async () => {
    renderPage("/auth/confirm?token_hash=super-secret-token-value&type=signup");
    await screen.findByRole("button", { name: "Confirm email" });
    expect(screen.queryByText(/super-secret-token-value/)).not.toBeInTheDocument();
  });
});

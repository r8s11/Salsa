import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import InviteActivationPage from "./InviteActivationPage";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
  verifyOtp: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: mocks,
  },
}));

function userWithRole(role: string | null): User {
  return { id: "invitee", app_metadata: role ? { role } : {} } as User;
}

function setCallbackUrl(path = "/auth/invite") {
  window.history.replaceState({}, "", path);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/auth/invite"]}>
      <Routes>
        <Route path="/auth/invite" element={<InviteActivationPage />} />
        <Route path="/signin" element={<div>Sign in page</div>} />
        <Route path="/host" element={<div>Host dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function expectOrganizerForm() {
  expect(
    await screen.findByRole("heading", { name: /set your organizer password/i })
  ).toBeInTheDocument();
}

describe("InviteActivationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCallbackUrl();
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: null, user: null }, error: null });
    mocks.setSession.mockResolvedValue({ data: { session: null, user: null }, error: null });
    mocks.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: null });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("shows an accessible error and sign-in action for callback errors", async () => {
    setCallbackUrl("/auth/invite?error=access_denied&error_description=Invitation%20expired");
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid|expired|already been used/i);
    expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/signin");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("shows an accessible error for hash-fragment callback errors (GoTrue's real redirect shape)", async () => {
    setCallbackUrl(
      "/auth/invite#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid|expired|already been used/i);
    expect(mocks.setSession).not.toHaveBeenCalled();
    // A hash-carried error must short-circuit before any session lookup. Without
    // hash parsing, this exact URL falls through to the no-session fallback path
    // instead (which happens to render the same visible text), silently calling
    // getSession() along the way — assert that never happens here.
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("exchanges a PKCE code exactly once and shows organizer password setup", async () => {
    setCallbackUrl("/auth/invite?code=pkce-code");
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: {}, user: null }, error: null });
    mocks.getSession.mockResolvedValue({ data: { session: { user: userWithRole("organizer") } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: userWithRole("organizer") }, error: null });
    const { rerender } = renderPage();

    await expectOrganizerForm();

    // Re-render the same tree (simulates a parent re-render / navigation
    // that does not remount this route) and confirm the callback is not
    // consumed a second time.
    rerender(
      <MemoryRouter initialEntries={["/auth/invite"]}>
        <Routes>
          <Route path="/auth/invite" element={<InviteActivationPage />} />
          <Route path="/signin" element={<div>Sign in page</div>} />
          <Route path="/host" element={<div>Host dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
  });

  it("sets an explicit hash session exactly once before showing organizer setup", async () => {
    setCallbackUrl("/auth/invite#access_token=access&refresh_token=refresh");
    mocks.setSession.mockResolvedValue({ data: { session: {}, user: null }, error: null });
    mocks.getSession.mockResolvedValue({ data: { session: { user: userWithRole("organizer") } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: userWithRole("organizer") }, error: null });
    renderPage();

    await expectOrganizerForm();
    expect(mocks.setSession).toHaveBeenCalledTimes(1);
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: "access", refresh_token: "refresh" });
  });

  it("verifies a token-hash invite link exactly once and shows organizer setup", async () => {
    setCallbackUrl("/auth/invite?token_hash=hash-value&type=invite");
    mocks.verifyOtp.mockResolvedValue({ data: { session: {}, user: null }, error: null });
    mocks.getSession.mockResolvedValue({ data: { session: { user: userWithRole("organizer") } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: userWithRole("organizer") }, error: null });
    renderPage();

    await expectOrganizerForm();
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-value", type: "invite" });
  });

  it("still completes and reaches organizer setup under React StrictMode's double-invoked effects", async () => {
    setCallbackUrl("/auth/invite#access_token=access&refresh_token=refresh");
    mocks.setSession.mockResolvedValue({ data: { session: {}, user: null }, error: null });
    mocks.getSession.mockResolvedValue({ data: { session: { user: userWithRole("organizer") } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: userWithRole("organizer") }, error: null });

    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/auth/invite"]}>
          <Routes>
            <Route path="/auth/invite" element={<InviteActivationPage />} />
            <Route path="/signin" element={<div>Sign in page</div>} />
            <Route path="/host" element={<div>Host dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </StrictMode>
    );

    await expectOrganizerForm();
    expect(mocks.setSession).toHaveBeenCalledTimes(1);
  });

  it("does not consume a reused or invalid callback more than once", async () => {
    setCallbackUrl("/auth/invite?code=used-code");
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "invalid grant" },
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid|expired|already been used/i);
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it("rejects an invitation that does not establish a session", async () => {
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid|expired|already been used/i);
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });

  it.each([null, "moderator", "admin"])(
    "denies a non-organizer role (%s) without setup or host navigation",
    async (role) => {
      mocks.getSession.mockResolvedValue({ data: { session: { user: userWithRole(role) } }, error: null });
      mocks.getUser.mockResolvedValue({ data: { user: userWithRole(role) }, error: null });
      renderPage();

      expect(await screen.findByRole("alert")).toHaveTextContent(/organizer invitation/i);
      expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/signin");
      expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
      expect(screen.queryByText("Host dashboard")).not.toBeInTheDocument();
    }
  );

  it("keeps password update unavailable for short or mismatched passwords", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: userWithRole("organizer") } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: userWithRole("organizer") }, error: null });
    const user = userEvent.setup();
    renderPage();
    await expectOrganizerForm();

    await user.type(screen.getByLabelText(/^password$/i), "short");
    await user.type(screen.getByLabelText(/confirm password/i), "different");
    await user.click(screen.getByRole("button", { name: /set password/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/at least 8 characters|match/i);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("keeps the organizer form usable after update failure", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: userWithRole("organizer") } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: userWithRole("organizer") }, error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: { message: "Password rejected" } });
    const user = userEvent.setup();
    renderPage();
    await expectOrganizerForm();

    await user.type(screen.getByLabelText(/^password$/i), "strong-password");
    await user.type(screen.getByLabelText(/confirm password/i), "strong-password");
    await user.click(screen.getByRole("button", { name: /set password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/password rejected/i);
    expect(screen.getByRole("button", { name: /set password/i })).toBeEnabled();
  });

  it("updates a valid organizer password and only then navigates to host", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: userWithRole("organizer") } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: userWithRole("organizer") }, error: null });
    const user = userEvent.setup();
    renderPage();
    await expectOrganizerForm();

    await user.type(screen.getByLabelText(/^password$/i), "strong-password");
    await user.type(screen.getByLabelText(/confirm password/i), "strong-password");
    await user.click(screen.getByRole("button", { name: /set password/i }));

    await waitFor(() => expect(screen.getByText("Host dashboard")).toBeInTheDocument());
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "strong-password" });
  });
});

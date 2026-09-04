import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SignInForm from "./SignInForm";
import { useAuth } from "../../contexts/useAuth";

vi.mock("../../contexts/useAuth", () => ({
  useAuth: vi.fn(),
}));

describe("SignInForm", () => {
  it("redirects to the requested page after successful sign-in", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null, user: null });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      role: null,
      signInWithPassword,
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/signin", state: { from: "/submit" } }]}>
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/submit" element={<div>Submit Event Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText("Submit Event Page")).toBeInTheDocument();
    });
    expect(signInWithPassword).toHaveBeenCalledWith("user@example.com", "password123");
  });

  it("redirects to the requested page after signup when the session is created immediately", async () => {
    // Local dev / any environment with email confirmation disabled: Supabase
    // auto-confirms and returns a session synchronously from signUp(), so the
    // user is already authenticated and should land where sign-in would send
    // them rather than being told to check an email that was never sent.
    const signUp = vi.fn().mockResolvedValue({
      error: null,
      session: { access_token: "t", user: { id: "u1" } },
      user: { id: "u1", app_metadata: {} },
    });
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
      requestPasswordReset: vi.fn(),
      signUp,
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/signin", state: { from: "/submit" } }]}>
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/submit" element={<div>Submit Event Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /^sign up$/i }));
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(screen.getByText("Submit Event Page")).toBeInTheDocument();
    });
    expect(signUp).toHaveBeenCalledWith("new@example.com", "password123");
  });

  it("redirects an Organizer with no intended route to /host", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: null,
      user: { id: "u1", app_metadata: { role: "organizer" } },
    });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      role: null,
      signInWithPassword,
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/signin" }]}>
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/host" element={<div>Host Dashboard</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "organizer@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText("Host Dashboard")).toBeInTheDocument();
    });
  });

  it("redirects an Admin or Moderator with no intended route to /admin", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: null,
      user: { id: "u2", app_metadata: { role: "moderator" } },
    });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      role: null,
      signInWithPassword,
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/signin" }]}>
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/admin" element={<div>Admin Dashboard</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "mod@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });
  });

  it("redirects a regular user with no intended route to /profile", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: null,
      user: { id: "u3", app_metadata: {} },
    });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      role: null,
      signInWithPassword,
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/signin" }]}>
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/profile" element={<div>Profile Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText("Profile Page")).toBeInTheDocument();
    });
  });

  it("preserves a valid internal intended route over the role default", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: null,
      user: { id: "u4", app_metadata: { role: "organizer" } },
    });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      role: null,
      signInWithPassword,
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/signin", state: { from: "/host/events/abc" } }]}
      >
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/host/events/abc" element={<div>Event Detail Page</div>} />
          <Route path="/host" element={<div>Host Dashboard</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "organizer@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText("Event Detail Page")).toBeInTheDocument();
    });
  });

  it("falls back to the role-appropriate destination when the intended route is external", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: null,
      user: { id: "u5", app_metadata: { role: "organizer" } },
    });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      role: null,
      signInWithPassword,
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/signin", state: { from: "https://evil.com" } }]}
      >
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/host" element={<div>Host Dashboard</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "organizer@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText("Host Dashboard")).toBeInTheDocument();
    });
  });

  it("shows a confirmation message after signup when no session is returned", async () => {
    // A real deployment with email confirmation enabled: signUp() succeeds
    // but returns session: null until the user clicks the emailed link.
    const signUp = vi.fn().mockResolvedValue({ error: null, session: null });
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
      requestPasswordReset: vi.fn(),
      signUp,

      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/signin"]}>
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /^sign up$/i }));
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Check your email — we sent a confirmation link to finish creating your account."
        )
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
  });
  it("removes unavailable social sign-in controls", () => {
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
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    expect(screen.queryByText(/apple|google|github/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/coming\s+soon/i)).not.toBeInTheDocument();
  });

  it("reveals the password when requested", async () => {
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
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    const password = screen.getByLabelText(/^password$/i);
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("switches mode headings while preserving submit semantics", async () => {
    const signUp = vi.fn().mockResolvedValue({ error: null, session: null });
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
      requestPasswordReset: vi.fn(),
      signUp,
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));
    expect(signUp).toHaveBeenCalledWith("new@example.com", "password123");
  });

  it("switches to a password reset request form and submits it", async () => {
    const requestPasswordReset = vi.fn().mockResolvedValue({ error: null });
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
      requestPasswordReset,
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(requestPasswordReset).toHaveBeenCalledWith("user@example.com");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/we've sent a link/i);
    });
  });

  it("shows a friendly error when the reset request itself fails", async () => {
    const requestPasswordReset = vi.fn().mockResolvedValue({
      error: new Error("Too many attempts. Please wait a moment and try again."),
    });
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
      requestPasswordReset,
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /forgot password/i }));
    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/too many attempts/i);
    });
  });

  it("returns to sign-in from the reset form", async () => {
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
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /forgot password/i }));
    await user.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("arrives pre-filled in reset mode when navigated with reset state", () => {
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
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/signin", state: { mode: "reset", email: "expired@example.com" } },
        ]}
      >
        <SignInForm />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue("expired@example.com");
  });

  it("associates a credential failure with the email field and moves focus there, preserving values", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: new Error("Invalid login credentials"),
      user: null,
    });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      role: null,
      signInWithPassword,
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/incorrect email or password/i);
    expect(alert).toHaveAttribute("id", "auth-form-error");

    const emailInput = screen.getByLabelText(/email/i);
    await waitFor(() => expect(emailInput).toHaveFocus());
    expect(emailInput).toHaveValue("user@example.com");
    expect(screen.getByLabelText(/^password$/i)).toHaveValue("wrongpassword");
  });

  it("renders a Confirm password field on sign-up and blocks submit on mismatch without calling signUp", async () => {
    const signUp = vi.fn();
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
      requestPasswordReset: vi.fn(),
      signUp,
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /^sign up$/i }));
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "different123");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    const confirmInput = screen.getByLabelText(/confirm password/i);
    await waitFor(() => expect(confirmInput).toHaveFocus());
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("blocks sign-up submit on a too-short password without calling signUp", async () => {
    const signUp = vi.fn();
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
      requestPasswordReset: vi.fn(),
      signUp,
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /^sign up$/i }));
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "short");
    await user.type(screen.getByLabelText(/confirm password/i), "short");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows SalsaSegura copy for an unconfirmed email and still offers Resend", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: new Error("Email not confirmed"),
      user: null,
    });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      isModerator: false,
      isOrganizer: false,
      role: null,
      signInWithPassword,
      resendConfirmation: vi.fn(),
      requestPasswordReset: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(
      await screen.findByText(
        "Your email address hasn't been confirmed yet. Resend the confirmation email to continue."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/email not confirmed/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend confirmation email/i })).toBeInTheDocument();
  });

  it("keeps the reset-mode privacy copy unchanged regardless of whether the account exists", async () => {
    const requestPasswordReset = vi.fn().mockResolvedValue({ error: null });
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
      requestPasswordReset,
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /forgot password/i }));
    await user.type(screen.getByLabelText(/email/i), "unknown@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(
      await screen.findByText(
        "If an account exists for that email, we've sent a link to reset your password."
      )
    ).toBeInTheDocument();
  });
});

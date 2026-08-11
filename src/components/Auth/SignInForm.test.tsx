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
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      signInWithPassword,
      signUp: vi.fn(),

      signOut: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/signin", state: { from: "/submit" } }]}
      >
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/submit" element={<div>Submit Event Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>,
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
    });
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      signInWithPassword: vi.fn(),
      signUp,

      signOut: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/signin", state: { from: "/submit" } }]}
      >
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/submit" element={<div>Submit Event Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^sign up$/i }));
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(screen.getByText("Submit Event Page")).toBeInTheDocument();
    });
    expect(signUp).toHaveBeenCalledWith("new@example.com", "password123");
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
      signInWithPassword: vi.fn(),
      signUp,

      signOut: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/signin"]}>
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /^sign up$/i }));
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Check your email for a confirmation link."),
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
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>,
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
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>,
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
      signInWithPassword: vi.fn(),
      signUp,
      signOut: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SignInForm />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));
    expect(signUp).toHaveBeenCalledWith("new@example.com", "password123");
  });
});

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
      signInWithOAuth: vi.fn(),
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
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText("Submit Event Page")).toBeInTheDocument();
    });
    expect(signInWithPassword).toHaveBeenCalledWith("user@example.com", "password123");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SignInPage from "./SignInPage";
import { useAuth } from "../../contexts/useAuth";

vi.mock("../../contexts/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: { auth: { signInWithOAuth: vi.fn(), signInWithIdToken: vi.fn() } },
  supabaseURL: "https://project.supabase.co",
  supabasePublishableKey: "sb_publishable_test",
}));

describe("SignInPage", () => {
  // Pin config so a developer's .env.local or network cannot leak in.
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    // Answer Supabase Auth's /auth/v1/settings with only email enabled.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      external: { apple: false, google: false, facebook: false, email: true },
    }))));
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
      updateEmail: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      clearDeletedAccount: vi.fn(),
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("links the sign-in help topic to its guide anchor", async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/signin" }]}>
        <SignInPage />
      </MemoryRouter>
    );

    const help = await screen.findByRole("complementary", { name: "Help for this page" });
    expect(within(help).getByRole("link", { name: "Help with signing in" })).toHaveAttribute(
      "href",
      "/help/dancers#create-an-account-or-sign-in"
    );
  });
});

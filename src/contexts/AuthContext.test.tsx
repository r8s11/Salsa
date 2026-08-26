import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resend: vi.fn(),
    },
  },
}));

import { supabase } from "../lib/supabase";

function makeUser(role: string): User {
  return {
    id: `user-${role}`,
    app_metadata: { role },
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
}

function makeSession(user: User): Session {
  return {
    access_token: "token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user,
  } as Session;
}

let capturedSignIn: { error: Error | null; user: User | null } | undefined;
let capturedSignUp: { error: Error | null; session: Session | null; user: User | null } | undefined;

function SignInTrigger() {
  const { signInWithPassword, user, role } = useAuth();
  return (
    <div>
      <div data-testid="user-id">{user?.id ?? "none"}</div>
      <div data-testid="role">{role ?? "none"}</div>
      <button
        onClick={async () => {
          capturedSignIn = await signInWithPassword("user@example.com", "password123");
        }}
      >
        sign in
      </button>
    </div>
  );
}

function SignUpTrigger() {
  const { signUp, user, role } = useAuth();
  return (
    <div>
      <div data-testid="user-id">{user?.id ?? "none"}</div>
      <div data-testid="role">{role ?? "none"}</div>
      <button
        onClick={async () => {
          capturedSignUp = await signUp("new@example.com", "password123");
        }}
      >
        sign up
      </button>
    </div>
  );
}

describe("AuthContext sign-in state race", () => {
  beforeEach(() => {
    capturedSignIn = undefined;
    capturedSignUp = undefined;
    vi.mocked(supabase.auth.signInWithPassword).mockReset();
    vi.mocked(supabase.auth.signUp).mockReset();
  });

  it("resolves signInWithPassword with the fresh user and updates context state synchronously", async () => {
    const organizer = makeUser("organizer");
    const session = makeSession(organizer);
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: organizer, session },
      error: null,
    } as never);

    render(
      <AuthProvider>
        <SignInTrigger />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("sign in").click();
    });

    // The returned value must carry the fresh user without waiting for a
    // subsequent render/act cycle driven by onAuthStateChange.
    expect(capturedSignIn?.error).toBeNull();
    expect(capturedSignIn?.user?.id).toBe(organizer.id);

    // Context state (user/role) must already reflect the fresh session by
    // the time `act` flushes — no extra `waitFor` polling needed.
    expect(screen.getByTestId("user-id")).toHaveTextContent(organizer.id);
    expect(screen.getByTestId("role")).toHaveTextContent("organizer");
  });

  it("resolves signUp with a derived user from the returned session", async () => {
    const admin = makeUser("admin");
    const session = makeSession(admin);
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: admin, session },
      error: null,
    } as never);

    render(
      <AuthProvider>
        <SignUpTrigger />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("sign up").click();
    });

    expect(capturedSignUp?.error).toBeNull();
    expect(capturedSignUp?.user?.id).toBe(admin.id);
    expect(capturedSignUp?.session).toBe(session);

    expect(screen.getByTestId("user-id")).toHaveTextContent(admin.id);
    expect(screen.getByTestId("role")).toHaveTextContent("admin");
  });

  it("resolves signUp with a null user when no session is created (email confirmation pending)", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as never);

    render(
      <AuthProvider>
        <SignUpTrigger />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("sign up").click();
    });

    expect(capturedSignUp?.error).toBeNull();
    expect(capturedSignUp?.session).toBeNull();
    expect(capturedSignUp?.user).toBeNull();
  });
});

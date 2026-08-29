import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
let capturedSignOut: { error: Error | null } | undefined;

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

function SignOutTrigger({ scope }: { scope: "local" | "others" | "global" }) {
  const { signOut, user, session } = useAuth();
  return (
    <div>
      <div data-testid="sign-out-user-id">{user?.id ?? "none"}</div>
      <div data-testid="sign-out-session">{session ? "present" : "none"}</div>
      <button
        onClick={async () => {
          capturedSignOut = await signOut(scope);
        }}
      >
        sign out
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
    capturedSignOut = undefined;
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never);
    vi.mocked(supabase.auth.signOut).mockReset();
  });

  it("resolves signInWithPassword with the fresh user and updates context state synchronously", async () => {
    const organizer = makeUser("organizer");
    const session = makeSession(organizer);
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: organizer, session },
      error: null,
    } as never);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <SignInTrigger />
        </AuthProvider>
      </QueryClientProvider>
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
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <SignUpTrigger />
        </AuthProvider>
      </QueryClientProvider>
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
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <SignUpTrigger />
        </AuthProvider>
      </QueryClientProvider>
    );

    await act(async () => {
      screen.getByText("sign up").click();
    });

    expect(capturedSignUp?.error).toBeNull();
    expect(capturedSignUp?.session).toBeNull();
    expect(capturedSignUp?.user).toBeNull();
  });
});

describe("AuthContext scoped sign-out", () => {
  it("clears local auth and private query state only after a successful local sign-out", async () => {
    const organizer = makeUser("organizer");
    const session = makeSession(organizer);
    const queryClient = new QueryClient();
    queryClient.setQueryData(["private", organizer.id], { secret: "private event data" });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session } } as never);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SignOutTrigger scope="local" />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("sign-out-user-id")).toHaveTextContent(organizer.id));

    await act(async () => {
      screen.getByText("sign out").click();
    });

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(capturedSignOut?.error).toBeNull();
    expect(screen.getByTestId("sign-out-user-id")).toHaveTextContent("none");
    expect(screen.getByTestId("sign-out-session")).toHaveTextContent("none");
    expect(queryClient.getQueryData(["private", organizer.id])).toBeUndefined();
  });

  it("keeps current auth and private query state after successful other-session sign-out", async () => {
    const organizer = makeUser("organizer");
    const session = makeSession(organizer);
    const queryClient = new QueryClient();
    queryClient.setQueryData(["private", organizer.id], { secret: "private event data" });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session } } as never);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SignOutTrigger scope="others" />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("sign-out-user-id")).toHaveTextContent(organizer.id));

    await act(async () => {
      screen.getByText("sign out").click();
    });

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(capturedSignOut?.error).toBeNull();
    expect(screen.getByTestId("sign-out-user-id")).toHaveTextContent(organizer.id);
    expect(screen.getByTestId("sign-out-session")).toHaveTextContent("present");
    expect(queryClient.getQueryData(["private", organizer.id])).toEqual({ secret: "private event data" });
  });
});

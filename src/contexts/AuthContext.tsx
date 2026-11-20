import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { posthog } from "../shared/analytics/posthog";
import { firstTouchProperties, getFirstTouch, type FirstTouch } from "../shared/analytics/attribution";
import { recordOwnFirstTouch } from "../features/account/api/accountRepo";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, supabaseAuthStorageKey } from "../lib/supabase";
import { setAuthIntent } from "../lib/authIntent";
import { getCallbackUrl } from "../lib/authCallbackUrl";
import { AuthContext, roleFromUser } from "./authContextObject";
import type { AuthContextValue, AuthSignOutScope } from "./authContextObject";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const role = roleFromUser(user);
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    const previousUserId = identifiedUserId.current;

    if (!user) {
      if (previousUserId) posthog.reset();
      identifiedUserId.current = null;
      return;
    }

    if (previousUserId && previousUserId !== user.id) posthog.reset();
    if (previousUserId !== user.id) {
      // This tab's landing visit, or the one saved at signup when the email
      // confirmation link opened a new tab.
      const savedTouch = user.user_metadata?.first_touch;
      const firstTouch =
        getFirstTouch() ??
        (savedTouch && typeof savedTouch === "object" ? (savedTouch as FirstTouch) : null);
      posthog.identify(
        user.id,
        {
          ...(user.email ? { email: user.email } : {}),
          ...(role ? { role } : {}),
        },
        firstTouchProperties(firstTouch)
      );
      if (firstTouch) {
        // Attribution is best effort; it must never block authentication.
        recordOwnFirstTouch(firstTouch).catch(() => {});
      }
      identifiedUserId.current = user.id;
    }
  }, [role, user]);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };
    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        setSession(data.session);
        setUser(data.user);
      }
      return { error: error as Error | null, user: data.user };
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setAuthIntent("signup", email);
    const firstTouch = getFirstTouch();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Confirmation emails return to the app's own callback route.
          emailRedirectTo: getCallbackUrl(),
          // Kept on the auth user so a confirmation link opened in a new tab
          // can still record how the account arrived.
          ...(firstTouch ? { data: { first_touch: firstTouch } } : {}),
        },
      });
      const freshUser = data.session?.user ?? null;
      if (!error) {
        setSession(data.session);
        setUser(freshUser);
      }
      return { error: error as Error | null, session: data.session, user: freshUser };
    } finally {
      setLoading(false);
    }
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    setLoading(true);
    setAuthIntent("signup", email);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          // Confirmation emails return to the app's own callback route.
          emailRedirectTo: getCallbackUrl(),
        },
      });
      return { error: error as Error | null };
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setLoading(true);
    setAuthIntent("recovery", email);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Recovery emails return to the app's own callback route, which
        // detects the PASSWORD_RECOVERY auth event and shows a "set new
        // password" form instead of navigating away immediately.
        redirectTo: getCallbackUrl(),
      });
      return { error: error as Error | null };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEmail = useCallback(async (newEmail: string) => {
    setAuthIntent("email_change", newEmail);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        {
          // Change confirmation emails return to the app's own callback
          // route, same as signup and recovery.
          emailRedirectTo: getCallbackUrl(),
        }
      );
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signOut = useCallback(
    async (scope: AuthSignOutScope) => {
      try {
        const { error } = await supabase.auth.signOut({ scope });
        if (error) {
          return { error };
        }

        if (scope !== "others") {
          setSession(null);
          setUser(null);
          queryClient.clear();
        }

        return { error: null };
      } catch (error) {
        return {
          error:
            error instanceof Error ? error : new Error("Unable to sign out. Please try again."),
        };
      }
    },
    [queryClient]
  );

  const clearDeletedAccount = useCallback(() => {
    setSession(null);
    setUser(null);
    queryClient.clear();
    window.localStorage.removeItem(supabaseAuthStorageKey);
    window.localStorage.removeItem(`${supabaseAuthStorageKey}-user`);
  }, [queryClient]);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    role,
    isAdmin: role === "admin",
    isModerator: role === "admin" || role === "moderator",
    isOrganizer: role === "organizer",
    signInWithPassword,
    resendConfirmation,
    requestPasswordReset,
    updateEmail,
    signUp,
    signOut,
    clearDeletedAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

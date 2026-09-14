import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, supabaseAuthStorageKey } from "../lib/supabase";
import { setAuthIntent } from "../lib/authIntent";
import { AuthContext, roleFromUser } from "./authContextObject";
import type { AuthContextValue, AuthSignOutScope } from "./authContextObject";

// Production callback URL - explicit to ensure Supabase redirect matching.
// Both www and non-www variants are supported in Supabase's allowed URLs.
const PRODUCTION_ORIGIN = "https://www.salsasegura.com";
const getCallbackUrl = () => {
  // In production (non-localhost), prefer explicit production URL for consistency
  const isLocal =
    window.location.origin === "http://localhost:5173" ||
    window.location.origin === "http://localhost:3000" ||
    window.location.origin === "http://127.0.0.1:5173" ||
    window.location.origin === "http://127.0.0.1:3000";
  const url = isLocal
    ? `${window.location.origin}/auth/callback`
    : `${PRODUCTION_ORIGIN}/auth/callback`;
  console.log("[Auth] getCallbackUrl:", { isLocal, windowOrigin: window.location.origin, url });
  return url;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

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
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Confirmation emails return to the app's own callback route.
          emailRedirectTo: getCallbackUrl(),
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

  const role = roleFromUser(user);
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

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthContext, roleFromUser } from "./authContextObject";
import type { AuthContextValue, AuthSignOutScope } from "./authContextObject";

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
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Confirmation emails return to the app's own callback route.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
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
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          // Confirmation emails return to the app's own callback route.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { error: error as Error | null };
    } finally {
      setLoading(false);
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
          error: error instanceof Error ? error : new Error("Unable to sign out. Please try again."),
        };
      }
    },
    [queryClient]
  );

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
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

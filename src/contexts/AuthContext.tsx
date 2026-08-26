import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthContext, roleFromUser } from "./authContextObject";
import type { AuthContextValue } from "./authContextObject";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error as Error | null };
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
      return { error: error as Error | null, session: data.session };
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

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  }, []);

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

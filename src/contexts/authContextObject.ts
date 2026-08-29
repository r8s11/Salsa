import { createContext } from "react";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "admin" | "moderator" | "organizer";

export function roleFromUser(user: User | null): UserRole | null {
  const role = user?.app_metadata?.role;
  if (role === "admin" || role === "moderator" || role === "organizer") {
    return role;
  }
  return null;
}

export type AuthSignOutScope = "local" | "global" | "others";
export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  isModerator: boolean;
  isOrganizer: boolean;
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; user: User | null }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; session: Session | null; user: User | null }>;
  signOut: (scope: AuthSignOutScope) => Promise<{ error: Error | null }>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

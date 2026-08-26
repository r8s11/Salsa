import { createContext } from "react";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "admin" | "moderator" | "organizer";

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  isModerator: boolean;
  isOrganizer: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; session: Session | null }>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Account identity — private, authenticated data about the signed-in user.
// Deliberately separate from any future "public profile" model: this file
// only derives what the account owner sees about themselves.

export type AccountRole = "user" | "moderator" | "organizer" | "admin";
export type AccountStatus = "active" | "flagged" | "suspended" | "banned";

// Mirrors public.profiles (supabase/migrations/20260813000000_profiles.sql,
// 20260815000000_users_management.sql). `role` is intentionally NOT part of
// this row — AuthContext's role (sourced from the JWT app_metadata, the
// actual authorization source) is the truthful display source; profiles.role
// is a denormalized display/derivation column per the migration's own
// comment and can lag the JWT.
export interface OwnProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  status: AccountStatus;
  status_reason: string | null;
  created_at: string;
}

export const ROLE_LABEL: Record<AccountRole, string> = {
  user: "User",
  moderator: "Moderator",
  organizer: "Organizer",
  admin: "Admin",
};

export const SAFE_NAME_FALLBACK = "SalsaSegura member";

export interface ResolvedIdentity {
  /** Truthful display name — never the account email. */
  name: string;
  /** "@username" shown under the name, or null when it would duplicate `name`. */
  usernameLine: string | null;
  /** True when no username exists at all (drives the "Username not set" state). */
  usernameMissing: boolean;
}

/**
 * display_name → username → safe generic fallback. The email address is
 * never used as a display-style name.
 */
export function resolveIdentity(profile: Pick<OwnProfile, "display_name" | "username">): ResolvedIdentity {
  const displayName = profile.display_name?.trim() || "";
  const username = profile.username?.trim() || "";

  if (displayName) {
    return {
      name: displayName,
      usernameLine: username ? `@${username}` : null,
      usernameMissing: !username,
    };
  }

  if (username) {
    return { name: `@${username}`, usernameLine: null, usernameMissing: false };
  }

  return { name: SAFE_NAME_FALLBACK, usernameLine: null, usernameMissing: true };
}

/** First letter of the resolved name, skipping a leading "@". */
export function initialsFor(identity: ResolvedIdentity): string {
  const source = identity.name.startsWith("@") ? identity.name.slice(1) : identity.name;
  return source.charAt(0).toUpperCase() || "?";
}

export function memberSinceLabel(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export interface AccountStatusMessage {
  title: string;
  body: string;
}

// Deliberately omits status_reason — that field carries moderator-facing
// notes (supabase/migrations/20260815000000_users_management.sql) and is
// not meant for the account owner's screen.
const STATUS_MESSAGES: Partial<Record<AccountStatus, AccountStatusMessage>> = {
  flagged: {
    title: "Account flagged for review",
    body: "Some SalsaSegura actions may be limited while your account is reviewed.",
  },
  suspended: {
    title: "Account suspended",
    body: "Some SalsaSegura actions are currently unavailable.",
  },
  banned: {
    title: "Account banned",
    body: "This account no longer has access to SalsaSegura actions.",
  },
};

/** Returns null for "active" — normal accounts get no status banner. */
export function statusMessageFor(status: AccountStatus): AccountStatusMessage | null {
  return STATUS_MESSAGES[status] ?? null;
}

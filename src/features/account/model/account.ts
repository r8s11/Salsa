import type { UserRole } from "../../../contexts/authContextObject";
import type { City } from "../../events/model/types";

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
  /** Owner-editable presentation fields (20260911000000_profile_public_fields.sql). */
  bio: string | null;
  city: City | null;
  dance_styles: string[];
  instagram: string | null;
  website: string | null;
  cover_url: string | null;
  public_profile: boolean;
  stats_public: boolean;
  notification_prefs: NotificationPrefs;
}

/** Notification toggles, keyed by preference slug (profiles.notification_prefs). */
export type NotificationPrefs = Partial<Record<NotificationPrefKey, boolean>>;

export type NotificationPrefKey = (typeof NOTIFICATION_PREFS)[number]["key"];

/**
 * The notification toggles the editor renders, with the default applied when
 * a profile has never saved a value for that key. Unset means "on" for the
 * two event-relevant ones: a member who submits events expects to hear about
 * their own events without opting in first.
 */
export const NOTIFICATION_PREFS = [
  {
    key: "new_events_in_city",
    label: "New events in my city",
    default: true,
  },
  {
    key: "weekly_digest",
    label: "Weekly digest of what's on",
    default: false,
  },
  {
    key: "my_event_updates",
    label: "Updates about events I submitted",
    default: true,
  },
] as const;

/** The stored value when present, else the toggle's documented default. */
export function notificationPrefEnabled(
  prefs: NotificationPrefs | null | undefined,
  key: NotificationPrefKey
): boolean {
  const stored = prefs?.[key];
  if (typeof stored === "boolean") return stored;
  return NOTIFICATION_PREFS.find((pref) => pref.key === key)?.default ?? false;
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

/**
 * Up to two initials for the compact header avatar. Strips a leading "@"
 * (username fallback), then takes the first character of at most the first
 * two whitespace-separated words, uppercased. Returns "?" for blank input.
 */
export function avatarInitials(source: string): string {
  const trimmed = source.trim().replace(/^@/, "").trim();
  if (!trimmed) {
    return "?";
  }
  const words = trimmed.split(/\s+/).slice(0, 2);
  const initials = words.map((word) => word.charAt(0).toUpperCase()).join("");
  return initials || "?";
}

/**
 * Name + initials for the compact Header account avatar. Resolution order:
 * display_name -> username -> email -> SAFE_NAME_FALLBACK. This is
 * deliberately distinct from `resolveIdentity`/`initialsFor` (used by the
 * large AccountPage avatar, which shows a single letter and never falls
 * back to email): the compact header avatar has room for up to two
 * characters and, lacking any profile name, prefers a real email-derived
 * initial over an anonymous fallback initial.
 */
export function resolveAvatarIdentity(
  profile: Pick<OwnProfile, "display_name" | "username"> | null,
  email?: string | null
): { name: string; initials: string } {
  const name =
    profile?.display_name?.trim() || profile?.username?.trim() || email?.trim() || SAFE_NAME_FALLBACK;
  return { name, initials: avatarInitials(name) };
}

/**
 * The single rule deciding whether a stored/typed photo URL may be both
 * SAVED and assigned to an `<img src>`. Preview and save must not diverge:
 * previously the editor previewed any non-empty string, so a malformed URL
 * — or one carrying embedded credentials — was handed straight to the
 * browser as an image request.
 *
 * Rejects:
 *   - blank / whitespace-only values
 *   - anything `new URL()` cannot parse as an absolute URL
 *   - schemes other than http(s) (`javascript:`, `data:`, `blob:`, `file:`)
 *   - URLs with a username and/or password in the authority, which would
 *     leak those credentials as part of an outbound image request
 *
 * Uploads are a later phase; until then this is the whole trust boundary
 * for user-supplied image locations.
 */
export function isDisplayablePhotoUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  return true;
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

export interface AccountCapabilityLink {
  label: string;
  to: string;
  primary: boolean;
}

/**
 * Product-language capability card. This is presentation mapping, not an
 * authorization source: routes, JWT claims, and Supabase RLS remain the
 * enforcement boundaries.
 */
export interface AccountCapabilityCard {
  title: string;
  description: string;
  links: AccountCapabilityLink[];
}
const PROFILE_AND_ACTIVITY_CARD: AccountCapabilityCard = {
  title: "Profile & Activity",
  description: "View your SalsaSegura activity and submitted events.",
  links: [{ label: "View Profile & Activity", to: "/profile", primary: true }],
};

const SUBMIT_EVENT_CARD: AccountCapabilityCard = {
  title: "Submit an Event",
  description: "Submit an event for SalsaSegura review.",
  links: [{ label: "Submit an Event", to: "/submit", primary: true }],
};

const ROLE_CAPABILITY_CARD: Record<Exclude<UserRole, null>, AccountCapabilityCard> = {
  organizer: {
    title: "Host Events",
    description: "Submit events for review, manage eligible submissions, and promote approved listings.",
    links: [
      { label: "Open Host Dashboard", to: "/host", primary: true },
      { label: "My Events", to: "/host/events", primary: false },
    ],
  },
  moderator: {
    title: "Moderation",
    description: "Review event submissions in the moderation queue.",
    links: [{ label: "Open Moderation Queue", to: "/admin/submissions", primary: true }],
  },
  admin: {
    title: "Administration",
    description:
      "Manage SalsaSegura’s events, users, organizers, venues, taxonomy, and operational workflows.",
    links: [{ label: "Open Admin Dashboard", to: "/admin", primary: true }],
  },
};

/**
 * Maps the one trusted JWT role to destinations guarded by that role. A null
 * role is an ordinary authenticated user; "user" supports the same fallback
 * for profile-derived display state.
 */
export function capabilityCardsFor(role: UserRole | AccountRole | null): AccountCapabilityCard[] {
  const baseCards = [PROFILE_AND_ACTIVITY_CARD, SUBMIT_EVENT_CARD];
  if (role === null || role === "user") return baseCards;
  return [...baseCards, ROLE_CAPABILITY_CARD[role]];
}

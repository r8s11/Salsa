import { supabase } from "../../../lib/supabase";

/**
 * What /u/:username may show. Mirrors the allowlist built by
 * public.public_member_profile (20261109000100_public_member_profile.sql):
 * nothing private is ever part of this shape.
 */
export interface PublicMemberProfile {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  /** Metro slug, e.g. "boston". */
  city: string | null;
  /** Metro display name, when the slug is a registered metro. */
  cityName: string | null;
  danceStyles: string[];
  instagram: string | null;
  website: string | null;
  /** "YYYY-MM" the member joined. */
  memberSince: string | null;
  /** Present only when the member's activity switch is on. */
  activity: { eventsHosted: number } | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Parses the RPC payload. `null` means "no such public member": the server
 * answers identically for a missing username, a private profile and an
 * account that is not in good standing. Anything else that is not a profile
 * object is a malformed response and throws.
 */
export function parsePublicMemberProfile(payload: unknown): PublicMemberProfile | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Unexpected member profile response.");
  }
  const row = payload as Record<string, unknown>;
  const username = text(row.username);
  if (!username) throw new Error("Unexpected member profile response.");

  const activityRaw = row.activity;
  const eventsHosted =
    activityRaw && typeof activityRaw === "object"
      ? (activityRaw as Record<string, unknown>).events_hosted
      : undefined;

  return {
    username,
    displayName: text(row.display_name),
    avatarUrl: text(row.avatar_url),
    coverUrl: text(row.cover_url),
    bio: text(row.bio),
    city: text(row.city),
    cityName: text(row.city_name),
    danceStyles: Array.isArray(row.dance_styles)
      ? row.dance_styles.filter((style): style is string => typeof style === "string")
      : [],
    instagram: text(row.instagram),
    website: text(row.website),
    memberSince: text(row.member_since),
    activity:
      typeof eventsHosted === "number" && Number.isFinite(eventsHosted)
        ? { eventsHosted }
        : null,
  };
}

/**
 * Public lookup by exact username (case-insensitive). Works signed out:
 * the RPC is executable by `anon`. Resolves to null when the member does not
 * exist or is not public, without saying which.
 */
export async function fetchPublicMemberProfile(
  username: string
): Promise<PublicMemberProfile | null> {
  const { data, error } = await supabase.rpc("public_member_profile", {
    p_username: username,
  });
  if (error) throw new Error(error.message);
  return parsePublicMemberProfile(data);
}

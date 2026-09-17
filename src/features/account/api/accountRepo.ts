import { supabase } from "../../../lib/supabase";
import type { City } from "../../events/model/types";
import type { NotificationPrefs, OwnProfile } from "../model/account";

// Every column the profile screens read. Kept in one place so the fetch and
// the update round-trip cannot drift apart.
const OWN_PROFILE_COLUMNS =
  "id, display_name, username, avatar_url, status, status_reason, created_at, bio, city, dance_styles, instagram, website, cover_url, public_profile, stats_public, notification_prefs, onboarding_completed_at" as const;

/**
 * The signed-in user's own `profiles` row, enforced by the "Users read own
 * profile" RLS policy (id = auth.uid()). Returns null when authenticated
 * but no profile row exists yet (see supabase/migrations/20260813000000_profiles.sql
 * handle_new_user trigger — this should be rare, but is not impossible for
 * pre-migration or partially provisioned accounts).
 */
export async function fetchOwnProfile(userId: string): Promise<OwnProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(OWN_PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as OwnProfile | null;
}

/**
 * Self-provision the caller's own `profiles` row when it is missing.
 * handle_new_user normally creates it, but pre-migration or partially
 * provisioned accounts can authenticate without one — previously every
 * avatar/cover save then failed with PostgREST PGRST116 (zero rows).
 * Scoped by the "Users insert own profile row" policy (id = auth.uid()).
 */
export async function ensureOwnProfileRow(userId: string): Promise<OwnProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .insert({ id: userId })
    .select(OWN_PROFILE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as OwnProfile;
}

function isZeroRowsError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST116") return true;
  return /zero rows|0 rows/i.test(error.message ?? "");
}

export type OwnProfileUpdate = {
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  city?: City | null;
  dance_styles?: string[];
  instagram?: string | null;
  website?: string | null;
  cover_url?: string | null;
  public_profile?: boolean;
  stats_public?: boolean;
  notification_prefs?: NotificationPrefs;
};

/**
 * Updates the caller's own `profiles` row, enforced by the
 * "Users update own profile fields" RLS policy
 * (id = auth.uid() on both USING and WITH CHECK).
 *
 * The owner-editable fields are exposed here:
 *   - display_name (non-empty after trim; enforced by the
 *     profiles_display_name_nonempty check constraint)
 *   - avatar_url / cover_url (must be a full http(s) URL when present)
 *   - bio, city, dance_styles, instagram, website
 *   - public_profile / stats_public / notification_prefs
 *
 * Column-level UPDATE privileges on public.profiles
 * (20260830000000_profile_owner_update.sql,
 * 20260911000000_profile_public_fields.sql) block this client path from
 * touching username, role, status, status_reason, created_at, updated_at,
 * or id.
 *
 * Returns the updated row so the caller's cached query state can be
 * hydrated without a second round-trip.
 */
export async function updateOwnProfile(
  userId: string,
  patch: OwnProfileUpdate
): Promise<OwnProfile> {
  const runUpdate = () =>
    supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select(OWN_PROFILE_COLUMNS)
      .single();

  const { data, error } = await runUpdate();
  if (!error) return data as OwnProfile;
  // Legitimate accounts can exist without a profile row. Provision exactly
  // the caller's own row once, then retry — never another user's row.
  if (isZeroRowsError(error)) {
    await ensureOwnProfileRow(userId);
    const retried = await runUpdate();
    if (retried.error) throw new Error(retried.error.message);
    return retried.data as OwnProfile;
  }
  throw new Error(error.message);
}

// ── Onboarding RPCs ───────────────────────────────────────────────
// These call SECURITY DEFINER functions on the server, so the client
// never writes username, onboarding_completed_at, or other columns
// that the column-level UPDATE grant blocks.

export async function setOnboardingProfile(params: {
  display_name: string;
  username: string;
  city: string;
  bio?: string;
  avatar_url?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("set_onboarding_profile", {
    p_display_name: params.display_name,
    p_username: params.username,
    p_city: params.city,
    p_bio: params.bio ?? null,
    p_avatar_url: params.avatar_url ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function markOnboardingComplete(): Promise<void> {
  const { error } = await supabase.rpc("mark_onboarding_complete");
  if (error) throw new Error(error.message);
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_username_available", {
    p_username: username,
  });
  if (error) throw new Error(error.message);
  return data as boolean;
}

import { supabase } from "../../../lib/supabase";
import type { City } from "../../events/model/types";
import type { NotificationPrefs, OwnProfile } from "../model/account";

// Every column the profile screens read. Kept in one place so the fetch and
// the update round-trip cannot drift apart.
const OWN_PROFILE_COLUMNS =
  "id, display_name, username, avatar_url, status, status_reason, created_at, bio, city, dance_styles, instagram, website, cover_url, public_profile, stats_public, notification_prefs" as const;

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
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select(OWN_PROFILE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as OwnProfile;
}

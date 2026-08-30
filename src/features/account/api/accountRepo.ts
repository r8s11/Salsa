import { supabase } from "../../../lib/supabase";
import type { OwnProfile } from "../model/account";

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
    .select("id, display_name, username, avatar_url, status, status_reason, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as OwnProfile | null;
}

export type OwnProfileUpdate = {
  display_name?: string | null;
  avatar_url?: string | null;
};

/**
 * Updates the caller's own `profiles` row, enforced by the
 * "Users update own profile fields" RLS policy
 * (id = auth.uid() on both USING and WITH CHECK).
 *
 * Only the two Phase 6 editable fields are exposed here:
 *   - display_name (non-empty after trim; enforced by the
 *     profiles_display_name_nonempty check constraint)
 *   - avatar_url   (must be a full http(s) URL when present)
 *
 * Column-level UPDATE privileges on public.profiles block this client
 * path from touching username, role, status, status_reason, created_at,
 * updated_at, or id. Username lifecycle belongs to Phase 7.
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
    .select("id, display_name, username, avatar_url, status, status_reason, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as OwnProfile;
}

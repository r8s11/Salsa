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

import { supabase } from "../../../lib/supabase";
import type { SavedVenueRow } from "../model/savedVenue";

/**
 * Saved-venue persistence — matches the RPC/migration added in
 * 20260930000000_saved_venues.sql. Ownership enforced by RLS:
 * the RPC only returns the current user's rows and mutations
 * only touch rows where user_id = auth.uid().
 */
export async function fetchSavedVenues(): Promise<SavedVenueRow[]> {
  const { data, error } = await supabase.rpc("saved_venues_for_current_user");
  if (error) throw new Error("Failed to load saved venues");
  return (data ?? []) as SavedVenueRow[];
}

export async function saveVenue(venueId: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error("You must be signed in to save a venue");
  const { error } = await supabase
    .from("saved_venues")
    .insert({ user_id: user.id, venue_id: venueId });
  if (error) throw new Error("Failed to save venue");
}

export async function unsaveVenue(venueId: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error("You must be signed in to unsave a venue");
  const { error } = await supabase
    .from("saved_venues")
    .delete()
    .eq("user_id", user.id)
    .eq("venue_id", venueId);
  if (error) throw new Error("Failed to unsave venue");
}

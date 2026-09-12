/** Shape of a saved-venue row returned by `saved_venues_for_current_user()`. */
export interface SavedVenueRow {
  venue_id: string;
  name: string;
  slug: string | null;
  city: string | null;
  status: string;
  created_at: string;
}

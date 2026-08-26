export type EventType = "social" | "class" | "workshop";
export type City = "boston" | "new-york-city";

export interface EventTaxonomyTerm {
  id: string;
  name: string;
  slug: string;
  category: "dance_style" | "event_attribute";
  status: "active" | "needs_review" | "archived";
}
// Database event interface (matches Supabase schema)
export interface DatabaseEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string; //ISO timestamp from database
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: "free" | "paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  image_url: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_id: string | null;
  status: "draft" | "pending" | "approved" | "rejected" | "cancelled" | "archived";
  source_type: "admin" | "user_submission" | "organizer" | "moderator" | "imported";
  taxonomy_term_ids: string[];
  taxonomy_terms: EventTaxonomyTerm[];
  updated_at: string;
  cancellation_reason: string | null;
  city: City;
  created_at: string;
  host: string | null;
  recurrence: string | null;
  gallery: string[] | null;
  contact_email: string | null;
  contact_instagram: string | null;
  contact_website: string | null;
  venue_id: string | null;

  /**
   * Present only for a pending/rejected event_submission projected into the
   * shared Host lifecycle view. Canonical events leave this undefined.
   */
  submission_id?: string;
}

// Schedule-X event interface
export interface ScheduleXEvent {
  id: string | number;
  title: string;
  start: string;
  end: string;
  calendarId: EventType;
  location?: string;
  description?: string;
  address?: string;
  rsvpLink?: string;
  city?: City;
  host?: string;
  recurrence?: string;
  gallery?: string[];
  imageUrl?: string;
  priceType?: "free" | "paid";
  priceAmount?: number;
  contactEmail?: string;
  contactInstagram?: string;
  contactWebsite?: string;
  danceStyles?: string[];
}

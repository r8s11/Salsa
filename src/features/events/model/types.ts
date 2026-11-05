import type { PublicEventEntities } from "../../entities/model";

import type { EntityReview } from "../../entity-matching/entityReview";
export const EVENT_TYPES = ["social", "class", "workshop", "live_music", "concert"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  social: "Social",
  class: "Class",
  workshop: "Workshop",
  live_music: "Live Music",
  concert: "Concert",
};

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && EVENT_TYPES.some((type) => type === value);
}

/** The primary category also serves producers that only supply one category. */
export function getEventTypes(event: {
  event_type: EventType | "";
  event_types?: readonly EventType[];
}): EventType[] {
  return event.event_types?.length
    ? [...new Set(event.event_types)]
    : event.event_type ? [event.event_type] : [];
}
/** Canonical metro slug (public.metros.slug), e.g. "new-york-city". */
export type City = string;

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
  slug?: string;
  series_id?: string | null;
  public_entities?: PublicEventEntities | null;
  title: string;
  description: string | null;
  event_type: EventType;
  /** Ordered categories; the first determines the calendar color. */
  event_types?: EventType[];
  event_date: string; //ISO timestamp from database
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: "free" | "paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  image_url: string | null;
  /** Ordered flyer list (max 5). `image_url` is the primary and equals `image_urls[0]`. */
  image_urls?: string[] | null;
  poster_image_url?: string | null;
  submitter_name?: string | null;
  submitter_email?: string | null;
  submitter_id?: string | null;
  status: "draft" | "pending" | "approved" | "rejected" | "cancelled" | "archived";
  source_type: "admin" | "user_submission" | "organizer" | "moderator" | "imported";
  /** Legacy slug storage retained while taxonomy terms are progressively backfilled. */
  dance_styles?: string[];
  taxonomy_term_ids: string[];
  taxonomy_terms: EventTaxonomyTerm[];
  updated_at: string;
  cancellation_reason?: string | null;
  city: City;
  sublocation: string | null;
  /** Curated city/borough-specific slug; NULL for legacy or unassigned areas. */
  neighborhood?: string | null;
  created_at: string;
  host: string | null;
  recurrence: string | null;
  /**
   * Explicit IANA zone for this occurrence. Not a database column today; only set
   * by in-memory flows (series generation, copy) so a valid zone survives them.
   */
  time_zone?: string | null;
  /** Zone inherited from the parent series or linked venue when known. */
  series_time_zone?: string | null;
  venue_time_zone?: string | null;
  gallery: string[] | null;
  contact_email?: string | null;
  contact_instagram?: string | null;
  contact_website?: string | null;
  venue_id: string | null;
  entity_review?: EntityReview | null;
  /** When an admin or moderator featured this event on the homepage; NULL/absent means not featured. */
  featured_at?: string | null;

  /**
   * Present only for organizer-owned events created via
   * organizer_create_event(). Legacy submissions and admin-created events
   * may not have this field.
   */
  organizer_id?: string | null;

  /**
   * Present only for a pending/rejected event_submission projected into the
   * shared Host lifecycle view. Canonical events leave this undefined.
   */
  submission_id?: string;
}

export interface ScheduleXEvent {
  publicEntities?: PublicEventEntities | null;
  slug?: string;
  id: string | number;
  title: string;
  start: string;
  end: string;
  calendarId: EventType;
  eventTypes?: EventType[];
  location?: string;
  description?: string;
  address?: string;
  rsvpLink?: string;
  city?: City;
  /** Optional NYC borough slug; absent means All NYC (or a non-NYC city). */
  sublocation?: string;
  /** Optional curated neighborhood slug; absent means unassigned. */
  neighborhood?: string;
  host?: string;
  recurrence?: string;
  /** Resolved IANA zone `start`/`end` are wall-clock in. */
  timeZone?: string;
  gallery?: string[];
  imageUrl?: string;
  /** Ordered flyers; `imageUrl` is the first. */
  imageUrls?: string[];
  posterImageUrl?: string;
  priceType?: "free" | "paid";
  priceAmount?: number;
  contactEmail?: string;
  contactInstagram?: string;
  contactWebsite?: string;
  danceStyles?: string[];
  createdAt?: string;
  sourceType?: DatabaseEvent["source_type"];
  /** An admin or moderator chose this event for the homepage spotlight. */
  featured?: boolean;
}

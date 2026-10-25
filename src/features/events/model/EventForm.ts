import type { EntityReview } from "../../entity-matching/entityReview";
import type { EventType, City } from "./types";
import type { SubLocation } from "../../metros/model/sublocation";

export type EventFormDraft = {
  title: string;
  description: string;
  event_type: EventType | "";
  /** Full ordered selection; `event_type` is its first member. */
  event_types?: EventType[];
  city: City;
  /** Optional NYC borough; "" means All NYC. */
  sublocation: SubLocation | "";
  event_date: string;
  event_time: string;
  recurrence: "weekly" | "";
  location: string;
  address: string;
  venue_id: string;
  price_type: "free" | "paid" | "";
  price_amount: string;
  rsvp_link: string;
  image_url: string;
  host: string;
  contact_email: string;
  contact_instagram: string;
  contact_website: string;
  submitter_name: string;
  submitter_email: string;
  dance_styles: string[]; // slugs
  taxonomy_term_ids: string[]; // term ids
  entity_review?: EntityReview;
};

export type EventFormCapabilities = {
  styles: "slug-chips" | "taxonomy-chips" | "none";
  attributes: boolean; // event_attribute taxonomy — admin only
  venue: "free-text" | "combobox";
  flyer: boolean;
  hostAndContact: boolean;
  submitterInfo: boolean;
};

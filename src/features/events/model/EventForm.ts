import type { EventType, City } from "../model/types";

export type EventFormDraft = {
  title: string;
  description: string;
  event_type: EventType | "";
  city: City;
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
};

export type EventFormCapabilities = {
  styles: "slug-chips" | "taxonomy-chips" | "none";
  attributes: boolean; // event_attribute taxonomy — admin only
  venue: "free-text" | "combobox";
  flyer: boolean;
  hostAndContact: boolean;
  submitterInfo: boolean;
};

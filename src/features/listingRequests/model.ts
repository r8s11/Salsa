/**
 * Guided listing requests: a signed-in person asks for a missing listing, for
 * an event to appear on an Artist/DJ they manage, or for an identity change on
 * a listing they manage. An administrator decides every one. Mirrors
 * supabase/migrations/20261110000100_listing_requests.sql — the RPCs there are
 * the source of truth for who may ask and what approval changes.
 */
import { MANAGED_KIND_LABELS, type EntityMemberRole, type ManagedKind } from "../workspaces/model";

export type ListingRequestType = "missing_listing" | "event_link" | "profile_change";
export type ListingRequestStatus = "pending" | "approved" | "rejected" | "withdrawn";

/** Only Artists and DJs can ask for an event link; venue and school links belong to the organizer. */
export type EventLinkKind = "instructor" | "dj";
export const EVENT_LINK_KINDS: readonly EventLinkKind[] = ["instructor", "dj"];

export function isEventLinkKind(kind: ManagedKind): kind is EventLinkKind {
  return (EVENT_LINK_KINDS as readonly ManagedKind[]).includes(kind);
}

/** The server refuses an eleventh waiting request. */
export const MAX_PENDING_LISTING_REQUESTS = 10;

export type ListingRequest = {
  id: string;
  request_type: ListingRequestType;
  status: ListingRequestStatus;
  entity_kind: ManagedKind | null;
  entity_id: string | null;
  entity_name: string | null;
  entity_slug: string | null;
  event_id: string | null;
  event_title: string | null;
  event_date: string | null;
  proposed_name: string | null;
  proposed_city: string | null;
  website: string | null;
  instagram: string | null;
  details: string | null;
  review_note: string | null;
  resulting_entity_id: string | null;
  resulting_entity_slug: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type AdminListingRequest = ListingRequest & {
  requester_id: string;
  email: string;
  display_name: string | null;
  member_role: EntityMemberRole | null;
  event_status: string | null;
  event_location: string | null;
  event_organizer_name: string | null;
  already_linked: boolean;
};

export type EventLinkCandidate = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
};

const APPROVED_WORDS: Record<ListingRequestType, string> = {
  missing_listing: "Listing added",
  event_link: "Event linked",
  profile_change: "Change made",
};

export function requestStatusWord(request: Pick<ListingRequest, "request_type" | "status">): string {
  switch (request.status) {
    case "pending":
      return "Waiting for review";
    case "approved":
      return APPROVED_WORDS[request.request_type];
    case "rejected":
      return "Not approved";
    case "withdrawn":
      return "Withdrawn";
  }
}

/** One line saying what was asked, e.g. `Add "Casa Cuba" as a Venue`. */
export function requestHeadline(request: ListingRequest): string {
  const kind = request.entity_kind ? MANAGED_KIND_LABELS[request.entity_kind] : "listing";
  switch (request.request_type) {
    case "missing_listing":
      return `Add "${request.proposed_name ?? "a listing"}" as ${/^[AEIOU]/.test(kind) ? "an" : "a"} ${kind}`;
    case "event_link": {
      const event = request.event_title ? `"${request.event_title}"` : "an event";
      return `Link ${event} to ${request.entity_name ? `${kind} ${request.entity_name}` : `this ${kind}`}`;
    }
    case "profile_change":
      return `Change details for ${request.entity_name ?? `this ${kind}`}`;
  }
}

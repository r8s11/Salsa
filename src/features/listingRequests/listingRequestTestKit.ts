import type { AdminListingRequest, ListingRequest } from "./model";

/** Shared fixtures for the listing-request tests. */

export function listingRequest(overrides: Partial<ListingRequest> = {}): ListingRequest {
  return {
    id: "r1",
    request_type: "missing_listing",
    status: "pending",
    entity_kind: "venue",
    entity_id: null,
    entity_name: null,
    entity_slug: null,
    event_id: null,
    event_title: null,
    event_date: null,
    proposed_name: "Casa Habana",
    proposed_city: "Boston",
    website: null,
    instagram: null,
    details: null,
    review_note: null,
    resulting_entity_id: null,
    resulting_entity_slug: null,
    created_at: "2026-11-10T12:00:00Z",
    reviewed_at: null,
    ...overrides,
  };
}

export function eventLinkRequest(overrides: Partial<ListingRequest> = {}): ListingRequest {
  return listingRequest({
    id: "r-link",
    request_type: "event_link",
    entity_kind: "instructor",
    entity_id: "artist-1",
    entity_name: "Ana Rivera",
    entity_slug: "ana-rivera",
    event_id: "event-1",
    event_title: "Friday Social",
    event_date: "2026-11-20T01:00:00Z",
    proposed_name: null,
    proposed_city: null,
    ...overrides,
  });
}

export function adminRequest(overrides: Partial<AdminListingRequest> = {}): AdminListingRequest {
  return {
    ...eventLinkRequest(),
    requester_id: "user-1",
    email: "ana@example.com",
    display_name: "Ana Rivera",
    member_role: "manager",
    event_status: "approved",
    event_location: "Main Hall",
    event_organizer_name: "Unrelated Promotions",
    already_linked: false,
    ...overrides,
  };
}

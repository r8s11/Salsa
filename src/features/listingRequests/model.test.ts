import { describe, expect, it } from "vitest";
import { requestHeadline, requestStatusWord, type ListingRequest } from "./model";

function request(overrides: Partial<ListingRequest>): ListingRequest {
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
    proposed_name: null,
    proposed_city: null,
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

describe("requestStatusWord", () => {
  it("names an approved request by what happened", () => {
    expect(requestStatusWord({ request_type: "event_link", status: "approved" })).toBe("Event linked");
    expect(requestStatusWord({ request_type: "missing_listing", status: "approved" })).toBe("Listing added");
    expect(requestStatusWord({ request_type: "profile_change", status: "approved" })).toBe("Change made");
  });

  it("uses the same words for every type that is not approved", () => {
    for (const request_type of ["missing_listing", "event_link", "profile_change"] as const) {
      expect(requestStatusWord({ request_type, status: "pending" })).toBe("Waiting for review");
      expect(requestStatusWord({ request_type, status: "rejected" })).toBe("Not approved");
      expect(requestStatusWord({ request_type, status: "withdrawn" })).toBe("Withdrawn");
    }
  });
});

describe("requestHeadline", () => {
  it("names a missing listing and its kind", () => {
    expect(requestHeadline(request({ proposed_name: "Casa Cuba" }))).toBe('Add "Casa Cuba" as a Venue');
  });

  it("calls an instructor an Artist in an event link", () => {
    expect(
      requestHeadline(
        request({ request_type: "event_link", entity_kind: "instructor", entity_id: "i1", entity_name: "Ana", event_id: "e1", event_title: "Friday Social" }),
      ),
    ).toBe('Link "Friday Social" to Artist Ana');
  });

  it("names the listing an identity change is for", () => {
    expect(
      requestHeadline(request({ request_type: "profile_change", entity_kind: "school", entity_id: "s1", entity_name: "Ritmo Vivo" })),
    ).toBe("Change details for Ritmo Vivo");
  });

  it("still reads sensibly when the event or listing is gone", () => {
    expect(requestHeadline(request({ request_type: "event_link", entity_kind: "dj", entity_id: "d1", event_id: "e1" }))).toBe(
      "Link an event to this DJ",
    );
  });
});

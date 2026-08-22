import { describe, it, expect } from "vitest";
import { DatabaseEvent } from "../../events/model/types";
import { hostEventAction, findNextHostEvent } from "./hostEvents";

const baseEvent: DatabaseEvent = {
  id: "test",
  title: "Test Event",
  description: null,
  event_type: "social",
  event_date: "2026-08-22T20:00:00Z",
  event_time: "20:00:00",
  location: null,
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  submitter_name: null,
  submitter_email: null,
  submitter_id: null,
  status: "pending",
  source_type: "user_submission",
  taxonomy_term_ids: [],
  taxonomy_terms: [],
  updated_at: "2026-08-22T20:00:00Z",
  cancellation_reason: null,
  city: "boston",
  created_at: "2026-08-22T20:00:00Z",
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  venue_id: null,
};

const now = new Date("2026-08-22T12:00:00Z");
const pastApproved: DatabaseEvent = { ...baseEvent, id: "past-approved", event_date: "2026-08-21T20:00:00Z", status: "approved" };
const cancelledFuture: DatabaseEvent = { ...baseEvent, id: "cancelled-future", event_date: "2026-08-23T20:00:00Z", status: "cancelled" };
const nextApproved: DatabaseEvent = { ...baseEvent, id: "next-approved", event_date: "2026-08-24T20:00:00Z", status: "approved" };

describe("hostEvents", () => {
  it("routes a pending Host event to the existing owner editor", () => {
    expect(hostEventAction({ ...baseEvent, id: "pending-1", status: "pending" })).toEqual({
      label: "Edit event",
      to: "/profile/edit/pending-1",
    });
  });

  it("routes an approved Host event to its existing Calendar detail", () => {
    expect(hostEventAction({ ...baseEvent, id: "approved-1", city: "boston", status: "approved" })).toEqual({
      label: "View event",
      to: "/calendar?event=approved-1&city=boston",
    });
  });

  it("selects the nearest non-terminal future event as next", () => {
    expect(findNextHostEvent([pastApproved, cancelledFuture, nextApproved], now)?.id).toBe("next-approved");
  });
});

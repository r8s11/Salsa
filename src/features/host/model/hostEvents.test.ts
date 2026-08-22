import { describe, it, expect } from "vitest";
import { DatabaseEvent } from "../../events/model/types";
import { hostEventAction, findNextHostEvent, deriveHostEventRows } from "./hostEvents";

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


  it("derives date and status labels for a Host event row", () => {
    const [row] = deriveHostEventRows(
      [{ ...baseEvent, id: "labeled", event_date: "2026-08-18T00:00:00Z", status: "approved" }],
      now
    );
    expect(row.event.id).toBe("labeled");
    expect(row.dateLabel).toBe("August 17, 2026 at 8:00 PM");
    expect(row.statusLabel).toBe("Approved");
    expect(row.action).toEqual({ label: "View event", to: "/calendar?event=labeled&city=boston" });
  });

  it("sorts Host event rows by event date ascending", () => {
    const rows = deriveHostEventRows([nextApproved, pastApproved, cancelledFuture], now);
    expect(rows.map((r) => r.event.id)).toEqual(["past-approved", "cancelled-future", "next-approved"]);
  });

  it("excludes archived events from being selected as next", () => {
    const archivedFuture: DatabaseEvent = { ...baseEvent, id: "archived-future", event_date: "2026-08-25T20:00:00Z", status: "archived" };
    expect(findNextHostEvent([archivedFuture, nextApproved], now)?.id).toBe("next-approved");
  });

  it("sorts undated or invalid event dates last, without a placeholder date label", () => {
    const undated: DatabaseEvent = { ...baseEvent, id: "undated", event_date: "" };
    const rows = deriveHostEventRows([nextApproved, undated], now);
    expect(rows.map((r) => r.event.id)).toEqual(["next-approved", "undated"]);
    expect(rows[1].dateLabel).toBe("Date unavailable");
  });
});

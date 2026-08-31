import { describe, it, expect } from "vitest";
import { DatabaseEvent } from "../../events/model/types";
import {
  hostEventAction,
  findNextHostEvent,
  deriveHostEventRows,
  isUpcomingHostEvent,
} from "./hostEvents";

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
const pastApproved: DatabaseEvent = {
  ...baseEvent,
  id: "past-approved",
  event_date: "2026-08-21T20:00:00Z",
  status: "approved",
};
const cancelledFuture: DatabaseEvent = {
  ...baseEvent,
  id: "cancelled-future",
  event_date: "2026-08-23T20:00:00Z",
  status: "cancelled",
};
const nextApproved: DatabaseEvent = {
  ...baseEvent,
  id: "next-approved",
  event_date: "2026-08-24T20:00:00Z",
  status: "approved",
};

describe("hostEvents", () => {
  it("routes a pending Host event to the existing owner editor as an edit action", () => {
    expect(hostEventAction({ ...baseEvent, id: "pending-1", status: "pending" })).toEqual({
      label: "Edit submission",
      to: "/profile/edit/pending-1",
    });
  });

  it("routes a rejected Host event to the existing owner editor as a revise action", () => {
    expect(hostEventAction({ ...baseEvent, id: "rejected-1", status: "rejected" })).toEqual({
      label: "Revise submission",
      to: "/profile/edit/rejected-1",
    });
  });

  it("routes an approved Host event to its real public event page", () => {
    expect(
      hostEventAction({ ...baseEvent, id: "approved-1", city: "boston", status: "approved" })
    ).toEqual({
      label: "View public event",
      to: "/events/approved-1",
    });
  });

  it("keeps drafts in the Host workspace instead of linking to the public calendar", () => {
    expect(hostEventAction({ ...baseEvent, id: "draft-1", status: "draft" })).toEqual({
      label: "View draft",
      to: "/host/events/draft-1",
    });
  });

  it("falls back to the existing Calendar detail for a non-editable, non-approved event", () => {
    expect(
      hostEventAction({ ...baseEvent, id: "cancelled-1", city: "boston", status: "cancelled" })
    ).toEqual({
      label: "View event",
      to: "/calendar?event=cancelled-1&city=boston",
    });
  });

  it("selects the nearest non-terminal future event as next", () => {
    expect(findNextHostEvent([pastApproved, cancelledFuture, nextApproved], now)?.id).toBe(
      "next-approved"
    );
  });

  it("derives date and status labels for a Host event row", () => {
    const [row] = deriveHostEventRows([
      { ...baseEvent, id: "labeled", event_date: "2026-08-18T00:00:00Z", status: "approved" },
    ]);
    expect(row.event.id).toBe("labeled");
    expect(row.dateLabel).toBe("August 17, 2026 at 8:00 PM");
    expect(row.statusLabel).toBe("Approved");
    expect(row.action).toEqual({ label: "View public event", to: "/events/labeled" });
  });

  it("sorts Host event rows by event date ascending", () => {
    const rows = deriveHostEventRows([nextApproved, pastApproved, cancelledFuture]);
    expect(rows.map((r) => r.event.id)).toEqual([
      "past-approved",
      "cancelled-future",
      "next-approved",
    ]);
  });

  it("excludes archived events from being selected as next", () => {
    const archivedFuture: DatabaseEvent = {
      ...baseEvent,
      id: "archived-future",
      event_date: "2026-08-25T20:00:00Z",
      status: "archived",
    };
    expect(findNextHostEvent([archivedFuture, nextApproved], now)?.id).toBe("next-approved");
  });

  it("sorts undated or invalid event dates last, without a placeholder date label", () => {
    const undated: DatabaseEvent = { ...baseEvent, id: "undated", event_date: "" };
    const rows = deriveHostEventRows([nextApproved, undated]);
    expect(rows.map((r) => r.event.id)).toEqual(["next-approved", "undated"]);
    expect(rows[1].dateLabel).toBe("Date unavailable");
  });

  it("labels non-instant and invalid ISO dates unavailable without throwing", () => {
    const rows = deriveHostEventRows([
      { ...baseEvent, id: "date-only", event_date: "2026-08-22" },
      { ...baseEvent, id: "invalid-date", event_date: "2026-02-30T20:00:00Z" },
    ]);
    expect(rows.map((row) => row.dateLabel)).toEqual(["Date unavailable", "Date unavailable"]);
  });

  it("counts only future non-terminal events as upcoming", () => {
    expect(isUpcomingHostEvent(nextApproved, now)).toBe(true);
    expect(isUpcomingHostEvent(pastApproved, now)).toBe(false);
    expect(isUpcomingHostEvent(cancelledFuture, now)).toBe(false);
    expect(isUpcomingHostEvent({ ...baseEvent, id: "undated", event_date: "" }, now)).toBe(false);
  });

  it("derives rows with correct date and status labels", () => {
    const events: DatabaseEvent[] = [
      { ...baseEvent, event_date: "2026-08-22T20:00:00Z", status: "pending" },
    ];
    const rows = deriveHostEventRows(events);
    expect(rows[0].dateLabel).toBe("August 22, 2026 at 4:00 PM");
    expect(rows[0].statusLabel).toBe("Pending");
  });

  it("sorts rows ascending by date, with undated last", () => {
    const e1: DatabaseEvent = { ...baseEvent, id: "e1", event_date: "2026-08-23T20:00:00Z" };
    const e2: DatabaseEvent = { ...baseEvent, id: "e2", event_date: "2026-08-22T20:00:00Z" };
    const e3: DatabaseEvent = { ...baseEvent, id: "e3", event_date: "invalid-date" };
    const rows = deriveHostEventRows([e1, e2, e3]);
    expect(rows.map((r) => r.event.id)).toEqual(["e2", "e1", "e3"]);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DatabaseEvent } from "../../../../types/events";
import ItineraryEventFinder from "./ItineraryEventFinder";

function event(id: string, title: string, danceStyles: string[]): DatabaseEvent {
  return {
    id, title, city: "new-york-city", event_date: "2026-11-14T02:00:00Z",
    event_type: "social", taxonomy_terms: [], taxonomy_term_ids: [], dance_styles: danceStyles,
    location: null, host: null, neighborhood: null, description: null, event_time: null,
    address: null, price_type: null, price_amount: null, rsvp_link: null, image_url: null,
    status: "approved", source_type: "admin", updated_at: "2026-11-01T00:00:00Z",
    created_at: "2026-11-01T00:00:00Z", sublocation: null, recurrence: null,
    gallery: null, venue_id: null,
  };
}

function show(events: DatabaseEvent[]) {
  render(<ItineraryEventFinder events={events} loading={false} error={null}
    timeZone="America/New_York" nights={[]} items={[]} onAdd={vi.fn()} />);
}

describe("ItineraryEventFinder", () => {
  it("includes the 9:00 PM minute in 6–9 PM and starts After 9 PM at 9:01", () => {
    show([
      { ...event("nine", "Exactly nine", []), event_date: "2026-11-14T02:00:00Z" },
      { ...event("nine-seconds", "Nine with seconds", []), event_date: "2026-11-14T02:00:59Z" },
      { ...event("after-nine", "One minute after nine", []), event_date: "2026-11-14T02:01:00Z" },
      { ...event("midnight", "After midnight", []), event_date: "2026-11-14T05:30:00Z" },
      { ...event("morning", "Five AM", []), event_date: "2026-11-14T10:00:00Z" },
    ]);
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "evening" } });
    expect(screen.getByRole("listitem", { name: "Exactly nine" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Nine with seconds" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "One minute after nine" })).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "After midnight" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "late" } });
    expect(screen.queryByRole("listitem", { name: "Exactly nine" })).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "Nine with seconds" })).not.toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "One minute after nine" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "After midnight" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "Five AM" })).not.toBeInTheDocument();
  });

  it("filters real legacy dance styles when no taxonomy links exist", () => {
    show([event("salsa", "Salsa social", ["Salsa"]), event("bachata", "Bachata practice", ["Bachata"])]);
    fireEvent.change(screen.getByLabelText("Style"), { target: { value: "bachata" } });
    expect(screen.getByRole("listitem", { name: "Bachata practice" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "Salsa social" })).not.toBeInTheDocument();
  });

  it("finds linked organizers and venues without legacy host or location text", () => {
    const linked = event("linked", "Orchestra night", ["Salsa"]);
    const ref = { id: "org", kind: "organizer" as const, slug: "dance-crew", name: "Dance Crew", description: null, image_url: null, city: "new-york-city" };
    linked.public_entities = { organizer: ref, venue: { ...ref, id: "venue", kind: "venue", name: "Club Floor", slug: "club-floor" }, school: null, schools: [], instructors: [], djs: [], series: null, city: null, styles: [] };
    show([linked, event("other", "Other night", ["Bachata"])]);
    fireEvent.change(screen.getByLabelText("Organizer"), { target: { value: "Dance Crew" } });
    fireEvent.change(screen.getByLabelText("Venue"), { target: { value: "Club Floor" } });
    expect(screen.getByRole("listitem", { name: "Orchestra night" })).toHaveTextContent("Club Floor");
    expect(screen.queryByRole("listitem", { name: "Other night" })).not.toBeInTheDocument();
  });
});

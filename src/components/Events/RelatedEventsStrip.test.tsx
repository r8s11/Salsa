import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../../features/events/model/types";
import { RelatedEventsStrip } from "./RelatedEventsStrip";

function makeEvent(overrides: Partial<DatabaseEvent> = {}): DatabaseEvent {
  return {
    id: "event-1",
    title: "First Event",
    description: null,
    event_type: "social",
    event_date: new Date("2026-09-01T19:00:00Z").toISOString(),
    event_time: "19:00",
    location: null,
    address: null,
    price_type: "free",
    price_amount: null,
    rsvp_link: null,
    image_url: null,
    submitter_name: null,
    submitter_email: null,
    submitter_id: null,
    status: "approved",
    source_type: "admin",
    taxonomy_term_ids: [],
    taxonomy_terms: [],
    updated_at: "",
    cancellation_reason: null,
    city: "boston",
    created_at: "",
    host: null,
    recurrence: null,
    gallery: null,
    contact_email: null,
    contact_instagram: null,
    contact_website: null,
    venue_id: null,
    ...overrides,
  };
}

describe("RelatedEventsStrip", () => {
  it("renders up to three compact direct links with strict-window heading", () => {
    const first = makeEvent({ id: "first", title: "First Event" });
    const second = makeEvent({ id: "second", title: "Second Event" });
    const third = makeEvent({ id: "third", title: "Third Event" });

    render(
      <MemoryRouter>
        <RelatedEventsStrip events={[first, second, third]} city="boston" hasStrictWindowEvents />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "More this week in Greater Boston" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /first event/i })).toHaveAttribute("href", "/events/first");
    expect(screen.getByRole("link", { name: /second event/i })).toHaveAttribute("href", "/events/second");
    expect(screen.getByRole("link", { name: /third event/i })).toHaveAttribute("href", "/events/third");
  });

  it("caps rendering at three links when more events are provided", () => {
    const events = [1, 2, 3, 4].map((n) => makeEvent({ id: `e${n}`, title: `Event ${n}` }));

    render(
      <MemoryRouter>
        <RelatedEventsStrip events={events} city="boston" hasStrictWindowEvents={false} />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("uses fallback heading and renders nothing when selection is empty", () => {
    const fallback = makeEvent({ id: "fallback", title: "Fallback Event" });

    const { rerender } = render(
      <MemoryRouter>
        <RelatedEventsStrip events={[fallback]} city="new-york-city" hasStrictWindowEvents={false} />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "More in New York City" })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <RelatedEventsStrip events={[]} city="boston" hasStrictWindowEvents={false} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("region", { name: /more/i })).not.toBeInTheDocument();
  });
});

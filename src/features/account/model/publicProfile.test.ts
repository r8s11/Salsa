import { describe, expect, it } from "vitest";
import {
  profileHostingNext,
  profileRegularVenues,
  profileStyleLabels,
  profileTagline,
} from "./publicProfile";
import { DANCE_STYLES } from "../../admin/model/eventsQuery";
import type { DatabaseEvent } from "../../events/model/types";

function makeEvent(overrides: Partial<DatabaseEvent> = {}): DatabaseEvent {
  return {
    id: "event-1",
    title: "Thursday Social",
    status: "approved",
    event_date: "2026-06-01T23:00:00Z",
    location: "Ryles Jazz Club",
    city: "boston",
    ...overrides,
  } as DatabaseEvent;
}

describe("profileTagline", () => {
  it("joins city and join month when both exist", () => {
    expect(profileTagline("new-york-city", "Jan 2026")).toBe(
      "Dancing in New York City · Member since Jan 2026"
    );
  });

  it("uses whichever half exists", () => {
    expect(profileTagline("boston", null)).toBe("Dancing in Boston");
    expect(profileTagline(null, "Jan 2026")).toBe("Member since Jan 2026");
  });

  it("falls back to a generic line rather than rendering empty", () => {
    expect(profileTagline(null, null)).toBe("SalsaSegura member");
  });
});

describe("profileStyleLabels", () => {
  it("returns canonical labels in option order, not stored order", () => {
    expect(profileStyleLabels(["bachata", "salsa"], DANCE_STYLES)).toEqual(["Salsa", "Bachata"]);
  });

  it("drops slugs the app no longer offers", () => {
    expect(profileStyleLabels(["salsa", "hustle"], DANCE_STYLES)).toEqual(["Salsa"]);
  });
});

describe("profileHostingNext", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it("keeps only approved future events, soonest first", () => {
    const past = makeEvent({ id: "past", event_date: "2026-05-01T23:00:00Z" });
    const soon = makeEvent({ id: "soon", event_date: "2026-06-02T23:00:00Z" });
    const later = makeEvent({ id: "later", event_date: "2026-06-09T23:00:00Z" });
    const pending = makeEvent({
      id: "pending",
      status: "pending",
      event_date: "2026-06-03T23:00:00Z",
    });

    expect(profileHostingNext([later, past, pending, soon], now).map((e) => e.id)).toEqual([
      "soon",
      "later",
    ]);
  });

  it("drops events whose date cannot be parsed", () => {
    const broken = makeEvent({ id: "broken", event_date: "not-a-date" });
    expect(profileHostingNext([broken], now)).toEqual([]);
  });

  it("caps the list at three", () => {
    const events = [1, 2, 3, 4, 5].map((day) =>
      makeEvent({ id: `e${day}`, event_date: `2026-06-0${day + 1}T23:00:00Z` })
    );
    expect(profileHostingNext(events, now)).toHaveLength(3);
  });
});

describe("profileRegularVenues", () => {
  it("orders by how often the venue appears", () => {
    const events = [
      makeEvent({ id: "a", location: "Havana Club" }),
      makeEvent({ id: "b", location: "Ryles" }),
      makeEvent({ id: "c", location: "Ryles" }),
    ];
    expect(profileRegularVenues(events)).toEqual(["Ryles", "Havana Club"]);
  });

  it("collapses case variants onto the first spelling seen", () => {
    const events = [
      makeEvent({ id: "a", location: "Ryles" }),
      makeEvent({ id: "b", location: "ryles" }),
    ];
    expect(profileRegularVenues(events)).toEqual(["Ryles"]);
  });

  it("ignores blank locations and non-approved events", () => {
    const events = [
      makeEvent({ id: "a", location: "   " }),
      makeEvent({ id: "b", location: null }),
      makeEvent({ id: "c", location: "Draft Room", status: "draft" }),
    ];
    expect(profileRegularVenues(events)).toEqual([]);
  });
});

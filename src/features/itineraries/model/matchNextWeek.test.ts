import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../../../types/events";
import type { ItineraryItem } from "./types";
import { matchNextWeek, normalizeTitle } from "./matchNextWeek";

const TZ = "America/New_York";

function ev(
  id: string,
  event_date: string,
  extra: Partial<DatabaseEvent> = {},
): DatabaseEvent {
  return {
    id,
    title: "Salsa Night",
    event_date,
    series_id: null,
    venue_id: null,
    location: null,
    ...extra,
  } as DatabaseEvent;
}

function item(eventId: string, extra: Partial<ItineraryItem> = {}): ItineraryItem {
  return { eventId, role: "featured", position: 0, note: null, ...extra };
}

describe("normalizeTitle", () => {
  it("strips accents, case and punctuation", () => {
    expect(normalizeTitle("  Noche Latína!!  -- Vol.2 ")).toBe("noche latina vol 2");
  });
});

describe("matchNextWeek", () => {
  it("carries the note over on a series match", () => {
    const src = ev("a", "2026-11-04T23:00:00Z", { series_id: "s1", title: "Old" });
    const cand = ev("b", "2026-11-11T23:00:00Z", { series_id: "s1", title: "Renamed" });
    const result = matchNextWeek(
      [item("a", { role: "alternative", position: 3, note: "Bring shoes" })],
      new Map([["a", src]]),
      [cand],
      TZ,
    );
    expect(result).toEqual({
      items: [{ eventId: "b", role: "alternative", position: 3, note: "Bring shoes" }],
      dropped: [],
    });
  });

  it("matches venue + title ignoring case and accents", () => {
    const src = ev("a", "2026-11-05T23:00:00Z", { venue_id: "v1", title: "Noche Latína" });
    const cand = ev("b", "2026-11-12T23:00:00Z", { venue_id: "v1", title: "noche latina" });
    const result = matchNextWeek([item("a")], new Map([["a", src]]), [cand], TZ);
    expect(result.items.map((i) => i.eventId)).toEqual(["b"]);
  });

  it("matches normalized location + title", () => {
    const src = ev("a", "2026-11-05T23:00:00Z", { location: "The Club, Boston" });
    const cand = ev("b", "2026-11-12T23:00:00Z", { location: "the club boston" });
    const result = matchNextWeek([item("a")], new Map([["a", src]]), [cand], TZ);
    expect(result.items.map((i) => i.eventId)).toEqual(["b"]);
  });

  it("drops a same-title event on a different weekday", () => {
    const srcItem = item("a");
    const src = ev("a", "2026-11-05T23:00:00Z", { venue_id: "v1" });
    const cand = ev("b", "2026-11-13T23:00:00Z", { venue_id: "v1" });
    const result = matchNextWeek([srcItem], new Map([["a", src]]), [cand], TZ);
    expect(result).toEqual({ items: [], dropped: [{ item: srcItem, title: "Salsa Night" }] });
  });

  it("matches a Sunday 00:30 start as Saturday night", () => {
    const src = ev("a", "2026-11-08T05:30:00Z", { series_id: "s1" });
    const friday = ev("x", "2026-11-14T03:30:00Z", { series_id: "s1" });
    const cand = ev("b", "2026-11-15T05:30:00Z", { series_id: "s1" });
    const result = matchNextWeek([item("a")], new Map([["a", src]]), [friday, cand], TZ);
    expect(result.items.map((i) => i.eventId)).toEqual(["b"]);
  });

  it("never maps two source items to the same candidate", () => {
    const srcA = ev("a", "2026-11-05T23:00:00Z", { series_id: "s1" });
    const srcB = ev("c", "2026-11-05T23:30:00Z", { series_id: "s1" });
    const cand = ev("b", "2026-11-12T23:00:00Z", { series_id: "s1" });
    const itemB = item("c", { position: 1 });
    const result = matchNextWeek(
      [item("a"), itemB],
      new Map([["a", srcA], ["c", srcB]]),
      [cand],
      TZ,
    );
    expect(result.items.map((i) => i.eventId)).toEqual(["b"]);
    expect(result.dropped).toEqual([{ item: itemB, title: "Salsa Night" }]);
  });

  it("lets a stronger match keep its candidate over an earlier weaker one", () => {
    const srcA = ev("a", "2026-11-05T23:00:00Z", { venue_id: "v1" });
    const srcB = ev("c", "2026-11-05T23:00:00Z", { series_id: "s1", venue_id: "v2" });
    const cand = ev("b", "2026-11-12T23:00:00Z", { series_id: "s1", venue_id: "v1" });
    const result = matchNextWeek(
      [item("a"), item("c", { position: 1 })],
      new Map([["a", srcA], ["c", srcB]]),
      [cand],
      TZ,
    );
    expect(result.items).toEqual([{ eventId: "b", role: "featured", position: 1, note: null }]);
    expect(result.dropped.map((d) => d.item.eventId)).toEqual(["a"]);
  });

  it("drops an item whose source event is missing", () => {
    const srcItem = item("gone");
    const result = matchNextWeek([srcItem], new Map(), [], TZ);
    expect(result.dropped).toEqual([{ item: srcItem, title: "Unknown event" }]);
  });
});

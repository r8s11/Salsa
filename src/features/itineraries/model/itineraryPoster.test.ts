import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../../../types/events";
import type { ItineraryItem } from "./types";
import { buildSchedule } from "./schedule";
import { buildItineraryPosterModel, ITINERARY_POSTER_SIZE, type ItineraryPosterFormat } from "./itineraryPoster";
import { buildPublicItineraryUrl, itineraryPosterFilename, itineraryUrlLabel } from "./itinerarySharing";

const TZ = "America/New_York";
const WEEK = "2026-11-09";

function event(id: string, isoStart: string, extra: Partial<DatabaseEvent> = {}): DatabaseEvent {
  return {
    id,
    title: `Title ${id}`,
    description: null,
    event_type: "social",
    event_date: isoStart,
    event_time: null,
    location: `Venue ${id}`,
    address: null,
    price_type: "paid",
    price_amount: 15,
    rsvp_link: null,
    image_url: `https://example.com/${id}.jpg`,
    city: "new-york-city",
    sublocation: null,
    created_at: "2026-11-01T00:00:00Z",
    host: null,
    taxonomy_terms: [],
    ...extra,
  } as DatabaseEvent;
}

const item = (eventId: string, role: ItineraryItem["role"] = "featured", position = 0): ItineraryItem => ({
  eventId,
  role,
  position,
  note: null,
});

function model(
  events: DatabaseEvent[],
  items: ItineraryItem[],
  options: { format?: ItineraryPosterFormat; flyers?: ReadonlyMap<string, string | null> } = {},
) {
  const byId = new Map(events.map((e) => [e.id, e]));
  const { nights } = buildSchedule({ weekStart: WEEK, timeZone: TZ, items, unfeaturedDays: [] }, byId);
  return buildItineraryPosterModel({
    itinerary: { city: "new-york-city", weekStart: WEEK, timeZone: TZ, title: "Your week in NYC" },
    cityName: "New York City",
    nights,
    flyers: options.flyers ?? new Map(events.map((e) => [e.id, `data:image/png;base64,${e.id}`])),
    format: options.format ?? "story",
  });
}

// Mon Nov 9, Fri Nov 13 and Sat Nov 14 at 9 PM Eastern.
const mon = event("mon", "2026-11-10T02:00:00Z", { event_type: "class" });
const fri = event("fri", "2026-11-14T02:00:00Z");
const sat = event("sat", "2026-11-15T02:00:00Z", { event_type: "workshop" });

describe("buildItineraryPosterModel", () => {
  it("numbers Mon–Thu as side A and Fri–Sun as side B", () => {
    const story = model([mon, fri, sat], [item("mon"), item("fri"), item("sat")]);
    expect(story.tracks.map((t) => `${t.code} ${t.day}`)).toEqual(["A1 MON 9", "B1 FRI 13", "B2 SAT 14"]);
    expect(story.tracks[0]).toMatchObject({ title: "Title mon", time: "9 PM", venue: "Venue mon", pressing: "class" });

    const card = model([mon, fri, sat], [item("mon"), item("fri"), item("sat")], { format: "card" });
    expect(card.tracks).toHaveLength(3);
    expect(card.format).toBe("card");
  });

  it("prints an after-midnight start with its calendar day and no parentheses", () => {
    const late = event("late", "2026-11-15T05:30:00Z");
    const story = model([late], [item("late")]);
    expect(story.tracks).toEqual([expect.objectContaining({ code: "B1", day: "SAT 14", time: "12:30 AM SUN" })]);
  });

  it("uses the top-ranked alternative on a night without a featured pick, and omits empty nights", () => {
    const second = event("second", "2026-11-11T23:00:00Z");
    const first = event("first", "2026-11-12T01:00:00Z");
    const story = model([second, first], [item("second", "alternative", 1), item("first", "alternative", 0)]);
    expect(story.tracks).toEqual([expect.objectContaining({ code: "A1", day: "WED 11", title: "Title first" })]);
    // The card carries featured nights only.
    expect(model([second, first], [item("second", "alternative", 1)], { format: "card" }).tracks).toEqual([]);
  });

  it("prints the ISO week and city code in the catalogue line", () => {
    const story = model([fri], [item("fri")]);
    expect(story.catalogue).toBe("SS-W46 · NYC");
    expect(story.weekLabel).toBe("Nov 9–15");
    expect(story.cityName).toBe("New York City");
    expect(story.urlLabel).toMatch(/\/itineraries\/new-york-city\/2026-11-09$/);
    expect(story.url).toBe(`${window.location.origin}/itineraries/new-york-city/2026-11-09`);
  });

  it("frames each featured flyer in its own pressing, and falls back to type art without flyers", () => {
    const withFlyers = model([mon, fri, sat], [item("mon"), item("fri"), item("sat")]);
    expect(withFlyers.tiles).toEqual([
      { imageUrl: "data:image/png;base64,mon", artKind: "flyer", pressing: "class" },
      { imageUrl: "data:image/png;base64,fri", artKind: "flyer", pressing: "social" },
      { imageUrl: "data:image/png;base64,sat", artKind: "flyer", pressing: "workshop" },
    ]);

    const noFlyers = model([mon, fri, sat], [item("mon"), item("fri"), item("sat")], {
      flyers: new Map([["fri", null]]),
    });
    expect(noFlyers.tiles).toEqual([
      { imageUrl: "/images/event-fallbacks/salsa.svg", artKind: "fallback", pressing: "class" },
      { imageUrl: "/images/event-fallbacks/social.svg", artKind: "fallback", pressing: "social" },
      { imageUrl: "/images/event-fallbacks/workshop.svg", artKind: "fallback", pressing: "workshop" },
    ]);
  });

  it("spotlights at most four featured nights on the cover and the card", () => {
    const week = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"].map(
      (day, i) => event(`d${i + 1}`, `${day}T02:00:00Z`),
    );
    const items = week.map((e) => item(e.id));
    const story = model(week, items);
    expect(story.tracks).toHaveLength(7);
    expect(story.tiles).toHaveLength(4);
    expect(model(week, items, { format: "card" }).tracks.map((t) => t.day)).toEqual([
      "THU 12",
      "FRI 13",
      "SAT 14",
      "SUN 15",
    ]);
  });
});

describe("itinerary sharing helpers", () => {
  it("builds the public URL, its printed label and the poster filenames", () => {
    const url = buildPublicItineraryUrl("new-york-city", WEEK, "https://salsasegura.com");
    expect(url).toBe("https://salsasegura.com/itineraries/new-york-city/2026-11-09");
    expect(itineraryUrlLabel(url)).toBe("salsasegura.com/itineraries/new-york-city/2026-11-09");
    expect(itineraryPosterFilename("boston", WEEK, "story")).toBe("salsa-segura-week-boston-2026-11-09.png");
    expect(itineraryPosterFilename("boston", WEEK, "feed")).toBe("salsa-segura-week-boston-2026-11-09-feed.png");
  });

  it("sizes the card as a 1200×630 link preview beside the event cuts", () => {
    expect(ITINERARY_POSTER_SIZE).toEqual({
      story: { width: 1080, height: 1920 },
      feed: { width: 1080, height: 1350 },
      card: { width: 1200, height: 630 },
    });
  });
});

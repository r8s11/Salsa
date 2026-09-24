import { describe, it, expect } from "vitest";
import { resolveEventFlyer } from "./eventModalImage";

const art = (name: string) => `/images/event-fallbacks/${name}.svg`;

describe("resolveEventFlyer", () => {
  it("returns the event's uploaded image unchanged when present", () => {
    const url = "https://example.test/flyers/social-night.jpg";
    expect(resolveEventFlyer({ imageUrl: url, calendarId: "class" })).toBe(url);
  });

  it("never puts typed art on a different kind of event", () => {
    expect(resolveEventFlyer({ calendarId: "workshop" })).toBe(art("workshop"));
    expect(resolveEventFlyer({ calendarId: "social" })).toBe(art("social"));
    // A class has no art of its own: it gets the neutral brand flyer, never
    // "SOCIAL", "WORKSHOP" or "BACHATA NIGHTS".
    expect(resolveEventFlyer({ calendarId: "class", danceStyles: ["bachata"] })).toBe(art("salsa"));
    expect(resolveEventFlyer({ calendarId: "workshop", danceStyles: ["Bachata"] })).toBe(
      art("workshop")
    );
  });

  it("reserves the bachata-night art for socials that are bachata only", () => {
    expect(resolveEventFlyer({ calendarId: "social", danceStyles: ["Bachata"] })).toBe(art("bachata"));
    expect(resolveEventFlyer({ calendarId: "social", danceStyles: ["salsa", "bachata"] })).toBe(
      art("social")
    );
  });

  it("falls back to the neutral brand flyer when the type is missing or unknown", () => {
    expect(resolveEventFlyer({ imageUrl: "  " })).toBe(art("salsa"));
    expect(resolveEventFlyer({ calendarId: "festival" })).toBe(art("salsa"));
  });
});

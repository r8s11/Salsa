import { describe, it, expect } from "vitest";
import { resolveEventFlyer } from "./eventModalImage";

const missingFlyerEvent = {
  id: "event-1",
  imageUrl: undefined,
  calendarId: "social" as const,
};

describe("resolveEventFlyer", () => {
  it("returns the event's uploaded image unchanged when present", () => {
    const url = "https://example.test/flyers/social-night.jpg";
    expect(resolveEventFlyer({ id: "1", imageUrl: url, calendarId: "social" })).toBe(url);
  });

  it("returns a fallback flyer when imageUrl is missing", () => {
    expect(resolveEventFlyer(missingFlyerEvent)).toMatch(
      /^\/images\/(?:default-event-banner\.png|event-fallbacks\/.+\.svg)$/
    );
  });

  it("returns the same fallback for the same event ID", () => {
    expect(resolveEventFlyer(missingFlyerEvent)).toBe(resolveEventFlyer(missingFlyerEvent));
  });

  it("distributes different event IDs across multiple fallback flyers", () => {
    const urls = new Set(
      ["event-1", "event-2", "event-3", "event-4", "event-5", "event-6"].map((id) =>
        resolveEventFlyer({ ...missingFlyerEvent, id })
      )
    );

    expect(urls.size).toBeGreaterThan(1);
  });
});

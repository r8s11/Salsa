import { describe, it, expect } from "vitest";
import { DEFAULT_EVENT_BANNER_URL, resolveEventModalImage } from "./eventModalImage";

describe("resolveEventModalImage", () => {
  it("returns the event's uploaded image unchanged when present", () => {
    const url = "https://example.test/flyers/social-night.jpg";
    expect(resolveEventModalImage({ id: "1", imageUrl: url, calendarId: "social" })).toBe(url);
  });

  it("returns the default banner when imageUrl is missing", () => {
    expect(resolveEventModalImage({ id: "1", imageUrl: undefined, calendarId: "social" })).toBe(
      DEFAULT_EVENT_BANNER_URL
    );
  });

  it("returns the default banner when imageUrl is empty", () => {
    expect(resolveEventModalImage({ id: "1", imageUrl: "", calendarId: "social" })).toBe(
      DEFAULT_EVENT_BANNER_URL
    );
  });
});

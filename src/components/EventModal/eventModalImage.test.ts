import { describe, it, expect } from "vitest";
import { resolveEventModalImage } from "./eventModalImage";

describe("resolveEventModalImage", () => {
  it("returns the event's uploaded image unchanged when present", () => {
    const url = "https://example.test/flyers/social-night.jpg";
    expect(resolveEventModalImage({ id: "1", imageUrl: url, calendarId: "social" })).toBe(url);
  });

  it("returns undefined when imageUrl is missing", () => {
    expect(resolveEventModalImage({ id: "1", imageUrl: undefined, calendarId: "social" })).toBeUndefined();
  });

  it("returns undefined when imageUrl is empty string", () => {
    expect(resolveEventModalImage({ id: "1", imageUrl: "", calendarId: "social" })).toBeUndefined();
  });
});

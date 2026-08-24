import { describe, it, expect } from "vitest";
import { resolveEventModalImage } from "./eventModalImage";

describe("resolveEventModalImage", () => {
  it("returns the event's uploaded image unchanged when present", () => {
    const url = "https://example.test/flyers/social-night.jpg";
    expect(
      resolveEventModalImage({ id: "1", imageUrl: url, calendarId: "social" })
    ).toBe(url);
  });

  it("deterministically selects the Salsa fallback for an even id character-code sum", () => {
    // "2" -> char code 50 (even).
    const result = resolveEventModalImage({ id: "2", imageUrl: undefined, calendarId: "social" });
    expect(result).toBe("/images/event-modal-salsa-party.webp");
    // Re-resolving must be stable across calls/rerenders.
    expect(resolveEventModalImage({ id: "2", imageUrl: undefined, calendarId: "social" })).toBe(
      result
    );
  });

  it("deterministically selects the Bachata fallback for an odd id character-code sum", () => {
    // "1" -> char code 49 (odd).
    const result = resolveEventModalImage({ id: "1", imageUrl: undefined, calendarId: "class" });
    expect(result).toBe("/images/event-modal-bachata-party.webp");
  });

  it("falls back to a deterministic party photo when imageUrl is missing or empty", () => {
    const missing = resolveEventModalImage({ id: "42", imageUrl: undefined, calendarId: "workshop" });
    const empty = resolveEventModalImage({ id: "42", imageUrl: "", calendarId: "workshop" });
    expect(missing).toMatch(/^\/images\/event-modal-(salsa|bachata)-party\.webp$/);
    expect(empty).toBe(missing);
  });
});

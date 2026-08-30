import { describe, it, expect } from "vitest";
import { createEventTitleImage } from "../../features/events/ui/eventTitleImage";
import { resolveEventModalImage } from "./eventModalImage";

const baseInput = {
  id: "1",
  title: "Salsa Social",
  eventType: "social" as const,
  city: "boston" as const,
  start: "2026-08-24 19:00",
};

describe("resolveEventModalImage", () => {
  it("returns the event's uploaded image unchanged when present", () => {
    const url = "https://example.test/flyers/social-night.jpg";
    expect(
      resolveEventModalImage({
        ...baseInput,
        imageUrl: url,
        calendarId: baseInput.eventType,
      })
    ).toBe(url);
  });

  it("returns deterministic title art when the flyer is absent", () => {
    const event = {
      ...baseInput,
      imageUrl: undefined,
      calendarId: baseInput.eventType,
    };
    const result = resolveEventModalImage(event);
    expect(result).toBe(createEventTitleImage(baseInput));
    expect(resolveEventModalImage(event)).toBe(result);
  });

  it("uses the same title art for missing and empty flyer URLs", () => {
    const missing = resolveEventModalImage({
      ...baseInput,
      imageUrl: undefined,
      calendarId: "workshop",
      eventType: "workshop",
    });
    const empty = resolveEventModalImage({
      ...baseInput,
      imageUrl: "",
      calendarId: "workshop",
      eventType: "workshop",
    });
    expect(missing).toBe(
      createEventTitleImage({
        ...baseInput,
        eventType: "workshop",
      })
    );
    expect(empty).toBe(missing);
  });
});

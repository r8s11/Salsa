import { describe, expect, it } from "vitest";
import { createEventTitleImage, getEventTitleImageAlt } from "./eventTitleImage";

describe("createEventTitleImage", () => {
  const social = {
    id: "event-1",
    title: "Havana Nights Social",
    eventType: "social" as const,
    city: "boston",
    start: "2026-09-04 20:00",
  };

  it("is deterministic for identical event data", () => {
    expect(createEventTitleImage(social)).toBe(createEventTitleImage(social));
  });

  it.each(["social", "class", "workshop"] as const)("encodes the %s palette", (eventType) => {
    const url = decodeURIComponent(createEventTitleImage({ ...social, eventType }));
    expect(url).toContain("data:image/svg+xml");
    expect(url).toContain(eventType);
  });

  it("uses bounded fallback text for missing or overlong titles", () => {
    const url = decodeURIComponent(
      createEventTitleImage({ ...social, title: "A ".repeat(500), city: null, start: null })
    );
    expect(url).toContain("SalsaSegura");
    expect(url.length).toBeLessThan(20_000);
    expect(getEventTitleImageAlt({ ...social, title: null })).toBe(
      "SalsaSegura event title image for Event"
    );
  });

  it("escapes title and metadata before embedding them in SVG", () => {
    const svg = decodeURIComponent(
      createEventTitleImage({
        ...social,
        title: '<script>alert("x")</script> & dance',
        city: '<Boston>',
        start: '2026-09-04 "20:00"',
      })
    );

    expect(svg).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("aria-hidden=\"true\"");
  });
});

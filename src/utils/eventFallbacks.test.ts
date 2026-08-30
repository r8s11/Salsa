import { describe, it, expect } from "vitest";
import { getFallbackTemplate, getEventFallbackAltText } from "./eventFallbacks";

describe("getFallbackTemplate", () => {
  it("returns a valid template for any event", () => {
    const validTemplates = ["dance", "percussion", "band", "tropical", "minimal"];
    const result = getFallbackTemplate({ id: "1", title: "Test Event" });
    expect(validTemplates).toContain(result);
  });

  it("is deterministic - same ID always returns same template", () => {
    const event = { id: "42", title: "Salsa Night" };
    const result1 = getFallbackTemplate(event);
    const result2 = getFallbackTemplate(event);
    expect(result1).toBe(result2);
  });

  it("different IDs may return different templates", () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(getFallbackTemplate({ id: String(i), title: "Event" }));
    }
    expect(results.size).toBeGreaterThan(1);
  });

  describe("event-aware keyword selection", () => {
    it("selects minimal template for bachata classes", () => {
      expect(getFallbackTemplate({ id: "1", title: "Bachata Social Night" })).toBe("dance");
      expect(getFallbackTemplate({ id: "1", title: "Sensual Bachata Class" })).toBe("minimal");
    });

    it("selects band template for live music events", () => {
      expect(getFallbackTemplate({ id: "1", title: "Live Salsa Band" })).toBe("band");
      expect(getFallbackTemplate({ id: "1", title: "Orchestra Concert" })).toBe("band");
    });

    it("selects minimal template for class/workshop events", () => {
      expect(getFallbackTemplate({ id: "1", title: "Beginner Salsa Class" })).toBe("minimal");
      expect(getFallbackTemplate({ id: "1", title: "Workshop: Rhythm Basics" })).toBe("minimal");
    });

    it("selects dance template for social events", () => {
      expect(getFallbackTemplate({ id: "1", title: "Saturday Social" })).toBe("dance");
      expect(getFallbackTemplate({ id: "1", title: "Mambo Night" })).toBe("dance");
    });

    it("selects tropical template for tropical events", () => {
      expect(getFallbackTemplate({ id: "1", title: "Tropical Salsa Night" })).toBe("tropical");
      expect(getFallbackTemplate({ id: "1", title: "Caribbean Party" })).toBe("tropical");
    });

    it("selects percussion template for percussion-only events", () => {
      expect(getFallbackTemplate({ id: "1", title: "Drum Circle" })).toBe("percussion");
      expect(getFallbackTemplate({ id: "1", title: "Conga Night" })).toBe("percussion");
    });

    it("falls back to hash selection when no keywords match", () => {
      const result = getFallbackTemplate({ id: "1", title: "Havana Club" });
      expect(["dance", "percussion", "band", "tropical", "minimal"]).toContain(result);
    });

    it("keyword matching is case-insensitive", () => {
      expect(getFallbackTemplate({ id: "1", title: "BACHATA SOCIAL" })).toBe("dance");
      expect(getFallbackTemplate({ id: "1", title: "live BAND" })).toBe("band");
    });

    it("more specific keywords take precedence over broad ones", () => {
      // "class" (minimal) beats "salsa" (dance)
      expect(getFallbackTemplate({ id: "1", title: "Salsa Class" })).toBe("minimal");
      // "tropical" beats "salsa"
      expect(getFallbackTemplate({ id: "1", title: "Tropical Salsa Night" })).toBe("tropical");
      // "conga" (percussion) beats "night" (dance)
      expect(getFallbackTemplate({ id: "1", title: "Conga Night" })).toBe("percussion");
    });
  });

  describe("edge cases", () => {
    it("handles numeric IDs", () => {
      const result = getFallbackTemplate({ id: 123, title: "Test" });
      expect(["dance", "percussion", "band", "tropical", "minimal"]).toContain(result);
    });

    it("handles missing IDs deterministically", () => {
      expect(getFallbackTemplate({ id: undefined, title: "Uncategorized" })).toBe(
        getFallbackTemplate({ id: undefined, title: "Uncategorized" })
      );
      expect(getFallbackTemplate({ id: null, title: "Uncategorized" })).toBe("dance");
    });

    it("uses dance style and calendar fields for categorization", () => {
      expect(getFallbackTemplate({ id: "style-1", title: "Weekly Meetup", danceStyles: ["Bachata"] })).toBe(
        "dance"
      );
      expect(getFallbackTemplate({ id: "type-1", title: "Friday Showcase", calendarId: "workshop" })).toBe(
        "minimal"
      );
    });

    it("handles empty and very long titles", () => {
      expect(getFallbackTemplate({ id: "1", title: "" })).toBeDefined();
      expect(getFallbackTemplate({ id: "1", title: "A".repeat(500) })).toBeDefined();
    });
  });
});

describe("getEventFallbackAltText", () => {
  it("returns descriptive alt text with event title", () => {
    expect(getEventFallbackAltText("Salsa Night")).toBe("Salsa Segura artwork for Salsa Night");
  });

  it("handles empty title", () => {
    expect(getEventFallbackAltText("")).toBe("Salsa Segura artwork for ");
  });
});

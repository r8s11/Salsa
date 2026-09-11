import { describe, expect, it } from "vitest";
import { parseFlyerExtraction } from "./types";

describe("flyer extraction validation", () => {
  it("normalizes a complete extraction", () => {
    expect(
      parseFlyerExtraction({
        title: "  Friday Salsa  ",
        date: "2026-09-18",
        start_time: "19:00",
        end_time: null,
        venue_name: "Dance Hall",
        address: "1 Main St",
        city: "Boston",
        dance_styles: ["Salsa", " salsa ", "Bachata"],
        event_type: "Social",
        price: "$20",
        organizer_name: "Salsa Segura",
        instagram: "@salsasegura",
        website: "https://example.com",
        details: [" Doors at 7 PM ", ""],
      })
    ).toEqual({
      title: "Friday Salsa",
      date: "2026-09-18",
      start_time: "19:00",
      end_time: null,
      venue_name: "Dance Hall",
      address: "1 Main St",
      city: "Boston",
      dance_styles: ["Salsa", "Bachata"],
      event_type: "Social",
      price: "$20",
      organizer_name: "Salsa Segura",
      instagram: "@salsasegura",
      website: "https://example.com",
      details: ["Doors at 7 PM"],
    });
  });

  it("accepts partial nullable data and rejects malformed fields", () => {
    expect(parseFlyerExtraction({ title: "Only a title" }).title).toBe("Only a title");
    expect(() => parseFlyerExtraction({ title: 42 })).toThrow("Invalid flyer extraction");
    expect(() => parseFlyerExtraction(null)).toThrow("Invalid flyer extraction");
  });

  it("drops invalid URLs and bounds excessive text", () => {
    const parsed = parseFlyerExtraction({
      website: "javascript:alert(1)",
      instagram: "x".repeat(600),
      details: ["same", "same", "x".repeat(600)],
    });
    expect(parsed.website).toBeNull();
    expect(parsed.instagram).toHaveLength(500);
    expect(parsed.details).toEqual(["same", "x".repeat(500)]);
  });
});

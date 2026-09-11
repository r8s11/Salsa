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

  it("keeps a scheme-less domain by assuming https", () => {
    expect(parseFlyerExtraction({ website: "salsasegura.com" }).website).toBe(
      "https://salsasegura.com"
    );
    expect(parseFlyerExtraction({ website: "www.salsasegura.com/events" }).website).toBe(
      "https://www.salsasegura.com/events"
    );
    expect(parseFlyerExtraction({ website: "https://example.com" }).website).toBe(
      "https://example.com"
    );
    expect(parseFlyerExtraction({ website: "ask at the door" }).website).toBeNull();
  });

  it("keeps the readable fields when a date or time is unparseable", () => {
    const parsed = parseFlyerExtraction({
      title: "Friday Salsa",
      date: "next Friday",
      start_time: "9pm",
      end_time: "22:30",
      venue_name: "Dance Hall",
    });
    expect(parsed.date).toBeNull();
    expect(parsed.start_time).toBeNull();
    expect(parsed.end_time).toBe("22:30");
    expect(parsed.title).toBe("Friday Salsa");
    expect(parsed.venue_name).toBe("Dance Hall");
  });
});

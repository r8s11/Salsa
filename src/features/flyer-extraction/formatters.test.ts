import { describe, expect, it } from "vitest";
import {
  countPopulatedFields,
  EXTRACTABLE_FIELD_COUNT,
  formatExtractedDate,
  formatExtractedTime,
  formatInstagramHandle,
  formatTimeRange,
  hasPartialExtraction,
} from "./formatters";
import type { ExtractedEvent } from "./types";

const FULL_EVENT: ExtractedEvent = {
  title: "Boston Salsa Night",
  date: "2026-09-18",
  start_time: "21:00",
  end_time: "01:00",
  venue_name: "Havana Club",
  address: "288 Green Street",
  city: "Cambridge",
  dance_styles: ["Salsa", "Bachata"],
  event_type: "Social",
  price: "$20",
  organizer_name: "SalsaSegura",
  instagram: "salsasegura",
  website: "https://salsasegura.com",
  details: ["21+"],
};

describe("formatExtractedDate", () => {
  it("formats a canonical YYYY-MM-DD date for display", () => {
    expect(formatExtractedDate("2026-09-18")).toBe("September 18, 2026");
  });

  it("returns null for a missing or malformed date, never throwing", () => {
    expect(formatExtractedDate(null)).toBeNull();
    expect(formatExtractedDate("September 18, 2026")).toBeNull();
    expect(formatExtractedDate("2026-13-40")).toBeNull();
  });
});

describe("formatExtractedTime", () => {
  it("formats 24-hour HH:MM into a 12-hour clock reading", () => {
    expect(formatExtractedTime("21:00")).toBe("9:00 PM");
    expect(formatExtractedTime("00:05")).toBe("12:05 AM");
    expect(formatExtractedTime("12:00")).toBe("12:00 PM");
  });

  it("returns null for a missing or malformed time", () => {
    expect(formatExtractedTime(null)).toBeNull();
    expect(formatExtractedTime("9:00 PM")).toBeNull();
  });
});

describe("formatTimeRange", () => {
  it("joins both ends when present", () => {
    expect(formatTimeRange("21:00", "01:00")).toBe("9:00 PM – 1:00 AM");
  });

  it("falls back to whichever side is present", () => {
    expect(formatTimeRange("21:00", null)).toBe("9:00 PM");
    expect(formatTimeRange(null, "01:00")).toBe("1:00 AM");
  });

  it("returns null when neither side is a valid time", () => {
    expect(formatTimeRange(null, null)).toBeNull();
  });
});

describe("formatInstagramHandle", () => {
  it("adds a leading @ without duplicating an existing one", () => {
    expect(formatInstagramHandle("salsasegura")).toBe("@salsasegura");
    expect(formatInstagramHandle("@salsasegura")).toBe("@salsasegura");
  });

  it("returns null for empty input", () => {
    expect(formatInstagramHandle(null)).toBeNull();
    expect(formatInstagramHandle("  ")).toBeNull();
  });
});

describe("countPopulatedFields / hasPartialExtraction", () => {
  it("counts every populated field on a full extraction", () => {
    expect(countPopulatedFields(FULL_EVENT)).toBe(EXTRACTABLE_FIELD_COUNT);
    expect(hasPartialExtraction(FULL_EVENT)).toBe(false);
  });

  it("ignores nulls and empty arrays, and flags the result as partial", () => {
    const minimal: ExtractedEvent = {
      ...FULL_EVENT,
      address: null,
      event_type: null,
      price: null,
      organizer_name: null,
      instagram: null,
      website: null,
      details: [],
    };
    expect(countPopulatedFields(minimal)).toBe(EXTRACTABLE_FIELD_COUNT - 7);
    expect(hasPartialExtraction(minimal)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { generateIcs, mapsUrl, googleCalendarUrl } from "./ics";
import { ScheduleXEvent } from "../types/events";

const event: ScheduleXEvent = {
  id: "abc-123",
  title: "Saturday Social",
  start: "2026-07-18 20:00",
  end: "2026-07-19 00:00",
  calendarId: "social",
  description: "Line one\nLine two, with comma; and semicolon",
  location: "Havana Club",
  address: "288 Green St",
  rsvpLink: "https://example.com/rsvp",
};

describe("generateIcs", () => {
  it("produces a VCALENDAR wrapping one VEVENT with CRLF line endings", () => {
    const ics = generateIcs(event);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("\r\nBEGIN:VEVENT\r\n");
    expect(ics).toContain("\r\nEND:VEVENT\r\n");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/); // every \n is preceded by \r
  });

  it("formats start/end with the New York TZID", () => {
    const ics = generateIcs(event);
    expect(ics).toContain("DTSTART;TZID=America/New_York:20260718T200000");
    expect(ics).toContain("DTEND;TZID=America/New_York:20260719T000000");
  });

  it("sets UID, SUMMARY, URL and joined LOCATION", () => {
    const ics = generateIcs(event);
    expect(ics).toContain("UID:abc-123@salsasegura.com");
    expect(ics).toContain("SUMMARY:Saturday Social");
    expect(ics).toContain("URL:https://example.com/rsvp");
    expect(ics).toContain("LOCATION:Havana Club\\, 288 Green St");
  });

  it("escapes commas, semicolons and newlines in DESCRIPTION", () => {
    const ics = generateIcs(event);
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\\, with comma\\; and semicolon");
  });

  it("omits optional lines when fields are missing", () => {
    const ics = generateIcs({
      id: 1,
      title: "Bare Event",
      start: "2026-07-18 20:00",
      end: "2026-07-18 22:00",
      calendarId: "class",
    });
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("URL:");
  });
});

describe("mapsUrl", () => {
  it("builds a Google Maps query from location + address", () => {
    const url = mapsUrl(event);
    expect(url).toBe("https://maps.google.com/maps?q=Havana+Club%2C+288+Green+St");
  });

  it("returns null when neither location nor address is set", () => {
    const url = mapsUrl({ ...event, location: undefined, address: undefined });
    expect(url).toBeNull();
  });

  it("uses only location when address is missing", () => {
    const url = mapsUrl({ ...event, address: undefined });
    expect(url).toBe("https://maps.google.com/maps?q=Havana+Club");
  });
});

describe("googleCalendarUrl", () => {
  it("pre-fills title, dates in UTC, details, and location", () => {
    const url = googleCalendarUrl(event);
    expect(url).toContain("https://calendar.google.com/calendar/u/0/r/eventedit?");
    // 2026-07-18 20:00 America/New_York -> 2026-07-19 00:00 UTC
    // 2026-07-19 00:00 America/New_York -> 2026-07-19 04:00 UTC
    expect(url).toContain("text=Saturday%20Social");
    expect(url).toContain("dates=20260719T000000Z/20260719T040000Z");
    expect(url).toContain("details=Line%20one");
    expect(url).toContain("RSVP%3A%20https%3A%2F%2Fexample.com%2Frsvp");
    expect(url).toContain("location=Havana%20Club%2C%20288%20Green%20St");
  });

  it("omits details when description and rsvpLink are absent", () => {
    const url = googleCalendarUrl({
      ...event,
      description: undefined,
      rsvpLink: undefined,
    });
    expect(url).not.toContain("details=");
  });

  it("omits location when venue and address are absent", () => {
    const url = googleCalendarUrl({ ...event, location: undefined, address: undefined });
    expect(url).not.toContain("location=");
  });

  it("returns null when start or end is missing", () => {
    expect(googleCalendarUrl({ ...event, start: "", end: "" })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { eventDateParts, eventSummaryTimeZone, formatEventDate } from "./format";

const LA = "America/Los_Angeles";
const NY = "America/New_York";

describe("eventSummaryTimeZone", () => {
  it("uses the metro's zone when the venue has none", () => {
    expect(eventSummaryTimeZone({ city: "los-angeles" })).toBe(LA);
    expect(eventSummaryTimeZone({ city: "chicago", venue_time_zone: null })).toBe("America/Chicago");
  });

  it("prefers the venue's zone over the metro's", () => {
    expect(eventSummaryTimeZone({ city: "los-angeles", venue_time_zone: "America/Denver" })).toBe("America/Denver");
  });

  it("keeps America/New_York only as the final fallback", () => {
    expect(eventSummaryTimeZone({ city: "unmapped-town" })).toBe(NY);
    expect(eventSummaryTimeZone({ city: "los-angeles", venue_time_zone: "Mars/Olympus" })).toBe(NY);
  });
});

describe("eventDateParts", () => {
  it("shows the Los Angeles calendar day for an event past midnight Eastern", () => {
    // 01:30 on Oct 10 in New York is still 10:30 PM on Oct 9 in Los Angeles.
    const parts = eventDateParts("2026-10-10T05:30:00Z", LA);
    expect(parts).toMatchObject({ day: "9", month: "Oct", weekday: "Fri" });
    expect(parts?.time).toMatch(/^10:30\sPM$/);
    expect(eventDateParts("2026-10-10T05:30:00Z", NY)).toMatchObject({ day: "10", weekday: "Sat" });
  });

  it("follows the spring-forward transition (2:00 AM PST jumps to 3:00 AM PDT)", () => {
    expect(eventDateParts("2026-03-08T09:59:00Z", LA)?.time).toMatch(/^1:59\sAM$/);
    expect(eventDateParts("2026-03-08T10:00:00Z", LA)?.time).toMatch(/^3:00\sAM$/);
  });

  it("follows the fall-back transition (1:30 AM happens twice)", () => {
    expect(eventDateParts("2026-11-01T08:30:00Z", LA)?.time).toMatch(/^1:30\sAM$/); // PDT
    expect(eventDateParts("2026-11-01T09:30:00Z", LA)?.time).toMatch(/^1:30\sAM$/); // PST
    expect(eventDateParts("2026-11-01T10:00:00Z", LA)?.time).toMatch(/^2:00\sAM$/);
  });

  it("leaves an Eastern event unchanged", () => {
    expect(eventDateParts("2026-10-10T02:00:00Z", NY)).toMatchObject({ day: "9", month: "Oct", weekday: "Fri" });
    expect(eventDateParts("2026-10-10T02:00:00Z", NY)?.time).toMatch(/^10:00\sPM$/);
  });

  it("falls back to New York for an invalid or missing zone instead of throwing", () => {
    const expected = eventDateParts("2026-10-10T02:00:00Z", NY);
    expect(eventDateParts("2026-10-10T02:00:00Z", "Not/AZone")).toEqual(expected);
    expect(eventDateParts("2026-10-10T02:00:00Z", "-05:00")).toEqual(expected);
    expect(eventDateParts("2026-10-10T02:00:00Z", null)).toEqual(expected);
    expect(eventDateParts("2026-10-10T02:00:00Z", undefined)).toEqual(expected);
  });

  it("returns null for an unreadable instant", () => {
    expect(eventDateParts("soon", LA)).toBeNull();
  });
});

describe("formatEventDate", () => {
  it("renders the date and time in the event's zone", () => {
    expect(formatEventDate("2026-10-10T05:30:00Z", LA)).toMatch(/Oct 9, 2026.*10:30\sPM/);
    expect(formatEventDate("2026-10-10T05:30:00Z", NY)).toMatch(/Oct 10, 2026.*1:30\sAM/);
  });

  it("falls back to New York for an invalid or missing zone", () => {
    const expected = formatEventDate("2026-10-10T02:00:00Z", NY);
    expect(formatEventDate("2026-10-10T02:00:00Z", "Not/AZone")).toBe(expected);
    expect(formatEventDate("2026-10-10T02:00:00Z", null)).toBe(expected);
  });

  it("echoes an unreadable instant", () => {
    expect(formatEventDate("soon", LA)).toBe("soon");
  });
});

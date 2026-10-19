import { describe, it, expect } from "vitest";
import {
  isValidIanaTimeZone,
  metroTimeZone,
  resolveEventTimeZone,
  timeZoneForDisplay,
  TIME_ZONE_OPTIONS,
} from "./timezone";

describe("isValidIanaTimeZone", () => {
  it("accepts real IANA zones", () => {
    for (const zone of ["America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London"]) {
      expect(isValidIanaTimeZone(zone)).toBe(true);
    }
  });

  it("rejects typos, empty values and non-strings", () => {
    for (const bad of ["America/Nowhere", "New York", "EST5EDT-ish", "", "   ", null, undefined]) {
      expect(isValidIanaTimeZone(bad)).toBe(false);
    }
  });

  it("rejects fixed offsets, which do not follow daylight saving", () => {
    expect(isValidIanaTimeZone("-05:00")).toBe(false);
    expect(isValidIanaTimeZone("+01:00")).toBe(false);
  });
});

describe("metroTimeZone", () => {
  it.each([
    ["new-york-city", "America/New_York"],
    ["boston", "America/New_York"],
    ["los-angeles", "America/Los_Angeles"],
    ["chicago", "America/Chicago"],
    ["texas", "America/Chicago"],
    ["london", "Europe/London"],
  ])("%s -> %s", (slug, zone) => {
    expect(metroTimeZone(slug)).toBe(zone);
  });

  it("returns null for an unmapped metro instead of guessing", () => {
    expect(metroTimeZone("atlantis")).toBeNull();
    expect(metroTimeZone(null)).toBeNull();
  });
});

describe("resolveEventTimeZone", () => {
  it.each([
    ["NYC", "new-york-city", "America/New_York"],
    ["Boston", "boston", "America/New_York"],
    ["Chicago", "chicago", "America/Chicago"],
    ["Los Angeles", "los-angeles", "America/Los_Angeles"],
    ["London", "london", "Europe/London"],
  ])("%s resolves from its canonical metro", (_label, metro, zone) => {
    expect(resolveEventTimeZone({ metro })).toEqual({ ok: true, timeZone: zone, source: "metro" });
  });

  it("prefers event > series > venue > metro", () => {
    const all = {
      event: "America/Chicago",
      series: "America/Denver",
      venue: "America/Los_Angeles",
      metro: "boston",
    };
    expect(resolveEventTimeZone(all)).toMatchObject({ timeZone: "America/Chicago", source: "event" });
    expect(resolveEventTimeZone({ ...all, event: null })).toMatchObject({
      timeZone: "America/Denver",
      source: "series",
    });
    expect(resolveEventTimeZone({ ...all, event: "", series: undefined })).toMatchObject({
      timeZone: "America/Los_Angeles",
      source: "venue",
    });
    expect(resolveEventTimeZone({ metro: "boston" })).toMatchObject({ source: "metro" });
  });

  it("lets a venue zone override a metro that is in a different zone", () => {
    expect(resolveEventTimeZone({ venue: "America/Chicago", metro: "new-york-city" })).toMatchObject({
      timeZone: "America/Chicago",
      source: "venue",
    });
  });

  it("reports a missing zone with a helpful message when nothing resolves", () => {
    const result = resolveEventTimeZone({ metro: "atlantis" });
    expect(result).toMatchObject({ ok: false, reason: "missing" });
    expect(result.ok ? "" : result.message).toMatch(/Choose one/);
  });

  it("reports an invalid explicit zone instead of silently falling through to a valid one", () => {
    const result = resolveEventTimeZone({ event: "Mars/Olympus", venue: "America/Chicago", metro: "boston" });
    expect(result).toMatchObject({ ok: false, reason: "invalid", invalidValue: "Mars/Olympus" });
    expect(result.ok ? "" : result.message).toMatch(/Mars\/Olympus.*IANA.*event/s);
  });

  it("names which layer carried the invalid value", () => {
    const result = resolveEventTimeZone({ series: "Nope/Zone", metro: "boston" });
    expect(result.ok ? "" : result.message).toMatch(/series/);
  });

  it("never returns UTC for an unresolved zone", () => {
    const result = resolveEventTimeZone({});
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/UTC/);
  });
});

describe("timeZoneForDisplay", () => {
  it("returns the resolved zone", () => {
    expect(timeZoneForDisplay({ metro: "los-angeles" })).toBe("America/Los_Angeles");
  });

  it("falls back to the platform zone only for display when nothing resolves", () => {
    expect(timeZoneForDisplay({ metro: "atlantis" })).toBe("America/New_York");
  });
});

describe("TIME_ZONE_OPTIONS", () => {
  it("offers only zones the resolver accepts", () => {
    expect(TIME_ZONE_OPTIONS.length).toBeGreaterThan(0);
    for (const zone of TIME_ZONE_OPTIONS) expect(isValidIanaTimeZone(zone)).toBe(true);
  });
});

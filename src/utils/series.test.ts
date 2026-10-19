import { describe, it, expect } from "vitest";
import { getUpcomingSeriesDates, generateSeriesOccurrences } from "./series";

describe("getUpcomingSeriesDates", () => {
  it("returns the next 3 weekly occurrences after the event date", () => {
    const dates = getUpcomingSeriesDates("2026-07-18 20:00");
    expect(dates.map((d) => d.toString())).toEqual([
      "2026-07-25T20:00:00",
      "2026-08-01T20:00:00",
      "2026-08-08T20:00:00",
    ]);
  });

  it("respects a custom count", () => {
    expect(getUpcomingSeriesDates("2026-07-18 20:00", 1)).toHaveLength(1);
  });

  it("preserves wall-clock time across the DST boundary", () => {
    const dates = getUpcomingSeriesDates("2026-10-31 20:00", 2);
    // DST ends 2026-11-01; wall time must stay 20:00
    expect(dates.map((d) => d.toString())).toEqual(["2026-11-07T20:00:00", "2026-11-14T20:00:00"]);
  });
});

describe("getUpcomingSeriesDates monthly", () => {
  it("steps by calendar month, keeping the local time", () => {
    expect(
      getUpcomingSeriesDates("2026-01-15 20:00", 3, "monthly").map((d) => d.toString())
    ).toEqual(["2026-02-15T20:00:00", "2026-03-15T20:00:00", "2026-04-15T20:00:00"]);
  });

  it("clamps a 31st to the end of shorter months instead of overflowing", () => {
    expect(
      getUpcomingSeriesDates("2026-01-31 20:00", 2, "monthly").map((d) => d.toString())
    ).toEqual(["2026-02-28T20:00:00", "2026-03-31T20:00:00"]);
  });
});

describe("generateSeriesOccurrences", () => {
  it.each([
    ["NYC", "America/New_York", "-04:00"],
    ["Boston", "America/New_York", "-04:00"],
    ["Chicago", "America/Chicago", "-05:00"],
    ["Los Angeles", "America/Los_Angeles", "-07:00"],
    ["London", "Europe/London", "+01:00"],
  ])("%s weekly series is anchored to %s with the right offset", (_city, zone, offset) => {
    const [first] = generateSeriesOccurrences("2026-07-18 20:00", zone, 1);
    expect(first.timeZone).toBe(zone);
    expect(first.zoned.timeZoneId).toBe(zone);
    expect(first.zoned.offset).toBe(offset);
    expect(first.zoned.hour).toBe(20);
  });

  it("gives every occurrence the parent zone", () => {
    const occurrences = generateSeriesOccurrences("2026-07-18 20:00", "America/Chicago", 6);
    expect(occurrences).toHaveLength(6);
    expect(new Set(occurrences.map((o) => o.timeZone))).toEqual(new Set(["America/Chicago"]));
  });

  it("keeps 20:00 local when New York falls back (Nov 1 2026), while the UTC hour moves", () => {
    const [beforeFallBack, afterFallBack] = generateSeriesOccurrences(
      "2026-10-25 20:00",
      "America/New_York",
      2
    );
    // Nov 1 20:00 EDT->EST boundary: weekly step lands on Nov 1 and Nov 8.
    expect(beforeFallBack.local.toString()).toBe("2026-11-01T20:00:00");
    expect(afterFallBack.local.toString()).toBe("2026-11-08T20:00:00");
    expect(beforeFallBack.zoned.hour).toBe(20);
    expect(afterFallBack.zoned.hour).toBe(20);
    expect(beforeFallBack.zoned.offset).toBe("-05:00");
    expect(beforeFallBack.zoned.toInstant().toString()).toBe("2026-11-02T01:00:00Z");
  });

  it("keeps 20:00 local across spring-forward (Mar 8 2026) for Los Angeles", () => {
    const [beforeSpring, afterSpring] = generateSeriesOccurrences(
      "2026-03-01 20:00",
      "America/Los_Angeles",
      2
    );
    expect(beforeSpring.local.toString()).toBe("2026-03-08T20:00:00");
    expect(beforeSpring.zoned.offset).toBe("-07:00");
    expect(afterSpring.zoned.hour).toBe(20);
    expect(afterSpring.zoned.toInstant().toString()).toBe("2026-03-16T03:00:00Z");
  });

  it("follows the event's own zone's DST, not New York's (London changes on a different weekend)", () => {
    // US is already on DST on Mar 22 while London has not sprung forward yet (Mar 29).
    const [london] = generateSeriesOccurrences("2026-03-22 20:00", "Europe/London", 1);
    expect(london.local.toString()).toBe("2026-03-29T20:00:00");
    expect(london.zoned.offset).toBe("+01:00");
    const [newYork] = generateSeriesOccurrences("2026-03-22 20:00", "America/New_York", 1);
    expect(newYork.zoned.offset).toBe("-04:00");
    expect(london.zoned.toInstant().toString()).not.toBe(newYork.zoned.toInstant().toString());
  });

  it("moves a wall time skipped by spring-forward to the next valid instant", () => {
    // 02:30 does not exist on Mar 8 2026 in New York.
    const [skipped] = generateSeriesOccurrences("2026-03-01 02:30", "America/New_York", 1);
    expect(skipped.local.toString()).toBe("2026-03-08T02:30:00");
    expect(skipped.zoned.hour).toBe(3);
    expect(skipped.zoned.toInstant().toString()).toBe("2026-03-08T07:30:00Z");
  });

  it("supports monthly series in the series zone", () => {
    const occurrences = generateSeriesOccurrences("2026-10-15 19:30", "America/Chicago", 3, "monthly");
    expect(occurrences.map((o) => o.local.toString())).toEqual([
      "2026-11-15T19:30:00",
      "2026-12-15T19:30:00",
      "2027-01-15T19:30:00",
    ]);
    expect(occurrences.every((o) => o.zoned.hour === 19 && o.zoned.minute === 30)).toBe(true);
  });

  it("throws a helpful error for a missing zone rather than defaulting to UTC", () => {
    expect(() => generateSeriesOccurrences("2026-07-18 20:00", null)).toThrow(/no time zone/i);
    expect(() => generateSeriesOccurrences("2026-07-18 20:00", "  ")).toThrow(/no time zone/i);
  });

  it("throws a helpful error for an invalid zone and names it", () => {
    expect(() => generateSeriesOccurrences("2026-07-18 20:00", "Mars/Olympus")).toThrow(
      /Mars\/Olympus.*IANA/s
    );
    expect(() => generateSeriesOccurrences("2026-07-18 20:00", "-05:00")).toThrow(/not a valid time zone/);
  });
});

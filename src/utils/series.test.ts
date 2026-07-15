import { describe, it, expect } from "vitest";
import { getUpcomingSeriesDates } from "./series";

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
    expect(dates.map((d) => d.toString())).toEqual([
      "2026-11-07T20:00:00",
      "2026-11-14T20:00:00",
    ]);
  });
});

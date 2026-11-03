import { expect, it } from "vitest";
import "temporal-polyfill/global";
import {
  danceNightOf,
  defaultWeekStart,
  formatWeekRange,
  itineraryTimeZone,
  startTimeLabel,
  weekBounds,
  weekStartFor,
} from "./week";

const NY = "America/New_York",
  LA = "America/Los_Angeles";
it("assigns after-midnight starts to the previous night", () => {
  expect(danceNightOf("2026-11-15T05:30:00Z", NY).toString()).toBe("2026-11-14"); // Sun 00:30 → Sat
  expect(danceNightOf("2026-11-16T06:00:00Z", NY).toString()).toBe("2026-11-15"); // Mon 01:00 → Sun
  expect(danceNightOf("2026-11-14T10:00:00Z", NY).toString()).toBe("2026-11-14"); // 05:00 exactly → same day
});
it("uses the wall-clock cutoff across DST transitions", () => {
  expect(danceNightOf("2027-03-14T08:30:00Z", NY).toString()).toBe("2027-03-13"); // 04:30 EDT
  expect(danceNightOf("2027-03-14T09:00:00Z", NY).toString()).toBe("2027-03-14"); // 05:00 EDT
  expect(danceNightOf("2027-03-14T09:30:00Z", NY).toString()).toBe("2027-03-14"); // 05:30 EDT
  expect(danceNightOf("2026-11-01T09:30:00Z", NY).toString()).toBe("2026-10-31"); // 04:30 EST
  expect(danceNightOf("2026-11-01T10:00:00Z", NY).toString()).toBe("2026-11-01"); // 05:00 EST
});
it("bounds the week from Monday 05:00 to Monday 05:00 across DST", () => {
  expect(weekBounds("2026-11-09", NY)).toEqual({ startISO: "2026-11-09T10:00:00Z", endISO: "2026-11-16T10:00:00Z" });
  expect(weekBounds("2026-10-26", NY)).toEqual({ startISO: "2026-10-26T09:00:00Z", endISO: "2026-11-02T10:00:00Z" });
  expect(weekBounds("2027-03-08", LA)).toEqual({ startISO: "2027-03-08T13:00:00Z", endISO: "2027-03-15T12:00:00Z" });
});
it("defaults to the upcoming Monday", () => {
  expect(defaultWeekStart(Temporal.Instant.from("2026-11-03T17:00:00Z"), NY)).toBe("2026-11-09");
  expect(defaultWeekStart(Temporal.Instant.from("2026-11-09T15:00:00Z"), NY)).toBe("2026-11-16");
  expect(defaultWeekStart(Temporal.Instant.from("2026-11-09T07:00:00Z"), NY)).toBe("2026-11-09"); // Mon 02:00 is still Sunday night
});
it("normalizes any date to its Monday", () => {
  expect(weekStartFor("2026-11-11")).toBe("2026-11-09");
  expect(weekStartFor("2026-11-15")).toBe("2026-11-09");
  expect(weekStartFor("not-a-date")).toBe("");
});
it("labels times honestly", () => {
  expect(startTimeLabel("2026-11-14T02:00:00Z", NY)).toBe("9 PM");
  expect(startTimeLabel("2026-11-15T05:30:00Z", NY)).toBe("12:30 AM (Sun)");
});
it("formats week ranges", () => {
  expect(formatWeekRange("2026-11-09")).toBe("Nov 9–15");
  expect(formatWeekRange("2026-11-30")).toBe("Nov 30 – Dec 6");
});
it("falls back to the platform zone for unknown metros", () => {
  expect(itineraryTimeZone("los-angeles")).toBe(LA);
  expect(itineraryTimeZone("nowhere")).toBe("America/New_York");
});

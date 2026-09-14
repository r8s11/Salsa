import "temporal-polyfill/global";
import { describe, expect, it } from "vitest";
import type { ScheduleXEvent } from "../../events/model/types";
import { sortCalendarEvents } from "./calendarEvents";
function makeEvent(eventId: string, start: string, title?: string): ScheduleXEvent {
  return {
    id: eventId,
    title: title ?? eventId,
    start,
    end: start,
    calendarId: "social",
  };
}

describe("sortCalendarEvents", () => {
  it("places an earlier date before a later date", () => {
    const result = sortCalendarEvents([
      makeEvent("later", "2026-09-16 19:00"),
      makeEvent("earlier", "2026-09-15 19:00"),
    ]);

    expect(result.map(({ id }) => id)).toEqual(["earlier", "later"]);
  });

  it("places earlier start time first on the same date", () => {
    const result = sortCalendarEvents([
      makeEvent("late", "2026-09-15 21:00"),
      makeEvent("early", "2026-09-15 19:00"),
    ]);

    expect(result.map(({ id }) => id)).toEqual(["early", "late"]);
  });

  it("uses title and id as deterministic tie-breakers", () => {
    const result = sortCalendarEvents([
      makeEvent("b", "2026-09-15 19:00", "Same title"),
      makeEvent("a", "2026-09-15 19:00", "Same title"),
      makeEvent("z", "2026-09-15 19:00", "Earlier title"),
    ]);

    expect(result.map(({ id }) => id)).toEqual(["z", "a", "b"]);
  });

  it("does not depend on input array order", () => {
    const first = sortCalendarEvents([
      makeEvent("3", "2026-09-18 20:00"),
      makeEvent("1", "2026-09-15 20:00"),
      makeEvent("2", "2026-09-16 20:00"),
    ]);
    const second = sortCalendarEvents([
      makeEvent("2", "2026-09-16 20:00"),
      makeEvent("3", "2026-09-18 20:00"),
      makeEvent("1", "2026-09-15 20:00"),
    ]);

    expect(second.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
  });

  it("places missing or invalid times after valid events", () => {
    const result = sortCalendarEvents([
      makeEvent("invalid", "not-a-date"),
      makeEvent("missing", ""),
      makeEvent("valid", "2026-09-15 19:00"),
    ]);

    expect(result[0]?.id).toBe("valid");
    expect(result.slice(1).map(({ id }) => id)).toEqual(["invalid", "missing"]);
  });
});

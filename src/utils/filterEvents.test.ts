import { describe, it, expect } from "vitest";
import { filterEventsByType } from "./filterEvents";
import { ScheduleXEvent } from "../types/events";

const make = (id: number, calendarId: ScheduleXEvent["calendarId"]): ScheduleXEvent => ({
  id,
  title: `Event ${id}`,
  start: "2026-07-18 20:00",
  end: "2026-07-18 22:00",
  calendarId,
});

const events = [make(1, "social"), make(2, "class"), make(3, "workshop"), make(4, "social")];

describe("filterEventsByType", () => {
  it("returns all events for the 'all' filter", () => {
    expect(filterEventsByType(events, "all")).toHaveLength(4);
  });

  it("returns only matching events for a specific type", () => {
    const socials = filterEventsByType(events, "social");
    expect(socials.map((e) => e.id)).toEqual([1, 4]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterEventsByType([make(1, "class")], "workshop")).toEqual([]);
  });
});

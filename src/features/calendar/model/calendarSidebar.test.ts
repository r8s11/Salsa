import { describe, expect, it } from "vitest";
import "temporal-polyfill/global";
import {
  calendarPeriodRange,
  formatPeriodLabel,
  countEventsByType,
  availableDanceStyles,
  filterEventsByDanceStyle,
  countEventsInRange,
  eventCountLabel,
} from "./calendarSidebar";
import { ScheduleXEvent } from "../../events/model/types";

function makeEvent(overrides: Partial<ScheduleXEvent>): ScheduleXEvent {
  return {
    id: "e1",
    title: "Event",
    start: "2026-09-03 20:00",
    end: "2026-09-03 23:00",
    calendarId: "social",
    ...overrides,
  };
}

describe("calendarPeriodRange", () => {
  const today = Temporal.PlainDate.from("2026-09-03"); // Thursday

  it("returns the first and last day of the month for month-grid", () => {
    const visibleDate = Temporal.PlainDate.from("2026-09-15");
    const range = calendarPeriodRange(visibleDate, "month-grid", today);
    expect(range.start.toString()).toBe("2026-09-01");
    expect(range.end.toString()).toBe("2026-09-30");
  });

  it("returns Monday through Sunday of the visible week", () => {
    const visibleDate = Temporal.PlainDate.from("2026-09-03"); // Thursday
    const range = calendarPeriodRange(visibleDate, "week", today);
    expect(range.start.toString()).toBe("2026-08-31"); // Monday
    expect(range.end.toString()).toBe("2026-09-06"); // Sunday
  });

  it("returns today through 6 days out for list view", () => {
    const range = calendarPeriodRange(today, "list", today);
    expect(range.start.toString()).toBe("2026-09-03");
    expect(range.end.toString()).toBe("2026-09-09");
  });
});

describe("formatPeriodLabel", () => {
  it("formats a cross-month range", () => {
    const range = {
      start: Temporal.PlainDate.from("2026-08-31"),
      end: Temporal.PlainDate.from("2026-09-06"),
    };
    expect(formatPeriodLabel(range)).toBe("Aug 31 – Sep 6, 2026");
  });

  it("formats a same-month range without repeating the month", () => {
    const range = {
      start: Temporal.PlainDate.from("2026-09-01"),
      end: Temporal.PlainDate.from("2026-09-30"),
    };
    expect(formatPeriodLabel(range)).toBe("Sep 1 – 30, 2026");
  });
});

describe("countEventsByType", () => {
  it("tallies events per calendar type", () => {
    const events = [
      makeEvent({ id: "1", calendarId: "social" }),
      makeEvent({ id: "2", calendarId: "social" }),
      makeEvent({ id: "3", calendarId: "class" }),
    ];
    expect(countEventsByType(events)).toEqual({ social: 2, class: 1, workshop: 0 });
  });
});

describe("availableDanceStyles", () => {
  it("returns a deduped, sorted union of dance styles", () => {
    const events = [
      makeEvent({ id: "1", danceStyles: ["Salsa", "Bachata"] }),
      makeEvent({ id: "2", danceStyles: ["Bachata", "Kizomba"] }),
      makeEvent({ id: "3" }),
    ];
    expect(availableDanceStyles(events)).toEqual(["Bachata", "Kizomba", "Salsa"]);
  });
});

describe("filterEventsByDanceStyle", () => {
  const events = [
    makeEvent({ id: "1", danceStyles: ["Salsa"] }),
    makeEvent({ id: "2", danceStyles: ["Bachata"] }),
  ];

  it("passes through all events for 'all'", () => {
    expect(filterEventsByDanceStyle(events, "all")).toEqual(events);
  });

  it("keeps only events with the exact style", () => {
    expect(filterEventsByDanceStyle(events, "Salsa")).toEqual([events[0]]);
  });
});

describe("countEventsInRange", () => {
  it("counts events whose start date falls within the inclusive range", () => {
    const events = [
      makeEvent({ id: "1", start: "2026-09-03 20:00" }),
      makeEvent({ id: "2", start: "2026-09-09 20:00" }),
      makeEvent({ id: "3", start: "2026-09-10 20:00" }),
    ];
    const count = countEventsInRange(
      events,
      Temporal.PlainDate.from("2026-09-03"),
      Temporal.PlainDate.from("2026-09-09")
    );
    expect(count).toBe(2);
  });
});

describe("eventCountLabel", () => {
  it("pluralizes correctly", () => {
    expect(eventCountLabel(0)).toBe("0 events this week");
    expect(eventCountLabel(1)).toBe("1 event this week");
    expect(eventCountLabel(2)).toBe("2 events this week");
  });
});

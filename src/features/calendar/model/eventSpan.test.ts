import { describe, expect, it } from "vitest";
import "temporal-polyfill/global";
import { clampEndToStartDay } from "./eventSpan";

describe("clampEndToStartDay", () => {
  it("clamps an overnight event to the last minute of its start day", () => {
    const start = Temporal.PlainDateTime.from("2026-03-14T21:00");
    const end = Temporal.PlainDateTime.from("2026-03-15T02:00");
    expect(clampEndToStartDay(start, end).toString()).toBe("2026-03-14T23:59:00");
  });

  it("keeps an event that ends at midnight on the start day", () => {
    const start = Temporal.PlainDateTime.from("2026-03-14T21:00");
    const end = Temporal.PlainDateTime.from("2026-03-15T00:00");
    expect(clampEndToStartDay(start, end).toString()).toBe("2026-03-14T23:59:00");
  });

  it("leaves same-day events untouched", () => {
    const start = Temporal.PlainDateTime.from("2026-03-14T19:00");
    const end = Temporal.PlainDateTime.from("2026-03-14T23:00");
    expect(clampEndToStartDay(start, end)).toEqual(end);
  });
});

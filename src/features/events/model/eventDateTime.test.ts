import "temporal-polyfill/global";
import { describe, it, expect } from "vitest";
import { toEventDateInstant, fromEventDateInstant } from "./eventDateTime";

describe("toEventDateInstant", () => {
  it("converts a New York wall-clock time in EDT (UTC-4) to a UTC instant", () => {
    expect(toEventDateInstant("2026-08-17", "20:00")).toBe("2026-08-18T00:00:00Z");
  });

  it("converts a New York wall-clock time in EST (UTC-5) to a UTC instant", () => {
    expect(toEventDateInstant("2026-01-17", "20:00")).toBe("2026-01-18T01:00:00Z");
  });

  it("anchors an empty time to New York midnight rather than a bare timezone-less string", () => {
    expect(toEventDateInstant("2026-01-17", "")).toBe("2026-01-17T05:00:00Z");
  });
});

describe("fromEventDateInstant", () => {
  it("converts a UTC instant back to its New York wall-clock date and time", () => {
    expect(fromEventDateInstant("2026-08-18T00:00:00Z")).toEqual({
      date: "2026-08-17",
      time: "20:00",
    });
  });

  it("round-trips a no-time event without shifting its date", () => {
    const instant = toEventDateInstant("2026-01-17", "");
    expect(fromEventDateInstant(instant).date).toBe("2026-01-17");
  });
});

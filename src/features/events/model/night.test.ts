import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNewYorkToday } from "../hooks/useNewYorkToday";
import { nightOf } from "./night";

describe("nightOf", () => {
  it("calls an evening start on today's date tonight, and a daytime one today", () => {
    expect(nightOf("2026-09-24 21:00", "2026-09-24")).toEqual({ kind: "tonight" });
    expect(nightOf("2026-09-24 17:00", "2026-09-24")).toEqual({ kind: "tonight" });
    expect(nightOf("2026-09-24 16:59", "2026-09-24")).toEqual({ kind: "today" });
  });

  it("names any other date as weekday, day and short month", () => {
    expect(nightOf("2026-09-26 21:00", "2026-09-24")).toEqual({
      kind: "later",
      date: "2026-09-26",
      label: "Sat 26 Sep",
    });
    // Just past midnight belongs to the next date, not to tonight.
    expect(nightOf("2026-09-25 00:30", "2026-09-24")).toMatchObject({ kind: "later", label: "Fri 25 Sep" });
  });
});

describe("useNewYorkToday", () => {
  afterEach(() => vi.useRealTimers());

  it("uses New York's date, not UTC's, and rolls over at New York midnight", () => {
    vi.useFakeTimers();
    // 02:00 UTC on the 25th is 22:00 EDT on the 24th.
    vi.setSystemTime(new Date("2026-09-25T02:00:00Z"));
    const { result } = renderHook(() => useNewYorkToday());
    expect(result.current).toBe("2026-09-24");

    // New York midnight is 04:00 UTC; one second after it the date turns.
    act(() => void vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 1000));
    expect(result.current).toBe("2026-09-25");
  });
});

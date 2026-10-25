import { useState, type PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ScheduleXEvent } from "../../../types/events";
import { useEventDeepLink } from "./useEventDeepLink";

const events: ScheduleXEvent[] = [
  { id: "first", title: "First night", start: "2026-10-02 20:00", end: "2026-10-03 00:00", calendarId: "social" },
  { id: "second", title: "Second night", start: "2026-10-03 20:00", end: "2026-10-04 00:00", calendarId: "social" },
];

function wrapper({ children }: PropsWithChildren) {
  return <MemoryRouter initialEntries={["/calendar?event=first"]}>{children}</MemoryRouter>;
}

function useDeepLinkHarness(rows: ScheduleXEvent[]) {
  const [opened, setOpened] = useState<ScheduleXEvent | null>(null);
  const [, setSearchParams] = useSearchParams();
  useEventDeepLink(rows, setOpened);
  return { opened, setOpened, setSearchParams };
}

describe("calendar event deep links", () => {
  it("opens a new requested event without remounting the calendar", () => {
    const { result } = renderHook(() => useDeepLinkHarness(events), { wrapper });
    expect(result.current.opened?.id).toBe("first");
    act(() => result.current.setSearchParams({ event: "second" }));
    expect(result.current.opened?.id).toBe("second");
  });

  it("does not reopen a dismissed event on feed refresh but honors a new URL request for it", () => {
    const { result, rerender } = renderHook(({ rows }) => useDeepLinkHarness(rows), {
      initialProps: { rows: events }, wrapper,
    });
    act(() => result.current.setOpened(null));
    rerender({ rows: [...events] });
    expect(result.current.opened).toBeNull();
    act(() => result.current.setSearchParams({}));
    act(() => result.current.setSearchParams({ event: "first" }));
    expect(result.current.opened?.id).toBe("first");
  });

  it("waits for a requested event to arrive instead of consuming an unmatched request", () => {
    const { result, rerender } = renderHook(({ rows }) => useDeepLinkHarness(rows), {
      initialProps: { rows: [] as ScheduleXEvent[] }, wrapper,
    });
    expect(result.current.opened).toBeNull();
    rerender({ rows: [events[1]] });
    expect(result.current.opened).toBeNull();
    rerender({ rows: events });
    expect(result.current.opened?.id).toBe("first");
  });
});

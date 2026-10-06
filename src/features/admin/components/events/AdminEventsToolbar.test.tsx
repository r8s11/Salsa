import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { EventFilters } from "../../model/eventsQuery";
import AdminEventsToolbar from "./AdminEventsToolbar";

const noFilters: EventFilters = {
  q: "",
  from: null,
  to: null,
  status: [],
  organizer: null,
  venue: null,
  city: null,
  style: null,
  source: null,
  incompleteOnly: false,
  submitter: null,
};

function toolbar(filters: EventFilters, onFiltersChange = vi.fn()) {
  return (
    <AdminEventsToolbar
      filters={filters}
      onFiltersChange={onFiltersChange}
      sort={{ key: "event_date", dir: "asc" }}
      onSortChange={vi.fn()}
      drawerFilterCount={0}
      onOpenDrawer={vi.fn()}
    />
  );
}

describe("AdminEventsToolbar date presets", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 21:30 on 5 Oct in New York is already 6 Oct in UTC.
    vi.setSystemTime(new Date("2026-10-06T01:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("resolves Today in the calendar's zone, not UTC", () => {
    const onFiltersChange = vi.fn();
    render(toolbar(noFilters, onFiltersChange));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "today" } });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-10-05", to: "2026-10-05" })
    );
  });

  it("shows the preset the filters actually describe", () => {
    render(toolbar({ ...noFilters, from: "2026-10-05", to: "2026-10-12" }));
    expect(screen.getByLabelText("Date")).toHaveValue("next7");
  });

  it("returns to Any date when the dates are removed elsewhere", () => {
    const { rerender } = render(toolbar({ ...noFilters, from: "2026-10-05", to: "2026-10-12" }));
    expect(screen.getByLabelText("Date")).toHaveValue("next7");
    rerender(toolbar(noFilters));
    expect(screen.getByLabelText("Date")).toHaveValue("any");
  });

  it("keeps the custom range inputs open while no date is chosen yet", () => {
    render(toolbar(noFilters));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "custom" } });
    expect(screen.getByLabelText("From date")).toBeInTheDocument();
  });

  it("treats arbitrary dates as Custom", () => {
    render(toolbar({ ...noFilters, from: "2026-01-01", to: "2026-01-09" }));
    expect(screen.getByLabelText("Date")).toHaveValue("custom");
  });
});

describe("AdminEventsToolbar sort direction", () => {
  it("names the action, not just the state", () => {
    render(toolbar(noFilters));
    expect(
      screen.getByRole("button", { name: "Sorted ascending. Switch to descending" })
    ).toBeInTheDocument();
  });
});

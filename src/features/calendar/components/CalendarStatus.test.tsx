import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";
import CalendarStatus from "./CalendarStatus";

function renderStatus(props: Partial<ComponentProps<typeof CalendarStatus>> = {}) {
  const onRetry = vi.fn();
  const onClearFilter = vi.fn();
  render(
    <MemoryRouter>
      <CalendarStatus
        loading={false}
        error={null}
        isEmpty={false}
        hasNoMatches={false}
        cityLabel="Boston"
        onRetry={onRetry}
        onClearFilter={onClearFilter}
        {...props}
      />
    </MemoryRouter>
  );
  return { onRetry, onClearFilter };
}

describe("CalendarStatus", () => {
  it("uses loading state before every other status", () => {
    renderStatus({ loading: true, error: "Unavailable", isEmpty: true, hasNoMatches: true });

    expect(screen.getByRole("status")).toHaveTextContent("Loading events…");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders an error and retries", () => {
    const { onRetry } = renderStatus({ error: "Unavailable" });

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load events: Unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders the overall empty state with its submit link", () => {
    renderStatus({ isEmpty: true, cityLabel: "NYC" });

    expect(screen.getByRole("status")).toHaveTextContent("No upcoming events in NYC yet.");
    expect(screen.getByRole("link", { name: "Submit an Event" })).toHaveAttribute(
      "href",
      "/submit"
    );
  });

  it("renders filtered empty state and clears the filter", () => {
    const { onClearFilter } = renderStatus({ hasNoMatches: true });

    expect(screen.getByRole("status")).toHaveTextContent("No events match this filter.");
    expect(screen.queryByRole("link", { name: "Submit an Event" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all events" }));
    expect(onClearFilter).toHaveBeenCalledOnce();
  });
});

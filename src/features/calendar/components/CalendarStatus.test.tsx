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
        loadFailed={false}
        retrying={false}
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
  it("uses loading state before the empty and filtered states", () => {
    renderStatus({ loading: true, isEmpty: true, hasNoMatches: true });

    expect(screen.getByRole("status")).toHaveTextContent("Loading events…");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a failed load on screen through a retry without requesting twice", () => {
    const { onRetry } = renderStatus({ loadFailed: true, loading: true, retrying: true });

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load Boston's listings.");
    expect(screen.queryByText("Loading events…")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again|Trying again/ }));
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("retries a failed load", () => {
    const { onRetry } = renderStatus({ loadFailed: true });

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders filtered empty state and clears the filter", () => {
    const { onClearFilter } = renderStatus({ hasNoMatches: true });

    expect(screen.getByRole("status")).toHaveTextContent("No events match this filter.");
    fireEvent.click(screen.getByRole("button", { name: "Show all events" }));
    expect(onClearFilter).toHaveBeenCalledOnce();
  });
});

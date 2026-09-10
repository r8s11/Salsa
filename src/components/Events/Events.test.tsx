import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleXEvent } from "../../types/events";
import Events from "./Events";

const events: ScheduleXEvent[] = [
  {
    id: "featured",
    title: "Featured Social",
    start: "2099-01-01 20:00",
    end: "2099-01-01 23:00",
    calendarId: "social",
  },
  {
    id: "homepage-event",
    title: "Homepage Social",
    start: "2099-01-02 20:00",
    end: "2099-01-02 23:00",
    calendarId: "social",
  },
];

vi.mock("../../hooks/useEvent", () => ({
  useEvents: () => ({ events, loading: false, error: null }),
}));
vi.mock("../EventModal/EventModal", () => ({
  default: function MockEventModal({
    event,
    onClose,
  }: {
    event: ScheduleXEvent | null;
    onClose: () => void;
  }) {
    return event ? (
      <div role="dialog">
        <p>{event.title}</p>
        <button type="button" onClick={onClose}>
          Close event details
        </button>
      </div>
    ) : null;
  },
}));

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe("Events homepage modal", () => {
  it("opens and closes event details without leaving the homepage", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LocationProbe />
        <Events />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /Homepage Social/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Homepage Social");
    expect(screen.getByTestId("location")).toHaveTextContent("/");

    await user.click(screen.getByRole("button", { name: "Close event details" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });
});

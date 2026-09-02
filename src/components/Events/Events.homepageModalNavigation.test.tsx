import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleXEvent } from "../../types/events";
import Events from "./Events";

// Deliberately does NOT mock EventModal — this test exercises the real
// component to prove the homepage → EventModal → "Full details" → event
// detail route contract holds end to end (P2 Phase 2: EventModal must never
// special-case its origin; the homepage is not allowed a different Full
// Details behavior than any other caller).
vi.mock("../../hooks/useEvent", () => ({
  useEvents: () => ({ events, loading: false, error: null }),
}));

const events: ScheduleXEvent[] = [
  {
    id: "homepage-event",
    title: "Homepage Social",
    start: "2099-01-02 20:00",
    end: "2099-01-02 23:00",
    calendarId: "social",
  },
];

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe("Events homepage → EventModal Full Details navigation", () => {
  it("renders Full details as a real link to /events/:id and navigates there on click", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LocationProbe />
        <Routes>
          <Route path="/" element={<Events />} />
          <Route path="/events/:id" element={<p>Event detail page</p>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /Homepage Social/i }));

    const detailsLink = screen.getAllByRole("link", { name: "Full details" })[0];
    expect(detailsLink).toHaveAttribute("href", "/events/homepage-event");

    await user.click(detailsLink);

    expect(screen.getByTestId("location")).toHaveTextContent("/events/homepage-event");
    expect(screen.getByText("Event detail page")).toBeInTheDocument();
    // The modal itself is gone — navigation, not a same-page close.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

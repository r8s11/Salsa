import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleXEvent } from "../../types/events";
import Events from "./Events";

let mockedEvents: ScheduleXEvent[] = [
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

type FeedState = { loading: boolean; fetching: boolean; error: string | null; loadFailed: boolean };
const loadedFeed: FeedState = { loading: false, fetching: false, error: null, loadFailed: false };
let mockedFeed: FeedState = loadedFeed;
const refetch = vi.fn();

vi.mock("../../features/events/hooks/useEvent", () => ({
  useEvents: () => ({ events: mockedEvents, refetch, ...mockedFeed }),
}));

vi.mock("../../contexts/useCity", () => ({
  useCity: () => ({ city: "boston" }),
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

  it("says there is nothing tonight and names the next night when the featured event is later", () => {
    render(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );

    // The featured event is on 1 Jan 2099, not tonight.
    expect(
      screen.getByRole("heading", { name: "Nothing on the floor tonight in Greater Boston." })
    ).toBeInTheDocument();
    expect(screen.getByText(/^Next up ·/)).toHaveTextContent(/Next up · \w{3} 1 Jan/);
    expect(screen.queryByText("Featured Tonight")).not.toBeInTheDocument();
  });

  it("turns an empty city feed into clear next steps", () => {
    mockedEvents = [];
    render(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Nothing on the floor in Greater Boston yet." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Full Calendar" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "Submit an Event" })).toHaveAttribute("href", "/submit");
  });

  it("names the city on a failed load, keeps the raw error out of the page, and retries in place", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedEvents = [];
    mockedFeed = { ...loadedFeed, error: "relation public_events does not exist", loadFailed: true };
    const user = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load Greater Boston's listings.");
    expect(alert).not.toHaveTextContent("relation public_events");
    expect(warn).toHaveBeenCalledWith(expect.any(String), "relation public_events does not exist");
    expect(screen.getByRole("link", { name: "View Full Calendar" })).toHaveAttribute("href", "/calendar");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();

    // Mid-retry the query is pending again with `error` cleared; the error
    // state must hold (busy Retry) rather than fall back to the skeleton.
    mockedFeed = { loading: true, fetching: true, error: null, loadFailed: true };
    rerender(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trying again…" })).toHaveAttribute("aria-busy", "true");

    mockedFeed = loadedFeed;
    warn.mockRestore();
  });
});

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

const nearbyMetros = [
  {
    slug: "new-york-city",
    name: "New York City",
    stateRegion: "NY",
    countryCode: "US",
    latitude: 40.7128,
    longitude: -74.006,
    upcomingEventCount: 14,
    nextEventAt: "2099-01-01T00:00:00Z",
    distanceKm: 300,
  },
];
let mockedCity: { city: string | null; source: string } = { city: "boston", source: "explicit" };
const setCity = vi.fn();

vi.mock("../../contexts/useCity", () => ({
  useCity: () => ({
    ...mockedCity,
    resolving: false,
    setCity,
    chooseNearMe: vi.fn(),
    activeMetros: nearbyMetros,
    activeMetrosError: null,
    locationStatus: "idle",
  }),
}));
vi.mock("../../features/metros/hooks/useMetros", () => ({
  useMetroName: () => (slug: string) => (slug === "boston" ? "Boston" : slug),
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
      screen.getByRole("heading", { name: "Nothing on the floor tonight in Boston." })
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

    expect(screen.getByRole("heading", { name: "Nothing on the floor in Boston yet." })).toBeInTheDocument();
    // The nearest active metro is offered as a real destination.
    expect(screen.getByRole("link", { name: /New York City\s*14 upcoming events/ })).toHaveAttribute(
      "href",
      "/events/new-york-city"
    );
    expect(screen.getByRole("button", { name: "Explore other cities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submit an event" })).toHaveAttribute("href", "/submit");
  });

  it("never renders an empty homepage when no metro is near the visitor", () => {
    mockedCity = { city: null, source: "none-nearby" };
    render(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "No SalsaSegura events near you yet." })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New York City/ })).toHaveAttribute(
      "href",
      "/events/new-york-city"
    );
    expect(screen.getByRole("button", { name: "Explore other cities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submit an event" })).toHaveAttribute("href", "/submit");
    mockedCity = { city: "boston", source: "explicit" };
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
    expect(alert).toHaveTextContent("We couldn't load Boston's listings.");
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

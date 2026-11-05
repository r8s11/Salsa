import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleXEvent } from "../../../types/events";
import Events from "./Events";
import { mockActiveLocationQuery } from "../../../test/mockMetros";

const defaultEvents: ScheduleXEvent[] = [
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
let mockedEvents = defaultEvents;

type FeedState = { loading: boolean; fetching: boolean; error: string | null; loadFailed: boolean };
const loadedFeed: FeedState = { loading: false, fetching: false, error: null, loadFailed: false };
let mockedFeed: FeedState = loadedFeed;
const refetch = vi.fn();

vi.mock("../hooks/useEvent", () => ({
  useEvents: () => ({ events: mockedEvents, refetch, ...mockedFeed }),
}));

// New York's date; null keeps today's real date (every fixture is in 2099).
let mockedToday: string | null = null;
vi.mock("../hooks/useNewYorkToday", () => ({
  useNewYorkToday: () => mockedToday ?? new Date().toISOString().slice(0, 10),
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
let mockedActiveMetros = nearbyMetros;
let mockedCity: { city: string | null; source: string } = { city: "boston", source: "explicit" };
const setCity = vi.fn();
type MetroDiscovery = { loading: boolean; fetching: boolean; error: string | null; loadFailed: boolean };
let mockedMetroDiscovery: MetroDiscovery = { loading: false, fetching: false, error: null, loadFailed: false };
const refetchActiveMetros = vi.fn(async () => undefined);

vi.mock("../../../contexts/useCity", () => ({
  useCity: () => ({
    ...mockedCity,
    resolving: false,
    setCity,
    chooseNearMe: vi.fn(),
    activeMetros: mockedActiveMetros,
    activeMetrosError: mockedMetroDiscovery.error,
    activeMetrosLoadFailed: mockedMetroDiscovery.loadFailed,
    activeMetrosLoading: mockedMetroDiscovery.loading,
    activeMetrosFetching: mockedMetroDiscovery.fetching,
    refetchActiveMetros,
    locationStatus: "idle",
  }),
}));
vi.mock("../../metros/hooks/useMetros", () => ({
  useActiveLocations: () => mockActiveLocationQuery,
  useMetroName: () => (slug: string) => (slug === "boston" ? "Boston" : slug),
}));
vi.mock("./event-modal/EventModal", () => ({
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
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockedEvents = defaultEvents.map((event) => ({ ...event }));
    mockedFeed = { ...loadedFeed };
    mockedCity = { city: "boston", source: "explicit" };
    mockedActiveMetros = nearbyMetros;
    mockedMetroDiscovery = { loading: false, fetching: false, error: null, loadFailed: false };
    mockedToday = null;
  });

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

  it("labels the upcoming feed, includes events beyond seven days, and explains filtered empty results", async () => {
    mockedEvents = [
      {
        id: "only-event",
        title: "Featured Social",
        start: "2099-01-01 20:00",
        end: "2099-01-01 23:00",
        calendarId: "social",
      },
    ];
    mockedFeed = loadedFeed;
    mockedCity = { city: "boston", source: "explicit" };
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Upcoming on the floor" })).toBeInTheDocument();
    expect(
      screen.getByText("The featured event is the only event coming up in Boston.")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Class" }));
    expect(
      screen.getByText("No additional class events in this list. Try another event type.")
    ).toBeInTheDocument();

    mockedEvents = [
      ...mockedEvents,
      {
        id: "far-future-event",
        title: "Later Social",
        start: "2099-01-20 20:00",
        end: "2099-01-20 23:00",
        calendarId: "social",
      },
    ];
    view.rerender(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("Later Social")).toBeInTheDocument();
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

  describe("spotlight", () => {
    const night = (id: string, title: string, day: string, featured?: boolean): ScheduleXEvent => ({
      id,
      title,
      start: `2099-01-${day} 20:00`,
      end: `2099-01-${day} 23:00`,
      calendarId: "social",
      featured,
    });
    const renderEvents = () =>
      render(
        <MemoryRouter>
          <Events />
        </MemoryRouter>
      ).container;

    it("spotlights the earliest featured event over the next one, which stays in the feed", () => {
      mockedEvents = [
        night("next", "Next Social", "01"),
        night("pick", "Picked Social", "03", true),
        night("later-pick", "Later Pick", "05", true),
      ];
      const container = renderEvents();

      expect(container.querySelector(".featured-card")).toHaveTextContent("Picked Social");
      // Not the next night, so it is called featured, never "Next up".
      expect(screen.getByText(/^Featured ·/)).toHaveTextContent(/Featured · \w{3} 3 Jan/);
      expect(screen.queryByText(/^Next up ·/)).not.toBeInTheDocument();
      const feed = within(container.querySelector(".events-grid") as HTMLElement);
      expect(feed.getByText("Next Social")).toBeInTheDocument();
      expect(feed.getByText("Later Pick")).toBeInTheDocument();
      expect(feed.queryByText("Picked Social")).not.toBeInTheDocument();
    });

    it("ignores a featured event that has already started and falls back to the next event", () => {
      mockedEvents = [
        { ...night("past-pick", "Past Pick", "01", true), start: "2000-01-01 20:00", end: "2000-01-01 23:00" },
        night("next", "Next Social", "02"),
      ];
      const container = renderEvents();

      expect(container.querySelector(".featured-card")).toHaveTextContent("Next Social");
      expect(screen.getByText(/^Next up ·/)).toHaveTextContent(/Next up · \w{3} 2 Jan/);
      expect(screen.queryByText("Past Pick")).not.toBeInTheDocument();
    });

    it("labels a featured event tonight as Featured Tonight", () => {
      mockedToday = "2099-01-03";
      mockedEvents = [night("pick", "Picked Social", "03", true), night("after", "After Social", "04")];
      const container = renderEvents();

      expect(screen.getByRole("heading", { name: "Featured Tonight" })).toBeInTheDocument();
      expect(container.querySelector(".featured-card")).toHaveTextContent("Picked Social");
    });

    it("never claims a quiet night when a later featured event follows one tonight", () => {
      mockedToday = "2099-01-01";
      mockedEvents = [night("tonight", "Tonight Social", "01"), night("pick", "Picked Social", "03", true)];
      const container = renderEvents();

      expect(screen.queryByText(/Nothing on the floor tonight/)).not.toBeInTheDocument();
      expect(screen.queryByText("Featured Tonight")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /^Featured · \w{3} 3 Jan$/ })).toBeInTheDocument();
      expect(container.querySelector(".featured-card")).toHaveTextContent("Picked Social");
      expect(
        within(container.querySelector(".events-grid") as HTMLElement).getByText("Tonight Social")
      ).toBeInTheDocument();
    });
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
  });

  it("keeps failed city discovery distinct from a confirmed empty inventory and retries in place", async () => {
    mockedEvents = [];
    mockedFeed = loadedFeed;
    mockedCity = { city: null, source: "none-nearby" };
    mockedActiveMetros = [];
    mockedMetroDiscovery = { loading: true, fetching: true, error: null, loadFailed: false };
    const user = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );
    expect(screen.getByRole("status")).toHaveTextContent("Checking for cities with upcoming events…");
    expect(screen.queryByRole("heading", { name: "No upcoming SalsaSegura events yet." })).not.toBeInTheDocument();

    mockedMetroDiscovery = { loading: false, fetching: false, error: "offline", loadFailed: true };
    rerender(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("City listings didn't come through.");
    expect(screen.queryByRole("heading", { name: "No SalsaSegura events near you yet." })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetchActiveMetros).toHaveBeenCalledOnce();

    mockedMetroDiscovery = { loading: true, fetching: true, error: null, loadFailed: true };
    rerender(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checking cities…" })).toBeDisabled();

    mockedMetroDiscovery = { loading: false, fetching: false, error: null, loadFailed: false };
    rerender(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "No upcoming SalsaSegura events yet." })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "No upcoming SalsaSegura events yet." })).toHaveFocus());
  });

  it.each(["loading", "loaded", "failed"] as const)(
    "focuses the feed after city discovery recovers while events are %s",
    async (eventState) => {
      mockedCity = { city: null, source: "none-nearby" };
      mockedActiveMetros = [];
      mockedMetroDiscovery = { loading: false, fetching: false, error: "offline", loadFailed: true };
      const user = userEvent.setup();
      const view = render(<MemoryRouter><Events /></MemoryRouter>);

      await user.click(screen.getByRole("button", { name: "Try again" }));
      mockedMetroDiscovery = { loading: true, fetching: true, error: null, loadFailed: true };
      view.rerender(<MemoryRouter><Events /></MemoryRouter>);

      mockedCity = { city: "boston", source: "explicit" };
      mockedActiveMetros = nearbyMetros;
      mockedMetroDiscovery = { loading: false, fetching: false, error: null, loadFailed: false };
      mockedFeed = {
        loading: eventState === "loading",
        fetching: eventState === "loading",
        error: eventState === "failed" ? "offline" : null,
        loadFailed: eventState === "failed",
      };
      view.rerender(<MemoryRouter><Events /></MemoryRouter>);

      await waitFor(() =>
        expect(screen.getByRole("heading", { name: "Upcoming on the floor" })).toHaveFocus()
      );
    }
  );

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

    expect(screen.getByRole("heading", { name: "Upcoming on the floor" })).toBeInTheDocument();
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
  });
});

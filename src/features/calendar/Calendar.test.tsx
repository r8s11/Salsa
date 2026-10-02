import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useCalendarApp } from "@schedule-x/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEventsQuery } from "../events/hooks/useEventsQuery";
import type { DatabaseEvent } from "../events/model/types";
import Calendar from "./Calendar";

const eventsService = { set: vi.fn() };
const calendarControls = { setDate: vi.fn(), setView: vi.fn() };
const useEvents = vi.fn();
const fetchApprovedEvents = vi.fn();
const setCity = vi.fn();
let city: string | null = "boston";
let compact = false;
let wide = true;
let mediaListener: ((event: MediaQueryListEvent) => void) | undefined;
let removeMediaListener = vi.fn();

vi.mock("@schedule-x/react", () => ({
  useCalendarApp: vi.fn(() => ({ calendar: true })),
  ScheduleXCalendar: () => <div data-testid="schedule-x-calendar" />,
}));
vi.mock("@schedule-x/calendar", () => ({
  createViewDay: vi.fn(),
  createViewWeek: vi.fn(),
  createViewMonthGrid: vi.fn(),
  createViewMonthAgenda: vi.fn(),
  createViewList: vi.fn(),
}));
vi.mock("@schedule-x/events-service", () => ({ createEventsServicePlugin: () => eventsService }));
vi.mock("@schedule-x/calendar-controls", () => ({
  createCalendarControlsPlugin: () => calendarControls,
}));
vi.mock("../../features/events/hooks/useEvent", () => ({ useEvents: () => useEvents() }));
vi.mock("../../features/metros/hooks/useMetros", () => import("../../test/mockMetros"));
vi.mock("../../contexts/useCity", () => ({ useCity: () => ({ city, setCity }) }));
vi.mock("../../features/calendar/hooks/useEventDeepLink", () => ({ useEventDeepLink: vi.fn() }));
vi.mock("../../shared/seo/useDocumentMeta", () => ({ useDocumentMeta: vi.fn() }));
vi.mock("../../utils/seo", () => ({
  CANONICAL_ORIGIN: "https://www.salsasegura.com",
  canonicalUrl: (path: string) => `https://www.salsasegura.com${path}`,
  generateEventsListStructuredData: vi.fn(() => ({})),
  injectStructuredData: vi.fn(),
}));
vi.mock("../events/api/eventsRepo", () => ({
  fetchApprovedEvents: (...args: unknown[]) => fetchApprovedEvents(...args),
  recordEventTouch: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./components/CalendarSubmissionDialog", () => ({ default: () => null }));

const event = {
  id: "event-1",
  title: "Boston Social",
  start: "2026-08-14 20:00",
  end: "2026-08-14 23:00",
  calendarId: "social" as const,
  location: "Dance Hall",
  priceType: "free" as const,
  danceStyles: ["Salsa"],
};

function makeFeedEvents(city: DatabaseEvent["city"] = "boston"): DatabaseEvent[] {
  return Array.from({ length: 61 }, (_, index) => ({
    id: `${city}-${index}`,
    title: `${city} Dance ${String(index).padStart(4, "0")}`,
    description: null,
    event_type: "social",
    event_date: "2026-10-03T00:00:00Z",
    event_time: null,
    location: "Dance Hall",
    address: null,
    price_type: "free",
    price_amount: null,
    rsvp_link: null,
    image_url: null,
    submitter_name: null,
    submitter_email: null,
    submitter_id: null,
    status: "approved",
    city,
    created_at: "2026-10-01T00:00:00Z",
    host: null,
    recurrence: null,
    gallery: null,
    contact_email: null,
    contact_instagram: null,
    contact_website: null,
    source_type: "user_submission",
    dance_styles: [index < 51 ? "Salsa" : "Bachata"],
    taxonomy_term_ids: [],
    taxonomy_terms: [],
    updated_at: "2026-10-01T00:00:00Z",
    cancellation_reason: null,
    venue_id: null,
  }));
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current calendar URL">{location.pathname}{location.search}</output>;
}

function renderCalendar(path = "/calendar", client?: QueryClient) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Calendar />
      <LocationProbe />
    </MemoryRouter>,
    client
      ? { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }
      : undefined
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchApprovedEvents.mockReset();
  city = "boston";
  compact = false;
  wide = true;
  mediaListener = undefined;
  removeMediaListener = vi.fn();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return query.includes("max-width") ? compact : wide;
    },
    media: query,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      if (query.includes("max-width")) mediaListener = listener;
    },
    removeEventListener: removeMediaListener,
  }));
  useEvents.mockReturnValue({ events: [event], loading: false, error: null, refetch: vi.fn() });
});

describe("Calendar", () => {
  it("keeps an expanded event reachable and restores its focus after closing details", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    const rows = makeFeedEvents();
    client.setQueryData(["events", "boston"], rows);
    useEvents.mockImplementation(function useQueryBackedEvents() {
      return useEventsQuery(city);
    });
    renderCalendar("/calendar", client);
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    fireEvent.click(screen.getByRole("button", { name: "Show more events" }));
    const opener = screen.getByRole("button", { name: /boston Dance 0050/ });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole("dialog")).toHaveTextContent("boston Dance 0050");
    expect(opener).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Close$/ }));
    await waitFor(() => expect(opener).toHaveFocus());

  });

  it("keeps the expanded row focused during and after an unchanged background refresh", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    const rows = makeFeedEvents();
    client.setQueryData(["events", "boston"], rows);
    let feed: ReturnType<typeof useEventsQuery> | undefined;
    useEvents.mockImplementation(function useQueryBackedEvents() {
      feed = useEventsQuery(city);
      return feed;
    });
    renderCalendar("/calendar", client);
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    fireEvent.click(screen.getByRole("button", { name: "Show more events" }));
    const expandedRow = screen.getByRole("button", { name: /boston Dance 0050/ });
    expect(expandedRow).toHaveFocus();

    const pending = Promise.withResolvers<DatabaseEvent[]>();
    fetchApprovedEvents.mockReturnValueOnce(pending.promise);
    let refreshing: Promise<void> | undefined;
    act(() => {
      refreshing = client.refetchQueries({ queryKey: ["events", "boston"], exact: true });
    });
    await waitFor(() => expect(feed?.fetching).toBe(true));
    expect(expandedRow).toHaveFocus();
    await act(async () => {
      pending.resolve(rows.map((row) => ({ ...row })));
      await refreshing;
    });
    expect(expandedRow).toHaveFocus();
  });

  it("resets expanded pages when the dance-style filter or city changes", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    client.setQueryData(["events", "boston"], makeFeedEvents());
    client.setQueryData(["events", "new-york-city"], makeFeedEvents("new-york-city"));
    useEvents.mockImplementation(function useQueryBackedEvents() {
      return useEventsQuery(city);
    });
    const view = renderCalendar("/calendar", client);
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    fireEvent.click(screen.getByRole("button", { name: "Show more events" }));
    expect(screen.getByRole("button", { name: /boston Dance 0050/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salsa" }));
    expect(screen.queryByRole("button", { name: /boston Dance 0050/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show more events" }));
    expect(screen.getByRole("button", { name: /boston Dance 0050/ })).toBeInTheDocument();

    city = "new-york-city";
    view.rerender(
      <MemoryRouter>
        <Calendar />
        <LocationProbe />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /new-york-city Dance 0000/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new-york-city Dance 0050/ })).not.toBeInTheDocument();
  });

  it("starts desktop Schedule-X in month grid and offers desktop view controls", () => {
    renderCalendar();
    expect(useCalendarApp).toHaveBeenCalledWith(
      expect.objectContaining({ defaultView: "month-grid" })
    );
    expect(screen.getByRole("button", { name: "Month" })).toBeInTheDocument();
    expect(screen.getByTestId("schedule-x-calendar")).toBeInTheDocument();
  });
  it("switches to flyer cards without invoking Schedule-X", () => {
    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Cards" }));
    expect(screen.getByRole("button", { name: /Boston Social/ })).toBeInTheDocument();
    expect(screen.queryByTestId("schedule-x-calendar")).not.toBeInTheDocument();
    expect(calendarControls.setView).not.toHaveBeenCalledWith("cards");

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByTestId("schedule-x-calendar")).toBeInTheDocument();
    expect(calendarControls.setView).toHaveBeenLastCalledWith("month-grid");
  });

  it("starts compact Schedule-X in list view without month or week controls", () => {
    compact = true;
    renderCalendar();
    expect(useCalendarApp).toHaveBeenCalledWith(expect.objectContaining({ defaultView: "list" }));
    expect(screen.queryByRole("button", { name: "Month" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Week" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cards" })).toBeInTheDocument();
  });

  it.each(["List", "Cards"])(
    "keeps the %s feed unbounded instead of offering ineffective date navigation",
    (view) => {
      useEvents.mockReturnValue({
        events: [
          event,
          {
            ...event,
            id: "later-event",
            title: "Later Social",
            start: "2026-11-14 20:00",
            end: "2026-11-14 23:00",
          },
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });
      renderCalendar();
      fireEvent.click(screen.getByRole("button", { name: "Next month" }));
      fireEvent.click(screen.getByRole("button", { name: view }));
      expect(screen.getByRole("button", { name: /Boston Social/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Later Social/ })).toBeInTheDocument();
      expect(
        screen.queryAllByRole("button", { name: /^(Previous|Next) (month|week)$/ })
      ).toEqual([]);
      expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Month" }));
      expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
    }
  );

  it("controls date, city, view, and type filtering", () => {
    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    fireEvent.click(screen.getByRole("button", { name: "New York City" }));
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    fireEvent.click(screen.getByRole("button", { name: "Class 0" }));
    expect(calendarControls.setDate).toHaveBeenCalledTimes(3);
    expect(setCity).toHaveBeenCalledWith("new-york-city");
    expect(calendarControls.setView).toHaveBeenCalledWith("week");
    expect(eventsService.set).toHaveBeenLastCalledWith([]);
  });

  it("clears Schedule-X for a filter with no matches and restores all events", () => {
    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Class 0" }));
    expect(eventsService.set).toHaveBeenLastCalledWith([]);
    expect(screen.getByText("No events match this filter.")).toBeInTheDocument();
    expect(screen.queryByTestId("schedule-x-calendar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all events" }));
    expect(screen.getByTestId("schedule-x-calendar")).toBeInTheDocument();
  });

  it("explains a failed load without the driver error and keeps it visible while retrying", () => {
    const refetch = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useEvents.mockReturnValue({
      events: [],
      loading: false,
      fetching: false,
      error: "relation public_events does not exist",
      loadFailed: true,
      refetch,
    });
    const { rerender } = renderCalendar();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load Boston's listings.");
    expect(alert).not.toHaveTextContent("relation public_events");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();

    useEvents.mockReturnValue({
      events: [],
      loading: true,
      fetching: true,
      error: null,
      loadFailed: true,
      refetch,
    });
    rerender(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Loading events…")).not.toBeInTheDocument();
    warn.mockRestore();
  });

  it("keeps loaded events on screen when a background refresh fails", () => {
    useEvents.mockReturnValue({
      events: [event],
      loading: false,
      fetching: false,
      error: "network down",
      loadFailed: false,
      refetch: vi.fn(),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    renderCalendar();
    expect(screen.getByTestId("schedule-x-calendar")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the overall empty state for the selected city", () => {
    useEvents.mockReturnValue({ events: [], loading: false, error: null, refetch: vi.fn() });
    renderCalendar();
    expect(screen.getByText("No upcoming events in Boston yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("schedule-x-calendar")).not.toBeInTheDocument();
  });

  it("asks for a city instead of claiming one is empty when none is selected", () => {
    city = null;
    useEvents.mockReturnValue({ events: [], loading: false, error: null, refetch: vi.fn() });
    renderCalendar();
    expect(screen.getByText("Choose a city to see its dance calendar.")).toBeInTheDocument();
    expect(screen.queryByText(/All cities/)).not.toBeInTheDocument();
  });

  it("matches search terms regardless of accents", () => {
    compact = true;
    useEvents.mockReturnValue({
      events: [
        { ...event, id: "salon", title: "Noche de Salón" },
        { ...event, id: "musica", title: "Musica en vivo" },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderCalendar();
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "salon" } });
    expect(screen.getByRole("button", { name: /Noche de Salón/ })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "música" } });
    expect(screen.getByRole("button", { name: /Musica en vivo/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Noche de Salón/ })).not.toBeInTheDocument();
  });

  it("switches views in response to media-query changes and unsubscribes", () => {
    const { unmount } = renderCalendar();
    act(() => {
      compact = true;
      mediaListener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(calendarControls.setView).toHaveBeenLastCalledWith("list");
    expect(screen.queryByRole("button", { name: "Month" })).not.toBeInTheDocument();
    act(() => {
      compact = false;
      mediaListener?.({ matches: false } as MediaQueryListEvent);
    });
    expect(calendarControls.setView).toHaveBeenLastCalledWith("month-grid");
    expect(screen.getByRole("button", { name: "Month" })).toBeInTheDocument();
    unmount();
    expect(removeMediaListener).toHaveBeenCalled();
  });

  it("honors a different valid city query once and ignores matching or invalid cities", () => {
    renderCalendar("/calendar?city=new-york-city");
    expect(setCity).toHaveBeenCalledWith("new-york-city");
    vi.clearAllMocks();
    renderCalendar("/calendar?city=boston");
    renderCalendar("/calendar?city=invalid");
    expect(setCity).not.toHaveBeenCalled();
  });
  it("renders the desktop sidebar with the What's on group and event count footer", () => {
    renderCalendar();
    expect(screen.getByRole("complementary", { name: "Calendar filters" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "What's on" })).toBeInTheDocument();
    expect(screen.getByText(/event(s)? this week/)).toBeInTheDocument();
  });

  it("preserves mobile filter selections when filters are collapsed and views change", () => {
    compact = true;
    wide = false;
    useEvents.mockReturnValue({
      events: [
        event,
        {
          ...event,
          id: "class-1",
          title: "Bachata class",
          calendarId: "class",
          danceStyles: ["Bachata"],
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderCalendar();
    const disclosure = screen.getByText("Filters").closest("details")!;
    const toggle = disclosure.querySelector("summary")!;
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Social" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Salsa" } });
    fireEvent.click(toggle);
    expect(disclosure).not.toHaveAttribute("open");
    expect(toggle).toHaveTextContent("2 active");
    fireEvent.click(screen.getByRole("button", { name: "Cards" }));
    expect(screen.getByRole("heading", { name: "Boston Social" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bachata class" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: /Boston Social/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bachata class/ })).not.toBeInTheDocument();
  });

  it("keeps tablet widths on the compact toolbar so the calendar grid keeps its width", () => {
    wide = false;
    renderCalendar();
    expect(
      screen.queryByRole("complementary", { name: "Calendar filters" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Filter by event type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Month" })).toBeInTheDocument();
  });

  it("presents event-type filtering once per layout", () => {
    renderCalendar();
    expect(screen.queryByRole("group", { name: "Filter by event type" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "What's on" })).toBeInTheDocument();
  });

  it("narrows Schedule-X events when a sidebar dance style is chosen", () => {
    const bachataEvent = {
      ...event,
      id: "event-2",
      calendarId: "class" as const,
      danceStyles: ["Bachata"],
    };
    useEvents.mockReturnValue({
      events: [event, bachataEvent],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Bachata" }));
    expect(eventsService.set).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "event-2" })])
    );
    expect(eventsService.set).toHaveBeenLastCalledWith(
      expect.not.arrayContaining([expect.objectContaining({ id: "event-1" })])
    );
    fireEvent.click(screen.getByRole("button", { name: "Salsa" }));
    expect(eventsService.set).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "event-1" })])
    );
  });

  it("drives type filtering from the desktop sidebar row", () => {
    renderCalendar();
    const socialRow = screen.getByRole("button", { name: "Social 1" });
    expect(socialRow).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Class 0" }));
    expect(screen.getByRole("button", { name: "Class 0" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Social 1" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(eventsService.set).toHaveBeenLastCalledWith([]);
  });

  it("preserves the filtered collection while switching List and Cards", () => {
    const bachataEvent = {
      ...event,
      id: "event-2",
      title: "NYC Bachata",
      danceStyles: ["Bachata"],
    };
    useEvents.mockReturnValue({
      events: [event, bachataEvent],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Salsa" }));
    fireEvent.click(screen.getByRole("button", { name: "Cards" }));
    expect(screen.getByRole("heading", { name: "Boston Social" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "NYC Bachata" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: /Boston Social/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /NYC Bachata/ })).not.toBeInTheDocument();
  });

  it("opens a recurring grid occurrence with its own date and canonical detail link", () => {
    useEvents.mockReturnValue({
      events: [{ ...event, recurrence: "weekly" }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderCalendar();
    const occurrence = eventsService.set.mock.calls[eventsService.set.mock.calls.length - 1][0].find(
      (item: { id: string }) => item.id === "event-1-w1"
    );
    act(() => {
      vi.mocked(useCalendarApp).mock.calls[vi.mocked(useCalendarApp).mock.calls.length - 1][0].callbacks!.onEventClick!(occurrence, new MouseEvent("click"));
    });

    expect(screen.getByRole("dialog")).toHaveTextContent("Friday, August 21");
    const fullLinks = screen.getAllByRole("link", { name: "Full details" });
    expect(fullLinks.length).toBeGreaterThanOrEqual(1);
    expect(fullLinks[0]).toHaveAttribute("href", "/events/event-1");
  });

  it("removes only the event query when closing details", () => {
    compact = true;
    renderCalendar("/calendar?city=boston&event=event-1&source=shared");
    fireEvent.click(screen.getByRole("button", { name: /Boston Social/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Close$/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Current calendar URL")).toHaveTextContent(
      "/calendar?city=boston&source=shared"
    );
  });
});

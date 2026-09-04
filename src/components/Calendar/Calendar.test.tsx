import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCalendarApp } from "@schedule-x/react";
import Calendar from "./Calendar";

const eventsService = { set: vi.fn() };
const calendarControls = { setDate: vi.fn(), setView: vi.fn() };
const useEvents = vi.fn();
const setCity = vi.fn();
let city = "boston";
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
vi.mock("../../hooks/useEvent", () => ({ useEvents: () => useEvents() }));
vi.mock("../../contexts/useCity", () => ({ useCity: () => ({ city, setCity }) }));
vi.mock("../../features/calendar/hooks/useEventDeepLink", () => ({ useEventDeepLink: vi.fn() }));
vi.mock("../../features/calendar/hooks/useEscapeKey", () => ({ useEscapeKey: vi.fn() }));
vi.mock("../../shared/seo/useDocumentMeta", () => ({ useDocumentMeta: vi.fn() }));
vi.mock("../../utils/seo", () => ({
  generateEventsListStructuredData: vi.fn(() => ({})),
  injectStructuredData: vi.fn(),
}));
vi.mock("../EventModal/EventModal", () => ({ default: () => null }));

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

function renderCalendar(path = "/calendar") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Calendar />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
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
  it("starts desktop Schedule-X in month grid and offers desktop view controls", () => {
    renderCalendar();
    expect(useCalendarApp).toHaveBeenCalledWith(
      expect.objectContaining({ defaultView: "month-grid" })
    );
    expect(screen.getByRole("button", { name: "Month" })).toBeInTheDocument();
    expect(screen.getByTestId("schedule-x-calendar")).toBeInTheDocument();
  });

  it("starts compact Schedule-X in list view without month or week controls", () => {
    compact = true;
    renderCalendar();
    expect(useCalendarApp).toHaveBeenCalledWith(expect.objectContaining({ defaultView: "list" }));
    expect(screen.queryByRole("button", { name: "Month" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Week" })).not.toBeInTheDocument();
  });

  it("controls date, city, view, and type filtering", () => {
    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    fireEvent.click(screen.getByRole("button", { name: "NYC" }));
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    fireEvent.click(screen.getByRole("button", { name: "Class 0" }));
    expect(calendarControls.setDate).toHaveBeenCalledTimes(3);
    expect(setCity).toHaveBeenCalledWith("new-york-city");
    expect(calendarControls.setView).toHaveBeenCalledWith("week");
    expect(eventsService.set).toHaveBeenLastCalledWith([]);
  });

  it("clears Schedule-X and keeps the submit CTA for a filter with no matches", () => {
    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Class 0" }));
    expect(eventsService.set).toHaveBeenLastCalledWith([]);
    expect(screen.getByText("No events match this filter.")).toBeInTheDocument();
    expect(screen.queryByTestId("schedule-x-calendar")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submit an Event" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all events" }));
    expect(screen.getByTestId("schedule-x-calendar")).toBeInTheDocument();
  });

  it("retries failed requests and renders the overall empty state", () => {
    const refetch = vi.fn();
    useEvents.mockReturnValue({ events: [], loading: false, error: "Unavailable", refetch });
    const { rerender } = renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
    useEvents.mockReturnValue({ events: [], loading: false, error: null, refetch });
    rerender(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );
    expect(screen.getByText("No upcoming events in Boston yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submit an Event" })).toBeInTheDocument();
    expect(screen.queryByTestId("schedule-x-calendar")).not.toBeInTheDocument();
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

  it("hides the sidebar on compact layouts, leaving the toolbar pills as the only filter", () => {
    compact = true;
    wide = false;
    renderCalendar();
    expect(
      screen.queryByRole("complementary", { name: "Calendar filters" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Filter by event type" })).toBeInTheDocument();
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
    const bachataEvent = { ...event, id: "event-2", calendarId: "class" as const, danceStyles: ["Bachata"] };
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
    expect(socialRow).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Class 0" }));
    expect(screen.getByRole("button", { name: "Class 0" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Social 1" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(eventsService.set).toHaveBeenLastCalledWith([]);
  });
});

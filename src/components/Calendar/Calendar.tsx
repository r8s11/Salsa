import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  createViewMonthAgenda,
  createViewList,
} from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { createCalendarControlsPlugin } from "@schedule-x/calendar-controls";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import "temporal-polyfill/global";
import "./Calendar.css";
import "@schedule-x/theme-default/dist/index.css";
import { ScheduleXEvent, CALENDARS_CONFIG, City } from "../../types/events";
import { filterEventsByType, TypeFilter } from "../../utils/filterEvents";
import { getUpcomingSeriesDates } from "../../utils/series";
import { useCity } from "../../contexts/useCity";
import EventModal from "../EventModal/EventModal";
import { useEvents } from "../../hooks/useEvent";
import { generateEventsListStructuredData, injectStructuredData } from "../../utils/seo";
import { useDocumentMeta } from "../../shared/seo/useDocumentMeta";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import { useEventDeepLink } from "../../features/calendar/hooks/useEventDeepLink";
import CalendarLegend from "../../features/calendar/components/CalendarLegend";
import CalendarStatus from "../../features/calendar/components/CalendarStatus";

type CalendarView = "month-grid" | "week" | "list";

const CITY_OPTIONS: { value: City; label: string }[] = [
  { value: "boston", label: "Boston" },
  { value: "new-york-city", label: "NYC" },
];

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "month-grid", label: "Month" },
  { value: "week", label: "Week" },
  { value: "list", label: "List" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "social", label: "Social" },
  { value: "class", label: "Class" },
  { value: "workshop", label: "Workshop" },
];

export default function Calendar() {
  const [initialCompact] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [isCompact, setIsCompact] = useState(initialCompact);
  const [activeView, setActiveView] = useState<CalendarView>(
    initialCompact ? "list" : "month-grid"
  );
  const [visibleDate, setVisibleDate] = useState<Temporal.PlainDate>(() =>
    Temporal.Now.plainDateISO()
  );
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { city, setCity } = useCity();
  const { events: eventList, loading, error, refetch } = useEvents();

  useEffect(() => {
    document.body.classList.add("calendar-page-open");
    return () => document.body.classList.remove("calendar-page-open");
  }, []);
  const eventListRef = useRef(eventList);
  const cityParameterHandled = useRef(false);
  const [eventsService] = useState(() => createEventsServicePlugin());
  const [calendarControls] = useState(() => createCalendarControlsPlugin());
  const filteredEvents = useMemo(
    () => filterEventsByType(eventList, typeFilter),
    [eventList, typeFilter]
  );

  const expandedEvents = useMemo(() => {
    const now = Temporal.Now.zonedDateTimeISO();
    const cutoff = now.add({ weeks: 12 });
    const expanded: ScheduleXEvent[] = [];

    for (const event of filteredEvents) {
      expanded.push(event);

      if (event.recurrence !== "weekly") continue;

      const originalStart = Temporal.PlainDateTime.from(event.start.replace(" ", "T"));
      const originalEnd = Temporal.PlainDateTime.from(event.end.replace(" ", "T"));
      const durationMinutes = originalEnd.since(originalStart).total({ unit: "minutes" });
      const upcomingDates = getUpcomingSeriesDates(event.start, 12);

      for (const futureDate of upcomingDates) {
        const futureZdt = futureDate.toZonedDateTime("America/New_York");
        if (Temporal.PlainDateTime.compare(futureZdt, cutoff.toPlainDateTime()) > 0) break;

        const endDate = futureDate.add({ minutes: Math.round(durationMinutes) });

        expanded.push({
          ...event,
          id: `${event.id}-w${upcomingDates.indexOf(futureDate) + 1}`,
          start: futureDate.toString().replace("T", " "),
          end: endDate.toString().replace("T", " "),
        });
      }
    }

    return expanded;
  }, [filteredEvents]);

  useEffect(() => {
    eventListRef.current = eventList;
  }, [eventList]);

  const calendar = useCalendarApp({
    views: [
      createViewDay(),
      createViewWeek(),
      createViewMonthGrid(),
      createViewMonthAgenda(),
      createViewList(),
    ],
    defaultView: initialCompact ? "list" : "month-grid",
    events: [],
    calendars: CALENDARS_CONFIG,
    plugins: [eventsService, calendarControls],
    selectedDate: Temporal.Now.plainDateISO(),
    isDark: true,
    locale: "en-US",
    timezone: "America/New_York",
    theme: "shadcn",
    firstDayOfWeek: 1,
    callbacks: {
      onEventClick(calendarEvent) {
        const fullEvent = eventListRef.current.find(
          (item) => String(item.id) === String(calendarEvent.id)
        );
        setSelectedEvent(fullEvent ?? (calendarEvent as unknown as ScheduleXEvent));
      },
    },
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = (event: MediaQueryListEvent) => {
      const nextView: CalendarView = event.matches ? "list" : "month-grid";
      setIsCompact(event.matches);
      setActiveView(nextView);
      calendarControls.setView(nextView);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [calendarControls]);

  useEffect(() => {
    if (cityParameterHandled.current) return;
    cityParameterHandled.current = true;
    const requestedCity = searchParams.get("city");
    if (
      (requestedCity === "boston" || requestedCity === "new-york-city") &&
      requestedCity !== city
    ) {
      setCity(requestedCity);
    }
  }, [city, searchParams, setCity]);

  useEffect(() => {
    eventsService.set(
      expandedEvents.map((event) => ({
        ...event,
        start: Temporal.PlainDateTime.from(event.start.replace(" ", "T")).toZonedDateTime(
          "America/New_York"
        ),
        end: Temporal.PlainDateTime.from(event.end.replace(" ", "T")).toZonedDateTime(
          "America/New_York"
        ),
      }))
    );
  }, [eventsService, expandedEvents]);

  useEffect(() => {
    injectStructuredData(generateEventsListStructuredData(eventList), "events-list-data");
  }, [eventList]);

  const handleClosedModal = useCallback(() => {
    setSelectedEvent(null);
    if (searchParams.has("event")) navigate("/calendar", { replace: true });
  }, [navigate, searchParams]);

  const goToMonth = (deltaMonths: number) => {
    const next =
      deltaMonths === 0 ? Temporal.Now.plainDateISO() : visibleDate.add({ months: deltaMonths });
    setVisibleDate(next);
    calendarControls.setDate(next);
  };

  const handleViewChange = (view: CalendarView) => {
    setActiveView(view);
    calendarControls.setView(view);
  };

  useDocumentMeta({
    title: "Dance Calendar - Salsa, Bachata & Latin Dance Events",
    description:
      "Find salsa, bachata, and Latin dance events across Greater Boston and NYC. Browse the community calendar of classes, socials, and workshops.",
  });
  useEventDeepLink(eventList, setSelectedEvent);
  useEscapeKey(handleClosedModal);

  const cityLabel = city === "boston" ? "Boston" : "NYC";
  const monthTitle = visibleDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const isEmpty = !loading && !error && eventList.length === 0;
  const hasNoMatches = !loading && !error && eventList.length > 0 && filteredEvents.length === 0;
  const showCalendar = !loading && !error && expandedEvents.length > 0;
  const showSubmitCta = !loading && !error && eventList.length > 0;

  return (
    <div className="calendar-page">
      <header className="stage-header">
        <div className="stage-inner">
          <div className="stage-left">
            <p className="stage-eyebrow">What's on · {cityLabel}</p>
            <h1 className="stage-title">{monthTitle}</h1>
            <p className="stage-accent">salsa &amp; bachata, hasta la madrugada</p>
          </div>
          <div className="stage-controls stage-controls-primary">
            <div className="month-nav">
              <button className="nav-btn" aria-label="Previous month" onClick={() => goToMonth(-1)}>
                ‹
              </button>
              <button className="nav-btn today-btn" onClick={() => goToMonth(0)}>
                Today
              </button>
              <button className="nav-btn" aria-label="Next month" onClick={() => goToMonth(1)}>
                ›
              </button>
            </div>
            <div className="pill-group" role="group" aria-label="City">
              {CITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`pill ${city === option.value ? "pill-active-city" : ""}`}
                  aria-pressed={city === option.value}
                  onClick={() => setCity(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="calendar-toolbar">
        <div className="toolbar-inner">
          <div className="pill-group" role="group" aria-label="Filter by event type">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`pill ${typeFilter === option.value ? "pill-active-type" : ""}`}
                aria-pressed={typeFilter === option.value}
                onClick={() => setTypeFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {!isCompact && (
            <div className="pill-group" role="group" aria-label="Calendar view">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`pill ${activeView === option.value ? "pill-active-view" : ""}`}
                  aria-pressed={activeView === option.value}
                  onClick={() => handleViewChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {!isCompact && <CalendarLegend />}
        </div>
      </div>

      <CalendarStatus
        loading={loading}
        error={error}
        isEmpty={isEmpty}
        hasNoMatches={hasNoMatches}
        cityLabel={cityLabel}
        onRetry={refetch}
        onClearFilter={() => setTypeFilter("all")}
      />

      {showCalendar && (
        <div className="calendar-main">
          <ScheduleXCalendar calendarApp={calendar} />
        </div>
      )}

      {showSubmitCta && (
        <div className="calendar-cta">
          <p>Know about an event that's missing?</p>
          <Link to="/submit" className="btn-primary">
            Submit an Event
          </Link>
        </div>
      )}

      <EventModal event={selectedEvent} onClose={handleClosedModal} />
    </div>
  );
}

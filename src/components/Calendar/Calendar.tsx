import { useState, useEffect, useRef } from "react";
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
import { useCity } from "../../contexts/CityContext";

import EventModal from "../EventModal/EventModal";
import { useEvents } from "../../hooks/useEvent";
import {
  updatePageTitle,
  updateMetaDescription,
  generateEventsListStructuredData,
  injectStructuredData,
} from "../../utils/seo";

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
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [activeView, setActiveView] = useState<CalendarView>("month-grid");
  const [visibleDate, setVisibleDate] = useState<Temporal.PlainDate>(() =>
    Temporal.Now.plainDateISO()
  );
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasLoadedFromUrl = useRef(false);
  const { city, setCity } = useCity();

  const { events: eventList, loading, error } = useEvents();

  const [eventsService] = useState(() => createEventsServicePlugin());
  const [calendarControls] = useState(() => createCalendarControlsPlugin());

  const calendar = useCalendarApp({
    views: [
      createViewDay(),
      createViewWeek(),
      createViewMonthGrid(),
      createViewMonthAgenda(),
      createViewList(),
    ],
    defaultView: "month-grid",
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
        const fullEvent = eventList.find((e) => String(e.id) === String(calendarEvent.id));
        setSelectedEvent(fullEvent ?? (calendarEvent as unknown as ScheduleXEvent));
      },
    },
  });

  const handleClosedModal = () => {
    setSelectedEvent(null);
    // Remove event parameter from URL
    if (searchParams.has("event")) {
      navigate("/calendar", { replace: true });
    }
  };

  const goToMonth = (deltaMonths: number) => {
    const next =
      deltaMonths === 0
        ? Temporal.Now.plainDateISO()
        : visibleDate.add({ months: deltaMonths });
    setVisibleDate(next);
    calendarControls.setDate(next);
  };

  const handleViewChange = (view: CalendarView) => {
    setActiveView(view);
    calendarControls.setView(view);
  };

  // Update page SEO metadata
  useEffect(() => {
    updatePageTitle("Dance Calendar - Salsa, Bachata & Latin Dance Events");
    updateMetaDescription(
      "Find salsa, bachata, and Latin dance events across Greater Boston and NYC. Browse the community calendar of classes, socials, and workshops."
    );
  }, []);

  // Push freshly fetched (and type-filtered) events into Schedule-X.
  useEffect(() => {
    if (eventList.length === 0) return;
    const calendarEvents = filterEventsByType(eventList, typeFilter).map((event) => ({
      ...event,
      start: Temporal.PlainDateTime.from(event.start.replace(" ", "T")).toZonedDateTime(
        "America/New_York"
      ),
      end: Temporal.PlainDateTime.from(event.end.replace(" ", "T")).toZonedDateTime(
        "America/New_York"
      ),
    }));
    eventsService.set(calendarEvents);

    // Structured data always reflects the full list, not the visual filter
    const structuredData = generateEventsListStructuredData(eventList);
    injectStructuredData(structuredData, "events-list-data");

    // Open event from URL parameter on first load
    const eventIdFromUrl = searchParams.get("event");
    if (eventIdFromUrl && !hasLoadedFromUrl.current) {
      const event = eventList.find((e) => String(e.id) === eventIdFromUrl);
      if (event) {
        hasLoadedFromUrl.current = true;
        // Use setTimeout to avoid setting state during render
        setTimeout(() => setSelectedEvent(event), 0);
      }
    }
  }, [eventList, typeFilter, eventsService, searchParams]);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedEvent(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const cityLabel = city === "boston" ? "Boston" : "NYC";
  const monthTitle = visibleDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="calendar-page">
      <header className="stage-header">
        <div className="stage-inner">
          <div className="stage-left">
            <p className="stage-eyebrow">What's on · {cityLabel}</p>
            <h1 className="stage-title">{monthTitle}</h1>
            <p className="stage-accent">salsa &amp; bachata, hasta la madrugada</p>
          </div>
          <div className="stage-controls">
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
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-dot social" />
              <span>Social</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot class" />
              <span>Class</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot workshop" />
              <span>Workshop</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading / Error states */}
      {loading && (
        <div className="calendar-status">
          <p>Loading events...</p>
        </div>
      )}
      {error && (
        <div className="calendar-status calendar-error">
          <p>Failed to load events: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* Schedule-X Calendar */}
      <div className="calendar-main">
        <ScheduleXCalendar calendarApp={calendar} />
      </div>

      {/* Submit CTA */}
      <div className="calendar-cta">
        <p>Know about an event that's missing?</p>
        <Link to="/submit" className="btn-primary">
          Submit an Event
        </Link>
      </div>

      {/* Event Detail Modal */}
      <EventModal event={selectedEvent} onClose={handleClosedModal} />
    </div>
  );
}

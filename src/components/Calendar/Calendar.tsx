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
import { useSearchParams, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import "temporal-polyfill/global";
import "./Calendar.css";
import "@schedule-x/theme-default/dist/index.css";
import { ScheduleXEvent, CALENDARS_CONFIG } from "../../types/events";

import EventModal from "../EventModal/EventModal";
import { useEvents } from "../../hooks/useEvent";
import {
  updatePageTitle,
  updateMetaDescription,
  generateEventsListStructuredData,
  injectStructuredData,
} from "../../utils/seo";

export default function Calendar() {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasLoadedFromUrl = useRef(false);

  const { events: eventList, loading, error } = useEvents();

  const [eventsService] = useState(() => createEventsServicePlugin());

  const calendar = useCalendarApp({
    views: [
      createViewDay(),
      createViewWeek(),
      createViewMonthGrid(),
      createViewMonthAgenda(),
      createViewList(),
    ],
    defaultView: "week",
    events: [],
    calendars: CALENDARS_CONFIG,
    plugins: [eventsService],
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

  // Update page SEO metadata
  useEffect(() => {
    updatePageTitle("Boston Dance Calendar - Salsa, Bachata & Latin Dance Events");
    updateMetaDescription(
      "Find salsa, bachata, and Latin dance events across Greater Boston. Browse our interactive calendar of classes, socials, and workshops."
    );
  }, []);

  // Push freshly fetched events into Schedule-X whenever they change.
  useEffect(() => {
    if (eventList.length === 0) return;
    const calendarEvents = eventList.map((event) => ({
      ...event,
      start: Temporal.PlainDateTime.from(event.start.replace(" ", "T")).toZonedDateTime(
        "America/New_York"
      ),
      end: Temporal.PlainDateTime.from(event.end.replace(" ", "T")).toZonedDateTime(
        "America/New_York"
      ),
    }));
    eventsService.set(calendarEvents);

    // Inject events structured data for SEO
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
  }, [eventList, eventsService, searchParams]);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedEvent(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1>Boston Dance Calendar</h1>
        <p className="calendar-subtitle">
          Salsa, bachata, and social dance events across Greater Boston
        </p>
      </div>

      {/* Legend */}
      <div className="calendar-legend">
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
        <Link to="/submit" className="cta-button">
          Submit an Event
        </Link>
      </div>

      {/* Event Detail Modal */}
      <EventModal event={selectedEvent} onClose={handleClosedModal} />
    </div>
  );
}

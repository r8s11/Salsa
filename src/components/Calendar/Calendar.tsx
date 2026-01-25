import { useState, useEffect } from "react";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  createViewMonthAgenda,
  createViewList
} from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import "temporal-polyfill/global";
import "./Calendar.css";
import "@schedule-x/theme-default/dist/index.css";
import {
  ScheduleXEvent,
  CALENDARS_CONFIG,
  bostonDateTime,
} from "../../types/events";

import EventModal from "../EventModal/EventModal"

const testEvents: ScheduleXEvent[] = [
  {
    id: "1",
    title: "Tambo",
    start: bostonDateTime(2026, 1, 23, 21, 0),
    end: bostonDateTime(2026, 1, 24, 1, 0),
    calendarId: "social",
    location: "Dante Alighieri Dance Hall",
    address: "41 Hampshire St, Cambridge, MA 02139",
    description:
      "Learn the basics of salsa dancing! perfect for absolute beginners.",
    rsvpLink: "https://www.tambosalsa.com/",
  },
  {
    id: "2",
    title: "Noise Vol 5",
    start: bostonDateTime(2026, 2, 21, 21, 0),
    end: bostonDateTime(2026, 2, 22, 1, 0),
    calendarId: "social",
    location: "PKL",
    address: "64 C St, Boston, MA 02215",
    description: "DRESS CODE: Dress to Impress",
    rsvpLink: "https://www.instagram.com/noise.boston",
  },
  {
    id: "3",
    title: "Test - Beginner Salsa Class",
    start: bostonDateTime(2026, 1, 11, 14, 0),
    end: bostonDateTime(2026, 1, 11, 15, 0),
    calendarId: "workshop",
    location: "Latin Dance Academy ",
    address: "789 newbury st, Boston, MA 02115",
    description:
      "Master body movement and styling techniques for bachata. Intermidate level",
    rsvpLink: "https://example.com/bachata-workshop",
  },
  {
    id: "4",
    title: "Intermidate Salsa Class",
    start: bostonDateTime(2026, 1, 14, 19, 0),
    end: bostonDateTime(2026, 1, 14, 20, 0),
    calendarId: "class",
    location: "Dance Studio Boston",
    address: "123 Boylston st, Boston, MA 02116",
    description:
      "Take your salsa to the next level! Focus on turn patterns and musicality",
    rsvpLink: "https://example.com/Intermidate-salsa",
  },
  {
    id: "5",
    title: "Saturday Night Salsa Social",
    start: bostonDateTime(2026, 1, 24, 21, 0),
    end: bostonDateTime(2026, 1, 25, 1, 0),
    calendarId: "social",
    location: "Rumba Room",
    address: "321 Treamont St, Boston, MA 02116",
    description: "The biggest salsa social in Boston! Live band performance.",
    rsvpLink: "https://example.com/saturday-social",
  },
];

export default function Calendar() {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(
    null
  );

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
    events: testEvents,
    calendars: CALENDARS_CONFIG,
    plugins: [eventsService, createEventsServicePlugin()],
    selectedDate: Temporal.Now.plainDateISO(),
    isDark: true,
    locale: "en-US",
    timezone: "America/New_York",
    firstDayOfWeek: 1,
    callbacks: {
      onEventClick(calendarEvent) {
        // Find the Full event with our custom properties
        const fullEvent = testEvents.find((e) => e.id === calendarEvent.id);
        if (fullEvent) {
          setSelectedEvent(fullEvent)
        }
      },
    },
  });

  const handleClosedModal = () =>
  { setSelectedEvent(null) }

  //close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedEvent(null)
      }
    };
    window.addEventListener("keydown", handleKeyDown);
  }, [])
  return (
    <div className="calendar-container">
      <div className="title">
        <h1>Boston Event Calendar</h1>
      </div>
      {/* Legend  */}
      <div className="calendar-legend">
        <strong>Legend:
          <br />
        </strong>
        <div className="items">
          <div className="legend-item">
            <span className="legend-color social">Social Dance</span>
          </div>
          <div className="legend-item">
            <span className="legend-color class">Class</span>
          </div>
          <div className="legend-item">
            <span className="legend-color workshop">Workshop</span>
        </div>
        </div>
      </div>

      {/* Schedule-X Calendar */}
      <div className="main" >
        <ScheduleXCalendar calendarApp={calendar} />
      </div>
      <div className="right"></div>
      <div className="footer"></div>
      {/* Event Detail Modal */}
      <EventModal event={selectedEvent} onClose={handleClosedModal} />
    </div>
  );
}

import { useState, useEffect } from "react";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  createViewMonthAgenda,
} from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import "temporal-polyfill/global";
import "./Calendar.css";
import "@schedule-x/theme-default/dist/index.css";

import {
  ScheduleXEvent,
  CALENDARS_CONFIG,
  bostonDateTime,
} from "../types/events";
// import EventModal from "./EventModal"

const testEvents: ScheduleXEvent[] = [
  {
    id: "1",
    title: "Test - Beginner Salsa Class",
    start: bostonDateTime(2026, 1, 11, 14, 0),
    end: bostonDateTime(2026, 1, 11, 15, 0),
    calendarId: "class",
    location: " ",
    address: "",
    description: "",
    rsvpLink: ""
  }
]

export default function Calendar() {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(
    null
  );

  const [eventsService] = useState(() => createEventsServicePlugin());

  const calendar = useCalendarApp( {
    views: [
      createViewDay(),
      createViewWeek(),
      createViewMonthGrid(),
      createViewMonthAgenda(),
    ],
    events: testEvents,
    calendars: CALENDARS_CONFIG,
    plugins: [eventsService],
    selectedDate: Temporal.Now.plainDateISO(),
    isDark: true,
    locale: "en-US",
    firstDayOfWeek: 1,
    callbacks: {

    }

  });

  return (
    <div className="calendar-container">

      {/* Schedule-X Calendar */}
      <ScheduleXCalendar calendarApp={calendar} />
      {/* Event Detail Modal */}
      {/* <EventModal event={selectedEvent} onClose={handleClosedModal} /> */}
    </div>
  );
}

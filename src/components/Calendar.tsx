import { ScheduleXCalendar } from "@schedule-x/react";
import "./Calendar.css";

export default function Calendar() {
  return (
    <div className="calendar-container">
      <h1>Boston Event Calendar</h1>
      {/* Legend  */}
      <div className="calendar-legend">
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
      {/* Schedule-X Calendar
      <ScheduleXCalendar calendarApp={calendar} />
      Event Detail Modal
      <EventModal event={selectedEvent} onClose={handleClosedModal} /> */}
    </div>
  );
}

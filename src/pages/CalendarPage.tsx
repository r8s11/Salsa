import Calendar from "../components/Calendar";

export default function CalendarPage() {
    return (<>
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
        <Calendar />
        </>
    )
}

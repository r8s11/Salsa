import type { ScheduleXEvent } from "../../types/events";
import {
  formatCalendarDate,
  formatCalendarTime,
  sortCalendarEvents,
} from "../../features/calendar/model/calendarEvents";
import { resolveEventFlyer } from "../EventModal/eventModalImage";

type CalendarEventGroup = {
  key: string;
  label: string;
  events: ScheduleXEvent[];
};

function groupByDate(events: ScheduleXEvent[]): CalendarEventGroup[] {
  const groups: CalendarEventGroup[] = [];

  for (const event of sortCalendarEvents(events)) {
    const key = event.start.slice(0, 10) || "unknown";
    const currentGroup = groups.at(-1);
    if (currentGroup?.key === key) {
      currentGroup.events.push(event);
      continue;
    }

    groups.push({
      key,
      label: formatCalendarDate(event.start),
      events: [event],
    });
  }

  return groups;
}

export default function CalendarListView({
  events,
  onSelect,
}: {
  events: ScheduleXEvent[];
  onSelect: (event: ScheduleXEvent) => void;
}) {
  const groups = groupByDate(events);

  return (
    <div className="calendar-list-view" aria-label="Events as a list">
      {groups.map((group) => (
        <section
          key={group.key}
          className="calendar-list-group"
          aria-labelledby={`calendar-list-${group.key}`}
        >
          <h2 id={`calendar-list-${group.key}`} className="calendar-list-date">
            {group.label}
          </h2>
          <div className="calendar-list-rows">
            {group.events.map((event) => {
              const time = formatCalendarTime(event.start);
              return (
                <button
                  key={event.id}
                  type="button"
                  className="calendar-list-row"
                  onClick={() => onSelect(event)}
                  aria-label={`${event.title} on ${group.label}, ${event.start.slice(0, 4)} at ${time}`}
                >
                  <img
                    className="calendar-list-thumbnail"
                    src={resolveEventFlyer(event)}
                    alt=""
                    width={64}
                    height={80}
                    loading="lazy"
                  />
                  <span className="calendar-list-copy">
                    <strong className="calendar-list-title">{event.title}</strong>
                    <span className="calendar-list-meta">
                      <span>{time}</span>
                      {event.location && (
                        <span className="calendar-list-location">{event.location}</span>
                      )}
                    </span>
                  </span>
                  <span className="calendar-list-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

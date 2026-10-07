import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { CALENDARS_CONFIG } from "../../events/model/calendarsConfig";
import type { ScheduleXEvent } from "../../../types/events";
import {
  formatCalendarDate,
  formatCalendarTime,
  sortCalendarEvents,
} from "../model/calendarEvents";
import { resolveEventFlyer } from "../../events/components/event-modal/eventModalImage";
import { isRecentlyApproved } from "../../events/model/recentlyApproved";
import "temporal-polyfill/global";

const PAGE_SIZE = 50;

function endDateLabel(event: ScheduleXEvent): string {
  try {
    const start = Temporal.PlainDate.from(event.start.slice(0, 10));
    const end = Temporal.PlainDate.from(event.end.slice(0, 10));
    if (Temporal.PlainDate.compare(end, start) <= 0) return "";
    return end.equals(start.add({ days: 1 }))
      ? " (next day)"
      : ` (${formatCalendarDate(event.end)}, ${end.year})`;
  } catch {
    return "";
  }
}

// The date rail reads as a calendar tear-off: a short weekday, the day number,
// and the month. Derived from the same parsed start the group heading uses, so
// an unparseable date degrades to empty strings rather than "Invalid Date".
function dateRail(start: string): { weekday: string; day: string; month: string } {
  try {
    const date = Temporal.PlainDateTime.from(start.replace(" ", "T")).toPlainDate();
    return {
      weekday: date.toLocaleString("en-US", { weekday: "short" }),
      day: String(date.day),
      month: date.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    };
  } catch {
    return { weekday: "", day: "", month: "" };
  }
}

const eventTypeLabels = {
  social: "Social",
  class: "Class",
  workshop: "Workshop",
  live_music: "Live music",
} as const;

type CalendarEventGroup = {
  key: string;
  label: string;
  events: ScheduleXEvent[];
};

function groupByDate(events: ScheduleXEvent[]): CalendarEventGroup[] {
  const groups: CalendarEventGroup[] = [];

  for (const event of events) {
    const key = event.start.slice(0, 10) || "unknown";
    const currentGroup = groups[groups.length - 1];
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
  const sortedEvents = useMemo(() => sortCalendarEvents(events), [events]);
  const [page, setPage] = useState({ events, limit: PAGE_SIZE });
  const limit = page.events === events ? page.limit : PAGE_SIZE;
  const pendingFocusId = useRef<ScheduleXEvent["id"] | null>(null);
  const groups = groupByDate(sortedEvents.slice(0, limit));

  const showMore = () => {
    pendingFocusId.current = sortedEvents[limit]?.id ?? null;
    setPage({ events, limit: limit + PAGE_SIZE });
  };

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
              const endTime = formatCalendarTime(event.end);
              const dateLabel = endDateLabel(event);
              const timeRange =
                event.end === event.start
                  ? time
                  : `${time} – ${endTime}${dateLabel}`;
              const rail = dateRail(event.start);
              return (
                <button
                  type="button"
                  className="calendar-list-row"
                  key={event.id}
                  ref={(row) => {
                    if (row && event.id === pendingFocusId.current) {
                      row.focus();
                      pendingFocusId.current = null;
                    }
                  }}
                  style={
                    {
                      "--event-color": CALENDARS_CONFIG[event.calendarId].darkColors.main,
                    } as CSSProperties
                  }
                  onClick={() => onSelect(event)}
                  aria-label={`${event.title} on ${group.label}, ${event.start.slice(0, 4)} at ${timeRange}`}
                >
                  <span className="calendar-list-rail" aria-hidden>
                    <span className="calendar-list-rail-weekday">{rail.weekday}</span>
                    <span className="calendar-list-rail-day">{rail.day}</span>
                    <span className="calendar-list-rail-month">{rail.month}</span>
                  </span>
                  <span className="calendar-list-thumb-wrap">
                    <img
                      className="calendar-list-thumbnail"
                      src={resolveEventFlyer(event)}
                      alt=""
                      width={64}
                      height={80}
                      loading="lazy"
                      onError={(error) => {
                        const image = error.currentTarget;
                        const fallback = resolveEventFlyer({ ...event, imageUrl: undefined });
                        if (image.getAttribute("src") !== fallback) image.src = fallback;
                      }}
                    />
                  </span>
                  <span className="calendar-list-copy">
                    <span className="calendar-list-heading">
                      <strong className="calendar-list-title" dir="auto">{event.title}</strong>
                      <span className="calendar-list-type">
                        {eventTypeLabels[event.calendarId]}
                      </span>
                      {isRecentlyApproved({
                        createdAt: event.createdAt,
                        sourceType: event.sourceType,
                      }) && <span className="recently-approved-badge">Just approved</span>}
                    </span>
                    {event.description && (
                      <span className="calendar-list-description" dir="auto">{event.description}</span>
                    )}
                    <span className="calendar-list-meta">
                      <span>
                        <Clock size={14} aria-hidden />
                        {timeRange}
                      </span>
                      {event.location && (
                        <span className="calendar-list-location" dir="auto">
                          <MapPin size={14} aria-hidden />
                          {event.location}
                        </span>
                      )}
                    </span>
                    {event.danceStyles?.length ? (
                      <span className="calendar-list-styles">
                        {event.danceStyles.map((style) => (
                          <span key={style} dir="auto">{style}</span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <ArrowUpRight className="calendar-list-arrow" size={18} aria-hidden />
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {limit < sortedEvents.length && (
        <div className="calendar-list-more">
          <p role="status">{Math.min(limit, sortedEvents.length)} of {sortedEvents.length} events shown</p>
          <button type="button" onClick={showMore}>Show more events</button>
        </div>
      )}
    </div>
  );
}

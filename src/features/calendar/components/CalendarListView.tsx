import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ScheduleXEvent } from "../../../types/events";
import {
  formatCalendarDate,
  formatCalendarTime,
  sortCalendarEvents,
} from "../model/calendarEvents";
import { resolveEventFlyer } from "../../../components/EventModal/eventModalImage";

const canObserve = typeof IntersectionObserver === "function";

/** Row that scales and fades in once as it enters the viewport. */
function AnimatedRow({
  index,
  onClick,
  ariaLabel,
  children,
}: {
  index: number;
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  // No IntersectionObserver or reduced motion: rows are simply shown.
  const isStatic = Boolean(reduceMotion) || !canObserve;
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (isStatic || !node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isStatic]);

  const shown = inView || isStatic;

  return (
    <motion.button
      ref={ref}
      type="button"
      className="calendar-list-row"
      onClick={onClick}
      aria-label={ariaLabel}
      initial={isStatic ? false : { scale: 0.92, opacity: 0 }}
      animate={shown ? { scale: 1, opacity: 1 } : { scale: 0.92, opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay: Math.min(index, 5) * 0.04 }}
    >
      {children}
    </motion.button>
  );
}

type CalendarEventGroup = {
  key: string;
  label: string;
  events: ScheduleXEvent[];
};

function groupByDate(events: ScheduleXEvent[]): CalendarEventGroup[] {
  const groups: CalendarEventGroup[] = [];

  for (const event of sortCalendarEvents(events)) {
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
            {group.events.map((event, index) => {
              const time = formatCalendarTime(event.start);
              return (
                <AnimatedRow
                  key={event.id}
                  index={index}
                  onClick={() => onSelect(event)}
                  ariaLabel={`${event.title} on ${group.label}, ${event.start.slice(0, 4)} at ${time}`}
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
                </AnimatedRow>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

import "temporal-polyfill/global";
import type { ScheduleXEvent } from "../../events/model/types";

function parseCalendarStart(start: string): Temporal.PlainDateTime | null {
  if (!start.trim()) return null;

  try {
    return Temporal.PlainDateTime.from(start.replace(" ", "T"));
  } catch {
    return null;
  }
}

export function sortCalendarEvents(events: ScheduleXEvent[]): ScheduleXEvent[] {
  return [...events].sort((a, b) => {
    const aStart = parseCalendarStart(a.start);
    const bStart = parseCalendarStart(b.start);

    if (aStart && bStart) {
      const byStart = Temporal.PlainDateTime.compare(aStart, bStart);
      if (byStart !== 0) return byStart;
    } else if (aStart) {
      return -1;
    } else if (bStart) {
      return 1;
    }

    const byTitle = a.title.localeCompare(b.title);
    if (byTitle !== 0) return byTitle;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function formatCalendarDate(start: string): string {
  const dateTime = parseCalendarStart(start);
  if (!dateTime) return "Date to be confirmed";

  return dateTime.toPlainDate().toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
export function formatCalendarTime(start: string): string {
  const dateTime = parseCalendarStart(start);
  if (!dateTime) return "Time to be confirmed";

  const hours = dateTime.hour.toString().padStart(2, "0");
  const minutes = dateTime.minute.toString().padStart(2, "0");
  const time = `${hours}:${minutes}`;
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

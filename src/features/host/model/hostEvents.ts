import { fromEventDateInstant, formatTimeLabel } from "../../events/model/eventDateTime";
import { DatabaseEvent } from "../../events/model/types";

export interface HostEventRow {
  event: DatabaseEvent;
  dateLabel: string;
  statusLabel: string;
  action: { label: string; to: string };
}

export function hostEventAction(event: DatabaseEvent): { label: string; to: string } {
  if (event.status === "pending" || event.status === "rejected") {
    return {
      label: "Edit event",
      to: `/profile/edit/${event.id}`,
    };
  }
  return {
    label: "View event",
    to: `/calendar?event=${event.id}&city=${event.city}`,
  };
}
export function deriveHostEventRows(events: DatabaseEvent[], _now: Date): HostEventRow[] {
  const withInstant = events.map((e) => {
    const instant = parseEventInstant(e.event_date);
    return {
      event: e,
      dateLabel: deriveDateLabel(instant),
      statusLabel: e.status.charAt(0).toUpperCase() + e.status.slice(1),
      action: hostEventAction(e),
      sortKey: instant?.epochMilliseconds ?? null,
    };
  });

  return withInstant
    .sort((a, b) => {
      if (a.sortKey === null && b.sortKey === null) return 0;
      if (a.sortKey === null) return 1;
      if (b.sortKey === null) return -1;
      return a.sortKey - b.sortKey;
    })
    .map(({ sortKey: _sortKey, ...row }) => row);
}

function parseEventInstant(eventDate: string): Temporal.Instant | null {
  try {
    return Temporal.Instant.from(eventDate);
  } catch {
    return null;
  }
}

function deriveDateLabel(instant: Temporal.Instant | null): string {
  if (instant === null) {
    return "Date unavailable";
  }

  const { date, time } = fromEventDateInstant(instant.toString());
  const [year, month, day] = date.split("-").map(Number);
  const displayDate = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const displayTime = formatTimeLabel(time);

  return `${displayDate} at ${displayTime}`;
}

export function findNextHostEvent(events: DatabaseEvent[], now: Date): DatabaseEvent | null {
  const nowTimestamp = now.getTime();
  const futureEvents = events
    .map((event) => ({ event, instant: parseEventInstant(event.event_date) }))
    .filter(
      ({ event, instant }) =>
        instant !== null &&
        instant.epochMilliseconds > nowTimestamp &&
        event.status !== "cancelled" &&
        event.status !== "archived"
    );
  if (futureEvents.length === 0) return null;
  return futureEvents.sort((a, b) => a.instant!.epochMilliseconds - b.instant!.epochMilliseconds)[0].event;
}

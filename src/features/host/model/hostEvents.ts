import { fromEventDateInstant, formatTimeLabel } from "../../events/model/eventDateTime";
import { DatabaseEvent } from "../../events/model/types";

export interface HostEventRow {
  event: DatabaseEvent;
  dateLabel: string;
  statusLabel: string;
  action: { label: string; to: string };
}

export function hostEventAction(event: DatabaseEvent): { label: string; to: string } {
  if (event.status === "pending") {
    return { label: "Edit submission", to: `/profile/edit/${event.id}` };
  }
  if (event.status === "rejected") {
    return { label: "Revise submission", to: `/profile/edit/${event.id}` };
  }
  if (event.status === "approved") {
    // The real public detail route — not the calendar-modal shortcut used
    // elsewhere — because this is the "View public event" action promised
    // by the Host detail page and My Events row.
    return { label: "View public event", to: `/events/${event.id}` };
  }
  if (event.status === "draft") {
    return { label: "View draft", to: `/host/events/${event.id}` };
  }
  return {
    label: "View event",
    to: `/calendar?event=${event.id}&city=${event.city}`,
  };
}

/** Terminal statuses never count as upcoming and are never "next". */
function isTerminal(event: DatabaseEvent): boolean {
  return event.status === "cancelled" || event.status === "archived";
}

export function isUpcomingHostEvent(event: DatabaseEvent, now: Date): boolean {
  const instant = parseEventInstant(event.event_date);
  return instant !== null && instant.epochMilliseconds > now.getTime() && !isTerminal(event);
}

export function deriveHostEventRows(events: DatabaseEvent[]): HostEventRow[] {
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
  const upcoming = events
    .map((event) => ({ event, instant: parseEventInstant(event.event_date) }))
    .filter(
      (candidate): candidate is { event: DatabaseEvent; instant: Temporal.Instant } =>
        candidate.instant !== null &&
        candidate.instant.epochMilliseconds > now.getTime() &&
        !isTerminal(candidate.event)
    )
    .sort((a, b) => a.instant.epochMilliseconds - b.instant.epochMilliseconds);

  return upcoming[0]?.event ?? null;
}

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
  const withInstant = events.map((e) => ({
    event: e,
    dateLabel: deriveDateLabel(e.event_date),
    statusLabel: e.status.charAt(0).toUpperCase() + e.status.slice(1),
    action: hostEventAction(e),
    sortKey: parseEventInstant(e.event_date),
  }));

  return withInstant
    .sort((a, b) => {
      if (a.sortKey === null && b.sortKey === null) return 0;
      if (a.sortKey === null) return 1;
      if (b.sortKey === null) return -1;
      return a.sortKey - b.sortKey;
    })
    .map(({ sortKey: _sortKey, ...row }) => row);
}

function parseEventInstant(eventDate: string): number | null {
  const timestamp = new Date(eventDate).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function deriveDateLabel(eventDate: string): string {
  if (parseEventInstant(eventDate) === null) {
    return "Date unavailable";
  }

  const { date, time } = fromEventDateInstant(eventDate);
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
  const futureEvents = events.filter((e) => {
    const d = new Date(e.event_date);
    return d > now && e.status !== "cancelled" && e.status !== "archived";
  });
  if (futureEvents.length === 0) return null;
  return futureEvents.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0];
}

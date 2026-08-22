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
export function deriveHostEventRows(events: DatabaseEvent[], now: Date): HostEventRow[] {
  return events
    .map((e) => {
      const { date, time } = fromEventDateInstant(e.event_date);
      const displayDate = new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const displayTime = formatTimeLabel(time);
      
      return {
        event: e,
        dateLabel: `${displayDate} at ${displayTime}`,
        statusLabel: e.status.charAt(0).toUpperCase() + e.status.slice(1),
        action: hostEventAction(e),
      };
    })
    .sort((a, b) => {
      const aDate = new Date(a.event.event_date).getTime();
      const bDate = new Date(b.event.event_date).getTime();
      if (isNaN(aDate)) return 1;
      if (isNaN(bDate)) return -1;
      return aDate - bDate;
    });
}

export function findNextHostEvent(events: DatabaseEvent[], now: Date): DatabaseEvent | null {
  const futureEvents = events.filter((e) => {
    const d = new Date(e.event_date);
    return d > now && e.status !== "cancelled" && e.status !== "archived";
  });
  if (futureEvents.length === 0) return null;
  return futureEvents.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0];
}

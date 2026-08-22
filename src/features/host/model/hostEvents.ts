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
  return []; // Placeholder
}

export function findNextHostEvent(events: DatabaseEvent[], now: Date): DatabaseEvent | null {
  const futureEvents = events.filter((e) => {
    const d = new Date(e.event_date);
    return d > now && e.status !== "cancelled" && e.status !== "archived";
  });
  if (futureEvents.length === 0) return null;
  return futureEvents.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0];
}

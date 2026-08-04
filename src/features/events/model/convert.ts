import "temporal-polyfill/global";
import { DatabaseEvent, ScheduleXEvent } from "./types";

//Convert database event to Schedule-X event
export function databaseEventToScheduleX(event: DatabaseEvent): ScheduleXEvent {
  // Parse the ISO timestamp
  const eventDate = new Date(event.event_date);

  // Use ISO strings for reliable parsing across browsers/timezones
  const start = formatDateTimeForScheduleX(eventDate);

  // Assume 2 hours duration if not specified
  const endDate = new Date(eventDate.getTime() + 4 * 60 * 60 * 1000);
  const end = formatDateTimeForScheduleX(endDate);

  return {
    id: event.id,
    title: event.title,
    start,
    end,
    calendarId: event.event_type,
    location: event.location ?? undefined,
    description: event.description ?? undefined,
    address: event.address ?? undefined,
    rsvpLink: event.rsvp_link ?? undefined,
    city: event.city,
    host: event.host ?? undefined,
    recurrence: event.recurrence ?? undefined,
    gallery: event.gallery ?? undefined,
    imageUrl: event.image_url ?? undefined,
    priceType: event.price_type ?? undefined,
    priceAmount: event.price_amount ?? undefined,
  };
}

// Format a Date object to "YYYY-MM-DD HH:mm" (the format Schedule-X expects)
function formatDateTimeForScheduleX(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

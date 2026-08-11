// Column event_date is timestamp with time zone (timestamptz)
import "temporal-polyfill/global";
import { DatabaseEvent, ScheduleXEvent } from "./types";

const DEFAULT_DURATION_HOURS = 4;

// Convert database event to Schedule-X event
export function databaseEventToScheduleX(event: DatabaseEvent): ScheduleXEvent {
  // Parse as Instant and convert to New York time
  const zdt = Temporal.Instant.from(event.event_date).toZonedDateTimeISO('America/New_York');
  
  const start = formatDateTime(zdt);

  // Add duration
  const endZdt = zdt.add({ hours: DEFAULT_DURATION_HOURS });
  const end = formatDateTime(endZdt);

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
    imageUrl: event.image_url ?? `https://picsum.photos/seed/${event.id}/800/600`,
    priceType: event.price_type ?? undefined,
    priceAmount: event.price_amount ?? undefined,
  };
}

// Format a ZonedDateTime object to "YYYY-MM-DD HH:mm" (the format Schedule-X expects)
function formatDateTime(zdt: Temporal.ZonedDateTime): string {
  const year = zdt.year.toString().padStart(4, "0");
  const month = zdt.month.toString().padStart(2, "0");
  const day = zdt.day.toString().padStart(2, "0");
  const hours = zdt.hour.toString().padStart(2, "0");
  const minutes = zdt.minute.toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

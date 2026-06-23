// Purpose: Define event interfaces and conversion functions

import "temporal-polyfill/global";

export type EventType = "social" | "class" | "workshop";
export type City = "boston" | "new-york-city";

// Database event interface (matches Supabase schema)
export interface DatabaseEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string; //ISO timestamp from database
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: "free" | "paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  image_url: string | null;
  status: "approved" | "pending" | "rejected";
  city: City;
  created_at: string;
}

// Schedule-X event interface
export interface ScheduleXEvent {
  id: string | number;
  title: string;
  start: string;
  end: string;
  calendarId: EventType;
  location?: string;
  description?: string;
  //Custom properties for out app
  address?: string;
  rsvpLink?: string;
  city?: City;
}
// Calendar Color Configuration
export const CALENDARS_CONFIG = {
  social: {
    colorName: "social",
    lightColors: { main: "#e11d48", container: "#ffd9df", onContainer: "#68001a" },
    darkColors:  { main: "#ff5874", container: "#7a0a26", onContainer: "#ffd9df" },
  },
  class: {
    colorName: "class",
    lightColors: { main: "#4f63c4", container: "#dfe3ff", onContainer: "#1a2a6e" },
    darkColors:  { main: "#7c93e9", container: "#2a3566", onContainer: "#dfe3ff" },
  },
  workshop: {
    colorName: "workshop",
    lightColors: { main: "#a8820f", container: "#fff0c2", onContainer: "#3a2c00" },
    darkColors:  { main: "#e9c349", container: "#574500", onContainer: "#fff0c2" },
  },
};

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

// Helper to create a ZonedDateTime for Boston Timezone
export function bostonDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number = 0
): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from({
    year,
    month,
    day,
    hour,
    minute,
    second: 0,
    timeZone: "America/New_York",
  });
}

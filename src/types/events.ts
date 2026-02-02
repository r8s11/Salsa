import "temporal-polyfill/global";

export type EventType = "social" | "class" | "workshop";

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
  price_type: "free" | "Paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  image_url: string | null;
  status: "approved" | "pending" | "rejected";
  created_at: string;
}

export const CALENDARS_CONFIG = {
  social: {
    colorName: "social",
    lightColors: {
      main: "#ff8c42",
      container: "#ffe4d1",
      onContainer: "#5c2e00",
    },
    darkColors: {
      main: "#ffb380",
      container: "#8b4513",
      onContainer: "#ffe4d1",
    },
  },
  class: {
    colorName: "class",
    lightColors: {
      main: "#3498db",
      container: "#d6eaf8",
      onContainer: "#1a4a6e",
    },
    darkColors: {
      main: "#85c1e9",
      container: "#2471a3",
      onContainer: "#d6eaf8",
    },
  },
  workshop: {
    colorName: "workshop",
    lightColors: {
      main: "#27ae60",
      container: "#d5f5e3",
      onContainer: "#145a32",
    },
    darkColors: {
      main: "#82e0aa",
      container: "#1e8449",
      onContainer: "#d5f5e3",
    },
  },
};

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

// Legacy DanceEvent interface (for Events.tsx compatibility)
export interface DanceEvent {
  id: string;
  title: string;
  type: string;
  month: string;
  day: string;
  time: string;
  location: string;
  address: string;
  description: string;
  rsvpLink: string;
  date: Date;
}

//Convert database event to Schedule-X event
export function databaseEventToScheduleX(event: DatabaseEvent): ScheduleXEvent {
  // Parse the ISO timestamp
  const eventDate = new Date(event.event_date);

  // Format as "YYYY-MM-DD HH:mm"
  const start = formatDateTimeForScheduleX(eventDate);

  // Assume 2 hours duration if not specified
  const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
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
  };
}

function formatDateTimeForScheduleX(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

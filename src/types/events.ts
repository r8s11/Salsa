import "temporal-polyfill/global";

export type EventType = "social" | "class" | "workshop";

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
  start: Temporal.ZonedDateTime ;
  end: Temporal.ZonedDateTime;
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

// Convert DanceEvent to ScheduleXEvent (for future unified hook)
export function toScheduleXEvent(
  event: DanceEvent,
  durationHours = 2
): ScheduleXEvent {
  const jsDate = event.date;
  const start = Temporal.ZonedDateTime.from({
    year: jsDate.getFullYear(),
    month: jsDate.getMonth() + 1,
    day: jsDate.getDate(),
    hour: jsDate.getHours(),
    minute: jsDate.getMinutes(),
    second: 0,
    timeZone: "America/New_York",
  });
  const end = start.add({ hours: durationHours });

  const calendarId: EventType = event.type.toLowerCase().includes("social")
    ? "social"
    : event.type.toLowerCase().includes("class")
    ? "class"
    : "workshop";

  return {
    id: event.id,
    title: event.title,
    start,
    end,
    calendarId,
    location: event.location,
    address: event.address,
    description: event.description,
    rsvpLink: event.rsvpLink,
  };
}

// Purpose: Generate RFC 5545 .ics files for events, client-side, plus
// deep links to open Maps and Calendar applications from event details.

import "temporal-polyfill/global";
import { ScheduleXEvent } from "../types/events";

const TZID = "America/New_York";

// "YYYY-MM-DD HH:mm" -> "YYYYMMDDTHHmm00"
function formatIcsDateTime(scheduleXDateTime: string): string {
  return scheduleXDateTime.replace(/[-:]/g, "").replace(" ", "T") + "00";
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateIcs(event: ScheduleXEvent): string {
  const dtstamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const location = [event.location, event.address].filter(Boolean).join(", ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Salsa Segura//Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@salsasegura.com`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${TZID}:${formatIcsDateTime(event.start)}`,
    `DTEND;TZID=${TZID}:${formatIcsDateTime(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []),
    ...(event.rsvpLink ? [`URL:${event.rsvpLink}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

export function downloadIcs(event: ScheduleXEvent): void {
  const blob = new Blob([generateIcs(event)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(event.title) || "event"}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ── Maps ─────────────────────────────────────────────────────────────

// Builds a Google Maps URL from the event's venue + address.
// On mobile devices the browser will prompt to open the native Maps app.
export function mapsUrl(event: ScheduleXEvent): string | null {
  const location = [event.location, event.address].filter(Boolean).join(", ");
  if (!location) return null;
  const params = new URLSearchParams({ q: location });
  return `https://maps.google.com/maps?${params.toString()}`;
}

// ── Google Calendar deep link ──────────────────────────────────────────

// "YYYY-MM-DD HH:mm" (New York wall-clock) -> UTC "YYYYMMDDTHHMMSSZ"
// for the Google Calendar URL `dates` parameter.
function toUtcIso(scheduleXDateTime: string): string {
  const zdt = Temporal.PlainDateTime.from(scheduleXDateTime.replace(" ", "T")).toZonedDateTime(
    TZID
  );
  const utc = zdt.withTimeZone("UTC");
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${utc.year}${pad(utc.month)}${pad(utc.day)}T${pad(utc.hour)}${pad(utc.minute)}00Z`;
}

// Builds a Google Calendar "create event" URL. Opening this link
// pre-fills the event details and, on mobile, prompts to open the
// native Calendar app.
export function googleCalendarUrl(event: ScheduleXEvent): string | null {
  if (!event.start || !event.end) return null;

  const text = encodeURIComponent(event.title);
  const dates = `${toUtcIso(event.start)}/${toUtcIso(event.end)}`;
  const details: string[] = [];
  if (event.description) details.push(event.description);
  if (event.rsvpLink) details.push(`RSVP: ${event.rsvpLink}`);

  const location = [event.location, event.address].filter(Boolean).join(", ");

  const params: string[] = [`text=${text}`, `dates=${dates}`];
  if (details.length > 0) params.push(`details=${encodeURIComponent(details.join("\n\n"))}`);
  if (location) params.push(`location=${encodeURIComponent(location)}`);

  return `https://calendar.google.com/calendar/u/0/r/eventedit?${params.join("&")}`;
}

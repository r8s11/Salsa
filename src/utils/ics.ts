// Purpose: Generate RFC 5545 .ics files for events, client-side.

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
  const dtstamp =
    new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
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
    ...(event.description
      ? [`DESCRIPTION:${escapeIcsText(event.description)}`]
      : []),
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

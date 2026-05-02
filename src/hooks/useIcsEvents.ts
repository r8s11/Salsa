import { useEffect, useState } from "react";
import ICAL from "ical.js";
import type { EventType, ScheduleXEvent } from "../types/events";
import type { City } from "../contexts/CityContext";

/**
 * Heuristic mapping from event title → calendar bucket.
 * The upstream feed only tags CATEGORIES with the city, so we infer
 * type from the SUMMARY text.
 *
 * TODO(user): Tune these regexes once you've watched real data flow through.
 */
function inferEventType(title: string): EventType {
  const t = title.toLowerCase();
  if (/\b(workshop|bootcamp|intensive)\b/.test(t)) return "workshop";
  if (/\b(class|lesson|lessons|crash course)\b/.test(t)) return "class";
  return "social";
}

function formatForScheduleX(date: Date): string {
  // sv-SE locale gives "YYYY-MM-DD HH:mm:ss" — slice to what Schedule-X wants.
  return date
    .toLocaleString("sv-SE", { timeZone: "America/New_York" })
    .slice(0, 16);
}

function readString(vevent: ICAL.Component, name: string): string | undefined {
  const value = vevent.getFirstPropertyValue(name);
  if (value === null || value === undefined) return undefined;
  return typeof value === "string" ? value : String(value);
}

// Schedule-X uses event ids as document.querySelector selectors, so they must
// be valid CSS idents — strip @, ., :, and other unsafe chars.
function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "-");
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `e-${cleaned}`;
}

function parseIcs(text: string): ScheduleXEvent[] {
  const parsed = ICAL.parse(text);
  const comp = new ICAL.Component(parsed);
  const vevents = comp.getAllSubcomponents("vevent");

  return vevents.map((vevent, i) => {
    const ev = new ICAL.Event(vevent);
    const start = formatForScheduleX(ev.startDate.toJSDate());
    const end = formatForScheduleX(ev.endDate.toJSDate());

    const title = ev.summary ?? "Untitled event";
    const uid = sanitizeId(readString(vevent, "uid") ?? String(i));
    const location = readString(vevent, "location");
    const url = readString(vevent, "url");
    const description = readString(vevent, "description");

    return {
      id: uid,
      title,
      start,
      end,
      calendarId: inferEventType(title),
      address: location,
      rsvpLink: url,
      description,
    };
  });
}

export function useIcsEvents(city: City) {
  const [events, setEvents] = useState<ScheduleXEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/ics?city=${encodeURIComponent(city)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setEvents(parseIcs(text));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load events");
        setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [city]);

  return { events, loading, error };
}

# ICS Calendar — Temporary Data Source (While Building Supabase)

This approach lets you populate the calendar from a static `.ics` file using `ical.js` (timezone-aware), then swap back to Supabase by changing one file.

## Why this approach

- `Calendar.tsx` stays **unchanged**
- `useEvents` is the only swap point
- Reverting to Supabase is a one-line change in `useEvent.ts`
- `ical.js` handles `TZID=America/New_York` natively (unlike `@schedule-x/ical` which assumes UTC)

---

## Step 1 — Install ical.js

```bash
npm install ical.js
```

---

## Step 2 — Create the static ICS file

Place it at `public/events.ics` (Vite serves `public/` as static assets at `/`).

```ics
BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:salsa-social-001@salsasegura.com
SUMMARY:Friday Night Salsa Social
DTSTART;TZID=America/New_York:20260508T200000
DTEND;TZID=America/New_York:20260508T230000
LOCATION:123 Main St, Boston, MA
DESCRIPTION:social
END:VEVENT
BEGIN:VEVENT
UID:bachata-class-001@salsasegura.com
SUMMARY:Bachata Beginner Class
DTSTART;TZID=America/New_York:20260510T183000
DTEND;TZID=America/New_York:20260510T193000
LOCATION:456 Dance Ave, Boston, MA
DESCRIPTION:class
END:VEVENT
END:VCALENDAR
```

> Use `DESCRIPTION` to carry the event type: `social`, `class`, or `workshop`.
> This is what maps to the color-coded `calendarId` in Schedule-X.

---

## Step 3 — Create `src/hooks/useIcsEvents.ts`

```ts
import { useState, useEffect } from "react";
import ICAL from "ical.js";
import { ScheduleXEvent, EventType } from "../types/events";

export function useIcsEvents(icsUrl: string) {
  const [events, setEvents] = useState<ScheduleXEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(icsUrl)
      .then((r) => r.text())
      .then((text) => {
        const parsed = ICAL.parse(text);
        const comp = new ICAL.Component(parsed);
        const vevents = comp.getAllSubcomponents("vevent");

        const converted: ScheduleXEvent[] = vevents.map((vevent, i) => {
          const ev = new ICAL.Event(vevent);
          const start = ev.startDate.toJSDate();
          const end = ev.endDate.toJSDate();

          // Format as "YYYY-MM-DD HH:mm" in ET — what Schedule-X expects
          const fmt = (d: Date) =>
            d.toLocaleString("sv-SE", { timeZone: "America/New_York" }).slice(0, 16);

          const description = vevent.getFirstPropertyValue<string>("description") ?? "";
          const validTypes: EventType[] = ["social", "class", "workshop"];
          const calendarId: EventType = validTypes.includes(description as EventType)
            ? (description as EventType)
            : "social";

          return {
            id: vevent.getFirstPropertyValue<string>("uid") ?? String(i),
            title: ev.summary,
            start: fmt(start),
            end: fmt(end),
            calendarId,
            location: vevent.getFirstPropertyValue<string>("location") ?? undefined,
          };
        });

        setEvents(converted);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [icsUrl]);

  return { events, loading, error };
}
```

---

## Step 4 — Swap `src/hooks/useEvent.ts` to use ICS

```ts
// src/hooks/useEvent.ts
import { useIcsEvents } from "./useIcsEvents";

export function useEvents() {
  return useIcsEvents("/events.ics");
}
```

---

## Reverting to Supabase

When Supabase is ready, restore `useEvent.ts` to:

```ts
import { useSupabaseEvents } from "./useSupabaseEvents";

export function useEvents() {
  const { events, loading, error } = useSupabaseEvents();
  return { events, loading, error };
}
```

`Calendar.tsx` never needs to change.

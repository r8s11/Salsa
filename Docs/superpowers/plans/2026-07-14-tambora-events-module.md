# Events Module Redesign (Tambora structure, Ritmo Vivo skin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/calendar` page chrome (stage header, filter toolbar) and the event detail modal to the Tambora handoff's structure, skinned entirely with existing Ritmo Vivo tokens, plus `host`/`recurrence`/`gallery` data plumbing and client-side `.ics` download.

**Architecture:** Component-scoped CSS referencing `src/styles/global.css` vars (no new token system, no Tambora CSS/fonts). Schedule-X stays; its built-in header is hidden and replaced by custom chrome driven by the `@schedule-x/calendar-controls` plugin. New pure utilities (`ics`, `series`, `filterEvents`) are TDD'd; the modal gets component tests.

**Tech Stack:** React 19 + TypeScript + Vite, React Router v7, @schedule-x v4, temporal-polyfill, Supabase, Vitest + Testing Library, lucide-react (new), @schedule-x/calendar-controls (new).

**Spec:** `Docs/superpowers/specs/2026-07-14-tambora-events-module-design.md`

## Global Constraints

- Skin ONLY with existing Ritmo Vivo tokens from `src/styles/global.css` (`--bg`, `--surface`, `--surface-high`, `--card`, `--border*`, `--red*`, `--gold*`, `--tertiary*`, `--text*`, `--font-*`, `--radius-*`, `--glass-blur`, `--glow-primary`). Do NOT import any file from the design handoff zip.
- `CALENDARS_CONFIG` in `src/types/events.ts` must NOT change.
- Preserve verbatim in `EventModal.tsx`: focus-trap effect, focus-restore effect, backdrop-click close, `role="dialog"` / `aria-modal` / `aria-labelledby="modal-title"`, and the `toDate` / `formatDate` / `formatTime` helpers.
- Preserve in `Calendar.tsx`: SEO effects (`updatePageTitle`, `updateMetaDescription`, structured-data injection from the FULL unfiltered event list), `?event=<id>` deep-link open, ESC-to-close, loading/error states, `EventModal` wiring.
- All datetimes: `America/New_York`; Schedule-X strings are `"YYYY-MM-DD HH:mm"`.
- Copy rules: sentence case UI, middot separators (`·`), no emoji. RSVP labels exactly: `Get Tickets` (paid), `RSVP · Free` (free). Reassurance line exactly: `RSVP opens the host's page · pay at the door`.
- Descoped (do NOT build): save/favorite, share, mini-map, `live-band` type, homepage events section, submit-page restyle.
- Commit after every task; messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/events.ts` | modify | +`host`/`recurrence`/`gallery`/`price_type` passthrough fields on `ScheduleXEvent`; mapping |
| `src/types/events.test.ts` | create | mapping passthrough tests |
| `src/utils/ics.ts` | create | pure `.ics` generation + browser download |
| `src/utils/ics.test.ts` | create | ics tests |
| `src/utils/series.ts` | create | weekly series date derivation |
| `src/utils/series.test.ts` | create | series tests |
| `src/utils/filterEvents.ts` | create | pure type-filter helper |
| `src/utils/filterEvents.test.ts` | create | filter tests |
| `src/components/Calendar/Calendar.tsx` | modify | stage header, toolbar, controls plugin, filtering |
| `src/components/Calendar/Calendar.css` | modify | stage header/toolbar/pill CSS, hide sx header |
| `src/components/EventModal/EventModal.tsx` | modify | rebuilt modal markup |
| `src/components/EventModal/EventModal.css` | rewrite | rebuilt modal styles |
| `src/components/EventModal/EventModal.test.tsx` | create | conditional-render + label tests |
| `supabase/migrations/20260714T000000_add_event_module_fields.sql` | create | nullable `host`, `recurrence`, `gallery` |

---

### Task 1: Extend event types with new fields

**Files:**
- Modify: `src/types/events.ts`
- Test: `src/types/events.test.ts` (create)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `DatabaseEvent` gains `host: string | null; recurrence: string | null; gallery: string[] | null;`. `ScheduleXEvent` gains optional `host?: string; recurrence?: string; gallery?: string[]; imageUrl?: string; priceType?: "free" | "paid"; priceAmount?: number;`. `databaseEventToScheduleX` passes all through. Later tasks (modal, ics) rely on these exact names.

Note: the spec lists `host`/`recurrence`/`gallery` as the new columns, but the modal also needs `image_url` and price fields which exist in `DatabaseEvent` yet were never passed to `ScheduleXEvent` — add those passthroughs here too (no DB change needed for them).

- [ ] **Step 1: Install dependencies (worktree has no node_modules)**

Run: `npm install`
Expected: completes without errors; `node_modules/` exists.

- [ ] **Step 2: Write the failing test**

Create `src/types/events.test.ts`:

```ts
import { databaseEventToScheduleX, DatabaseEvent } from "./events";

const baseEvent: DatabaseEvent = {
  id: "abc-123",
  title: "Saturday Social",
  description: "A fun night",
  event_type: "social",
  event_date: "2026-07-18T20:00:00-04:00",
  event_time: null,
  location: "Havana Club",
  address: "288 Green St",
  price_type: "paid",
  price_amount: 20,
  rsvp_link: "https://example.com/rsvp",
  image_url: "https://example.com/poster.jpg",
  status: "approved",
  city: "boston",
  created_at: "2026-07-01T00:00:00Z",
  host: "DJ Cocolo",
  recurrence: "weekly",
  gallery: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
};

describe("databaseEventToScheduleX", () => {
  it("passes through host, recurrence, gallery, image and price fields", () => {
    const result = databaseEventToScheduleX(baseEvent);
    expect(result.host).toBe("DJ Cocolo");
    expect(result.recurrence).toBe("weekly");
    expect(result.gallery).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
    expect(result.imageUrl).toBe("https://example.com/poster.jpg");
    expect(result.priceType).toBe("paid");
    expect(result.priceAmount).toBe(20);
  });

  it("maps null new fields to undefined", () => {
    const result = databaseEventToScheduleX({
      ...baseEvent,
      host: null,
      recurrence: null,
      gallery: null,
      image_url: null,
      price_type: null,
      price_amount: null,
    });
    expect(result.host).toBeUndefined();
    expect(result.recurrence).toBeUndefined();
    expect(result.gallery).toBeUndefined();
    expect(result.imageUrl).toBeUndefined();
    expect(result.priceType).toBeUndefined();
    expect(result.priceAmount).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/types/events.test.ts`
Expected: FAIL — TypeScript errors: `host` does not exist on `DatabaseEvent` fixture / result.

- [ ] **Step 4: Implement the type changes**

In `src/types/events.ts`:

Add to `DatabaseEvent` (after `city: City;`):

```ts
  host: string | null;
  recurrence: string | null;
  gallery: string[] | null;
```

Add to `ScheduleXEvent` (after `city?: City;`):

```ts
  host?: string;
  recurrence?: string;
  gallery?: string[];
  imageUrl?: string;
  priceType?: "free" | "paid";
  priceAmount?: number;
```

Add to the return object of `databaseEventToScheduleX` (after `city: event.city,`):

```ts
    host: event.host ?? undefined,
    recurrence: event.recurrence ?? undefined,
    gallery: event.gallery ?? undefined,
    imageUrl: event.image_url ?? undefined,
    priceType: event.price_type ?? undefined,
    priceAmount: event.price_amount ?? undefined,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/types/events.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full suite (App.test must stay green)**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/types/events.ts src/types/events.test.ts package-lock.json
git commit -m "feat: add host/recurrence/gallery/image/price passthrough to event types

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `.ics` generation utility

**Files:**
- Create: `src/utils/ics.ts`
- Test: `src/utils/ics.test.ts` (create)

**Interfaces:**
- Consumes: `ScheduleXEvent` from Task 1 (uses `id`, `title`, `start`, `end`, `description`, `location`, `address`, `rsvpLink`).
- Produces: `generateIcs(event: ScheduleXEvent): string` (pure) and `downloadIcs(event: ScheduleXEvent): void` (browser download). Task 6 calls `downloadIcs`.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/ics.test.ts`:

```ts
import { generateIcs } from "./ics";
import { ScheduleXEvent } from "../types/events";

const event: ScheduleXEvent = {
  id: "abc-123",
  title: "Saturday Social",
  start: "2026-07-18 20:00",
  end: "2026-07-19 00:00",
  calendarId: "social",
  description: "Line one\nLine two, with comma; and semicolon",
  location: "Havana Club",
  address: "288 Green St",
  rsvpLink: "https://example.com/rsvp",
};

describe("generateIcs", () => {
  it("produces a VCALENDAR wrapping one VEVENT with CRLF line endings", () => {
    const ics = generateIcs(event);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("\r\nBEGIN:VEVENT\r\n");
    expect(ics).toContain("\r\nEND:VEVENT\r\n");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/); // every \n is preceded by \r
  });

  it("formats start/end with the New York TZID", () => {
    const ics = generateIcs(event);
    expect(ics).toContain("DTSTART;TZID=America/New_York:20260718T200000");
    expect(ics).toContain("DTEND;TZID=America/New_York:20260719T000000");
  });

  it("sets UID, SUMMARY, URL and joined LOCATION", () => {
    const ics = generateIcs(event);
    expect(ics).toContain("UID:abc-123@salsasegura.com");
    expect(ics).toContain("SUMMARY:Saturday Social");
    expect(ics).toContain("URL:https://example.com/rsvp");
    expect(ics).toContain("LOCATION:Havana Club\\, 288 Green St");
  });

  it("escapes commas, semicolons and newlines in DESCRIPTION", () => {
    const ics = generateIcs(event);
    expect(ics).toContain(
      "DESCRIPTION:Line one\\nLine two\\, with comma\\; and semicolon"
    );
  });

  it("omits optional lines when fields are missing", () => {
    const ics = generateIcs({
      id: 1,
      title: "Bare Event",
      start: "2026-07-18 20:00",
      end: "2026-07-18 22:00",
      calendarId: "class",
    });
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("URL:");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/ics.test.ts`
Expected: FAIL — cannot resolve `./ics`.

- [ ] **Step 3: Implement `src/utils/ics.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/ics.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/ics.ts src/utils/ics.test.ts
git commit -m "feat: client-side .ics generation utility

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Weekly series derivation utility

**Files:**
- Create: `src/utils/series.ts`
- Test: `src/utils/series.test.ts` (create)

**Interfaces:**
- Consumes: nothing project-specific (uses `temporal-polyfill/global`, already a dependency and imported globally by `src/types/events.ts`).
- Produces: `getUpcomingSeriesDates(start: string, count?: number): Temporal.PlainDateTime[]` — next `count` (default 3) weekly occurrences strictly after `start` (`"YYYY-MM-DD HH:mm"`). Task 6 renders these with `.toLocaleString(...)`.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/series.test.ts`:

```ts
import { getUpcomingSeriesDates } from "./series";

describe("getUpcomingSeriesDates", () => {
  it("returns the next 3 weekly occurrences after the event date", () => {
    const dates = getUpcomingSeriesDates("2026-07-18 20:00");
    expect(dates.map((d) => d.toString())).toEqual([
      "2026-07-25T20:00:00",
      "2026-08-01T20:00:00",
      "2026-08-08T20:00:00",
    ]);
  });

  it("respects a custom count", () => {
    expect(getUpcomingSeriesDates("2026-07-18 20:00", 1)).toHaveLength(1);
  });

  it("preserves wall-clock time across the DST boundary", () => {
    const dates = getUpcomingSeriesDates("2026-10-31 20:00", 2);
    // DST ends 2026-11-01; wall time must stay 20:00
    expect(dates.map((d) => d.toString())).toEqual([
      "2026-11-07T20:00:00",
      "2026-11-14T20:00:00",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/series.test.ts`
Expected: FAIL — cannot resolve `./series`.

- [ ] **Step 3: Implement `src/utils/series.ts`**

```ts
// Purpose: Derive upcoming weekly-series occurrences from an event's start.

import "temporal-polyfill/global";

export function getUpcomingSeriesDates(
  start: string,
  count = 3
): Temporal.PlainDateTime[] {
  const base = Temporal.PlainDateTime.from(start.replace(" ", "T"));
  return Array.from({ length: count }, (_, i) =>
    base.add({ weeks: i + 1 })
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/series.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/series.ts src/utils/series.test.ts
git commit -m "feat: weekly series date derivation utility

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Type-filter helper

**Files:**
- Create: `src/utils/filterEvents.ts`
- Test: `src/utils/filterEvents.test.ts` (create)

**Interfaces:**
- Consumes: `ScheduleXEvent`, `EventType` from `src/types/events.ts`.
- Produces: `type TypeFilter = "all" | EventType` and `filterEventsByType(events: ScheduleXEvent[], filter: TypeFilter): ScheduleXEvent[]`. Task 5 imports both.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/filterEvents.test.ts`:

```ts
import { filterEventsByType } from "./filterEvents";
import { ScheduleXEvent } from "../types/events";

const make = (id: number, calendarId: ScheduleXEvent["calendarId"]): ScheduleXEvent => ({
  id,
  title: `Event ${id}`,
  start: "2026-07-18 20:00",
  end: "2026-07-18 22:00",
  calendarId,
});

const events = [make(1, "social"), make(2, "class"), make(3, "workshop"), make(4, "social")];

describe("filterEventsByType", () => {
  it("returns all events for the 'all' filter", () => {
    expect(filterEventsByType(events, "all")).toHaveLength(4);
  });

  it("returns only matching events for a specific type", () => {
    const socials = filterEventsByType(events, "social");
    expect(socials.map((e) => e.id)).toEqual([1, 4]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterEventsByType([make(1, "class")], "workshop")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/filterEvents.test.ts`
Expected: FAIL — cannot resolve `./filterEvents`.

- [ ] **Step 3: Implement `src/utils/filterEvents.ts`**

```ts
// Purpose: Filter Schedule-X events by event type for the calendar toolbar.

import { EventType, ScheduleXEvent } from "../types/events";

export type TypeFilter = "all" | EventType;

export function filterEventsByType(
  events: ScheduleXEvent[],
  filter: TypeFilter
): ScheduleXEvent[] {
  return filter === "all" ? events : events.filter((e) => e.calendarId === filter);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/filterEvents.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/filterEvents.ts src/utils/filterEvents.test.ts
git commit -m "feat: event type filter helper

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Calendar stage header, toolbar, and Schedule-X controls

**Files:**
- Modify: `src/components/Calendar/Calendar.tsx` (full rewrite below)
- Modify: `src/components/Calendar/Calendar.css` (replace the `.calendar-header`/`.calendar-legend` blocks; add stage/toolbar/pill blocks; keep the `:root` sx vars, status, main, week-view-tweaks, and mobile blocks)

**Interfaces:**
- Consumes: `filterEventsByType`, `TypeFilter` (Task 4); `useCity` from `src/contexts/CityContext` (`{ city: "boston" | "new-york-city", setCity }`); existing `useEvents`, `CALENDARS_CONFIG`, SEO utils.
- Produces: no exports consumed later; the page renders `<EventModal event={selectedEvent} onClose={handleClosedModal} />` exactly as before (Task 6 replaces the modal internals independently).

- [ ] **Step 1: Install the new dependencies**

Run: `npm install @schedule-x/calendar-controls@^4.1.0 lucide-react`
Expected: installs cleanly; `@schedule-x/calendar-controls` resolves to 4.6.x (same major as the other @schedule-x packages).

- [ ] **Step 2: Confirm the calendar-controls `setDate` signature**

Run: `grep -n "setDate\|setView" node_modules/@schedule-x/calendar-controls/dist/index.d.ts node_modules/@schedule-x/shared/dist/**/*.d.ts 2>/dev/null | head`
Expected: `setDate(date: Temporal.PlainDate | string)` or `setDate(date: Temporal.PlainDate)`. The code below passes a `Temporal.PlainDate`; if the signature only accepts `string`, change the two `calendarControls.setDate(next)` call sites to `calendarControls.setDate(next.toString())`.

- [ ] **Step 3: Rewrite `src/components/Calendar/Calendar.tsx`**

Replace the whole file with:

```tsx
import { useState, useEffect, useRef } from "react";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  createViewMonthAgenda,
  createViewList,
} from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { createCalendarControlsPlugin } from "@schedule-x/calendar-controls";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import "temporal-polyfill/global";
import "./Calendar.css";
import "@schedule-x/theme-default/dist/index.css";
import { ScheduleXEvent, CALENDARS_CONFIG, City } from "../../types/events";
import { filterEventsByType, TypeFilter } from "../../utils/filterEvents";
import { useCity } from "../../contexts/CityContext";

import EventModal from "../EventModal/EventModal";
import { useEvents } from "../../hooks/useEvent";
import {
  updatePageTitle,
  updateMetaDescription,
  generateEventsListStructuredData,
  injectStructuredData,
} from "../../utils/seo";

type CalendarView = "month-grid" | "week" | "list";

const CITY_OPTIONS: { value: City; label: string }[] = [
  { value: "boston", label: "Boston" },
  { value: "new-york-city", label: "NYC" },
];

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "month-grid", label: "Month" },
  { value: "week", label: "Week" },
  { value: "list", label: "List" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "social", label: "Social" },
  { value: "class", label: "Class" },
  { value: "workshop", label: "Workshop" },
];

export default function Calendar() {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [activeView, setActiveView] = useState<CalendarView>("month-grid");
  const [visibleDate, setVisibleDate] = useState<Temporal.PlainDate>(() =>
    Temporal.Now.plainDateISO()
  );
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasLoadedFromUrl = useRef(false);
  const { city, setCity } = useCity();

  const { events: eventList, loading, error } = useEvents();

  const [eventsService] = useState(() => createEventsServicePlugin());
  const [calendarControls] = useState(() => createCalendarControlsPlugin());

  const calendar = useCalendarApp({
    views: [
      createViewDay(),
      createViewWeek(),
      createViewMonthGrid(),
      createViewMonthAgenda(),
      createViewList(),
    ],
    defaultView: "month-grid",
    events: [],
    calendars: CALENDARS_CONFIG,
    plugins: [eventsService, calendarControls],
    selectedDate: Temporal.Now.plainDateISO(),
    isDark: true,
    locale: "en-US",
    timezone: "America/New_York",
    theme: "shadcn",
    firstDayOfWeek: 1,
    callbacks: {
      onEventClick(calendarEvent) {
        const fullEvent = eventList.find((e) => String(e.id) === String(calendarEvent.id));
        setSelectedEvent(fullEvent ?? (calendarEvent as unknown as ScheduleXEvent));
      },
    },
  });

  const handleClosedModal = () => {
    setSelectedEvent(null);
    // Remove event parameter from URL
    if (searchParams.has("event")) {
      navigate("/calendar", { replace: true });
    }
  };

  const goToMonth = (deltaMonths: number) => {
    const next =
      deltaMonths === 0
        ? Temporal.Now.plainDateISO()
        : visibleDate.add({ months: deltaMonths });
    setVisibleDate(next);
    calendarControls.setDate(next);
  };

  const handleViewChange = (view: CalendarView) => {
    setActiveView(view);
    calendarControls.setView(view);
  };

  // Update page SEO metadata
  useEffect(() => {
    updatePageTitle("Dance Calendar - Salsa, Bachata & Latin Dance Events");
    updateMetaDescription(
      "Find salsa, bachata, and Latin dance events across Greater Boston and NYC. Browse the community calendar of classes, socials, and workshops."
    );
  }, []);

  // Push freshly fetched (and type-filtered) events into Schedule-X.
  useEffect(() => {
    if (eventList.length === 0) return;
    const calendarEvents = filterEventsByType(eventList, typeFilter).map((event) => ({
      ...event,
      start: Temporal.PlainDateTime.from(event.start.replace(" ", "T")).toZonedDateTime(
        "America/New_York"
      ),
      end: Temporal.PlainDateTime.from(event.end.replace(" ", "T")).toZonedDateTime(
        "America/New_York"
      ),
    }));
    eventsService.set(calendarEvents);

    // Structured data always reflects the full list, not the visual filter
    const structuredData = generateEventsListStructuredData(eventList);
    injectStructuredData(structuredData, "events-list-data");

    // Open event from URL parameter on first load
    const eventIdFromUrl = searchParams.get("event");
    if (eventIdFromUrl && !hasLoadedFromUrl.current) {
      const event = eventList.find((e) => String(e.id) === eventIdFromUrl);
      if (event) {
        hasLoadedFromUrl.current = true;
        // Use setTimeout to avoid setting state during render
        setTimeout(() => setSelectedEvent(event), 0);
      }
    }
  }, [eventList, typeFilter, eventsService, searchParams]);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedEvent(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const cityLabel = city === "boston" ? "Boston" : "NYC";
  const monthTitle = visibleDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="calendar-page">
      <header className="stage-header">
        <div className="stage-inner">
          <div className="stage-left">
            <p className="stage-eyebrow">What's on · {cityLabel}</p>
            <h1 className="stage-title">{monthTitle}</h1>
            <p className="stage-accent">salsa &amp; bachata, hasta la madrugada</p>
          </div>
          <div className="stage-controls">
            <div className="month-nav">
              <button className="nav-btn" aria-label="Previous month" onClick={() => goToMonth(-1)}>
                ‹
              </button>
              <button className="nav-btn today-btn" onClick={() => goToMonth(0)}>
                Today
              </button>
              <button className="nav-btn" aria-label="Next month" onClick={() => goToMonth(1)}>
                ›
              </button>
            </div>
            <div className="pill-group" role="group" aria-label="City">
              {CITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`pill ${city === option.value ? "pill-active-city" : ""}`}
                  aria-pressed={city === option.value}
                  onClick={() => setCity(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="pill-group" role="group" aria-label="Calendar view">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`pill ${activeView === option.value ? "pill-active-view" : ""}`}
                  aria-pressed={activeView === option.value}
                  onClick={() => handleViewChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="calendar-toolbar">
        <div className="toolbar-inner">
          <div className="pill-group" role="group" aria-label="Filter by event type">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`pill ${typeFilter === option.value ? "pill-active-type" : ""}`}
                aria-pressed={typeFilter === option.value}
                onClick={() => setTypeFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-dot social" />
              <span>Social</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot class" />
              <span>Class</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot workshop" />
              <span>Workshop</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading / Error states */}
      {loading && (
        <div className="calendar-status">
          <p>Loading events...</p>
        </div>
      )}
      {error && (
        <div className="calendar-status calendar-error">
          <p>Failed to load events: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* Schedule-X Calendar */}
      <div className="calendar-main">
        <ScheduleXCalendar calendarApp={calendar} />
      </div>

      {/* Submit CTA */}
      <div className="calendar-cta">
        <p>Know about an event that's missing?</p>
        <Link to="/submit" className="btn-primary">
          Submit an Event
        </Link>
      </div>

      {/* Event Detail Modal */}
      <EventModal event={selectedEvent} onClose={handleClosedModal} />
    </div>
  );
}
```

- [ ] **Step 4: Update `src/components/Calendar/Calendar.css`**

Keep unchanged: the `:root { --sx-* }` block, `.calendar-status` / `.calendar-error` blocks, `.calendar-main`, `.sx-react-calendar-wrapper` sizing block, the week-view tweaks section, and the legend-item/dot styles.

Delete: `.calendar-header`, `.calendar-header h1`, `.calendar-header h1::after`, `.calendar-subtitle`, `.calendar-legend`, `.calendar-cta .cta-button` (+ its `:hover`).

Change `.calendar-page` to full-bleed top:

```css
.calendar-page {
  background: var(--bg);
  color: var(--text);
  padding: 0 0 100px;
  margin: 0 auto;
  min-height: calc(100dvh - 68px);
}
```

Add after it:

```css
/* ── Stage header ── */
.stage-header {
  position: relative;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}

.stage-header::before,
.stage-header::after {
  content: "";
  position: absolute;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  pointer-events: none;
}

.stage-header::before {
  top: -180px;
  right: -120px;
  background: radial-gradient(circle, var(--red-glow), transparent 70%);
}

.stage-header::after {
  bottom: -220px;
  left: -140px;
  background: radial-gradient(circle, var(--gold-dim), transparent 70%);
}

.stage-inner {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 104px 24px 32px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
}

.stage-eyebrow {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold);
  margin: 0 0 6px;
}

.stage-title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--text);
  margin: 0;
}

.stage-accent {
  font-family: var(--font-body);
  font-style: italic;
  font-size: 1rem;
  color: var(--tertiary);
  margin: 8px 0 0;
}

.stage-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

/* ── Month nav ── */
.month-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid var(--border-md);
  background: transparent;
  color: var(--text);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.nav-btn:hover {
  border-color: var(--border-lg);
  background: var(--card);
}

.today-btn {
  width: auto;
  padding: 0 16px;
  border-radius: var(--radius-full);
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ── Pills (city / view / type filters) ── */
.pill-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill {
  padding: 8px 16px;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--border-md);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.pill:hover {
  border-color: var(--border-lg);
  color: var(--text);
}

.pill-active-city,
.pill-active-type {
  background: var(--red);
  border-color: var(--red);
  color: #fff;
}

.pill-active-view {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--bg);
}

/* ── Toolbar ── */
.calendar-toolbar {
  background: var(--card);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}

.toolbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
```

Give the main column side padding (replace the existing `.calendar-main` rule):

```css
.calendar-main {
  margin: 0 auto;
  max-width: 1200px;
  padding: 0 24px;
}
```

Hide Schedule-X's built-in header (its nav/view controls are replaced by the stage header) — add near the `.sx-react-calendar-wrapper` block:

```css
.sx-react-calendar-wrapper .sx__calendar-header {
  display: none !important;
}
```

Restyle the CTA link spacing (the button itself now uses the global `.btn-primary`):

```css
.calendar-cta {
  text-align: center;
  margin: 3rem 24px 0;
  padding: 2.5rem 1.5rem 0;
  border-top: 1px solid var(--border);
}

.calendar-cta p {
  font-family: var(--font-body);
  font-size: 0.95rem;
  color: var(--text-muted);
  margin-bottom: 1.25rem;
}
```

In the mobile media query, replace `.calendar-page { padding: 48px 0.75rem 72px; }` with:

```css
  .calendar-page {
    padding: 0 0 72px;
  }

  .stage-inner {
    padding: 88px 16px 24px;
  }

  .toolbar-inner,
  .calendar-main {
    padding-left: 12px;
    padding-right: 12px;
  }
```

- [ ] **Step 5: Type-check and run the suite**

Run: `npx tsc -b && npx vitest run`
Expected: no TS errors; all tests pass.

- [ ] **Step 6: Verify in the browser**

The dev server runs on port 5173 (Browser pane). Navigate to `http://localhost:5173/calendar` and confirm:
- Stage header shows eyebrow `WHAT'S ON · BOSTON`, current month title, italic accent line, rose/gold glows.
- `‹ Today ›` moves the calendar month AND updates the title.
- City pills switch the fetched events (eyebrow label follows).
- View pills switch Month/Week/List; Schedule-X's own header row is gone (single set of controls).
- Type pills visibly filter events; legend dots show rose/blue/gold.
- Clicking an event still opens the (old, pre-Task-6) modal; ESC closes it.

- [ ] **Step 7: Commit**

```bash
git add src/components/Calendar/Calendar.tsx src/components/Calendar/Calendar.css package.json package-lock.json
git commit -m "feat: Tambora-structure stage header, toolbar and filters on calendar page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Event detail modal rebuild

**Files:**
- Modify: `src/components/EventModal/EventModal.tsx` (keep hooks/helpers; replace returned JSX)
- Rewrite: `src/components/EventModal/EventModal.css`
- Test: `src/components/EventModal/EventModal.test.tsx` (create)

**Interfaces:**
- Consumes: `ScheduleXEvent` fields from Task 1 (`imageUrl`, `priceType`, `priceAmount`, `host`, `recurrence`, `gallery`); `downloadIcs(event)` (Task 2); `getUpcomingSeriesDates(start)` (Task 3); global classes `.btn-primary`, `.btn-secondary`, `.style-chip`; `lucide-react` icons (installed in Task 5).
- Produces: same component signature `EventModal({ event, onClose })` — no caller changes.

- [ ] **Step 1: Write the failing tests**

Create `src/components/EventModal/EventModal.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import EventModal from "./EventModal";
import { ScheduleXEvent } from "../../types/events";

const baseEvent: ScheduleXEvent = {
  id: "1",
  title: "Test Social",
  start: "2026-07-18 20:00",
  end: "2026-07-19 00:00",
  calendarId: "social",
  location: "Havana Club",
  rsvpLink: "https://example.com/rsvp",
  priceType: "paid",
  priceAmount: 20,
};

describe("EventModal", () => {
  it("renders nothing when event is null", () => {
    const { container } = render(<EventModal event={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows price and 'Get Tickets' for a paid event", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.getByText("$20")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get tickets/i })).toHaveAttribute(
      "href",
      "https://example.com/rsvp"
    );
  });

  it("shows 'Free' and 'RSVP · Free' for a free event", () => {
    render(
      <EventModal
        event={{ ...baseEvent, priceType: "free", priceAmount: undefined }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rsvp · free/i })).toBeInTheDocument();
  });

  it("hides the RSVP link when rsvpLink is missing", () => {
    render(<EventModal event={{ ...baseEvent, rsvpLink: undefined }} onClose={() => {}} />);
    expect(screen.queryByRole("link", { name: /get tickets/i })).not.toBeInTheDocument();
  });

  it("shows the host row only when host is present", () => {
    const { rerender } = render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.queryByText(/with DJ Cocolo/)).not.toBeInTheDocument();
    rerender(<EventModal event={{ ...baseEvent, host: "DJ Cocolo" }} onClose={() => {}} />);
    expect(screen.getByText("with DJ Cocolo")).toBeInTheDocument();
  });

  it("shows the series list with 3 dates only for weekly recurrence", () => {
    const { rerender } = render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.queryByText(/more dates in this series/i)).not.toBeInTheDocument();
    rerender(
      <EventModal event={{ ...baseEvent, recurrence: "weekly" }} onClose={() => {}} />
    );
    expect(screen.getByText(/more dates in this series/i)).toBeInTheDocument();
    expect(screen.getAllByText("Reserve")).toHaveLength(3);
    expect(screen.getByText("Repeats weekly")).toBeInTheDocument();
  });

  it("shows the gallery strip with a +N tile only when gallery exists", () => {
    const { rerender } = render(<EventModal event={baseEvent} onClose={() => {}} />);
    expect(screen.queryByText(/photos from past nights/i)).not.toBeInTheDocument();
    const gallery = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"];
    rerender(<EventModal event={{ ...baseEvent, gallery }} onClose={() => {}} />);
    expect(screen.getByText(/photos from past nights/i)).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(4);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("keeps dialog semantics and closes via the back pill", () => {
    render(<EventModal event={baseEvent} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("button", { name: /back to calendar/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Test Social" })).toHaveAttribute(
      "id",
      "modal-title"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/EventModal/EventModal.test.tsx`
Expected: FAIL — old markup has no price row, back pill, or series list (first test may pass; that's fine).

- [ ] **Step 3: Rebuild the JSX in `EventModal.tsx`**

Keep everything from the top of the file through the `formatTime` helper unchanged (imports aside). Update the imports to:

```tsx
import React, { useEffect, useRef } from "react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CalendarPlus,
  Clock,
  MapPin,
  Repeat,
  Users,
} from "lucide-react";
import { ScheduleXEvent } from "../../types/events";
import { downloadIcs } from "../../utils/ics";
import { getUpcomingSeriesDates } from "../../utils/series";
import "./EventModal.css";
```

After the `formatTime` helper (and before `return`), add:

```tsx
  const isFree = event.priceType === "free" || event.priceAmount == null;
  const priceLabel = isFree ? "Free" : `$${event.priceAmount}`;
  const rsvpLabel = isFree ? "RSVP · Free" : "Get Tickets";
  const seriesDates =
    event.recurrence === "weekly" ? getUpcomingSeriesDates(event.start) : [];
  const galleryThumbs = event.gallery?.slice(0, 4) ?? [];
  const galleryExtra = (event.gallery?.length ?? 0) - galleryThumbs.length;
```

Replace the returned JSX (everything inside `return ( ... )`) with:

```tsx
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={modalRef}
    >
      <div className="modal-content">
        <div
          className="modal-poster"
          style={
            event.imageUrl
              ? { backgroundImage: `url(${event.imageUrl})` }
              : undefined
          }
        >
          <button className="modal-close back-pill" onClick={onClose}>
            <ArrowLeft size={16} aria-hidden /> Back to calendar
          </button>
          <div className="poster-overlay">
            <span className={`style-chip chip-${event.calendarId}`}>
              {event.calendarId}
            </span>
            <h2 id="modal-title">{event.title}</h2>
          </div>
        </div>

        <div className="modal-grid">
          <div className="modal-details">
            <div className="meta-row">
              <CalendarIcon size={18} aria-hidden />
              <span>{formatDate(event.start)}</span>
              {event.recurrence && (
                <span className="repeat-pill">
                  <Repeat size={12} aria-hidden />
                  {event.recurrence === "weekly" ? "Repeats weekly" : "Repeats"}
                </span>
              )}
            </div>
            {event.location && (
              <div className="meta-row">
                <MapPin size={18} aria-hidden />
                <span>
                  {event.location}
                  {event.address ? ` · ${event.address}` : ""}
                </span>
              </div>
            )}
            <div className="meta-row">
              <Clock size={18} aria-hidden />
              <span>{formatTime(event.start, event.end)}</span>
            </div>
            {event.host && (
              <div className="meta-row">
                <Users size={18} aria-hidden />
                <span>with {event.host}</span>
              </div>
            )}
            {event.description && (
              <p className="modal-description">{event.description}</p>
            )}
            {galleryThumbs.length > 0 && (
              <div className="gallery">
                <h3 className="gallery-eyebrow">Photos from past nights</h3>
                <div className="gallery-row">
                  {galleryThumbs.map((src, index) => (
                    <img
                      key={src}
                      className="gallery-thumb"
                      src={src}
                      alt={`Past night photo ${index + 1}`}
                    />
                  ))}
                  {galleryExtra > 0 && (
                    <span className="gallery-more">+{galleryExtra}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="modal-rsvp">
            <div className="price-row">
              <span className="price-amount">{priceLabel}</span>
              <span className="price-note">per person</span>
            </div>
            {event.rsvpLink && (
              <a
                className="btn-primary rsvp-button"
                href={event.rsvpLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {rsvpLabel}
              </a>
            )}
            <button className="btn-secondary ics-button" onClick={() => downloadIcs(event)}>
              <CalendarPlus size={16} aria-hidden /> Add to calendar
            </button>
            <p className="reassurance">
              RSVP opens the host's page · pay at the door
            </p>
            {seriesDates.length > 0 && (
              <div className="series">
                <h3>More dates in this series</h3>
                {seriesDates.map((date) => (
                  <div key={date.toString()} className="series-item">
                    <span>
                      {date.toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {event.rsvpLink && (
                      <a href={event.rsvpLink} target="_blank" rel="noopener noreferrer">
                        Reserve
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
```

The back pill keeps the `.modal-close` class so the existing initial-focus effect (`querySelector(".modal-close")`) keeps working untouched.

- [ ] **Step 4: Rewrite `src/components/EventModal/EventModal.css`**

Replace the whole file with:

```css
/* ========================================
   Event Modal — Tambora structure, Ritmo Vivo skin
   ======================================== */

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(11, 19, 38, 0.62);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px;
  overflow-y: auto;
}

.modal-content {
  width: 100%;
  max-width: 900px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--glow-primary), 0 30px 60px -18px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* ── Poster header ── */
.modal-poster {
  position: relative;
  height: 248px;
  background-color: var(--surface-high);
  background-image: linear-gradient(150deg, var(--surface-high), var(--red));
  background-size: cover;
  background-position: center;
}

.modal-poster::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(11, 19, 38, 0.82), transparent 55%);
}

.back-pill {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--card);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border-md);
  border-radius: var(--radius-full);
  padding: 8px 14px;
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.back-pill:hover {
  background: var(--card-hover);
  border-color: var(--border-lg);
}

.poster-overlay {
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 18px;
  z-index: 2;
}

.poster-overlay h2 {
  font-family: var(--font-display);
  font-size: 34px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: #fff;
  margin: 8px 0 0;
}

.chip-social { background: var(--red-dim); color: #ffccd4; }
.chip-class { background: rgba(124, 147, 233, 0.18); color: #dfe3ff; }
.chip-workshop { background: var(--gold-dim); color: var(--gold-light); }

/* ── Body grid ── */
.modal-grid {
  display: grid;
  grid-template-columns: 1.45fr 1fr;
}

.modal-details {
  padding: 28px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--text);
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.meta-row svg {
  color: var(--gold);
  flex-shrink: 0;
}

.repeat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--tertiary-dim);
  color: var(--tertiary);
  border-radius: var(--radius-full);
  padding: 3px 10px;
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.modal-description {
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--text-muted);
  line-height: 1.6;
  margin: 16px 0 0;
}

/* ── Gallery ── */
.gallery {
  margin-top: 20px;
}

.gallery-eyebrow {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 10px;
}

.gallery-row {
  display: flex;
  gap: 8px;
}

.gallery-thumb {
  width: 60px;
  height: 60px;
  border-radius: var(--radius);
  object-fit: cover;
}

.gallery-more {
  width: 60px;
  height: 60px;
  border-radius: var(--radius);
  background: var(--card);
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
}

/* ── RSVP panel ── */
.modal-rsvp {
  padding: 28px;
  background: rgba(0, 0, 0, 0.22);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.price-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.price-amount {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 800;
  color: var(--text);
}

.price-note {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--text-muted);
}

.modal-rsvp .rsvp-button,
.modal-rsvp .ics-button {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius-full);
  text-align: center;
}

.reassurance {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
  margin: 0;
}

/* ── Series ── */
.series {
  margin-top: 8px;
}

.series h3 {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 4px;
}

.series-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 0;
  border-top: 1px solid var(--border);
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--text);
}

.series-item a {
  color: var(--gold);
  font-weight: 600;
  text-decoration: none;
}

.series-item a:hover {
  color: var(--gold-light);
  text-decoration: underline;
}

/* ── Mobile ── */
@media (max-width: 720px) {
  .modal-overlay {
    padding: 20px 12px;
  }

  .modal-grid {
    grid-template-columns: 1fr;
  }

  .modal-rsvp {
    border-left: none;
    border-top: 1px solid var(--border);
  }

  .modal-poster {
    height: 200px;
  }

  .poster-overlay h2 {
    font-size: 26px;
  }
}
```

- [ ] **Step 5: Run the modal tests**

Run: `npx vitest run src/components/EventModal/EventModal.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 6: Full suite + type-check**

Run: `npx tsc -b && npx vitest run`
Expected: all green.

- [ ] **Step 7: Verify in the browser**

On `http://localhost:5173/calendar`, click an event:
- Poster header (gradient fallback if no image), back pill closes, chip + title overlay bottom-left.
- Meta rows with gold icons; description below.
- Right panel: price, RSVP button opens host page in new tab, "Add to calendar" downloads an `.ics` (open it — title/time/location correct), reassurance line.
- ESC and backdrop click still close; focus lands on the back pill on open.
- Narrow the window below 720px: columns stack.

- [ ] **Step 8: Commit**

```bash
git add src/components/EventModal/
git commit -m "feat: rebuild event modal with poster header and RSVP panel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Database migration (requires user confirmation to apply)

**Files:**
- Create: `supabase/migrations/20260714T000000_add_event_module_fields.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `events` table columns `host text`, `recurrence text`, `gallery text[]` (all nullable). `useSupabaseEvents` uses `select("*")`, so no client query change is needed.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260714T000000_add_event_module_fields.sql`:

```sql
-- Event module redesign: host, recurrence, gallery (all nullable; UI is
-- conditional on presence, so this is safe to apply before or after deploy).
alter table events
  add column if not exists host text,
  add column if not exists recurrence text,
  add column if not exists gallery text[];
```

- [ ] **Step 2: CHECKPOINT — confirm with the user, then apply**

STOP. Ask the user to confirm applying this migration to their Supabase project. On confirmation, apply it with the Supabase MCP `apply_migration` tool (name: `add_event_module_fields`) against their project, then verify with `list_tables` that `events` now has the three columns. If the user prefers, they can run the SQL in the Supabase dashboard instead.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260714T000000_add_event_module_fields.sql
git commit -m "feat: migration for host/recurrence/gallery event columns

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Final verification pass

**Files:** none new.

- [ ] **Step 1: Lint, test, build**

Run: `npm run lint && npx vitest run && npm run build`
Expected: zero lint errors, all tests pass, `tsc -b && vite build` succeeds.

- [ ] **Step 2: Full manual pass in the browser**

On `http://localhost:5173/calendar`:
1. Month nav / Today / view pills / city pills / type pills all behave (Task 5 checklist).
2. Open an event via click AND via `http://localhost:5173/calendar?event=<real-id>` — both open the modal; closing removes the param.
3. Download an `.ics` and import into a calendar app (or inspect the file) — correct title, TZ, times.
4. If the migration was applied and a test event has `host`/`recurrence`/`gallery` set, confirm those sections appear; otherwise confirm their absence renders cleanly.
5. Mobile width (375px): stage header wraps, toolbar wraps, modal stacks.

- [ ] **Step 3: Commit any straggler fixes**

```bash
git status
# commit any fixes made during verification with a descriptive message
```

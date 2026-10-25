# Events Module Redesign — Tambora Structure, Ritmo Vivo Skin

**Date:** 2026-07-14
**Source:** `Event module wireframe.zip` design handoff ("Events – Tambora")
**Decision:** Adopt the Tambora handoff's *layout, components, and capabilities* for the events experience, but skin everything with the existing **Ritmo Vivo** design tokens (`src/styles/global.css`). The Tambora token files and JSX in the handoff are structure references only — none of their colors, fonts, or CSS files are imported.

## Scope

**In scope (this round):**
1. Calendar page chrome: stage header (eyebrow, live month title, italic accent line, month nav, city toggle, view toggle), toolbar (type filter pills + legend), Schedule-X reskin, restyled Submit CTA.
2. Event detail modal rebuild: poster header, two-column body, price/RSVP panel.
3. DB migration: nullable `host`, `recurrence`, `gallery` columns on `events` + type plumbing.
4. Add-to-calendar: client-side `.ics` generation and download.

**Out of scope (descoped or later phases):**
- Save/favorite and Share buttons.
- Static mini-map placeholder (wait for a real map).
- Homepage "Upcoming Events" section, map-first browse, submit-flow restyle (handoff wireframes 1a–1h).
- `live-band` event type.

## Section 1 — Calendar page (`/calendar`)

All changes in `src/components/Calendar/Calendar.tsx` + `Calendar.css`. Preserve: SEO injection, `?event=<id>` deep-link, ESC close, loading/error states, `EventModal` wiring.

### Stage header (replaces `.calendar-header`)
Full-bleed band, `background: var(--surface)`, two soft radial glows: rose (`--red-glow`) top-right, gold (`--gold-dim`) bottom-left. Inner content max-width 1200px, padding `40px 24px 30px`, flex row space-between, wraps.

- **Left column:**
  - Eyebrow: `WHAT'S ON · {BOSTON|NYC}` — 13px/700 uppercase, letter-spacing `0.14em`, `color: var(--gold)`. City label follows `useCity()`.
  - Month title: current visible month (e.g. "July 2026") — `var(--font-display)` (Epilogue) 800, `clamp(2rem, 4vw, 3rem)`, `color: var(--text)`. Updates when the user navigates months.
  - Accent line: "salsa & bachata, hasta la madrugada" — `var(--font-body)` italic, `color: var(--tertiary)`.
- **Right column (wraps):**
  - Month nav: `‹` `Today` `›` — circular 38px outline buttons, `border: 1.5px solid var(--border-md)`, text `var(--text)`; wired to calendar-controls `setDate`.
  - City toggle: `Boston | NYC` pills → `useCity().setCity("boston" | "new-york-city")`. Active = `--red` fill, white text; inactive = transparent, `--text-muted`, `--border-md` outline.
  - View toggle: `Month | Week | List` pills → calendar-controls `setView("month-grid" | "week" | "list")`. Active = `--gold` fill, `--bg` text; inactive as above.

Default view changes from `week` to `month-grid`.

### Toolbar (new, below header)
Glass strip: `background: var(--card)`, `backdrop-filter: blur(var(--glass-blur))`, bottom border `1px solid var(--border)`, inner max-width 1200px, padding `16px 24px`, space-between, wraps.

- **Left — type filter pills:** `All · Social · Class · Workshop`. Active = `--red` fill, white text; inactive = transparent, `--text-muted`, `1.5px var(--border-md)` outline. Single-select; default `All`.
- **Right — legend:** dot + label per type, 11–12px/700 uppercase, `--text-muted`. Dot colors come from the existing `CALENDARS_CONFIG` darkColors mains: Social `#ff5874`-family rose, Class blue, Workshop gold. `CALENDARS_CONFIG` is **not** changed.

### Filtering behavior
`typeFilter` state (`"all" | EventType`) in `Calendar.tsx`. The existing events-push `useEffect` filters `eventList` by `calendarId` before `eventsService.set(...)`. City changes already refetch via `useEvents()`; no change there.

### Month title tracking
Add `@schedule-x/calendar-controls` plugin. Maintain a `visibleDate` state updated by the nav buttons (and initialized to today); derive the title with `Intl.DateTimeFormat` (`month: "long", year: "numeric"`). `Today` resets to the current date.

### Duplicate controls
The stage header's month nav + view toggle replace Schedule-X's built-in header controls; hide the built-in header (`.sx__calendar-header` or the v4 equivalent) via CSS so there is a single set of controls.

### Schedule-X reskin (`Calendar.css`)
Override on `.sx-react-calendar-wrapper` (verify exact var names against installed `@schedule-x/theme-default` v4):
- `--sx-color-background` → `var(--surface)`
- `--sx-color-surface` / container vars → `var(--surface-high)`
- `--sx-color-on-surface` / text vars → `var(--text)`
- `--sx-color-outline`/`-variant` → `var(--border)`
- today marker / primary accents → `var(--red)`
- `font-family: var(--font-body)`, `border-radius: var(--radius-lg)`, `overflow: hidden`.

### Submit CTA
Keep the block; the link uses the existing `.btn-primary` class.

## Section 2 — Event detail modal

Rebuild markup/CSS of `src/components/EventModal/EventModal.tsx` + `EventModal.css`. **Preserve verbatim:** focus-trap, focus restore, ESC handling, backdrop-click close, `role="dialog"` / `aria-modal` / `aria-labelledby`, and the `toDate`/`formatDate`/`formatTime` helpers.

### Container
- Scrim: `position: fixed; inset: 0; background: rgba(11, 19, 38, 0.62); backdrop-filter: blur(4px);` flex, `align-items: flex-start`, `padding: 40px 20px`, `overflow-y: auto`, `z-index: 100`.
- Card: `max-width: 900px; width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--glow-primary), 0 30px 60px -18px rgba(0,0,0,.5); overflow: hidden;`

### Poster header (~248px)
- Background: `image_url` as `center/cover`; fallback when null = `linear-gradient(150deg, var(--surface-high), var(--red))` with a gold radial glow accent.
- Bottom scrim: `linear-gradient(to top, rgba(11,19,38,.82), transparent 55%)`.
- Top-left: **Back to calendar** pill button (glass: `--card` bg + blur, `--text`, ArrowLeft icon) → `onClose`. This is the element that receives initial focus (replaces `.modal-close` as focus target — keep a `.modal-close` class on it so the existing focus code works, or update the selector).
- Bottom-left overlay: event-type chip (rose for social, blue for class, gold for workshop — reuse/extend `.style-chip` tones), then title — `var(--font-display)` 800, 34px, white, `id="modal-title"`.

### Body — grid `1.45fr / 1fr`, stacks to one column ≤ 720px

**Left (padding 26–28px):**
- Meta rows — 15px `--text`, each with an 18px lucide icon in `var(--gold)`:
  - `Calendar` icon → `formatDate(event.start)`. If `event.recurrence` set: append pill `Repeat` icon + "Repeats weekly" (`--tertiary-dim` bg, `--tertiary` text).
  - `MapPin` icon → `location`, with `address` as secondary line when present.
  - `Clock` icon → `formatTime(start, end)`.
  - `Users` icon → "with {host}" — rendered only when `event.host` present.
- Description paragraph — 15px, `--text-muted`, `line-height: 1.6`.
- **Photos from past nights** — eyebrow label + row of up to 4 thumbnails (56–64px, `--radius`) with a "+N" tile when more; rendered only when `event.gallery?.length > 0`.

**Right (padding 26–28px, `background: rgba(0,0,0,0.22)`, `border-left: 1px solid var(--border)`):**
- Price row: display-font number — `Free` when `price_type === "free"` or amount missing, else `$${price_amount}` — plus 13px `--text-muted` note ("per person").
- **RSVP button** (`.btn-primary`, full-width, pill): label `Get Tickets` (paid) / `RSVP · Free` (free); `href = rsvpLink`, `target="_blank" rel="noopener noreferrer"`. Hidden when no `rsvpLink` (current behavior).
- **Add to calendar** button (`.btn-secondary`, full-width, pill, Calendar icon) → `downloadIcs(event)`.
- Reassurance line: "RSVP opens the host's page · pay at the door" — 12px, `--text-dim`.
- **More dates in this series** — only when `recurrence === "weekly"`: list of the next 3 weekly instances (derived client-side from `event.start` by adding 7-day increments), each date + small "Reserve" link to `rsvpLink`.

## Section 3 — Data model & utilities

### Migration (Supabase `events` table)
```sql
alter table events
  add column if not exists host text,
  add column if not exists recurrence text,
  add column if not exists gallery text[];
```
All nullable; UI renders the related sections only when present, so deploy order is safe in both directions. Apply via Supabase MCP (with user confirmation at that step) or the dashboard.

### Types (`src/types/events.ts`)
- `DatabaseEvent`: `host: string | null; recurrence: string | null; gallery: string[] | null;`
- `ScheduleXEvent`: `host?: string; recurrence?: string; gallery?: string[];`
- `databaseEventToScheduleX()` passes all three through (`?? undefined`).

### `.ics` generation (`src/utils/ics.ts`)
- `generateIcs(event: ScheduleXEvent): string` — pure. Builds `VCALENDAR`/`VEVENT` with `DTSTART`/`DTEND` (`TZID=America/New_York`, from the `"YYYY-MM-DD HH:mm"` strings), `SUMMARY`, `DESCRIPTION`, `LOCATION` (location + address), `URL` (rsvpLink), `UID` (`{id}@salsasegura.com`). Escapes commas, semicolons, newlines per RFC 5545; CRLF line endings.
- `downloadIcs(event)` — wraps in a `Blob` (`text/calendar`), triggers an anchor download named from a slugified title.

### Series derivation (`src/utils/series.ts` or colocated)
- `getUpcomingSeriesDates(start: string, count = 3): Date[]` — pure; next N weekly occurrences strictly after the event's own date.

### New dependencies
`@schedule-x/calendar-controls@^4.1.0`, `lucide-react`.

## Section 4 — Error handling & testing

- Broken/missing `image_url`: gradient fallback via CSS background layering (no JS failure path).
- No `rsvp_link`: RSVP button and series "Reserve" links hidden.
- Events with unexpected `recurrence` values other than `"weekly"`: pill shows "Repeats", series list only renders for `"weekly"`.

**Vitest coverage:**
- `ics.test.ts`: structure, escaping, timezone fields, free vs paid events.
- `series.test.ts`: weekly derivation count and ordering.
- `EventModal.test.tsx`: conditional sections — host row, series list, gallery strip render only with data; RSVP label logic (paid/free); a11y basics still pass.
- Existing test suite stays green; `npm run build` (tsc + vite) passes.

## Verification
Compare against `reference/Events – Tambora.dc.html` for structure/behavior only (not colors). Manual pass: month nav, city + view toggles, type filtering, modal open via click and via `?event=<id>`, `.ics` import into a calendar app.

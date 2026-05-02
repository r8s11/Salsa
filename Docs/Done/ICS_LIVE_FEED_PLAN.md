# Plan — Live ICS Feed (Boston + NYC) as Temporary Event Source

## Context

The Supabase `events` table is still being populated, so the public calendar is empty. To unblock real users **right now**, we'll drive the calendar from the live `golatindance.com` Tribe Events ICS feed (one URL per city). The shape of `useEvents` doesn't change, so `Calendar`, `Events`, and `EventModal` keep working unchanged. Reverting to Supabase later is a one-line edit in [src/hooks/useEvent.ts](../src/hooks/useEvent.ts).

The interesting decisions baked in below:

- **Hosting is Azure Static Web Apps**, which (unlike Vercel/Netlify) doesn't proxy external URLs via `staticwebapp.config.json`. So a tiny **managed Azure Function** at `api/ics` will fetch the upstream feed, cache it server-side, and return it with same-origin CORS. The frontend never talks to `golatindance.com` directly.
- **Two cities** (Boston, NYC) — global **city switcher in the Header**, persisted to `localStorage` via a `CityContext`. Both `useEvents` and the Events page react to the selection.
- **Live fetch on every page load**, with a 1-hour server-side cache (matching upstream's `X-PUBLISHED-TTL: PT1H`).
- **Type bucketing is heuristic**, since the feed only tags `CATEGORIES:Boston` (the city). Title-based: `class`/`lesson` → `class`, `workshop`/`bootcamp` → `workshop`, otherwise → `social`. Imperfect but gives meaningful color coding.
- **`URL` from the feed becomes `rsvpLink`** — it's actually a "View details" link to the golatindance event page, but it's the closest thing to an action link.
- **`LOCATION` becomes `address`**, matching how `EventModal` already renders the field.

---

## Files to create

### 1. `api/ics/index.js` — Azure Function proxy

Azure SWA "managed Functions" auto-discover anything under `api/`. Single function, query param for city.

Behavior:

- Read `req.query.city` — must be `boston` or `new-york-city` (allowlist; anything else → 400).
- Map to upstream URL:
  - `boston` → `https://golatindance.com/?post_type=tribe_events&tribe_events_cat=boston&ical=1&eventDisplay=list`
  - `new-york-city` → `https://golatindance.com/?post_type=tribe_events&tribe_events_cat=new-york-city&ical=1&eventDisplay=list`
- `fetch()` upstream, return body verbatim.
- Response headers: `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: public, max-age=3600` (1 hr, matches upstream's `X-PUBLISHED-TTL`).
- On upstream non-2xx or fetch error → 502 with a short JSON error body.

This file uses Node 18+ global `fetch` (Azure SWA Functions Node 18 runtime). No npm deps inside `api/`.

### 2. `api/host.json` and `api/package.json` (if not present)

Minimal Azure Functions metadata — `host.json` declares `version: "2.0"` and the Function bindings; `package.json` declares the Node engine. Standard SWA boilerplate.

### 3. `staticwebapp.config.json` (create or extend)

Add `navigationFallback` for SPA routing (so deep-link routes like `/calendar` don't 404 on refresh) and ensure `/api/*` routes through to managed functions (default behavior, but worth explicit).

### 4. `src/contexts/CityContext.tsx` — City selection state

Tiny context exposing `{ city: City; setCity: (c: City) => void }` where `City = "boston" | "new-york-city"`.

- Default to `"boston"` (no stored value).
- Initial value read from `localStorage.getItem("salsa.city")` once on mount.
- `setCity` writes to `localStorage` and updates state.
- Export `<CityProvider>` (wraps children) and `useCity()` (hook).

### 5. `src/hooks/useIcsEvents.ts` — fetch + parse

Same return shape as [src/hooks/useSupabaseEvents.ts](../src/hooks/useSupabaseEvents.ts): `{ events: ScheduleXEvent[]; loading: boolean; error: string | null }`.

Signature: `useIcsEvents(city: City)`.

Behavior:

- `useEffect` keyed on `city`, with a `cancelled` flag for unmount safety (mirrors `useSupabaseEvents`).
- `fetch(`/api/ics?city=${city}`)` → `text` → `ICAL.parse` → `ICAL.Component` → `getAllSubcomponents("vevent")`.
- For each VEVENT, build an `ICAL.Event` and produce a `ScheduleXEvent`:

| ScheduleXEvent field | Source |
| --- | --- |
| `id` | `UID` |
| `title` | `SUMMARY` (`ev.summary`) |
| `start` / `end` | `ev.startDate.toJSDate()` → `toLocaleString("sv-SE", { timeZone: "America/New_York" }).slice(0,16)` (gives `"YYYY-MM-DD HH:mm"`) |
| `calendarId` | **Title heuristic** — see below |
| `address` | `LOCATION` (full street string) |
| `location` | (leave undefined — `address` is what `EventModal` uses) |
| `rsvpLink` | `URL` |
| `description` | `DESCRIPTION` (`ical.js` already decodes the `\n`, `\,`, `\;` escapes) |

**Title heuristic** (small helper, e.g. `inferEventType(title: string): EventType`):

```ts
const t = title.toLowerCase();
if (/\b(workshop|bootcamp|intensive)\b/.test(t)) return "workshop";
if (/\b(class|lesson|lessons|crash course)\b/.test(t)) return "class";
return "social";
```

`useEvents` is the *only* place this lives — no leakage into components.

---

## Files to modify

### 6. `package.json`

Add runtime dependency:

```json
"ical.js": "^2.0.1"
```

(Standalone `ical.js`. Distinct from the already-present `@schedule-x/ical`, which we deliberately don't use because it doesn't honor `TZID` and would silently shift events to UTC.)

### 7. [vite.config.ts](../vite.config.ts)

Add a dev-mode proxy so `/api/ics?city=...` works without running the Azure Functions runtime locally:

```ts
server: {
  proxy: {
    "/api/ics": {
      target: "https://golatindance.com",
      changeOrigin: true,
      rewrite: (path) => {
        const url = new URL(path, "http://x");
        const city = url.searchParams.get("city") ?? "boston";
        return `/?post_type=tribe_events&tribe_events_cat=${city}&ical=1&eventDisplay=list`;
      },
    },
  },
},
```

This matches what the production Azure Function does, so the dev experience and prod experience are equivalent.

### 8. [src/main.tsx](../src/main.tsx)

Wrap the app root with `<CityProvider>` so the context is available everywhere (Header switcher + `useEvents`).

### 9. [src/hooks/useEvent.ts](../src/hooks/useEvent.ts)

Replace the body so `useEvents()` reads `city` from `useCity()` and delegates to `useIcsEvents(city)`. Same export name, same return shape — no consumer changes anywhere else.

**Do not delete** [src/hooks/useSupabaseEvents.ts](../src/hooks/useSupabaseEvents.ts). Keeping it intact is what makes the eventual revert a one-line change.

### 10. [src/components/Header/Header.tsx](../src/components/Header/Header.tsx) + [Header.css](../src/components/Header/Header.css)

Add a small city switcher (two pill-style buttons, "Boston" / "NYC") near the existing nav. On click → `setCity(...)`. The active city gets the `crimson` accent (`#C41230`) per the Noche Ardiente system. Mobile: collapses into the existing hamburger menu pattern, or sits above the nav links — whichever is least invasive given current Header markup.

### 11. [src/components/Calendar/Calendar.tsx](../src/components/Calendar/Calendar.tsx) (no logic change)

Confirm that the existing `eventsService.set()` call re-runs when the `events` array reference changes (it already does via the `useEffect`), so a city switch correctly re-renders the calendar grid. No code change expected — just verify during testing.

---

## Out of scope

- No changes to types in [src/types/events.ts](../src/types/events.ts), `EventModal`, `Events.tsx`, or `SubmitEventPage`.
- No tests added. The hook is thin and consumers are already covered.
- No SEO structured-data changes — the existing `injectStructuredData` call in `Calendar.tsx` will pick up whatever events the new hook produces.
- We are **not** trying to dedupe events or merge with future Supabase data. When Supabase comes online, the swap is one line back.

---

## Verification

1. `npm install` — pulls in `ical.js`.
2. `npm run dev` and open `/calendar`:
   - Boston events render in **ET** (a 7 PM event shows at 7 PM, not 11 PM/midnight).
   - Color coding looks plausible (mostly `social`; any title with "Workshop"/"Class" gets the corresponding color).
   - Click an event → `EventModal` shows the full multi-paragraph `DESCRIPTION`, `address`, and a working "View details" link to golatindance.com.
3. Use the Header switcher to flip to **NYC** → calendar refetches and shows different events. Refresh the page → city persists.
4. Visit `/events` → list reflects the selected city's future events.
5. DevTools → Network: `GET /api/ics?city=boston` returns `200`, `Content-Type: text/calendar`, body starts with `BEGIN:VCALENDAR`. (In dev, served by Vite proxy; in prod, by the Azure Function.)
6. `npm run build` — TypeScript check passes.
7. Deploy preview to Azure SWA → repeat steps 2–5 against the deployed URL to confirm the Function actually runs and the proxy is reachable.
8. Force an upstream failure (e.g., temporarily change the upstream URL in the Function to a 404) → confirm the hook surfaces a non-empty `error` and the page shows the existing error UI rather than crashing.

## Reverting later

When Supabase is populated, change [src/hooks/useEvent.ts](../src/hooks/useEvent.ts) back to call `useSupabaseEvents`. Optionally:

- Delete `api/ics/`, `src/hooks/useIcsEvents.ts`, `src/contexts/CityContext.tsx`.
- Remove the city switcher from the Header.
- Remove `ical.js` from `package.json`.
- Remove the `server.proxy` block from `vite.config.ts`.

Or — if you want city-scoped events long-term — keep `CityContext` and have `useSupabaseEvents` filter by city instead.

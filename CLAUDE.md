# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server

# Build
npm run build        # TypeScript check + Vite build

# Tests
npm run test         # Run all tests (vitest)
npx vitest run src/path/to/file.test.tsx  # Run a single test file

# Lint / Format
npm run lint         # ESLint
npm run format       # Prettier (src/**/*.{ts,tsx,css})

# Data
npm run import-events  # Import events from an ICS feed (scripts/import-ics.mjs; dry run by default, --insert / --sql to write)
```

## Environment

Requires a `.env` (or `.env.local`) with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
```

The Supabase client (`src/lib/supabase.ts`) throws at startup if these are missing.

## Architecture

**Stack:** React 19, TypeScript, Vite, React Router v7, Supabase, TanStack Query v5, @schedule-x calendar, temporal-polyfill.

### Directory conventions

- `src/features/<feature>/` — feature-scoped modules, each with its own `model/`, `api/`, `hooks/`, and `components/` as needed (e.g. `src/features/events/`, `src/features/calendar/`, `src/features/submit-event/`).
- `src/shared/` — cross-feature utilities not tied to one feature (e.g. `src/shared/seo/useDocumentMeta.ts`).
- `src/app/` — app-level composition (`providers.tsx` wires `StrictMode` → `QueryClientProvider` → `CityProvider`).
- `src/pages/` — thin route shells; most render a feature's top-level component.
- `src/types/events.ts` is a pure re-export shim (`export * from "../features/events/model/..."`) kept so pre-existing imports of `"../types/events"` keep compiling — new code should import directly from `src/features/events/model/*`.

### Data flow for events (read path)

```
Supabase (events table)
  → eventsRepo.fetchApprovedEvents(city)   [src/features/events/api/eventsRepo.ts]
      .eq("status", "approved").eq("city", city).gte("event_date", <today - 1 day>)
  → useEventsQuery(city)                    [src/features/events/hooks/useEventsQuery.ts]
      TanStack Query, key: ["events", city], staleTime 5 min, retry 1
  → useEvents()                             [src/hooks/useEvent.ts — thin wrapper, entry point for components]
  → databaseEventToScheduleX()              [src/features/events/model/convert.ts]
  → Calendar component feeds converted events into Schedule-X via eventsService.set()
```

- `eventsRepo.ts` is the **only** module that calls `supabase.from("events")` — for both reads (`fetchApprovedEvents`) and writes (`submitEvent`). Never query Supabase directly from a component or hook.
- TanStack Query dedupes the Home ↔ Calendar fetch: navigating between them within the 5-minute `staleTime` window reuses the cache; switching city issues exactly one new request per city.
- `DatabaseEvent` / `ScheduleXEvent` / `CALENDARS_CONFIG` live in `src/features/events/model/{types,calendarsConfig}.ts`.
- `ScheduleXEvent.calendarId` matches the event type (`social` | `class` | `workshop`).
- Events carry a `city` (`boston` | `new-york-city`); `useCity()` (`src/contexts/useCity.ts`, backed by `CityContext.tsx` + `cityContextObject.ts`) + the Header switcher select the active city.

### Timezone policy

`src/features/events/model/convert.ts` is the single place datetime conversion happens. `event_date` in Supabase is `timestamp with time zone` (`timestamptz`) — confirmed via `Docs/sql queries/events.sql`. Conversion parses it as `Temporal.Instant` and renders via `.toZonedDateTimeISO("America/New_York")`, so displayed times are always correct `America/New_York` wall-clock regardless of the visitor's own timezone. `new Date(` must never appear in this file. Output format stays `"YYYY-MM-DD HH:mm"` (what Schedule-X expects). Event duration defaults to `DEFAULT_DURATION_HOURS = 4` (a named constant in `convert.ts`) when an explicit end time isn't given.

Every file using the ambient global `Temporal` (this file, `Calendar.tsx`, `src/utils/series.ts`) must `import "temporal-polyfill/global"` itself — it is not loaded globally by any shared entry point.

### Event utilities (`src/utils/`)

- `filterEvents.ts` — `filterEventsByType` for the calendar toolbar type filters (`TypeFilter = "all" | EventType`)
- `ics.ts` — `generateIcs` / `downloadIcs` for client-side .ics export from the event modal
- `series.ts` — `getUpcomingSeriesDates` derives upcoming dates for weekly recurring events

### Event submission

`SubmitEventPage` is a thin composition shell (`src/pages/SubmitEventPage.tsx`) around `useSubmitEventForm()` (`src/features/submit-event/useSubmitEventForm.ts`), which owns form state, calls `validateSubmitForm()` (`src/features/submit-event/validation.ts`, pure + unit-tested), then `eventsRepo.submitEvent()` with `status: "pending"`. Each `<fieldset>` is its own component under `src/features/submit-event/components/`. Events are only shown on the calendar after manual approval (`status: "approved"`).

### Routing

All routes share `MainLayout` (Header + Footer via `<Outlet>`). Pages other than `HomePage` are lazy-loaded. Route: `/calendar?event=<id>` opens the `EventModal` for a specific event on load, via `useEventDeepLink()` (`src/features/calendar/hooks/useEventDeepLink.ts`) — fires once events have arrived (not a timer), guarded so it never re-opens after being dismissed. ESC closes the modal and strips the `?event=` param (`useEscapeKey()`, `src/features/calendar/hooks/useEscapeKey.ts`).

### SEO

`src/utils/seo.ts` provides low-level DOM helpers:
- `updatePageTitle` / `updateMetaDescription` — update DOM meta tags per page
- `injectStructuredData` — injects/replaces `<script type="application/ld+json">` tags
- Structured data for events (Schema.org `DanceEvent` + `ItemList`) is injected by the Calendar component after events load.

`src/shared/seo/useDocumentMeta.ts` wraps `updatePageTitle` / `updateMetaDescription` as a hook (`useDocumentMeta({ title, description })`) with cleanup that restores the previous title on unmount. Prefer this over calling the imperative helpers directly from a component.

### Content files

`src/content/events/` contains `.md` files (`.draft` and `.pass` suffixes) used as raw event data/templates. Vite is configured with `assetsInclude: ["**/*.md"]` so these can be imported.

### CSS ownership

`src/styles/global.css` holds design tokens (`:root`), resets, layout utilities, `.section-title`, shared buttons (`.btn-*`), `.style-chip`, animations, and focus states only. Page/component-scoped rules live in that component's own `.css` file. `main.tsx` must import `./styles.css` (which `@import`s `global.css`) — without it, every `var(--token)` reference across the app silently resolves to nothing.

### Testing

Vitest + jsdom + `@testing-library/react`. Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom`). Tests use `globals: true` so no explicit imports of `describe`/`it`/`expect` needed. `vite.config.ts`'s `test.exclude` and `eslint.config.js`'s `ignores` both exclude `.claude/**` — don't remove this; agent-tooling worktrees under `.claude/` contain their own stale copies of `src/` that would otherwise be picked up by `npm run lint` / `npx vitest run`.

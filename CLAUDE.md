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
```

## Environment

Requires a `.env` (or `.env.local`) with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
```

The Supabase client (`src/lib/supabase.ts`) throws at startup if these are missing.

## Architecture

**Stack:** React 19, TypeScript, Vite, React Router v7, Supabase, @schedule-x calendar, temporal-polyfill.

### Data flow for events

```
Supabase (events table)
  → useSupabaseEvents (fetch, status=approved, ordered by event_date)
  → useEvents (thin wrapper, entry point for components)
  → databaseEventToScheduleX() in src/types/events.ts
  → Calendar component feeds converted events into Schedule-X via eventsService.set()
```

- `DatabaseEvent` maps directly to the Supabase `events` table schema.
- `ScheduleXEvent` is what Schedule-X consumes; `calendarId` matches the event type (`social` | `class` | `workshop`).
- All datetime handling uses `temporal-polyfill` with `America/New_York` timezone. Schedule-X expects the format `"YYYY-MM-DD HH:mm"`.
- Events are displayed with color-coded calendars defined in `CALENDARS_CONFIG` (`src/types/events.ts`).

### Event submission

`SubmitEventPage` writes directly to Supabase with `status: "pending"`. Events are only shown on the calendar after manual approval (`status: "approved"`).

### Routing

All routes share `MainLayout` (Header + Footer via `<Outlet>`). Pages other than `HomePage` are lazy-loaded. Route: `/calendar?event=<id>` opens the `EventModal` for a specific event on load.

### SEO

`src/utils/seo.ts` provides helpers called imperatively from components:
- `updatePageTitle` / `updateMetaDescription` — update DOM meta tags per page
- `injectStructuredData` — injects/replaces `<script type="application/ld+json">` tags
- Structured data for events (Schema.org `DanceEvent` + `ItemList`) is injected by the Calendar component after events load.

### Content files

`src/content/events/` contains `.md` files (`.draft` and `.pass` suffixes) used as raw event data/templates. Vite is configured with `assetsInclude: ["**/*.md"]` so these can be imported.

### Testing

Vitest + jsdom + `@testing-library/react`. Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom`). Tests use `globals: true` so no explicit imports of `describe`/`it`/`expect` needed.

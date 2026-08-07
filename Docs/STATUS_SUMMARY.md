# SalsaSegura.com - Project Status Summary

> Generated: July 15, 2026 (previous snapshot: February 10, 2026) · Updated: August 4, 2026 (Modernization Blueprint execution, Steps 1-15)

---

## Quick Snapshot

| Item                | Detail                                                        |
| ------------------- | ------------------------------------------------------------- |
| **URL**             | [salsasegura.com](https://www.salsasegura.com)                 |
| **Branch**          | `ritmo-vivo-redesign`                                          |
| **Plan Position**   | Week 28 of the 52-week plan (Jul 9-15); Modernization Blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md) fully executed Steps 1-15 |
| **Last Merges**     | Modernization Blueprint Steps 1-15 (Aug 4) · PR #8 Tambora events module (Jul 15) · PR #7 Ritmo Vivo design migration (Jul 6) |
| **Tests**           | 34 passing across 8 files                                      |
| **Hosting**         | Azure Static Web Apps (GitHub Actions CI/CD, now gated on lint + test) |

---

## Tech Stack

| Layer        | Technology                               |
| ------------ | ----------------------------------------- |
| Framework    | React 19 + TypeScript 5.9                |
| Build        | Vite 7                                   |
| Routing      | React Router DOM 7                       |
| Server state | TanStack Query v5 (`["events", city]`, staleTime 5 min)         |
| Calendar     | Schedule-X 4.6.1 (`@schedule-x/react` capped at 4.1.0 upstream) |
| Backend/DB   | Supabase (PostgreSQL) — client talks to Supabase directly, no API layer |
| Datetime     | temporal-polyfill 0.3.x (1.x bump blocked, see `Docs/plans/TODO.md`), `America/New_York` |
| Contact Form | Web3Forms                                |
| Styling      | Plain component-scoped CSS — "Ritmo Vivo" design system (`DESIGN.md`, tokens in `src/styles/global.css`) |
| Testing      | Vitest 4 + Testing Library               |
| Deployment   | Azure Static Web Apps via GitHub Actions |

---

## What's Built (as of July 2026)

### Core event pipeline ✅

- Supabase `events` table → `eventsRepo.fetchApprovedEvents(city)` → `useEventsQuery` (TanStack Query) → `useEvents` → Schedule-X calendar
- Community submissions via `/submit` (writes `status: "pending"`; approval is manual in the Supabase dashboard)
- Curated import pipeline: `npm run import-events` (`scripts/import-ics.mjs`) — dry-run / insert / SQL-emit modes
- Multi-city groundwork: `city` column (boston / new-york-city), `CityContext`, Boston/NYC switcher in Header

### Events module redesign — "Tambora" (PR #8, merged Jul 15) ✅

- Calendar page stage header, toolbar, and event-type filters (`src/utils/filterEvents.ts`)
- Rebuilt `EventModal` with poster header and RSVP panel
- Client-side `.ics` download (`src/utils/ics.ts`)
- Weekly series date derivation (`src/utils/series.ts`)
- DB migration for host / recurrence / gallery / image / price columns
- Spec & plan: `Docs/superpowers/specs|plans/2026-07-14-tambora-events-module*.md`

### Ritmo Vivo design migration (PR #7, merged Jul 6) ✅

- Full visual redesign: dark-only, high-contrast glassmorphism (spec in `DESIGN.md`)
- Epilogue / Be Vietnam Pro / Great Vibes typography; rose/gold/periwinkle event-type color scheme
- Light-mode toggle removed — dark-only
- Design tokens synced to Claude Design ("Ritmo Vivo" project, `.design-sync/config.json`)

### Earlier foundation ✅

- Multi-page routing with lazy loading: `/`, `/about`, `/contact`, `/calendar`, `/submit`, `/lessons`, `/instructors`, 404
- SEO: Open Graph, Twitter cards, Schema.org `DanceEvent` structured data, sitemap, robots.txt
- Deep-linking: `/calendar?event=<id>` opens the event modal
- Utility test coverage: `filterEvents`, `ics`, `series`, `convert` (timezone), `validation` (form rules) — 34 tests total

---

## What's NOT Built

| Feature (plan week)             | Status |
| ------------------------------- | ------ |
| Authentication (W5)             | Not started — no auth implementation exists yet |
| Moderation dashboard (W6)       | Not started — approval is manual via Supabase dashboard (`Docs/ADMIN_MODERATION_GUIDE.md` is the build guide) |
| Text search (W8)                | Not started — only type filters exist |
| Email notifications (W9)        | Not started |
| Enhanced event pages `/events/[id]` (W11) | Not started — modal deep-link only |
| Map view (W12)                  | Not started |
| Gallery UI (W20)                | DB columns exist (PR #8); no UI component |
| Mobile app                      | Plan only (`Docs/MOBILE_APP_PLAN.md`) |

`src/pages/Schools.tsx` + 5 school detail pages are routed at `/schools` (Modernization Blueprint finding A5 resolved).

---

## Active Plan: Modernization Blueprint

`Docs/plans/MODERNIZATION_BLUEPRINT.md` (audited 2026-07-06) — **all 15 steps executed** (Aug 4, 2026). Summary:

1. **Steps 1-3 (substrate):** removed `@google/design.md`, deleted `bun.lock`, added `packageManager`/`.nvmrc`, added a CI `quality` job (lint + vitest, gates deploy), deleted dead `AuthContext.tsx`, routed `/schools`.
2. **Steps 4-8 (domain core + data layer):** split `src/types/events.ts` into `src/features/events/model/{types,convert,calendarsConfig}.ts` (re-export shim kept for compat); made timezone conversion explicit via `Temporal.Instant` → `America/New_York` (was implicit legacy `Date` — V4 fixed); added `convert.test.ts`; centralized all Supabase event I/O behind `eventsRepo.ts` with a server-side date floor; adopted TanStack Query (`useEventsQuery`), eliminating the Home↔Calendar double-fetch.
3. **Steps 9-11 (decomposition):** extracted pure `validateSubmitForm` + tests; split the 349-line `SubmitEventPage` into a `useSubmitEventForm` hook + one component per fieldset; split `Calendar.tsx`'s 5 mixed concerns into `useEscapeKey`, `useEventDeepLink`, `useDocumentMeta`, `CalendarLegend`, `CalendarStatus`.
4. **Steps 12-14 (hardening + deps):** added `staticwebapp.config.json` security headers + Report-Only CSP (verified zero violations live); consolidated duplicate/dead CSS between `global.css` and component stylesheets; aligned `@schedule-x/*` to latest (`react` capped at 4.1.0 upstream — blueprint's "4.6.0" target doesn't exist for that package); bumped `@supabase/supabase-js` to latest 2.x; attempted `temporal-polyfill` 1.x, **blocked** by a hard `@schedule-x/calendar` peer-dependency pin + a TS ambient-global regression — reverted, documented in `Docs/plans/TODO.md`.
5. **Step 15:** this file + `CLAUDE.md` sync, full regression gate.

**Bugs found and fixed during execution that weren't in the original blueprint:** `main.tsx` was missing `import "./styles.css"` (dropped mid-roadmap), meaning `global.css`'s design tokens/resets were absent from every production build for several steps — silently masked because component CSS still rendered a coherent (if not fully-intended) page; `convert.ts` was missing `import "temporal-polyfill/global"`, causing a `ReferenceError` the moment any event actually reaches the conversion function (masked because the live DB currently has no events matching the app's active-city/future-date filters); `eslint.config.js` had no `files` scope on its base ruleset, so `npm run lint` was scanning `.claude/**` agent-tooling worktrees and failing with 1000+ irrelevant errors — the CI quality gate added in Step 2 was non-functional until this was fixed.

---

## Key Risks & Observations

1. **`temporal-polyfill` stuck on 0.3.x:** `@schedule-x/calendar@4.6.1`'s peer dependency pins the exact string `"0.3.0"`, plus TS loses the ambient global `Temporal` declaration in 1.x's `/global` entrypoint. Blocked until upstream `@schedule-x` loosens the peer range, or the app migrates off the ambient-global import pattern to the named-export API. See `Docs/plans/TODO.md`.
2. **Live DB has no events matching current filters:** every approved event in Supabase is dated before today; `eventsRepo.fetchApprovedEvents`'s date floor (`event_date >= today - 1 day`) means the Home/Calendar pages currently render empty states in production. Not a code bug, but worth knowing before assuming "the calendar is broken" — it's a content-pipeline gap (see below).
3. **Schedule:** At calendar week 28, the codebase covers roughly plan weeks 1-4 + 8 (partial) + 10, plus out-of-order pieces of weeks 14/15/20/21. Auth + moderation (weeks 5-6) remain the biggest blockers for growth milestones.
4. **Milestones:** Q1 milestone (50 events / 100 users by Mar 31) was missed — auth/user accounts never launched. Q2 milestone (1,000 visitors/month) is unmeasurable — no analytics wired.
5. **No calendar content pipeline running:** After the ICS pivot, the calendar shows only events imported + approved by hand — intended, but requires the weekly habit of running the importer (see risk #2 above — this is currently not happening).

---

## Recommended Next Steps (Priority Order)

1. **Run the ICS importer** (`npm run import-events`) to get future events into the DB — the site currently shows empty event lists in production (see Key Risks #2).
2. **Promote the Report-Only CSP to enforcing** (Step 12) once a deploy has run with zero console violations in production.
3. **Retry the `temporal-polyfill` 1.x bump** once `@schedule-x` loosens its peer range, or migrate `convert.ts`/`Calendar.tsx`/`series.ts` off the ambient-global import pattern (see Key Risks #1).
4. **Authentication → Moderation dashboard** (plan weeks 5-6) — still the critical path to community growth.
5. Update this file after each merged PR.

---

_See `Docs/ROADMAP.md` for the week-by-week table and `Docs/plans/MODERNIZATION_BLUEPRINT.md` for the refactor plan._

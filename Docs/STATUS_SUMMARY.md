# SalsaSegura.com - Project Status Summary

> Generated: July 15, 2026 (previous snapshot: February 10, 2026) · Updated: August 11, 2026 (account-linked submissions + My Profile page + OAuth coming-soon shipped)

---

## Quick Snapshot

| Item                | Detail                                                        |
| ------------------- | ------------------------------------------------------------- |
| **URL**             | [salsasegura.com](https://www.salsasegura.com)                 |
| **Branch**          | `ritmo-vivo-redesign`                                          |
| **Plan Position**   | Week 28 of the 52-week plan (Jul 9-15); Modernization Blueprint fully executed; Authentication (W5) + Moderation dashboard (W6) shipped Aug 10; account-linked submissions + Profile page shipped Aug 11 |
| **Last Merges**     | Account-linked submissions + My Profile page + OAuth coming-soon (Aug 11) · Moderation dashboard at /admin (Aug 10) · Local Supabase dev stack + Supabase Auth (Aug 10) · Modernization Blueprint Steps 1-15 (Aug 4) |
| **Tests**           | 51 passing across 12 files                                      |
| **Hosting**          | Azure Static Web Apps (GitHub Actions CI/CD, gated on lint + test — note: this gate does not run `npm run build`/`tsc`, see Key Risks) |
| **Local dev**        | `npx supabase start` — full local Postgres/PostgREST/Auth stack, see `.env.example` |

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
- Community submissions via `/submit` (writes `status: "pending"`, tied to the submitting account via `submitter_id`; email field is read-only/account-derived; optional weekly-recurring checkbox; approval via `/admin`)
- `/profile`: account email, sign out, and a list of the signed-in user's own submissions with live status (Pending/Approved/Rejected) — `src/pages/ProfilePage.tsx`, `src/hooks/useMySubmissions.ts`
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
| Authentication (W5)             | **Shipped Aug 10** — email/password + Apple/Google/GitHub OAuth (`src/contexts/AuthContext.tsx`, `src/pages/SignInPage.tsx`); no role/admin concept yet — see Moderation dashboard below |
| Moderation dashboard (W6)       | **Shipped Aug 10** — `/admin` queue with approve/reject, RLS policies, RequireAdmin guard (`src/pages/AdminPage.tsx`) |
| Account-linked submissions + My Profile | **Shipped Aug 11** — `submitter_id` column + RLS, `/profile` page, Submit Event/My Profile nav links, weekly-recurring checkbox on `/submit`, OAuth buttons disabled ("Coming soon") pending real provider credentials |
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
6. **CI quality gate doesn't run `npm run build`/`tsc`:** the `.github/workflows` quality job runs only `npm run lint` + `npx vitest run`. On 2026-08-10 this let a commit with a genuine missing-module build error (`PendingEventCard.tsx`/`.css` never committed — a chained-command bug during the moderation-dashboard work) land on `main` and pass the quality gate; Azure's own Oryx build caught it and failed the deploy (so production was never actually broken — it kept serving the last-good build), but the gap sat undetected on `main` for hours. Recommend adding a `tsc -b --noEmit` (or the full `npm run build`) step to the quality job.
7. **Fixed 2026-08-11: `Calendar.tsx`'s `onEventClick` closed over a stale `eventList`.** `useCalendarApp`'s `callbacks` config is captured once at calendar-app creation (schedule-x/react never re-evaluates it), so any event created after the calendar's first mount fell back to Schedule-X's raw internal event object on click — silent for most events, but a hard crash (`start.replace is not a function`) for recurring ones, since `series.ts` assumes `start` is the app's plain string format. Pre-existing since the Tambora module (PR #8); never exercised because no event had `recurrence: "weekly"` until this plan's Task 4 added a way to set one through the live UI. Fixed via ref-mirroring (`eventListRef`); see commit history for `Calendar.tsx`.

---

## Recommended Next Steps (Priority Order)

1. **Run the ICS importer** (`npm run import-events`) to get future events into the DB — the site currently shows empty event lists in production (see Key Risks #2).
2. **Add `tsc -b --noEmit` (or `npm run build`) to the CI quality gate** — see Key Risks #6; the current gate would not have caught the 2026-08-10 missing-module incident on its own.
3. **Promote the Report-Only CSP to enforcing** (Step 12) once a deploy has run with zero console violations in production.
4. **Retry the `temporal-polyfill` 1.x bump** once `@schedule-x` loosens its peer range, or migrate `convert.ts`/`Calendar.tsx`/`series.ts` off the ambient-global import pattern (see Key Risks #1).
5. **Text search** (plan week 8) — Moderation dashboard (W6) and account-linked submissions are now done; text search is the next capability on the roadmap.
6. Update this file after each merged PR.

---

_See `Docs/ROADMAP.md` for the week-by-week table and `Docs/plans/MODERNIZATION_BLUEPRINT.md` for the refactor plan._

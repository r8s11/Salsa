# SalsaSegura.com - Project Status Summary

> Generated: July 15, 2026 (previous snapshot: February 10, 2026)

---

## Quick Snapshot

| Item                | Detail                                                        |
| ------------------- | ------------------------------------------------------------- |
| **URL**             | [salsasegura.com](https://www.salsasegura.com)                 |
| **Branch**          | `main` (clean working tree)                                    |
| **Plan Position**   | Week 28 of the 52-week plan (Jul 9-15)                         |
| **Last Merges**     | PR #8 Tambora events module (Jul 15) · PR #7 Ritmo Vivo design migration (Jul 6) |
| **Tests**           | 38 passing across 11 files; 1 suite blocked by stale local `node_modules` (see Risks) |
| **Hosting**         | Azure Static Web Apps (GitHub Actions CI/CD)                   |

---

## Tech Stack

| Layer        | Technology                               |
| ------------ | ---------------------------------------- |
| Framework    | React 19 + TypeScript 5.9                |
| Build        | Vite 7                                   |
| Routing      | React Router DOM 7                       |
| Calendar     | Schedule-X 4 (month/week/day/agenda)     |
| Backend/DB   | Supabase (PostgreSQL) — client talks to Supabase directly, no API layer |
| Datetime     | temporal-polyfill, `America/New_York`    |
| Contact Form | Web3Forms                                |
| Styling      | Plain component-scoped CSS — "Ritmo Vivo" design system (`DESIGN.md`, tokens in `src/styles/global.css`) |
| Testing      | Vitest 4 + Testing Library               |
| Deployment   | Azure Static Web Apps via GitHub Actions |

---

## What's Built (as of July 2026)

### Core event pipeline ✅

- Supabase `events` table → `useSupabaseEvents` (status=approved) → `useEvent` → Schedule-X calendar
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
- Utility test coverage: `filterEvents`, `ics`, `series` (38 tests total)

---

## What's NOT Built

| Feature (plan week)             | Status |
| ------------------------------- | ------ |
| Authentication (W5)             | Not started — `src/contexts/AuthContext.tsx` is an empty file |
| Moderation dashboard (W6)       | Not started — approval is manual via Supabase dashboard (`Docs/ADMIN_MODERATION_GUIDE.md` is the build guide) |
| Text search (W8)                | Not started — only type filters exist |
| Email notifications (W9)        | Not started |
| Enhanced event pages `/events/[id]` (W11) | Not started — modal deep-link only |
| Map view (W12)                  | Not started |
| Gallery UI (W20)                | DB columns exist (PR #8); no UI component |
| Mobile app                      | Plan only (`Docs/MOBILE_APP_PLAN.md`) |

Dead/unrouted code: `src/pages/Schools.tsx` + 5 school detail pages are built but have **no route** in `App.tsx` (Modernization Blueprint finding A5: route or delete).

---

## Active Plan: Modernization Blueprint

`Docs/plans/MODERNIZATION_BLUEPRINT.md` (audited 2026-07-06) — **not yet executed**. Highest-severity findings still open:

1. **V1 (HIGH):** `@google/design.md@^0.3.0` in `dependencies` — unknown/suspicious package, resolved in `package-lock.json`, so it is fetched on every CI build. Remove first.
2. **V2 (HIGH):** Dual lockfiles (`bun.lock` + `package-lock.json`) — non-deterministic builds.
3. **V3 (HIGH):** CI deploys `main` with no lint/test gate.
4. **V4:** Timezone conversion via legacy `Date` in `databaseEventToScheduleX` — displayed times shift for visitors outside Eastern.

---

## Key Risks & Observations

1. **Supply-chain:** `@google/design.md` ships into CI builds today (see above). Top priority.
2. **Local dev broken:** `node_modules` is out of sync with the lockfile — `lucide-react` (used by the rebuilt `EventModal`) is not installed, so `EventModal.test.tsx` and local builds fail. Fix by removing `@google/design.md` from `package.json` **then** running `npm install`.
3. **Schedule:** At calendar week 28, the codebase covers roughly plan weeks 1-4 + 8 (partial) + 10, plus out-of-order pieces of weeks 14/15/20/21. Auth + moderation (weeks 5-6) remain the biggest blockers for growth milestones.
4. **Milestones:** Q1 milestone (50 events / 100 users by Mar 31) was missed — auth/user accounts never launched. Q2 milestone (1,000 visitors/month) is unmeasurable — no analytics wired.
5. **No calendar content pipeline running:** After the ICS pivot, the calendar shows only events imported + approved by hand — intended, but requires the weekly habit of running the importer.

---

## Recommended Next Steps (Priority Order)

1. **Execute Blueprint Phase 0:** remove `@google/design.md`, delete `bun.lock`, `npm install`, verify all 12 test suites pass
2. **Add CI quality gate** (lint + test before deploy) and bump `actions/checkout`
3. **Fix timezone conversion** with Temporal (V4) — correctness bug for non-Eastern visitors
4. **Decide on Schools pages:** route them or delete them (A5)
5. **Authentication → Moderation dashboard** (plan weeks 5-6) — still the critical path to community growth
6. Update this file after each merged PR

---

_See `Docs/ROADMAP.md` for the week-by-week table and `Docs/plans/MODERNIZATION_BLUEPRINT.md` for the refactor plan._

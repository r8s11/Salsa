# SalsaSegura.com - Project Status Summary

> Generated: February 10, 2026

---

## Quick Snapshot

| Item               | Detail                                      |
| ------------------ | ------------------------------------------- |
| **URL**            | www.salsasegura.com                         |
| **Branch**         | `dev` (main = production)                   |
| **Phase**          | 1 — Foundation & MVP (Weeks 1-13)           |
| **Planned Week**   | Week 6 (Feb 5-11 — Moderation Dashboard)    |
| **Actual Progress** | Week 2-3 deliverables completed; Week 4-6 not started |
| **Schedule**       | ~3-4 weeks behind the 52-week plan          |
| **Last Commit**    | `bbcff10` — SEO (Feb 10, 2026)              |
| **Codebase**       | ~1,820 lines of TypeScript/TSX              |
| **Hosting**        | Azure Static Web Apps (GitHub Actions CI/CD)|

---

## Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Framework    | React 19 + TypeScript 5.9               |
| Build        | Vite 7.3                                |
| Routing      | React Router DOM 7                      |
| Calendar     | Schedule-X 4.1 (month/week/day/agenda) |
| Backend/DB   | Supabase (PostgreSQL)                   |
| Contact Form | Web3Forms                               |
| Styling      | Plain CSS (component-scoped files)      |
| Testing      | Vitest + Testing Library                |
| Deployment   | Azure Static Web Apps via GitHub Actions|
| Package Mgr  | npm / Bun                               |

---

## What's Built (Completed)

### Week 1 — Initial Launch ✅
- React app deployed live to Azure
- Markdown-based events rendering
- Event cards with basic styling
- Mobile-responsive layout
- About page, Contact page

### Week 2 — Multi-Page Structure ✅
- Schedule-X calendar integration (replaced React-Big-Calendar)
- Color-coded event types (social=orange, class=blue, workshop=green)
- Month / week / day / agenda view toggle
- Custom event detail modal
- Header + navigation menu
- Multi-page routing (React Router)
- Footer with social links

### Week 3 — Database Backend (Partial) 🔄
- Supabase client configured and connected
- `useSupabaseEvents` hook pulling events from DB
- Database schema defined (`events` table with full fields)
- Seed SQL file exists
- Supabase local dev environment configured
- **Missing:** Admin event management via Supabase dashboard workflow

### Beyond the Plan (Extra Work Done)
- **SEO:** Open Graph tags, Twitter cards, Schema.org structured data, sitemap.xml, robots.txt, geo-targeting
- **Dance School Pages:** 5 school detail pages (SalsaYControl, LiliDance, Masacote, RumbaYTimbal, Querencia)
- **Instructors Page:** Instructor listing route
- **Lessons Page:** Lesson information route
- **Event Submission Form:** `/submit` page started (~10K lines TSX)
- **ESLint + Prettier:** Full linting and formatting pipeline
- **404 Page:** Custom not-found route
- **Azure SPA Config:** Proper SPA fallback routing

---

## What's NOT Built Yet

### Overdue (per 52-week plan)

| Planned Week | Deliverable                | Status       |
| ------------ | -------------------------- | ------------ |
| Week 4       | Community Submissions Beta | Not started  |
| Week 5       | Authentication (signup/login) | Not started |
| Week 6       | Moderation Dashboard       | Not started  |

### Upcoming (Weeks 7-13)

| Week | Deliverable                  |
| ---- | ---------------------------- |
| 7    | Mobile optimization          |
| 8    | Search & basic filters       |
| 9    | Email notifications          |
| 10   | Social sharing (Open Graph)  |
| 11   | Enhanced event pages (/events/[id]) |
| 12   | Map view launch              |
| 13   | **Milestone: 50 events, 100 users** |

**Note:** Week 10 (Social Sharing / Open Graph) is partially done ahead of schedule via the SEO work.

---

## Open TODO Items

From [TODO.md](./TODO.md):
1. Make the Contact page fit all in a single view
2. Add "See full calendar" button in Events component

---

## User Feedback Backlog

From [Feedback.md](./Feedback.md) — 11 feature requests from real users:

| #  | Request                      | Priority | Planned  |
| -- | ---------------------------- | -------- | -------- |
| 1  | Venue AC / quality ratings   | High     | Week 40  |
| 2  | Event homepage redesign      | —        | Week 49  |
| 3  | Event one-liner list view    | Medium   | Week 41  |
| 4  | Event rating system          | Medium   | Week 20  |
| 5  | Performance listings         | Medium   | Week 42  |
| 6  | Workshop/class indicators    | Medium   | Week 43  |
| 7  | Live music indicator         | Medium   | Week 44  |
| 8  | Parking information          | Low      | Week 45  |
| 9  | Music ratio percentage       | Low      | Week 46  |
| 10 | DJ information               | Low      | Week 47  |
| 11 | Peak arrival times           | Low      | Week 48  |

---

## Project Structure

```
Salsa/
├── src/
│   ├── components/    # 14 component folders (Calendar, Events, Header, Hero, etc.)
│   ├── pages/         # 8 routes + 5 school detail pages
│   ├── hooks/         # useSupabaseEvents, useEvent, useMarkdownEvents
│   ├── lib/           # Supabase client
│   ├── types/         # Event interfaces & conversion utilities
│   ├── layouts/       # MainLayout (Header + Outlet + Footer)
│   ├── styles/        # global.css
│   ├── utils/         # seo.ts
│   └── App.tsx        # Router configuration
├── supabase/          # config.toml, seed.sql
├── Docs/              # 14+ documentation files
├── public/            # robots.txt, sitemap.xml
└── .github/workflows/ # Azure deployment pipeline
```

---

## Routes

| Path           | Page              | Status |
| -------------- | ----------------- | ------ |
| `/`            | HomePage          | ✅     |
| `/calendar`    | CalendarPage      | ✅     |
| `/about`       | AboutPage         | ✅     |
| `/contact`     | ContactPage       | ✅     |
| `/submit`      | SubmitEventPage   | 🔄     |
| `/Lessons`     | Lessons           | ✅     |
| `/Instructors` | Instructors       | ✅     |
| `/*`           | NotFoundPage      | ✅     |

---

## Uncommitted Changes

```
Modified:  .gitignore
Untracked: .prettierrc
```

---

## Key Risks & Observations

1. **Schedule Gap:** ~3-4 weeks behind the 52-week plan. Weeks 4-6 (community submissions, auth, moderation) haven't started. These are critical for user growth targets.
2. **Breadth vs Depth:** Work has gone wider (school pages, SEO, lessons, instructors) rather than deeper on the core event pipeline (submit → moderate → approve → display).
3. **Roadmap Stale:** [ROADMAP.md](./ROADMAP.md) last updated Jan 11 — nearly a month out of date.
4. **No Auth System:** User accounts not implemented. This blocks community submissions, RSVP, moderation, and most Phase 2 features.
5. **No Tests Running:** Test infrastructure (Vitest + Testing Library) is set up but no meaningful test coverage exists.
6. **.env in Repo:** The `.env` file appears to be tracked or present locally — ensure secrets aren't committed to git.
7. **Q1 Milestone at Risk:** Target of 50 events + 100 users by Mar 31 requires auth, submissions, and moderation to be live.

---

## Recommended Next Steps (Priority Order)

1. **Finish Supabase integration** — ensure events fully flow from DB to calendar
2. **Build community event submission** (Week 4) — the `/submit` page needs backend wiring
3. **Add authentication** (Week 5) — Supabase Auth is already configured, just needs UI
4. **Build moderation dashboard** (Week 6) — approve/reject submitted events
5. **Update ROADMAP.md** with current actual progress
6. **Fix open TODOs** — Contact page layout, "See full calendar" button
7. **Commit `.prettierrc`** and clean up `.gitignore` changes

---

_Next milestone: 50 events, 100 registered users by March 31, 2026_

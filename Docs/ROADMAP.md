# SalsaSegura.com Roadmap

> Boston's Premier Salsa Events Calendar - 52-Week Development Plan

**Philosophy:** Launch minimal, iterate based on real user feedback
**URL:** www.salsasegura.com
**Status:** Live · Week 28 of 52 · calendar + submissions + local dev stack + auth shipped. The full `/admin` dashboard (Phases 1-14 — events, users, submissions, organizer requests, venues, taxonomy, settings, audit log, analytics) shipped and **closed out Aug 17, 2026**, well beyond this 52-week plan's original "moderation dashboard" (Week 6) scope — see `Docs/STATUS_SUMMARY.md` and `SALSASEGURA_ADMIN_CLOSEOUT.md`.

---

## Current Position (August 17, 2026)

**Done out of order:** the core calendar pipeline (weeks 1-4), type filters (part of week 8), Open Graph (week 10), plus early pieces of recurring events (W15), gallery columns (W21), and multi-city (W22) landed via the Tambora events module (PR #8) and the ICS→Supabase import pivot.
**Done Aug 10-11:** local Supabase dev stack, authentication (W5, email/password + Apple/Google/GitHub OAuth), moderation dashboard (W6), account-linked submissions + `/profile`, and the Rhythm Console UI refresh (Header/Sign-in/Admin/Profile/Calendar).
**Done Aug 11-17 (beyond the original plan):** full Admin Dashboard, Phases 1-14 — closed out, READY TO CLOSE per `SALSASEGURA_ADMIN_CLOSEOUT.md`.
**Current focus:** text search & basic filters (Week 8 remainder) — the only unstarted item blocking further roadmap progress; nothing else is in flight.

## 📊 Progress Overview

### Completed ✅

- [X] React app deployed to Azure
- [X] Schedule-X calendar with color-coded events + month/week/day/agenda views
- [X] Supabase backend (approved-events pipeline)
- [X] Community submissions via `/submit` (pending → manual approval)
- [X] SEO: Open Graph, Twitter cards, Schema.org structured data
- [X] ICS import pipeline (`npm run import-events`) + Boston/NYC city switcher
- [X] Ritmo Vivo design migration (PR #7 — dark glassmorphism, `DESIGN.md`)
- [X] Tambora events module (PR #8 — filters, rebuilt modal, .ics export, series dates)
- [X] Modernization blueprint execution (`plans/MODERNIZATION_BLUEPRINT.md`, Steps 1-15, Aug 4)
- [X] Local Supabase dev stack (`npx supabase start`, Aug 10)
- [X] Authentication launch (email/password + Apple/Google/GitHub OAuth, Aug 10)
- [X] Moderation dashboard (`/admin` queue with approve/reject, Aug 10)
- [X] Rhythm Console UI refresh — Header/Sign-in/Admin/Profile/Calendar (Aug 11)
- [X] Full Admin Dashboard, Phases 1-14 — events, users, submissions, organizer requests, venues, taxonomy, settings, audit log, analytics (Aug 11-17, closed out — beyond original Week 6 scope, see `SALSASEGURA_ADMIN_CLOSEOUT.md`)

### In Progress 🔄

- [ ] Text search & basic filters (Week 8 remainder)

### Next Up 📅

- [ ] Text search - Week 8 remainder (the only item actively next; Week 6 moderation dashboard is done, superseded by the full Admin Dashboard above)
- [ ] Email notifications - Week 9
- [ ] Enhanced event pages `/events/[id]` - Week 11 (currently modal deep-link only)

---

## 📅 52-Week Deliverables

### Quarter 1: Foundation & MVP (Jan 1 - Mar 31)

| Week | Dates          | Deliverable                                  | Status     |
| ---- | -------------- | -------------------------------------------- | ---------- |
| 1    | Jan 1-7        | Basic events calendar LIVE                   | ✅ Done    |
| 2    | Jan 8-14       | Schedule-X calendar + Multi-page             | ✅ Done    |
| 3    | Jan 15-21      | Database backend (Supabase)                  | ✅ Done    |
| 4    | Jan 22-28      | Community submissions (Beta)                 | ✅ Done    |
| 5    | Jan 29 - Feb 4 | Authentication launch                        | ✅ Done (Aug 10, overdue) |
| 6    | Feb 5-11       | Moderation dashboard                         | ✅ Done (Aug 10, overdue) — superseded Aug 17 by full Admin Dashboard (Phases 1-14, `SALSASEGURA_ADMIN_CLOSEOUT.md`) |
| 7    | Feb 12-18      | Mobile optimization                          | 🔄 Partial (responsive layout done) |
| 8    | Feb 19-25      | Search & basic filters                       | 🔄 Partial (type filters, no search) |
| 9    | Feb 26 - Mar 4 | Email notifications                          | 📅 Planned |
| 10   | Mar 5-11       | Social sharing (Open Graph)                  | ✅ Done    |
| 11   | Mar 12-18      | Enhanced event pages (/events/[id])          | 🔄 Partial (modal deep-link `?event=id`) |
| 12   | Mar 19-25      | Map view launch                              | 📅 Planned |
| 13   | Mar 26-31      | **Milestone: 50 events, 100 users** 🎉 | ❌ Missed (auth never launched) |

### Quarter 2: Growth Features (Apr 1 - Jun 30)

| Week | Dates          | Deliverable                                  | Status     |
| ---- | -------------- | -------------------------------------------- | ---------- |
| 14   | Apr 1-8        | Advanced filters (style, skill, price)       | 📅 Planned |
| 15   | Apr 9-15       | Recurring events system                      | 🔄 Partial (series dates + recurrence columns, PR #8) |
| 16   | Apr 16-22      | Event categories & tags                      | 📅 Planned |
| 17   | Apr 23-29      | User profiles enhancement                    | 📅 Planned |
| 18   | Apr 30 - May 6 | RSVP system                                  | 📅 Planned |
| 19   | May 7-13       | Favorites & bookmarks                        | 📅 Planned |
| 20   | May 14-20      | Reviews & ratings                            | 📅 Planned |
| 21   | May 21-27      | Photo gallery                                | 🔄 Partial (DB columns only, no UI) |
| 22   | May 28 - Jun 3 | Multi-city support                           | 🔄 Partial (city column + BOS/NYC switcher) |
| 23   | Jun 4-10       | Venue profiles                               | 📅 Planned |
| 24   | Jun 11-17      | Instructor profiles                          | 📅 Planned |
| 25   | Jun 18-24      | Event series & courses                       | 📅 Planned |
| 26   | Jun 25-30      | **Milestone: 1,000 visitors/month** 🎉 | 📅 Planned |

### Quarter 3: Advanced Features (Jul 1 - Sep 30)

| Week | Dates          | Deliverable                                | Status     |
| ---- | -------------- | ------------------------------------------ | ---------- |
| 27   | Jul 1-8        | Ticket integration (Eventbrite)            | 📅 Planned |
| 28   | Jul 9-15       | Featured events (paid promotion)           | 📅 Planned |
| 29   | Jul 16-22      | Venue partnerships                         | 📅 Planned |
| 30   | Jul 23-29      | Premium user features                      | 📅 Planned |
| 31   | Jul 30 - Aug 5 | Mobile app (PWA)                           | 📅 Planned |
| 32   | Aug 6-12       | Event check-in system (QR)                 | 📅 Planned |
| 33   | Aug 13-19      | Community forums                           | 📅 Planned |
| 34   | Aug 20-26      | Video integration                          | 📅 Planned |
| 35   | Aug 27 - Sep 2 | Performance optimization                   | 📅 Planned |
| 36   | Sep 3-9        | SEO optimization                           | 📅 Planned |
| 37   | Sep 10-16      | Analytics dashboard                        | 📅 Planned |
| 38   | Sep 17-23      | API for third parties                      | 📅 Planned |
| 39   | Sep 24-30      | **Milestone: Regional expansion** 🚀 | 📅 Planned |

### Quarter 4: Polish & Monetization (Oct 1 - Dec 31)

| Week | Dates          | Deliverable                             | Status     |
| ---- | -------------- | --------------------------------------- | ---------- |
| 40   | Oct 1-8        | Venue AC/quality ratings (Feedback #1)  | 📅 Planned |
| 41   | Oct 9-15       | Event one-liner list view (Feedback #3) | 📅 Planned |
| 42   | Oct 16-22      | Performance listings (Feedback #5)      | 📅 Planned |
| 43   | Oct 23-29      | Workshop/class indicators (Feedback #6) | 📅 Planned |
| 44   | Oct 30 - Nov 5 | Live music indicator (Feedback #7)      | 📅 Planned |
| 45   | Nov 6-12       | Parking info (Feedback #8)              | 📅 Planned |
| 46   | Nov 13-19      | Music ratio percentage (Feedback #9)    | 📅 Planned |
| 47   | Nov 20-26      | DJ information (Feedback #10)           | 📅 Planned |
| 48   | Nov 27 - Dec 3 | Peak arrival times (Feedback #11)       | 📅 Planned |
| 49   | Dec 4-10       | Event homepage redesign                 | 📅 Planned |
| 50   | Dec 11-17      | Premium venue subscriptions             | 📅 Planned |
| 51   | Dec 18-24      | Year-end analytics report               | 📅 Planned |
| 52   | Dec 25-31      | **Platform v2.0** 🎉 Year Review  | 📅 Planned |

---

## 🎯 Key Milestones

| Milestone            | Target Date  | Status     |
| -------------------- | ------------ | ---------- |
| 50 events, 100 users | Mar 31, 2026 | ❌ Missed (auth/user accounts never launched) |
| 1,000 visitors/month | Jun 30, 2026 | ❓ Unknown (no analytics wired) |
| Regional expansion   | Sep 30, 2026 | 🔄 Groundwork (NYC city switcher exists) |
| Platform v2.0        | Dec 31, 2026 | 📅 Planned |

---

## 💡 Backlog (from Feedback.md)

| #  | Feature                   | Priority | Target Week |
| -- | ------------------------- | -------- | ----------- |
| 1  | Venue AC ratings          | High     | Week 40     |
| 3  | Event one-liner list      | Medium   | Week 41     |
| 4  | Event rating              | Medium   | Week 20     |
| 5  | Performance listings      | Medium   | Week 42     |
| 6  | Workshop/class indicators | Medium   | Week 43     |
| 7  | Live music indicator      | Medium   | Week 44     |
| 8  | Parking info              | Low      | Week 45     |
| 9  | Music ratio percentage    | Low      | Week 46     |
| 10 | DJ information            | Low      | Week 47     |
| 11 | Peak arrival times        | Low      | Week 48     |

---

## 🔗 Quick Links

- [Status Summary](./STATUS_SUMMARY.md) - Current project snapshot
- [52-Week Plan](./salsa_52week_plan.md) - Detailed weekly breakdown
- [Modernization Blueprint](./plans/MODERNIZATION_BLUEPRINT.md) - Architecture audit & refactor plan
- [Feature Requests](./Feedback.md) - Community feedback

---

## 📈 Progress Legend

| Symbol       | Meaning               |
| ------------ | --------------------- |
| ✅ Done      | Completed             |
| 🔄 Current   | In progress this week |
| 📅 Planned   | Scheduled for future  |
| ⚠️ Blocked | Has blockers          |
| ❌ Skipped   | Deprioritized         |

---

_Last Updated: August 17, 2026_

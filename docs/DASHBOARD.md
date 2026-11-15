# 📊 Progress Dashboard

> Project status reconciled on November 14, 2026 from repository records.
> This is a documentation review, not a fresh production, deployment, or test-suite verification.

---

## 🗓️ Current Status

| Field | Value |
| --- | --- |
| **Last reconciliation** | November 14, 2026 |
| **Implemented foundations** | Authentication, account-linked submissions, and the admin/moderation dashboard are recorded as shipped, not pending Phase 1 work. |
| **Planning position** | Week 28 of 52 belongs to the July learning plan; it is not a verified current delivery schedule. |
| **Next deploy** | No deployment date confirmed by this review. |
| **Evidence** | [August status record](STATUS_SUMMARY.md), [current project guide](../README.md), and the focused runbooks below. |

---

## 🎯 Track 1 – Learning Priorities

These learning priorities retain the July 15, 2026 planning snapshot. Personal learning
progress has not been reverified; the statuses below are historical, not a current assessment.

### Stage 1: Front-End & Fundamentals (15 weeks)

| Skill       | Status     | Notes                                      |
| ----------- | ---------- | ------------------------------------------ |
| React JS    | 🔄 Active  | Building SalsaSegura – applying weekly     |
| Git         | 🔄 Active  | Weekly commits to this repo                |
| SQL         | 🔄 Active  | Supabase/PostgreSQL via project work       |

### Stage 2: Back-End & Cloud (6 months)

| Skill          | Status       | Notes                           |
| -------------- | ------------ | ------------------------------- |
| DevOps         | 📅 Planned   | Start after Stage 1             |
| Azure AZ-204   | 📅 Planned   | Start after Stage 1             |
| FastAPI        | 📅 Planned   | Pair with Python learning       |
| Python         | 📅 Planned   | Pair with FastAPI                |

### Stage 3: Language

| Skill   | Status     | Notes                             |
| ------- | ---------- | --------------------------------- |
| Russian | 📅 Planned | 1 year – vocabulary + grammar     |

---

## 🚀 Track 2 – Project Priorities

### SalsaSegura (www.salsasegura.com)

| Field | Value |
| --- | --- |
| **Foundation delivery** | The modernization blueprint is recorded as completed August 4; the admin dashboard closed out August 17. |
| **Hosting** | Azure Static Web Apps is the documented deployment target; live health was not checked. |
| **Quality gate** | The current [workflow](../.github/workflows/azure-static-web-apps-lemon-stone-01afe980f.yml) runs lint, tests, and a production build. No new pass count is claimed here. |
| **Historical records** | [STATUS_SUMMARY.md](STATUS_SUMMARY.md) · [ROADMAP.md](ROADMAP.md); their dates and open-item lists do not override newer implementation records. |

#### Completed ✅
- [x] React app deployed to Azure
- [x] Schedule-X calendar; current desktop views are month, week, list, and cards, with list/cards on compact screens ([calendar reference](operations/events-and-geography.md#public-calendar-and-event-suggestions)).
- [x] Supabase database backend (approved-events pipeline)
- [x] Community event submissions (`/submit` → pending → manual approval)
- [x] SEO: Open Graph, Twitter cards, Schema.org structured data
- [x] ICS import pipeline (`npm run import-events`) + Boston/NYC city switcher
- [x] Ritmo Vivo design migration (PR #7 — dark glassmorphism, DESIGN.md)
- [x] Tambora events module (PR #8 — filters, rebuilt event modal, .ics export, weekly series)
- [x] Authentication and account-linked submissions, recorded as shipped August 10–11 ([August status record](STATUS_SUMMARY.md#whats-not-built); provider configuration must be checked separately).
- [x] Admin/moderation dashboard Phases 1–14, recorded as closed out August 17 ([status record](STATUS_SUMMARY.md#admin-dashboard--phases-1-14-aug-11-17--closed-out)).
- [x] Modernization blueprint, recorded as completed August 4 ([status record](STATUS_SUMMARY.md#active-plan)).
- [x] Public calendar search and filters, multiple flyers, NYC boroughs, and neighborhoods are documented in the [current event reference](operations/events-and-geography.md); text search is no longer a pending foundation task.

These checkmarks summarize implementation records, not a claim that every provider,
migration, or production integration was exercised during this documentation review.

#### In Progress

No active delivery schedule was verified in this review. The modernization blueprint
is historical completion evidence, not an unfinished current workstream.

#### Next Checks
- [ ] Collect measured, dated baselines and owner-approved goals using the [agent measurement contract](operations/agent-measurement.md); generic template targets are not agreed KPIs.
- [ ] Review [documentation CI acceptance criteria](plans/documentation-ci/eval.md) before implementing the new guard.
- [ ] Revalidate map-view scope and remaining closeout follow-ups before scheduling them; their last status in the August snapshot is not proof of current implementation.

---

### SalsaTD

| Field        | Value              |
| ------------ | ------------------ |
| **Status**   | 📅 Planned         |
| **Notes**    | _Add status here_  |

---

### WODCard

| Field        | Value              |
| ------------ | ------------------ |
| **Status**   | 📅 Planned         |
| **Notes**    | _Add status here_  |

---

## ✅ Weekly Habits Checklist

Use this every week before and after working:

- [ ] Deploy at least 1 new feature or improvement
- [ ] Git commit with a meaningful message
- [ ] Test on mobile
- [ ] Update this dashboard with dated evidence; distinguish recorded delivery from fresh verification
- [ ] Review feedback and next steps
- [ ] Post a social media update (optional)
- [ ] Add 2–3 new events manually to SalsaSegura

---

## 📈 Progress Legend

| Symbol       | Meaning               |
| ------------ | --------------------- |
| ✅ Done      | Completed             |
| 🔄 Active    | In progress this week |
| 📅 Planned   | Scheduled for future  |
| ⚠️ Blocked  | Has blockers          |
| ❌ Skipped   | Deprioritized         |

---

## 🔗 Quick Links

| Document                                                     | Purpose                              |
| ------------------------------------------------------------ | ------------------------------------ |
| [ROADMAP.md](ROADMAP.md)                                   | SalsaSegura 52-week roadmap          |
| [salsa_52week_plan.md](salsa_52week_plan.md)               | Detailed weekly deliverables         |
| [STATUS_SUMMARY.md](STATUS_SUMMARY.md)                     | Historical August implementation record; some later sections contradict its own shipped-work entries |
| [TODO.md](TODO.md)                                         | Short-term to-dos                    |
| [Feedback.md](Feedback.md)                                 | Community feature requests           |
| [MOBILE_APP_PLAN.md](MOBILE_APP_PLAN.md)                   | Mobile app development plan          |
| [operations/agent-measurement.md](operations/agent-measurement.md) | Metric definitions, baseline evidence, and target approval |
| [plans/documentation-ci/eval.md](plans/documentation-ci/eval.md) | Proposed documentation CI acceptance criteria |

---

_Last reconciled: November 14, 2026. Learning and unrelated-project notes retain their original planning status._
_When updating, cite evidence and its date; leave unverified production health and numeric KPIs explicitly unverified._

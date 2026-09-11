# Phase 13 — Analytics & Platform Insights UX/UI

> **Design and manual-SQL delivery for the SalsaSegura Admin Dashboard.** No SQL has been executed against production. This phase builds a focused analytics page that answers operational questions about how SalsaSegura is operating and growing — not a generic BI dashboard.

## 1. Context

Phase 12 established the audit-log Activity UI (`/admin/activity`, `/admin/activity/:id`). The infrastructure (authentication, RBAC, database, roles, permissions, audit triggers) is assumed to exist.

This phase adds **`/admin/analytics`** — a single page of focused, operational metrics with trend charts and quick-filter time ranges. It reuses every established UI pattern: `AdminPageHeader`, `AdminMetricCard`, `AdminViewTabs`, `AdminPagination`, and the `AdminActivityTable`/`AdminActivityToolbar` patterns.

### Data sources (all already exist)
| Source | Used for | Phase |
|---|---|---|
| `events` table | Published event count, event growth, RSVPs, cancellations | baseline |
| `event_submissions` table | Submission funnel (pending/approved/rejected) | P7 |
| `profiles` table + `auth.users` | New user registration, user growth | P5 |
| `audit_logs` table + triggers | Activity volume, moderation actions | P5 |
| `venues` table (planned P13) | Organizer/venue inventory | future |

### What this phase adds
- A **metrics model** (`analyticsQuery.ts`) with typed metric definitions, time-range helpers, and chart-data transformers
- An **analytics RPC** (`admin_analytics_metrics`) that returns all metric cards in a single call for the selected date range
- An **analytics time-series RPC** (`admin_analytics_timeseries`) that returns weekly/daily buckets for trend charts
- A **React page** (`AdminAnalyticsPage`) with metric cards, trend charts, and recent submission activity

## 2. Routing

```text
/admin/analytics              — platform insights page
```

One route, lazy-loaded behind `<RequireAdmin>`. No `:id` detail sub-route — this is a dashboard, not a record browser. (Phase 12's `/admin/activity/:id` covers drill-down into specific actions.)

## 3. Page Layout

Mirrors `AdminOverviewPage` and `AdminEventsPage` grid patterns:

```text
<AdminPageHeader title="Analytics" description="…" />

[ Last 30 days ▼ ] [ Weekly ▼ ]           ← AdminAnalyticsFilters

┌────────┬────────┬────────┬────────┐
│ Published 86 │ New Users 42 │ RSVPs 318 │ Submissions 29 │
└────────┴────────┴────────┴────────┘
                             AdminMetricCard (4-up grid, ↗ on hover)

EVENT ACTIVITY
┌──────────────────────────────────────────┐
│ Published Events by Week                 │
│  ▃▂▅▇▂▃▅▆█ trend chart                   │
└──────────────────────────────────────────┘

SUBMISSION ACTIVITY
┌──────────────────────────────────────────┐
│ Submissions by Week                      │
│  ▁▂▃▄▅▆▇ trend chart                     │
└──────────────────────────────────────────┘

RECENT SUBMISSIONS
┌──────────────────────────────────────────┐
│ Table: 6 rows with View Details link      │
│ ───────────────────────────────────────  │
│ AdminPagination                           │
└──────────────────────────────────────────┘
```

## 4. Metric cards

| Card | Metric | Source | Insight question |
|------|--------|--------|-----------------|
| Published | Count of `approved` events in range | `events` | How many events are live? |
| New Users | Count of `profiles` created in range | `profiles` | Are we growing? |
| RSVPs | Count of non-null `rsvp_link` events | `events` | Engagement signals? |
| Submissions | Count of submissions in range | `event_submissions` | Submission pipeline health? |

Each card shows **current value**, **previous period value**, and **delta** (▲/▼). The delta links to the `/admin/events` or `/admin/users` page filtered to the relevant subset.

### Time ranges (quick filters)
`Last 7 days`, `Last 30 days` (default), `Last 90 days`, `This year (to date)`.

### Granularity (for charts only)
`Daily` (≤ 31 days), `Weekly` (default), `Monthly` (> 90 days). Auto-selected based on range but overridable.

## 5. Trend charts

Each chart is a simple SVG/inline-bar component — no heavy charting library dependency. Two charts:

1. **Published Events by Week** — `events` grouped by week, status = `approved`
2. **Submissions by Week** — `event_submissions` grouped by week, by status (stacked bars or single line)

### Chart data shape
```typescript
interface ChartDataPoint {
  label: string;     // "Aug 4", "Aug 11", etc.
  value: number;
  secondary?: number; // for stacked/before-after comparison
}
```

### Chart component
`AdminTrendChart` — renders an inline SVG bar chart with axis labels, value tooltips on hover, and a subtle grid. Reuses `var(--admin-brand)` / `var(--admin-surface-secondary)` for colors.

## 6. Recent submissions table

Reuses `AdminActivityTable`-style card stack but shows `EventSubmission` rows:

```text
┌────┬─────────────────────────────────────────┐
│ 📋 │ Salsa Social Fundraiser                 │
│    │ Submitter: John Doe · Pending            │
│    │ Aug 13 · Submitted 2d ago               │
├────┼─────────────────────────────────────────┤
│ 📋 │ Bachata Workshop                        │
│    │ Submitter: @mariasalsa · Approved        │
│    │ Aug 10 · Approved 4d ago                │
└────┴─────────────────────────────────────────┘
```

Links to `/admin/submissions/:id` — reuses the existing route.

## 7. Filters

| Filter | Location | Spec |
|--------|----------|------|
| Date range | toolbar (visible) | 4 quick buttons + custom date picker |
| Granularity | toolbar (visible) | Daily / Weekly / Monthly dropdown |

Only two filters — this is intentionally constrained. Deep filtering is not a goal; the Activity page (Phase 12) is for that.

## 8. Data-loading strategy

Two RPC calls for the entire page:

```sql
-- Metrics cards (4 numbers + 4 deltas)
select admin_analytics_metrics(from_date, to_date) → json

-- Trend charts (2 series, one per chart)
select admin_analytics_timeseries(from_date, to_date, granularity) → json
```

Both RPCs are SECURITY DEFINER, granted to `authenticated`, restricted to admin role inside the function. This matches the `admin_audit_log` RPC pattern from Phase 12 and avoids N+1 round-trips.

Pagination for the "Recent submissions" table is handled by the existing `useAdminSubmissions` hook (already server-paginated).

## 9. What this phase does not do

- Real-time / live-updating metrics
- Export to CSV/PDF
- Custom metric builder
- Cohort analysis
- Funnel visualization beyond the submission status counts
- Per-city breakdowns (single-city at a time via `useCity()`)

## 10. SQL files, order, and safety

| Order | File | Purpose | Safety |
|-------|------|---------|--------|
| 1 | `001_create_analytics_views.sql` | SQL views backing the RPCs (`v_analytics_metrics`, `v_analytics_timeseries`) | Additive, read-only |
| 2 | `002_create_analytics_rpcs.sql` | `admin_analytics_metrics()` + `admin_analytics_timeseries()` SECURITY DEFINER RPCs | Additive, read-only |
| 3 | `003_add_analytics_indexes.sql` | Indexes on `events.created_at`, `event_submissions.submitted_at`, `profiles.created_at` | Additive, non-blocking |
| 4 | `004_optional_backfill_dates.sql` | Optional: backfill `submitted_at` from `created_at` for any null `event_submissions.submitted_at` rows | **REVIEW REQUIRED** — UPDATEs existing data |

**Execution order:** 001 → 002 → 003 → 004 (optional).

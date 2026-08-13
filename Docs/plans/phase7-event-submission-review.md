# Phase 7 — Event Submission Review UX/UI (`/admin/submissions`, `/admin/submissions/:id`)

## Context

This phase designs the moderation workspace for reviewing event suggestions before they reach the public calendar: the queue at `/admin/submissions` and the detail workflow at `/admin/submissions/:id`. It serves Admins and Moderators — the brief asks for both roles to review submissions, which is itself a change from today (see the grounded-state table below). Organizer Requests are an explicitly separate surface (already `built: false` in `AdminSidebar.tsx`) and are not covered here. This is a design deliverable only, matching `Docs/plans/phase3-admin-events-management.md`, `phase5-admin-users-management.md`, and `phase6-admin-user-detail-management.md`: no feature code, migrations, or tests are written in this phase, and it stops at "wait for my approval before continuing."

## Grounded state of the codebase

Several premises in the brief — a `venues` table, a working `moderator` role, magic-link auth as a real auth mechanism — are not true today. The rest of this document is built against what's actually there:

| Finding | Evidence |
|---|---|
| No `event_submissions`, `submissions`, `venues`, `organizers`, or `organizer_requests` table exists. The only tables created by migrations are `events`, `profiles`, `audit_logs`. | All 12 files in `supabase/migrations/` |
| `events` has **no** `slug`, `published_at`, `reviewed_by`, `reviewed_at`, or `rejection_reason`. `cancellation_reason` (`20260814000000_events_management_fields.sql:9`) is the only free-text moderation slot, and `useAdminEvents.ts:33-37` clears it on every transition except `cancelled`. | `supabase/migrations/20260101000000_baseline_events_schema.sql:11-29` + later ALTERs |
| `events.status` CHECK is `('draft','pending','approved','rejected','cancelled','archived')`; `source_type` CHECK is `('admin','user_submission','organizer','moderator','imported')`. | `20260814000000_events_management_fields.sql:11-17` |
| **`moderator` grants nothing.** Every RLS policy reads `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`. `profiles.role` is explicitly documented as display-only, not an authorization source. `RequireAdmin` bounces a moderator to `/` exactly like a plain user. | `20260813000000_profiles.sql:1-4`; `20260810000000_admin_moderation_policies.sql:8-19`; `src/components/Auth/RequireAdmin.tsx`; `AuthContext.tsx:78` (`isAdmin: user?.app_metadata?.role === "admin"`) |
| `admin_set_user_role()` already writes the role to **both** `profiles.role` and `auth.users.raw_app_meta_data->>'role'`, so a moderator's JWT does carry `role='moderator'`. The plumbing for moderator auth exists; only the policies and guards don't use it. | `20260815000000_users_management.sql:80-123` |
| Approving/rejecting today is a plain RLS-gated `UPDATE` (`setEventStatus`, `eventsRepo.ts:105-118`). The `events_audit_log` AFTER trigger already writes `event.approved` / `event.rejected` to `audit_logs` automatically — no RPC is required for audit coverage. | `20260813000100_audit_logs.sql:79-81`; `20260814000000_events_management_fields.sql:54+` |
| `admin_user_directory()` already returns per-submitter `contributions` and `pending_count`, and synthesizes `kind='guest'` rows keyed `'guest:'||lower(email)` for submitter emails with no `auth.users` row. | `20260816000000_admin_user_directory_email_verified.sql:10-80` |
| **Magic-link auth does not exist.** `supabase.auth` is called in exactly 5 places (`getSession`, `onAuthStateChange`, `signInWithPassword`, `signUp`, `signOut`). No `signInWithOtp`/`verifyOtp` anywhere. "Magic-link only" is admin-side *presentation* for rows with `submitter_id IS NULL`. | `src/contexts/AuthContext.tsx:16,25,38,51,67` |
| The public submit form is behind `RequireAuth` and always writes `submitter_id = user!.id` (non-null) and `submitter_email = user!.email`. New guest rows cannot be created through the UI — only via anon REST inserts, `scripts/import-ics.mjs:101-104`, or seed data. | `src/features/submit-event/useSubmitEventForm.ts:35-53` |
| Public submit collects 16 fields and enforces **no presence validation** — only `title`, `event_type`, `city`, `event_date` are HTML-`required`. `description`, `location`, `address`, `price`, `rsvp_link`, `submitter_name` can all legitimately arrive empty. | `src/features/submit-event/validation.ts:45-99`; `EventDetailsFieldset.tsx:25-73` |
| **`/admin/submissions` already exists as a placeholder** routing to `AdminEventsPage`, with a `window.location.pathname === "/admin/submissions"` branch inside `parseView`. This is uncommitted working-tree work. There is no `submissions/:id` route. | `src/App.tsx:46`; `src/pages/AdminEventsPage.tsx:~100-107` |
| `AdminSidebar.tsx:36` still has Event Submissions as `built: false` (disabled "Soon" span, no `to`), and `AdminLayout.test.tsx:81` asserts it is **not** a link. `AdminLayout`'s `SECTION_LABEL` has no `/admin/submissions` entry, so the breadcrumb there currently reads "Dashboard". | `src/components/Admin/AdminSidebar.tsx:36`; `src/layouts/AdminLayout.tsx:18-27` |
| Existing reusable-as-is components: `AdminPageHeader`, `AdminViewTabs<V extends string>` (already generic), `AdminPagination`, `AdminActionMenu` + `ActionMenuItem`, `AdminConfirmDialog`, `AdminToast`, `AdminStatusBadge`, `AdminQualityBadge`, `AdminUserAvatar`, `AdminRoleBadge`, `AdminEventForm`. | `src/components/Admin/` |
| `AdminToast` exists and is fully built but is **not used anywhere in app code** — only its own test imports it. Phase 7 is its first real consumer. | repo-wide grep |
| Existing quality vocabulary: `QualityIssue = "venue"|"time"|"image"|"organizer"|"description"|"pricing"|"duplicate"` with `QUALITY_ISSUE_LABEL`. Existing duplicate detection `findPotentialDuplicates(events)` matches case-insensitive title+location within ±24h and returns a flat `Set<string>` of ids — no per-signal breakdown. | `src/features/admin/model/overviewMetrics.ts:76-133` |
| Submitter identity helpers already exist: `displayNameFor` (falls back to `"Guest Submitter"`), `identityLineFor` (`"No public profile"`), `ACCOUNT_KIND_LABEL.guest = "Magic-link only"`, `submitterDisplay(event)`. | `src/features/admin/model/usersQuery.ts:63,94,99`; `eventsQuery.ts:73-79` |

## Core architecture decision

> Introduce a dedicated `public.event_submissions` table. `/admin/submissions` operates exclusively on it; `/admin/events` continues to own canonical calendar events. Approval reads the submission and **creates** an `events` row, preserving the submission permanently with a pointer to what it became.

This direction — including a **hard migration** of the 2 existing `pending` rows out of `events` into `event_submissions` — was chosen over the alternative of continuing to overload `events.status='pending'`. It gives submissions their own lifecycle (`needs_information`, `withdrawn`, moderator-only fields like `internal_note`) without those states ever leaking into the public calendar's status vocabulary, and it makes "preserve the submission after approval" trivial instead of requiring a shadow-copy mechanism bolted onto `events`.

### What the two-table split costs

This is the most important thing in this document. A hard migration moves `pending` rows out of `events`, which breaks every submitter-facing surface that currently reads them. **These are required work in the implementation phase, not optional follow-ups** — the two-table split is not UI-only.

| Surface | Current behavior | Required change |
|---|---|---|
| `src/pages/ProfilePage.tsx` | Lists the signed-in user's submissions via `useMySubmissions` → `fetchMySubmissions(userId)` → `events.eq("submitter_id")`. `canEdit = status 'pending' \|\| 'rejected'`; `canWithdraw = status 'pending'`. | Must read `event_submissions` for pending/rejected, and `events` for approved. |
| `src/pages/UserEventEditPage.tsx` | Edits a pending/rejected `events` row via `updateEventForUser`. | Must edit `event_submissions.submitted_data`. |
| `src/features/events/api/eventsRepo.ts` `submitEvent()` | Inserts into `events` with `status:'pending', source_type:'user_submission'`. | Must insert into `event_submissions`. |
| `withdrawSubmission()` | Hard-deletes a pending `events` row. | Becomes `event_submissions.status = 'withdrawn'` (soft, preserving the record). |
| `admin_user_directory()` RPC | Derives `contributions`, `pending_count`, and all synthesized `guest` rows from `events`. | Must union `event_submissions` or its counts silently go wrong. |
| `deriveOverviewMetrics` | `pendingCount` counts `events.status === 'pending'` — will become permanently `0`. | Must count `event_submissions`. |

**Pre-existing bug found while grounding:** `useSubmitEventForm.ts:52` sends `dance_styles: null` when nothing is selected, but the column is `text[] NOT NULL DEFAULT '{}'` — an explicit NULL bypasses the default. The review UI must not assume `dance_styles` is non-empty or non-null.

## 1. Submission Queue UX

Route `/admin/submissions`, built on the established list-page composition order: `AdminPageHeader` → error banner → `AdminViewTabs` → toolbar card → `role="status"` result count → tabpanel card with table + `AdminPagination` → filter drawer → dialogs.

### Columns

| Column | Content |
|---|---|
| Event | Title as a link to `/admin/submissions/:id`; second line = dance styles as chips, or "No styles listed" |
| Event Date | `Aug 24 · 6:00 PM`; when `event_time` is null, `Aug 24 · Time TBD` |
| Submitted By | `AdminUserAvatar` + `displayNameFor` (registered) or "Guest Submitter" + a "Magic-link only" chip |
| Submitted | Relative age — "30 min ago", "3 hours ago", "2 days ago"; absolute date in `title` |
| Quality | `AdminQualityBadge` reused verbatim, driven by the tiered issue list from §5 |
| Duplicate Risk | "Possible Duplicate" chip only when confidence is `high`; otherwise empty |
| Status | `AdminStatusBadge`-equivalent for submission statuses |
| Actions | `AdminActionMenu` |

### Views

`AdminViewTabs` (already generic), in tab order, with exact predicates:

- `pending` — **default view**. `status === 'pending'`.
- `needs-attention` — `status === 'pending'` AND ≥1 **Required**-tier quality gap.
- `duplicates` — `status === 'pending'` AND ≥1 duplicate candidate at `high` confidence.
- `upcoming-soon` — `status === 'pending'` AND event start is within the next 7 days. These are time-critical: approving them late makes them worthless.
- `all` — everything, including approved/rejected/withdrawn.

`all` goes beyond the brief's four tabs deliberately: the brief requires preserving submissions after approval "for audit/history purposes," which is meaningless without a surface that shows resolved items.

### Row actions

`ActionMenuItem[]`, following the `usersQuery.rowActionItems` matrix pattern: Review (opens detail), Approve, Reject (`tone: "danger"`, `separatorBefore: true`), View Submitter. Approve is omitted from the menu when a Required-tier gap exists — the row menu cannot fix missing data, so it must not offer an action that will fail.

### Filters

Search (200 ms debounce, matching `AdminEventsToolbar`'s `searchInput`/`syncedQ` resync pattern), event-date preset, status, and a "More filters" drawer (city, dance style, submitter kind, quality tier, duplicate risk) cloned structurally from `AdminUsersFilterDrawer`.

### Empty states, distinguished

- Nothing in the database at all → "No submissions yet."
- Filters match nothing → "No submissions match these filters." + Clear all
- `pending` view empty → "You're all caught up." (the brief's exact copy)

## 2. Review-page layout

Route `/admin/submissions/:id`, modeled structurally on `AdminUserDetailPage` (back link → header → body sections → dialogs driven by a `PendingAction` discriminated union).

**Desktop (≥1024px):** CSS grid, `minmax(0, 1fr) 380px`.

- **Left column — Event Information**, in order: **Basic Info** (title, description, dance styles, event type), **Schedule** (date, start time, recurrence), **Venue** (location, address, city), **Pricing** (price type, amount, RSVP link), **Organizer** (host, contact email/instagram/website), **Media** (flyer + gallery).
- **Right column — Review Panel**, in order: **Submitted By**, **Verification**, **Quality**, **Duplicate Check**, **Notes**, then the action stack: **Reject** (`admin-btn--danger`), **Edit & Approve** (`admin-btn--secondary`), **Approve & Publish** (`admin-btn--primary`).

**Sticky behavior:** `position: sticky; top: calc(var(--admin-header-h) + 16px)` — `--admin-header-h: 64px` already exists in `src/styles/admin.css`. Fallback when the panel is taller than the viewport: it scrolls internally with `max-height: calc(100vh - var(--admin-header-h) - 32px); overflow-y: auto`, so the action stack is never unreachable.

**Header** (spans both columns): back link "← Submissions", event title as `<h1>`, status badge, submitted-age line, and a "Review Next →" affordance.

Below 1024px the grid collapses to one column in the mobile order given in §10.

## 3. Registered vs magic-link submitter presentation

Reuse `AdminUserAvatar`, `displayNameFor`, `identityLineFor`, `AdminRoleBadge` verbatim — the vocabulary already exists and must not be duplicated.

**Registered submitter:**
```
[avatar]  Maria Santos
          @mariasalsa
          [Role badge]
          8 previous submissions · 7 approved
          maria@example.com                    ← de-emphasized, smallest text
          View full profile →                  ← /admin/users/:id
```

**Magic-link-only submitter:**
```
[guest avatar]  Guest Submitter
                [Magic-link only]
                Email verified ✓
                1 previous submission
                guest@example.com              ← de-emphasized
                View submitter →               ← /admin/users/guest:<lowercased email>
```

Rules:

- Email is never the primary identifier — it renders last, smallest, in `--admin-text-muted`. It is present because it is operationally necessary. This mirrors the existing treatment in `AdminUsersTable`.
- Magic-link submitters are never required to have a `profiles` row or username. The absence of a username renders as nothing, not as "—" or "No username".
- "Email verified" derives from `email_confirmed_at`; when null, render "Email not verified" with a warning icon **and text** (never color alone).
- Submitter stats come from `admin_user_directory()`. That RPC currently returns `contributions` and `pending_count` but **not** an approved count — the brief's "7 approved" line requires adding `approved_count` to the RPC. This is a required Now-tier change (§13).

## 4. Original-vs-edited data UX

Store moderator corrections in `event_submissions.edited_data jsonb` (null when untouched). The effective value for any field is `coalesce(edited_data->>field, submitted_data->>field)`.

A persisted column is required rather than transient form state because the brief's own Review History lists **Edited** as a timeline entry distinct from **Approved** ("Aug 12 · Venue corrected by @moderator" then "Aug 12 · Approved by @moderator"). Edits must survive independently of approval, which local form state cannot do.

Rendering rules:

- A field with no edit renders as a plain value with **no diff affordance at all** — satisfying the brief's "avoid showing complicated diffs when nothing changed."
- An edited field renders the current value plus a small "Edited" chip and a disclosure:
  ```
  Venue                                    [Edited ▾]
  Havana Club
    ┌ Original   "Havanna salsa monday"
    └ Updated    "Havana Salsa Monday"
  ```
- **Never** a character-level or word-level diff. Whole-value before/after only.
- Accessibility: the disclosure is a real `<button aria-expanded>` (or `<details>`); the two values carry visually-hidden labels "Original value:" and "Updated value:" so the distinction survives without visual layout. Never rely on strikethrough or color to convey which is which.
- A summary count sits at the top of the Event Information column when any edit exists: "3 fields edited by @moderator" — so a reviewer arriving mid-workflow sees it immediately.

## 5. Quality indicators

Extend the existing `QualityIssue` vocabulary rather than inventing a parallel one, and add the tier the brief requires.

| Tier | Issues | Effect on approval |
|---|---|---|
| **Required** | missing `title`, `event_date`, `city`, `event_type` | **Blocks** direct Approve. Edit & Approve stays enabled — it is the way to fix them. |
| **Recommended** | missing `location` (venue), `event_time`, `description` | Approve stays enabled; an inline warning renders next to the action stack naming what is missing. |
| **Optional** | missing `image_url` (flyer), `host` (organizer), `price_type`, `dance_styles` | No friction. Rendered for information only. |

`duplicate` is **removed** from the quality issue list and promoted to its own signal with its own column and its own review-panel section (§6) — it is not a data-completeness problem.

Review-panel rendering:
```
Quality
  ✓ Event name
  ✓ Date & time
  ✓ Dance style
  ✓ Description
  ⚠ Venue not matched
```

`✓` / `⚠` / `✕` glyphs are each paired with text; a screen reader hears "Complete: Event name" / "Recommended: Venue not matched" / "Required: Date missing" via visually-hidden prefixes. Never color-only. **Missing Optional information never prevents approval.**

Deliberately no numeric quality score — a score invites reviewers to optimize a number instead of reading the submission.

## 6. Duplicate detection

Today's `findPotentialDuplicates(events)` returns a flat `Set<string>` with no reason breakdown, which cannot render the brief's required "Same venue / Same date / Similar title" list. New model function alongside it:

```ts
export type DuplicateSignal = "same-venue" | "same-date" | "similar-title" | "same-organizer";

export interface DuplicateCandidate {
  event: DatabaseEvent;          // the existing canonical event
  signals: DuplicateSignal[];
  confidence: "high" | "medium";
}
```

Signal definitions (the contract):

- `same-venue` — `location` trimmed + lowercased equal, both non-empty.
- `same-date` — same calendar day in `America/New_York` (both cities are Eastern; `temporal-polyfill` is already a dependency and already imported by `eventsQuery.ts`).
- `similar-title` — titles normalized (lowercase, strip punctuation, collapse whitespace), then either exact equality or Jaccard similarity of word sets ≥ 0.6.
- `same-organizer` — `host` trimmed + lowercased equal, both non-empty.

Confidence:

- `high` — 3+ signals, **or** (`same-venue` AND `same-date`).
- `medium` — exactly 2 signals.
- 1 signal — **not surfaced at all.** Too noisy to be worth a reviewer's attention.

Candidates are matched against canonical `events` **and** other pending submissions (a duplicate pair can arrive before either is approved).

Panel rendering:
```
Duplicate Check
  ⚠ Possible Duplicate
  Salsa Sundays at Havana Club
  Aug 23 · 7:00 PM
  · Same venue
  · Same date
  · Similar title
  [ View Existing Event ]  [ Not a Duplicate ]  [ Reject as Duplicate ]
```

- `View Existing Event` → `/admin/events?edit=<id>` (the existing convention).
- `Not a Duplicate` → appends the candidate id to `event_submissions.dismissed_duplicate_ids uuid[]`, so the dismissal survives reload. This small column is Now-tier while full "duplicate candidate persistence" stays Later: without it the action is a no-op after refresh, which is worse than not offering it.
- `Reject as Duplicate` → opens the reject dialog pre-filled with reason `duplicate` and records `duplicate_of_event_id`.
- **Automated detection assists, never decides.** No submission is ever auto-rejected.

## 7. Venue matching

**This deviates from the brief and the deviation is stated here prominently.** The brief's "+ Create Venue" presumes a `venues` table. There is none — venue is free text in `events.location`, and the admin venue filter derives its options from `DISTINCT events.location` (`AdminEventsFilterDrawer.tsx:71-74`).

Phase 7 therefore designs venue **normalization**, not venue **creation**:

- Match the submitted `location` against the distinct set of `location` values across canonical events, normalized (trim, lowercase, collapse whitespace).
- **Exact match** → `✓ Matches existing venue` — informational, no action.
- **Fuzzy match** (normalized Jaccard ≥ 0.6, same threshold as title similarity) →
  ```
  Venue
    Submitted:        Havana Club
                      288 Green Street
    Existing venue:   Havana Club
                      288 Green St, Cambridge, MA
    [ Use Existing Venue ]
  ```
  `Use Existing Venue` rewrites the submission's `location` (and `address` when the existing record has a fuller one) to the canonical spelling, recorded as a normal edit in `edited_data`. This has real value today: it keeps the venue filter clean and pre-cleans the data for a future `venues` table.
- **No match** → `New venue — will be recorded as free text.` No "+ Create Venue" button, because there is nothing for it to create. Stating this directly is better than shipping a control that lies about what it does.

**Scope boundary:** a real `venues` entity is needed by both this workflow and the SEO foundation (`Docs/plans/seo-foundation-strategy.md` lists it as Before-Launch), and belongs in its own phase — not inside a moderation phase.

## 8. Approve / Edit & Approve / Reject flows

**Approve & Publish** (primary):

1. Read effective data (`edited_data` over `submitted_data`).
2. Insert an `events` row with `status='approved'`, `source_type='user_submission'`, preserving `submitter_id`/`submitter_email`/`submitter_name`.
3. Update the submission: `status='approved'`, `approved_event_id`, `reviewed_by`, `reviewed_at`.
4. **No confirmation dialog** — the brief's "avoid excessive confirmation dialogs if the action is clear and reversible" applies; the result is fully reversible through normal event management.
5. On success show `AdminToast` (`tone: "success"`): `"Approved — published to the calendar."` with a link to the created event. This is `AdminToast`'s first real consumer in the app.
6. Then advance per §11's queue-efficiency rule.
7. Disabled whenever a Required-tier gap exists, with the reason rendered as text beside the button — never a silently dead control.

**Edit & Approve** (secondary): opens `AdminEventForm` (reused verbatim, seeded via the existing `buildAdminFormFromEvent` shape) inline within the review page — not a separate route, so the reviewer never loses the submitter/duplicate/quality context. Two submit paths from inside the form:

- **Save corrections** — writes `edited_data`, logs `submission.edited`, stays on the review page. This is what makes "Edited" a real timeline entry.
- **Save & Approve** — writes `edited_data`, then runs the Approve flow.

**Reject** (danger): always opens a dialog, because a reason is mandatory. Reason is a required select from the brief's exact list — Duplicate Event, Missing Information, Invalid Venue, Cannot Verify Event, Spam, Inappropriate Content, Outside Platform Scope, Other. The dialog carries two clearly separated fields:

```
Reason for rejection *          [ select ]

Message to submitter            [ textarea ]
  Shared with the submitter.

Internal moderator note         [ textarea ]
  Only visible to moderators and admins. Never shown to the submitter.
```

Rules: reason `Other` requires the internal note to be non-empty (following the `AdminFlagUserDialog` precedent where "Other" requires notes). The two fields are visually separated with distinct helper text and never share a container — the brief's "never expose internal moderation notes accidentally" is a layout requirement, not just a data one. Rejection does **not** delete the submission; it stays visible in the `all` view with its reason.

**Reopen**: a rejected submission can return to `pending` (`submission.reopened`), because rejections are sometimes wrong and the brief lists "Reopened" as a required history event.

## 9. Review history

**Deviate from the brief's suggested `submission_review_actions` table: reuse the existing `audit_logs` table with `entity_type = 'event_submission'`.** `audit_logs` already has the exact shape needed (`actor_id`, `action`, `entity_type`, `entity_id`, `metadata jsonb`, `created_at`), already has admin-read RLS, already has a SECURITY DEFINER write path via triggers, and already has UI vocabulary (`auditLogLabelFor`, `actorLabelFor`) and a hook pattern (`useUserAuditLog`). A parallel table would duplicate all of it for no gain.

Action literals to add to `auditLogLabelFor`:

| Action | Rendered copy |
|---|---|
| `submission.created` | "Submission received" |
| `submission.review_started` | "Review started" |
| `submission.edited` | "{field list} corrected" — from `metadata.fields: string[]` |
| `submission.approved` | "Approved" |
| `submission.rejected` | "Rejected — {reason label}" |
| `submission.marked_duplicate` | "Marked as duplicate" |
| `submission.reopened` | "Reopened" |
| `submission.withdrawn` | "Withdrawn by submitter" |

Written by a SECURITY DEFINER AFTER trigger on `event_submissions`, mirroring `log_event_change()`. Honoring the brief's "do not log every keystroke": one `submission.edited` entry per save, carrying the changed field list — not one per field and never one per keystroke.

Rendering follows the existing `AdminUserDetailPage` timeline (`<ol>`, date + label + actor via `actorLabelFor`):
```
Aug 12 · Submission received
Aug 12 · Venue corrected by @moderator
Aug 12 · Approved by @moderator
```

## 10. Mobile / tablet behavior

Single column below 1024px, in the brief's exact order: **Event Summary → Quality Warnings → Submitter → Event Details → Duplicate Check → Venue → Media → Review Actions.**

Quality warnings rank second deliberately: on a small screen the reviewer must learn the submission is incomplete before scrolling through the fields.

**Sticky bottom action bar** below 768px:
```
┌──────────────────────────────────┐
│  [ Reject ]        [ Approve ]   │
└──────────────────────────────────┘
```

- `position: fixed; bottom: 0`, full width, safe-area inset padding (`env(safe-area-inset-bottom)`).
- The page reserves equal bottom padding so the bar never covers the last section.
- Only the two decisions live in the bar. "Edit & Approve" stays inline in the Review Actions section — three competing primary actions in a fixed bar is how mis-taps happen.
- Touch targets ≥44×44px, consistent with the existing `--admin-btn` min-height of 40px raised for this bar.

The queue at <768px uses the established dual table + card-list pattern (`AdminEventsTable`/`AdminUsersTable` render both; CSS decides). The card shows title, date, submitter, quality, and duplicate risk — dropping the Submitted-age column, which is the least decision-relevant.

**Desktop side-by-side layouts are never forced onto mobile.**

## 11. Queue efficiency

After a successful approve or reject, the review page advances to the next submission in the currently filtered, currently sorted queue — preserving the reviewer's view/filter context so a themed pass ("clear all duplicates") isn't broken up.

- Render `Review Next Submission →` as the affordance.
- When the queue is exhausted: `You're all caught up.` (the brief's exact copy), with a link back to `/admin/submissions`.
- Advancing is **explicit, never automatic** — auto-jumping after a decision steals the moment where a reviewer confirms they did the right thing, and makes accidental double-actions likely.

## 12. Theme and accessibility

Inherits the Phase 1 (revision) theme system verbatim — `.admin-shell[data-theme="dark"]`, light/dark/system via `ThemeContext`, all colors from `--admin-*` tokens, zero hardcoded hex.

- **Status never color-only.** Every submission status, quality tier, and duplicate flag pairs its color with both text and a shape/icon — the three-signal rule already used by `AdminStatusBadge`.
- **Keyboard.** Approve / Edit & Approve / Reject are real `<button>`s in DOM order, reachable by Tab, activated by Enter and Space. The queue's row action menu already provides roving arrow-key navigation via `AdminActionMenu`.
- **Dialogs manage focus.** Reject dialog focuses its reason select on mount and restores the previously focused element on unmount, matching `AdminFlagUserDialog` and `AdminConfirmDialog`. `AdminDuplicateEventDialog` is the existing exception that fails to restore focus — Phase 7's dialogs must not copy that.
- **Warnings include text.** No bare `⚠` glyph anywhere; every icon has an adjacent or visually-hidden text label.
- **Original/edited legible to assistive tech** — per §4's visually-hidden "Original value:" / "Updated value:" labels.
- **Touch targets** ≥44×44px on the mobile action bar.
- **Contrast**: every new token pair must clear WCAG AA 4.5:1 for normal text in both themes. Known open issue: `--admin-brand` (#e11d48) measures 3.71:1 as small text on the dark card surface and already fails AA — any new brand-colored small text in this phase must use `--admin-brand-hover` (#f43f5e, 4.75:1) instead.
- **Live regions**: the result count is `role="status"`; action failures render `role="alert"`.

## 13. Database recommendations (Now / Later / Avoid)

### Recommended Now

`public.event_submissions`:
```
id                     uuid pk default gen_random_uuid()
submitter_id           uuid null references auth.users(id)     -- null = magic-link/anon
submitter_email        text null
submitter_name         text null
status                 text not null default 'pending'
                         check (status in ('pending','in_review','needs_information',
                                           'approved','rejected','withdrawn'))
submitted_data         jsonb not null            -- immutable original, never mutated
edited_data            jsonb null                -- moderator corrections only
submitted_at           timestamptz not null default now()
reviewed_by            uuid null references auth.users(id)
reviewed_at            timestamptz null
rejection_reason       text null check (rejection_reason in
                         ('duplicate','missing_information','invalid_venue',
                          'cannot_verify','spam','inappropriate','out_of_scope','other'))
rejection_message      text null                 -- shown to submitter
internal_note          text null                 -- NEVER shown to submitter
duplicate_of_event_id  uuid null references public.events(id) on delete set null
dismissed_duplicate_ids uuid[] not null default '{}'
approved_event_id      uuid null references public.events(id) on delete set null
created_at             timestamptz not null default now()
updated_at             timestamptz not null default now()
```

Columns beyond the brief's field list, and why: `edited_data` (§4 — "Edited" must be a timeline entry independent of approval), `internal_note` (the brief demands internal notes be separate from the submitter message but lists no column for them), `duplicate_of_event_id` and `dismissed_duplicate_ids` (§6 — makes "Reject as Duplicate" and "Not a Duplicate" actually mean something).

`in_review` and `needs_information` are included in the CHECK from day one but **no Phase 7 UI writes them** — they are in the constraint so Later features don't require a constraint migration.

Indexes: `(status)`, `(status, submitted_at desc)`, `(submitter_id)`.

Also Now:

- **`public.is_moderator()`** — `(auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','moderator')`, STABLE, SECURITY DEFINER, `set search_path = public`. Every `event_submissions` RLS policy uses it. This is what finally makes the `moderator` role mean something; today it grants nothing.
- **RLS on `event_submissions`**: submitters SELECT their own (`submitter_id = auth.uid()`); anon/authenticated INSERT with `status='pending'` and `submitter_id is not distinct from auth.uid()`; moderators+admins SELECT/UPDATE all via `is_moderator()`. No DELETE policy at all — submissions are never destroyed, which is the entire point of the table.
- **Audit trigger** on `event_submissions` writing the §9 action literals.
- **`admin_user_directory()` extension** — add `approved_count`, and re-derive `contributions`/`pending_count`/guest rows from `event_submissions` (the ripple table's row for this RPC).
- Migration filename: `supabase/migrations/20260817000000_event_submissions.sql`, following the observed convention (14-digit `YYYYMMDDHHMMSS`, one day per phase — Phase 5 = 0815, Phase 6 = 0816). It must end with `notify pgrst, 'reload schema';` because it changes the PostgREST surface.
- A matching idempotent `supabase/reconcile-prod-schema-phase7.sql`, since production is reconciled by hand-run script and never `db push`. Known drift to flag: `reconcile-prod-schema-phase5.sql:218-342` still carries the pre-`email_confirmed_at` 14-column `admin_user_directory()`, and would now fail mid-transaction on a `CREATE OR REPLACE` column-list change.

### Recommended Later

`assigned_reviewer_id`, `review_started_at`, the `needs_information` workflow (submitter-facing "more info requested" loop), full duplicate-candidate persistence with stored scores, a real `venues` table, multi-note history (a `submission_notes` table replacing the single `internal_note`).

### Avoid

Forcing magic-link submitters to have `profiles` rows (keep `submitter_id` nullable and `submitter_email` the stable key, exactly as `admin_user_directory()` already synthesizes guest rows); a separate `submission_review_actions` table (§9 — `audit_logs` already does this); mutating `submitted_data` in place (destroys the audit trail the table exists for); hard-deleting rejected or withdrawn submissions; a numeric quality score.

### Identity continuity

Because the guest key is the lowercased email, a magic-link submitter who later registers with that same email connects to their history automatically through `admin_user_directory()`'s existing union — no backfill needed.

## 14. Final compact text wireframes

**A. Queue, desktop:**
```
Submissions                                    [ Review Next → ]
Review event suggestions before they reach the calendar.

[ Pending 12 ][ Needs Attention 4 ][ Duplicates 2 ][ Upcoming Soon 3 ][ All 87 ]

┌──────────────────────────────────────────────────────────────────────────┐
│ [Search submissions…]  [Any date ▾]  [Status ▾]      [⚙ More Filters]    │
└──────────────────────────────────────────────────────────────────────────┘
12 submissions

EVENT              EVENT DATE      SUBMITTED BY   SUBMITTED  QUALITY        DUPLICATE  STATUS   
─────────────────────────────────────────────────────────────────────────────────────────────
Bachata on the     Aug 24          [av] Guest     30 min     ⚠ Missing      Possible   Pending  ⋯
Harbor             6:00 PM         Submitter      ago        venue          Duplicate
salsa · bachata                    Magic-link only

Salsa Mondays      Aug 26          [av] Maria     2 hrs      ✓ Complete     —          Pending  ⋯
salsa                              @mariasalsa    ago

                                     Showing 1–12 of 12   [Rows: 25 ▾]  ‹ 1 ›
```

**B. Review page, desktop:**
```
← Submissions
Bachata on the Harbor                                     [Pending]  Submitted 30 min ago

┌─ EVENT INFORMATION ─────────────────────┐  ┌─ REVIEW PANEL ──────────────┐
│ 2 fields edited by @moderator           │  │ SUBMITTED BY                │
│                                          │  │ [av] Guest Submitter        │
│ Basic Info                               │  │      [Magic-link only]      │
│   Title      Bachata on the Harbor       │  │      Email verified ✓       │
│   Styles     bachata · salsa             │  │      1 previous submission  │
│   Type       Social                      │  │      guest@example.com      │
│   About      Sunset bachata social…      │  │      View submitter →       │
│                                          │  │                             │
│ Schedule                                 │  │ VERIFICATION                │
│   Date       Aug 24, 2026                │  │  ✓ Email verified           │
│   Time       6:00 PM                     │  │  ⚠ No prior approvals       │
│   Repeats    —                           │  │                             │
│                                          │  │ QUALITY                     │
│ Venue                          [Edited ▾]│  │  ✓ Event name               │
│   Havana Club                            │  │  ✓ Date & time              │
│    ├ Original  "Havanna club"            │  │  ✓ Dance style              │
│    └ Updated   "Havana Club"             │  │  ✓ Description              │
│   288 Green Street · Boston              │  │  ⚠ Venue not matched        │
│                                          │  │                             │
│ Pricing                                  │  │ DUPLICATE CHECK             │
│   Free · RSVP: eventbrite.com/…          │  │  ⚠ Possible Duplicate       │
│                                          │  │  Salsa Sundays at           │
│ Organizer                                │  │  Havana Club                │
│   —                            ⚠ Missing │  │  Aug 23 · 7:00 PM           │
│                                          │  │   · Same venue              │
│ Media                                    │  │   · Similar title           │
│   [ flyer thumbnail ]                    │  │  [View Existing Event]      │
│                                          │  │  [Not a Duplicate]          │
│                                          │  │  [Reject as Duplicate]      │
│                                          │  │                             │
│                                          │  │ NOTES                       │
│                                          │  │  [ internal note… ]         │
│                                          │  │  Only visible to            │
│                                          │  │  moderators and admins.     │
│                                          │  │ ─────────────────────────── │
│                                          │  │ [ Reject ]                  │
│                                          │  │ [ Edit & Approve ]          │
│                                          │  │ [ Approve & Publish ]       │
└──────────────────────────────────────────┘  └─────────────────────────────┘

REVIEW HISTORY
  Aug 12 · Submission received
  Aug 12 · Venue corrected by @moderator
```

**C. Review page, mobile:**
```
← Submissions
Bachata on the Harbor
[Pending] · 30 min ago

⚠ QUALITY
  ⚠ Venue not matched
  ⚠ No organizer

SUBMITTED BY
  [av] Guest Submitter
  [Magic-link only] · Email verified ✓
  1 previous submission

EVENT DETAILS
  Aug 24 · 6:00 PM
  Havana Club              [Edited ▾]
  288 Green Street · Boston
  bachata · salsa · Free

DUPLICATE CHECK
  ⚠ Salsa Sundays at Havana Club
    Same venue · Similar title
    [ View ]  [ Not a Duplicate ]

VENUE
  New venue — recorded as free text

MEDIA
  [ flyer ]

REVIEW ACTIONS
  [ Edit & Approve ]

┌────────────────────────────────┐
│  [ Reject ]      [ Approve ]   │   ← sticky
└────────────────────────────────┘
```

**D. Reject dialog:**
```
┌─ Reject "Bachata on the Harbor"? ────────────────┐
│                                                   │
│ Reason for rejection *                            │
│ [ Missing Information            ▾ ]              │
│                                                   │
│ Message to submitter                              │
│ [                                     ]           │
│ Shared with the submitter.                        │
│                                                   │
│ Internal moderator note                           │
│ [                                     ]           │
│ Only visible to moderators and admins.            │
│ Never shown to the submitter.                     │
│                                                   │
│                        [ Cancel ]  [ Reject ]     │
└───────────────────────────────────────────────────┘
```

## What Phase 7 does not decide

- Organizer Requests are a separate surface (`AdminSidebar.tsx` already marks it `built: false`) and are not touched here.
- A real `venues` entity is its own phase — shared by this workflow and the SEO foundation's Before-Launch requirements, but not designed or built in this phase.
- The `needs_information` submitter-facing loop (asking a submitter for more info and letting them respond) is Later; the CHECK constraint reserves the status value but no UI writes it yet.
- Implementation — the `event_submissions` migration, the queue/review components, tests, and the two-table-split ripple work on `ProfilePage`/`UserEventEditPage`/`submitEvent`/`admin_user_directory()` from the cost table above — is a follow-up phase awaiting approval of this design.

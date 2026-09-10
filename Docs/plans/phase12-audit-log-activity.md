# Phase 12 — Audit Log & Administrative Activity UX/UI

> **Design and manual-SQL delivery for the SalsaSegura Admin Dashboard.** No SQL in this directory has been executed against production. The existing `audit_logs` table and its triggers (events, submissions, platform settings) are the data source; this phase builds the admin browsing UI around them.

## 1. Context

Phase 11 established the `platform_settings` singleton and its audit trigger. Earlier migrations (20260813000100, 20260817000000) already seed the `audit_logs` table via triggers for: `event.*`, `submission.*`, and `platform_settings.*`.

Phase 12 exposes that existing data through an **Activity** page and **Activity Detail** page. It does **not** implement Analytics, a real-time event stream, or automated alert delivery.

### What already exists

| Piece | Evidence | Phase 12 reuse |
|---|---|---|
| `audit_logs` table (id, actor_id, action, entity_type, entity_id, metadata jsonb, created_at) | `supabase/migrations/20260813000100_audit_logs.sql` | Read-only source. The model and repo query it. |
| `log_event_change()` trigger on `events` | `20260813000100_audit_logs.sql` | Events audit entries already flow in. |
| `log_submission_change()` trigger on `event_submissions` | `20260817000000_event_submissions.sql` | Submission audit entries already flow in. |
| `log_platform_settings_change()` trigger on `platform_settings` | `sql/phase-11/004_add_platform_settings_audit.sql` | Platform-settings audit entries already flow in. |
| `auditLogLabelFor`, `actorLabelFor`, `latestActionEntry` | `src/features/admin/model/auditLog.ts` | Reused and extended by the activity model. |
| Admin table/toolbar/drawer/filter-drawer/page patterns | `AdminEventsTable`, `AdminVenuesPage`, `AdminOrganizerRequestsPage`, `AdminActionMenu`, `AdminViewTabs` | New components follow these established conventions exactly. |
| Admin user directory RPC | `admin_user_directory()` | Resolves actor + target identities for display. |

### What this phase adds to the model

The existing `auditLogLabelFor` covers event, submission, venue, settings, and user actions but is **missing** the human-readable labels the plan asks for (e.g. `event.published` → "Event published", `user.role_changed` → "Role changed to Moderator"). The new `auditActivityQuery.ts` module **extends** the label vocabulary with the full set from the plan and provides category mapping, preset views, filter application, and the row/detail transformation helpers. It does **not** mutate the existing `auditLog.ts` — it imports and supplements it, keeping the existing test suite green.

## 2. Routing

```text
/admin/activity              — chronological operational history (table + filters + presets)
/admin/activity/:id          — single audit entry detail (before/after, metadata, related record)
```

Route naming convention follows the existing `/admin/<resource>` and `/admin/<resource>/:id` pattern (events, users, organizer-requests, venues, tags, submissions). No better convention exists in this app; `/admin/activity` is consistent.

Routes are lazy-loaded behind the existing `<RequireAdmin>` guard, identical to every other `/admin/*` route.

## 3. What should be audited (already covered by existing triggers)

The existing triggers log these meaningful actions. This phase **reads** them; it does not add new triggers for user interactions like page opens or hovers (§2 noise).

**Events**
`event.created`, `event.approved`, `event.status_changed` (rejected, unpublished, archived, restored), `event.updated`, `event.deleted`

**Submissions**
`submission.created`, `submission.review_started` (future), `submission.edited`, `submission.approved`, `submission.rejected`, `submission.marked_duplicate`, `submission.reopened`, `submission.withdrawn`

**Users / Moderators**
`user.role_changed`, `user.flagged`, `user.unflagged`, `user.suspended`, `user.banned`, `user.restored`

**Venues**
`venue.created`, `venue.updated`, `venue.archived`, `venue.restored`, `venue.deleted`, `venue.merged`

**Platform settings**
`platform_settings.updated`, `platform_settings.access_policy_changed`

## 4. Activity page layout

Mirrors `AdminVenuesPage` and `AdminOrganizerRequestsPage` exactly:

```text
<AdminPageHeader title="Activity" description="Chronological record of administrative and moderation actions." />

[ Search ░░░░ ] [ Date range ▼ ] [ Category ▼ ] [ More Filters ]

[ filter chips … ]

[ All Activity ● ] [ Today ] [ User Management ] [ Event Changes ]
[ Moderation ] [ Organizer Decisions ] [ Settings Changes ] [ Security Actions ]

N activity entries · [ 25 ▼ ] [1] [2] [3] …

┌────────────────────────────────────────────────────────────┐
│ ┌─┬─┐ Event published                                   Salsa at the Anchor   Events · Published   Aug 14 · 3:18 PM  │
│ ┌─┬─┐ Submission approved                               Salsa Night        Submissions · Approved  Aug 14 · 2:05 PM  │
│ ┌─┬─┐ Role changed to Moderator                         Maria Santos       Users · Sensitive      Aug 14 · 2:42 PM  │
│ ┌─┬─┐ Account suspended                                 @username          Security · Sensitive   Aug 14 · 2:10 PM  │
└────────────────────────────────────────────────────────────┘
```

**Preset views** are implemented as `AdminViewTabs` (same component used by venues, submissions, organizer requests). Counts are computed client-side from the full result set.

**Filters** follow the drawer pattern: `Search` + `Date range` + `Category` are visible in the toolbar; `Actor`, `Action`, `Target type`, and `Entity ID` live in the `More Filters` drawer — matching how `AdminEventsFilterDrawer` and `AdminOrganizerRequestsFilterDrawer` hide secondary filters.

## 5. Row design

Each row is an `<a>` link to `/admin/activity/:id` (clickable row, matching `AdminEventsTable`'s title-link pattern). The row shows:

```text
[icon] <human-label>               <target-display>    <category-chip>   <time>
              by @actor            (<entity-name>)
```

- **Icon** + **human label** — from the extended `activityActionLabel` map (§9). Never raw `event.*` keys.
- **Target** — resolved from `entity_type` + `entity_id` + `metadata`. Falls back to a safe string from metadata (e.g. `metadata.title`, `metadata.kept_name`) when the joined record is gone (§20 deleted targets).
- **by @actor** — from `actorLabelFor` in the existing model.
- **Category chip** — `Events`, `Submissions`, `Users`, `Organizers`, `Venues`, `Taxonomy`, `Settings`, `Security`. Plain text, not decorative.
- **Time** — relative (`Aug 14 · 3:18 PM`) using the same `formatDate` helper as `AdminOrganizerRequestsTable`.
- **Sensitive actions** (ban, suspend, role change, organizer approval, permission change, platform setting change) get a `admin-activity-table__row--sensitive` modifier class that applies a left accent border and bolder treatment (§9). Semantic styling + explicit text, never color alone.

On mobile, rows collapse into cards (matching `AdminEventsTable`'s card pattern under 768px).

## 6. Activity detail page

`/admin/activity/:id` — a focused detail view, following the `AdminSubmissionDetailPage` / `AdminVenueDetailPage` pattern (header with back-button, card-based sections).

```text
← Back to Activity            Activity #6b3f2a1…  ← id pill

ACTION
Event Updated
by @rooseveltsegura
Aug 14 · 3:18 PM

TARGET
Event: Salsa at the Anchor
Events · Published

REASON (only when present)
Venue changed from Anchor booking policy

BEFORE / AFTER (disclosure, open by default when changes exist)
Field            Before              After
────────────────────────────────────────────────
Venue            The Anchor          Havana Club
Start Time       6:00 PM             7:00 PM

METADATA
{ expanded key/value pairs, never raw JSON dump as default }

RELATED RECORD
[View Event]  (links to /admin/events?edit=<entity_id> when entity_type is event)
```

The detail resolves actor identity, target display, and category via the same helpers as the list. The before/after diff is rendered from `metadata.before` / `metadata.after` when present, or from changed-key inference when only `changed_keys` is available.

## 7. Presets

| Preset | Filter logic |
|---|---|
| All Activity | no filters |
| Today | created_at >= today (America/New_York midnight, via `startOfTodayMs` from `eventsQuery.ts`) |
| User Management | category ∈ {Users} |
| Event Changes | category ∈ {Events} |
| Moderation | category ∈ {Submissions} (submission approve/reject/edit) |
| Organizer Decisions | entity_type ∈ {organizer_request} (future — currently no organizer audit entries) |
| Settings Changes | entity_type = platform_settings |
| Security Actions | action ∈ {user.banned, user.suspended, role_changed, platform_settings.access_policy_changed} |

Each preset is a tab in `AdminViewTabs`. Selecting All Activity clears all filters. Selecting any other preset applies its filter and updates the URL `?view=<preset>`.

## 8. Filters

| Filter | Location | Spec source |
|---|---|---|
| Search | toolbar (visible) | §5 — actor username, display name, event name, user name, venue, entity ID |
| Date range | toolbar (visible, date pickers) | §6 |
| Category | toolbar (dropdown) | §4 — Events, Submissions, Users, Venues, Settings, Security |
| Action | drawer | §6 — secondary; avoids exposing dozens of raw action keys |
| Actor | drawer | §6 |
| Target type | drawer | §6 |

Active filters render as removable chips (matching `AdminVenuesPage`'s filter-chips pattern). Search is debounced (200 ms), matching `AdminVenuesToolbar`.

## 9. Human-readable activity

The existing `auditLogLabelFor` in `auditLog.ts` does not cover `event.published`, `event.archived`, `event.deleted` as user-facing copy, and has no before/after diff labels. The new `auditActivityQuery.ts` provides `activityActionLabel(entry, context)` which:

1. Maps each known `action` string to plain English (the full vocabulary from §1–§20 of the spec).
2. Interpolates from `metadata` (e.g. `from_role`/`to_role` → "Role changed to Moderator").
3. Returns a safe fallback of the raw action for any unrecognized string.

Sensitive actions are flagged with a boolean `isSensitiveAction(action)` so the row and detail can apply emphasis.

## 10. Activity categories

```typescript
export type ActivityCategory =
  | "events"        // event.*
  | "submissions"   // submission.*
  | "users"         // user.*
  | "organizers"    // organizer.* (future)
  | "venues"        // venue.*
  | "taxonomy"      // taxonomy.* (future)
  | "settings"      // platform_settings.*
  | "security";     // user.banned, user.suspended, role_changed, access_policy_changed
```

Category is derived from `entity_type` + `action`, not stored in the DB — the `audit_logs` table already has `entity_type`. `user.role_changed` and `platform_settings.access_policy_changed` are categorized as `security` (sensitive) per §9.

## 11. Search

Client-side search across `actor_display_name`, `actor_username`, `target_display`, `entity_type`, `entity_id`, and `metadata`-derived text. The repo query returns a pre-enriched row (join + identity resolution in SQL) so search is a simple substring match in JS — matching the client-side filtering pattern of `AdminVenuesPage` (`applyVenueFilters`).

## 12. Date range

Two date inputs (`from`, `to`) — inclusive calendar dates against `created_at`. Parsed from/normalized to URL params as `yyyy-mm-dd` (same as `AdminEventsFilterDrawer` / `AdminSubmissionsFilterDrawer`).

## 13. Preset views (UI treatment)

Implemented as `AdminViewTabs` — keyboard-arrows, tabbing, screen-reader tab roles (already audited in `AdminActionMenu.test.tsx`). Preset counts show in the tab badge, computed from the client-side filtered dataset (same as `venueViewCounts`).

## 14. Before / After state

Rendered via `AdminEditedFieldDisclosure` (already exists in the codebase). When the audit entry's `metadata` contains `before` and `after` JSONB objects, the disclosure shows a field-by-field diff table. When only `changed_keys` is present (platform settings), it shows the key list. Only changed fields appear — never entire large records.

## 15. Role change detail

When `action === 'user.role_changed'`, the detail shows:

```text
ROLE CHANGED
User          Maria Santos
@mariasalsa
Previous Role  User
New Role       Moderator
Changed By     @rooseveltsegura
Reason         Trusted event reviewer
Aug 14 · 2:42 PM
```

All values come from `metadata` (`from_role`, `to_role`, `reason`) joined against the user directory for display name / username.

## 16. Moderation action detail

When `action === 'user.suspended'` or `user.banned`, the detail shows:

```text
ACCOUNT SUSPENDED
@username
Reason           Repeated spam submissions
Actioned By      @admin
Aug 14 · 2:10 PM

[View User]  [View Moderation History]  (links when resolvable)
```

## 17. Event change detail

`action` values: `event.created`, `event.approved`, `event.updated`, `event.status_changed`, `event.deleted`. The detail shows before/after for `event.updated` from `metadata.before`/`metadata.after`. For status transitions, `metadata.from_status` / `metadata.to_status` are shown as a small two-column grid. A **View Event** link goes to `/admin/events?edit=<entity_id>`.

## 18. Settings history detail

`action` values: `platform_settings.updated`, `platform_settings.access_policy_changed`. Shows `metadata.changed_keys` as a list (never raw values — §17 privacy). Links to `/admin/settings`.

## 19. Reason / Notes

Only displayed when `metadata.reason` (or `rejection_reason`, `rejection_message`, `internal_note`) is present. Normal edits (e.g. event title change) show no reason row — §18 says "Do not force a reason for normal actions."

## 20. Actor presentation

Uses `actorLabelFor` from the existing model. System-generated actions (null `actor_id`) display as **"SalsaSegura System"** with a `Settings` icon — no fake human account. The identity resolution (`AdminUserRow`) comes from `admin_user_directory()` via `profilesRepo`.

## 21. Deleted targets

When a target record has been deleted (or the actor/target is no longer resolvable), the row and detail fall back to safe display strings from `metadata` (e.g. `metadata.title`, `metadata.kept_name`). The `entity_id` is always preserved so the entry remains linkable and traceable. This avoids relying exclusively on FK joins — §20.

## 22. Privacy

The query enriches `actor_id` and `entity_id` but **never** selects or exposes: passwords, auth tokens, API keys, full sensitive profile snapshots, secret settings, or raw email addresses unless operationally needed for a user/moderation action. Email is shown only on the moderation detail page and only for the specific targeted user — matching `AdminFlagUserDialog`'s pattern of resolving email as an operational necessity.

## 23. Immutability

Audit records are append-only. The Activity UI has **no edit or delete actions** on rows or detail pages. A future "Purge old logs" is a separate System/Admin-only operation (§23 of the spec: treated as a specialized system operation, not standard CRUD). The detail page omits any action buttons.

## 24. Data-loading strategy

The Activity page fetches audit entries via `auditLogActivityRepo.fetchActivityLogs()` — a single `supabase.rpc("admin_audit_log")` call (a server-side view or RPC that joins `audit_logs` with `profiles` for actor identity and selects target metadata). This matches the pattern of `fetchOrganizerRequests()` (RPC, not raw `supabase.from()`). No `supabase.from("audit_logs")` is called from the UI directly — consistent with the project rule that data-access is centralized in repo files.

Pagination: server-side `offset`/`limit` (25/50/100), matching `AdminPagination`. The full set is NOT loaded client-side for filtering — instead, search/category/date are pushed into the RPC parameters. This differs from the client-side `applyVenueFilters` approach because audit_logs can grow large; the RPC accepts `q`, `category`, `from`, `to`, `actor_id`, `action` as arguments.

## 25. Compact wireframe

```text
┌───── Admin ───────────────────────────────────────────┐
│ Dashboard  Events  Users  Submissions  Settings  │
│                                                      │
│ Activity  ← current                                   │
│ Chronological record of admin actions.                │
│                                                        │
│ [ Search ░░] [Aug 1–14 ▼] [All Categories ▼] [More]     │
│ "role"                                            X    │
│                                                        │
│ (● All Activity) (Today) (User Mgmt) (Event Changes)  │
│ (Moderation) (Settings) (Security)                    │
│                                                        │
│ 124 entries · [25 ▼]    [1] [2] [3] …                  │
│                                                        │
│ ┌────┬─────────────────────────────────────────────────┐│
│ │  📅 │ Event published                                 ││
│ │    │ Salsa at the Anchor                             ││
│ │    │ Events · Published  by @rooseveltsegura        ││
│ │    │ Aug 14 · 3:18 PM                                ││
│ ├────┼─────────────────────────────────────────────────┤│
│ │  🔴 │ Account banned                                  ││
│ │    │ @username  (sensitive row: left border)         ││
│ │    │ Security · Sensitive  by @admin                ││
│ │    │ Aug 14 · 2:10 PM — Harassment                   ││
│ └────┴─────────────────────────────────────────────────┘│
│                                                        │
│ ← Back to Activity   Activity #6b3f2a1…                │
│ ACTION                                                    │
│ Account Banned                                              │
│ by @admin                                                   │
│ Aug 14 · 2:10 PM                                              │
│                                                            │
│ TARGET                                                       │
│ User: @username                                              │
│ Users · Sensitive                                            │
│                                                             │
│ REASON                                                      │
│ Harassment                                                   │
│                                                             │
│ METADATA                                                     │
│ reason:      Harassment                                      │
│ from_status: flagged                                         │
│ to_status:   banned                                          │
│                                                             │
│ [View User]  [View Moderation History]                        │
└─────────────────────────────────────────────────────────────┘
```

## 26. Manual SQL files, order, and safety

All files live under `sql/phase-12/`. The `audit_logs` table already exists (created by `20260813000100_audit_logs.sql` and deployed). This phase's SQL is **additive and non-destructive** — it adds supporting infrastructure so the Activity UI can resolve identities, display human-readable target names, and search efficiently, without disturbing existing triggers.

| Order | File | Purpose | Safety |
|---|---|---|---|
| 1 | `001_create_audit_view.sql` | A secured `admin_audit_log` view joining `audit_logs` with `profiles` for actor identity resolution + an index-backed RPC-friendly view. | Additive. Read-only view. |
| 2 | `002_add_audit_indexes.sql` | Indexes on `(entity_type, entity_id)`, `(actor_id, created_at)`, `(action)`, and a GIN on `metadata` for search. | Additive. Non-blocking. |
| 3 | `003_add_audit_constraints.sql` | NOT NULL constraint on `action`; index on `(created_at DESC, id DESC)` for deterministic ordering. | Additive. |
| 4 | `004_optional_backfill_activity.sql` | Optional: backfills `actor_id` from `event_submissions.reviewed_by` / `profiles` for pre-existing rows that have null actors. | **REVIEW REQUIRED** — UPDATEs audit rows. Idempotent. Run only if historical nulls exist. |

**Execution order:** 001 → 002 → 003 → 004 (optional).

**Operational check before 004:** confirm 001–003 applied, `audit_logs` is non-empty, and a sample of rows have `actor_id IS NULL`. Backfill only those.

## 27. What this phase does not decide

- Analytics, alerting, or real-time WebSocket streaming of audit entries.
- A "purge old logs" UI or destructive deletion of audit rows.
- New database triggers for user interactions (page views, hovers, searches).
- Audit entries for organizer-request lifecycle (no such trigger exists yet — that is a Phase 13+ concern tied to the organizer approval workflow).
- Export or download of audit data beyond the existing ICS/export utility pattern.

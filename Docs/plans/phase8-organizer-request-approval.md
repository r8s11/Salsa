# Phase 8 — Organizer Request Approval (`/admin/organizer-requests`)

## Context

Phase 5 shipped the `/admin/users` directory with role/moderation actions (Change Role, Flag, Suspend, Ban, Restore) as row actions opening dialogs. Phase 6 designed `/admin/users/:id` as the single-record detail + moderation timeline, reading from `audit_logs` and reusing every dialog verbatim. Phase 7 designed the event-submission review queue.

The admin sidebar (`src/components/Admin/AdminSidebar.tsx`) already declares `Organizer Requests` as a navigation item with `built: false` and no `to` prop — it is the one top-level admin surface still unbuilt.

This document is the design deliverable for Phase 8, produced against the brief pasted this session (Phase 8 — Organizer Requests UX/UI). It does not implement anything; per the brief it stops at "wait for my approval before continuing."

## Data reality — verified this session

`organizer_requests` does not exist yet. `grep -rn "organizer_request"` across `src/` and `supabase/migrations/` returns nothing. The `admin_user_directory()` RPC returns `role` (currently `user`/`moderator`/`organizer`/`admin`), not an "organizer application" or "organizer brand / organizer type" set. There is no `request_message`, no `organizer_type`, no `primary_city`, no proposed brand-name fields. Everything below is designed **for** the schema that Phase 8's "Recommended Now" table additions will introduce — it is a UI spec that is data-driven by those additions, and explicitly calls out where it would read from the new rows.

Verified existing infra that this phase **does** reuse with zero change:

- The admin shell: `AdminLayout` (>fixed + drawer sidebar), `AdminPageHeader` (title/description/actions), `AdminViewTabs` (preset views with counts + keyboard navigation), `AdminPagination`, `AdminActionMenu` (the `•••` row menu), `AdminConfirmDialog` (reason field + confirm/cancel, focus-managed, ESC-dismissable).
- The shared design tokens in `styles/admin.css` (light SaaS theme) — all new components use `admin-*` class names and `var(--admin-*)` tokens, never the public Ritmo Vivo `var(--*)` tokens.
- `AdminStatusBadge`, `AdminRoleBadge`, `AdminAccountStatusBadge` — reused for request status and account status respectively.
- `displayNameFor`, `identityLineFor`, `initialsFor`, `UserCell` avatar logic from `src/features/admin/model/usersQuery.ts` — reused for the applicant identity block.
- `AdminUserAvatar` — reused for the applicant avatar/initials.
- The URL-state pattern (`useSearchParams` → `parseFilters`/`parseView`/`parseSort` → `updateParams` with page reset) — the established contract from `AdminUsersPage` / `AdminEventsPage`; organizer-requests uses the identical shape so deep links and browser back/forward work identically.
- `AdminRoleBadge`'s consequence copy for `organizer` already states "a direct role change, not the approval of a submitted request" — this is the exact distinction the Phase 7 moderation design makes, and it carries over verbatim.

## Decisions — settled, do not re-open

### One new RPC, not direct table reads
The directory's `admin_user_directory()` already aggregates profiles + guest stats in a single server-side function to avoid an N+1 client-side join. Organizer requests are the same shape: each row enriches a `profiles` row with request-specific columns (`request_message`, `organizer_type`, `proposed_name`, `reviewed_at`, etc.). The clean approach is one dedicated RPC — `admin_organizer_requests()` — that returns a fully-enriched row per request. This mirrors the existing `admin_user_directory()` pattern (one round trip, server-side join, client just renders). It keeps the page's data-fetching surface identical to Phase 5's `useAdminUsers()` → `fetchUserDirectory`, so the page composition pattern doesn't change.

Rejected: direct `supabase.from("organizer_requests").select(...)` from a hook. It works, but it diverges from the one-function-per-admin-resource convention Phase 5 established for users, and it would require the client to join `profiles` data itself (re-introducing the N+1 the directory RPC exists to avoid). The Phase 5 "fetch once, derive everything client-side" reasoning applies to the users table because it's already in cache; organizer requests are a new resource with no cached parent, so the RPC is the right boundary.

### Approval and rejection are RPCs, not `setUserRole`
Approving a request is not the same operation as the existing `setUserRole(userId, "organizer")`. Role promotion alone is insufficient — it must also create the Organizer entity (or link to an existing one) and write an `organizer_members` row granting `owner` role, plus record the reviewer and timestamp. Re-using `setUserRole` would do ⅓ of the work and leave the rest as unimplemented state. The spec therefore defines `admin_approve_organizer_request(id, { reviewer_id, internal_note })` and `admin_reject_organizer_request(id, { reviewer_id, reason_code, reason_message })`.

Rejected: a single `updateOrganizerRequest(id, {status})` RPC. Approval and rejection carry structurally different payloads (approval = silent on success; rejection = requires reason + produces a message to applicant). One function per terminal state keeps the contract narrow and the error surface obvious — the same "one mutation per action" shape Phase 5's `useAdminUsers` already uses for `setRole` / `setStatus`.

### Reuse, do not rebuild, the existing dialogs
`AdminConfirmDialog` already supports `reasonField`, `tone`, `isBusy`, `error`, `onConfirm(reason?)`, `onCancel`. The Phase 8 approval confirmation and rejection confirmation are two invocations of `AdminConfirmDialog`:

- **Approval**: `tone="neutral"`, no reason field, body lists the privileges being granted (create / publish / edit-cancel own / manage brand).
- **Rejection**: `tone="danger"`, required reason field (the brief's taxonomy: `Insufficient Information`, `Unable to Verify Organizer`, `Account Activity Concerns`, `Duplicate Organizer / Brand`, `Not Currently Eligible`, `Other`), optional notes, optional "message to applicant" text.

Rejected: a new `AdminApproveOrganizerDialog` / `AdminRejectOrganizerRequestDialog` pair. The existing dialog's props are already a complete contract; building a third confirmation dialog (in addition to the two Phase 5 already ships for event submissions) would be the third time the same interaction shape is hand-rolled. This is the same "reuse verbatim" decision Phase 6 made with its five dialogs.

### Reapplication is history, not a blocker
A rejected user can submit a new request. The new request gets a new `id`; the old one stays `rejected` with its `reviewed_by`/`reviewed_at` intact. No UI special-casing is needed beyond showing the prior requests in the review page's "Request History" section. This matches the brief's "Preserve request history" requirement without inventing a "reopen" state.

### Multi-manager is future-ready, not built
The brief's "Multiple Managers — Future Ready" section recommends an `organizer_members` table. Phase 8 implements approval by creating exactly one `organizer_members` row (`member_role: "owner"`) for the approving admin, but does **not** ship a multi-manager management UI. The data model allows it; the UI defers to that future moment. This is the same "schema-first, UI-later" call Phase 6 made for `suspended_until` and `user_notes`.

### No magic-link identity transition UI
Same finding as Phase 6: magic-link-only submitters who later register don't exist as a feature yet. The eligibility rule ("must be a registered profile") is enforced in the **submission** flow (Phase 7's `useSubmitEventForm` / `validateSubmitForm`), not in the review UI. Phase 8's review page simply displays which kind of account the applicant is — it does not offer a "convert this guest to a user" button, because no such operation exists in the auth layer. This matches Phase 6's §22 documentation-only treatment.

## Approach

### 1. UX rationale

The brief's five-second checklist for an approver is: *who is requesting / what brand / what have they done / moderation concerns / is it legit*. The queue page answers the first three across all rows in a single scannable table (applicant name + avatar, brand/organizer name, event activity counts). The review page answers the last two by surfacing moderation status inline (not a separate click) and by presenting the applicant's full platform history (past events, prior requests) in one scroll.

The key design tension from the brief is **speed vs thoroughness**: most approvals should be a single click from the queue, but the admin needs the full context on the rare row that warrants scrutiny. The resolution is a two-level hierarchy:

- **Queue** (table, paginated, filterable, keyboard-navigable) — the 90% case is visible here. Default sort is `oldest first` so the longest-waiting request is always at the top; clicking any row opens the review page.
- **Review** (single-record, all context) — every field the brief lists is one scroll. The decision panel is sticky on desktop so the Approve/Reject buttons never scroll out of reach.

The queue's "Actions" column is intentionally minimal — a single `•••` menu per row that offers **View** (always), **Approve** (quick, no dialog), and **Reject** (opens the reason dialog). Bulk actions are omitted: the brief optimizes for a single Admin working the queue one-by-one, and a bulk-approve would silently bypass the "is this legit" check the design exists to enforce.

### 2. URL contract

`/admin/organizer-requests` — the queue. State is entirely in the URL so links/bookmarks/reload preserve position:

- `?view=pending` (default) · `approved` · `rejected` · `all` — preset views, mirroring Phase 5's `USER_VIEWS` / `EVENT_VIEWS` pattern with `AdminViewTabs`.
- `?q=` — search across applicant name, username, email, and proposed brand name.
- `?status=` — comma-separated request statuses (`pending`, `approved`, `rejected`). (Kept separate from `view` so a search can filter across all views without leaving the current preset.)
- `?type=` — organizer type filter (`promoter`, `dance-studio`, `dj`, `venue`, `dance-company`, `festival`, `independent`, `other`).
- `?from=` / `?to=` — request date range (`created_at`), `yyyy-mm-dd`.
- `?sort=` — `requested` (default) · `name` · `brand`.
- `&dir=asc|desc` — sort direction.
- `&page=N` · `&size=25|50|100` — pagination, reusing `PAGE_SIZE_OPTIONS` / `DEFAULT_PAGE_SIZE`.

`/admin/organizer-requests/:id` — the review page. The `:id` is the `organizer_requests.id` UUID. No query params needed; the page reads the one row and its enrichment data (applicant profile, prior requests, prior events) from a single RPC that joins them.

The queue preserves its URL state across navigation: clicking a row opens the review page in-place (React Router `Link` to the `:id` route), and the browser back button returns to the exact scroll position + filter/view state the admin left — this is automatic with React Router v6/v7 as long as filters live in `useSearchParams`, which Phase 5's pages already demonstrate.

### 3. Queue page — `/admin/organizer-requests`

**Header.** `AdminPageHeader` with title "Organizer Requests", description "Review and approve requests for organizer access." The primary action is omitted (there is no "Create Organizer Request" — requests come from users).

**Top bar.** `AdminViewTabs` with the four preset views and their counts: Pending, Approved, Rejected, All Requests. The sidebar badge (see §12) shows only the pending count.

**Filter bar (compact).** Directly beneath the view tabs, in the same `admin-card admin-users-page__toolbar-card` wrapper pattern from Phase 5/6:

- A search input (200ms debounced, same `handleSearchInput` pattern as `AdminUsersToolbar` / `AdminEventsToolbar`).
- A "More Filters" button (`SlidersHorizontal` + count dot for active filters) that opens the filter drawer.
- A compact sort dropdown (the `SORT_OPTIONS` pattern from `AdminUsersToolbar`).

Active filters render as removable `admin-chip admin-filter-chip` tokens directly above the results, with a "Clear all" button when ≥2 are active — identical to `AdminUsersPage`'s chip strip.

**Filter drawer.** `AdminOrganizerRequestsFilterDrawer` (new component, following the `AdminUsersFilterDrawer` / `AdminEventsFilterDrawer` template exactly): Organizer Type multi-checkbox, Request Date range (from/to date inputs), Account Status checkbox group (Active / Flagged / Suspended / Banned — so an admin can isolate requests from at-risk accounts). Tab-trap + ESC-dismiss, same as the existing drawers.

**Results table.** `AdminOrganizerRequestsTable` (new component) — renders on desktop as a `<table>`, on mobile as a card list (same dual-render pattern as `AdminEventsTable` / `AdminUsersTable`). Columns:

| Applicant | Brand / Organization | Requested | Event Activity | Account Status | Request Status | Actions |
|---|---|---|---|---|---|---|

- **Applicant**: `AdminUserAvatar` + name + `@username` (via `displayNameFor` / `identityLineFor`) + email mutted below. Links to the row's review page.
- **Brand / Organization**: `proposed_name` (or the existing organizer name if `proposed_organizer_id` is set — see §10). Falls back to a muted "No brand name provided" when empty.
- **Requested**: `created_at` formatted as "Aug 12" (short date, matching `formatJoined`).
- **Event Activity**: a compact "N submissions · M approved" line. This is computed client-side from the applicant's `submitter_id`/`submitter_email` against the events already fetched by `useAdminEvents()` — same predicate as Phase 6's §9 "Events & Contributions", just surfaced in a tight cell. When the directory already exposes aggregate counts (`AdminUserRow.contributions` / `pending_count`), the RPC may also return them directly.
- **Account Status**: `AdminAccountStatusBadge` — the *account* status (active / flagged / suspended / banned), distinct from the *request* status, so a flagged applicant is visible at a glance.
- **Request Status**: `AdminRequestStatusBadge` (new, §6) — pending / approved / rejected. Color + icon + text, greyscale-safe.
- **Actions**: `AdminActionMenu` (`•••`) with the per-request action matrix (§5).

Empty states follow `AdminUsersPage`'s pattern: `No users match these filters.` (with Clear Filters) when filters are active but the result set is empty; `No organizer requests yet.` when the table is genuinely empty.

Pagination: `AdminPagination` at the bottom, same controls.

### 4. Review page — `/admin/organizer-requests/:id`

Vertical sections (not tabs), in the brief's §1 order — single column on mobile, two-column where the spec shows side-by-side cards:

1. **Identity header.** Back-link `← Organizer Requests` (to `/admin/organizer-requests` *preserving the current query string* — unlike Phase 6's back-link which is a fresh nav, the queue is a list view whose filters the admin should return to). Avatar + name + username + email, role + account-status badges side by side, "Joined {date}" line, a `•••` header menu (`AdminActionMenu`) using the **same** action matrix as the queue row (§5), so the header menu and the row menu are provably the same contract.

2. **Applicant Identity card.** Display Name, Username, Email + Verified chip (reusing the `email_confirmed_at` pattern Phase 6 adopted), Account Type (Registered User / Magic-Link Submitter), Role, Status. For a guest submitter: Username row reads `—`, a `Public Profile: None` row appears, Account Type reads "Magic-Link Submitter." Identical vocabulary to Phase 6's §4/§5.

3. **Organizer / Brand card.** `ORGANIZER / BRAND` heading. Fields: Type (organizer type label), Primary Area, Instagram (external link with `↗`), Website (external link with `↗`). Organizer type uses the brief's taxonomy — `promoter`, `dance-studio`, `dj`, `venue`, `dance-company`, `festival`, `independent`, `other` — rendered as a muted label (not a chip, since this is context not an approval gate, per the brief's "Treat this as context, not as an approval requirement").

4. **Platform History card.** Member since, Events submitted (total), Approved, Rejected, Pending, Open Flags, Previous moderation actions — all derived client-side from the applicant's past events (via the Phase 6 submitter filter against `useAdminEvents()`) plus the account-status/flag data already in the directory row. **No numeric "trust score"** (the brief explicitly forbids it). This is the Phase 6 §8 pattern applied to a single organizer-request applicant.

5. **Previous Events card.** A compact list of the applicant's last 5 events (title, date, `AdminStatusBadge` for the event status), each linking to `/admin/events?edit=<id>` — identical to Phase 6's §9. Footer link: `View all in Events →` to `/admin/events?submitter=<value>`.

6. **Moderation Context card.** When the account has current moderation concerns (`flagged` / `suspended` / `banned`), renders the `AdminAccountStatusBadge` plus the reason and "Since / Actioned by" resolved the same way Phase 6's §7 does (from the latest matching `audit_logs` row, actor resolved against the already-loaded users list). When there are none: a single quiet line — `No current moderation concerns.` — exactly as Phase 6's §12.

7. **Request Message card.** The applicant's own explanation, full-width, in a muted blockquote-style treatment. The brief is explicit: this is "secondary to factual activity and account history" — so the card is visually subdued (not emphasized as evidence), placed below the data-heavy sections. Plain text, no markdown interpretation (the applicant is a user, not a trusted admin; treating their text as markdown would be an injection surface).

8. **Request History card.** (Only when the applicant has submitted prior requests.) A small table: date · status · by whom · (rejection reason when rejected). Each row links back to its own review page if the admin wants to revisit it. This satisfies the brief's "Preserve request history" / reapplication flow.

9. **Decision panel (sticky, desktop).** On desktop ≥1024px this is a fixed-position card on the right that stays in view as the admin scrolls the above sections. It contains:

   - A read-only `Request Status` field (Pending / Approved / Rejected).
   - A compact `Applicant Summary` (name + username).
   - A compact `Account Status` (badge).
   - `Moderation Alerts` — a single icon + count when the account has any current concern (links into the Moderation Context card).
   - `Internal Notes` — a textarea bound to a pending internal note the admin is drafting (not yet saved; saved only on Approve/Reject).
   - **Reject** button (danger tone) — opens the rejection dialog (§7).
   - **Approve Organizer** button (primary/rose tone) — opens the approval confirmation (§8).

   On mobile/tablet the sticky panel becomes a sticky *footer bar* (`position: sticky; bottom: 0`) so the two action buttons are always thumb-accessible without scrolling back to the top. The panel's contents collapse to just the two buttons + a `•••` overflow for the internal-notes field. This matches the brief's §1 mobile order ("Decision" last) and the "sticky Reject / Approve action area" note.

   The panel disables both buttons while a mutation is in flight, and after a decision is recorded it slides up and is replaced by a persistent success banner (§11), so the admin can't double-click through to a second approval.

Section layout on desktop: cards 2+3 side by side (Applicant Identity | Organizer/Brand, matching the brief's two-column recommendation); cards 4+5 side by side (Platform History | Previous Events); card 6 full width; card 7 full width; card 8 full width; card 9 the sticky decision panel. This follows the Phase 6 `admin-user-detail-page__body` two-column pattern (`flex-direction: row` at ≥1024px, `.__overview` + `.__summary` as `flex: 1`), just with organizer-field class names.

### 5. Action matrix (queue row + review header menu)

The single `rowActionItems`-style function determines what appears per request, keyed on the current `request_status` and the applicant's `account_status`:

- **Pending request, active account**: `View` (always), `Approve` (no dialog — direct mutation, see §8), `Reject` (dialog, see §7). Quick-approve is a deliberate affordance for the 90% case the brief optimizes for.
- **Pending request, flagged/suspended/banned account**: same three, but `Approve` opens the approval confirmation dialog anyway (one extra click) so the admin must acknowledge the moderation concern before granting publish privileges. The dialog body includes a bold warning line: "This account is currently [status]. Approving organizer access will not reset this status."
- **Approved request**: `View` (opens the organizer it created — see §10), `Revoke Organizer Access` (danger, dialog). No reject/un-reject.
- **Rejected request**: `View`, `Re-apply?` — no, this is not built; the admin simply sees the history. The applicant re-submits from their end. `View` remains.

The matrix lives in the model layer (`src/features/admin/model/organizerRequestsQuery.ts`) as `requestActionItems(request, applicant, onAction)`, the exact same shape Phase 5/6 export for events and users. `AdminActionMenu` renders it.

### 6. Request status badge (new)

`AdminRequestStatusBadge` — the request-level status vocabulary (`pending_request` / `approved_request` / `rejected_request` — prefixed to avoid colliding with the existing `.admin-status--pending` / `--approved` / `--rejected` event-status classes). Follows `AdminStatusBadge`'s four-signals pattern (dot + icon + tint + border) so greyscale-safe readings survive:

- `pending_request` → `Clock` icon, warning tint, "Pending" label.
- `approved_request` → solid dot (no icon), success tint, "Approved" label.
- `rejected_request` → `CircleX` icon, danger tint, "Rejected" label.

This mirrors `AdminStatusBadge`'s architecture exactly (a `STATUS_ICON` partial record + a `STATUS_LABEL` record + a single `admin-status` base class), just scoped to request statuses. The reviewer should not have to learn a second badge system.

### 7. Rejection flow

Trigger: `Reject` from the queue row menu or the review page's decision panel.

Opens `AdminConfirmDialog` with:

- **title**: "Reject organizer request from @{username}?"
- **body**: "This will mark the request as rejected. The applicant can re-apply in the future."
- **tone**: `danger`
- **reasonField**: not used — rejection reasons are a fixed select taxonomy matching the brief's §27. Instead, a `<select>` for the reason code is placed inside the dialog body (same pattern as `AdminFlagUserDialog`'s reason `<select>`), followed by two textareas:
  - `Message to applicant` (plain text, shown to the user in an email/SMS) — optional but strongly encouraged.
  - `Internal Admin Note` (never shared) — optional.
- Rejection reason taxonomy (from the brief): `Insufficient Information`, `Unable to Verify Organizer`, `Account Activity Concerns`, `Duplicate Organizer / Brand`, `Not Currently Eligible`, `Other`. When "Other" is selected, the internal note becomes required (mirroring `AdminFlagUserDialog`'s "notes required when Other" rule).
- **confirmLabel**: "Reject Request"
- On confirm: `admin_reject_organizer_request(id, { reviewer_id, reason_code, reason_message })`. The `reason_message` is concatenated as `reason_code — internal_note` (or just `reason_code` if no note), matching `AdminFlagUserDialog`'s reason-composition pattern.
- Error: inline `role="alert"` under the select (same `.admin-field__error` pattern), scoped to this dialog only.
- ESC + overlay-click + Cancel button dismiss without action. Focus returns to the trigger.

After a successful rejection: the dialog closes, the row's status badge updates to "Rejected" (greyscale dot), the request moves to the Rejected view, and the review page (if the admin was there) shows a persistent success banner: "@username's organizer request was rejected. [View organizer ] (to: organizer profile, future)."

### 8. Approval flow

Trigger: `Approve Organizer` from the review page's sticky decision panel, or `Approve` from the queue row menu (when the account is active).

Opens `AdminConfirmDialog` with:

- **title**: "Approve organizer access for @{username}?"
- **body**: a bulleted list of what the applicant will gain — "Create events · Publish their own events directly · Edit/cancel their own events · Manage an organizer brand" — plus a warning line when the account is not active: "This account is currently [Flagged/Suspended/Banned]. Approving will not change their account status."
- **tone**: `neutral` (this is a promotion, not a danger; the rose `--admin-brand` primary button still carries the visual weight).
- No reason field required (approval is a positive action).
- **confirmLabel**: "Approve Organizer"
- On confirm: `admin_approve_organizer_request(id, { reviewer_id, internal_note? })`. The optional internal note (from the decision panel's textarea) is passed as `internal_note` for the audit trail.
- The confirmation step is **always** shown from the review page (explicit confirmation, per the brief's §4: "Require explicit confirmation because this grants direct-publishing privileges"). The quick-approve from the queue row is only available for clean, active accounts — the one exception to "always confirm," explicitly justified by the brief's speed-vs-thoroughness tradeoff for the 90% case.

After approval: the dialog closes, success banner appears ("@{username} is now an organizer for {brand}. [ View organizer ]"), the queue row's status updates, and a `audit_logs` entry is written (`organizer_request.approved`, entity = the new `organizers` row, metadata = `{ proposed_name, organizer_type, primary_city, request_id }`) so the review page's "Request History" and the user-detail-page audit feed both pick it up.

### 9. Existing Organizer Brand handling

A request may target an organizer that already exists (`proposed_organizer_id IS NOT NULL`). This is the brief's §10 "Existing Organizer Brand" case — an applicant requesting legitimate management access to a brand that's already in the system. The treatment:

- In the queue: the **Brand** column shows the existing organizer's name with an `∞`/link icon and the `AdminOrganizerTypeBadge` — not a question mark, signaling "this brand already has identity."
- In the review page's Organizer/Brand card: an inline alert (non-blocking): "This brand already exists · [ View existing organizer ] →" so the admin can sanity-check who currently manages it before approving.
- The action matrix adds nothing new here — approve still creates a new `organizer_members` row granting `owner` role, which is exactly how multi-manager starts (§10). The admin is not asked to "merge" anything; they're asked "does this person belong on an already-approved brand," and the "View existing organizer" link gives them the prior context.

### 10. Organizer membership — recommended schema (now / later)

The brief's §13 strongly recommends a dedicated `organizers` entity + `organizer_members` access table. Phase 8 ships the minimal version that makes approval meaningful:

**organizers** (Recommended Now):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `name` | `text` | Brand / organizer name |
| `slug` | `text` | Unique, URL-safe — derived from `name` with a uniqueness suffix |
| `description` | `text` | Optional |
| `logo_url` | `text` | Optional |
| `website` | `text` | Optional |
| `instagram` | `text` | Optional |
| `organizer_type` | `text` | CHECK constraint matching the brief's taxonomy |
| `primary_city` | `text` | CHECK `('boston','new-york-city')` to match `events.city` |
| `status` | `text` | `active` / `suspended` / `archived` — CHECK |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | |

**organizer_requests** (Recommended Now — this is the queue's source of truth):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `profiles.id` | NOT NULL — eligibility is enforced here, not in the UI |
| `proposed_organizer_id` | `uuid` FK → `organizers.id` | NULL when requesting a new brand |
| `proposed_name` | `text` | New brand name (ignored when `proposed_organizer_id` set) |
| `organizer_type` | `text` | CHECK taxonomy |
| `description` | `text` | |
| `website` | `text` | |
| `instagram` | `text` | |
| `primary_city` | `text` | CHECK `('boston','new-york-city')` |
| `request_message` | `text` | Applicant's "why I'm requesting access" |
| `status` | `text` | CHECK `('pending','approved','rejected')` — default `pending` |
| `reviewed_by` | `uuid` FK → `profiles.id` | NULL until decided |
| `reviewed_at` | `timestamptz` | NULL until decided |
| `rejection_reason_code` | `text` | NULL unless rejected |
| `rejection_message` | `text` | NULL unless rejected |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | |

RLS: `select` for `admin` role (same `auth.jwt()->'app_metadata'->>'role' = 'admin'` pattern as `audit_logs`); `insert` for authenticated users on their **own** row (`user_id = auth.uid()`); `update` on reviewer-only columns (`status`/`reviewed_by`/`reviewed_at`/rejection fields) restricted to admin.

**organizer_members** (Recommended Now, minimal):

| Column | Type | Notes |
|---|---|---|
| `organizer_id` | `uuid` FK → `organizers.id` | |
| `user_id` | `uuid` FK → `profiles.id` | |
| `member_role` | `text` | CHECK `('owner','manager','editor')` — default `owner` on approval |
| `status` | `text` | CHECK `('active','removed')` — allows revoking without losing history |
| `created_at` | `timestamptz` | default `now()` |

Primary key: `(organizer_id, user_id)`. This is the future-ready table the brief asks for; Phase 8 writes exactly one row per approval (`member_role = 'owner'`), and the schema already permits additional managers later.

**organizer_request_audit** (Recommended Now): a narrow log of the request's lifecycle, same shape as the existing `audit_logs` pattern but scoped to requests so the "Request History" card (§8) has a purpose-built source. Columns: `id`, `request_id`, `action` (`requested`/`approved`/`rejected`), `actor_id`, `reason_code`, `note`, `created_at`. Alternatively, reuse the existing `audit_logs` table with `entity_type = 'organizer_request'`, `entity_id = <request.id>` — the Phase 6 design already proves this table is client-readable for admins, and it avoids a new table.

**Recommended Later** (from the brief, explicitly future):

- `organizer_verification` — a verification status/tier for brands (e.g. "claimed", "verified"). Unlocks a future "claim this organizer" flow.
- `organizer_logo_moderation` — a staging table for logo submissions pending review.
- Granular `member_role` management UI (add/remove editors/managers) — the table exists, the UI waits.
- Organizer-level suspension (`organizers.status = 'suspended'`) — would cascade to "events cannot be published" but is out of scope.
- `organizer_tags` / categorization — for a future browse/explore surface.

**Recommended Now** summary: `organizers`, `organizer_requests`, `organizer_members`, + the RPC functions `admin_organizer_requests()`, `admin_approve_organizer_request()`, `admin_reject_organizer_request()`. Everything else the UI needs (applicant identity, event history, moderation context) already exists via `admin_user_directory()`, `useAdminEvents()`, and `audit_logs`.

### 11. Success states & announcements

Both approval and rejection produce a non-blocking, auto-dismissable success toast anchored to the queue page top (matching Phase 5's `AdminToast` pattern, which is already built). The toast includes:

- Approval: "✓ {Brand name} organizer approved. @{username} can now manage it." with a `View organizer →` link.
- Rejection: "✓ Request from @{username} rejected — {reason_code}."

Additionally, after either action the queue row is *immediately* re-rendered with the new status badge (optimistic update against the RPC result), so the admin gets instant visual confirmation before the toast fades. This is the same "row fades to 0.6 then updates" feedback `AdminEventsTable`/`AdminUsersTable` already use via the `busy` prop.

If the admin is on the **review** page when they act, the page's header badge updates in place and a `role="status"` live region announces the new state (e.g. "Organizer request approved"), satisfying the brief's "success/failure changes are announced accessibly."

### 12. Sidebar attention badge

The sidebar nav item `Organizer Requests` (currently `built: false`) gains:

- `to: "/admin/organizer-requests"`.
- A trailing badge showing the pending-request count, rendered only when `> 0`. This matches how the overview page's "Organizer Requests" metric card surfaces counts (Phase 3's `AdminMetricCard` with `tone="attention"` when `> 0`).
- The count is sourced from the `admin_organizer_requests()` RPC filtered to `status = 'pending'` — cached under TanStack key `["admin", "organizer-requests", "counts"]` with a 5-minute `staleTime` (matching the events-query convention), and invalidated after any approve/reject mutation so the badge updates without a hard reload.

### 13. Mobile / tablet behavior

Desktop (≥1024px, matching Phase 5's `AdminOverviewPage__metrics` and `AdminUserDetailPage__body` breakpoints): two-column body where the review page places Applicant Identity | Organizer/Brand side by side. Decision panel is sticky on the right.

Tablet (768px–1023px): single column; the decision panel becomes a sticky footer bar (`position: sticky; bottom: 0;`) with just Approve + Reject buttons + overflow menu for notes. Organizer/Brand and Platform History / Previous Events collapse to stacked cards rather than side-by-side.

Mobile (< 768px): the brief's §1 mobile order is respected — the table collapses to cards (same `admin-events-cards` / `admin-users-cards` pattern, where each row is a `<li class="admin-card">` with labelled key/value rows). The review page stacks all sections vertically in the brief's explicit order: Applicant → Request Status → Organizer/Brand → Platform History → Previous Events → Moderation → Request Message → Decision. The sticky decision area is a fixed bottom bar with a two-button layout (Reject | Approve), full-bleed, thumb-friendly `min-height: 48px` touch targets.

The queue's "More Filters" button already moves the date/organizer-type/account-status selects off-canvas into the drawer on all sizes — this keeps the mobile toolbar to just the search input + view tabs, matching the brief's "Keep the toolbar compact" directive.

### 14. Theme & accessibility

**Theme inheritance.** The admin shell already supports Light / Dark / System via `useTheme` + the `data-theme` attribute on `.admin-shell` (see `AdminLayout` + `AdminSidebar`'s theme `fieldset`). Phase 8 components live under `.admin-shell` and use only `var(--admin-*)` tokens, so they inherit automatically — no theme logic is added.

**Color is never the only signal.** Every status — request status (§6) and account status (`AdminAccountStatusBadge`, reused) — uses icon + shape + text, not color alone. The request-status badge reuses the `.admin-status` base rule's four-signal pattern (dot, icon, tint, border) that `AdminStatusBadge` already implements for greyscale safety.

**Focus management.** All dialogs follow the established pattern (`useEscapeKey(onCancel)`, `previouslyFocusedRef` to restore focus to the trigger on close, `confirmRef`/`selectRef` to focus the primary action on open). Tab-trapping in the filter drawer uses the same `first/last focusable` logic as `AdminEventsFilterDrawer`. The `AdminActionMenu` (`•••`) already keyboard-navigates with ArrowUp/ArrowDown/Home/End and restores focus to the trigger button.

**External links.** The Organizer/Brand card's Instagram and Website links open in a new tab (`target="_blank" rel="noopener noreferrer"`) and carry a trailing `↗` glyph + an `aria-label="View {brand} on Instagram (opens in new window)"` so screen-reader users know the navigation behavior. This matches the brief's "External links are clearly identified."

**Applicant vs brand distinction.** Visually, the applicant identity block uses the avatar + text + `@username` treatment (personal), while the brand block uses a separate card with a different background tint (`--admin-surface-secondary`) and the `ORGANIZER / BRAND` uppercase label — so a screen reader navigating linearly encounters "Maria Santos → @mariasalsa → Organizer / Brand → Mambo Nights Boston" as distinct items, never conflated. The data model enforces this too (`user_id` ≠ `organizer.id`).

**Announcements.** Live-region text for approve/reject is scoped to the review page (`role="status"`). Queue-level success uses the existing `AdminToast` component. Error states use `role="alert"` inline under the affected control, matching Phase 5/6.

**Reduced motion.** The shimmer skeleton already respects `@media (prefers-reduced-motion: reduce)` in `admin.css`; the success-toast slide-in animation is disabled under the same media query. No new motion is introduced.

### 15. Final compact text wireframe

```text
┌─ /admin/organizer-requests ─────────────────────────────────────────┐
│ ← Back to Overview                     Organizer Requests, 2 pending │
│                                                                        │
│ [ Pending(2) | Approved(1) | Rejected(0) | All(3) ]                      │
│ ┌─ toolbar ────────────────────────────────────────────────────────┐  │
│ │ Search [___________________________]  [More Filters ▼]  Sort▼   │  │
│ │                                                              │  │
│ │ Chips: [Brand: Mambo Nights] × [Type: Promoter]  Clear all   │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ Applicant      │ Brand              │ Req'd  │ Events │ Acct │ Req │  │
│ │ Maria Santos   │ Mambo Nights BOS   │ Aug 12 │ 8 sub  │ Act  │Pending│  │
│ │ @mariasalsa    │                    │        │ 7 app  │      │     │  │
│ │                │ ───────────────────────────────────────────────│  │
│ │ John D.       │ Havana Groove NYC  │ Aug 10 │ 3 sub  │ Flag │Pending│  │
│ │ @jdance        │                    │        │ 2 app  │      │     │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ [1-25 of 2]  Rows per page: [25▼]  ◀ 1 2 3 … 7 ▶                      │
└───────────────────────────────────────────────────────────────────────┘

┌─ /admin/organizer-requests/:id ───────────────────────────────────────┐
│ ← Organizer Requests (preserves ?view=pending)                        │
│                                                                        │
│ [Avatar] Maria Santos                        Organizer · Active      │
│          @mariasalsa                                               ••• │
│          Joined May 2026                                             │
├───────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐  ┌──────────────────────┐                   │
│ │ APPLICANT IDENTITY   │  │ ORGANIZER / BRAND    │                   │
│ │                         │  │                         │                   │
│ │ Email    m@ex… ✓Verified│  │ Mambo Nights Boston   │                   │
│ │ Username @mariasalsa     │  │ Type   Promoter          │                   │
│ │ Role     Organizer       │  │ Area   Boston, MA        │                   │
│ │ Status   Active          │  │ IG     ↗ @mamboBOS      │                   │
│ │ Account Type Registered   │  │ Site   ↗ mambo.com      │                   │
│ └──────────────────────┘  └──────────────────────┘                   │
│                                                                        │
│ PLATFORM HISTORY                                                       │
│ Member since May 2026                                                 │
│ 12 submissions · 11 approved · 0 pending · 1 rejected                  │
│ 0 open flags                                                           │
│                                                                        │
│ PREVIOUS EVENTS                                                        │
│ ───────────────────────────────────────────────────────────────────── │
│ Salsa Sundays        Published    View →                              │
│ Mambo Thursdays      Published    View →                              │
│ Bachata Rooftop      Published    View →                              │
│                                           [View all in Events →]       │
│                                                                        │
│ MODERATION CONTEXT                                                     │
│ ⚠ 1 previous flag — Duplicate submissions · Resolved Jul 18            │
│ [ View History ]                                                       │
│                                                                        │
│ REQUEST MESSAGE                                                        │
│ "I organize weekly salsa socials in Boston…"                          │
│                                                                        │
│ ┌─ [sticky: DECISION] ───────────────────────────────────────────────┐ │
│ │ Request Status: Pending                                             │
│ │ Applicant: Maria Santos @mariasalsa                                 │
│ │ Account: Active                                                     │
│ │ Alerts: 0                                                           │
│ │ Notes: [_________________________]                                  │
│ │ [ Cancel ]  [ Approve Organizer ]                                   │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ (After approval → banner: "✓ Organizer approved. [ View organizer ]") │
└───────────────────────────────────────────────────────────────────────┘

Rejection flow (opens AdminConfirmDialog):
┌───────────────────────────────────────────────────────────────────────┐
│ Reject organizer request from @mariasalsa?                            │
│ This will mark the request as rejected. The applicant can re-apply.   │
│                                                                       │
│ Reason: [Insufficient Information ▼]                                  │
│ Message to applicant:                                                 │
│ [_________________________________________________]                  │
│ Internal Admin Note:                                                  │
│ [_________________________________________________]                  │
│                                                                       │
│ [ Cancel ]  [ Reject Request ]                                        │
└───────────────────────────────────────────────────────────────────────┘

Approval confirmation flow (flagged account → warning):
┌───────────────────────────────────────────────────────────────────────┐
│ Approve organizer access for @mariasalsa?                             │
│ @mariasalsa will be able to:                                          │
│ • Create events                                                       │
│ • Publish their own events directly                                   │
│ • Edit/cancel their own events                                        │
│ • Manage an organizer brand                                           │
│ They will NOT receive Moderator or Admin permissions.                  │
│                                                                       │
│ ⚠ This account is currently Flagged. Approving will not change the   │
│   account status.                                                     │
│                                                                       │
│ [ Cancel ]  [ Approve Organizer ]                                     │
└───────────────────────────────────────────────────────────────────────┘
```

## Critical files & anchors for implementation (when approved)

| File | Anchor | Why |
|---|---|---|
| `src/components/Admin/AdminSidebar.tsx` | `"Organizer Requests"` nav item (line 37, currently `built: false`) | Flip to `built: true`, add `to`, wire the pending-count badge |
| `src/components/Admin/AdminStatusBadge.tsx` | full file | Template for `AdminRequestStatusBadge` (same architecture: `STATUS_LABEL` + `STATUS_ICON` partial + `admin-status` base class) |
| `src/components/Admin/AdminActionMenu.tsx` | full file | Renders the queue-row / review-header `•••` action matrix (§5) |
| `src/components/Admin/AdminConfirmDialog.tsx` | full file | Reused verbatim for both approval (§8) and rejection (§7) flows |
| `src/pages/AdminUsersPage.tsx` | `updateParams` / `parseView` / `parseFilters` / `parseSort` / chip strip (lines 252-358, 370-418) | URL-state pattern the organizer-requests pages copy exactly |
| `src/pages/AdminUserDetailPage.tsx` | full file | Layout pattern (back-link → header → body of `admin-card` sections → actions) and the `rowActionItems` reuse for the detail header menu |
| `src/components/Admin/AdminRoleChangeDialog.tsx` | `CONSEQUENCE_COPY` (lines 21-29, the `organizer` entry) | The bullet list for the approval confirmation dialog body — this is the one piece of consequence copy that already exists and should be reused, not rewritten |
| `src/features/admin/model/usersQuery.ts` | `DisplayNameFor` / `identityLineFor` / `initialsFor` / `AdminUserRow` | Applicant identity vocabulary and the directory row shape the new RPC enriches |
| `src/components/Admin/AdminUsersTable.tsx` | `UserCell` (lines 77-101) | Avatar/name/username/email cell — the organizer-requests applicant cell is structurally identical |
| `src/components/Admin/AdminUsersToolbar.tsx` | debounced `handleSearchInput` (lines 64-86), `updateParams` filter strip | Search + filter-bar interaction pattern; organizer-requests toolbar mirrors this |
| `src/components/Admin/AdminUsersFilterDrawer.tsx` | `handleKeyDown` tab-trap (lines 10-29) | Drawer tab-trap reused for the organizer-requests filter drawer |
| `src/pages/AdminOverviewPage.tsx` | Organizer Requests metric card (lines 133-143) | Currently links `/admin/users`; should link `/admin/organizer-requests` once built, and the `metrics.organizerRequestCount` hard-zero (line 43 of `overviewMetrics.ts`) should read the new pending count |
| `src/features/admin/model/overviewMetrics.ts` | `organizerRequestCount: 0` (line 43) | Hardcoded to 0 "because no organizer_requests table exists yet" — Phase 8 populates this from the new count RPC |
| `AdminOverviewPage.test.tsx` | line 216-223 comment `// No organizer_requests table exists yet` | Update test expectation once the table exists — currently asserts `Organizer Requests` metric shows `0` |
| `src/components/Admin/AdminAccountStatusBadge.tsx` | full file | Reused for the queue's Account Status column (§3) |
| `supabase/migrations/20260813000100_audit_logs.sql` | the audit_logs grant + RLS policy | `organizer_request.approved` / `organizer_request.rejected` actions write here per §8/§11; the policy already permits admin reads |

**Do not move into Phase 9. This document is Phase 8 only, awaiting approval before any implementation plan or code.**

# Phase 5 — Users Management (`/admin/users`)

## Context

Build `/admin/users`, the admin's user-management screen, following the Phase 3 Events Management pattern exactly. Today the route does not exist: `src/components/Admin/AdminSidebar.tsx:29` renders Users as a disabled "Soon" item, and `src/features/admin/api/profilesRepo.ts` contains a single `fetchProfileCount()` used only by the Overview's Total Users card.

Phase 6 owns the User Detail page. Nothing in this phase links to `/admin/users/:id`, and no row action opens a detail view.

## Data reality — verified this session

`public.profiles` (`supabase/migrations/20260813000000_profiles.sql:5-15`):

```sql
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  role         text not null default 'user'
                 check (role in ('user', 'moderator', 'organizer', 'admin')),
  status       text not null default 'active'
                 check (status in ('active', 'flagged', 'suspended', 'banned')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

Indexes: `profiles_role_idx`, `profiles_status_idx`. Triggers: `on_auth_user_created` on `auth.users` calls `handle_new_user()`; `profiles_set_updated_at` calls `set_updated_at()`.

Six facts that constrain every decision below:

- **No `username`, no `email` column.** The brief's `@username` and `Email / Identity` columns have no backing field. Email lives in `auth.users`, which is not readable from the client under any existing grant.
- **`profiles.role` is display-only.** The migration's own header comment: _"NOT an authorization source — RequireAdmin and every RLS policy continue to read `auth.jwt() -> 'app_metadata' ->> 'role'`."_ `AuthContext.tsx:77` confirms: `isAdmin: user?.app_metadata?.role === "admin"`. Writing `profiles.role` alone grants nothing — a Change Role action that only touches `profiles` is theatre.
- **`profiles` has no write grant at all.** Only `grant select ... to authenticated` plus two SELECT policies exist. Role and status cannot be changed from the client today by any means.
- **Every auth user has a profiles row**, created by `handle_new_user()`. So "identity without a profile" is _not_ a profiles-row question.
- **No magic-link / OTP flow exists.** `grep -rn "signInWithOtp|magic|otp" src/` returns nothing; `SignInForm` is email + password only. The real identity class that has no auth account is the **guest submitter**: `public.events` rows with `submitter_id is null` and `source_type = 'user_submission'`, identified only by free-text `submitter_email` / `submitter_name`. `AdminEventsTable.tsx:76` already labels these "Guest Submitter". Since `useSubmitEventForm.ts:52` now always stamps `submitter_id`, this cohort is historical (pre-auth submissions) and forward-looking (it is exactly where magic-link submitters will land).
- **`audit_logs` already exists** (`supabase/migrations/20260813000100_audit_logs.sql`) with `actor_id, action, entity_type, entity_id, metadata jsonb, created_at` — a generic moderation-history table, already admin-readable.

## Decisions — settled, do not re-open

### One read function, not denormalised columns

`public.admin_user_directory()`, a `security definer` set-returning function, is the single read. It returns one row per identity — profile-backed and guest — joining `auth.users` for email and last sign-in, and aggregating `public.events` for contributions.

Rejected: copying `email` onto `profiles`. It needs a second `auth.users` trigger (hosted Supabase restricts `auth.users` trigger creation), drifts on email change, and still would not solve contribution counts or guest enumeration. The function solves all three in one round trip and keeps `auth.users` as the single source of truth for email.

The client fetches the whole directory once and does view/filter/sort/paginate in pure functions client-side — identical in shape to `fetchAllEvents` + `applyView`/`applyFilters`/`applySort`/`slice` in `AdminEventsPage.tsx:220-242`. Same code, same tests, same feel. Revisit only when the directory exceeds a few thousand rows.

### Two write functions, so the actions are real

`admin_set_user_role()` writes `profiles.role` **and** `auth.users.raw_app_meta_data->>'role'`, so a promotion actually grants authorization on the target's next token refresh. `admin_set_user_status()` writes `profiles.status` + `status_reason`, sets `auth.users.banned_until` for Ban, and both write `audit_logs`.

Rejected: `grant update on public.profiles` + an admin RLS policy. That path cannot touch `app_metadata`, cannot enforce "never demote the last admin" atomically, and would ship dialogs whose copy is false.

### Suspension gets teeth via one policy change

`public.account_is_active(uuid)` returns `profiles.status = 'active'`, defaulting **true** for ids with no profile row (anon submitters). The existing `"Anon can submit pending events"` policy gains `and public.account_is_active(auth.uid())`. That makes the Suspend dialog's promise — "temporarily lose access to restricted platform actions, including submitting events" — literally true, in one line, with no new tables.

### Moderation history stays in `audit_logs`

Both write functions insert `entity_type = 'profile'` rows with actions `user.role_changed`, `user.flagged`, `user.unflagged`, `user.suspended`, `user.banned`, `user.restored`, and `metadata` carrying `from_*`, `to_*`, `reason`. Current-state display needs exactly one new column, `profiles.status_reason`, mirroring the `cancellation_reason` precedent from Phase 3.

Rejected: a `user_moderation_actions` table (a second copy of `audit_logs` with a narrower key space) and the `suspended_at/by`, `banned_at/by`, `flagged_at` column family (six drift-prone columns for data `audit_logs` already timestamps and attributes).

### Role and status are visually different classes of thing

Status is the loud axis and escalates through four distinct treatments; role is the quiet axis and only elevated roles get a badge at all.

### Preset views are tabs, matching Phase 3

Eight tabs with counts, horizontally scrollable, collapsing to a single `<select>` below 768px — the exact `AdminViewTabs` behaviour already shipped. A view selector would hide the counts, which are the reason to look. `AdminViewTabs` is generalised (used generically for both Events and Users) rather than duplicated.

### Contributions is one number plus a pending sub-line

`4 contributions` with a muted `2 pending` beneath when pending > 0. The split the brief floats (`3 created / 2 submitted`) does not map onto the data: `source_type` describes the write site, not the person, and an admin-created event carries the admin's `submitter_id`. One total answers "does this person contribute", and the pending sub-line is the only part that is actionable. A guest with a single pending suggestion reads `1 contribution · 1 pending`, never `0 events`.

## 1. UX rationale

The screen answers four questions in descending frequency, and the layout is ordered to match — the same hierarchy discipline as `/admin/events`:

| Band         | Question                      | Element                                                                                      |
| ------------ | ----------------------------- | -------------------------------------------------------------------------------------------- |
| Header       | "Where am I?"                 | Title + description (no header action — accounts are created by signing up, not by an admin) |
| View tabs    | "Which slice am I working?"   | 8 preset tabs with counts                                                                    |
| Toolbar      | "Narrow to the ones I mean"   | Search, Role, Status, More Filters                                                           |
| Active chips | "Why am I seeing these rows?" | Removable filter chips + Clear all                                                           |
| Table        | "Read and act"                | 7 columns, one overflow menu per row                                                         |
| Pagination   | "Where am I in the set?"      | Range, page size, page links                                                                 |

Role and status are deliberately treated as different classes of information rather than a single "type" column: role is a quiet, mostly-default axis (only three of four values ever earn a badge), while status is the loud axis that must escalate visibly from Active through Flagged, Suspended, to Banned. Search, Role, and Status live in the always-visible toolbar because they are used on nearly every visit; Account Type and Joined-date live behind **More Filters**, keeping the toolbar one row — the same split rationale as Phase 3's events toolbar.

The identity model itself is the other rationale-shaping fact: this screen shows two different kinds of row — registered accounts (`profiles` + `auth.users`) and guest submitters (free-text `submitter_email`/`submitter_name` on `events` with no account at all). Every presentation decision below (avatars, identity line, action menu, badges) exists to make that distinction obvious without a dedicated "type" column stealing space from the seven that matter more.

## 2. Page hierarchy

`AdminUsersPage` composes in the same order as `AdminEventsPage`, so the two screens feel like one product:

1. `AdminPageHeader` — `title="Users"`, `description="Manage SalsaSegura accounts, roles, and account status."`, no header action.
2. Error banner, shown when the directory fails to load: `.admin-banner--error`, `role="alert"`, "We couldn't load users." + `Try Again` button that refetches. Everything below is suppressed while this error is set; the admin shell stays usable.
3. `AdminViewTabs`, generalised: `views={USER_VIEWS}`, `panelId="admin-users-tabpanel"`, `ariaLabel="User views"`, `selectId="admin-users-view-select"`, `selectLabel="User view"`.
4. Toolbar card containing `AdminUsersToolbar`, and below it the removable filter-chip row + `Clear all` (shown at ≥2 chips) — same markup and `admin-filter-chip` / `admin-filter-chip-dismiss` classes as the events page.
5. Result count: `<p role="status" class="admin-users-page__result-count">{total} user{s}</p>`.
6. Table card: `.admin-card` with `id="admin-users-tabpanel" role="tabpanel" aria-labelledby={`admin-view-tab-${view}`}`, holding the loading / empty / table branches.
7. `AdminPagination` — the existing shared component unchanged: `PAGE_SIZE_OPTIONS` 25/50/100, `DEFAULT_PAGE_SIZE` 25, with the identical first-visible-index recalculation on page-size change.
8. `AdminUsersFilterDrawer`, then the four dialogs (Role Change, Flag, and the shared Confirm dialog used for Suspend/Ban/Restore/Remove Flag), mounted conditionally from a single `pendingAction` state.

URL is the state store, exactly like `/admin/events`: `useSearchParams` plus a `updateParams(patch, resetPage = true)` helper carries `view`, `q`, `role` (comma-joined), `status` (comma-joined), `type`, `from`, `to`, `sort`, `dir`, `page`, `size`. Every parsed value is validated against a `VALID_*` array with a default fallback.

## 3. Desktop table spec

`AdminUsersTable` is a hand-rolled `<table>` plus a parallel `<ul>` of cards for narrow viewports — there is no shared table primitive in this codebase, so this structurally clones `AdminEventsTable`.

Columns, seven wide like the events table: **User**, **Email**, **Role**, **Status**, **Joined**, **Contributions**, **Actions**.

Sortable headers (reusing the local `SortableHeader` pattern with `aria-sort` and `ArrowUp`/`ArrowDown`/`ArrowUpDown` icons): `User` → sorts by `name`, `Joined` → sorts by `joined`, `Contributions` → sorts by `contributions`. `Email`, `Role`, `Status`, and `Actions` are not sortable.

Row error state: `<tr class="admin-users-table__error"><td colSpan={7} role="alert">Action failed: {error}</td></tr>` rendered when the row's id matches the current error id; the card equivalent is a `role="alert"` paragraph. Busy rows get `style={{ opacity: 0.6 }}` and a disabled menu, exactly as events rows do.

## 4. Registered-user presentation

The identity cell (`admin-users-table__user`) uses a 12px gap layout, mirroring the events table's `EventCell`:

- Avatar, 40px, `border-radius: 50%`, `flex-shrink: 0`:
  - `avatar_url` present → `<img src alt="" loading="lazy" width={40} height={40}>` (decorative; the name is adjacent text).
  - Profile without an avatar → an initials circle using `initialsFor(row)`, `--admin-surface-high` background, `--admin-text-muted` ink, `aria-hidden="true"`.
- Line 1: `displayNameFor(row)` in `.admin-users-table__name` (`font-weight: 600`, `--admin-text-strong`). **Plain text, not a link** — there is no detail route until Phase 6.
- Line 2: `identityLineFor(row)` in `.admin-users-table__identity` (0.8rem, `--admin-text-muted`) — `@username` when set, `"No username set"` when not.
- A `You` chip (`.admin-chip`) is appended when `row.user_id === currentUserId`.
- Line 3, visible only in the 768–1023px tablet band (`.admin-users-table__secondary-line`): `{email} · Joined {date}`.

`displayNameFor` for a registered account is `row.display_name?.trim() || "Unnamed account"`. `identityLineFor` for a registered account with a username is `"@" + username`; without one it is `"No username set"`. Since the migration ships with no backfill, every profile reads `"No username set"` until a profile editor writes handles — that is the intended launch state, not a bug.

## 5. Magic-link-only presentation

Guest rows (`kind === "guest"`) represent identities with no `auth.users` account — historically pre-auth submitters, and forward-looking magic-link submitters once that flow exists — surfaced entirely through `public.events` rows where `submitter_id is null` and `source_type = 'user_submission'`.

- Avatar slot renders a `UserRound` icon at 18px inside a dashed-border circle, `aria-hidden="true"` — a silhouette distinct enough that a guest can never be mistaken for a community member at a glance.
- Line 1: `displayNameFor(row)` returns `row.display_name ?? "Guest Submitter"` (sourced from `submitter_name`, defaulting to `"Guest Submitter"` when blank).
- Line 2: `identityLineFor(row)` always returns `"No public profile"`.
- `initialsFor(row)` returns `""` for guests — they render the icon, never initials.
- No role badge is rendered at all for guest rows (not a dash, not a placeholder) — a guest has no `profiles.role` to display.
- `AdminAccountStatusBadge` always renders `active` for guest rows; the directory function hard-codes `status = 'active'` for guests, since a row with no account has no account status to restrict.
- The action menu for a guest row contains exactly one item: `View Submissions`.
- A guest who later registers with the same email address is de-duplicated: the `admin_user_directory()` function's `not exists (select 1 from auth.users u2 where lower(u2.email) = g.email)` clause ensures they appear once, as their registered self, never twice.

## 6. Search

The toolbar search input (`Search` icon inside, `aria-label="Search users"`, `placeholder="Search users, usernames, or email…"`) uses a 200ms debounce with the exact `searchInput`/`syncedQ` mirror-state pattern already shipped on the events toolbar.

`applyUserFilters`'s `q` rule: case-insensitive substring match over `display_name`, `username`, and `email`. Whitespace-only `q` matches everything. This is the brief's "organizer/brand name where relevant" — an organizer's brand name _is_ their `display_name`, so no separate brand field is needed.

## 7. Filters

Toolbar-level filters (always visible, used on nearly every visit):

- **Role** — multi-select popover over `user` / `moderator` / `organizer` / `admin`. Empty selection matches everything; otherwise membership. A guest row (`role === null`) never matches a non-empty role filter.
- **Status** — multi-select popover over `active` / `flagged` / `suspended` / `banned`. Same empty-matches-everything rule.

Both popovers copy the events toolbar's status-popover pattern verbatim: `aria-haspopup="menu"`, `aria-expanded`, `useEscapeKey`, pointerdown-outside close, checkbox items, and a summary label that collapses to `Role (2)` past one selection.

Drawer-level filters (`AdminUsersFilterDrawer`, behind **More Filters**), a clone of `AdminEventsFilterDrawer` — overlay, `role="dialog"`, `aria-modal`, `aria-label="More filters"`, focus-on-open, Tab-cycling, `Clear all` + `Apply` footer:

- **Account Type** — `Any account type` / `Registered` / `Magic-link only`, backing `filters.kind`.
- **Joined after** / **Joined before** — two `type="date"` inputs, backing `filters.from` / `filters.to`, compared against `created_at.slice(0, 10)`.

`drawerFilterCount` is `[filters.kind, filters.from, filters.to].filter(Boolean).length`, shown as a badge on the **More Filters** button.

## 8. Preset views

Eight tabs, horizontally scrollable with counts, collapsing to a single `<select>` below 768px:

| Tab                   | View         | Predicate                |
| --------------------- | ------------ | ------------------------ |
| All Users             | `all`        | everything               |
| Registered            | `registered` | `kind === "profile"`     |
| Organizers            | `organizers` | `role === "organizer"`   |
| Moderators            | `moderators` | `role === "moderator"`   |
| Flagged               | `flagged`    | `status === "flagged"`   |
| Suspended             | `suspended`  | `status === "suspended"` |
| Banned                | `banned`     | `status === "banned"`    |
| Magic-Link Submitters | `guests`     | `kind === "guest"`       |

Chosen over a dropdown selector because a dropdown hides the counts, which are the reason to look — the identical rationale that shipped the events tabs in Phase 3.

## 9. Role badges

`AdminRoleBadge` takes `{ role: UserRole | null }`. Role is the quiet axis — the default (`user`) carries no visual weight at all, and only the three elevated roles earn a pill:

| Role           | Treatment                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `user`         | Plain `--admin-text-muted` text "User", no pill, no icon — the default needs no emphasis                                    |
| `organizer`    | Outlined pill, `Building2` icon 12px, `--admin-text-strong` ink, `--admin-border` border                                    |
| `moderator`    | Outlined pill, `ShieldCheck` icon 12px, ink `#4338ca`, border `#c7d2fe`, tint `#eef2ff`                                     |
| `admin`        | Outlined pill, `Shield` icon 12px, ink `--admin-primary`, border `#fecdd3`, tint `--admin-primary-tint`, `font-weight: 700` |
| `null` (guest) | `<span aria-hidden="true">—</span>` plus `<span class="admin-visually-hidden">No role — no profile</span>`                  |

The two elevated-privilege roles are distinguished from each other and from `organizer` by icon _and_ by having a badge at all, so the distinction survives greyscale. Classes: `.admin-role`, `.admin-role--user|organizer|moderator|admin`.

## 10. Status badges

`AdminAccountStatusBadge` takes `{ status: AccountStatus; reason?: string | null }`. It reuses the existing `.admin-status` base rule and adds four modifiers; escalation is carried by four different visual mechanisms, not four hues:

| Status      | Treatment                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `active`    | Quiet. Solid green dot via `::before` (added to the existing dot rule alongside `--approved`), tint `#ecfdf5`, ink `#047857`, border `#a7f3d0` |
| `flagged`   | `Flag` icon 12px, tint `var(--admin-attention-tint)`, ink `var(--admin-attention-ink)`, border `#fde68a`                                       |
| `suspended` | `PauseCircle` icon 12px, tint `#fef2f2`, ink `#b91c1c`, border `#fecaca`                                                                       |
| `banned`    | `Ban` icon 12px, **inverted**: background `#b91c1c`, ink `#fff`, border `#b91c1c`                                                              |

Banned is the only inverted badge anywhere in the admin shell — reserved for the one irreversible-feeling state. When `reason` is non-empty the badge sets `title={reason}` and appends `<span class="admin-visually-hidden">Reason: {reason}</span>`, so the "why" is available without a dedicated column.

Guest rows always render `active` — the directory function hard-codes it, since a row with no account has no account status to restrict.

## 11. Contributions

The Contributions cell renders `{n} contribution{s}` or `No contributions`; beneath it, only when `pending_count > 0`, a muted `<p class="admin-users-table__muted">{n} pending</p>`.

This is one number plus a pending sub-line, not the split the brief floats (`3 created / 2 submitted`), because that split does not map onto the data: `source_type` describes the write site, not the person, and an admin-created event still carries the admin's `submitter_id`. One total answers "does this person contribute", and the pending sub-line is the only part that is actionable. A guest with a single pending suggestion reads `1 contribution · 1 pending`, never `0 events`.

`contributions` and `pending_count` both come from `admin_user_directory()`, aggregating `public.events` per `submitter_id` (registered) or per lowercased `submitter_email` (guest), counting all rows and rows `where status = 'pending'` respectively.

## 12. Row actions

Actions are produced by a local `rowActionItems(user, currentUserId, adminCount, onAction)` returning `ActionMenuItem[]` for `AdminActionMenu` (`label={`Actions for ${displayNameFor(user)}`}`). This matrix is the contract:

| Row                  | Menu                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| guest                | `View Submissions`                                                                      |
| self (any status)    | `View Contributions`                                                                    |
| last remaining admin | `View Contributions`                                                                    |
| `active`             | `View Contributions` · — · `Change Role` · — · `Flag`, `Suspend`, `Ban` (danger)        |
| `flagged`            | `View Contributions` · — · `Change Role` · — · `Remove Flag`, `Suspend`, `Ban` (danger) |
| `suspended`          | `View Contributions` · — · `Restore Access`, `Ban` (danger)                             |
| `banned`             | `View Contributions` · — · `Restore Access`                                             |

`—` marks `separatorBefore: true`; `Ban` also carries `tone: "danger"`. Icons: `ListChecks` (view), `UserCog` (change role), `Flag` / `FlagOff`, `PauseCircle` (suspend), `Ban`, `RotateCcw` (restore).

"Last remaining admin" is `user.role === "admin" && adminCount <= 1`, where `adminCount` is computed page-side from the loaded directory: `users.filter((u) => u.role === "admin").length`.

No role-management action is ever offered on a guest row — it has no profile to carry a role, and the underlying `admin_set_user_role` function would raise `P0002` (no profile) if called. No destructive or role action is ever offered on your own row or on the last admin; that guard is duplicated in the SQL functions, so a stale client cannot get around it.

Nothing mutates directly from the menu — every mutating item opens its matching dialog first, per the deliberate "not one-click table actions" rule. `View Contributions` / `View Submissions` is the only immediate item, and navigates to `/admin/events?submitter=<value>`, where the value is `user_id` for a profile row or the lowercased `email` for a guest row.

There is deliberately no `View User` / `View Identity` item and the name is not a link, because `/admin/users/:id` is Phase 6 scope and this phase ships nothing that navigates to a page that does not exist.

## 13. Role change

`AdminRoleChangeDialog` is a new dialog (the shared `AdminConfirmDialog` has no `<select>`), with overlay + `role="dialog" aria-modal="true" aria-labelledby`, `useEscapeKey`, and initial focus on the select.

Heading uses `@username` when set, otherwise `displayNameFor(user)`: `Change role for @rooseveltsegura`.

Body layout:

```
Current role
Admin

New role
[ Organizer ▼ ]

Organizers can publish and manage their own events without review.

Takes effect the next time they sign in or their session refreshes.

[ Cancel ]  [ Change Role ]
```

Consequence copy is keyed on the _selected_ role and rendered in a `.admin-role-change__consequence` block with `role="status"` so it is announced when the select changes:

| Role        | Copy                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`      | "Removes elevated access. They can still submit events for review."                                                                                            |
| `moderator` | "Moderators can review, edit, approve, and reject user-submitted events. They cannot approve Organizer requests."                                              |
| `organizer` | "Organizers can publish and manage their own events without review. Granting Organizer here is a direct role change, not the approval of a submitted request." |
| `admin`     | "Admins have full access, including user management and role changes. Grant this sparingly."                                                                   |

Confirm is disabled while the selection equals the current role and while the mutation is in flight; its label reads `Change Role`, or `Working…` while busy. Errors render inside the dialog in a `role="alert"` block and the dialog stays open, so a rejected change (last admin, self) is readable in place rather than lost behind a closed dialog.

`admin_set_user_role()` on the server writes both `profiles.role` **and** `auth.users.raw_app_meta_data->>'role'`, which is what makes the "takes effect on next refresh" line true — a role write that only touched `profiles` would grant nothing, since `RequireAdmin` and every RLS policy read `auth.jwt() -> 'app_metadata' ->> 'role'`.

## 14. Moderator assignment

Moderator assignment needs no separate dialog: it is the Role Change dialog (§13) with the moderator sentence — "Moderators can review, edit, approve, and reject user-submitted events. They cannot approve Organizer requests." — and the same deliberate two-step confirm (open menu → Change Role → pick Moderator → Confirm) that "not visually casual" asks for. No dedicated one-click "Make Moderator" shortcut exists; the role change flow is the single, consistent path for every role transition.

## 15. Organizer promotion

Organizer promotion is likewise the Role Change dialog (§13), distinguished only by its consequence copy: "Organizers can publish and manage their own events without review. Granting Organizer here is a direct role change, not the approval of a submitted request." That sentence exists specifically to name the distinction the UI cannot otherwise show — no organizer-request record exists to link to (`AdminSidebar.tsx` shows Organizer Requests as unbuilt), and inventing a link to a feature that does not exist would be worse than naming the gap in copy. When an Organizer Requests workflow ships later, this dialog's copy is the first thing that should change.

## 16. Flagging

`AdminFlagUserDialog` is a new dialog, because flagging needs a reason taxonomy plus free-text notes that `AdminConfirmDialog` does not support.

Title: `Flag @username for review?`

Body: "Flagging is an internal review state. It does not restrict the account." — flagging is explicitly not a punishment and must not be dressed as one.

Fields:

- Reason `<select>`: `Spam`, `Suspicious organizer activity`, `Repeated inaccurate submissions`, `Harassment`, `Other`.
- Notes `<textarea>`, labelled `Notes (optional)`, becoming `Notes (required)` and blocking confirm when the reason is `Other`.

`onConfirm` receives `notes ?`${reason} — ${notes}`: reason`, which becomes `profiles.status_reason` and the `reason` field in the `user.flagged` audit-log entry. Confirm button label: `Flag account`, tone neutral (not danger).

Removing a flag (`Remove Flag`) uses the shared `AdminConfirmDialog` instead (§18), since it needs no reason taxonomy of its own — see the Remove Flag row in §18's copy table.

## 17. Suspension

Suspend uses the shared `AdminConfirmDialog`, with a reason field but no requirement to fill it in:

| Field   | Value                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Title   | `Suspend @username?`                                                                                                                     |
| Body    | "This account will temporarily lose access to restricted platform actions, including submitting events. You can restore it at any time." |
| Reason  | `Reason (optional)`                                                                                                                      |
| Confirm | `Suspend User`                                                                                                                           |
| Tone    | danger                                                                                                                                   |

This copy is made literally true by one policy change: `public.account_is_active(uuid)` returns `profiles.status = 'active'` (defaulting **true** for ids with no profile row, i.e. anonymous submitters), and the existing `"Anon can submit pending events"` policy on `public.events` gains `and public.account_is_active(auth.uid())`. A suspended account's event-submission insert is then rejected by RLS, with no new tables required.

Timed suspensions are explicitly not built in this phase: `admin_set_user_status()` takes no expiry parameter and the dialog offers no date picker. "Until manually restored" is the only behaviour, and the Suspend body copy says so rather than implying an automatic end date.

## 18. Ban/restore

Ban, Restore, and Remove Flag all use the shared `AdminConfirmDialog`:

| Action      | Title                           | Body                                                                                                                               | Reason              | Confirm          | Tone    |
| ----------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------- | ------- |
| Ban         | `Ban @username?`                | "This user will lose access to SalsaSegura when their session next refreshes. Existing content will not automatically be deleted." | `Reason` (required) | `Ban User`       | danger  |
| Restore     | `Restore access for @username?` | "Access is restored immediately. Their role is unchanged."                                                                         | none                | `Restore access` | neutral |
| Remove Flag | `Remove the flag on @username?` | "The account returns to Active. The flag reason is cleared."                                                                       | none                | `Remove flag`    | neutral |

Ban deliberately does not offer content deletion — account access and content removal stay separate decisions; the events screen owns content, this screen owns access.

Two shared-component changes to `AdminConfirmDialog` land alongside this feature (and also improve the events screen, which reuses the same component):

1. **Enforce `reasonField.required`.** When required and the trimmed reason is empty, `handleConfirm` no longer calls `onConfirm`; it sets local `touched` state that renders `<p class="admin-field__error" role="alert">A reason is required.</p>` and focuses the textarea. Previously `required` was passed to the DOM and otherwise ignored, so the Ban dialog could submit with an empty reason.
2. **Restore focus on close.** The mount effect captures `document.activeElement` and refocuses it on cleanup, instead of dropping focus to `<body>` when the dialog closes — satisfying "focus returns logically after dialogs close" for both this screen and the events screen.

`admin_set_user_status()` on the server sets `auth.users.banned_until = 'infinity'` for Ban, which is what makes "will lose access... when their session next refreshes" literally true, and writes the appropriate `user.*` audit action (`user.banned`, `user.suspended`, `user.restored`, `user.unflagged`) alongside `from_status`/`to_status`/`reason` metadata.

## 19. Admin self-protection

Self-protection is enforced twice — once for UX (so the option is never offered) and once server-side (so a stale client cannot bypass it):

- **Client:** the row-action matrix (§12) offers only `View Contributions` on your own row (`user.user_id === currentUserId`) and on the last remaining admin (`role === "admin" && adminCount <= 1`), regardless of current status.
- **Server, `admin_set_user_role()`:** raises `"You cannot change your own role."` if `p_user_id = auth.uid()`; raises `"This is the only Admin account. Promote another Admin first."` if the target is currently the only row with `role = 'admin'` and the new role is not `admin`.
- **Server, `admin_set_user_status()`:** raises `"You cannot change your own account status."` if `p_user_id = auth.uid()`; raises `"This is the only active Admin account."` if the target is an admin, the new status is `suspended` or `banned`, and they are the only row with `role = 'admin' and status = 'active'`.

Errors surface inside the open dialog (§13, §17, §18) via `role="alert"`, and the dialog is not dismissed, so a rejected action is legible in place.

## 20. Empty/loading/error

**Loading:** 8 skeleton rows inside a container with `aria-busy="true"` and `<p role="status">Loading users…</p>`; each skeleton row is a 40px `.admin-skeleton` circle plus two `.admin-skeleton` lines plus a pill — the events skeleton, adapted with a round avatar in place of the events thumbnail.

**Directory-load error:** `.admin-banner--error`, `role="alert"`, "We couldn't load users." with a `Try Again` button that calls `refetch`. Rendered in place of the tabs/toolbar/table while `error` is set, so the shell stays usable but the stale/partial table is never shown.

**Empty states**, evaluated in this order:

| Condition                       | Heading                         | Body / action                                       |
| ------------------------------- | ------------------------------- | --------------------------------------------------- |
| directory empty                 | `No users yet`                  | "Accounts appear here as soon as someone signs up." |
| `total === 0` with active chips | `No users match these filters.` | `Clear Filters` button calling `clearAllFilters`    |
| `total === 0`, view `flagged`   | `No flagged accounts.`          | —                                                   |
| `total === 0`, view `suspended` | `No suspended accounts.`        | —                                                   |
| `total === 0`, view `banned`    | `No banned accounts.`           | —                                                   |
| `total === 0`, view `guests`    | `No magic-link submitters.`     | —                                                   |
| `total === 0` otherwise         | `No {view label} users`         | —                                                   |

Positive empties (a tab or filter that legitimately has zero rows) carry no illustration and no action — there is nothing to do, and offering an action would imply otherwise. A production instance may show `0` on the Magic-Link Submitters tab permanently, since `useSubmitEventForm.ts:52` has stamped `submitter_id` on every submission since Phase 2 — that reads as correct, not broken.

**Row-action error:** covered in §3 — a `role="alert"` row/card inline with the affected row, `Action failed: {error}`, without disturbing any other row.

## 21. Tablet & mobile

The table adopts the exact 768px/1024px column-hiding strategy already shipped for `AdminEventsTable`:

- **Below 768px:** `.admin-users-table__scroll { display: none }`; the card list (`.admin-users-cards`) is shown instead.
- **768px–1023px:** table visible, cards hidden; the `--email` and `--joined` columns are `display: none`; `.admin-users-table__secondary-line` (`{email} · Joined {date}`) becomes `display: block` under the name.
- **≥1024px:** table `min-width: 960px`; `--email`/`--joined` columns return to `table-cell`; the secondary line is hidden again.

**Mobile card** (`.admin-users-cards__item`, `.admin-card`):

1. Head: avatar + name + `identityLineFor(row)`.
2. Next line: `AdminRoleBadge` and `AdminAccountStatusBadge` side by side.
3. Labelled rows: `Joined` and `Contributions` (`Contributions` renders as `4 · 2 pending` when there are pending submissions).
4. The action menu (same `rowActionItems` matrix as the table).

Guest cards omit the role badge entirely rather than rendering a dash — consistent with §5 and §9's `null`-role handling in the table.

## 22. Accessibility

- **Tabs:** the generalised `AdminViewTabs` keeps its existing roving-tabindex keyboard behaviour, `admin-view-tab-${view}` id scheme, and `aria-controls`/`aria-labelledby` wiring into the `tabpanel`. Below 768px it collapses to a labelled `<select>` (`selectLabel="User view"`) rather than losing keyboard support.
- **Popovers (Role, Status):** `aria-haspopup="menu"`, `aria-expanded`, closed by `Escape` (`useEscapeKey`) and by pointerdown outside.
- **Filter drawer:** `role="dialog"`, `aria-modal="true"`, `aria-label="More filters"`, focus moves in on open and Tab cycles within the drawer.
- **Dialogs (Role Change, Flag, Confirm):** `role="dialog" aria-modal="true" aria-labelledby`, `Escape` to close, initial focus placed on the first meaningful control (the select, in Role Change), and — per the `AdminConfirmDialog` fix in §18 — focus returns to the row's ⋯ trigger on close instead of falling to `<body>`.
- **Reason validation:** a required-but-empty reason (Ban) renders `<p class="admin-field__error" role="alert">A reason is required.</p>` and moves focus to the textarea, so the failure is both visible and announced.
- **Live regions:** each successful mutation sets an `announcement` string (`"Role changed to Moderator"`, `"@handle suspended"`, `"@handle restored"`, `"Flag removed"`) rendered into a persistent `<p role="status" class="admin-visually-hidden">{announcement}</p>` near the top of the page, so screen-reader users hear the outcome even though the affected row updates silently in place.
- **Decorative vs. informative icons:** avatars, initials circles, and the guest silhouette icon are all `aria-hidden="true"` (the adjacent name text carries the meaning); the "No role" badge for guest rows pairs a hidden `—` glyph with an `.admin-visually-hidden` "No role — no profile" string for assistive tech.
- **Row menus:** each `AdminActionMenu` is labelled `Actions for {displayNameFor(user)}`, openable by Enter, navigable by ↑/↓, closeable by Escape with focus returning to the ⋯ trigger.

## 23. Database changes (Now / Later / Unnecessary)

**Recommended Now** (built in the `20260815000000_users_management.sql` migration):

- `profiles.username` — nullable `text`, case-insensitive unique via `profiles_username_lower_idx` on `lower(username)`, format-checked to `^[A-Za-z0-9_]{3,24}$`. No backfill: deriving handles from email local-parts would publish a fragment of a private address as public identity for users who never chose a handle.
- `profiles.status_reason` — nullable `text`, mirroring the `cancellation_reason` precedent from Phase 3.
- `profiles_created_at_idx` on `created_at desc`.
- `admin_user_directory()` — the single `security definer` read, unioning `profiles`/`auth.users` (with per-user `events` aggregation) and a guest cohort derived from `submitter_id is null and source_type = 'user_submission'` events, de-duplicated against `auth.users` by email.
- `admin_set_user_role()` — writes `profiles.role` **and** `auth.users.raw_app_meta_data->>'role'` in one call, enforces "cannot change your own role" and "cannot demote the last admin," and writes a `user.role_changed` audit-log row.
- `admin_set_user_status()` — writes `profiles.status` + `status_reason`, sets `auth.users.banned_until = 'infinity'` on Ban, enforces "cannot change your own status" and "cannot suspend/ban the last active admin," requires a reason to Ban, and writes the matching `user.*` audit-log action.
- `account_is_active()` plus the `"Anon can submit pending events"` policy guard — the one-line change that makes Suspend actually restrict event submission, executable by `anon` (not just `authenticated`) so it doesn't break public submission.
- Reuse of the existing `audit_logs` table for all six `user.*` moderation actions (`user.role_changed`, `user.flagged`, `user.unflagged`, `user.suspended`, `user.banned`, `user.restored`) — no new audit infrastructure.

**Recommended Later:**

- An `organizer_requests` table, which is what would turn "Approve Organizer Request" into a distinct flow instead of a copy distinction inside the Role Change dialog (§15).
- `suspended_until` on `profiles`, to support timed suspensions instead of the current manual-restore-only model (§17).
- A `user_flags` table, if flag reasons ever need to be many-per-user or independently reportable rather than the single `status_reason` slot used today.
- `profiles.updated_by`, if "who last touched this profile" needs to be queryable outside `audit_logs`.
- Avatar upload storage, so `avatar_url` can be populated by users rather than remaining permanently null in the absence of any upload path.

**Unnecessary:**

- A `user_moderation_actions` table — `audit_logs` already stores actor, action, entity, reason, and timestamp for every one of the six `user.*` actions; a parallel table would be a narrower-keyed duplicate.
- `suspended_at`/`suspended_by`/`suspension_reason`/`banned_at`/`banned_by`/`ban_reason`/`flagged_at` as dedicated columns — six drift-prone fields duplicating data `audit_logs` already timestamps and attributes, with `status_reason` already covering "why" for the current state.
- A stored profile-completeness or account-type field — both `kind` (profile vs. guest) and completeness are cheaply derivable at render time from the directory row, and a stored copy would go stale against the row it describes.
- Forcing a `profiles` row for guest submitters — they have no `auth.users` id to key one on, and `admin_user_directory()` already unions them in without one.

## 24. Final wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Users                                                                        │
│ Manage SalsaSegura accounts, roles, and account status.                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ 🔍 Search users, usernames, or email… ]  [ Role ▾ ] [ Status ▾ ] [ ⚙ More ]│
│ "maria" ×   Organizer ×   Clear all                                          │
│                                                                              │
│ All Users 412 │ Registered 388 │ Organizers 12 │ Moderators 3 │ Flagged 4 │ …│
│                                                                              │
│ 25 users                                                                     │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ USER ⇅         EMAIL           ROLE        STATUS     JOINED ⇅  CONTRIB ⇅│ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ (RS) Roosevelt Segura  ✉ r@ex…  🛡 Admin   ● Active   Aug 4    12       ⋯│ │
│ │      @rooseveltsegura                                          2 pending │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ (MS) Maria Santos      ✉ m@ex…  🏢 Organizer ⚑ Flagged Jul 2   3        ⋯│ │
│ │      @mariasalsa                                                         │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ ( ○ ) Guest Submitter   ✉ v@ex…  —         ● Active   Aug 10   1        ⋯│ │
│ │      No public profile                                         1 pending │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ Showing 1–25 of 412      Rows per page: 25 ▾    ← Prev  1 2 3 … 17  Next →   │
└──────────────────────────────────────────────────────────────────────────────┘
```

</content>
<parameter name="i">Write phase5 admin users management design doc

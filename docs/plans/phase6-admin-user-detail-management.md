# Phase 6 — User Detail & Role Management (`/admin/users/:id`)

## Context

Phase 5 shipped `/admin/users`: the directory, the eight preset views, and every mutating action (Change Role, Flag/Unflag, Suspend, Ban, Restore) as table-row actions opening dialogs. It deliberately shipped nothing that navigates to `/admin/users/:id` — that page is this phase.

This document is the design deliverable requested for Phase 6, produced against the brief pasted this session. It does not implement anything; per the brief's own closing line, it stops at "wait for my approval before continuing."

## Data reality — verified this session

Five facts from the brief don't match what exists in the codebase today, and they change what Phase 6 can build without inventing new subsystems:

- **RSVP tracking does not exist.** `events.rsvp_link` is a single outbound URL an organizer/admin sets on the event ("Get Tickets" / "RSVP · Free" in `EventModal.tsx`) — nobody's RSVP is ever recorded. There is no attendee table. "14 events attended / RSVP'd" (brief §11) has no data to compute it from; building it means a new attendance-tracking feature, not a User Detail affordance.
- **Organizer Requests do not exist.** `grep -rn "organizer_request"` across `src/` and `supabase/migrations/` returns nothing. `AdminSidebar.tsx` already marks "Organizer Requests" `built: false`. Brief §12 ("ORGANIZER REQUEST … Pending … [ Review Request ]") has no request to review.
- **`audit_logs` is already client-readable.** `20260813000100_audit_logs.sql` grants `select` to `authenticated` and has the RLS policy `"Admins read audit log"` (`using (auth.jwt()->'app_metadata'->>'role' = 'admin')`). Phase 5's write functions already insert `user.role_changed` / `user.flagged` / `user.unflagged` / `user.suspended` / `user.banned` / `user.restored` rows with `entity_type = 'profile'`, `entity_id = <profile id>`, and `metadata` carrying `from_*`/`to_*`/`reason`. Nothing currently *reads* this table from the client — that's the one new repo function this phase needs, not a new table or RPC.
- **The submitter deep-link filter Phase 5 built is directly reusable.** `eventsQuery.ts`'s `submitter: string | null` filter (added in Phase 5 step 9) matches `event.submitter_id === filters.submitter || event.submitter_email?.toLowerCase() === needle`. The exact same predicate, run against the already-fetched `useAdminEvents()` data, produces the "Events & Contributions" list inline on this page — no new query.
- **Magic-link auth still doesn't exist** (reconfirmed; same finding as Phase 5). Brief §27 ("Magic-Link Identity Conversion") is necessarily a forward-looking note, not a buildable flow.

Two more that matter for scope:

- `auth.users.email_confirmed_at` and `.last_sign_in_at` are both native Supabase Auth columns, already reachable the same way `admin_user_directory()` already reaches `last_sign_in_at` — a one-column, additive extension of that function, not a new one.
- Every admin who could have performed a moderation action (the `actor_id` on an `audit_logs` row) is themselves a row in the already-fully-fetched `useAdminUsers()` result — resolving "Actioned by @username" is a client-side lookup against data already in cache, not a join.

## Decisions — settled, do not re-open

### One extra directory column, not a new RPC

`admin_user_directory()` gains a trailing `email_confirmed_at boolean` column (additive — the existing Phase 5 TypeScript caller just gets one more field). The detail page reads the **same cached `useAdminUsers()` result** already in the TanStack Query cache (`["admin", "users"]`) and finds the row by `id` — no dedicated `admin_user_detail(id)` RPC, no second round trip for identity/role/status/contributions. This is Phase 5's own stated pattern ("fetch once, derive everything client-side … revisit only when the directory exceeds a few thousand rows") applied consistently rather than reinvented per screen.

Rejected: a single-row detail RPC. It would duplicate a query the client already has, for no additional correctness — the only genuinely new reads this page needs (audit log, this person's events) are cheap, targeted, and don't belong in the bulk directory function anyway.

### Moderation/activity timeline reads `audit_logs` directly — no new table, no new function

New repo function `fetchUserAuditLog(entityId: string, limit = 50)`: `supabase.from("audit_logs").select("*").eq("entity_id", entityId).order("created_at", { ascending: false }).limit(limit)`. Existing grant + RLS policy already permit this for any admin session. Zero migration required for this read.

Rejected: `user_moderation_actions` table (brief §35). Same rejection as Phase 5, now doubly confirmed — `audit_logs` already stores actor, action, entity, reason, and timestamp, and is now proven directly queryable from the client with no RPC indirection. A second table would be a narrower copy of data that already exists and is already reachable.

### Events & Contributions reuses the Phase 5 submitter filter, not a new query

`applyFilters(events, { ...filters, submitter: user.user_id ?? user.email })` against the already-fetched `useAdminEvents()` data, sliced to the 5 most recent, with a "View all →" link to `/admin/events?submitter=<value>` (the exact deep link Phase 5's row action already builds). One filter predicate, one deep link, used from two places.

### Suspended/Banned "Since" and "Actioned by" come from `audit_logs`, not new columns

Reaffirms Phase 5's original rejection of `suspended_at/by`, `banned_at/by` columns (brief §35 asks to re-evaluate this — the answer is unchanged and now has one more supporting fact): the most recent `audit_logs` row for this `entity_id` with `action in ('user.suspended','user.banned')` supplies both `created_at` ("Since") and `actor_id`, resolved to `@username` by looking that id up in the already-loaded `users` list. `status_reason` already supplies "Reason". Six columns' worth of drift-prone state collapses to one client-side lookup over data already being fetched for the timeline.

### RSVP Activity, Organizer Requests: not built, because there is nothing to show

Both are real Data reality gaps (above), not styling choices. Building either means shipping a feature this phase wasn't asked to design (attendee tracking; an organizer-request submission and approval flow). Both go in the database section as **Recommended Later**, gated on that underlying feature actually existing — consistent with `AdminSidebar.tsx` already marking Organizer Requests unbuilt.

### Existing-Organizer summary is buildable now; pending-request review is not

`role === "organizer"` is already in the data. Brand name (`display_name`), event counts, and the "View Events" deep link are all already-available fields/filters. Only the *request* half of Organizer UX (§12, §21 "Directly Promote" vs "Approve Request" distinction) needs the request table that doesn't exist — the distinction the copy makes ("a direct role change, not the approval of a submitted request") is exactly what Phase 5's `AdminRoleChangeDialog` consequence copy for `organizer` already says, and this page reuses that same dialog verbatim.

### Every mutating dialog is reused verbatim from Phase 5, not rebuilt

`AdminRoleChangeDialog`, `AdminFlagUserDialog`, and `AdminConfirmDialog` (Suspend/Ban/Restore/Remove Flag) all already take `{ user: AdminUserRow, isBusy, error, onConfirm, onCancel }` — none of them assume they're rendered from a table row. The detail page's Administrative Actions section opens the identical five dialogs Phase 5 already ships, wired to the identical `useAdminUsers()` mutations. Zero new dialog components.

### Username stays read-only here, same as Phase 5

No profile editor exists anywhere in the app. This page displays `username`/`identityLineFor()` exactly as Phase 5's table does; it does not add an inline editor. This is what the brief's own "do not make [username] casually editable … unless there is a strong administrative reason" resolves to today: there is no reason, because there is no editor to protect against misuse of.

### Internal Notes: Recommended Later, not built

A real, isolated feature (`user_notes` table + a small add/list UI) with no current moderation demand driving it. The brief asks to *evaluate*, not to ship — YAGNI applies. Schema is recorded in the database section for when a real need shows up.

### Admin self-protection: identical mechanism, single-row scoped

Same three guards Phase 5 already enforces both client-side (`rowActionItems` in `AdminUsersTable.tsx`: no Change Role/Suspend/Ban on self or the last remaining admin) and server-side (`admin_set_user_role`/`admin_set_user_status` raise on self-targeting or last-active-admin). The detail page's Administrative Actions section computes the identical predicate (`user.user_id === currentUserId`, `user.role === "admin" && adminCount <= 1`) against the same `useAdminUsers()` data and hides/shows the same actions. No new logic, no new guard.

## Approach

### 1. UX rationale

The brief's five-second checklist (who / registered-or-guest / role / status / contributions / moderation concerns / organizer requests / available actions) is answered by putting everything **load-bearing** above the fold in a single-column-on-mobile, two-column-on-desktop layout, and pushing everything **investigative** (full event history, full audit timeline) behind "View all" links rather than inlining it. The header alone answers 1–4; a compact "Activity Summary" strip answers 5; a "Moderation" card that is either one green line or a loud warning answers 6; Organizer/Contributions context answers 7 when relevant; a single "Administrative Actions" section (not scattered buttons) answers 8. Organizer Requests is answered by its absence being explained, not by a fabricated empty state.

### 2. Recommended page hierarchy

Vertical sections, not tabs. Phase 5 established tabs for *switching between many rows* (the directory's 8 preset views); this page is *one row, many facts about it* — tabs would hide exactly the moderation/status information the brief says must "remain visible without requiring the administrator to open several tabs" (§3). Order, top to bottom: Identity Header → Account Overview + Activity Summary (side-by-side on desktop, stacked on mobile) → Moderation (only when there's something to say, else one quiet line) → Events & Contributions → Organizer context (only when `role === "organizer"`) → Activity/Audit Timeline → Administrative Actions (with Danger Zone visually separated at the bottom). This is the brief's own §32/§33 order, and it matches Phase 5's page-composition order (header → status → detail sections → actions) for the same "feels like one product" reason Phase 5 cited for reusing `AdminViewTabs`.

### 3. Identity header design

`AdminUserDetailHeader` component. Left-to-right: Back-to-Users link (`← Users`, `to="/admin/users"`, preserving no query state — this is a fresh navigation, not "restore my filters," matching how Phase 3/5 event-edit links behave), then avatar/initials/guest-icon (identical `UserAvatar` logic already in `AdminUsersTable.tsx`, extracted so both share it — see §4 anchor), name + identity line (`displayNameFor`/`identityLineFor`, unchanged), `AdminRoleBadge` + `AdminAccountStatusBadge` side by side, a `Joined {date}` line (or `First activity {date}` for guests, matching `identityLineFor`'s registered/guest split), and a `•••` `AdminActionMenu` on the right using the **exact same `rowActionItems`** function Phase 5's table already exports-shape (moved to `usersQuery.ts` or kept in `AdminUsersTable.tsx` and imported — see §16 anchor) so the header menu and the row menu are provably the same contract, not two hand-maintained matrices.

### 4. Registered-user presentation

Identical vocabulary to Phase 5's table: `displayNameFor` for the name, `@username` or "No username set" via `identityLineFor`, avatar image or initials circle. New on this page only: the email row (§6) and the `Email Verified` chip (`Verified` / `Unverified`, from the new `email_confirmed_at` column — a plain badge, not a blocking state; an unverified email is informational, not a restriction).

### 5. Magic-link identity presentation

`Guest Submitter` (or their `submitter_name` when present, matching `displayNameFor`'s guest branch), `No public profile` via `identityLineFor`, the dashed-circle `UserRound` avatar fallback (same as the table). No role badge at all (guests have `role === null`; `AdminRoleBadge` already renders nothing loud for that — reused, not special-cased again). "First activity {date}" uses `created_at` from the directory row (already `min(event.created_at)` for guests, per `admin_user_directory()`'s `guest_stats` CTE) rather than "Joined," since a guest never joined anything.

### 6. Account overview UX

Two-column card (`ACCOUNT`) for registered users: Display Name, Username, Email + Email Verified chip, Account Type ("Registered User"), Role, Status. For guests: Username row reads `—`; a `Public Profile: None` row replaces the username/avatar rows; Account Type reads "Magic-Link Submitter." No "Missing Username" / "Incomplete User" language anywhere — `identityLineFor`'s "No username set" already establishes this tone in Phase 5 and carries over unchanged.

### 7. Role/status presentation

`AdminRoleBadge` and `AdminAccountStatusBadge`, reused at a larger size (both already accept the same props; no new component). When status is `suspended` or `banned`, the Status card expands in place to show `Reason` (`status_reason`), `Since` and `Actioned by` (resolved from `audit_logs` per the decision above) directly under the badge — this satisfies the brief's "should not have to search an audit log to understand why" by doing that lookup *for* the admin, once, on page load, rather than making them read the timeline.

### 8. Activity summary

For a registered non-organizer: `contributions` and `pending_count` from the directory row, split further only where the data actually supports it — `applyFilters` scoped to this user already returns each event's `status`, so "Published" / "Pending" / "Rejected" counts are a client-side `reduce` over the same list §9 fetches, not new fields. For an Organizer: same counts, reframed as "Events Managed" per the brief's language. For a guest: `contributions` (their submission count) and `pending_count`, matching the "1 contribution · 1 pending" phrasing Phase 5 already established for the table — same copy, same source field, larger type here. **RSVPs is omitted** — see Data reality.

### 9. Events & contributions experience

A compact list (5 most recent, newest first) built from `applyFilters(events, { ...defaultFilters, submitter: user.user_id ?? user.email })` against the same `useAdminEvents()` query the Events screen uses (shared TanStack Query cache key `["events", "all"]" — if the admin already visited`/admin/events` this session, this section renders with zero additional network cost). Each row: title (links to `/admin/events?edit=<id>`, matching the existing edit deep link), submitted date,`AdminStatusBadge` (the *event* status badge, already built, distinct from the *account* status badge above it — reusing rather than inventing a third badge vocabulary). Footer: `View all in Events →` to `/admin/events?submitter=<value>` — the identical link Phase 5's row action already produces, so "View Contributions" from the table and this section's footer land on the same filtered view.

`Submitted By` vs `Organized / Managed By` distinction (brief): not separately worth a UI split given the current data — `source_type` describes the write site, not a management relationship (this is Phase 5's own documented reasoning for keeping Contributions a single number, and it applies identically here). This section shows every event where this person is `submitter_id`/`submitter_email`, full stop.

### 10. Organizer-context UX

Rendered only when `role === "organizer"`. Card `ORGANIZER`: brand (`display_name`), `@username`, upcoming-event count (a client-side filter of the §9 list by `event_date >= today`), `View Organizer Profile` (no-op today — there is no separate organizer-profile page; **omit this button** rather than link to nothing) and `View Events` (the same `/admin/events?submitter=` deep link as §9's footer — not a second, different query).

### 11. Organizer request handling

**Not built.** No `organizer_requests` table exists (Data reality). This section of the page is absent entirely for now, not rendered as an empty state — there is nothing to be empty about, and inventing a placeholder here would misrepresent a feature that doesn't exist as one that's merely quiet. §21/§26 record this as Recommended Later.

### 12. Moderation summary

Compact card, two states only: **quiet** — `status === "active"` and no unresolved flag, renders `No moderation concerns.` (matching the brief's requested compact clean state, one line, no icon-heavy treatment). **loud** — anything else, renders the current `AdminAccountStatusBadge` plus, when `status === "flagged"`, the flag reason (`status_reason`) and date (resolved the same way as §7's Suspended/Banned block, from the latest `audit_logs` `user.flagged` row). There is no separate "Open Flags count" — Phase 5's data model has exactly one current status per account, not a list of concurrent open flags, so "1 Open Flag" (brief) is really "this account's current status is Flagged," already covered by the badge.

### 13. Flagging UX

Identical dialog to Phase 5 (`AdminFlagUserDialog`) opened from this page's Administrative Actions, same reason taxonomy (`Spam`, `Suspicious organizer activity`, `Repeated inaccurate submissions`, `Harassment`, `Other`), same required-notes-when-Other rule. Brief §15 adds `Impersonation` to the taxonomy — **not adopted**: Phase 5's five reasons are the shipped, tested contract (`AdminFlagUserDialog.test`-covered behavior would need to change, and the dialog itself is shared code between the table and this page); adding a sixth value here would silently diverge the two entry points. If `Impersonation` is wanted, it's a one-line change to the shared `REASONS` array in `AdminFlagUserDialog.tsx` and should land as its own small change, not bundled into this design.

### 14. Suspension UX

Identical to Phase 5's `AdminConfirmDialog` Suspend copy (`Suspend @username?`, "temporarily lose access…", optional reason, danger tone, `Suspend User`). Brief §16 proposes a Duration radio (`Until manually restored` / `Until date`) — **not adopted**, for the same reason Phase 5 rejected it: `admin_set_user_status()` takes no expiry, and the brief itself says to recommend "Until manually restored" for MVP when timed suspensions add complexity, which is exactly Phase 5's existing, shipped behavior. No new UI for a capability the backend doesn't have.

### 15. Ban/restore UX

Identical to Phase 5's `AdminConfirmDialog` Ban (required reason, danger, "will lose access… existing content will not automatically be deleted") and Restore ("Access is restored immediately," neutral tone). No content-deletion option is added here either, for the same reason Phase 5 gave: account access and content removal are separate decisions, and content removal belongs to the Events screen.

### 16. Role-change UX

Identical `AdminRoleChangeDialog`: current role, new-role select, per-role consequence copy, disabled Confirm while unchanged/busy. Reused verbatim from the Administrative Actions section and (via the `•••` header menu) from §3. The action-availability matrix (`rowActionItems`) that decides *whether* Change Role appears at all is the same function Phase 5's table already computes per row — this page calls it with the single `user` it has, rather than mapping over many rows.

### 17. Moderator assignment/removal

Brief §20 asks for a dedicated "Make @username a Moderator?" dialog with a bulleted permissions list. **Not a new dialog** — this is exactly what `AdminRoleChangeDialog`'s `moderator` consequence copy already is ("Moderators can review, edit, approve, and reject user-submitted events. They cannot approve Organizer requests"), and Phase 5's own design doc made this same call explicitly: "Moderator assignment needs no separate dialog: it is this dialog with the spec's moderator sentence." Demotion (brief §22, "Remove Moderator role?") is the same dialog with `New Role = User` selected — also not a new dialog, since the consequence copy for `user` ("Removes elevated access…") already covers it.

### 18. Organizer promotion/demotion

Promotion: same `AdminRoleChangeDialog`, `organizer` consequence copy already states "a direct role change, not the approval of a submitted request" — this is the brief's requested "Directly Promote" vs "Approve Request" distinction, made in copy rather than as two separate buttons, because there is no request to approve (Data reality). Demotion: same dialog, `New Role = User`. Brief §22 also asks to "clarify what happens to their existing events" on demotion — existing events are untouched (no cascading unpublish/delete anywhere in the schema or the write functions), and the `user` consequence copy already says "They can still submit events for review," which is the honest answer for what remains true after demotion.

### 19. Admin self-protection

Computed identically to Phase 5's table (`user.user_id === currentUserId`, `adminCount <= 1`), applied to both the header `•••` menu and the Administrative Actions section: when either guard is true, only `View Contributions`-equivalent items remain, and if this is the only admin, a banner reading exactly the brief's requested copy — `You are the only administrator. Add another Admin before removing your Admin role.` — renders above Administrative Actions instead of the action list. The three enforced minimums (no self-ban, no self-suspend, no removing the last admin) are already server-enforced in `admin_set_user_role`/`admin_set_user_status` (Phase 5); this page's client-side guard is the same defense-in-depth layer Phase 5's table already provides, not a new backend rule.

### 20. Activity/audit timeline

`fetchUserAuditLog(entityId)` (new repo function, no new SQL) rendered newest-first, each row: a human label derived from `action` (`user.role_changed` → "Role changed to {to_role}", `user.suspended` → "Account suspended", etc. — a small `Record<string,(metadata)=>string>` map, mirroring how `identityLineFor`/`displayNameFor` centralize copy elsewhere), the actor resolved to `@username`/display name via the already-loaded `users` list (falling back to "System" only if `actor_id` is null, which none of the current write paths produce), and the date. Also includes the one `event.created`-style entry Phase 5's `handle_new_user()` trigger doesn't itself log to `audit_logs` — so "Account created" is **not** sourced from the timeline; it's the `created_at` already shown in the header/overview, not fabricated as a synthetic first timeline entry. Capped at 50 rows with no pagination for now — a moderation history exceeding 50 entries is a real-future problem, not a Phase 6 one.

### 21. Internal notes recommendation

Recommended Later (Data reality / Decisions). If built: `user_notes(id, user_id, author_id, note, created_at, updated_at)`, admin/moderator-only via the same RLS pattern as `audit_logs`, rendered as its own small card below Moderation, explicitly separate from the enforcement timeline (brief §26's own instruction: "Do not combine informal notes with formal enforcement actions").

### 22. Magic-link-to-profile transition UX

No auth flow exists to transition a guest to a registered account (Data reality — same finding as Phase 5). This section is a **documentation note only**: when magic-link auth ships, `admin_user_directory()`'s existing `not exists (select 1 from auth.users u2 where lower(u2.email) = g.email)` clause already guarantees a guest who registers under the same email stops appearing as a guest and appears once, as their registered self, with their prior events already attributed via `submitter_email` matching — no manual "merge" step for the admin to perform. No UI is added in Phase 6 because there is nothing for it to trigger yet.

### 23. Empty/loading/error states

Independent skeletons per section (Account Overview, Activity Summary, Events & Contributions, Moderation, Activity Timeline), matching the brief's "localized skeletons, not one big spinner" — practical because each section's data has a distinct source: the header/overview/status/activity-summary come from the already-cached `useAdminUsers()` result (near-instant if the admin arrived via a `/admin/users` row link, since the list is already in cache; a real loading state only if this page is opened directly via URL before that query has ever run), Events & Contributions from `useAdminEvents()` (same caching story), and the Activity Timeline from the new, page-local `fetchUserAuditLog` query (always a fresh network call, always shows its own skeleton). Per-section error: a `role="alert"` line + `Try Again` scoped to that section only (`We couldn't load account activity. [ Try Again ]`), never taking down the rest of the page — this is the same principle as Phase 5's page-level error banner, applied per-section here because there are now multiple independent data sources instead of one. If the core identity itself can't be resolved (`id` not found in the directory after it has loaded — deleted account, bad link, or a `guest:` id whose events were reassigned), the page renders `User not found` with a link back to `Users`, matching `AdminEventsPage`'s existing "falls back to the list, without error, when a reference is unknown" precedent (Phase 3/5 test: `?edit references an unknown id`).

### 24. Desktop/tablet/mobile behavior

Desktop (≥1024px, matching Phase 5's table breakpoint): two-column body (Account Overview + Activity Summary side by side, per the brief's wireframe), everything else full-width below. Tablet/mobile: single column, sections stack in the §2 order — the brief's explicit instruction not to compress the desktop layout means "reflow to one column," not "hide fields," so nothing is dropped, only reordered vertically. Administrative Actions collapses its buttons into the `•••` header menu on narrow viewports rather than rendering large adjacent Suspend/Ban buttons (brief §33) — the same `AdminActionMenu` component already used everywhere else in the admin shell, not a new mobile-only menu.

### 25. Accessibility recommendations

All carried over from Phase 5, applied to a single-record page instead of a table: role/status are never color-only (both badges already encode icon + shape + text, unchanged). The header `•••` menu, dialogs, and focus-restore-on-close behavior are the exact same `AdminActionMenu`/dialog components already keyboard-tested in Phase 5 — no new interaction pattern to re-validate. The Activity Timeline is a `<ol>` of `<li>` entries with a visible date and a full-sentence action label (not an icon-only row), so it reads correctly linearly to a screen reader. The Status card's "Since"/"Actioned by" resolution is plain text, not a tooltip-only disclosure, so it's available without hover. Section loading states use `aria-busy` + a `role="status"` line per section (§23), so "loading" is announced per-section rather than once globally muting the rest of the page.

### 26. Recommended database adjustments

**Recommended Now** (needed for this design as specified above): `admin_user_directory()` gains `email_confirmed_at boolean` (one additive column). Nothing else — `fetchUserAuditLog` and the reused submitter filter both work against grants/columns that already exist.

**Recommended Later:**

- `organizer_requests` table + submission/approval flow — makes brief §11/§12/§21's "pending request" language and "Approve Request" action real instead of deferred; unlocks the Organizer-context section's "View Organizer Profile" once there's a profile to view.
- RSVP/attendance tracking — a real new feature (who RSVP'd to what), not a User Detail concern; needed before brief §11 can show anything true.
- `user_notes(id, user_id, author_id, note, created_at, updated_at)` — for Internal Notes (§21), gated on an actual moderation need arising, admin/moderator-only via the same RLS shape as `audit_logs`.
- Reserved-username list (`admin`, `moderator`, `support`, `salsasegura`, `official`, …) as a CHECK constraint or lookup table on `profiles.username` — cheap to add whenever a username editor ships; has zero effect today since no editor exists and `username` is still null for every account (Phase 5 finding, still true).
- `suspended_until` for timed suspensions (carried over from Phase 5's own Later list) — would also enable brief §16's Duration radio honestly, if ever wanted.

**Unnecessary:**

- `user_moderation_actions` table — `audit_logs` already stores this and is now proven directly client-readable (Decisions, above); a second table would only add drift risk.
- `suspended_at/by`, `suspension_reason`, `banned_at/by`, `ban_reason` columns — `status_reason` + the latest matching `audit_logs` row already supply everything the brief's "Reason / Since / Actioned by" block needs, resolved client-side, with zero extra columns.
- A stored "duplicate identity" flag or fuzzy-matching infrastructure (brief §28) — no detection mechanism exists to populate it, and `admin_user_directory()`'s `not exists` clause already prevents the one duplicate case the current data model can produce (a guest who later registers under the same email).
- A dedicated `admin_user_detail(id)` RPC — see Decisions; the existing cached directory query already serves this page.

### 27. Final wireframe

```text
┌───────────────────────────────────────────────────────────────┐
│ ← Users                                                        │
│                                                                 │
│ [Avatar] Roosevelt Segura                        Admin · Active│
│          @rooseveltsegura                                  ••• │
│          Joined Aug 4, 2026                                    │
├───────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐  ┌───────────────────────────┐  │
│ │ ACCOUNT                    │  │ ACTIVITY SUMMARY           │  │
│ │                             │  │                             │  │
│ │ Email          r@ex…  ✓Verified │  Contributions        12   │  │
│ │ Username       @rooseveltsegura │  Pending                2   │  │
│ │ Account Type   Registered User  │                             │  │
│ │ Role           Admin       │  │                             │  │
│ │ Status         Active      │  │                             │  │
│ └───────────────────────────┘  └───────────────────────────┘  │
│                                                                 │
│ MODERATION                                                     │
│ No moderation concerns.                                        │
│                                                                 │
│ EVENTS & CONTRIBUTIONS                                         │
│ ──────────────────────────────────────────────────────────────│
│ Salsa Monday            Aug 9        Published                 │
│ Bachata Night           Aug 10       Pending Approval           │
│                                            View all in Events → │
│                                                                 │
│ ACTIVITY                                                        │
│ Aug 11   Event approved by @rooseveltsegura                    │
│ Aug 9    Event submitted                                       │
│                                                                 │
│ ADMINISTRATIVE ACTIONS                                          │
│ You are the only administrator.                                 │
│ Add another Admin before removing your Admin role.              │
│ [ View Contributions ]                                          │
└───────────────────────────────────────────────────────────────┘
```

Non-admin example (Suspended, showing the Danger Zone split):

```text
┌───────────────────────────────────────────────────────────────┐
│ ← Users                                                        │
│                                                                 │
│ [Avatar] Maria Santos                       Organizer · Suspended│
│          @mariasalsa                                       ••• │
│          Joined Jul 2, 2026                                    │
├───────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐  ┌───────────────────────────┐  │
│ │ ACCOUNT                    │  │ ACTIVITY SUMMARY           │  │
│ │ Email      m@ex… Unverified│  │ Contributions           3   │  │
│ │ Username   @mariasalsa     │  │ Pending                 0   │  │
│ │ Role       Organizer       │  │                             │  │
│ │ Status     Suspended       │  │                             │  │
│ │  Reason     Repeated inaccurate submissions │               │  │
│ │  Since      Aug 10, 2026   │  │                             │  │
│ │  Actioned by @admin        │  │                             │  │
│ └───────────────────────────┘  └───────────────────────────┘  │
│                                                                 │
│ ORGANIZER                                                       │
│ Havana Club Boston · 3 upcoming events        View Events →    │
│                                                                 │
│ EVENTS & CONTRIBUTIONS                                          │
│ ──────────────────────────────────────────────────────────────│
│ Havana Nights                Jul 20      Published              │
│ Salsa Under the Stars        Aug 1       Published              │
│                                            View all in Events → │
│                                                                 │
│ ACTIVITY                                                        │
│ Aug 10   Account suspended by @admin — Repeated inaccurate submissions │
│ Jul 15   Role changed to Organizer by @admin                    │
│                                                                 │
│ ADMINISTRATIVE ACTIONS                                          │
│ [ View Contributions ] [ Change Role ]                          │
│                                                                 │
│ DANGER ZONE                                                     │
│ [ Restore Access ] [ Ban User ]                                 │
└───────────────────────────────────────────────────────────────┘
```

## Critical files & anchors for implementation (when approved)

| File | Anchor | Why |
| --- | --- | --- |
| `src/components/Admin/AdminUsersTable.tsx` | `UserAvatar` (172-194), `rowActionItems` (64-139) | Both need extracting so the header (§3) and the row menu share one implementation, not two |
| `src/features/admin/model/usersQuery.ts` | `displayNameFor`/`identityLineFor`/`initialsFor` | Already the single source of identity vocabulary; this page adds nothing new here |
| `src/features/admin/model/eventsQuery.ts` | `applyFilters`'s `submitter` check | Reused verbatim for §9's inline list |
| `src/components/Admin/AdminRoleChangeDialog.tsx`, `AdminFlagUserDialog.tsx`, `AdminConfirmDialog.tsx` | full files | Reused verbatim, zero changes, from both the header menu and Administrative Actions |
| `supabase/migrations/20260813000100_audit_logs.sql` | grant + `"Admins read audit log"` policy | Already permits the one new client read this phase needs |
| `src/hooks/useAdminUsers.ts` | `useQuery({ queryKey: ["admin","users"] })` | The cache this page reads from instead of fetching its own copy |

**Do not move into Phase 7. This document is Phase 6 only, awaiting approval before any implementation plan or code.**

---
target: operator desk (PlatformAdminOverview/ModeratorOverview/HostDashboard)
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/home/r8s/code/Salsa/src/components/Admin/PlatformAdminOverview.tsx"
target_fingerprint: "sha256:af1ea8a678895ea8cee6238f12c1c9d104662ed9fd418d608ec5b18c3131cb79"
target_path: /home/r8s/code/Salsa/src/components/Admin/PlatformAdminOverview.tsx
timestamp: 2026-09-24T04-25-53Z
slug: src-components-admin-platformadminoverview-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Host dashboard shimmers forever; moderator week shows a false "couldn't load the week" while events fetch 200. |
| 2 | Match System / Real World | 3 | Desk metaphor holds; "Galley" still lacks a persistent definition. |
| 3 | User Control and Freedom | 3 | No keyboard undo; in-place open/close and reject dialog cancel cleanly. |
| 4 | Consistency and Standards | 2 | Column titles take the brand-rose link colour (same hex as `tonight`); stack breakpoint 1023.98px vs DESIGN.md 1080px. |
| 5 | Error Prevention | 3 | Reject gated by reason dialog; approve waits for server before leaving. |
| 6 | Recognition Rather Than Recall | 2 | No legend for the five mark shapes; city never shown. |
| 7 | Flexibility and Efficiency | 1 | No shortcuts, no skip link, 19 Tab presses to the first decision. |
| 8 | Aesthetic and Minimalist Design | 3 | No-cards discipline holds; colour bleed muddies the state palette. |
| 9 | Error Recovery | 1 | Moderator "Try again" retries events while the error comes from users; host has no error or retry. |
| 10 | Help and Documentation | 0 | No mark legend, no inline vocabulary. |
| **Total** | | **19/40** | **Poor** |

## Design Specificity Verdict

Authored, not category-interchangeable. The listings-desk metaphor is real in code and on screen: agate rows, SVG proof marks in the margin, seven fixed divisions (empty days render "Nothing set."), set-in-place decisions with no route change or toast. One `OperatorDesk` serves admin and moderator. The design is not the problem; the build is. Three roles, and two (moderator, host) break in ways the admin seat never shows.

Deterministic scan: CLI `impeccable detect` returned 0 findings (exit 0) across the three dashboards, `src/components/Desk/`, and `AdminLayout.tsx`. In-browser overlay returned 7 across 4 views: text-occlusion x4 (sidebar chrome under `a.desk__count`, likely false positive relative to the desk), heading-rhythm x2 on `/host` (real), line-length x1 on `.host-desk__note` (~95ch, real). Neither scanner caught the P0s.

## Overall Impression

Strong concept, working admin path. The moderator and host paths fail on plumbing the design cannot absorb: a permission-gated RPC and a disabled query that reports itself as pending forever. Biggest opportunity: treat all three roles as the test matrix.

## What's Working

- Set in place is real: approve animates out, arrives in the right division, count pulses, no route/toast; "Galley is clear" is a good close.
- Keyboard and touch floor: 2px `:focus-visible` everywhere tested; 44px controls on coarse pointers and small viewports.
- Mobile stack at 390x844: sticky rule with safe-area padding, stacked measures, full-width thumb-zone actions.

## Priority Issues

- **[P0] Host dashboard never finishes loading for hosts with no organizer membership**
  - Why: `useMyOrganizerEvents` sets `enabled: organizerIds.length > 0` but returns `isLoading: organizersLoading || query.isPending` (`src/features/host/hooks/useMyOrganizerEvents.ts:17,22`); a disabled TanStack v5 query stays pending, so "Your entries" and "Set for the week" shimmer forever with no error or retry.
  - Fix: `organizersLoading || (organizerIds.length > 0 && query.isPending)`.
  - Command: `$impeccable harden`

- **[P0] Solid danger/brand buttons invisible in light theme**
  - Why: `--admin-danger-solid`, `--admin-danger-solid-hover`, `--admin-brand-solid-hover` exist only under `.admin-shell[data-theme="dark"]` (`src/styles/admin.css:122-124`). Light theme: reject-confirm (`admin-btn--danger`, `AdminRejectSubmissionDialog.tsx:132`) renders transparent with white text (~1:1); primary hover blanks; banned badge (`admin.css:892`) vanishes.
  - Fix: define light values for all three in the base `.admin-shell` block, verified >=4.5:1 vs white.
  - Command: `$impeccable harden`

- **[P1] Moderator week shows a permanent, unrecoverable error**
  - Why: `ModeratorOverviewWrapper` calls `useAdminUsers()` (`src/pages/Admin/AdminOverviewPage.tsx:24`); `admin_user_directory` raises `admin role required` for moderators (guard at `supabase/reconcile-prod-schema.sql:997`, so prod too); `error ?? usersError` routes it into the week slot (`OperatorDesk.tsx:238-239`); retry refetches events only. Galley still works.
  - Fix: drop `useAdminUsers()` from the moderator wrapper, omit the flagged count from the moderator rule, pass only the events error.
  - Command: `$impeccable harden`

- **[P1] Column titles take the `tonight` hue on every row, breaking the State-Only Rule**
  - Why: unclassed column `<Link>` loses to `.admin-shell a:not([class])` (0,2,1, `admin.css:529`) over `.desk__entry-title a { color: inherit }` (0,1,1, `desk.css:298`).
  - Fix: class the link (e.g. `desk__entry-link`) or scope the desk rule as `.desk .desk__entry-title a`.
  - Command: `$impeccable polish`

- **[P2] City never shown on the desk**
  - Why: `eventToListing` / `toHostListing` read only `event.location`; NYC "Mambo Friday Late" sat unmarked beside a Boston social. PRODUCT.md requires explicit city scope.
  - Fix: short city tag in the meta line, in body ink, not a state colour.
  - Command: `$impeccable clarify`

- **[P2] Reject reasons expose raw enum values** (late, independently corroborated second review)
  - Why: `AdminRejectSubmissionDialog.tsx:15-24,90-92` renders `{r}`, so the moderator reads `missing_information`, `cannot_verify`, `out_of_scope` at the decide moment.
  - Fix: map each value to a human label.
  - Command: `$impeccable clarify`

## Persona Red Flags

- Alex (power user): no shortcuts; 19 Tabs to first decision; no skip link; one-row-at-a-time decisions; account `<details>` does not close on outside click.
- Sam (a11y): marks correctly labelled and focus visible, but light-theme reject-confirm is reachable and invisible; no on-screen legend for the five shapes.
- Evening dancer-moderator: hits the permanent week error on every load and the invisible reject-confirm in light theme; reads as a broken tool even though the galley works.

## Minor Observations

- Missing-field flags render in `--desk-unset` amber on set/tonight rows, borrowing a state colour.
- Stack breakpoint `1023.98px` (`desk.css:678`) vs DESIGN.md 1080px; 1024-1079px squeezes two columns.
- Opened flyerless galley entry renders an empty `<span>` where the row thumb shows `ImageOff`.
- Host with zero memberships gets an empty sidebar nav.
- `/host` heading rhythm and 95ch note.
- Long titles wrap cleanly.

## Questions to Consider

- Every P0/P1 appears only outside the admin seat. Should all three roles be a required fixture for desk changes?
- The State-Only Rule is already broken and enforced only by prose. Lint rule or visual-regression golden on the five tokens?
- "No toast" works only if failure is loud. Is it, given the host's endless shimmer?

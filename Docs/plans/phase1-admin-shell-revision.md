# Phase 1 (Revision) — Admin Shell, Navigation & Theme System

## Context

The admin shell was never built from a Phase 1 spec — it grew organically across Phases 2–6 (Overview, Events, Users, User Detail) and is already solid in the places those phases needed: a scoped `.admin-shell` design system (buttons, cards, fields, status/role badges, skeletons, pagination), a responsive sidebar (drawer <768px → icon rail 768–1023px → full sidebar ≥1024px), a working breadcrumb, and an account-menu disclosure. What it never got, because no phase asked for it, is everything this brief formalizes: a theme system (light/dark/system), sidebar collapse as a user action (not just a breakpoint), an Appearance menu, and a semantic token vocabulary. This document is the requested "revise Phase 1 and do what is missing" pass — it audits the real shell against the brief section by section, then designs only the gaps.

## Audit — what exists today, verified this session

- **Tokens exist but aren't semantic or theme-aware.** `src/styles/admin.css:7-42` defines `--admin-bg`, `--admin-surface`, `--admin-surface-subtle`, `--admin-surface-high`, `--admin-border`, `--admin-text`, `--admin-text-strong`, `--admin-text-muted`, `--admin-text-subtle`, `--admin-primary(-hover/-tint/-ring)`, `--admin-danger(-tint)`, `--admin-attention-(tint/ink/dot)`, `--admin-positive-(tint/ink)` — a real token layer, but named ad hoc (`--admin-bg` not `--admin-background`) and defined once, with no dark variant and no `prefers-color-scheme`/`data-theme` anywhere in the codebase (confirmed: zero matches for `theme`, `dark-mode`, `prefers-color-scheme`, `data-theme` across `src/styles`, `src/layouts`, `src/components/Admin`, `src/contexts`).
- **The token discipline is inconsistent.** Buttons, cards, fields, and the sidebar correctly consume `var(--admin-*)` throughout. But badges do not: `admin.css:433-467` (`AdminStatusBadge`), plus the Phase 5 role/account-status badges and several dialogs, hardcode hex directly (`#ecfdf5`, `#047857`, `#a7f3d0`, `#10b981`, `#fde68a`, `#fef2f2`, `#b91c1c`, `#fecaca`, plus `#4338ca`/`#c7d2fe`/`#eef2ff` for the moderator role badge and `#fecdd3`/`#fecaca` for the admin/danger ones). This is the real cost center of a dark-mode retrofit — not the shell chrome (already tokenized), but ~15 component `.css` files carrying their own literal colors.
- **No sidebar collapse.** `AdminSidebar.css`/`AdminLayout.css` only implement the three responsive breakpoints already listed above. There is no collapse *toggle*, no collapsed-icon-rail-with-tooltips state a user can invoke at will, and no persistence of any such preference.
- **No Appearance menu.** `AdminLayout.tsx:57-68`'s account `<details>` menu (`AdminLayout.css:119-191`) has exactly two items today: "View site" and "Sign out" — no Appearance submenu, no theme control anywhere.
- **Breadcrumb is minimal but present and correct.** `AdminLayout.tsx`'s `sectionLabelFor` (added in Phase 6) already implements "no breadcrumb noise on top-level pages, resolve nested routes to their section" — it just needs new entries as new sections (Submissions, Organizer Requests, Venues, Tags, Settings) land.
- **Page header pattern already exists and is exactly the shape the brief asks for.** `AdminPageHeader.tsx` — title, description, optional actions slot — used identically by Overview, Events, Users. Nothing to change here structurally.
- **Attention badges exist in spirit, not in the sidebar.** `AdminNeedsAttention.tsx`/`AdminOverviewPage.tsx` already compute "items requiring action" (pending count, incomplete count) for the Overview page's attention list — the brief's sidebar attention counts (`Event Submissions 3`) are the same computation, surfaced in a new place (`AdminSidebar.tsx`'s nav items), not a new computation.
- **`/admin/submissions` doesn't exist yet** (Phase 7, not yet built) — the "Events vs Event Submissions" navigation distinction (§4/§6) is specified here but only becomes visible once that route exists; this phase adds the nav *slot* and *rules*, not the page.

## Decisions — settled

### Token rename is additive, not destructive

Rename the existing `--admin-*` tokens to the brief's semantic names (`--admin-background`, `--admin-surface`, `--admin-surface-elevated`, `--admin-surface-secondary`, `--admin-text-primary`, `--admin-text-secondary`, `--admin-text-muted`, `--admin-border`, `--admin-divider`, `--admin-brand`, `--admin-brand-hover`, `--admin-success`, `--admin-warning`, `--admin-danger`, `--admin-information`) defined once per theme (`.admin-shell` for light values, `.admin-shell[data-theme="dark"]` overriding the same custom-property names). Every existing consumer (`var(--admin-text)` etc.) gets updated to the new name in the same pass — a mechanical rename across ~15 files, not a redesign of any component's structure. Rejected: keeping both old and new names as aliases — that's exactly the kind of permanent shim this project's conventions forbid (clean cutover, no dual naming).

### Dark mode ships with real values, not an inverted light theme

Per the brief's explicit instruction ("do not create dark mode by simply inverting colors"), dark theme gets its own considered palette (deep charcoal background, elevated-charcoal surfaces, off-white text, SalsaSegura red unchanged as the one constant brand anchor across both themes) rather than a CSS `filter: invert()` or mechanically flipped lightness values. Every hardcoded badge/dialog color found in the audit gets a token (e.g., the moderator badge's `#4338ca`/`#c7d2fe`/`#eef2ff` becomes `--admin-moderator-ink`/`--admin-moderator-border`/`--admin-moderator-tint`, defined once per theme) rather than staying literal.

### Theme state: React context + `localStorage`, no new table

A `ThemeContext` (mirrors the existing `CityContext` pattern already in this codebase: `src/contexts/CityContext.tsx` → `useCity()`) holds `theme: "light" | "dark" | "system"`, resolves the effective theme via `window.matchMedia("(prefers-color-scheme: dark)")` when `system`, and writes `data-theme="light"|"dark"` onto `.admin-shell`'s root element. Persisted to `localStorage` under a single key (`admin-theme`), read synchronously before first paint (an inline script or a `useLayoutEffect` that runs before the shell's first meaningful render) to prevent a flash of the wrong theme. Rejected: a `user_preferences` table now — this is a device-level UI preference with zero cross-device value at one-admin scale, exactly the brief's own reasoning for deferring it.

### Sidebar collapse is a fourth, user-controlled width state — persisted the same way

Today's sidebar already has two automatic states (rail/full) gated by viewport width. This adds a third, explicit state — user-collapsed — available only at ≥1024px (where the full sidebar would otherwise show), toggled by the "◀ Collapse" control at the sidebar's foot, persisted to `localStorage` (`admin-sidebar-collapsed`) alongside the theme key. Collapsed renders the same icon-rail visual the ≥768px breakpoint already has (reusing that CSS, not inventing a fourth visual treatment), plus tooltips on each icon (the rail breakpoint today has no tooltips — this adds them, needed once collapse is a deliberate user action rather than a screen-size fact they can't easily undo).

## Approach

### 1. UX rationale

The shell exists to disappear — every phase after this one should be indistinguishable in chrome, differing only in page content. The two things this revision adds (theme, collapse) are the two things a single daily operator asks for from any tool they use for hours: control over glare/eye strain, and control over how much screen real estate the tool itself consumes. Everything else in the brief (navigation grouping, badges, breadcrumb rules, design-system foundations) is already correctly built; this phase's job is formalizing and closing the two real gaps, not rebuilding what works.

### 2. Recommended Admin shell architecture

Unchanged structurally: `AdminLayout.tsx` (shell frame: sidebar + topbar + main) wraps every `/admin/*` route via `RequireAdmin`. `AdminSidebar.tsx` (nav data + rendering, shared between the fixed and drawer variants) and `AdminPageHeader.tsx` (per-page title/description/actions) stay exactly as they are. New: a `ThemeProvider` wraps the whole app (same tier as `CityProvider` in `src/app/providers.tsx`, not admin-scoped — the theme should be readable app-wide even though only the admin shell currently renders theme-aware chrome, so a future public-site dark mode isn't blocked by an admin-only context).

### 3. Navigation hierarchy

Keep the existing grouped structure (`AdminSidebar.tsx`'s `NAV_ITEMS` with `group` field), which already matches the brief's proposed grouping almost exactly. Rename groups to the brief's four-way split: `Overview` (Dashboard), `Management` (Events, Users), `Review` (Event Submissions, Organizer Requests), `Platform` (Venues, Tags), `System` (Settings) — five labeled groups, not the six the current code implies (`Overview`/`Management`/`Review`/`Platform`/`System` — actually already five; no change needed to the count, only to which items land in `Review` once Submissions/Organizer Requests exist). Group labels stay — the brief's own §2 question ("do labels improve scanability or add noise") resolves to **keep them**: five items in one flat list without grouping would read as an undifferentiated stack once Submissions and Organizer Requests are real, and the grouping is what lets "things I check daily" (Management) visually separate from "things future staff will use" (Review/Platform/System).

### 4. Sidebar specification

Reuse every current visual element (logo, nav icon+label pairs, active/hover/focus states, group headers, "Soon" pill for unbuilt items) verbatim. New: an attention-count `<span>` next to any nav item with `count > 0` (reusing the existing `.admin-nav__soon`-style pill mechanism, new modifier `.admin-nav__count`), and the collapse toggle at the sidebar's foot, visible only ≥1024px.

### 5. Sidebar collapse behavior

See Decisions. Collapsed state hides labels/group headers/counts' text (counts become a small dot, not a number, in collapsed rail — consistent with "preserve attention badges in a compact form" from §8) and shows a native `title` tooltip per icon link for the destination name. The toggle itself is a full-width footer row (`◀ Collapse` / `▶` when collapsed), not a floating button, matching the wireframe in §41.

### 6. Events vs Event Submissions navigation distinction

`Events` and `Event Submissions` are separate, adjacent nav items in the `Management`/`Review` split respectively (already how Phase 7's brief frames the two routes) — not a single item with a sub-view toggle. This is a navigation-level reinforcement of the Phase 7 architectural decision (submissions and events are different tables, different concerns) rather than a new decision made here. `Event Submissions` carries the attention count; `Events` never does (per §20, counts indicate work needing attention, and a canonical calendar of published events is not a queue).

### 7. Top-header specification

Unchanged layout (`AdminLayout.tsx:39-76`): burger (mobile) + breadcrumb on the left, account disclosure on the right. No notification bell (see §21). No separate theme control lives in the header — it moves into the account menu per §12's explicit instruction not to permanently consume header space with three theme buttons.

### 8. Account-menu design

Extend the existing `<details>`-based menu (`AdminLayout.tsx:64-68`) with the identity block and an `Appearance` row that opens a sub-panel, per the brief's exact copy:

```
Roosevelt Segura
@rooseveltsegura
Admin
─────────────────
Appearance          >
Account
─────────────────
Sign Out
```

`Account` is a new, currently-inert row (no `/admin/account` page exists) — render it as a disabled/greyed row with no link, exactly like the sidebar's existing "Soon" treatment, rather than linking to a page that doesn't exist (same principle Phase 5 applied to Organizer Requests). `Appearance` opens a second `<details>`-in-`<details>` or a small inline radio group showing System/Light/Dark with a checkmark on the active choice — no navigation, no route change, closes back to the main menu on selection per the brief's "should feel immediate" instruction for theme switches.

### 9. Page-header pattern

No change — `AdminPageHeader` already is this pattern (title, description, actions slot), used identically across every existing admin page. Recorded here only to confirm it satisfies the brief, not to redesign it.

### 10. Breadcrumb strategy

Keep exact-match-then-prefix-match (`sectionLabelFor`, added Phase 6) — top-level pages show no crumb trail beyond the current section name (matching §19's "unnecessary on `/admin/events`"), nested detail pages resolve to their parent section's label (already proven for `/admin/users/:id` → "Users"; the same one-line addition handles `/admin/submissions/:id` and any future nested route). No dedicated breadcrumb-trail component is needed — a two-token `Admin › {section}` string, as today, covers every case the brief lists.

### 11. Attention-badge behavior

Sourced from the same "needs review" counts `AdminOverviewPage.tsx` already derives (pending submissions, in the near future organizer requests) — not a new metrics pipeline. Zero renders no badge (not a "0"), matching §20's explicit rule against showing arbitrary totals.

### 12. Theme selector UX

Inside the account menu only (see §8) — System/Light/Dark, radio-style single selection, immediate application (no "Save" step), current choice marked with a checkmark per the brief's own mockup.

### 13. Light-theme specification

Current values are already correct and stay as the light theme's definition, just renamed to the new semantic tokens: background `#f8fafc`, surface `#ffffff`, surface-secondary `#f1f5f9`, text-primary `#0f172a`, text-secondary `#64748b`, border `#e2e8f0`, brand `#e11d48`. No visual change to light mode — this section documents what already ships today under new names.

### 14. Dark-theme specification

New palette, considered rather than inverted: background `#0f1115` (deep, not pure black per §16's explicit warning), surface `#171a20`, surface-elevated `#1e2229`, surface-secondary `#20242c`, text-primary `#f1f5f9` (off-white, not pure white), text-secondary `#94a3b8`, border `rgba(255,255,255,0.08)`, brand unchanged `#e11d48` (the one color that must read identically in both themes — it's the SalsaSegura anchor), brand-hover `#f43f5e` (lighter, not darker, since darkening an already-dark-mode red toward black would desaturate it against a dark background). Status/role badge tints get dark-mode-specific low-opacity backgrounds (e.g., success tint becomes `rgba(16,185,129,0.12)` with ink `#34d399`, not the light theme's solid pale-green `#ecfdf5`/`#047857` — solid pale fills read as light-mode "paper" against a dark background and lose the badge's containment).

### 15. System-theme behavior

`window.matchMedia("(prefers-color-scheme: dark)")`, subscribed via a `change` listener so an OS-level theme switch while the tab is open updates the shell live (per §12's "should update immediately"), not just on next load.

### 16. Theme persistence recommendation

`localStorage` key `admin-theme` (`"light" | "dark" | "system"`), read synchronously on shell mount before first paint to avoid a flash-of-wrong-theme. See Decisions for why not a database table.

### 17. Semantic color/token system

Full token list (light values; dark values per §14), all consumed via `var(--admin-*)`, none hardcoded in any component going forward:

```
--admin-background, --admin-surface, --admin-surface-elevated, --admin-surface-secondary
--admin-text-primary, --admin-text-secondary, --admin-text-muted
--admin-border, --admin-divider
--admin-brand, --admin-brand-hover, --admin-brand-tint, --admin-brand-ring
--admin-success, --admin-success-tint
--admin-warning, --admin-warning-tint
--admin-danger, --admin-danger-tint
--admin-information, --admin-information-tint
```

(Renamed 1:1 from the current `--admin-bg`/`--admin-surface`/`--admin-surface-subtle`/`--admin-surface-high`/`--admin-text`/`--admin-text-strong`/`--admin-text-muted`/`--admin-primary*`/`--admin-danger*`/`--admin-attention*`/`--admin-positive*` — every existing token has a direct new-name equivalent, so the rename is mechanical, not a re-architecture.)

### 18. Brand-vs-danger color strategy

`--admin-brand` (SalsaSegura red) drives primary CTAs and active-nav state only. `--admin-danger` is a **distinct** red (already is, today: `#dc2626` vs. brand's `#e11d48` — close but not identical, which the brief flags as exactly the risk to guard against). Widen that gap in the token definitions so the two reds are visibly, not just numerically, distinct (danger shifts toward orange-red `#dc2626`→kept, brand stays magenta-leaning `#e11d48`), and every destructive action additionally carries a distinct icon (trash/ban, already the pattern in `AdminActionMenu`'s `tone: "danger"` items) so color is never the only signal — this is already how Phase 5's Ban/Suspend actions work; this section just states it as a shell-wide rule going forward.

### 19. Typography recommendations

Existing `--font-display`/`--font-body`/`--font-ui` (global tokens, not admin-specific) already back every current admin heading/body/label. Formalize the scale used today rather than inventing a new one: Page Title (`AdminPageHeader h1`, 1.5rem/`--font-display`), Section Title (card `h2`, 0.75rem uppercase/`--font-ui`, the pattern already used across Phase 5/6 cards), Card Metric (`AdminMetricCard`'s large number, 2rem), Body (0.9rem/`--font-body`), Secondary Text (0.8rem, `--admin-text-secondary`), Label (0.85rem 600-weight, form field labels), Caption (0.75rem, timestamps/muted asides), Table Content (0.875rem, existing table row text size).

### 20. Spacing/density recommendations

No new spacing scale — audit confirms the existing shell already uses a consistent 4/8/12/16/20/24px rhythm throughout (visible in every `.css` file's padding/gap values). Document it as the standard (multiples of 4px, card padding 16–20px, table row padding ~12px vertical) rather than introducing a differently-named scale that would just alias the same numbers.

### 21. Button hierarchy

Already fully built (`admin.css:106-171`): Primary (`--admin-btn--primary`, brand-filled), Secondary (`--admin-btn--secondary`, outlined), Ghost (`--admin-btn--ghost`, borderless/tertiary), Danger (`--admin-btn--danger`, distinct red per §18). No new variant needed — confirming the brief's four-way hierarchy is already satisfied.

### 22. Table foundation

Already established per-screen (`AdminEventsTable`/`AdminUsersTable` share the same structural pattern: sortable headers, hover row state, status badges, overflow action menu, mobile card fallback, skeleton loading, empty states, pagination) but never extracted into one shared primitive — and per this project's own "in existing codebases, follow established patterns" convention plus the precedent that Phase 5 deliberately did NOT build a shared table component ("there is no shared table primitive in this repo"), this phase does not introduce one either. It documents the existing pattern as the standard future tables (Submissions, Organizer Requests, Venues) should clone, the same way Phase 5 cloned Phase 3's table.

### 23. Form foundation

Already built (`admin.css:217-275`): persistent labels (`.admin-field label`), `.admin-input`/`.admin-select`/`.admin-textarea` with consistent sizing, focus-visible rings. Missing today and worth adding in this phase: a standard `.admin-field__hint` (help text) and `.admin-field__error` class (the latter already exists, added ad hoc in `AdminConfirmDialog.css`/`AdminRoleChangeDialog.css` during Phase 5/6 — promote it to `admin.css` as a shared rule so future forms don't redefine it per-component) and a documented `required`-indicator convention (`*` suffix on the label, matching `AdminEventForm.tsx`'s existing "Event Title *" pattern).

### 24. Status-badge foundation

Already built and the widest surface area for the token rename (see Audit) — `AdminStatusBadge` (event status), `AdminRoleBadge`, `AdminAccountStatusBadge` (Phase 5/6). No new badge component; every existing one gets its hardcoded hex replaced with theme-aware tokens per §14/§17.

### 25. Loading/empty/error/success patterns

All four already exist per-screen (`.admin-skeleton` shimmer, per-page empty states with heading+action, page/section-level `.admin-banner--error`, and — not yet built — toast-style success feedback, which every mutation today surfaces via inline row-error text instead, per Phase 5's "Action failed: {error}" pattern). Toasts are genuinely new: recommend a minimal `admin-toast` component (fixed-position, auto-dismissing, `role="status"`) for the one thing inline errors don't cover — positive confirmation of a successful action away from the row that triggered it (Phase 5/6 currently rely on the row simply updating, which is silent for screen-reader users beyond the `role="status"` announcement string already wired into `AdminUsersPage`). This is a small, real gap, not speculative — build it in this phase since §29 explicitly asks for it and no later phase owns it.

### 26. Desktop behavior

Unchanged (already correct): persistent/collapsible sidebar (collapse is the one addition), full page headers, `--admin-content-max: 1440px` already caps content width (confirmed in `admin.css:29`) so "avoid stretching across very large monitors" is already satisfied.

### 27. Tablet behavior

Unchanged — the existing 768–1023px icon-rail breakpoint already is the tablet treatment the brief asks for (collapsible-by-viewport sidebar, preserved actions, tables that already move to cards at this width per every Phase 3/5/6 table's `<1024px` card fallback).

### 28. Mobile navigation and layout behavior

Unchanged structurally — drawer navigation, compact topbar, card-based tables all already exist. New: the Appearance/Account rows join the drawer's own account section (the brief's §36 wireframe shows Appearance/Account/Sign Out inside the mobile drawer itself, not behind a separate menu — since there's no room for a floating account disclosure on a phone-width drawer). Confirm `AdminSidebar`'s drawer variant gains the same account block the desktop topbar's `<details>` shows, rather than requiring a second navigation path on mobile.

### 29. Accessibility requirements

Carried over from every prior phase's existing discipline (focus-visible rings already on every interactive element, `role="status"`/`role="alert"` already used throughout Phase 5/6, dialogs already manage focus and restore it on close per Phase 5's `AdminConfirmDialog` fix) plus two new requirements specific to this phase: theme changes must not produce any combination failing WCAG AA contrast (verify each dark-theme token pair, not just assume the light-theme contrast ratios carry over), and the collapse toggle / theme radio group must be fully keyboard-operable (native `<details>`/`<input type="radio">` gets this for free, which is why the account-menu implementation prefers native disclosure elements over a custom dropdown).

### 30. Motion/reduced-motion recommendations

Sidebar collapse and drawer open/close already use CSS transitions in the existing code (`admin.css` already has a `prefers-reduced-motion: reduce` block disabling the skeleton shimmer animation — the established precedent to extend, not a new pattern). Theme switching gets **no transition** at all (per §39's explicit "avoid a long animated crossfade") — the `data-theme` attribute change is instant; only the sidebar collapse width and the account-menu disclosure keep their existing fast (~150ms) transitions, and both already respect `prefers-reduced-motion` via the same media query used for skeletons today.

### 31. Recommended database/persistence adjustments

**Recommended Now:** `localStorage` keys `admin-theme` and `admin-sidebar-collapsed` — device-level UI preferences, zero backend surface, matches the brief's own MVP recommendation exactly.

**Recommended Later:** a `user_preferences` table (`user_id, theme_preference, created_at, updated_at`) if cross-device sync becomes a real ask once there's more than one admin/moderator signed in from multiple devices — not before. Additional future preferences (`default_event_view`, `preferred_timezone`, `table_page_size`) noted but explicitly not built now, per the brief's own "do not add them before they have concrete UX value."

**Unnecessary:** a notification-bell/notification-center table or UI (see §21's reasoning — sidebar attention counts and the Overview's Needs Attention section already cover this need; a bell would duplicate it) — Recommend **Unnecessary**, not "Later," since nothing in the current or near-future roadmap creates a need a bell would uniquely serve.

### 32. Final wireframes

Desktop (expanded, light):

```text
┌──────────────────┬──────────────────────────────────────────────┐
│                  │                                              │
│ [Logo]SalsaSegura│ Admin › Users                    [Avatar ▾]  │
│                  │                                              │
│ OVERVIEW         ├──────────────────────────────────────────────┤
│ ● Dashboard      │                                              │
│                  │                                              │
│ MANAGEMENT       │               PAGE CONTENT                   │
│   Events         │                                              │
│   Users          │                                              │
│                  │                                              │
│ REVIEW           │                                              │
│   Submissions  3 │                                              │
│   Organizer    1 │                                              │
│                  │                                              │
│ PLATFORM         │                                              │
│   Venues         │                                              │
│   Tags           │                                              │
│                  │                                              │
│ SYSTEM           │                                              │
│   Settings       │                                              │
│                  │                                              │
│ ◀ Collapse       │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

Desktop (collapsed):

```text
┌────┬────────────────────────────────────────────────────────────┐
│[L] │ Admin › Users                                   [Avatar ▾]  │
│ ●  ├────────────────────────────────────────────────────────────┤
│ □  │                                                             │
│ □  │                        PAGE CONTENT                         │
│ □ 3│                                                             │
│ □ 1│                                                             │
│ □  │                                                             │
│ □  │                                                             │
│ □  │                                                             │
│ ▶  │                                                             │
└────┴────────────────────────────────────────────────────────────┘
```

Account menu, expanded to Appearance:

```text
┌─────────────────────────────┐   ┌─────────────────────────────┐
│ Roosevelt Segura             │   │ Appearance                   │
│ @rooseveltsegura              │   │                               │
│ Admin                         │──▶│ ✓ System                     │
├─────────────────────────────┤   │   Light                       │
│ Appearance                >  │   │   Dark                        │
│ Account                      │   └─────────────────────────────┘
├─────────────────────────────┤
│ Sign Out                     │
└─────────────────────────────┘
```

Mobile drawer:

```text
┌────────────────────────────┐
│ SalsaSegura                 │
│                              │
│ Overview                    │
│ Events                      │
│ Users                       │
│                              │
│ Review                      │
│ Event Submissions        3  │
│ Organizer Requests       1  │
│                              │
│ Venues                      │
│ Tags                        │
│ Settings                    │
│                              │
│ ─────────────────           │
│ Appearance                  │
│ Account                     │
│ Sign Out                    │
└────────────────────────────┘
```

## Critical files & anchors for implementation (when approved)

| File | Anchor | Why |
|---|---|---|
| `src/styles/admin.css` | tokens (7-42), buttons (106-171), status badge (405-467) | Token rename source of truth; status badge is the widest hardcoded-hex surface |
| `src/layouts/AdminLayout.tsx` / `.css` | account menu (57-68 / 119-191), `sectionLabelFor` | Appearance submenu insertion point; breadcrumb already correct pattern to extend |
| `src/components/Admin/AdminSidebar.tsx` / `.css` | `NAV_ITEMS`, breakpoint blocks | Collapse toggle + attention counts land here |
| `src/contexts/CityContext.tsx` | whole file | Exact pattern to mirror for the new `ThemeContext` |
| `src/app/providers.tsx` | provider nesting order | Where `ThemeProvider` joins `QueryClientProvider`/`CityProvider` |

**Do not design Overview, Events, Users, Submission Review, or Organizer Request page content — this phase is shell-only. Awaiting approval before any implementation plan.**

# Mobile Public Shell Implementation Plan

**Goal:** Add a fixed bottom tab bar (Home · Calendar · Submit · Me), safe-area insets, a scroll-triggered floating city pill, and mobile header/section compaction to the public shell only, at `max-width: 640px`.

**Architecture:** Two new presentational components, `MobileTabBar` and `FloatingCityPill`, both rendered from `MainLayout` alongside the existing `Header`. Both are CSS-hidden above 640px so no JS media-query branching is needed for visibility; `FloatingCityPill`'s scroll listener still runs at all widths but the component returns `null` until scrolled, keeping the check cheap.

**Tech Stack:** React 19, react-router-dom v7 `NavLink`, existing `useCity`/`useAuth` contexts, Lucide icons, Vitest + Testing Library.

## Global Constraints
- Public routes only (`MainLayout`); `AdminLayout` (Admin/Host) untouched.
- No emoji icons — use Lucide, matching the existing Header/EventModal convention.
- No new global CSS tokens; reuse `--red`, `--surface-high`, `--border-md`, `--space-*`, `--radius-full`, `--gutter`.
- Tab bar and pill both respect `env(safe-area-inset-*)` only inside the `max-width: 640px` media query.
- `.page-content` must gain bottom clearance at ≤640px so the tab bar never occludes content.

## Task 1: `MobileTabBar`

**Files:**
- Create: `src/components/MobileTabBar/MobileTabBar.tsx`
- Create: `src/components/MobileTabBar/MobileTabBar.css`
- Create: `src/components/MobileTabBar/MobileTabBar.test.tsx`
- Modify: `src/layouts/MainLayout.tsx`
- Modify: `src/styles.css` (`.page-content` bottom clearance at ≤640px)

- [ ] Write failing tests: renders four `NavLink`s (Home `/`, Calendar `/calendar`, Submit `/submit`, Me); Me points to `/profile` when `useAuth()` returns a user, `/signin` otherwise; active route gets `aria-current="page"` via `NavLink`.
- [ ] Run `npx vitest run src/components/MobileTabBar/MobileTabBar.test.tsx` — expect FAIL (module missing).
- [ ] Implement `MobileTabBar`: `<nav className="mobile-tab-bar" aria-label="Primary">` with four `NavLink`s, each an icon (Lucide `Home`, `CalendarDays`, `PlusCircle`, `User`) plus a visible text label. Fixed position, `display: none` above 640px, `z-index` below the modal overlay (1100) — use `999`.
- [ ] Add `.page-content` bottom padding at `max-width: 640px` sized to the tab bar height (56px) plus `env(safe-area-inset-bottom)`.
- [ ] Render `<MobileTabBar />` in `MainLayout` after `<Header />`.
- [ ] Run the focused test — expect PASS.
- [ ] Commit: `feat: add mobile bottom tab bar`

## Task 2: Safe-area insets on the header

**Files:**
- Modify: `src/components/Header/Header.css`

- [ ] Add `padding-top: env(safe-area-inset-top)` to `header nav` inside the existing `@media (max-width: 990px)` block, scoped further to `max-width: 640px` (nest or add a second query) so desktop/tablet spacing is untouched.
- [ ] No test — pure CSS; verified visually in Task 4.
- [ ] Commit: `feat: add safe-area top padding to mobile header`

## Task 3: `FloatingCityPill`

**Files:**
- Create: `src/components/FloatingCityPill/FloatingCityPill.tsx`
- Create: `src/components/FloatingCityPill/FloatingCityPill.css`
- Create: `src/components/FloatingCityPill/FloatingCityPill.test.tsx`
- Modify: `src/layouts/MainLayout.tsx`

- [ ] Write failing tests: renders nothing before scrolling past the threshold; renders a BOS/NYC toggle after `window.scrollY` exceeds 420 and a scroll event fires; clicking a city button calls `setCity` from `useCity()`.
- [ ] Run `npx vitest run src/components/FloatingCityPill/FloatingCityPill.test.tsx` — expect FAIL.
- [ ] Implement `FloatingCityPill`: local `visible` state, a passive `scroll` listener (added/removed in `useEffect`) toggling `visible = window.scrollY > 420`, two buttons (BOS/NYC) matching the existing city switcher's active-state styling. `display: none` above 640px; positioned `bottom: 26px` desktop, and inside the ≤640px query repositioned above the tab bar (`bottom: calc(56px + 12px + env(safe-area-inset-bottom))`).
- [ ] Render `<FloatingCityPill />` in `MainLayout`.
- [ ] Run the focused test — expect PASS.
- [ ] Commit: `feat: add scroll-triggered floating city pill`

## Task 4: Mobile compaction and verification

**Files:**
- Modify: `src/components/Header/Header.css` (logo size, section padding at ≤640px, only if not already covered)
- No new files.

- [ ] Reduce logo size inside the ≤640px query if not already reduced elsewhere (`Header.css` currently only branches at 990px).
- [ ] Run full Vitest, lint, `tsc --noEmit`, production build.
- [ ] Browser-drive at 390×844: confirm tab bar reachable, no overlap with page content, city pill appears after scrolling and sits above the tab bar, Me tab reflects signed-out `/signin` by default.
- [ ] Commit any fixes found during verification.

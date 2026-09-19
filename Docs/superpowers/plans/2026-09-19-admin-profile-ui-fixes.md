# Admin and Profile UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop admin action menus being clipped, make profile covers full-bleed, and remove the empty venues filter card.

**Architecture:** Keep existing components and tokens. Portal `AdminActionMenu` into the nearest `.admin-shell` and position it fixed from the trigger rectangle. Use a CSS full-bleed breakout for the profile cover. Render the venues chips card only when chips exist.

**Tech Stack:** React 19, React DOM portal, TypeScript, CSS custom properties, Vitest, Testing Library, real-browser measurement.

**Spec:** User-approved bounded designs from 2026-09-19.

## Global Constraints

- Preserve existing menu keyboard navigation, Escape handling, focus restore, danger styling, and 44px targets.
- No new dependency or design token.
- No animation.
- Verify layout with browser measurements, not screenshots alone.

---

### Task 1: Unclipped Admin Action Menu

**Files:**

- Modify: `src/components/Admin/AdminActionMenu.tsx`
- Modify: `src/components/Admin/AdminActionMenu.css`
- Test: `src/components/Admin/AdminActionMenu.test.tsx`

**Interfaces:**

- Produces a portal-mounted `role="menu"` with fixed `top`/`left`, viewport clamping, and unchanged item behavior.

- [ ] **Step 1: Add a failing portal/position test**

Render inside `.admin-shell > .admin-events-table__scroll`, mock trigger/panel rectangles, open the menu, and assert the panel is outside the overflow wrapper, has fixed coordinates, and remains keyboard-operable.

- [ ] **Step 2: Confirm failure**

Run `npm test -- --run src/components/Admin/AdminActionMenu.test.tsx`.

- [ ] **Step 3: Implement portal positioning**

Use `createPortal` into the closest `.admin-shell` (fallback `document.body`) so admin CSS variables remain inherited. On open, measure trigger and panel in `useLayoutEffect`; right-align, clamp to an 8px viewport gutter, place below when it fits and above otherwise. Close on captured scroll/resize. Outside-pointer logic must treat both trigger wrapper and portaled panel as inside.

- [ ] **Step 4: Update CSS**

Change panel positioning from absolute/right to fixed/top/left driven by inline coordinates; keep z-index 50 and all existing tokens. Remove the obsolete `--up` rule.

- [ ] **Step 5: Run focused tests and browser proof**

Verify menu bounds stay within viewport and extend outside the table scroll container at desktop width.

### Task 2: Full-Width Profile Cover

**Files:**

- Modify: `src/pages/account/ProfilePage.css:3-37`
- Existing behavior test: `src/pages/account/ProfilePage.test.tsx`

**Interfaces:**

- Produces `.profile-cover` whose horizontal bounds equal the viewport while remaining centered; profile body stays max-width 760px.

- [ ] **Step 1: Record failing browser measurement**

At desktop width, measure `.profile-cover` and viewport: current width is 760px; expected `left = 0`, `right = innerWidth`, `width = innerWidth` within 1px.

- [ ] **Step 2: Apply full-bleed CSS**

Add `width: 100vw; margin-left: calc(50% - 50vw);` to `.profile-cover`. Preserve existing heights, image `object-fit: cover`, controls, and mobile height.

- [ ] **Step 3: Verify desktop and 390px mobile**

Measure horizontal bounds, assert no document-level horizontal overflow, and confirm the cover action remains visible and operable.

### Task 3: Remove Empty Venues Toolbar Card

**Files:**

- Modify: `src/pages/Admin/AdminVenuesPage.tsx:292-316`

**Interfaces:**

- Produces no `.admin-venues-page__toolbar-card` when `chips.length === 0`; unchanged chips/Clear-all card when filters are active.

- [ ] **Step 1: Record the current empty-card reproduction**

Render/visit venues with default filters and confirm an empty toolbar card exists.

- [ ] **Step 2: Make the card conditional**

Wrap the entire card in `chips.length > 0 && (...)`; remove the redundant inner condition while preserving chip dismissal and Clear all.

- [ ] **Step 3: Browser-verify both states**

Default filters: zero toolbar cards. Active filter: one card containing the chip and Clear all; dismissing the final chip removes the card.

### Task 4: Final UI Verification

- [ ] Run `npm test -- --run src/components/Admin/AdminActionMenu.test.tsx src/pages/account/ProfilePage.test.tsx`.
- [ ] Run `npm run lint` and `npm run build`.
- [ ] Browser-check events table menu, profile cover at desktop/mobile, and venues chips states; inspect console for errors.

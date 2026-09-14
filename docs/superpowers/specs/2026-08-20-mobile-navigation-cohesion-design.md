# Mobile Navigation Cohesion Design

## Context

Salsa Segura’s public header currently changes at `max-width: 990px` from a horizontal desktop navigation to a full-screen drawer. The drawer presents primary destinations, city selection, and account actions as one continuous vertical list. The underlying routes and state behavior are complete, but the visual hierarchy does not distinguish navigation, location, and account operations.

This design refines the existing drawer into a cohesive, touch-first navigation surface. It does not change the public information architecture, authentication flows, city persistence, or desktop navigation.

## Grounded state of the codebase

| Area | Current implementation | Design implication |
| --- | --- | --- |
| Header structure | `src/components/Header/Header.tsx` renders `PRIMARY_LINKS`, a mobile city switcher, and conditional signed-in/moderator actions inside one `ul.nav-links`. | Retain the link set and conditions; introduce semantic visual grouping within the existing drawer. |
| Drawer behavior | `mobileOpen` controls `.nav-links.active`; Escape, navigation clicks, city changes, and sign-out close the drawer. | Preserve every close path and its existing accessible state attributes. |
| Mobile layout | `src/components/Header/Header.css` makes the drawer fixed below the 68px header and vertically scrollable at `≤990px`. | Keep the viewport-safe scrolling container; only improve grouping, spacing, and touch sizing. |
| Design reference | `.design-sync/conventions.md` defines dark glassmorphism, rose-red primary actions, gold focus accents, Epilogue UI type, and a 4px spacing scale. | Use existing custom properties and the glass-card formula; do not introduce tokens or colors. |

## Architecture decision

**Decision: retain the existing hamburger-to-drawer navigation model and organize it into three distinct content groups.**

| Decision | Benefit | Ripple |
| --- | --- | --- |
| Keep `Header` as the owner of mobile state and close behavior. | No route, auth, or city-state contract changes. | Scoped to `Header.tsx`, `Header.css`, and its existing tests. |
| Render grouped drawer sections: destinations, city setting, account actions. | The user can immediately distinguish where to go, which city is active, and what account action is primary. | Small markup change; desktop markup and behavior stay intact. |
| Retain the existing `NavLink`, `button`, and city-switch primitives. | Active routes, keyboard semantics, and current testable behavior remain native. | CSS becomes responsible for the new hierarchy rather than parallel mobile components. |

## Deliverables

### 1. Drawer context and destination group

At mobile widths, the drawer will begin with a compact non-interactive context label: **Explore Salsa Segura**. It is followed by the five existing primary destinations in their existing order: Calendar, Lessons, Instructors, About, and Contact.

Each destination will be a full-width row with a minimum 44px touch target. The active route will use the current rose-red cue and brighter text; inactive destinations remain quiet. The destination group must not use CTA styling, so it remains visibly distinct from `Submit Event`.

### 2. City utility panel

The existing BOS / NYC city switcher moves below destination navigation into a self-contained glass panel. The panel receives the label **Your city**, an existing translucent card treatment, and the current city switcher without changing its state or click behavior.

The selected city retains the existing rose-red fill. Selecting a city continues to update the shared city context and close the drawer.

### 3. Account and submission action panel

The final drawer group is separated from the city utility by a divider and a compact account label.

- Signed out: `Submit Event` is a single full-width rose-red CTA. `Sign In` is a quiet, full-width secondary action.
- Signed in: `Submit Event` remains the single full-width CTA. `My Profile` and conditional `Dashboard` are quiet secondary actions. `Sign Out` remains last, visually distinct but subordinate to navigation and submission.

All existing destinations, conditional moderator access, route paths, and sign-out handling stay unchanged.

### 4. Interaction and accessibility

The hamburger button retains its `aria-controls`, `aria-expanded`, and context-sensitive accessible label. Escape-to-close remains in place. Every navigation click, city selection, and sign-out continues to close the drawer.

The drawer remains vertically scrollable for authenticated and moderator variants. It uses existing `:focus-visible` treatment with the gold focus outline. No function depends on hover, swipe, or other gesture-only interactions.

### 5. Responsive boundaries

The refinement applies only to the existing `max-width: 990px` mobile drawer. Desktop and wider layouts retain their existing primary nav, city switcher, account disclosure, and action placement.

## Wireframe

```text
┌────────────────────────────────────────────┐
│ Salsa Segura                         [ × ] │  sticky header
├────────────────────────────────────────────┤
│ EXPLORE SALSA SEGURA                       │
│ Calendar                                ›  │
│ Lessons                                 ›  │
│ Instructors                             ›  │
│ About                                   ›  │
│ Contact                                 ›  │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ YOUR CITY                              │ │
│ │ [ BOS ]  [ NYC ]                       │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ ACCOUNT                                    │
│ [             SUBMIT EVENT              ] │  rose-red CTA
│ Sign In                                    │  or My Profile / Dashboard
│                                            │
│ Sign Out                                   │  signed-in only
└────────────────────────────────────────────┘
```

## Verification

1. Extend focused Header tests to assert the mobile grouping and retain the existing primary, city, signed-out, signed-in, and moderator action contracts.
2. Browser-drive a narrow viewport for signed-out, signed-in, and moderator states. Verify opening, closing, Escape, scroll behavior, active route treatment, city selection, each destination, and sign-out.
3. Run the relevant test file, TypeScript check, lint, and production build before handoff.

## What this design does not decide

- A persistent bottom navigation pattern.
- Changes to routes, page labels, authentication behavior, city storage, or moderator permissions.
- New icons, new tokens, a new color palette, or a mobile-specific design system.
- Tablet-specific navigation behavior beyond the existing breakpoint.

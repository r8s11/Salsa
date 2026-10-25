# Mobile Public Shell: Bottom Tab Bar, Safe Areas, Floating City Pill

## Context

The handoff (`Prompt - Aug 21 changes.md` §1) specifies a mobile shell at `max-width: 640px`: a fixed bottom tab bar, a floating action button, safe-area insets, dashboard table→card conversion, header/section compaction, and a floating city pill. None of this exists today. Mobile navigation is currently a full-height slide-in drawer (`Header.tsx`/`Header.css:226-258`) that already contains the city switcher and account links.

This phase scopes to the **public mobile shell** only. Admin/Host dashboard table responsiveness is explicitly deferred (Host My Events already does this; other Admin tables do not).

## Decisions

| Decision | Rationale |
| --- | --- |
| Tab bar = Home · Calendar · Submit · Me | The handoff's "Directory" tab has no equivalent route in this app (no unified directory page — only `/lessons`, `/instructors`, `/schools`). Submit replaces the floating "+", which would otherwise duplicate a tab. |
| Tab bar rendered from `MainLayout` only | Public routes only; `AdminLayout` (Admin/Host) is untouched, satisfying the handoff's "hidden on dashboard shells" requirement structurally rather than by a runtime check. |
| Existing hamburger drawer stays | It already covers Lessons/Instructors/Schools/About/Contact/city/account; the tab bar only replaces reach for the four primaries, not the full menu. |
| New `FloatingCityPill` component | Distinct interaction (scroll-triggered, always-visible city switch) from the header-level switcher; the handoff specifies both coexist. |

## Deliverables

### 1. `MobileTabBar`
- Fixed bottom nav, visible only `max-width: 640px`, `z-index` below the event modal (1100) and above page content.
- Items: Home (`/`), Calendar (`/calendar`), Submit (`/submit`), Me (`/profile` when signed in, `/signin` when signed out).
- Lucide icons (existing icon convention — no emoji), active state via `NavLink`.
- `.page-content` gains bottom padding at ≤640px equal to the tab bar's height plus safe-area inset, so it never covers content.

### 2. Safe-area insets
- Header top padding adds `env(safe-area-inset-top)` only at ≤640px.
- Tab bar bottom padding adds `env(safe-area-inset-bottom)`.

### 3. `FloatingCityPill`
- Renders on public pages after ~420px scroll depth; bottom-right.
- Desktop: `bottom: 26px`. Mobile: stacked above the tab bar, offset by its height plus safe-area inset.
- Reuses the existing `useCity` context; no new city state.

### 4. Header/section compaction at ≤640px
- Reduce logo size and section side padding per the handoff's stated values, matching current design-token usage (no new tokens).

## Explicit exclusions

- Admin/Host dashboard table→card conversion for tables other than the existing Host My Events.
- Tablet (641–1040px) hero centering.
- Calendar week-collapse to a single column.
- Any new route, schema, or backend change.

## Verification

- Component tests for `MobileTabBar` (active-route highlighting, signed-in vs signed-out Me destination) and `FloatingCityPill` (scroll-triggered visibility, city selection).
- Browser-drive at 390×844: tab bar reachable and functional, no content occluded, safe-area padding present, city pill appears after scroll and offsets above the tab bar.
- Full Vitest, lint, TypeScript, production build.

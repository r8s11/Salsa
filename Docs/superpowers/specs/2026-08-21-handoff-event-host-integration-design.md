# Event Browsing and Host Dashboard Handoff Integration

## Context

The handoff bundle is visual and interaction authority for SalsaSegura’s event browsing and former organizer experience. It is not production code: its Host pages are populated by demo constants and link to routes/data that do not exist. This phase adopts the visual language and information hierarchy only where the existing product can supply truthful data.

## Grounded state of the codebase

| Surface | Existing state | Integration implication |
| --- | --- | --- |
| Homepage + Calendar event selection | Both use the shared accessible `EventModal`; Calendar also supports `?event=` deep links. | Restyle and preserve this modal; do not create the handoff’s duplicate quick-modal component. |
| Public event page | No `/events/:id` or `/events/:slug` route exists. | Do not add a handoff “Full details” action that would be dead. |
| Event data | Events provide type, title, date/time, venue/address, price, description, host, dance styles, gallery, contact, and RSVP. | Surface only these facts. Teacher, level, length, lineup, capacity, attendance, DJ, and task data are unavailable. |
| Organizer role | `/admin` renders an organizer dashboard through `AdminOverviewPage`, but it obtains platform-wide events via `useAdminEvents()`. | Replace organizer-only view with signed-in owner data from the existing `useMySubmissions()` query. |
| Event editing | `/profile/edit/:eventId` is owner-scoped and pending/rejected-only. | Host event actions must route there only for editable statuses; approved events keep the Calendar detail route. |
| Admin shell | `AdminLayout` and `AdminSidebar` already supply the rail, breadcrumb, account menu, theme, mobile drawer, and responsive tokens. | Extend this shell rather than importing the handoff’s parallel `DashboardShell`. |

## Core architecture decision

Keep `/admin` as the authenticated Host shell, but make its organizer-role content owner-scoped and label it **Host** throughout. Add a single host-events child route inside that existing shell. Event browsing retains the shared `EventModal` and adopts the handoff’s quick-look hierarchy without inventing a new event-detail route.

| Decision | Benefit | Cost/ripple |
| --- | --- | --- |
| Reuse `EventModal` | Preserves keyboard/focus behavior and all current integrations. | Targeted markup/CSS refinement instead of copying `QuickEventModal`. |
| Owner query for Host | Prevents platform-wide data leaking into the Host overview. | Add host-specific derived metrics and loading/error states. |
| `/admin/host/events` | Gives Host a real My Events surface without a second shell. | Add route, page, route test, and sidebar labels. |
| Truthful fields only | Avoids demo registrations, capacity, tasks, or DJ claims. | Handoff’s richer blocks remain excluded. |

## Deliverables

### 1. Event quick-look refinement

- Recompose the existing modal’s opening region around the handoff’s date block, type chip, title, factual time/venue/price summary, and concise description.
- Keep the existing RSVP, Add to Calendar, maps, contact, recurrence, gallery, escape, focus trap, backdrop close, and Calendar deep-link behavior.
- Class/workshop metadata uses only stored dance styles and host; omit unavailable teacher/level/length chips.
- Desktop stays centered; mobile retains the existing compact modal/sheet behavior without overflow.

### 2. Host dashboard

- Rename organizer labels to Host in the organizer-role dashboard, rail, and account switch context.
- Query only the signed-in owner’s pending/rejected submissions and approved events.
- Lead with the nearest non-terminal owner event when one exists: date, status, title, time, venue, and truthful action.
- Derive owner-only counts for upcoming, pending/review, and total events.
- Keep loading, error/retry, empty, and no-next-event states explicit.

### 3. Host My Events

- Add `/admin/host/events` within `AdminLayout`.
- Provide Cards/Table control with real title, date, venue, status, and contextual action.
- Use the existing event dates/statuses; no registration/capacity columns.
- Pending/rejected rows link to `/profile/edit/:eventId`; approved rows link to `/calendar?event=:id&city=:city`.
- Mobile table representation becomes labelled cards, not compressed columns.

### 4. Explicit exclusions

- No public event-detail route, registrations, capacity, door mode, attendee lists, host tasks, DJ workflows, lineup management, or analytics.
- No `DashboardShell`, demo data, `/host/*` routes, or handoff CSS variable namespace.
- No event schema/RLS/storage change.

## Interaction wireframe

```text
Host · Dashboard
┌─ Existing Admin rail ──────────────────────────────────────┐
│ Dashboard     Host · Dashboard                              │
│ My Events                                               [+]  │
│                                                              │
│ Next event: [date] [status] title                            │
│             time · venue             [Open / Edit]           │
│                                                              │
│ [Upcoming] [In review] [All events]                          │
│                                                              │
│ My events                                  [Cards | Table]   │
│ [date] title · venue · status · [View / Edit]                │
└──────────────────────────────────────────────────────────────┘

Event quick look
┌──────────────────────────────────────────────────────────────┐
│ [date] [type]  Event title                              [×]  │
│ time · venue · price                                         │
│ concise description                                           │
│ current RSVP / Calendar / Map / contact affordances           │
└──────────────────────────────────────────────────────────────┘
```

## Verification

- Unit tests cover owner-event derivation, Host-only labels/routes, editable versus approved event actions, Cards/Table behavior, and existing modal integrations.
- Browser-drive public event selection on desktop and mobile; authenticated Host dashboard requires a working local Supabase/auth stack.
- Run targeted Vitest files, full Vitest, lint, TypeScript, and production build.

## What this phase does not decide

- The pending SEO event-detail route initiative.
- Host approvals or published-event edit/resubmission policy.
- Any data model that supports the handoff’s registrations, attendees, lineup, DJ, task, or capacity views.

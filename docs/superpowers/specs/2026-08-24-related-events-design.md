# Related Events Strip Design

## Context

`design/handoff/pages/EventDetailPage-v2.tsx` specifies a compact “More this week in {city}” strip below the event body. This is dependency 1 of the approved event-detail rebuild: it provides useful discovery now and is later consumed by the complete visual shell.

The current event detail page already has event identity, city, approved-event query access, and a stable `/events/:id` route. It has no lineup, public profile, RSVP, or album-tier data. This deliverable must not invent those concepts or change the database schema.

## Grounded state of the codebase

| Area | Current state | Reuse decision |
| --- | --- | --- |
| Event identity | `DatabaseEvent.id`, `city`, `event_date`, `status` | Use directly. Exclude current event by `id`. |
| Approved-event query | `fetchApprovedEvents(city)` returns ordered future approved events | Reuse one city-scoped query. Filter window and fallback in a pure helper. |
| Event details route | `/events/:id` | Each related card links directly to this route. |
| Event-card visual language | Existing date badge, event-type color tokens, display/body fonts | Build compact event-detail-local cards with the same semantic token system; do not introduce a second palette. |
| Reference visual target | `design/handoff/pages/EventDetailPage-v2.tsx` | Match compact date-card hierarchy, not unavailable lineup/album behavior. |

## Core architecture decision

Add a pure related-event selection helper and a small `RelatedEventsStrip` presentation component. `EventDetailPage` fetches same-city approved events through existing query infrastructure, then passes current event and returned candidates to the helper.

Selection order:

1. Exclude the displayed event and any non-future candidate.
2. Select same-city events whose start is after the displayed event and within seven calendar days.
3. If fewer than three exist, backfill from later same-city approved events in chronological order.
4. Return at most three cards.
5. Render nothing when no other candidate exists.

| Decision | Cost | Ripple |
| --- | --- | --- |
| Client-side selection from existing city query | No SQL or RLS change | One additional cached query on event detail view. |
| Seven-day first, fallback second | Reference-faithful while avoiding empty discovery region | Deterministic helper test matrix. |
| Direct links, no modal reuse | Stable URLs and browser navigation | No modal state, no share-flow coupling. |
| Compact local component | Can be placed in later tab/shell redesign unchanged | One new component and scoped CSS. |

## Deliverables

### 1. Selection helper

Create a pure helper that accepts displayed event ID, city, displayed event start time, and approved candidates. It returns chronological `ScheduleXEvent` candidates according to the selection order above.

Rules:

- Invalid candidate dates are excluded.
- The current event is never returned.
- Candidates on or before displayed event start are excluded.
- Same-city validation occurs before date-window selection.
- The fallback must not duplicate strict-window candidates.
- Output is capped at three.

### 2. Related-events strip

Render only when helper returns at least one candidate.

- Heading: `More this week in {city label}` when at least one strict-window result is present; otherwise `More in {city label}`.
- Cards: weekday/day/month date badge, title, start time, event-type semantic accent.
- Every card is one keyboard-accessible link to `/events/:id`.
- Desktop: horizontal compact card row.
- Mobile: vertical or horizontally scrollable layout only when content width requires it; cards never clip or overlap fixed navigation.
- No image dependency. A related event remains useful even without flyer media.

### 3. Event-detail integration

Place the strip below the current event-detail content, after main/aside sections. It will move into the later approved event-detail shell without changing selection behavior or card APIs.

- Use existing query cache keys and approved-event source only.
- Loading, query failure, and zero-related-event states render no strip and do not replace event detail content.
- No attendee, lineup, host-profile, or photo-album placeholder UI belongs in this deliverable.

## Wireframe

```text
┌───────────────────────────────────────────────────────────────────┐
│ MORE THIS WEEK IN GREATER BOSTON                                   │
│                                                                   │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             │
│ │ FRI           │ │ SAT           │ │ SUN           │             │
│ │ 27 AUG        │ │ 29 AUG        │ │ 30 AUG        │             │
│ │ Salsa Social  │ │ Bachata Lab   │ │ Mambo Night   │             │
│ │ 7:00 PM       │ │ 6:30 PM       │ │ 8:00 PM       │             │
│ └───────────────┘ └───────────────┘ └───────────────┘             │
└───────────────────────────────────────────────────────────────────┘
```

## What this deliverable does not decide

- Public host, instructor, performer, or DJ profile model and directory routes.
- Event lineup schema or profile-linked roles.
- RSVP/attendance tracking.
- Photo album storage, attendee-only visibility, moderation, or uploads.
- Class-fact fields such as taught-by, expected level, and class length.
- Full tabbed event-detail shell redesign. Those remain later dependencies in the approved 1→5 build order.

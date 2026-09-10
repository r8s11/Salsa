# Organizer Event Editing and Homepage Modal Improvements

## Context

SalsaSegura needs focused event-management improvements without replacing the established React, React Router, TanStack Query, Supabase, or Ritmo Vivo design conventions. The supplied redesign reference is visual guidance for a compact dark-surface hierarchy, responsive density, event imagery, and modal information layout; it does not authorize a new application shell.

The work is limited to homepage event interaction, the existing owner-scoped `/profile` dashboard and `/profile/edit/:eventId` editor, flyer upload, admin brand navigation, and the named spacing consistency pass.

## Grounded state of the codebase

| Area | Current behavior | Consequence |
| --- | --- | --- |
| Homepage cards | `EventCard` and `FeaturedEventCard` navigate to `/calendar?event=:id`. | Selection leaves the homepage. |
| Shared event detail | `EventModal` already owns focus trapping, map links, contact links, RSVP, gallery, and Add to Calendar. | Homepage must reuse it rather than duplicate it. |
| Organizer surface | `/profile` loads the signed-in user’s pending/rejected submissions and approved events, with loading, retry, empty, status, and edit states. | It is the existing organizer dashboard. |
| Owner edit | `/profile/edit/:eventId` resolves only from the signed-in owner’s events. | UI ownership is scoped; edits are intentionally pending/rejected-only. |
| Image persistence | `events.image_url` exists; images are URL-based; no Storage bucket or policies exist. | Upload needs a manual Storage SQL file, not a new event column. |
| Admin branding | `AdminSidebar` displays `SalsaSeguraLogo` without a link. | Brand is not a public-site escape hatch. |
| Authorization | Existing RLS permits the original submitter to update only their pending/rejected events. | Preserve this review gate; approved-event edits are out of scope. |

## Core architecture decision

Extend the existing owner editor only within its pending/rejected review state. Reuse `EventModal`, `events.image_url`, existing direct event mutation, and shared submit-event fieldsets. Add one reusable flyer input component plus a manually run SQL file that configures a Storage bucket and object policies. Do not change the event status policy or add an approved-event resubmission workflow.

| Decision | Benefit | Ripple |
| --- | --- | --- |
| Homepage-local selected event state | Closing restores the exact homepage state and URL. | Homepage cards receive an event-selection callback; calendar stays query-driven. |
| Shared flyer input | Organizer/editor and admin form use one validation, preview, and upload behavior. | Existing admin URL input evolves without duplicating uploader logic. |
| Existing review gate | Pending/rejected updates stay reviewable before public display. | No `events` authorization-policy change or new status workflow. |

## Deliverables

### 1. Event flyer/banner upload

- Add a labelled, keyboard-accessible flyer field to the owner editor and existing admin event form.
- Render the current `image_url` when present, plus an object-URL preview for a selected replacement before save.
- Accept JPEG, PNG, and WebP files up to 5 MiB. Present inline, accessible failures for unsupported files, size overflow, upload failure, and image-load failure.
- Upload to a new public `event-flyers` bucket in an owner/event-prefixed path. Save the returned public URL to the existing `events.image_url` field only after successful upload.
- On successful replacement, remove the old object only when its URL belongs to `event-flyers`; never delete a legacy external URL.
- Retain entered form values after upload or save failure.

### 2. Homepage modal state

- Give the homepage events container nullable selected-event state and render `EventModal` within the homepage flow.
- Change homepage standard and featured cards from route navigation to a passed event-selection callback.
- Closing clears only local modal state: the URL, city, filters, scroll position, and homepage remain unchanged.
- Preserve the calendar’s existing query-string modal behavior.

### 3. Brand navigation

- Make the admin sidebar’s full logo/name an accessible link to `/`.
- Preserve all explicit admin navigation.
- Preserve the existing public-header logo behavior already used by `/profile` and `/profile/edit/:eventId`.

### 4. Compact event information

- Remove the auto-margin that separates `.event-card-meta` from its title and use an intentional small body gap.
- Reduce `EventModal` row, chip, and description spacing while retaining date → location → time → host → styles → description hierarchy.
- Give long location/address text the remaining flex width so it wraps while its icon stays aligned.
- Preserve type colors, typography tokens, focus affordances, and current single-column mobile layouts.

### 5. Organizer dashboard and event editor

- Keep `/profile` as the signed-in owner’s event list, with clear statuses, loading, retry, empty, and edit states.
- Continue rendering the editor only after resolving the event from the owner’s fetched events.
- Preserve pending/rejected editing for ordinary submitters and organizers. Approved events remain read-only and publicly stable.
- Support flyer replacement alongside the current schema-backed edit fields; do not introduce speculative fields or duplicate the admin editor.
- Validate required fields before save, disable duplicate saves, preserve unmodified optional fields, and show accessible in-place save success plus actionable failures.
- Preserve administrator/moderator event-management paths.

## Storage SQL

Create one reviewable SQL file under `sql/` and do not execute it. It must:

1. Create or idempotently configure public bucket `event-flyers` with JPEG/PNG/WebP MIME types and a 5 MiB limit.
2. Permit authenticated owners to create, update, and delete objects only in paths rooted at their auth UID.
3. Permit admins to manage objects across owner paths for the existing admin event form.
4. Allow public reads through the public bucket.
5. Reload PostgREST schema after installation.

No `events` table schema, event RLS, or status-workflow change is required.

## Interaction and responsive wireframes

```text
Desktop homepage
┌───────────────────────────────────────────────────────────────┐
│ Hero / featured / event cards                                  │
│ [Event card] ── click ──> [EventModal overlay]                │
│                         close ──> original homepage unchanged  │
└───────────────────────────────────────────────────────────────┘

Organizer dashboard
┌───────────────────────────────────────────────────────────────┐
│ Public header: [SalsaSegura] → /                                │
│ My events: date | title + venue | status | Edit                 │
│ Edit: details · location · pricing · flyer preview              │
└───────────────────────────────────────────────────────────────┘

Mobile editor
┌───────────────────────────────┐
│ Flyer                           │
│ [current/selected preview]      │
│ [Choose replacement]            │
│ validation/upload feedback      │
│ fields stacked one per row      │
│ [Save changes] [Cancel]         │
└───────────────────────────────┘
```

## Verification

- Component tests cover homepage selection without navigation, flyer validation, upload failure, successful `image_url` persistence, and owner/state editor gating.
- Existing calendar modal tests demonstrate calendar behavior stays query-driven.
- Browser verification covers homepage desktop and narrow-mobile modal behavior; organizer dashboard/editor values, flyer replacement, save feedback, and public-logo navigation.
- Run focused Vitest tests, then `npm run lint`, `npx tsc --noEmit`, and `npm run build`.

## What this phase does not decide

- A new organizer shell or `/admin` organizer route.
- Approved-event edit/resubmission workflow, gallery upload, CDN image transformations, image moderation, or a new event column.
- Changes to calendar, map/calendar/social integrations, authentication provider behavior, or admin/moderator event-management scope.
- Automatic execution of production SQL.

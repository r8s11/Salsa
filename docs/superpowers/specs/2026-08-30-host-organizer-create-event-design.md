# Host Organizer Create Event — Phase 2

## Scope

`/host/events/new` creates canonical `events` rows through `organizer_create_event`. The page is available only to authenticated users with an active owner/manager membership on an active organizer; editors can view Host surfaces but cannot create. A single manageable organizer is implicit; multiple manageable organizers use a real selector.

## Data and lifecycle

The shared event form keeps the production legacy `event_date`/`event_time` contract and canonical `dance_styles` slugs. Create requests carry only accepted event fields plus the selected organizer id; the RPC stamps `organizer_id`, `source_type = organizer`, and submitter identity, with draft/published status selected by the action. Venue entry remains compatible with manual location/address; `venue_id` is accepted only where the separately reviewed production venue prerequisite exists.

## Flyer and errors

Flyer selection uses the existing validated preview/remove field. Event creation is authoritative: if the optional upload or image update fails after the row is created, the uploaded object is cleaned up best-effort, the user is navigated to Host detail, and a concise warning explains that the event was saved. Permission and backend failures are mapped to product-safe copy. Drafts remain visible in Host detail/list; Phase 3 editing is explicitly out of scope.

## Host shell

Dashboard and My Events dedupe submitter and organizer-owned canonical events, include organizer-query loading/errors/retry, and preserve public `/submit` and admin event creation. The new-event breadcrumb is explicit and the create surface avoids nested main landmarks.

## Verification

Focused tests cover memberships, selector/actions, canonical payload and styles, validation, flyer cleanup, safe errors, draft visibility, dashboard dedupe/retry, API RPC wiring, and the existing submit/admin contracts; build and lint run after implementation.

# Events and geography

Run commands from the repository root. [Project setup](../../README.md).

## Artist events and RSVP rollout

The artist event and RSVP implementation is locally verified, not confirmed deployed. User procedures live in the canonical [artist manual](../user-guides/artists.md#create-and-publish-an-artist-event), [guest manual](../user-guides/dancers.md#sign-up-for-an-artist-event) and [organizer publication checklist](../user-guides/organizers.md#before-you-publish).

Apply `supabase/migrations/20261114235900_artist_workshop_rsvp.sql` before releasing the dependent frontend. This changes organizer publication to `organizer_publish_event(uuid,jsonb)` and removes the acknowledgement-free overload; stale clients must refresh, not bypass the checklist.

Deploy `artist-rsvp-submit` and `artist-rsvp-notifications` only with separate operational authorization. Configure the guest's `RSVP_RATE_LIMIT_SECRET` and `RSVP_ALLOWED_ORIGINS`, worker `RSVP_SCHEDULER_SECRET`, service credentials and existing provider configuration. Never publish secrets or private roster data in logs or evidence.

The migration creates durable notification intent but never activates delivery. `supabase/manual/artist-rsvp-scheduler.sql` requires explicit activation and separate RSVP Vault configuration. Before activation, establish trusted ingress behavior with forged-header probes, verified sender/quota, owned-inbox receipt/acceptance delivery and provider idempotency, and dedicated job activation/unscheduling evidence. Qualified responsibility-wording review remains required.

Rollback closes new artist signups and unschedules only the RSVP job. Preserve contacts, server acknowledgement stamps and delivery keys; do not drop populated tables or restore the old unchecked publication API. Local PostgreSQL/PostgREST tests do not establish GoTrue, Edge ingress, storage, Realtime or live-provider readiness.


## School geography: metro, address locality, NYC borough

Schools use **three independent geographic concepts**: `schools.metro_slug` for
discovery (e.g. `new-york-city` or `boston`), `schools.city` for the physical
address locality (e.g. `Brooklyn`, `Long Island City`, `Cambridge`), and
`schools.borough` for the optional NYC grouping. `borough` is null outside
NYC; Jersey City schools belong to the NYC metro but **not** to any NYC borough.

Migrations `20261119202419_separate_school_metro_borough_from_address_city.sql`
and `20261119203154_school_geography_admin_edit_and_public_reference.sql`
must precede the admin and public directory frontend. Existing school slugs,
approval statuses, membership, and event links remain unchanged. The backfill
assigns only conservative geographic matches from locality or ZIP, leaving
ambiguous cases unassigned for manual review. It never promotes a
`needs_review` school to `active`.

The admin school form edits metro, address city, and NYC borough separately.
Public `public_schools` remains allowlisted and active-only; borough filtering
queries this projection. The public NYC picker always includes all five boroughs,
even if a borough has no approved upcoming events; only neighborhood choices
require event inventory. Review school location corrections separately from
the listing's broader completeness and publication checks.

## Neighborhoods

The curated starter catalog lives in
`src/features/metros/model/neighborhood.ts` (51 neighborhoods across eight cities).
Texas remains a regional metro without invented neighborhood assignments.
Existing events remain unassigned until edited; addresses are not used to infer
neighborhoods. Apply `supabase/migrations/20261028120200_event_neighborhoods.sql`
(after the NYC borough migration `20261025120000_nyc_event_sublocations.sql`)
before deploying neighborhood-aware clients. It validates parent-child
relationships, preserves existing boroughs, patches the event-writing RPCs
(admin/moderator save, submission approval, host create and edit) in place with
exact-anchor assertions, and exposes neighborhood filtering through the public
event projection. A direct city or borough change clears the previous child, and
an explicit new neighborhood is accepted in the same write.

Local persistence smoke (fixtures roll back):
`docker exec -i supabase_db_Salsa psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/manual/event-neighborhoods-smoke.sql`.

## Public calendar and event suggestions

The calendar keeps Salsa Segura's dark nightlife identity. Desktop offers month,
week, list, and cards; compact screens offer list and cards. Search event titles,
venues, descriptions, and styles, then narrow by city, event type, or dance style.
**New event** is the calendar's single submission action and opens the form in place.
List view groups approved events by date in chronological batches of 50, with a
keyboard-accessible “Show more events” control. Rows show descriptions, category/style
labels, venue, and start–end times; multi-night events show their actual end date,
overnight events show a next-day marker, and unavailable flyers use event-type artwork.
The entire search bar uses a lazy-loaded `@paper-design/shaders` liquid-metal focus pulse:
650ms of motion, then a static frame; blur disposes it. Reduced-motion and non-WebGL
devices keep a static metal perimeter. Focus feedback stays around the whole bar
while moving between its icon, input, and clear button, without an inner input outline.
Clearing a search returns focus to the input.

On phones, date navigation and List/Cards share a row; type/style filters live in
a native **Filters** disclosure with an active-selection count. Selections persist
when it closes or the view changes. The header city picker replaces duplicate
calendar city controls. Narrow phones retain 44px view buttons with accessible
icon-only labels; short touch-device landscape viewports also use the compact list.

Guests can submit without an account when public suggestions are enabled. Contact
details and required event fields are validated; submissions enter the moderation
queue as `pending` and do not appear publicly until approved. Flyers are optional,
and an event can carry up to five.
Events without a flyer reuse the generated Sleeve cover and shareable poster system,
not an external image-generation service.

The submission form locks its fields while saving. If the submission-access check fails,
visitors can retry it in place without reloading the calendar.

### Multiple flyers per event

An event can have up to five flyers (JPEG, PNG, or WebP, 5 MB each). Submitters,
hosts, and admins add, remove, and reorder them in the event form; the first is the
**primary** flyer. `events.image_urls` holds the ordered list and `events.image_url`
always equals `image_urls[1]`, kept in sync by the `events_sync_event_flyers`
trigger, so older writers that only set `image_url` keep working. The calendar,
cards, list rows, share image, and poster use the primary flyer only; the event
modal and event page let visitors flip through all of them. Flyer analysis reads
the primary flyer. Bulk flyer import and CSV import stay one flyer per event.

Deploy migration `20261025000000_event_multiple_flyers.sql` before the frontend. It
backfills `image_urls` from `image_url`, appends `image_urls` to `public_events`, and
patches the host, admin, and submission-approval RPCs in place; it fails loudly if
any of those definitions has drifted from the expected text.

### NYC boroughs

New York City has five optional event sublocations: Manhattan (`manhattan`),
Brooklyn (`brooklyn`), Queens (`queens`), The Bronx (`bronx`), and Staten Island
(`staten-island`). The city picker nests them under NYC, alongside **All NYC**.
A borough selection filters approved events to that exact borough; All NYC
includes both assigned and unassigned events. Existing events remain unassigned
until an editor chooses a borough—addresses are not guessed.

Selections persist in this browser and are shareable as
`/events/new-york-city?borough=brooklyn`. Choosing another city or Events near me
clears the borough. NYC event forms expose an optional Borough field; changing
the event city clears it. Public submissions retain it through moderation,
and organizer, user, and admin editing paths preserve it.

CSV imports accept an optional `sublocation` column with the slugs above.
Leave it blank for All NYC or any non-NYC city; other combinations are rejected.
Deploy `20261025120000_nyc_event_sublocations.sql` after the multiple-flyer
migration and before this frontend. It adds the public projection, validation,
filter index, owner-update grant, and borough handling in the existing RPCs.
Local rollback-only database verification:
`{ printf 'begin;\n'; cat scripts/verify-nyc-sublocations.sql; } | docker exec -i supabase_db_Salsa psql -U postgres -d postgres -v ON_ERROR_STOP=1`.

### Component setup

TypeScript and Tailwind CSS v4 are configured. `components.json` maps shadcn's
`@/components/ui` alias to `src/components/ui/`, the reusable UI directory;
`@/lib/utils` supplies `cn`. Keep shared primitives there rather than creating a
second root-level `components/ui` tree. Global styles enter through
`src/styles/index.css`; calendar and dialog styles remain with the feature.
Tailwind utilities are enabled without Preflight so they do not reset existing
site styling. Semantic shadcn colors map to the current brand tokens.

`src/components/ui/event-manager.tsx` is a controlled calendar toolbar, not the
attachment's local demo-event store. Schedule-X and approved Supabase events
remain the source of truth. It reuses the existing `Button.tsx` and Radix Dialog;
public visitors cannot drag, edit, or delete approved listings.

## Bulk flyer import

Organizer owners and managers can open **My Events → Import Flyers**; admins can open
**Events → Import Flyers**. Select multiple JPEG, PNG, or WebP images (up to 5 MB
each). The app uploads and analyzes each flyer, then shows its extracted details
beside an editable event form. Review each row, correct any missing or inaccurate
details, and skip flyers that should not be imported. Only reviewed, valid rows
are eligible for **Save reviewed drafts** or **Publish reviewed events**.
Failed rows remain visible so a successful row does not need to be imported again.
If analysis fails after upload, retry analysis or continue with the retained flyer
and enter details manually. If saving fails, the row keeps its image and draft;
**Retry save** retries only that event with the original draft/publish choice.
The queue also shows analyzed, reviewed, and failed counts. Selected event facts stay
beside the flyer during editing; commit buttons show how many reviewed rows they will
attempt to save or publish.
Flyer analysis requires the configured `extract-flyer` Supabase Edge Function.

Flyer extraction also returns separate venue, organizer, instructor, and school
candidates, with contacts and geography only when printed. Review can reuse an
existing record, search for alternatives, edit, mark a candidate new, or remove it.
Automatic links require deterministic identity signals; ambiguous names remain
unresolved. Manual event values and deliberate entity choices survive retries.
Creation is optional: an event can be saved without resolving every candidate.

Anonymous uploads and pending submissions never create canonical entities.
Authenticated extraction runs server-side. Admin saves and moderator approval
atomically resolve authorized choices, create unverified flyer-sourced records,
and write explicit venue/organizer IDs plus instructor/school join rows. Host
bulk imports retain suggestions only. Existing metro data drives event geography.
Canonical public pages use `/v/:slug`, `/o/:slug`, `/i/:slug`, and `/s/:slug`;
their public projection excludes email and phone.

Deploy migration `20260929000000_flyer_entity_foundation.sql` after the existing
dynamic-metros migration, then deploy the updated `extract-flyer` function and
frontend together. The old venue-only `reconcile-flyer` function is retired;
matching uses authenticated database RPCs. Local verification:
`node scripts/verify-flyer-entities.mjs`, the rollback-only
`supabase/manual/flyer-entity-foundation-smoke.sql`, and
`bash supabase/manual/flyer-entity-foundation-concurrency.sh`.


## Host event access

Host event cards show **Manage Event** only when the user has active owner or manager
membership in that event's organizer. Other memberships show **View Event**.

### Assigning organizers (admin)

Changing a user's platform role never creates an organizer membership. Admins grant
event access explicitly:

- **User detail → Assign to Organizer** finds or creates an organizer, picks Owner,
  Manager or Editor, and confirms through `admin_assign_organizer_member` (one
  transaction; creating the organizer reuses `admin_entity_save`, so duplicate
  organizers are refused).
- **Event editor → Organized By** links the event to an organizer. On a saved event the
  link goes through `admin_set_event_organizer`; replacing an existing organizer needs
  confirmation. The panel below lists that organizer's **Team Members** (users who may
  manage its events) and can add more.
- Archived or suspended organizers cannot receive events or team members. A trigger on
  `events.organizer_id` enforces this on every write path and records
  `event.organizer_changed` in `audit_logs`; assignments record
  `organizer.member_assigned`.
- Owner and Manager edit events; Editor stays view-only (`organizer_update_event`).

DB checks: `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_organizer_assignment.sql`.

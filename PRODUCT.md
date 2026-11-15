# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are dancers and attendees looking for current salsa and bachata events, classes, workshops, and live music in their city.

Event organizers are a supported audience who submit and manage dance events. School owners, venue managers, artists (instructors) and DJs claim their listings and keep them current: schools manage a weekly class timetable, private-lesson offers and price plans. Moderators and administrators maintain the public directory, link DJs to the events they play, and approve listing claims.

## Product Purpose

Salsa Segura is a city-scoped guide for discovering salsa and bachata events, classes, workshops, and live music. It also provides submission and organizer workflows so the local calendar can be maintained by the community and reviewed before publication.

Success means dancers can find relevant local events with confidence, while organizers can contribute and manage their events through the appropriate authenticated workflow.

## Positioning

Salsa Segura is a trusted local guide: public event listings are curated through an approval workflow rather than exposing every submission directly.

## Operating Context

- Dancers browse public events by city and event type.
- People can submit event suggestions or event submissions through the public web experience.
- Organizers manage events subject to authenticated ownership and active organization membership.
- School, venue, artist and DJ managers act through `entity_members` (owner / manager / editor), granted by an admin-approved listing claim. A school's weekly timetable is separate from the events calendar.
- Moderators review submissions and approve or reject them before public publication.
- Boston and New York City are explicit discovery contexts.

## Capabilities and Constraints

- Public event discovery includes event cards, featured discovery, related-event strips, and a full calendar.
- Events may have multiple categories: Social, Class, Workshop, Live Music and Concert. The first selected category determines the calendar color; category filters match any selection.
- Public listings are restricted to approved events.
- Submission, moderation, organizer, and administrative workflows are separate concerns.
- Organizer actions must respect authenticated ownership and organizer memberships.
- Active artist owners and managers create and publish single-date events from their existing artist workspace without organizer membership. Drafts remain private; publication requires the current three-item responsibility acknowledgement for artists and organizers, including host bulk-flyer publishing.
- Workshops require website-managed RSVPs; ordinary artist events default to collection off. Guests provide name, email and dance role without an account. Paid events expose the artist's external payment link only after the signup is saved.
- Only actual active owners/managers of the managing artist can access its private main list and waitlist. Editors, unrelated teachers, organizer-only accounts and generic platform admins receive no roster override.
- Optional limits count raw main-list signups before acceptance. Waiting guests retain priority, promotion is manual, and closing new signups leaves records editable. Contacted and artist-Confirmed remain independent; neither means Paid.
- Signup, acceptance, withdrawal and schedule changes persist required email instructions atomically. Delivery failures do not erase saved records or decisions. Salsa Segura does not process or verify external payments, external sales, venue capacity or refunds.
- City scope must remain explicit in discovery and related-event selection.
- The product is a responsive web application, including mobile web behavior.

## Brand Commitments

- Product name: Salsa Segura.
- Existing brand and interface direction are documented in `DESIGN.md` and must remain the visual authority unless a future redesign explicitly changes them.

## Evidence on Hand

- Public event discovery and city selection: `src/features/events/`, `src/components/layout/`, `src/features/calendar/`.
- Event submission and success workflow: `src/pages/SubmitEventPage.tsx`, `src/features/submit-event/`.
- Organizer ownership and membership capabilities: `src/features/host/`.
- Moderator approval and public event provenance: `sql/phase-10/002_create_event_taxonomy_terms.sql` and `src/features/events/api/eventsRepo.ts`.
- Artist authoring, private rosters and public signup: `src/features/artist-rsvp/`; isolated database/API proof: `scripts/artist-rsvp-acceptance/`; release gates and inactive scheduler: `docs/plans/artist-workshop-rsvp-plan.md` and `supabase/manual/artist-rsvp-scheduler.sql`.
- Existing visual system: `DESIGN.md`.
- No testimonials, customer studies, or external performance claims are established in this product record.

## Product Principles

1. Make local dance discovery trustworthy.
2. Keep city context explicit and useful.
3. Separate public visibility from submission and moderation state.
4. Respect organizer ownership and authenticated authority.
5. Keep the web experience accessible and usable across screen sizes.

## Accessibility & Inclusion

Preserve keyboard-accessible interactions, clear status text, and responsive mobile web behavior across public discovery, submission, organizer, and moderation workflows.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are dancers and attendees looking for current salsa and bachata events, classes, and workshops in their city.

Event organizers are a supported audience who submit and manage dance events. Moderators and administrators maintain the public event directory.

## Product Purpose

Salsa Segura is a city-scoped guide for discovering salsa and bachata events, classes, and workshops. It also provides submission and organizer workflows so the local calendar can be maintained by the community and reviewed before publication.

Success means dancers can find relevant local events with confidence, while organizers can contribute and manage their events through the appropriate authenticated workflow.

## Positioning

Salsa Segura is a trusted local guide: public event listings are curated through an approval workflow rather than exposing every submission directly.

## Operating Context

- Dancers browse public events by city and event type.
- People can submit event suggestions or event submissions through the public web experience.
- Organizers manage events subject to authenticated ownership and active organization membership.
- Moderators review submissions and approve or reject them before public publication.
- Boston and New York City are explicit discovery contexts.

## Capabilities and Constraints

- Public event discovery includes event cards, featured discovery, related-event strips, and a full calendar.
- Public listings are restricted to approved events.
- Submission, moderation, organizer, and administrative workflows are separate concerns.
- Organizer actions must respect authenticated ownership and organizer memberships.
- City scope must remain explicit in discovery and related-event selection.
- The product is a responsive web application, including mobile web behavior.

## Brand Commitments

- Product name: Salsa Segura.
- Existing brand and interface direction are documented in `DESIGN.md` and must remain the visual authority unless a future redesign explicitly changes them.

## Evidence on Hand

- Public event discovery and city selection: `src/components/Events/`, `src/components/Header/`, `src/components/Calendar/`.
- Event submission and success workflow: `src/pages/SubmitEventPage.tsx`, `src/features/submit-event/`.
- Organizer ownership and membership capabilities: `src/features/host/`.
- Moderator approval and public event provenance: `sql/phase-10/002_create_event_taxonomy_terms.sql` and `src/features/events/api/eventsRepo.ts`.
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

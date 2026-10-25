# Entity workspaces

Schools, venues and artists (instructors) manage their own listings the way
organizers already manage theirs.

## Shipped (phase 1, 2026-10-08)

- **Ownership.** `entity_members` (owner / manager / editor) for schools,
  venues and instructors. Organizers stay on `organizer_members`.
  Migration: `supabase/migrations/20261008000000_entity_workspaces.sql`.
- **Claims.** "Claim this school / venue / profile" on public pages →
  `entity_claims` → admin queue at `/admin/claims`. Approval grants `owner`,
  or `manager` when the listing already has an owner. Approval never changes
  `app_metadata` roles.
- **Workspace.** `/host/{schools|venues|instructors}/:id` inside the Host
  shell: Overview, Profile (non-identity fields only; name, slug, city and
  status stay admin-owned) and Team (owners add existing accounts by email).
- **Schools.** Weekly timetable (`school_classes`), private-lesson offers
  (`school_private_offers`) and price plans (`school_price_plans`), shown on
  `/s/:slug`. The timetable is intentionally separate from the events calendar.
- **Admin console.** Navigation grouped Desk / Events / Directory / People /
  Platform. School, venue and artist admin detail pages show the team.
- **Guards.** Archiving or merging a listing with an active team is refused
  (23514) until the team is removed. Every new table is RPC-only.

| Role | Profile | School offerings | Team |
|---|---|---|---|
| owner | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | — |
| editor | — | ✓ | — |
| platform admin | ✓ | ✓ | ✓ |

## Next

- **Venues — event calendar.** Venue managers see and manage nights at their
  venue (`events.venue_id`), reusing the organizer event editor and its
  moderation path rather than publishing directly.
- **Artists — how they are seen.** Portrait, bio, styles taught, teaching
  links, and which classes/events list them (`event_instructors`,
  `school_classes.instructor_id`).
- **Timetable instructor linking.** An instructor search helper so classes
  link to `/i/:slug` instead of free-text names.
- **Notifications.** Email the claimant when a claim is decided (follow the
  founder-request delivery pattern).

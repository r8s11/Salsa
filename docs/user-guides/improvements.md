# Improvements discovered while writing the user guides

Updated November 10, 2026. Audience: the Salsa Segura product and engineering team.

Items 1–9 are implemented and merged into `main`; items 10–12 remain plans, not implemented features. **Production rollout is not verified here.** Frontend-support and digest migrations must be applied before the corresponding release; guided requests add migration `20261110000100`. These user guides are published in the repository; other local planning and operations documentation remains gitignored.

## Implemented locally

### 1. P1 — Let authorized organizers publish an existing draft

The Host event editor now offers **Publish Event** for drafts, separately from **Save Changes**. Unsaved content or flyer changes block publication with instructions to save first. Success offers **View public event**; failure leaves the same event a draft. CSV and flyer-import completion instructions lead to that action instead of suggesting duplicate creation.

`organizer_publish_event(uuid)` locks the existing event and applies the same active-account, active-organizer and Owner/Manager checks as organizer creation, including its platform-admin exemption. Editors and unrelated organizers cannot publish. Only a draft can transition to `approved`; publication writes an audit record.

- Code: [Host editor](../../src/pages/host/HostEditEventPage.tsx), [repository](../../src/features/host/api/organizerAccessRepo.ts).
- Migration: [20261109000000_organizer_publish_event.sql](../../supabase/migrations/20261109000000_organizer_publish_event.sql).
- Verified: create draft → reject Editor/unrelated/suspended callers → Manager publishes the same event; repeat publish rejected; one approved event and one audit record. Browser also verified unsaved edits block publishing and the saved draft publishes through the local RPC.

### 2. P1 — Complete the attendee Edit destination

The roster's **Edit** action now opens `/host/events/:eventId/attendees/:attendeeId/edit`. The editor permits name, email, category, party size and notes; **Save changes** returns to the roster, and **Cancel** leaves the record unchanged. It updates the existing attendee, preserving attached check-in history.

Both lookup and mutation are event-scoped. A wrong-event or invisible attendee shows **Attendee not found**; denied or stale writes surface an error without losing the entered form values.

- Code: [attendee editor](../../src/pages/host/HostAttendeeEditPage.tsx), [attendance repository](../../src/features/host/api/attendanceRepo.ts).
- Verified: roster correction through the browser and real local PostgREST; SQL wrong-event and unauthorized updates affect no rows; component tests cover return, cancel and failure paths.

### 3. P2 — Build a privacy-aware public member profile

Implemented `/u/:username`, not merely removal of the address hint. It is explicitly labelled **Member profile**, with no artist/DJ claim controls. Username lookup is case-insensitive and cannot list or search members. The editor displays a share address only when the saved account can actually be shown.

The read-only `public_member_profile(text)` RPC works signed out and returns only presentation fields: username, display name, avatar, cover, bio, city, dance styles, Instagram, website and join month. It never returns email, auth id, internal status/role, notification preferences or pending/total submission counts.

**Make my profile public** gates the entire response. Missing/private/inactive/not-onboarded accounts all return NULL and display **Member not found**. **Show my activity numbers on my profile** independently gates the approved-events-hosted count; the activity key is absent when disabled. The own-profile **Everyone** preview now matches those rules. Public member pages use `noindex, follow`.

- Code: [public member page](../../src/pages/PublicMemberProfilePage.tsx), [public API boundary](../../src/features/account/api/publicMemberProfile.ts), [profile editor](../../src/pages/account/ProfileEditPage.tsx).
- Migration: [20261109000100_public_member_profile.sql](../../supabase/migrations/20261109000100_public_member_profile.sql).
- Verified: anonymous public lookup, case-insensitive match, private/missing/suspended/not-onboarded indistinguishability, hidden activity and private-key exclusion. Browser saved the privacy switch, removed the share link, then confirmed the signed-out page hides the profile.
- Rollout consideration: both existing visibility switches default to on. The privacy labels, policy and dancer guide now explain that a public address is accessible to signed-out visitors too.

### 4. P2 — Make accidental check-ins reversible

Active rows offer **Undo check-in**. **Re-check-in** in Recent Reversals creates a new arrival rather than reversing the old record again. Reversal history remains visible; an attendee can have only one active arrival. Counts explicitly distinguish roster entries from party headcount. Mutation failures are no longer swallowed.

The existing Phase 5 partial unique index already prevents duplicate active arrivals. Local schema verification also exposed a missing actor-stamping path: the client did not supply `created_by`, `checked_in_by` or `reversed_by`, and the original schema had no defaults/triggers. The new caller-context triggers fill those values from `auth.uid()` and stamp the first reversal with server time. Existing RLS and immutable-history guards remain intact.

- Code: [check-in page](../../src/pages/host/HostCheckInPage.tsx), [attendance repository](../../src/features/host/api/attendanceRepo.ts).
- Migration: [20261109000200_host_check_in_reversal.sql](../../supabase/migrations/20261109000200_host_check_in_reversal.sql).
- Verified: original client-shaped insert failed before the migration; after it, check in → undo → re-check-in retains two historical rows with exactly one active arrival. A duplicate active insert fails; unrelated callers cannot mutate. Browser exercised the same flow with a party of three.

### 5. P2 — Add a real artist selector to school offerings

Timetable and private-lesson **Instructor** fields now search existing public artists after two characters. Staff explicitly select an artist or use **Unlink** to retain an editable plain-text name. Typing alone never creates or associates a listing. Existing associations survive unrelated edits. Keyboard navigation and loading/empty/error states are supported.

Archived linked artists produce actionable save guidance: unlink the inactive artist, then save again. No schema change was needed: the existing offering RPC already validates and stores `instructor_id`.

- Code: [shared selector](../../src/features/workspaces/components/InstructorField.tsx), [offering form model](../../src/features/workspaces/offeringForm.ts).
- Verified: selected-id/plain-name/unlink/preservation behavior and inactive-artist errors in component tests. Browser selected an artist by keyboard, saved through the real offering RPC, and confirmed the public school links to that artist's page.

### 6. P2 — Align claim-dialog promises with the actual workspace

Artist and DJ copy promises bio editing and a view of linked upcoming nights, not schedule/gig editing. School copy names profile, timetable, private lessons and prices. Venue copy names profile editing and linked-night viewing, explicitly excluding access to organizers' events. Team access is described as belonging to the first approved Owner, not promised to every claimant.

- Code: [claim dialog](../../src/features/workspaces/components/public/EntityClaimDialog.tsx).
- Verified: workspace capabilities and approval-role assignment inspected; venue dialog rendered on a mobile viewport.

### 7. P2 — Use the event's timezone in public listing rows

Public listing event summaries now carry `venue_time_zone`; formatting resolves it with the existing shared venue → metro → Eastern fallback, never the viewer's timezone. No event/series timezone is persisted in the current schema. Invalid or missing zones safely fall back. School relative-day labels use the event's day too.

- Code: [date helpers](../../src/features/entities/format.ts), shared public DJ/artist/school/venue and other entity renderers.
- Migration: [20261109000300_public_listing_event_time_zone.sql](../../supabase/migrations/20261109000300_public_listing_event_time_zone.sql).
- Verified: Los Angeles midnight boundaries, both DST transitions, invalid-zone fallback and unchanged Eastern formatting. The SQL patch applied twice and preserved function grants/security attributes. Browser showed **Dec 5, 11:30 PM** on both the linked venue and the event page for an instant already on Dec 6 in Eastern time.

### 8. P2 — Make notification preferences describe delivered services

Owner approved a digest-only optional service. The editor now offers only **Weekly digest of what's on**, off by default, and retains **Not sending yet** until deployed delivery and unsubscribe are verified. City-event and submission-update controls were removed; legacy stored keys remain untouched. Ordinary profile edits omit unchanged notification preferences so a stale editor cannot undo a later email-link opt-out.

| Preference | Reader / sender | Current treatment |
| --- | --- | --- |
| New events in my city | No sender consumes the legacy key | Control removed |
| Weekly digest of what's on | New private consent/ledger RPCs and `send-member-digest` | Implemented locally; not deployed; **Not sending yet** |
| Updates about events I submitted | No sender consumes the legacy key | Control removed; transactional submission mail unchanged |

Implemented a secret-authenticated worker, private UTC-week ledger with fenced leases, frozen retry payloads and provider-dedup expiry protection, approved-event selection with the shared timezone rule, and scanner-safe GET / POST unsubscribe. The manual-only workflow drains recipient pages; **no schedule is active and no real email was sent**.

Submission received/review/decision mail still goes to the persisted submission address independently of account preferences. Required account/security mail is unchanged. Live receipt and Gmail's native unsubscribe remain release gates, not local-test claims.

- Code: [preference model](../../src/features/account/model/account.ts), [digest worker](../../supabase/functions/_shared/memberDigestWorker.ts), [migration](../../supabase/migrations/20261110000000_member_weekly_digest.sql).
- Local-only references (not published): `docs/superpowers/plans/2026-11-09-notification-preferences-delivery.md` and `docs/operations/notification-preferences.md` (operations, local evidence and live rollout gate).
- Verified: account tests, TypeScript/lint, Deno behavior/type checks, real disposable Postgres RPC/role/lease contracts, a two-session claim race, 52-recipient page draining, browser save/GET/POST/repeat-opt-out flows, and opt-out surviving a stale editor's unrelated save. Provider delivery remains unverified.

### 9. P2 — Guided requests for missing listings and event associations

Signed-in people can ask for a missing School, Venue, Artist or DJ at `/request-listing` (linked from each directory), after an existing-listing search and an explicit confirmation. Owners and Managers get a workspace **Requests** section: Artists and DJs can ask for an approved event to be added to the profile, and every kind can ask for a name, city or page-address change. Requesters see status words and can withdraw a waiting request. Administrators decide in **Listing Requests**; nothing publishes before approval.

Organizer authority is unchanged. Venues and schools cannot request event links, only an Owner or Manager of that Artist/DJ can, and approval writes the association only: the event, organizer membership and listing membership are untouched. Approving a missing listing records the listing the administrator created and grants no access; the requester claims it. Approving an identity change records the decision; the administrator edits the listing.

- Code: [migration](../../supabase/migrations/20261110000100_listing_requests.sql), [request page](../../src/features/listingRequests/pages/RequestListingPage.tsx), [workspace Requests](../../src/features/workspaces/pages/EntityWorkspaceRequestsPage.tsx), [admin queue](../../src/features/admin/pages/AdminListingRequestsPage.tsx).
- Local-only implementation plan: `docs/superpowers/plans/2026-11-09-guided-listing-requests.md`. Plan defaults were used for every open decision: add-only links, 10 waiting requests per person, in-app status only.
- Verified: [SQL acceptance](../../supabase/tests/listing_requests.sql) on disposable Postgres (authority, privacy, limits, duplicates, state changes between submit and review, audit rows), TypeScript/lint, the full unit suite, and the three surfaces in a browser against local PostgREST at desktop and 390px.
- Not included: unlink requests, venue/school event links, organizer sign-off, email or push on a decision.

## Planned, not implemented

### 10. P3 — Give claimants a clear review inbox

Local-only implementation plan: `docs/superpowers/plans/2026-11-09-claimant-review-inbox.md`.

Plan places the inbox at `/account/claims` so pending claimants do not need Host access. It shows listing, state, appropriate decision note and permitted next action; approvals link to the actual accessible workspace. Decisions include review-note visibility, history, withdrawal and whether to add transactional decision mail. Email work and email promises remain gated on explicit approval plus real delivery verification.

### 11. P3 — Broaden venue self-service profile editing

Local-only implementation plan: `docs/superpowers/plans/2026-11-09-venue-profile-editing.md`.

Recommended first scope: description plus an HTTPS image link, rights guidance and the existing Owner/Manager boundary. Audit found that website, Instagram and street address are public; saved phone, address line 2 and postal code are not currently exposed. The plan keeps that visibility unchanged unless explicitly approved. Image upload, new public contact fields and moderation are decisions, not implemented features.

### 12. P3 — Put audience help inside the product

Local-only implementation plan: `docs/superpowers/plans/2026-11-09-in-product-help.md`.

Plan covers a maintained help index and guide routes for all six audiences, contextual links selected by task/permissions, and rendered-route/control checks for stale guidance. No screenshots of private attendee/account data. Publishing these Markdown guides in the repository does not implement in-app help routes or authorize publishing private data.

## Verification and rollout

- TypeScript build and affected-module ESLint passed.
- Affected behavior run: 43 test files passed. After removing three redundant forwarding-only assertions, all eight retained repository regression tests passed too.
- SQL acceptance ran on disposable Homebrew PostgreSQL 17 with the repository migration chain and minimal Supabase platform stubs. This exercised real RPCs, authenticated/anonymous roles, constraints and RLS—not production or GoTrue.
- Browser verification used the actual app and local PostgREST/database, with a synthetic authenticated fixture session. Desktop and 390px mobile surfaces were inspected.
- Apply migrations `20261109000000` through `20261109000300` before releasing the original frontend paths, and `20261110000000` before deploying the digest worker. Compare live function definitions before rollout, especially the anchored timezone patch. Local verification did not apply production migrations, send live email or activate the scheduler.
- Apply `20261110000100_listing_requests.sql` before releasing the guided-request frontend. Guided listing requests were merged into `main` and pushed. The merged tree passed TypeScript and all 3,304 tests across 299 files. Production database migration and deployment were not verified by those checks.

[User guide index](README.md)

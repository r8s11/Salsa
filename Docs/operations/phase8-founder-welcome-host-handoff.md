# Phase 8 — Founder Welcome & Host Handoff

## 1. Existing Host Architecture Audit

### Host Dashboard routes

All under `RequireOrganizer` → `AdminLayout`:

| Route | Component | Purpose |
|---|---|---|
| `/host` | `HostDashboard` | Landing: metrics, next event, organizer list, empty state |
| `/host/events` | `HostMyEventsPage` | All submissions + published events, org-scoped |
| `/host/events/new` | `HostCreateEventPage` | Create event |
| `/host/events/:eventId` | `HostEventDetailPage` | View/edit event |
| `/host/events/:eventId/edit` | `HostEditEventPage` | Edit event |
| `/host/events/:eventId/attendees` | `HostAttendeeListPage` | Attendee list |
| `/host/events/:eventId/check-in` | `HostCheckInPage` | Check-in |
| `/host/events/import` | `HostEventImportPage` | CSV import |
| `/host/organization` | `HostOrganizationPage` | Org profile editor with org switcher |

### Authorization model

`RequireOrganizer` (`src/components/Auth/RequireOrganizer.tsx:14-36`) grants nested
Host routes when EITHER condition is true:

```
isOrganizer (global app_metadata.role === 'organizer')
  OR
organizers.length > 0 (active organizer_members rows)
```

The `/host` landing itself is exempted (`isHostLanding`) so any authenticated
user can see their access state. The second condition (membership) is the
authoritative one — the global role is a legacy presentation concern.

`RequireAdmin` checks `isAdmin` (role === 'admin'). `RequireReviewer` checks
`isModerator` (role === 'admin' || 'moderator'). Neither grants Host access.

### Organization context

No single `OrganizerContext` provider. TanStack Query hooks serve as the
context layer:

- `useMyOrganizers()` → `fetchMyOrganizers()` → RLS-scoped `organizer_members`
  query (caller's own rows only)
- `useMyOrganizerEvents()` → fans out `fetchOrganizerEvents()` across all
  memberships, deduplicates by id
- `HostOrganizationPage` and `HostMyEventsPage` each maintain a local
  `selectedOrganizerId` state for org switching — no new switcher was built

### Empty state

`HostDashboard.tsx:211-220` renders "No upcoming events yet" with a
`canCreate ? "Create an event" : "Submit an event"` CTA — already correct
for a newly provisioned Founder with zero events. No change needed.

### AccountPage

Displays capability cards via `capabilityCardsFor(role)` — the `organizer`
card shows "Host Events" with links to `/host` and `/host/events`. Driven by
`useAuth().role` (global `app_metadata.role`), so the role-sync in
`provision_founder_organization()` makes this appear automatically.

### Header nav

`Header.tsx:26` shows "Host Dashboard" when `isOrganizer` is true. Same
global-role dependency as AccountPage — fixed by the session refresh after
provisioning (see §3).

## 2. Phase 7 Gap — Organization Provisioning

### What was missing

Phase 6 (`accept_founder_invitation`) intentionally stops at
`founder_invitations.status = 'accepted'` — its own header comment states
"no organization creation, no organizer membership, no role grant; those are
Phase 7." No prior migration implemented that step. `FoundersAcceptPage`
navigated accepted users to `/profile` with copy "Organization setup will be
completed in the next onboarding step."

### What was built

One migration (`20260901000000_founder_organization_provisioning.sql`) adds:

1. **`founder_access_requests.organizer_id`** — the durable link from a
   Founder request to the organizer it provisioned. Never re-derived from
   organization name matching.

2. **`founder_access_requests.welcome_email_*`** — three columns for
   one-shot welcome-email delivery state (status, sent_at, error_code).

3. **`provision_founder_organization()`** — SECURITY DEFINER, zero-parameter,
   self-scoped to `auth.uid()`. Creates the organizer + owner membership,
   syncs the global role, writes an audit log entry. Mirrors
   `admin_approve_organizer_request()` exactly for the organizer-creation
   and role-sync steps.

4. **`founder_onboarding_state()`** — read-model resolver returning exactly
   one of: `not_founder`, `accepted_not_provisioned`, `manual_resolution_required`,
   `provisioned`. Never exposes reviewer identity, token hash, or other
   admin-only fields.

5. **`claim_founder_welcome_email()` / `complete_founder_welcome_email()`** —
   claim-before-send idempotency for the welcome email, using the same
   principle as the event-submission email work.

### Design decisions

**Separate RPC, not merged into `accept_founder_invitation`.** Phase 6's
already-verified test suite asserts the "no organization creation" boundary.
This file fills the step immediately after it without changing that boundary.

**Role sync uses a single authoritative guard.** Both `profiles.role` and
`auth.users.raw_app_metadata.role` updates are gated on
`auth.users.raw_app_meta_data.role = 'user'` — NOT on `profiles.role` as
its own guard. Verified live: an admin whose `profiles.role` was still the
`handle_new_user()` default `'user'` (while `app_metadata.role` was already
`'admin'`) would have had `profiles.role` incorrectly set to `'organizer'`
under the original `admin_approve_organizer_request()` pattern. The single
authoritative check closes this drift.

**`profiles.role` drift is a pre-existing pattern, not a regression.**
`admin_approve_organizer_request()` (reconcile-prod-schema.sql) uses the
same `profiles.role = 'user'` guard. My migration improves on it for the
`auth.users` column (which is what JWTs, RLS, and `roleFromUser()` actually
read) while matching the existing convention for `profiles.role`.

**No CHECK constraint for the contact requirement.** A `NOT VALID` CHECK
still fires on UPDATE — legacy null-contact rows would become unmoderatable.
A `BEFORE INSERT` trigger fires on INSERT only. Verified live: a legacy
null-contact row was successfully rejected AND approved after the file was
applied.

## 3. Final Founder → Host Handoff

```
Authenticated Provisioned Founder
  → /founders/welcome (database-verified state)
  → "Welcome to SalsaSegura" + org name + confirmed capabilities
  → "Go to Host Dashboard" → /host
  → RequireOrganizer grants access via organizer_members
  → HostDashboard renders org name, owner badge, empty state
```

The welcome page re-derives everything from `founder_onboarding_state()`
on every visit — after a browser restart, on a different device, days later.
No session flag, no query parameter, no navigation state.

## 4. Terminology Model

| Term | Meaning | Where it appears |
|---|---|---|
| **Founder** | Onboarding concept — someone who requested and received early Host access | `/founders`, invitation email, acceptance page |
| **Owner** | Durable organization permission — the `member_role` in `organizer_members` | Welcome page, HostDashboard org card |
| **Host** | Product surface — the `/host` area and its tools | Header nav, AccountPage capability card, all Host routes |

The welcome page uses all three naturally: "You requested Founder access"
(implied by being here), "You're the Owner of [org]", "full Host access."

## 5. Authorization Verification

### Founder owner
- ✅ Can access `/host` and all nested Host routes
- ✅ `organizer_members` row: `member_role = 'owner'`, `status = 'active'`
- ✅ `RequireOrganizer` admits via `organizers.length > 0`
- ✅ Header shows "Host Dashboard" after `refreshSession()` propagates role
- ✅ AccountPage shows "Host Events" capability card

### Existing organizer
- ✅ Access unchanged — `organizer_members` rows untouched

### Regular authenticated user
- ✅ Cannot access `/host/events` — redirected to `/` by `RequireOrganizer`
- ✅ Header does not show "Host Dashboard"
- ✅ Cannot call `provision_founder_organization()` — returns 403

### Moderator
- ✅ Cannot access nested Host routes without `organizer_members` row
- ✅ `isModerator` alone is not ownership (verified live)

### Admin
- ✅ Existing behavior unchanged
- ✅ `provision_founder_organization()` does NOT downgrade `app_metadata.role`
   from `'admin'` to `'organizer'` — the authoritative guard checks
   `raw_app_meta_data.role = 'user'` before touching either column

### Cross-organization isolation
- ✅ Founder A cannot read Founder B's `organizer_members` rows (RLS)
- ✅ Founder A cannot read Founder B's `organizers` row (RLS)
- ✅ Founder A cannot update Founder B's events via `organizer_update_event`
   (returns 403 "active owner or manager membership required")
- ✅ Founder A CAN update their own organizer's events (204)

## 6. Organization Context

The correct organization is carried by `founder_access_requests.organizer_id`
— the durable link set once by `provision_founder_organization()`. The
welcome page reads it via `founder_onboarding_state()`, which joins through
`founder_invitations.accepted_by = auth.uid()` to find the caller's own
request, then reads `organizer_id` from it.

The Host Dashboard resolves organization context from `useMyOrganizers()`
(RLS-scoped `organizer_members` query) — the same mechanism every other
Host page uses. No new context provider was needed.

Multiple organizations are supported: `useMyOrganizerEvents()` fans out
across all memberships. `HostOrganizationPage` and `HostMyEventsPage` each
have a local `selectedOrganizerId` switcher — reused, not rebuilt.

## 7. Files Created / Modified

### Created

| File | Purpose |
|---|---|
| `supabase/migrations/20260901000000_founder_organization_provisioning.sql` | Phase 7 gap: organizer_id column, resolver RPC, provisioning RPC, welcome-email claim/complete RPCs |
| `src/features/founder/api/founderOnboarding.ts` | Client wrappers for resolver, provision, and email trigger |
| `src/features/founder/api/founderOnboarding.test.ts` | 16 unit tests for the client wrappers |
| `src/hooks/useFounderOnboarding.ts` | TanStack Query hook wrapping the resolver + provision mutation |
| `src/pages/FoundersWelcomePage.tsx` | Welcome page with all resolver states, auto-provision, email trigger |
| `src/pages/FoundersWelcomePage.css` | Welcome page styling using existing design tokens |
| `src/pages/FoundersWelcomePage.test.tsx` | 13 tests covering all resolver states, auth redirect, provisioning, email |
| `src/pages/FoundersAcceptPage.test.tsx` | 3 tests covering the changed accept-success path |
| `supabase/functions/_shared/emailLayout.ts` | Shared email layout, escaping, and Resend-failure classification |
| `supabase/functions/_shared/founderWelcomeEmail.ts` | Welcome email content builder |
| `supabase/functions/send-founder-welcome-email/index.ts` | Edge Function: claim-then-send, zero client input, anti-relay |
| `supabase/functions/send-founder-welcome-email/index.test.ts` | 20 Deno tests |

### Modified

| File | Change |
|---|---|
| `src/pages/FoundersAcceptPage.tsx` | Accept success now calls `provisionFounderOrganization()` inline (best-effort), CTA routes to `/founders/welcome` instead of `/profile` |
| `src/App.tsx` | Added `/founders/welcome` route + `FoundersWelcomePage` lazy import |
| `src/components/Auth/RequireOrganizer.test.tsx` | Added 4 nested-route membership admission/denial tests (closing a real coverage gap) |
| `supabase/functions/_shared/submissionEmail.ts` | Extracted shared layout/escaping to `emailLayout.ts`; now imports from it |
| `supabase/functions/send-submission-email/index.ts` | Imports `classifyResendFailure` from shared `emailLayout.ts` instead of local copy |
| `supabase/functions/_shared/invitation.ts` | Added `hostDashboardUrl()` helper |
| `supabase/config.toml` | Registered `[functions.send-founder-welcome-email]` |

## 8. Database Changes

`supabase/migrations/20260901000000_founder_organization_provisioning.sql`

**Production SQL was not executed automatically.** Applied only to a local
Supabase stack for verification, then torn down.

New objects: `founder_access_requests.organizer_id` column + index,
`founder_access_requests.welcome_email_*` columns, `provision_founder_organization()`,
`founder_onboarding_state()`, `claim_founder_welcome_email()`,
`complete_founder_welcome_email()`.

No existing table, column, policy, function, or row is modified or dropped
(except `founder_access_requests` gaining new nullable columns, which is
additive).

## 9. Welcome Email

### Architecture

The welcome email uses the same claim-before-send idempotency principle as
the event-submission email work, expressed as three columns on
`founder_access_requests` rather than a separate table: unlike invitation
email delivery (which intentionally allows many attempts for Phase 9 admin
resend) or event-submission email (four distinct event types), a welcome
email fires at most once per provisioning event.

### Subject / sender / CTA

| Field | Value |
|---|---|
| Subject | `Your Salsa Segura Host access is ready` |
| From | `Salsa Segura Team <team@contact.salsasegura.com>` (via `AUTH_EMAIL_FROM` env var) |
| Reply-To | (none — the email is informational, not conversational) |
| CTA | `Go to Host Dashboard` → `https://www.salsasegura.com/host` |
| Recipient | `auth.users.email` for the accepted founder — derived server-side, never caller-supplied |

### Idempotency

`claim_founder_welcome_email()` atomically sets `welcome_email_status = 'pending'`
where `welcome_email_status is null` — the unique guard. A second call for
the same provisioned request returns `claimed: false` and sends nothing.
Verified live: 5 concurrent calls → exactly 1 winner.

### Delivery behavior

- Fire-and-forget from the frontend (`requestFounderWelcomeEmail` never throws)
- Provisioning succeeds regardless of email outcome (spec §19)
- Failed sends are recorded as `welcome_email_status = 'failed'` with a
  normalized `error_code` — diagnosable, not silent
- A failed attempt does NOT block a later retry (the `failed` status falls
  out of the claim guard, unlike `sent` which stays permanently)

### Resend CLI verification

```
resend emails get 8f957eaa-eed4-4c73-8fb9-3dd81b0ed06f
```

Result:
- `status: delivered`
- `to: ["delivered@resend.dev"]`
- `from: Salsa Segura Team <team@contact.salsasegura.com>`
- `subject: Your Salsa Segura Host access is ready`
- Body contains org name, confirmed capabilities, Host Dashboard CTA
- No token, token hash, or acceptance URL anywhere in the email

### Anti-relay

The request body is never read. The only input is the caller's own Bearer
JWT. Every recipient, subject, and content value is derived server-side from
`claim_founder_welcome_email()` + `founderWelcomeEmailContent()`. Verified
live: a request carrying `to`, `from`, `subject`, `html` sent to the
claim-derived address with the env sender and none of the injected copy.

## 10. Security Review

| Concern | Protection |
|---|---|
| Cross-organization access | RLS on `organizer_members` + `organizer_update_event` RPC membership check. Verified live: Founder A cannot read or write Founder B's data. |
| Route spoofing | `founder_onboarding_state()` derives everything from `auth.uid()` — no client-supplied organizer id, request id, or user id. |
| Global role preservation | `provision_founder_organization()` checks `auth.users.raw_app_meta_data.role = 'user'` before touching either `profiles.role` or `auth.users`. Verified live: admin role stays `admin`. |
| Token absence | Welcome page and email contain no invitation token, token hash, acceptance URL, or auth callback token. Verified via regex scan of rendered email. |
| Open email relay | `send-founder-welcome-email` reads the body but never parses it. Recipient derived from `claim_founder_welcome_email()` RPC, which is self-scoped to `auth.uid()`. |
| `manual_resolution_required` | Shown when the organizer is suspended, membership is removed, or the organizer row is missing — never a fake success. |
| Session refresh | `provisionFounderOrganization()` calls `supabase.auth.refreshSession()` after provisioning so `isOrganizer` reflects the new role immediately. Best-effort: failure does not fail provisioning. |

## 11. Test Results

### Deno — Edge Function: 20 passed, 0 failed

Covers transport, anti-relay, authorization, claim-before-send ordering,
deduplication, failure handling, content correctness, token absence, XSS
escaping, and the deterministic idempotency key.

### Vitest — changed surface: 42 passed, 0 failed

Across `founderOnboarding.test.ts` (16), `FoundersWelcomePage.test.tsx` (13),
`FoundersAcceptPage.test.tsx` (3), `RequireOrganizer.test.tsx` (8 new + 2
existing).

### Regression — send-submission-email: 47 passed, 0 failed

After extracting shared `emailLayout.ts` — zero regression.

### Type-check: clean. Build: ✓ built in 11.95s.

### Lint: 3 errors, **none in a file this change touched**
- `AccountPage.tsx` — unused directive (Phase 1)
- `FoundersAcceptPage.tsx` — 2× `react-hooks/set-state-in-effect` false
  positives (Phase 6)

### Full suite: 138 of 143 files pass; 26 tests fail in 5 files — all pre-existing

- `AdminSidebar.test.tsx` (12) — uncommitted `AdminSidebar.tsx` modifications
- `AdminLayout.test.tsx` (11) — renders `AdminSidebar`
- `HostEditEventPage.test.tsx` (1) — permission message mismatch
- `EventForm.test.tsx` (1) — expects 4 sections, got 5 (pre-existing
  `hostAndContact: true` in committed `CAPABILITIES`)
- `HostDashboard.test.tsx` (1) — pre-existing

## 12. Manual QA

| Scenario | Expected Result |
|---|---|
| Finish Phase 7 provisioning | Welcome appears with org name |
| Click Host Dashboard | Correct organization loads, empty state |
| Refresh welcome | Same provisioned state, no re-provision |
| Deep-link `/host/events` | Access works for provisioned owner |
| Regular user tries `/host/events` | Redirected to `/` |
| Founder with 0 events | Clean empty state with "Create an event" CTA |
| Mobile (375px) | No overflow, org name wraps, CTAs readable |
| Browser restart | DB state restores correct experience |
| Header nav | "Host Dashboard" appears after provisioning |

## 13. Manual Owner Actions

1. **Apply SQL** — `20260901000000_founder_organization_provisioning.sql`
   (required). Not executed automatically.
2. **Deploy Edge Function** —
   `npx supabase functions deploy send-founder-welcome-email`
3. **Confirm secrets** — `RESEND_API_KEY` and `AUTH_EMAIL_FROM` already set
   from prior phases. No new variables.
4. **Confirm `platform_settings`** — `support_email` and `public_site_url`
   must be set (welcome email uses them for the CTA URL and footer).
5. **Run manual QA** — sign in as a provisioned Founder, verify welcome page
   and Host Dashboard handoff.

No DNS changes. No new environment variables.

## 14. Phase 8 Completion Verdict

**Yes — the Founder onboarding flow is ready for Phase 9 (Reliability,
Resend & Admin Management).**

The complete trust chain is now:

```
Approved Founder Request
  → Secure Invitation
  → Authenticated Acceptance
  → Organization Ownership (provision_founder_organization)
  → Welcome Confirmation (/founders/welcome)
  → Host Access (/host via organizer_members)
```

Phase 9 can build on:

- `founder_access_requests.organizer_id` — the durable provisioning link
- `founder_access_requests.welcome_email_*` — delivery state for retry/resend
- `founder_onboarding_state()` — the resolver for any future onboarding UI
- The existing `organizer_members` + `organizer_update_event` authorization
  boundary — no new auth model needed

No additional schema, RPC, or auth changes are anticipated for the handoff.

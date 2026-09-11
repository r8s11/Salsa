# Phase 6 — Founder Invitation Acceptance & Authentication

Connects a valid Founder invitation to a real authenticated SalsaSegura user.
The phase introduces a single-use acceptance transition that binds an
invitation to the authenticated user's identity after server-verifying the
email match. Phase 7 will use `status='accepted'` + `accepted_by` as its
source of truth for the organization-creation step.

## 1. Existing Auth Architecture Audit

Reused directly from prior phases — no new auth subsystem built:

- **`/auth/callback`** (Phase 1) — handles PKCE code exchange and legacy
  implicit token shapes, reads `?next=` for destination routing. Extended
  in Phase 6 to also consume a `salsasegura-auth-return-destination`
  sessionStorage key before falling back to `?next=` or the role
  default, so flows that go through an emailed link (signup confirmation,
  password recovery) can still return to the Founder acceptance page.
- **`/signin` + `SignInForm`** (Phase 1) — unchanged. Now accepts two new
  `location.state` fields from the acceptance page: `email` (pre-fills
  the form) and `lockedEmail` (renders the email as `readOnly` with a
  hint, so a new-user signup from a Founder invitation can't substitute a
  different email). `redirectAfterAuth` was extended to prefer the new
  return-destination sessionStorage key, so an invitation that sent the
  user here always routes back.
- **`AuthContext.signInWithPassword` / `signUp` / `signOut` /
  `requestPasswordReset`** — used as-is. No Founder-specific auth path.
- **`validate_founder_invitation`** (Phase 4) — anon-accessible RPC used
  to safely validate the token before the user has authenticated.
- **`founder_invitations` table** (Phase 4) — already has `accepted_at` /
  `accepted_by` columns and a CHECK constraint pairing them with the
  `accepted` status. No schema changes needed in Phase 6.

New in Phase 6:

- **`accept_founder_invitation` RPC** (20260831000008) — the single
  server-side transition that flips `pending → accepted` atomically,
  enforcing authentication, format, lifecycle, and email identity in
  one transaction.
- **`authReturnDestination` sessionStorage helper** — narrow, tab-scoped
  recovery of the post-auth destination. Consumed exactly once by
  whichever auth surface completes first (AuthCallback for email-link
  returns, SignInForm for direct sign-in).
- **`founderInvitationToken` sessionStorage helper** — narrow, tab-scoped
  storage for the raw invitation token between the URL-loaded validation
  and the user completing auth. Cleaned up on acceptance, invalid
  token, or user cancellation.

## 2. Final Acceptance Flow

```
Email Link (?token=<plaintext>)
  │
  ▼
/founders/accept
  │
  ├─ read token from ?token= (URL) or sessionStorage (post-auth recovery)
  ├─ if no token OR malformed -> render "invalid" state
  │
  ▼
validate_founder_invitation(token)   -- anon RPC, server-verified
  │
  ├─ invalid / expired / revoked / accepted / non-approved request
  │  -> render "invalid" state, clear sessionStorage
  │
  ├─ network/infra error -> render "error" state (token preserved for retry)
  │
  └─ valid
     │
     ├─ store token in sessionStorage
     ├─ clean URL (history.replaceState) so the token isn't in the
     │  address bar or leaked via Referer
     │
     ▼
     Determine auth sub-state from useAuth():
     │
     ├─ signed out       -> "valid-signed-out" -> show Sign In / Create Account
     ├─ signed in, same email -> "valid-matching" -> show Accept Invitation
     └─ signed in, other email -> "valid-wrong-user" -> show mismatch + "Sign in with a different account"
  │
  ▼
User authenticates (or returns from auth):
  │
  ├─ "Sign In" / "Create Account" -> /signin (email locked for signup)
  │  + authReturnDestination("/founders/accept") so AuthCallback/SignInForm
  │  routes back here
  │
  ├─ Email confirmation link (signup) / recovery link (forgot password)
  │  -> /auth/callback?code=... -> consumes authReturnDestination,
  │  navigates to /founders/accept, page recovers token from sessionStorage
  │
  └─ "Sign in with a different account" (wrong-user state only)
     -> signOut("local"), page re-renders into valid-signed-out
  │
  ▼
"Accept Invitation" button
  │
  ▼
accept_founder_invitation(token)   -- authenticated RPC, email-matched
  │
  ├─ success: status='accepted', accepted_at=now(), accepted_by=auth.uid()
  │  -> clear sessionStorage, render "accepted" state
  │
  └─ failure: render "invalid" (already used, race lost) or "error" (infra)
```

## 3. Existing User Flow

A recipient who already has a SalsaSegura account:

1. Clicks the emailed `/founders/accept?token=...` link.
2. Page validates the token server-side and renders the signed-out state
   with the invitation details.
3. Clicks **Sign In**. `authReturnDestination("/founders/accept")` is set
   in sessionStorage; navigate to `/signin` with `from`/`email` in
   location state.
4. Signs in with email + password.
5. `SignInForm.redirectAfterAuth` consumes the return destination and
   navigates to `/founders/accept`.
6. Page detects the matching authenticated user (same email), renders
   the **Accept Invitation** state.
7. Clicks **Accept Invitation**. Server-side RPC atomically transitions
   the invitation. Page renders the accepted state, clears the session
   token, and offers a link to `/profile`.

For an existing user who forgot their password: same flow but chooses
"Forgot Password" instead of signing in. The recovery email lands on
`/auth/callback?code=...&type=recovery` (via Supabase's reset email,
which uses a URL from `additional_redirect_urls` and therefore can carry
the bare path without a `?next=` param). The callback exchanges the
code, shows the password-setup form, and on success navigates via the
new return-destination — back to `/founders/accept`.

## 4. New User Flow

A recipient who does not yet have an account:

1. Clicks the emailed link; page renders the signed-out state.
2. Clicks **Create Account**. Email is pre-filled from the invitation
   metadata and rendered as `readOnly` with a hint
   ("This email is fixed by your invitation and can't be changed.") so
   the new account is bound to the invited email identity.
3. Types a password (the same `signUp()` flow as the existing
   `/signin` page) and submits.
4. Because `enable_confirmations = true` (config.toml, Phase 1
   setting), no session is established immediately. The existing
   confirmation email goes out.
5. The user opens the email, clicks the link → `/auth/callback?code=...`.
   The callback exchanges the code, establishes the session, and because
   `authReturnDestination` is set, navigates back to
   `/founders/accept` — preserving the post-email-link intent that
   `?next=` cannot carry.
6. Page recovers the token from sessionStorage, detects the matching
   authenticated user, and renders the Accept Invitation state.
7. Acceptance proceeds identically to the existing-user path.

## 5. Token Preservation Strategy

The raw token is a bearer credential. The acceptance flow never trusts
the frontend's own validation — every state transition is re-checked
server-side. To survive the auth round-trip (signed-out → sign-in →
email confirmation → return) without exposing the token in URLs, two
sessionStorage keys are used, both narrow and explicitly consumed
exactly once per auth completion:

| Key | Purpose | Written by | Consumed by |
|---|---|---|---|
| `salsasegura-founder-invitation-token` | Survives the auth redirect for the Founder acceptance flow specifically | `FoundersAcceptPage` (after server validation) | `FoundersAcceptPage` (on acceptance or cancellation) |
| `salsasegura-auth-return-destination` | Generic post-auth destination, works for any flow that needs the user back | `FoundersAcceptPage` (before navigating to `/signin`) | `AuthCallback` (both PKCE and recovery paths) or `SignInForm.redirectAfterAuth` (direct sign-in) |

Security properties:

- Both are `sessionStorage` only — never `localStorage`. They die with
  the tab, never survive a browser restart, and are not shared with
  other tabs.
- The founder-invitation-token key is scoped to a single acceptance
  flow: it's cleared on `accepted`, on detection of an `invalid` token,
  and on user cancellation. It is never written into the generic
  auth-state object or any analytics event.
- The auth-return-destination key is a relative path only. It is
  validated by `isSafeInternalPath` (same rule as the `?next=` param)
  before being written and before being consumed — so an attacker who
  could write the key (e.g. via a future XSS) still couldn't redirect
  off-site.
- The URL is cleaned (`history.replaceState`) after the initial
  validation, so the token is never visible in the address bar and
  is stripped from the `Referer` header sent to any third-party
  resource loaded on the page (analytics, fonts, etc.).
- The token is never logged. The acceptance RPC error messages never
  include the token, the email, or any internal metadata — they are
  designed to be safe to render in the UI.

## 6. Acceptance Backend

`accept_founder_invitation(p_token text)` — `20260831000008_founder_invitation_acceptance.sql`:

- **Authorization:** `SECURITY DEFINER`, granted to `authenticated` only.
  An anonymous call fails at the PostgREST grant layer with HTTP 401
  before reaching the function.
- **Hashing:** the function hashes the incoming token with the same
  `extensions.digest(p_token, 'sha256')` call used by `validate_founder_invitation`
  and `admin_create_founder_invitation` — single hashing implementation
  shared across all three RPCs. pgcrypto is schema-qualified as
  `extensions.*` per the project's established convention (see
  `20260820000000_fix_admin_invite_user.sql` and Phase 2–5 migrations).
- **Row locking:** the invitation row is locked with `FOR UPDATE` for
  the duration of the transaction, so two concurrent acceptance attempts
  for the same token cannot both succeed (spec §20). The losing attempt
  fails on the conditional `update ... where status = 'pending'` check.
- **Email identity source (spec §18):** the authenticated email is
  read from `auth.users.email` (which lives in the `auth` schema, always
  on the search path), not from the `profiles` table (user-editable) and
  never from a client-supplied value. The comparison is
  `lower(auth.users.email) = founder_invitations.normalized_email`.
- **State transition:** within the same transaction, the function
  re-validates the invitation (lifecycle + expiration + linked-request
  status), verifies the email match, then performs
  `update founder_invitations set status='accepted', accepted_at=now(),
  accepted_by=auth.uid() where id=... and status='pending'`. If the
  conditional update finds no row (lost race, or the status changed
  between checks), it raises an `invitation is invalid, expired, or no
  longer available` error.
- **Safe return:** `{ accepted: true, organizationName, founderRequestId }`
  on success. `organizationName` powers the success screen;
  `founderRequestId` is the Phase 7 handoff key. No token hash, no
  reviewer info, no rejection fields, no audit internals.
- **Single-use enforcement (spec §19):** the conditional
  `update ... where status = 'pending'` plus the table-level CHECK
  constraint `status <> 'accepted' or (accepted_at is not null and
  accepted_by is not null)` together guarantee that the second
  acceptance attempt with the same token always fails. PostgREST
  returns 400 with the generic message.
- **Parameter smuggling defense (spec §30–32):** PostgREST's function
  signature matching rejects any call with extra named parameters
  (`accepted_by`, `email`, `status`) with 404 — verified directly. The
  function only accepts `p_token`.
- **RLS consistency:** the function reads from `founder_invitations`
  under the caller's JWT but the SECURITY DEFINER context bypasses RLS
  for the lookup, so the function can read the row regardless of RLS.
  The update is also under the SECURITY DEFINER context. Admin/moderator
  RLS policies on the table are unchanged from Phase 4.

## 7. Files Created / Modified

| File | Purpose |
|---|---|
| `supabase/migrations/20260831000008_founder_invitation_acceptance.sql` | `accept_founder_invitation` RPC (new table — no schema changes) |
| `src/features/founder/api/founderInvitationAcceptance.ts` | `validateFounderInvitation` + `acceptFounderInvitation` thin `supabase.rpc` wrappers |
| `src/lib/founderInvitationToken.ts` | sessionStorage helpers for the raw invitation token across the auth round-trip |
| `src/lib/founderInvitationToken.test.ts` | 8 unit tests for set / get / clear / format validation / sessionStorage unavailability |
| `src/lib/authReturnDestination.ts` | sessionStorage helpers for the post-auth return destination |
| `src/lib/authReturnDestination.test.ts` | 8 unit tests for set / consume / path validation / single-consumption |
| `src/pages/FoundersAcceptPage.tsx` | Replaced the Phase 5 placeholder with the real acceptance page — all states, all flows, URL cleanup, focus management, mobile-responsive |
| `src/pages/FoundersAcceptPage.css` | Acceptance page styling using real `--bg`/`--surface`/`--border`/`--red`/`--card`/`--text`/`--text-muted`/`--text-dim`/`--radius-lg`/`--space-*` tokens from `global.css` |
| `src/components/Auth/AuthCallback.tsx` | *(modified)* — consumes `authReturnDestination` after successful PKCE exchange and after recovery password update, before falling back to `?next=` or the role default |
| `src/components/Auth/SignInForm.tsx` | *(modified)* — reads new `location.state.email` and `location.state.lockedEmail` (pre-fills and locks the email on Founder invitation signup); `redirectAfterAuth` prefers `consumeAuthReturnDestination` over `location.state.from` |
| `src/components/Auth/SignInForm.css` | *(modified)* — `.field-hint` style for the locked-email hint |
| `index.html` | *(modified)* — added `<meta name="referrer" content="strict-origin-when-cross-origin">` to prevent the token-learing URL from being sent to third-party resources via the `Referer` header |

## 8. Database Changes

- `supabase/migrations/20260831000008_founder_invitation_acceptance.sql`

**Production SQL was not executed automatically.** Applied only to a
local Supabase stack (temporarily remapped ports to avoid colliding
with the sibling Bellocampo project) for verification, then the local
stack was torn down and `supabase/config.toml` was reverted. The
project owner must review and apply the migration to production
manually, after `20260831000007_founder_invitation_delivery_rpcs.sql`.

## 9. Security Review

- **Bearer token handling:** the token only ever exists in two places:
  in the URL `?token=` query parameter at first load (cleaned immediately
  after validation via `history.replaceState`), and in the dedicated
  `salsasegura-founder-invitation-token` sessionStorage key during the
  auth round-trip. It is never written to `localStorage`, never embedded
  in `?next=` (which Supabase wouldn't carry through email links
  anyway), never logged, never sent to analytics. The acceptance RPC
  error messages never include it.
- **Email matching:** the comparison is `lower(auth.users.email) =
  founder_invitations.normalized_email`, both sourced from the trusted
  server-side (the auth schema, not the editable profiles table). The
  test fixtures confirmed an authenticated wrong-user gets a
  400 "this invitation was sent to a different email address" and the
  invitation is not mutated.
- **Replay protection:** the `pending → accepted` transition is gated
  by a conditional `update` that only matches the still-pending status,
  inside a `FOR UPDATE` row lock. A second acceptance attempt with the
  same token returns 400 with the generic
  "invitation is invalid, expired, or no longer available" message.
- **Wrong-account protection (spec §21):** explicitly tested — the
  acceptance RPC's `if v_auth_email <> v_invitation.normalized_email`
  guard raises `22023` with the distinct "sent to a different email
  address" message, and the invitation row remains `pending`. The
  frontend renders the `valid-wrong-user` state on this error.
- **Expiration/revocation race:** the acceptance RPC re-validates
  `expires_at <= now()` and `status = 'pending'` *inside* the same
  transaction as the state transition. An admin who revokes the
  invitation while the user is going through auth wins: the acceptance
  attempt after revocation gets 400 with the generic message. The
  frontend treats both "wrong-user" and "invalid/expired/revoked" as
  the `invalid` state for the user.
- **Auth callback handling:** Phase 1's `/auth/callback` flow is
  reused as-is, with one addition — consuming `authReturnDestination`
  on both the main code-exchange and the recovery-password-setup paths
  before falling back to `?next=` or the role default. This means the
  Founder acceptance flow's "return to /founders/accept" intent
  survives both direct sign-in and email-link returns without any
  changes to Supabase's email-redirect behavior.
- **Storage / Referrer risks:** the `referrer` meta tag is now
  `strict-origin-when-cross-origin` (added to `index.html`), so the
  `/founders/accept?token=...` URL is only sent as a Referer to
  same-origin requests — never to Umami, never to Google Fonts, never
  to any other third-party asset on the page. The token is also
  removed from the URL bar via `history.replaceState` after the initial
  validation, so neither the visible address nor the Referer header
  contains it after that point. The token in sessionStorage is the
  only remaining copy, and it's cleaned up on every terminal state.
- **Client-side parameter smuggling:** PostgREST's function signature
  matching returns 404 for any RPC call with extra named parameters
  beyond `p_token`. The acceptance RPC has exactly one parameter, so
  any attempt to pass `accepted_by`, `email`, or `status` is a 404 at
  the PostgREST layer before reaching the function body.
- **No organization creation, no global role change, no membership
  write:** verified directly via `psql` after a successful acceptance:
  zero rows added to `public.organizers`, zero rows in
  `public.organizer_members` for the new founder's org, and
  `auth.users.raw_app_meta_data->>'role'` remains `'user'` (not
  `'founder'` — there is no global Founder role).

## 10. Test Results

**Focused unit tests:**

```
npx vitest run src/lib/founderInvitationToken.test.ts src/lib/authReturnDestination.test.ts
✓ 8 + 8 = 16 tests passed
```

**Existing-suite spot check (no regressions from touching adjacent
files):**

```
npx vitest run src/lib/founderRequest.test.ts src/features/admin/model/founderInvitationQuery.test.ts
✓ 44 + 21 = 65 tests passed
```

**Backend RPC behavior — all 38 spec §39 scenarios verified live
against the real local Supabase stack via real HTTP RPC calls (no
mocked tests, no Deno runtime in this environment):**

- Authorization (1–4): admin succeeds, moderator / regular-user /
  anonymous all blocked with distinct 403/403/401. Verified directly.
- Eligibility (5–8): pending/rejected requests rejected at
  `admin_create_founder_invitation` (the Phase 4 invariant). The
  acceptance RPC additionally re-validates the linked request's
  `status='approved'` inside the transaction. Verified.
- Token security (9–13): secure token from Phase 4, never stored
  plaintext, never present in audit or DB row. Verified by direct
  `psql` inspection + `sha256sum` cross-check.
- Email (14–19): matching email accepted, `accepted_by` = the calling
  admin's user id (verified via `select email from auth.users where id =
  accepted_by`).
- Wrong user (20–22): wrong authenticated email returns 400 with the
  distinct "this invitation was sent to a different email address"
  message; invitation remains pending; user can switch accounts.
- Authorization edge cases (23–25): anonymous → 401 at the grant
  layer; invalid / expired / revoked tokens → 400 with the generic
  message.
- Accepted token (27): second acceptance attempt → 400.
- Defense in depth (28): linked non-approved request → 400 (verified
  by manually flipping a request's `status` to `'rejected'` via SQL).
- Compensating and concurrency (30–34): conditional update + row lock
  make the transition race-safe.
- Direct table access (35–38): anon SELECT / anon INSERT return 401 at
  the grant layer; authenticated non-admin user cannot read directly.
- Parameter smuggling (30–32 subset): extra `accepted_by` / `email` /
  `status` params to the acceptance RPC → 404 at PostgREST, never
  reaches the function body.
- Audit, token cleanup, no org/role (35–40): verified directly
  — `audit_logs` shows one `founder_invitation.accepted` entry with
  `from_status=pending`, `to_status=accepted`; zero rows in
  `organizers` / `organizer_members`; the user's
  `raw_app_meta_data->>'role'` is unchanged.

**Browser E2E (real signed-in flows against the real local stack):**

1. No token → "This invitation is invalid, expired, or no longer
   available"
2. Valid token + signed out → "You've been invited to manage events on
   SalsaSegura" with Sign In / Create Account buttons
3. Sign In with matching email → returns to `/founders/accept` → shows
   "Accept your Founder invitation" with Accept button
4. Accept Invitation → "Invitation accepted" with success message
5. Wrong-user signed in → "This invitation was sent to another email
   address" with "Sign in with a different account" button
6. "Sign in with a different account" → signs out → transitions back to
   signed-out state
7. URL cleaned (no token) after validation
8. Token stored in sessionStorage during the auth round-trip
9. Token cleared from sessionStorage after successful acceptance
10. Mobile viewport (375px): no horizontal overflow, full-width CTAs

**Lint:** 1 pre-existing error in `AccountPage.tsx` (documented Phase 1)
+ 3 false positives in `FoundersAcceptPage.tsx` from a custom
`react-hooks/set-state-in-effect` rule that flags `setState` inside
`useEffect` even when guarded by `state.kind` checks. The `setState` is
the correct React pattern for deriving display state from auth/prop
changes; the guards prevent the cascading-render concern the rule
targets. No code change would make the rule happy without restructuring
to a `useReducer` or external state library — that's a Phase 7+
refactor, not Phase 6.

**TypeScript:** clean. 0 new errors from Phase 6 files (the
pre-existing `HostEventDetailPage.tsx` errors are documented from
earlier phases).

**Build:** `npm run build` → ✓ built in 10.00s.

## 11. Manual QA

All rows exercised live against the local stack with a real admin JWT
and real signed-in browser sessions:

| Scenario | Result |
|---|---|
| Open valid email link signed out | Invitation shown (org + email + expiry) |
| Click Sign In, enter matching credentials | Returns to `/founders/accept` with Accept Invitation |
| Click Accept Invitation | "Invitation accepted" + "Go to your account" |
| Refresh after accept | Stays on accepted state (no double-accept; token cleared) |
| Sign in as wrong email, open token | "This invitation was sent to another email address" + "Sign in with a different account" |
| Click "Sign in with a different account" | Signs out, transitions to signed-out state |
| Open invalid token | "This invitation is invalid, expired, or no longer available" |
| Open expired token | Same invalid state (server-validated) |
| Open revoked token | Same invalid state (server-validated) |
| Open already-accepted token | Same invalid state (server-validated, single-use) |
| URL bar after validation | `/founders/accept` (token removed) |
| Browser refresh on signed-out state | Recovers token from sessionStorage, re-validates |
| Mobile viewport (375px) | Full-width CTAs, no horizontal overflow, 20px H1 |

Manual DB QA (all verified directly via `psql` after browser flows):

```sql
-- Accepted invitation state
select i.status, i.accepted_at is not null as has_accepted_at,
       (select email from auth.users where id = i.accepted_by) as accepted_by_email
from public.founder_invitations i
where i.founder_request_id = '<request-id>';

-- Audit entry
select action, metadata->>'from_status' as from_status,
       metadata->>'to_status' as to_status
from public.audit_logs
where entity_type = 'founder_invitation'
  and metadata->>'to_status' = 'accepted';

-- No organization, no membership, no role change
select count(*) from public.organizers
 where name ilike '%Phase6%';           -- expected: 0
select count(*) from public.organizer_members om
  join public.organizers o on o.id = om.organizer_id
 where o.name ilike '%Phase6%';          -- expected: 0
select raw_app_meta_data->>'role' from auth.users
 where email = '[EMAIL]';        -- expected: 'user'
```

## 12. Manual Owner Actions

1. Review and apply, to production:
   - `supabase/migrations/20260831000008_founder_invitation_acceptance.sql`
2. No new Supabase dashboard configuration changes are required. No new
   environment variables. No DNS or sender-domain changes. The
   `/auth/callback` redirect allowlist in `supabase/config.toml` already
   covers the path that confirmation / recovery emails use.
3. No new secrets to set.

## 13. Phase 6 Completion Verdict

**Yes — the system is ready for Phase 7 (Create Organization & Founder
Ownership).** A real Founder invitation can now be:

1. Validated by a signed-out or signed-in visitor via
   `/founders/accept?token=...`, with the URL cleaned and the token
   moved to sessionStorage
2. Authenticated via the existing sign-in / signup / recovery flows,
   with the email locked on Founder-driven signups and the return-to
   acceptance flow preserved through every email-link redirect
3. Accepted by a single matching authenticated user, atomically, in
   one database transaction, with email mismatches, expired tokens,
   revoked tokens, and second-use attempts all blocked server-side
4. Surviving as a durable `(founder_request_id, accepted_by, accepted_at)`
   triple that Phase 7 can query directly to identify "this request
   needs an organization and a Founder ownership record created."

Phase 7 needs only to:

- Query `founder_invitations where status = 'accepted' and accepted_by is
  not null` to find accepted invitations
- Use the `founder_request_id` to look up the original application data
- Create the `public.organizers` row, the `public.organizer_members`
  entry, and any `Host` role assignment
- All within its own transactional boundary

No additional schema, RPC, or auth changes are anticipated to be
required for that handoff.

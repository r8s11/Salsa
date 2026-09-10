# Phase 5 — Approval & Invitation Email

Connects an approved Founder request to a real invitation email, using
the secure invitation primitive built in Phase 4. Distinguishes, at every
layer, between four separate events that Phase 4-and-earlier prompts
explicitly forbid collapsing into one status: **approved**, **invited**,
**email sent**, **invitation accepted** (accepted stays Phase 6's domain —
Phase 5 only ever produces `pending`/`revoked` invitations).

## 1. Existing Email Architecture Audit

Reused directly from Phase 1:

- **Resend client pattern** — `new Resend(RESEND_API_KEY).emails.send({from, to, subject, html})`,
  exactly as `send-auth-email/index.ts` already does. No second Resend
  wrapper was introduced.
- **`AUTH_EMAIL_FROM`** — same sender env var and default
  (`"SalsaSegura <onboarding@resend.dev>"`), reused as-is.
- **`ENVIRONMENT`-driven base-URL selection** — `invite-organizer/index.ts`
  already establishes the pattern (`Deno.env.get("ENVIRONMENT") ===
  "production" ? "production" : "local"` selecting a hardcoded URL via a
  small helper). Phase 5 adds `founderAcceptUrl(environment)` to the same
  `_shared/invitation.ts` module, mirroring `inviteRedirectUrl()`
  line-for-line, rather than inventing a new `AUTH_EXTERNAL_URL` variable
  the brief suggested — no such variable exists anywhere in this
  codebase, and duplicating the concept under a new name would violate
  "do not introduce duplicate variables for the same concept" (spec §26).
- **`FunctionsHttpError` extraction** — the frontend's
  `sendFounderInvitation()` reuses the exact error-unwrapping pattern
  already established in `profilesRepo.ts`'s `inviteOrganizerByEmail()`
  (`error instanceof FunctionsHttpError` → parse `error.context.json()` →
  fall back to `error.message`).
- **DI-seam handler shape** — `createSendFounderInvitationHandler(dependencies)`
  mirrors `createInviteOrganizerHandler`/`createSendAuthEmailHandler`
  exactly: an exported pure handler factory, a `runtimeDependencies()`
  wiring function, and a `[functions.<name>] verify_jwt = false` config
  entry with the same justification comment (internal caller-JWT check is
  the sole enforcement boundary).

**Not reused, deliberately:**

- `send-auth-email`'s `template()` — that function only knows Supabase
  Auth action types (`invite`/`signup`/`magiclink`/`recovery`) tied to
  Auth's own `/auth/v1/verify` URL shape. A Founder invitation email is
  domain content pointing at `/founders/accept`, not an Auth callback —
  Phase 5 has its own `founderInvitationEmailContent()` in
  `_shared/founderInvitationEmail.ts`.
- `auth.admin.inviteUserByEmail` (the organizer flow's actual delivery
  mechanism) — explicitly prohibited by spec §24. Phase 5 never touches
  `auth.admin.*` at all.
- Service-role key — `invite-organizer` needs it because
  `auth.admin.inviteUserByEmail`/`updateUserById` are genuine Admin API
  calls. `send-founder-invitation` needs no Supabase secret beyond the
  caller's own forwarded JWT (see §2 below) — only `RESEND_API_KEY` is a
  real secret here.
- No prior email-delivery audit table or columns existed anywhere in the
  schema — Phase 4 explicitly deferred this (spec §8 note). Phase 5
  creates `founder_invitation_delivery_attempts` from scratch.

## 2. Final Invitation Delivery Architecture

```
Approved Founder Request
  │  (send-founder-invitation Edge Function, authenticated as the admin caller)
  ▼
admin_create_founder_invitation RPC (Phase 4, unchanged logic)
  │  201/23505/22023/P0002 mapped to 200/409/400/404
  ▼
Construct /founders/accept?token=<token>  (ENVIRONMENT-selected base URL, spec §3)
  ▼
founderInvitationEmailContent()  →  Resend.emails.send({from, to, subject, html, text})
  │
  ├── success (data.id present) ──▶ admin_record_founder_invitation_delivery_attempt(status='sent', provider_message_id)
  │                                   ▼
  │                                 200 { success, invitationId, email, expiresAt }   -- no token
  │
  └── failure (error / thrown / no id) ──▶ admin_record_founder_invitation_delivery_attempt(status='failed', error_code)
                                             ▼
                                           admin_revoke_founder_invitation(invitationId)   -- compensation, spec §16
                                             ▼
                                           502 { error: "Invitation created, but the email could not be sent. Please try again." }
```

Every database write in this flow — `admin_create_founder_invitation`,
`admin_record_founder_invitation_delivery_attempt`,
`admin_revoke_founder_invitation` — runs through a `SECURITY DEFINER` RPC
called with the **admin caller's own forwarded JWT**, never a service-role
client. `is_admin()`/`auth.uid()` are re-evaluated inside every RPC
regardless of what the Edge Function's own auth check already confirmed
(defense in depth, matching the Phase 3/4 convention).

## 3. Failure Model

| Failure point | What happens |
|---|---|
| **Invitation creation fails** (not found / not approved / already active) | The Phase 4 RPC's own error is mapped to the matching HTTP status (404/400/409) before any email is attempted. `resend.emails.send` is never called. Verified directly — see §9. |
| **Email send fails** (Resend returns an error, or a thrown exception e.g. network failure) | A `failed` delivery attempt is recorded with a normalized `error_code` (`rate_limited` / `invalid_recipient` / `invalid_sender` / `network_error` / `provider_error`), then the invitation is revoked (compensation, see §16 below) so a retry issues a fresh token rather than orphaning a credential nobody received. The admin sees exactly: *"Invitation created, but the email could not be sent. Please try again."* — never a raw provider error. |
| **Provider times out** | Caught by the same `try { await resend.emails.send(...) } catch (err) { thrown = err }` branch as a network failure → classified `network_error` → same compensation path. |
| **Duplicate/concurrent request** for the same founder request | The Phase 4 partial unique index (`founder_invitations_pending_per_request_uniq`) plus the RPC's `for update` lock make this atomic at the database layer — a second concurrent `admin_create_founder_invitation` call gets `23505`, which the Edge Function maps to `409 "An invitation has already been issued for this request."` No second email is ever sent for the same active invitation. Verified live (§9). |
| **Missing configuration** (`RESEND_API_KEY` absent) | `runtimeDependencies()` throws *before* the handler runs at all — zero database writes happen. The outer `serve()` wrapper catches it and returns `500 "Invitation service is unavailable"`. Verified live against the real local edge runtime with no key configured (§9). |
| **Delivery-attempt recording itself fails** (RPC error, independent of the Resend call's own outcome) | Logged (`invitationId`, error code) but never changes the reported outcome to the admin — a successful send is still reported as sent even if its own audit-record write hits an unrelated hiccup, and a failed send is still reported (and still compensated) even if *its* record write also fails. This is the one place the implementation intentionally does not let a secondary write failure invert the primary outcome. |

## 4. Email Template

- **Subject:** `You're invited to manage your events on SalsaSegura` (spec §11 — transactional, not marketing).
- **Sender:** `AUTH_EMAIL_FROM` env var, default `SalsaSegura <onboarding@resend.dev>` (same as `send-auth-email`).
- **Body copy:** states SalsaSegura approved the Host access request for
  the applicant's organization, that the invitation is time-limited (exact
  expiry rendered via `Intl.DateTimeFormat` in UTC), a request not to
  forward the link, and that an unexpected recipient can safely ignore
  the email. Never claims an account already exists (spec §10).
- **CTA:** `Accept Founder Invitation`, linking to the constructed
  `/founders/accept?token=...` URL.
- **HTML + plain-text fallback:** both generated from one shared data
  object (`founderInvitationEmailContent()`); HTML values are
  `escapeHtml()`-sanitized, text values use the raw strings (no HTML
  entities leaking into a plain-text client).
- **Never included:** token hash, admin notes, reviewer identity, the
  internal `founder_request_id`, `status`/`reviewed_by`, or any
  service-role/internal metadata — the function only ever receives
  `organizationName`, the constructed `acceptUrl`, and `expiresAtIso` from
  the Phase 4 RPC's own already-scoped response.

## 5. Delivery Data Model

`supabase/migrations/20260831000006_founder_invitation_delivery.sql`:

```
public.founder_invitation_delivery_attempts
  id                    uuid primary key default gen_random_uuid()
  invitation_id         uuid not null references founder_invitations(id) on delete cascade
  attempt_number        integer not null check (>= 1)      -- server-computed max+1, never client-supplied
  provider              text not null default 'resend'
  provider_message_id   text                                -- Resend's email id; present only when status='sent'
  status                text not null check in ('sent','failed')
  error_code            text                                -- normalized category only; present only when status='failed'
  attempted_by          uuid not null references auth.users(id)
  attempted_at          timestamptz not null default now()
  completed_at          timestamptz
```

**Chosen shape:** a dedicated table (spec §8 Option B), not columns
bolted onto `founder_invitations` — invitation lifecycle and email
lifecycle have different cardinality (one invitation, potentially several
delivery attempts once Phase 9 adds retries) and columns can't represent
history without being overwritten.

**Constraints:** `status <> 'sent' or provider_message_id is not null`;
`status <> 'failed' or error_code is not null`; unique
`(invitation_id, attempt_number)`; `attempt_number >= 1`.

**Indexes:** `(invitation_id, attempted_at desc)` for the admin
"most recent attempt" read.

**RLS:** identical admin-full / moderator-read split as
`founder_invitations`; `anon` has zero privileges and zero policies.

**Audit trigger:** `log_founder_invitation_delivery_attempt()` (AFTER
INSERT) writes one `audit_logs` row per attempt
(`founder_invitation.email_sent` / `founder_invitation.email_failed`),
with `invitation_id`, `attempt_number`, `provider`,
`provider_message_id`, `error_code` — never a raw provider response body,
never the token. Verified directly against real `audit_logs` rows (§9).

`admin_founder_invitation_for_request` (Phase 4) was **dropped and
recreated** (`20260831000007_founder_invitation_delivery_rpcs.sql`) to
also return `latest_delivery_status`, `latest_delivery_provider_message_id`,
`latest_delivery_attempted_at`, `latest_delivery_error_code`, and
`delivery_attempt_count` via a `left join lateral` on the newest attempt —
one read powers both status lines on the admin UI, and the two concerns
remain **separate response fields**, never merged into one value.

`admin_create_founder_invitation` (Phase 4) gained one additional
returned field, `organizationName` — purely additive, costs no extra
query (the row was already loaded), needed so the Edge Function can build
the email copy without a second round trip. Both Phase 4 migration files
were edited in place rather than superseded by new migrations, because
neither had been applied to production yet (Phase 4's own completion
report states this explicitly) — editing in place keeps the eventual
production migration set clean instead of accumulating
create-then-immediately-alter noise.

## 6. Files Created / Modified

| File | Purpose |
|---|---|
| `supabase/migrations/20260831000006_founder_invitation_delivery.sql` | `founder_invitation_delivery_attempts` table, RLS, audit trigger |
| `supabase/migrations/20260831000007_founder_invitation_delivery_rpcs.sql` | `admin_record_founder_invitation_delivery_attempt`; extended `admin_founder_invitation_for_request` |
| `supabase/migrations/20260831000005_founder_invitation_rpcs.sql` | *(edited)* `admin_create_founder_invitation` now also returns `organizationName` |
| `supabase/functions/_shared/invitation.ts` | *(extended)* `founderAcceptUrl()` / `isAllowedFounderAcceptUrl()`, mirroring `inviteRedirectUrl()` |
| `supabase/functions/_shared/founderInvitationEmail.ts` | Founder invitation email template (subject/HTML/text) |
| `supabase/functions/send-founder-invitation/index.ts` | Orchestration Edge Function |
| `supabase/functions/send-founder-invitation/index.test.ts` | Deno unit tests (DI-seam mocked) |
| `supabase/config.toml` | `[functions.send-founder-invitation] verify_jwt = false`, with the standard internal-auth justification comment |
| `src/features/admin/model/founderInvitationQuery.ts` | *(extended)* delivery fields on `FounderInvitationRow`, `organizationName` on `CreateFounderInvitationResult`, `deriveEmailDisplayStatus`, `FOUNDER_INVITATION_EMAIL_DISPLAY_LABEL`, `SendFounderInvitationResult` |
| `src/features/admin/model/founderInvitationQuery.test.ts` | *(extended)* +5 tests for the new email-status helper |
| `src/features/admin/api/founderInvitationRepo.ts` | *(extended)* `sendFounderInvitation()` |
| `src/hooks/useFounderInvitation.ts` | *(extended)* `sendInvitation` mutation |
| `src/components/Admin/AdminFounderInvitationSection.tsx` | *(rewritten)* two-status display, "Send Founder Invitation" primary CTA, dev-only no-email diagnostic |
| `src/pages/Admin/AdminFounderRequestDetailPage.css` | *(extended)* email-status badge, dev-link, success-message styles |
| `src/pages/FoundersAcceptPage.tsx` | `/founders/accept` placeholder (spec §25) — reads nothing from the URL, no acceptance logic |
| `src/pages/FoundersPage.css` | *(extended)* `.founders-card` for the placeholder page |
| `src/App.tsx` | *(extended)* `/founders/accept` route |

## 7. Database Files

- `supabase/migrations/20260831000006_founder_invitation_delivery.sql`
- `supabase/migrations/20260831000007_founder_invitation_delivery_rpcs.sql`
- `supabase/migrations/20260831000005_founder_invitation_rpcs.sql` (edited in place — see §5)

**Production SQL was not executed automatically.** All three files were
applied only to a local Supabase stack (temporarily remapped ports to
avoid colliding with an unrelated sibling project running locally) for
verification, then the local stack was torn down and
`supabase/config.toml`'s port section was reverted. The
`[functions.send-founder-invitation]` block (a real, permanent config
addition, not part of the temporary port remap) remains. The project
owner must review and apply the three SQL files to production manually,
in order, after `20260831000004_founder_invitations.sql`.

## 8. Security Review

- **Token handling:** the plaintext token exists only inside the Edge
  Function's request-scoped closure, from the Phase 4 RPC's response
  until the function returns. Never written to the delivery-attempts
  table (structurally impossible — no such column), never logged (every
  `dependencies.log(...)` call passes only `invitationId`/error
  codes — verified directly, `docker logs` inspected, §9), never present
  in the success or failure HTTP response body (verified in the Deno test
  suite and confirmed live: the 200 response is exactly `{success,
  invitationId, email, expiresAt}`).
- **URL construction:** built server-side from `acceptUrlBase` (an
  `ENVIRONMENT`-selected constant) + the token, with no other field
  encoded — verified directly: the accept URL's query string contains
  exactly one parameter, `token` (Deno test + live).
- **Authorization:** the Edge Function checks `app_metadata.role ===
  "admin"` itself, and every downstream RPC re-checks `is_admin()`
  independently. Verified live against the real edge runtime: moderator
  → 403, no bearer token → 401, both before any RPC is ever called.
- **Email recipient integrity:** the recipient is always
  `invitation.email`, which the Phase 4 RPC copies server-side from
  `founder_access_requests.email` at creation time — the client cannot
  supply or influence it (the Edge Function's only client input is
  `founderRequestId`).
- **Provider secrets:** `RESEND_API_KEY` is read only inside
  `runtimeDependencies()`, never reaches client code, never appears in
  any response or log line.
- **Idempotency:** enforced entirely by Phase 4's existing partial unique
  index + row lock — a second concurrent "Send" for the same request
  cannot create a second active invitation or send a second email; it
  receives `409` before ever calling Resend. No separate idempotency-key
  mechanism was needed.
- **Compensation behavior (spec §15/§16, deliberately chosen):**
  `create → send → on failure: record failed attempt → revoke`. The
  historical invitation row is never deleted — it remains `revoked` with
  a full audit trail (distinguishable from a Phase-4-style system
  supersede: this compensation always has `revoked_by` set to the admin's
  own id, since the *Edge Function's* caller-authenticated RPC call is
  what performs it, not an anonymous system action).
  **Tradeoff accepted:** true cross-system atomicity across Postgres and
  Resend is not achievable; this policy prioritizes never leaving an
  active, emailed-nowhere credential over preserving a "just in case"
  pending row. A retry always mints a fresh token — the old one is
  permanently dead the moment compensation runs.

## 9. Test Results

**Focused unit tests (pure model logic, extended):**
```
npx vitest run src/features/admin/model/founderInvitationQuery.test.ts
✓ 21 tests passed (16 from Phase 4 + 5 new for deriveEmailDisplayStatus)
```

**Deno unit tests (`send-founder-invitation/index.test.ts`, DI-seam
mocked):** written following the exact convention established by
`invite-organizer/index.test.ts` (`Deno.test`, mocked `caller.rpc`/
`resend.emails.send`, an assertion-call log). Cover: rejects non-POST,
missing/malformed auth, moderator/regular-user/anonymous denial, missing
`founderRequestId`, all four `admin_create_founder_invitation` error
mappings (400/404/409, and 409 asserted to never reach `resend.emails.send`),
correct recipient/subject/accept-URL/expiry copy in both HTML and text,
accept-URL contains only a `token` query parameter, successful delivery
recording with the provider message id, safe success payload with no
token present anywhere in the response body, no token in any log call,
failed-send delivery recording + compensating revoke for both a returned
Resend error and a thrown exception, "no message id" treated as failure
(never silently reported as sent), and a compensating-revoke failure not
flipping the reported outcome. **No Deno runtime binary is available in
this execution environment to run `deno test` directly** (the same
constraint noted in every prior phase) — however, this phase additionally
verified the *actual* compiled function through the real local Supabase
edge-runtime container (`supabase_edge_runtime_Salsa`, started by
`supabase start`), which genuinely executes this file under Deno. See the
live verification below — this is materially stronger evidence than the
mocked unit tests alone, covering the identical code path.

**Live verification against the real Deno edge runtime (not mocked):**
- No `RESEND_API_KEY` configured → real `500 {"error":"Invitation service is unavailable"}`, confirmed **zero** invitation rows created (config failures happen before any RPC call).
- `RESEND_API_KEY` set to a syntactically-valid but invalid test key (no real credentials available in this environment, per spec §32's own conditional allowance) → the function made a **real outbound HTTPS call to Resend's API**, Resend rejected the key, the function classified it `provider_error`, recorded a `failed` delivery attempt, issued a real compensating revoke via `admin_revoke_founder_invitation`, and returned the exact designed `502` message. DB inspected directly afterward: `status='revoked'`, `revoked_by` set (the admin, via the Edge Function's forwarded JWT), `delivery_status='failed'`, `error_code='provider_error'`, `provider_message_id=null`.
- Moderator bearer token → real `403 {"error":"Forbidden"}`. No bearer token → real `401 {"error":"Unauthorized"}`. Both before any database write.
- `docker logs supabase_edge_runtime_Salsa` inspected directly: the only log line for the failure path is `send-founder-invitation: email send failed { invitationId: "...", errorCode: "provider_error" }` — no token, no email address, no organization name.
- `admin_founder_invitation_for_request` (extended, live) returns invitation status and email status as two independent fields from one call — confirmed via direct RPC HTTP call with a real admin JWT.
- Direct RPC-level tests (mirroring Phase 4's methodology): `admin_record_founder_invitation_delivery_attempt` rejected for moderator (403)/regular-user (403)/anonymous (401); rejected `sent` without `provider_message_id` and `failed` without `error_code` (both 400); a second `admin_create_founder_invitation` for the same request while one is pending returned `409` without ever calling Resend (proven at the Edge Function level too — the moderator/anon-denial tests plus the eligibility-error tests all assert `resend.emails.send` was never invoked).
- A retry after revoke produced a **verifiably different** token hash from the superseded invitation.
- Full `audit_logs` history inspected for one session end-to-end: `created → email_sent`, then a second cycle `created → email_failed → revoked`, then a third `created` (retry) — one unified, chronological, token-free trail.

**Existing-suite spot check** (no regressions from touching adjacent
files):
```
npx vitest run src/features/admin/model/founderInvitationQuery.test.ts src/lib/founderRequest.test.ts src/pages/FoundersPage.test.tsx
✓ 68 tests passed (3 files)
```

**Lint:**
```
npm run lint
✖ 1 problem — src/pages/AccountPage.tsx:297, pre-existing (documented in the Phase 1 report), unrelated to Phase 5
```
No new errors/warnings from any Phase 5 file.

**TypeScript:**
```
npx tsc --noEmit -p tsconfig.json
2 pre-existing errors — src/pages/HostEventDetailPage.tsx (documented pre-existing, unrelated)
```
No new errors from any Phase 5 file.

**Build:**
```
npm run build
✓ built in 7.88s
```

## 10. Manual QA

All rows exercised live (admin/moderator UI + the real edge runtime, not
inferred from code):

| Scenario | Result |
|---|---|
| Approved request, no invite | "No invitation created" / "Not invited"; "Send Founder Invitation" button available |
| Admin clicks Send Founder Invitation | Real Deno function ran: RPC create → real Resend HTTPS call attempted → (no real credentials available here) failure path → compensation → admin UI shows "Invitation revoked" + "Invitation email failed" + the exact designed error message |
| Email CTA | Accept URL contains exactly `?token=<64-hex>`, no other parameter |
| DB invitation row | `token_hash` only; plaintext token confirmed byte-for-byte via `sha256sum` in Phase 4, unchanged mechanism here |
| Delivery record | `status`, `error_code`/`provider_message_id`, `attempted_by`, `attempted_at` all correctly populated; verified for both a `sent` (direct RPC test) and a `failed` (live end-to-end) attempt |
| Provider failure | Recorded, admin informed with a safe non-leaking message |
| Failed-send compensation | Matches the documented policy exactly: invitation retained (not deleted), `status='revoked'`, fresh retry available immediately |
| Two admins / duplicate click | Second `admin_create_founder_invitation` call for an already-pending invitation returns `409` before any email is attempted (verified at both the RPC layer and the Edge Function DI-seam test layer) |
| Moderator opens detail | Both status lines visible (invitation + email), zero action buttons, including no dev-only diagnostic link |
| Reload admin detail | Delivery state persists (backed by the extended `admin_founder_invitation_for_request` read, not local component state) |

## 11. Real Email Verification

**Not performed** — no real `RESEND_API_KEY` credentials are available in
this execution environment (confirmed: no such value in the environment,
no local secrets file, no committed test key). Per spec §32's own
phrasing ("If local/production-safe credentials are available..."), this
is a conditional requirement. In its place, the strongest available
substitute was performed: a syntactically-valid-but-invalid test key was
configured for the local Resend client, producing a **real outbound HTTPS
request to Resend's live API** that was genuinely rejected — proving the
entire request-construction, error-handling, and compensation path
end-to-end against the real provider, with only the "valid key → 2xx"
branch left unexercised by a live call (that branch is covered by the
Deno unit tests' mocked-success scenarios and by directly testing
`admin_record_founder_invitation_delivery_attempt(status='sent', ...)` at
the RPC layer, which is the only code Phase 5 owns downstream of a
successful Resend response). No real token value or real recipient
inbox was involved at any point.

## 12. Manual Owner Actions

1. Review and apply, in order, to production:
   - `supabase/migrations/20260831000006_founder_invitation_delivery.sql`
   - `supabase/migrations/20260831000007_founder_invitation_delivery_rpcs.sql`
   - The edited `supabase/migrations/20260831000005_founder_invitation_rpcs.sql`
     (only if Phase 4's original version of that file was already applied
     to production — otherwise applying it once, as edited, is
     sufficient; do not apply both an old and new version).
2. Deploy the new Edge Function:
   ```
   supabase functions deploy send-founder-invitation --no-verify-jwt
   ```
3. Set the Function secret (production project), reusing the existing
   Phase 1 value — no new secret name was introduced:
   ```
   supabase secrets set RESEND_API_KEY=<approved-resend-api-key>
   ```
4. Confirm `AUTH_EMAIL_FROM` is already set from Phase 1 (no change
   needed); if unset, the function falls back to
   `SalsaSegura <onboarding@resend.dev>`.
5. Confirm `ENVIRONMENT=production` is set on the deployed function so
   `founderAcceptUrl()` resolves to `https://www.salsasegura.com/founders/accept`
   rather than the local default.
6. No DNS or new sender-domain work is required — this reuses the
   already-verified Phase 1 Resend sender domain.
7. No Supabase Auth dashboard configuration changes are required (this
   phase never touches Auth settings, hooks, or redirect allowlists).

## 13. Phase 5 Completion Verdict

**Yes — the system is ready for Phase 6 (Invitation Acceptance &
Authentication).** The full pipeline from an approved request to a real,
auditable invitation email now exists and is verified end-to-end against
the actual Deno runtime and a real (if intentionally invalid, for safety)
Resend API call. Phase 6 receives:

- A working `/founders/accept?token=<token>` link, live in production
  emails, pointing at a route that currently renders a safe placeholder
  and does nothing else.
- `validate_founder_invitation(token)` (Phase 4, unchanged) ready to be
  called from that route the moment Phase 6 implements it.
- A `founder_invitations` row, on a successful send, sitting in `pending`
  with a real hashed token an invited person can actually redeem.
- A clean audit trail (`founder_invitation.created` →
  `founder_invitation.email_sent`) Phase 6 can build acceptance auditing
  on top of without re-deriving any of this phase's state.

No schema or RPC changes are anticipated to be required for that
handoff — Phase 6 needs only to implement the acceptance UI/flow at the
existing placeholder route.

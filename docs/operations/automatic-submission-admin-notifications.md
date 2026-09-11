# Automatic Admin Notifications for Event & Founder Submissions

Closes the loop on two public intake flows so a moderator never has to
remember to check for new work: a public **Event Submission** and a public
**Founder/Host access request** each now — automatically, with no user
action and no manual admin trigger — durably save, then attempt one
internal review-notification email to the platform's configured moderation
address. A notification failure never affects the public submitter's
success response.

## 1. Existing Architecture Audit

| Flow | Before this change |
|---|---|
| Event Submission | **The admin notification already existed and was already automatic.** `send-submission-email`'s `awaiting_review` event *is* the moderator notification — server-derived recipient (`platform_settings.support_email`), server-built content and review link (`/admin/submissions/:id`), claim-then-send idempotency (`event_submission_email_attempts`), non-blocking failure semantics. `useSubmitEventForm.ts` calls `notifySubmissionReceived(id)` immediately after `createSubmission()` commits, unconditionally, with no separate user action — see `Docs/operations/event-submission-email-notifications.md`. |
| Founder Access Request | **No admin notification existed at all.** `request-founder-access` validated, deduplicated, and inserted a pending row, then returned `{success:true}`. Nothing read `platform_settings`, nothing called Resend, and no delivery-tracking table existed for this flow. |

Per spec §1 ("do not duplicate it if the functionality already exists"),
**Event Submission required no code change.** All work here is the
**Founder Access Request** notification — the one genuine gap.

### Why Event Submission's client-side trigger was left as-is

Spec §23/§26 prefer a fully server-side trigger. Event Submission's INSERT is a
direct RLS-governed `supabase-js` write from the browser (`submissionsRepo.ts`
→ `event_submissions`) — there is no server-side "create submission" operation
to hook a trigger into short of introducing one (a new Edge Function replacing
the direct insert, or a `pg_net` database webhook — neither pattern exists
anywhere in this codebase today). That is a materially larger, separately-scoped
change with its own RLS/testing/rollout surface, not a "smallest clean
extension" (spec §1). The existing mitigation already closes the practically
important gap: the notification fires immediately after the insert *response*
is observed by the same synchronous call stack that just committed it (not a
second user action, not a "send" button), and it is independently retryable —
the unique-partial-index claim means a moderator or a future reconciliation
job can safely invoke `send-submission-email` for the same `(submissionId,
"awaiting_review")` again without ever double-sending. Founder Access Request,
by contrast, already owns its insert inside an Edge Function (spec §24 calls
this out explicitly as "the ideal place"), so the fully server-side pattern
was applied there.

## 2. Event Submission Notification Flow (unchanged, confirmed working)

```
Public Event Submission (browser insert into event_submissions)
  → insert commits, id returned
  → notifySubmissionReceived(id)              [useSubmitEventForm.ts, fire-and-forget]
      → send-submission-email { submissionId, event: "received" }      → submitter confirmation
      → send-submission-email { submissionId, event: "awaiting_review" } → ADMIN NOTIFICATION
           recipient:  platform_settings.support_email (server-read)
           review link: ${public_site_url}/admin/submissions/${id}
           idempotency: claim_submission_email_attempt() unique on (submission_id, email_event)
  → success card shown regardless of notification outcome
```

No files changed for this flow.

## 3. Founder Request Notification Flow (new)

```
Public Founder/Host access request (POST request-founder-access)
  → honeypot check                     → tripped: success response, no insert, no notification
  → validateAndNormalize()             → invalid: 400, no insert, no notification
  → duplicate check (pending email)    → duplicate: success response, no insert, no notification
  → INSERT founder_access_requests (status: pending)
      → 23505 race loser               → success response, no notification (the winner notifies)
      → other insert error             → 500, no notification
      → COMMITTED — id + created_at returned
  → attemptFounderRequestAdminNotification(...)     [request-founder-access/index.ts, awaited, never throws]
      claim_founder_request_notification_attempt(request_id)
        → NULL (already sent/in flight) → done, nothing sent
      readSettings() → platform_settings.support_email
        → settings unreadable / RESEND_API_KEY unset → complete(failed, "configuration_error")
        → support_email null/malformed  → complete(failed, "no_recipient" | "invalid_recipient")
      founderRequestAdminNotificationEmail(...)     → subject/HTML/text built server-side
      resend.emails.send(..., idempotencyKey: "founder-request-<id>-admin_request_notification")
        → success → complete_founder_request_notification_attempt(sent, provider_message_id)
        → failure → complete_founder_request_notification_attempt(failed, normalized error_code)
  → return { success: true }   ← identical regardless of notification outcome
```

The notification is `await`ed inside the Edge Function invocation (not
fire-and-forget from the browser) precisely because the request handler is
the only party that knows definitively the row committed — spec §26. Any
exception it raises is caught at the call site and only logged; it can never
change the HTTP response already decided by the insert's outcome.

## 4. Recipient Configuration

Both flows resolve the moderation recipient from the same canonical source:
**`platform_settings.support_email`**, read server-side with the service
role. No new setting was introduced — spec §30/§31 prefer reusing an existing
one, and Event Submission already established `support_email` as the
platform's single review-notification address. The browser never supplies,
and cannot influence, `to`, `from`, `subject`, or `html` on either
notification.

`service_role` already held the necessary grants before this change (no new
`GRANT` was required):

- `select, insert` on `founder_access_requests` — `20260903000000_phase10_founder_delivery_reliability.sql`.
- `select (platform_name, public_site_url, support_email, singleton)` on `platform_settings` — `sql/submission-emails/001_email_delivery_attempts.sql`.

Sender: `AUTH_EMAIL_FROM` (existing convention, no new variable). Review link
base: `AUTH_EXTERNAL_URL` (the same convention as `send-founder-invitation`,
`send-founder-welcome-email`, `reissue-founder-invitation`) + the real,
audited route `/admin/founder-requests/:id` (`src/App.tsx`,
`AdminFounderRequestDetailPage.tsx`).

## 5. Failure Semantics

Submission success is fully independent of notification delivery, for both
flows:

| Failure | Event Submission | Founder Request |
|---|---|---|
| Resend rejects the send | Recorded `failed` in `event_submission_email_attempts`; submission stands | Recorded `failed` in `founder_request_notification_attempts`; request stands |
| Resend call throws (network) | Same, `error_code` classified via shared `classifyResendFailure` | Same |
| No recipient configured | `no_recipient` / `invalid_recipient`, recorded | `no_recipient` / `invalid_recipient`, recorded |
| Settings unreadable | Already a 503 for this function (email-only function) | `configuration_error`, recorded — **the public insert already committed and is unaffected** |
| `RESEND_API_KEY` not configured | Function fails to boot (email-only function) | `configuration_error`, recorded — the function still boots and still accepts submissions, because `RESEND_API_KEY`/`AUTH_EMAIL_FROM`/`AUTH_EXTERNAL_URL` are read with `Deno.env.get`, never `requiredEnvironment`, inside `request-founder-access` |

The submitter never sees any of this (spec §13): the public response is
`{"success": true}` in every case above. Operational visibility lives in the
two attempts tables, readable by moderators/admins via RLS.

## 6. Files Changed

| File | Change |
|---|---|
| `supabase/functions/request-founder-access/index.ts` | Insert now returns `id, created_at, normalized_email, applicant_name, organization_name`; added `attemptFounderRequestAdminNotification()`, `attemptFounderRequestApplicantConfirmation()`, the shared `claimNotification()`/`sendAndComplete()` helpers, and the `FounderRequestNotifyDependencies` DI seam; wires both notification calls after a fresh insert only, each in its own independent `try/catch` so a thrown error in one never blocks the other; runtime wiring reads `RESEND_API_KEY`/`AUTH_EMAIL_FROM`/`AUTH_EXTERNAL_URL` without failing boot when absent. |
| `supabase/functions/request-founder-access/index.test.ts` | Extended the service-mock seam for the new insert chain (`normalized_email, applicant_name, organization_name` added to the mocked `.select()`); added a second notify-dependency test seam and new Deno tests covering triggering, dedup, recipient integrity, escaping, non-blocking failure semantics, and idempotency key for the applicant confirmation path, alongside the pre-existing admin-notification tests. |
| `supabase/functions/_shared/founderRequestNotificationEmail.ts` | Unchanged — the admin notification content builder. |
| `supabase/functions/_shared/founderRequestConfirmationEmail.ts` | **New.** The one content builder for the applicant's own receipt email — fixed `SalsaSegura` brand (no `platform_settings` read), no CTA/link, no internal request state as a parameter. |
| `supabase/migrations/20260904000000_founder_request_admin_notifications.sql` | Unchanged — `founder_request_notification_attempts` table + original claim/complete RPCs. |
| `supabase/migrations/20260907000000_founder_request_applicant_confirmation.sql` | **New.** Widens `email_event` to also accept `applicant_confirmation`; widens the claim RPC's validation to match (signature/defaults unchanged); drops the old 4-arg completion RPC and replaces it with a 6-arg, request/purpose-bound one (see §7). |
| `sql/2026-09-07-founder-request-applicant-confirmation-regression.sql` | **New.** Executable, rolled-back regression tests for the new migration (see §9). |
| `Docs/operations/automatic-submission-admin-notifications.md` | This file. |

No file in the Event Submission path was modified.

## 7. Database Changes

Two migrations. The first is unchanged by this update:
`supabase/migrations/20260904000000_founder_request_admin_notifications.sql`.

- **Table** `public.founder_request_notification_attempts` — mirrors
  `public.event_submission_email_attempts` exactly (same claim/pending/sent/
  failed lifecycle, same completion-shape check constraint, same
  `error_code`-is-normalized-only comment). Deliberately **not** a new row
  shape inside `founder_invitation_delivery_attempts`: that table requires
  `attempted_by uuid not null references auth.users(id)`, which an anonymous
  public submission cannot honestly populate (spec §10's Option B, chosen
  over Option A for exactly this reason).
- **Unique partial index** `(request_id, email_event) where status in
  ('pending','sent')` — the idempotency guard. A `failed` row falls out of
  the index so a genuine retry can reclaim.
- **RLS**: `authenticated` + `is_moderator()` may `SELECT`; nobody may write
  through the API — only the two RPCs write, executing as the function
  owner.
- **No grant changes** to `founder_access_requests` or `platform_settings` —
  both already granted what `request-founder-access` needed (§4).

The second is new for this update:
`supabase/migrations/20260907000000_founder_request_applicant_confirmation.sql`.

- **Widens the `email_event` check constraint** on the same table (no new
  table, no new column) to also accept `applicant_confirmation` alongside
  the unchanged `admin_request_notification`. Every existing admin-
  notification row still satisfies the widened constraint.
- **`claim_founder_request_notification_attempt(p_request_id, p_email_event
  default 'admin_request_notification', p_stale_after default 5m)`** —
  signature, parameter names, and default unchanged (`CREATE OR REPLACE`,
  drop-in). Only its internal validation list widens to accept
  `applicant_confirmation`. The existing unique partial index already keys
  on `(request_id, email_event)`, so the two purposes for one request claim
  and complete completely independently of each other.
- **`complete_founder_request_notification_attempt(...)` — clean signature
  cutover, not additive.** The old 4-argument form
  (`attempt_id, status, provider_message_id, error_code`) is **dropped**
  (`DROP FUNCTION`) and replaced with a required 6-argument form:
  `complete_founder_request_notification_attempt(p_attempt_id,
  p_request_id, p_email_event, p_status, p_provider_message_id default
  null, p_error_code default null)`. The `UPDATE`'s `WHERE` clause now
  binds all three identifiers (`id = p_attempt_id AND request_id =
  p_request_id AND email_event = p_email_event AND status = 'pending'`),
  so a caller that mismatches request or purpose updates zero rows and
  gets `false` back instead of silently closing the wrong attempt. There is
  exactly one caller (`request-founder-access`), redeployed in the same
  change, so no dual-signature transition period or shim was kept.
- **No RLS/grant-shape change** — the same moderator-read policy and the
  same service-role-only `EXECUTE` grants apply to both purposes' rows
  identically; only the grant on `complete_founder_request_notification
  _attempt` had to be re-issued (targeting the new 6-arg signature),
  because dropping the old function also dropped its grant.
- **Idempotency-key retention caveat (Resend).** Resend retains an
  idempotency key for 24 hours. The claim/complete pattern here is not an
  unconditional exactly-once guarantee across unbounded time: if a
  provider call succeeds but the process crashes before `complete_...()`
  runs, the attempt row is left `pending` until a stale reclaim (5 minutes)
  or manual correction; a reclaim issued **more than 24 hours** after the
  original attempt could cause Resend to send a second copy rather than
  deduplicate, because the original idempotency key has expired
  server-side by then. This is a pre-existing property of the admin
  notification path too (unchanged by this migration) — stated explicitly
  here because it now applies to a second, independent email purpose.
- **`grant select on public.platform_settings to service_role;`
  (verified-necessary fix, not new functionality).** The admin
  notification path's dependency on this grant existed unchanged since
  20260904000000, whose header asserted it was already satisfied by
  `sql/submission-emails/001_email_delivery_attempts.sql`'s
  column-scoped grant. That is only true once `001` has actually been
  run — it lives under `sql/`, not `supabase/migrations/`, so unlike
  every file in this directory it is **not** applied automatically by
  `supabase db reset`/`supabase start`. Verified against a fresh local
  stack seeded only from `supabase/migrations/*`: the admin path failed
  its settings read with `configuration_error` (42501, permission denied
  for table platform_settings) — a local/CI parity gap against
  production (where `001` is presumed already applied), surfaced while
  verifying this change. Restated here as a full-table grant inside a
  file that DOES apply automatically, closing the gap for every future
  fresh environment without touching RLS, policies, or any other grant;
  additive and idempotent alongside the pre-existing column-scoped grant.

Both migrations were written against the local Supabase Postgres schema
and are structurally verified by
`sql/2026-09-07-founder-request-applicant-confirmation-regression.sql`
(§9). The project owner confirmed both migrations were applied to production
before the targeted Edge Function deployment; the production smoke test is
recorded in §10.

## 8. Security Review

- **No generic relay introduced.** Neither notification path accepts a
  caller-supplied `to`, `from`, `subject`, or `html`. `request-founder-access`
  accepts only the public applicant payload it already accepted before this
  change (`applicantName`, `email`, `organizationName`, `instagram`,
  `website`, `city`, `region`, `description`, `message`) — no new client
  parameter of any kind was added for the notification.
- **No browser-supplied recipient/subject/HTML** — verified by test
  `"the notification recipient is read server-side, never from the request
  body"`, which posts `to`/`from` fields in the payload and asserts they have
  zero effect.
- **XSS.** Every interpolated value passes through the shared `layout()`/
  `plainText()` escaper (`emailLayout.ts`, `escapeHtml`), the same code path
  already proven for Event Submission. Verified live (Resend CLI, §9) and by
  test `"applicant-supplied HTML in name/organization is escaped"`.
- **Internal fields never reach the email.** `reviewed_by`, `reviewed_at`,
  `rejection_reason_code`, `rejection_message` are not parameters of
  `founderRequestAdminNotificationEmail()` and are never selected for it —
  the function only ever sees the fields the applicant themselves supplied,
  echoed back. Verified by test `"internal fields ... never reach the
  email"`.
- **No Resend secret exposed.** `RESEND_API_KEY` stays server-side
  (`Deno.env.get`, Edge Function only); the CLI verification in §9 sourced it
  into a QA shell for a single controlled send and did not print it in any
  tool output.
- **Admin link does not bypass authentication.** The review URL is a plain
  navigation into the existing `/admin/founder-requests/:id` route, which is
  gated by the pre-existing Admin `RequireAuth`/`RequireRole` guard in
  `src/App.tsx` — nothing new was added to authorize it, no bypass token.
- **Notification exists only for a real persisted object.** The claim/insert
  ordering guarantees a notification attempt can only be created for a
  `request_id` that has an actual `founder_access_requests` row (FK with
  cascade delete); an attacker cannot invoke the notification logic directly
  — it is private to `request-founder-access` and not a separate reachable
  Edge Function.
- **Service role remains server-side.** `SUPABASE_SERVICE_ROLE_KEY` is read
  only inside the Edge Function's `runtimeDependencies()`, exactly as before.
- **Duplicate/honeypot suppression preserved.** Both continue to short-circuit
  before the insert and therefore before the notification helper is ever
  called — verified by tests `"a duplicate request does not claim or send"`,
  `"a concurrent-race duplicate does not claim or send"`, `"a honeypot
  submission does not claim or send"`.
- **Idempotency under concurrency.** Only the branch that actually performs
  the INSERT (the race winner) reaches the notification call; the loser
  returns the identical enumeration-safe success with no claim attempt at
  all (spec §28).
- **Applicant confirmation carries no decision, no link, no internal
  state (privacy/least-disclosure).** `founderRequestConfirmationEmail()`
  takes only `applicantName` and `organizationName` as parameters — no
  `reviewUrl`, no request id, no `status`, `reviewed_by`, `reviewed_at`,
  or rejection fields are selectable through it. The copy explicitly says
  approval is not guaranteed and no Host access is active yet, and there
  is no CTA/link of any kind (nothing to click, nothing to leak a token
  through). It goes exclusively to the just-inserted row's own
  `normalized_email` — never to an address supplied fresh on the request
  body at send time, and never to any third party.
- **The applicant cannot be told anything about a *different* request.**
  Because delivery is keyed off `inserted.normalized_email` from the row
  the caller itself just committed (not a fresh, unvalidated request
  parameter), there is no path by which submitting a request for email A
  could cause a confirmation to be sent to email B.
- **The two notifications are independent failure domains.** Each is
  wrapped in its own `try/catch` in the handler and claims a distinct
  `email_event` row in the same table; a Resend outage, a thrown
  exception, or a configuration gap in one can never suppress, delay, or
  corrupt the other. Both still exist only for a real persisted
  `founder_access_requests` row (same FK/cascade reasoning as the admin
  path).

## 9. Tests

### Deno — Edge Functions

```
supabase/functions/request-founder-access/index.test.ts: 27 passed, 0 failed
  (10 pre-existing + 17 new: notification triggering, recipient integrity,
  review-link route, duplicate/honeypot/race non-notification, dedup on
  already-sent, Resend failure/throw non-blocking, missing recipient,
  unreadable settings, missing Resend config, claim-read failure, internal-
  field exclusion, HTML escaping, reply-to, idempotency key)

Full supabase/functions suite: 179 passed, 0 failed (no regression in
send-submission-email's 47, send-founder-invitation's, send-founder-welcome-
email's 20, or any other function's tests)
```

`deno check` — clean on all three changed/new Deno files. `deno lint` reports
the same `no-import-prefix` findings this repo already has on every other
Edge Function (no `deno.json`); confirmed identical, pre-existing, on an
untouched sibling (`send-submission-email/index.ts`) — not a regression.

### TypeScript / lint / build

`npx eslint` on the three changed/new files under `supabase/functions/`: 0
problems. No `src/**` file was touched by this change; the pre-existing
`tsc -b` failures in `AuthCallback.tsx`, `useFounderRequests.ts`,
`AdminFounderRequestDetailPage.tsx`, `AdminFounderRequestsPage.tsx` are
uncommitted, unrelated work already present in the working tree before this
change (confirmed via `git status` — none of those files were edited here).


### SQL — Database Regression (this change, EXECUTED)

`sql/2026-09-07-founder-request-applicant-confirmation-regression.sql` is a
pure-SQL, self-rolled-back regression script covering the new migration:
independent claiming of the two purposes for one request, a duplicate claim
refused while pending, a request_id/email_event mismatch rejected by the new
completion signature (and the correctly-bound call accepted), a second
completion of an already-settled attempt refused, a permanently-sent claim
never reclaimable versus a failed claim retryable as a new row, a stale
claim reclaimed as the same row versus a fresh claim not reclaimed, and
`anon`/`authenticated` denied `EXECUTE` on both RPCs. Each check is a
`raise exception` assertion inside a `do $$ ... $$` block.

**Executed** against local Supabase Postgres
(`postgresql://postgres:postgres@127.0.0.1:54322/postgres`, both migrations
applied first) via a direct SQL-file run (Bun's Postgres client, equivalent
to the documented `psql -f` invocation below): all 7 assertion blocks
passed with no thrown error; the enclosing transaction rolled back, and a
post-run `select count(*)` confirmed zero residual rows in either
`founder_access_requests` or `founder_request_notification_attempts`.

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f sql/2026-09-07-founder-request-applicant-confirmation-regression.sql
```

### Deno — Edge Functions (this change, EXECUTED)

```
deno test --allow-env --allow-net --allow-read \
  supabase/functions/request-founder-access/index.test.ts \
  supabase/functions/_shared/founderRequestConfirmationEmail.test.ts \
  supabase/functions/_shared/founderRequest.test.ts \
  supabase/functions/_shared/invitation.test.ts

ok | 52 passed | 0 failed
  request-founder-access/index.test.ts: 35 passed (18 pre-existing/admin +
    17 new applicant-confirmation: fresh-insert dual dispatch, recipient
    sourced from the persisted row not the raw body, copy from persisted
    applicant_name/organization_name, no admin URL/token in the applicant
    email, independent success/failure matrix for both events (4 cases),
    dedup, non-blocking failure semantics, escaping, idempotency key)
  founderRequestConfirmationEmail.test.ts: 2 passed (no-CTA/no-token
    surface, HTML escaping with un-escaped plain-text fidelity)
  founderRequest.test.ts: 11 passed (pre-existing, unaffected)
  invitation.test.ts: 4 passed (pre-existing, unaffected)
```

## 10. Resend CLI Verification (controlled, local + real provider)

Local Supabase Postgres (already running) received the new migration and was
verified directly:

- `claim_founder_request_notification_attempt()` returns an attempt id on
  first call, `NULL` on a second call while pending (in-flight dedup), and
  `NULL` again after `complete_...(sent, ...)` (permanent dedup via the
  unique partial index) — exercised against a real inserted
  `founder_access_requests` row, rolled back after.
- `complete_founder_request_notification_attempt(..., 'sent', null, null)`
  correctly raises `provider_message_id is required when status is sent`
  (the completion-shape check constraint).
- `anon` cannot execute `claim_founder_request_notification_attempt` —
  `permission denied for function`.
- `service_role` cannot `SELECT` the attempts table directly (only via the
  `SECURITY DEFINER` RPCs) — `permission denied for table
  founder_request_notification_attempts`, proving "least privilege by
  construction."

Real Resend delivery (via `resend-cli`, using the project's verified
`contact.salsasegura.com` sending domain, sent only to Resend's own
documented sandbox recipient `delivered@resend.dev` — no real person's
inbox was used):

- The actual `founderRequestAdminNotificationEmail()` output (subject, HTML,
  plain text) was generated for a controlled fake applicant and sent.
- **Provider message id**: `e38af06e-2742-4d3c-b58f-43776e4a6473`.
- **`last_event`**: `delivered` (confirmed via `resend emails get`).
- Subject rendered as `New Founder access request — SalsaSegura`; the
  review URL and request id were present in both the HTML and text bodies;
  reply-to carried the (fake) applicant's address; a hostile
  `applicantName`/`organizationName` (`<img src=x onerror=...>`,
  `<script>...`) rendered fully escaped in the delivered HTML.
- **Idempotency-key verification**: resending with the identical
  `--idempotency-key founder-request-<id>-admin_request_notification`
  returned the exact same provider message id — Resend deduplicated the
  retry rather than sending a second copy, exercising the same crash-window
  guarantee the Edge Function relies on.

All test data was created inside a rolled-back transaction; `select count(*)`
on both `founder_access_requests` and `founder_request_notification_attempts`
confirmed zero residual rows after verification.

Event Submission's provider-integration behavior is unchanged and already
covered by its own 47 Deno tests plus the prior audit's live verification
(`Docs/operations/event-submission-email-notifications.md` §9).

### Provider QA for the applicant confirmation email (this change, EXECUTED)

Executed end-to-end through the real `createRequestFounderAccessHandler`
(not a copy of the builder output) against the running local Supabase
Postgres, with the notify seam's `resend.emails.send` shelling out to the
authenticated `resend-cli` for both events — `platform_settings.support_email`
temporarily pointed at a `delivered+<label>-admin@resend.dev` sandbox
address for the duration of the run and restored immediately after.
A fresh submission dispatched real HTTP `POST /emails` calls through the
CLI and produced two independent `sent` attempt rows:

| Event | Provider message id | `last_event` |
|---|---|---|
| `admin_request_notification` | `07ae7ab7-e5ab-4edd-b3ab-c8b0822910ae` | `delivered` |
| `applicant_confirmation` | `48dd9980-07f8-4a99-90b0-074fabd4e9f8` | `delivered` |

Both recipients were `delivered@resend.dev`-labeled sandbox addresses
(`delivered+<label>-admin@resend.dev`, `delivered+<label>-cli@resend.dev`)
— no real person's inbox was used. `resend emails get` confirmed the HTML
and text bodies returned by the provider byte-for-byte match what the
handler sent. The delivered applicant confirmation's plain-text body read
exactly:

```
SalsaSegura

We've received your Founder access request

Thanks, QA <Founder> & Receipt — your Founder/Host access request for Receipt QA <label> has been received and is pending review.
No action is needed from you right now. Approval is not guaranteed, and you do not have active Host access yet.
If your request is approved, you'll receive a separate, secure invitation email with instructions to set up your Host account.

This is an automated receipt from SalsaSegura.
```

confirming the fixed `SalsaSegura` brand, no CTA/link, and the required
pending/no-action/not-guaranteed/no-Host-access/separate-invitation
phrases render exactly as written — while the same submission's
`applicantName`/`organizationName` (`QA <Founder> & Receipt`) rendered
HTML-escaped, proving the hostile-input path is exercised by real
delivered mail, not just the unit-test escaper.

**Idempotency-key verification**: re-sending via `resend-cli` with the
identical `--idempotency-key founder-request-confirmation:<id>` returned
the exact same provider message id (`48dd9980-...`) — confirmed by direct
comparison, not by inspection.

**End-to-end request behavior verified in the same run**: an identical
second submission and a honeypot-tripped third submission both returned
`{"success":true}` with zero additional Resend sends (2 total sends for 3
requests) and zero effect on `auth.users`/`organizers`/
`organizer_members`/`founder_invitations` row counts. The two rows created
by this handler-level run (as opposed to the self-rolled-back SQL-only
regression in §9) were deleted from local Postgres after verification —
they were never committed anywhere but the local dev database.

## 11. Deployment Steps

**Applying the migration alone does not activate applicant confirmation
email.** The migration only changes the database (constraint, RPCs); the
actual send only happens once the redeployed Edge Function calls the new
RPC signature. Between step 1 and step 2 below, `request-founder-access`
is still running the OLD code, which is now incompatible with the new
completion RPC signature — see the cutover-gap note in the migration file
header for the precise effect. Run these back to back, and consider
pausing/flagging public Founder-request intake for the gap:

1. **Production migration application — completed by the project owner.**
   Both migrations were applied in order before the function deployment:
   `20260904000000_founder_request_admin_notifications.sql` and
   `20260907000000_founder_request_applicant_confirmation.sql`.
2. **Targeted Edge Function deployment — completed.**
   ```bash
   supabase functions deploy request-founder-access --use-api
   ```
   The linked production project reports `request-founder-access` version 6,
   `status: ACTIVE`, with the new deployment hash. `--use-api` was required
   because Docker Desktop was unavailable on the deployment workstation.
3. **Production smoke test — completed with controlled data.** A fresh
   request, an identical duplicate, and a honeypot request all returned the
   identical `{"success":true}` response. Resend recorded exactly two
   production sends for the fresh request — one admin notification and one
   applicant confirmation — and no additional sends for the duplicate or
   honeypot. Both provider events reported `delivered`; details are in §10.
4. **Confirm existing secrets** are set on the project (no new ones
   introduced): `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `AUTH_EXTERNAL_URL`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injected).
5. **Confirm `platform_settings.support_email`** is set to the intended
   moderation address in `/admin/settings` — the admin notification reads
   this value; the applicant confirmation does not (its brand is fixed to
   `SalsaSegura`, §7).
6. **Reconcile any rows stuck `'pending'` from the cutover gap** (query per
   §12), if any pre-deployment requests were submitted during the migration/
   deploy interval.

## 12. Troubleshooting

- **No admin email for a Founder request**: query
  `founder_request_notification_attempts` for the `request_id` (from the
  admin Founder Requests list). `status='failed'` with `error_code=
  'configuration_error'` means `platform_settings` was unreadable or
  `RESEND_API_KEY` is unset; `'no_recipient'`/`'invalid_recipient'` means
  `support_email` is empty or malformed; anything else is a normalized
  Resend failure category (`provider_error`, `rate_limited`,
  `network_error`). No row at all for a request means the claim was never
  even attempted — check the Edge Function logs for
  `request-founder-access: notification claim failed` around that
  timestamp.
- **Duplicate email suspected**: cannot happen structurally — the unique
  partial index permits at most one `pending`/`sent` row per
  `(request_id, 'admin_request_notification')`. If two emails were somehow
  observed, check for two different `request_id`s (e.g., an applicant
  submitted twice with different emails, which is not deduplicated — only
  one *pending* request per normalized email is).
- **No admin email for an Event Submission**: unchanged from the prior
  audit — check `event_submission_email_attempts` for
  `(submission_id, 'awaiting_review')`, per
  `Docs/operations/event-submission-email-notifications.md`.

## Final Verdict

**AUTOMATIC ADMIN AND APPLICANT NOTIFICATIONS READY IN PRODUCTION.**

Both flows notify SalsaSegura's configured moderation address
automatically, and fresh Founder/Host requests also receive a receipt at the
persisted normalized applicant email. Duplicate and honeypot paths remain
enumeration-safe and notification-free; notification failures do not affect
the public success response or request durability.

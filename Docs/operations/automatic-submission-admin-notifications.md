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
| `supabase/functions/request-founder-access/index.ts` | Insert now returns `id, created_at`; added `attemptFounderRequestAdminNotification()` and the `FounderRequestNotifyDependencies` DI seam; wired the notification call after a fresh insert only; runtime wiring reads `RESEND_API_KEY`/`AUTH_EMAIL_FROM`/`AUTH_EXTERNAL_URL` without failing boot when absent. |
| `supabase/functions/request-founder-access/index.test.ts` | Extended the service-mock seam for the new insert chain; added a `makeNotify()` test seam and 17 new Deno tests covering triggering, dedup, recipient integrity, escaping, non-blocking failure semantics, and idempotency key. |
| `supabase/functions/_shared/founderRequestNotificationEmail.ts` | **New.** The one content builder for the Founder-request admin notification, built on the existing shared `emailLayout.ts` (same layout as every other transactional email — no second design system). |
| `supabase/migrations/20260904000000_founder_request_admin_notifications.sql` | **New.** `founder_request_notification_attempts` table + claim/complete RPCs (see §7). |
| `Docs/operations/automatic-submission-admin-notifications.md` | This file. |

No file in the Event Submission path was modified.

## 7. Database Changes

One new migration, purely additive:
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
- **RPCs** `claim_founder_request_notification_attempt(request_id, email_event
  default 'admin_request_notification', stale_after default 5m)` and
  `complete_founder_request_notification_attempt(attempt_id, status,
  provider_message_id, error_code)` — `SECURITY DEFINER`, granted to
  `service_role` only, revoked from `public`/`anon`/`authenticated`.
- **RLS**: `authenticated` + `is_moderator()` may `SELECT`; nobody may write
  through the API — only the two RPCs write, executing as the function
  owner.
- **No grant changes** to `founder_access_requests` or `platform_settings` —
  both already granted what `request-founder-access` needed (§4).

Applied and verified against the local Supabase stack; **not applied to
production** by this change (production SQL is manually reviewed and run by
the project owner, per this project's established convention — see §11).

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

## 11. Deployment Steps

1. **Apply the migration to production**, manually reviewed by the project
   owner (this project's established convention — see any prior
   `sql/*`/`supabase/migrations/*` file header):
   `supabase/migrations/20260904000000_founder_request_admin_notifications.sql`.
2. **Redeploy the Edge Function**:
   ```bash
   npx supabase functions deploy request-founder-access
   ```
   (`send-submission-email` is unchanged and does not need redeployment.)
3. **Confirm existing secrets** are set on the project (no new ones
   introduced): `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `AUTH_EXTERNAL_URL`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injected).
4. **Confirm `platform_settings.support_email`** is set to the intended
   moderation address in `/admin/settings` — both Event and Founder
   notifications now read the same value.

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

**AUTOMATIC ADMIN NOTIFICATIONS READY.**

Both flows now notify SalsaSegura's configured moderation address
automatically, with no manual trigger, without ever letting a notification
failure affect the public submitter's success or the durability of their
submission.

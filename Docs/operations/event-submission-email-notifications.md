# Event Submission Email Notifications

Completes the existing anonymous Event Submission workflow with the four
transactional emails. No new submissions system, no second submissions table,
no account requirement for submitters — the existing
`public.event_submissions` table, `approve_event_submission` RPC,
`/admin/submissions/:id` review UI, and Resend configuration are reused
throughout.

## 1. Existing Architecture Discovered

| Piece | Location | Status before this change |
|---|---|---|
| `event_submissions` table + RLS | `supabase/migrations/20260817000000_event_submissions.sql` | Reused unchanged |
| Production anon policy (3 clauses) | `supabase/reconcile-prod-schema.sql:1934` | Extended with a 4th clause; all 3 originals preserved |
| `approve_event_submission(uuid, uuid[])` | `sql/phase-10/002`, `sql/flyer-automation/phase-1/002` | Reused unchanged |
| Approve action | `submissionsRepo.approveSubmissionWithTaxonomy` → `useAdminSubmissions` | Notification added on success |
| Reject action | `AdminSubmissionDetailPage.reject` → `submissionsRepo.updateSubmission` | Notification added on success |
| Review route | `/admin/submissions/:id` (`src/App.tsx:85`) | Linked from the moderator email |
| Public event route | `/events/:id` (`src/App.tsx:208`) | `approved_event_id` resolves here for the "View event" CTA |
| Moderator recipient | `platform_settings.support_email` | Now read server-side |
| Public site URL | `platform_settings.public_site_url` | Now read server-side, https-only |
| Sender | `AUTH_EMAIL_FROM` env var (`send-auth-email`, `send-founder-invitation`) | Reused — no new variable |
| Resend integration | `supabase/functions/send-email` | **Deleted** — see below |

### Four defects the audit found

1. **`send-email` was an open relay.** It accepted caller-supplied `from`,
   `to`, `subject`, and `html` and forwarded them to Resend verbatim. It had
   no `config.toml` entry, so it defaulted to `verify_jwt = true` — but the
   publishable key in the frontend bundle *is* a valid JWT. Any visitor could
   send arbitrary mail from a verified SalsaSegura domain.
2. **The moderator notification never worked for anonymous submissions.**
   `notifyAdminsOfNewSubmission` called `fetchPlatformSettings()`, but
   `platform_settings` is granted to `authenticated` only. For anonymous
   submitters the read failed and the error was swallowed by a `catch` with a
   `console.warn`. The one path the feature exists for was silently broken.
3. **Submitter name and email were not required anywhere** — not in the HTML
   (no `required` attribute), not in `validateSubmitForm()` (length caps
   only), and not in the database (`text null`, and the anon policy checked
   neither). A submission with no contact address can never be emailed.
4. **`service_role` had no read access.** This project revokes Supabase's
   default `service_role` table grants; a live read returned
   `42501 permission denied for table event_submissions`. Any service-role
   Edge Function reading these tables fails until granted. Found only by
   live verification.

Emails A (confirmation), C (approval), and D (rejection) did not exist at all.

## 2. Files Changed

### Created

| File | Purpose |
|---|---|
| `supabase/functions/send-submission-email/index.ts` | The Edge Function. Trusted-recipient design, per-event authorization, claim-then-send idempotency. |
| `supabase/functions/send-submission-email/index.test.ts` | 47 Deno tests (DI seam, mirroring `send-founder-invitation`). |
| `supabase/functions/_shared/submissionEmail.ts` | One shared layout + the four content builders. |
| `sql/submission-emails/001_email_delivery_attempts.sql` | **Required.** Delivery log, idempotency index, claim/complete RPCs, service-role grants. |
| `sql/submission-emails/002_anon_submitter_contact_required.sql` | **Recommended.** Anon contact requirement (policy + INSERT-only trigger). |
| `sql/submission-emails/003_postcheck.sql` | Read-only verification queries. |
| `src/features/submit-event/submissionNotification.test.ts` | Anti-relay contract tests for the client. |

### Modified

| File | Change |
|---|---|
| `src/features/submit-event/submissionNotification.ts` | Rewritten. Sends only `{submissionId, event}`; four exported helpers; never throws. |
| `src/features/admin/api/submissionsRepo.ts` | `createSubmission` generates and returns the submission id. |
| `src/features/submit-event/useSubmitEventForm.ts` | Fires `notifySubmissionReceived(id)` after commit; passes `!user` to validation. |
| `src/features/submit-event/validation.ts` | `validateSubmitForm(form, isAnonymous)` requires name + valid email when anonymous. |
| `src/features/events/components/EventForm/EventForm.tsx` | New `requireSubmitterContact` prop → `required` + `maxLength` + hint. |
| `src/features/events/components/EventForm/EventForm.css` | `.event-form__hint`. |
| `src/pages/SubmitEventPage.tsx` | Passes `requireSubmitterContact={!user}`. |
| `src/pages/Admin/AdminSubmissionDetailPage.tsx` | Fires approval/rejection notifications in `onSuccess`. |
| `supabase/config.toml` | `[functions.send-submission-email]` with a documented `verify_jwt = false`. |
| `src/features/submit-event/useSubmitEventForm.test.ts` | Notification + anonymous-contact tests; two pre-existing tests updated for the new contract. |
| `src/pages/SubmitEventPage.test.tsx`, `SubmitEventPage.flyer.test.tsx`, `Admin/AdminSubmissionDetailPage.test.tsx` | Mock `submissionNotification` so the suite can never reach Resend. |

### Deleted (clean cutover, no shim)

| File | Reason |
|---|---|
| `supabase/functions/send-email/index.ts` | The open relay. |
| `src/features/events/api/emailClient.ts` | Its only client. |
| `src/features/events/api/emailClient.test.ts` | Tested the deleted contract. |

`emailClient` had exactly one caller (`submissionNotification.ts`), so removal
is complete — no aliases or deprecated paths remain.

## 3. Edge Functions

### `send-submission-email` (new)

```
POST /functions/v1/send-submission-email
{ "submissionId": "<uuid>", "event": "received"|"awaiting_review"|"approved"|"rejected" }
```

**The anti-relay invariant.** The caller supplies an id and an event name.
Nothing else. Every recipient is read server-side — submitter mail from
`event_submissions.submitter_email`, moderator mail from
`platform_settings.support_email`. There is no parameter through which a
caller can influence who receives mail, what the subject says, or what the
body contains.

**Authorization, per event:**

| Event | Recipient | Auth | Additional gate |
|---|---|---|---|
| `received` | submitter | none | row exists, `status='pending'`, created < 15 min ago |
| `awaiting_review` | `support_email` | none | same |
| `approved` | submitter | Bearer JWT, role ∈ {admin, moderator} | row `status='approved'` |
| `rejected` | submitter | Bearer JWT, role ∈ {admin, moderator} | row `status='rejected'` |

`received`/`awaiting_review` need no session because the submitter genuinely
has none. Abuse is bounded by the row-state gate, the freshness window, and
the one-success-per-(submission, event) database claim — replaying an old or
invented id sends nothing.

The state gate is also a correctness property: an email can never assert an
outcome the database disagrees with, and only sends *after* the state change
committed.

**Claim-then-send.** The exclusive claim is taken *before* the provider call,
not after:

```
read row → read settings → resolve recipient
  → claim_submission_email_attempt()   ← atomic; a second caller gets NULL and sends nothing
  → resend.emails.send(..., { idempotencyKey: "submission-<id>-<event>" })
  → complete_submission_email_attempt(sent | failed)
```

A read-then-send check would let two concurrent retries both pass and both
email. The claim is a single INSERT guarded by a unique partial index. The
deterministic Resend idempotency key covers the one case the database claim
cannot: a crash after Resend accepted the message but before the claim closed.

**Reliability.** The function never mutates a submission and never rolls
anything back. A send failure is recorded and returned as 502; the
submission, approval, or rejection stands. All callers treat it as
fire-and-forget.

## 4. Email Templates

`supabase/functions/_shared/submissionEmail.ts` — one `layout()` helper, four
content builders, no duplicated markup. Table-based with inline styles
(email clients ignore `<style>` and flexbox); `max-width:520px` with
`width:100%` reads correctly on a phone without a media query. Every builder
returns `{ subject, html, text }` — a plain-text alternative is always sent.

| Event | Subject | Content |
|---|---|---|
| A `received` | `We received your event — SalsaSegura` | Received, **pending review**, no account needed, we'll email after review. Event title/when/city/venue. Never implies publication. |
| B `awaiting_review` | `New event awaiting review — SalsaSegura` | Event facts + submitter name/email + submission ID + **Review submission** CTA to `/admin/submissions/:id`. Reply-To = submitter. |
| C `approved` | `Your event was approved — SalsaSegura` | Approved and listed + **View event** CTA to `/events/<approved_event_id>` (omitted when unlinked). |
| D `rejected` | `Update on your SalsaSegura event submission` | Reviewed, not approved, plus `rejection_message` when present, plus an invitation to resubmit. |

**`internal_note` cannot reach a submitter.** Three independent layers:

1. `readSubmission()`'s `select` omits the column.
2. `submissionRejectedEmail()` has no parameter for it.
3. **The service role is not granted `SELECT` on it** — column-level grants in
   file 001. Layers 1–2 are promises a future edit could break; layer 3 is
   structural. Verified live: `select=id,internal_note` as the service role
   returns `403 permission denied`.

## 5. Database Changes

Two files, both additive. Nothing existing is dropped or rewritten except the
`Anon can submit` policy, which is replaced with all three original clauses
preserved plus one added.

New objects: `public.event_submission_email_attempts` (table + 3 indexes + 1
RLS policy), `claim_submission_email_attempt()`,
`complete_submission_email_attempt()`, `anon_submitter_contact_is_valid()`,
`require_anon_submitter_contact()` + its BEFORE INSERT trigger.

### Why a trigger and not a CHECK constraint

A `CHECK ... NOT VALID` looked right and is wrong. `NOT VALID` skips only the
initial table scan; PostgreSQL still enforces the constraint on every later
**UPDATE**. Legacy anonymous rows with a null email would have become
unmoderatable — approving one changes only `status`, but the UPDATE is
re-checked and fails. That would break the review queue for exactly the rows
most likely still in it.

A `BEFORE INSERT` trigger fires on INSERT only. Verified live: a legacy
null-contact row was successfully rejected *and* approved after the file was
applied (`003_postcheck.sql` query 8 reproduces this inside a rollback).

## 6. SQL Files Created

| Order | File | Required? | Purpose |
|---|---|---|---|
| 1 | `sql/submission-emails/001_email_delivery_attempts.sql` | **Required** | Delivery log + idempotency + claim RPCs + service-role grants. Without it every send returns 503. |
| 2 | `sql/submission-emails/002_anon_submitter_contact_required.sql` | Recommended | Anon contact requirement. Without it the function records `no_recipient` and skips. |
| 3 | `sql/submission-emails/003_postcheck.sql` | Verification | Read-only checks + operational queries. |

Each file carries its own Purpose / Required-vs-optional / Execution order /
Safety notes / Rollback considerations header, plus a pre-flight query where
relevant. **Production SQL was not executed automatically.** Both were applied
only to a local stack (ports remapped to avoid the sibling Bellocampo
project), then the stack was torn down and `config.toml` reverted.

File 001's `service_role` grants are not optional polish — see defect 4.

## 7. Resend Configuration

**No new environment variables.** Reuses the established convention.

| Variable | Where | Value |
|---|---|---|
| `RESEND_API_KEY` | Function secret | Existing production key |
| `AUTH_EMAIL_FROM` | Function secret | `Salsa Segura Team <team@contact.salsasegura.com>` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | — |

Moderator recipient and public site URL come from `platform_settings`
(`support_email`, `public_site_url`) — editable in `/admin/settings`, no
hard-coded personal address anywhere. Reply-To is `support_email` on
submitter-facing mail and the submitter's address on the moderator
notification. Verified sending domain `contact.salsasegura.com` is unchanged.

Deployment:

```bash
npx supabase functions deploy send-submission-email
```

`RESEND_API_KEY` and `AUTH_EMAIL_FROM` are already set from Phase 1 /
organizer-invitations work; confirm rather than re-set them.

## 8. Security Protections

| Concern | Protection |
|---|---|
| Open email relay | **Eliminated.** `send-email` deleted. New function takes only an id + event name; recipients always server-derived. Verified live: a request carrying `to`, `from`, `subject`, `html` sent to the row's address with the env sender and none of the injected copy. |
| Privilege escalation | `approved`/`rejected` require `app_metadata.role` ∈ {admin, moderator}, verified via `auth.getUser()`. Live: anonymous 401, regular user 403, organizer 403, moderator/admin pass. |
| Forged outcomes | The row must already be in the claimed terminal state. Live: sending `approved` for a pending row returns 409. |
| `internal_note` disclosure | Column-level grant denies the service role read access, plus the select list and template signature. Verified live (403). |
| Header injection | Recipient must match `^[^\s@]+@[^\s@]+\.[^\s@]+$` (whitespace-rejecting) and be ≤320 chars. Live: `ok@example.com\nBcc: victim@…` refused. |
| XSS in email | Every interpolated value HTML-escaped in the template module. |
| Unbounded payloads | Request body ≤2 KB; title 200, location 200, name 300, city 100, rejection message 2000, email 320. |
| Open redirect / `javascript:` URLs | Links built only from `platform_settings.public_site_url` after an https-only `URL` parse. Live: `javascript:alert(1)` produced no link. |
| Secret exposure | Service-role key server-side only; provider errors normalized to categories. Live log scan: 0 occurrences of the API key, the internal note, or the injected address. |
| Enumeration | Unknown id returns a flat 404 that reveals nothing. |
| Submission flooding | Not addressed — see below. |
| Email flooding / duplicate sends | One success per (submission, event), enforced by a unique partial index; claim precedes send. Live: 5 concurrent duplicates → 4 `deduplicated`, exactly 1 provider call. |
| Replay of old submission ids | 15-minute freshness window + `status='pending'` requirement. |

### Known gap, documented not fixed

The anonymous submission endpoint has **no rate limit and no honeypot**. By
comparison `request-founder-access` has both. An attacker can flood
`event_submissions` with valid-looking rows, and each fresh row can trigger
one confirmation and one moderator email. The email side is bounded (one per
event per submission, and a hostile submitter can only mail an address they
supplied plus the platform's own support address), but the *table* can be
flooded and the moderation queue spammed. Closing it properly means a
honeypot field plus per-IP throttling on the submission path — a separate
piece of work, deliberately not expanded into here.

## 9. Automated Test Results

**Deno — Edge Function: 47 passed, 0 failed** (`deno test` in a
`denoland/deno:2.1.4` container; the local edge-runtime image ships no `deno`
CLI). Covers transport/CORS/body limits, the anti-relay invariant, the full
authorization matrix, every state gate, claim-before-send ordering,
concurrent dedup, the provider idempotency key, failure classification,
recipient validation, `internal_note` non-disclosure, escaping, field caps,
`edited_data` overlay, non-https URL rejection, and timezone rendering.

**Vitest — changed surface: 62 passed, 0 failed** across
`submissionNotification.test.ts` (13 new), `useSubmitEventForm.test.ts`,
`validation.test.ts`, `submissionsRepo.test.ts`, `SubmitEventPage.test.tsx`,
`SubmitEventPage.flyer.test.tsx`, `AdminSubmissionDetailPage.test.tsx`.

Every test that submits or decides mocks `submissionNotification`, so the
normal suite cannot reach the Edge Function or Resend.

**Type-check:** clean. **Build:** `✓ built in 7.95s`.

**Lint:** 3 errors, **none in a file this change touched** —
`AccountPage.tsx` (unused directive, documented Phase 1) and
`FoundersAcceptPage.tsx` (2× `react-hooks/set-state-in-effect` false
positives, documented Phase 6).

### Pre-existing failures, not introduced here

Full suite: **136 of 139 files pass; 24 tests fail in 3 files.** All
pre-existing:

- `AdminSidebar.test.tsx` (12) and `AdminLayout.test.tsx` (11) — `git status`
  shows `AdminSidebar.tsx` carries uncommitted modifications not made by this
  change; `AdminLayout` renders `AdminSidebar`.
- `EventForm.test.tsx` (1) — "renders organizer artwork without submitter or
  admin fields" expects no "Host & contact" section, but the **unmodified**
  committed `CAPABILITIES.organizerEdit` sets `hostAndContact: true`.
  **Proven** by stashing this change's two `EventForm` files and re-running:
  the test fails identically.

## 10. Manual QA Instructions

Prerequisite: apply files 001 and 002, deploy the function, confirm
`RESEND_API_KEY` and `AUTH_EMAIL_FROM`.

### Pass 1 — submit → approve

1. Sign out. Open `/submit`.
2. Confirm "Your info" shows the hint and that name + email are required —
   submitting with either blank must be blocked by the browser.
3. Fill everything with a real address you control; submit.
4. Expect the success card: *"pending review and will appear on the calendar
   once approved."*
5. **Submitter receives A** (`We received your event`) — states pending
   review, does not imply publication.
6. **Moderator address receives B** (`New event awaiting review`) — event
   facts, submitter name/email, submission ID, working **Review submission**
   link.
7. Sign in as admin/moderator, open the submission, map dance styles,
   **Approve**.
8. Confirm the event is live on the calendar (existing behaviour).
9. **Submitter receives C** (`Your event was approved`) with a working
   **View event** link.
10. Reload `/admin/submissions/:id` and re-approve if the UI allows — no
    second email (`deduplicated: true`).

### Pass 2 — submit → reject

1. Submit again as an anonymous visitor.
2. Confirm A and B arrive.
3. As a moderator, **Reject** with reason `missing_information`, a public
   message ("Please add the venue address and resubmit."), and an internal
   note ("do not disclose").
4. **Submitter receives D** (`Update on your SalsaSegura event submission`)
   containing the public message and **not** the internal note.

### Delivery verification

```bash
resend emails list
resend emails get <email-id>     # expect status: delivered
```

Cross-check against the database:

```sql
select a.email_event, a.status, a.recipient_kind, a.provider_message_id, a.error_code
from public.event_submission_email_attempts a
join public.event_submissions s on s.id = a.submission_id
where s.submitter_email = '<your test address>'
order by a.created_at;
```

`provider_message_id` is the id to pass to `resend emails get`. Then run
`003_postcheck.sql` queries 10–12 for delivery health, failures, and stale
claims.

## 11. Resend Delivery Verification

**Not performed — no Resend credential exists in this environment.**
`printenv | grep -i resend` → 0; `.env` holds only `LINER_API_KEY`; no
`resend` CLI is installed. No key was requested, invented, or committed.

What *was* verified live against a real local Supabase stack, using a
deliberately invalid key so the full orchestration ran end to end including a
real outbound HTTPS call to Resend:

- **Real Resend rejection**, classified as `invalid_sender` and recorded —
  proving the provider was genuinely contacted with the row-derived recipient.
- **Anti-relay:** a request carrying `to`/`from`/`subject`/`html`/`replyTo`
  sent to `submitter@example.com` (the row) from the env sender, with none of
  the injected copy present.
- **Authorization:** anonymous 401, regular user 403, organizer 403,
  moderator/admin accepted.
- **State gating:** `approved` for a pending row → 409, both before and after
  a real status change.
- **Idempotency:** 5 concurrent duplicates → 4 `deduplicated`, 1 provider
  call. Separately at the RPC layer: 5 simultaneous claims → exactly 1 winner.
- **Recipient validation:** null → `no_recipient`; `"definitely not an
  email"` → `invalid_recipient`; `\n`-injected → refused.
- **Full audit trail:** 9 attempt rows with correct `email_event`,
  `recipient_kind`, normalized `error_code`, all settled.
- **Leak scan:** 0 occurrences of the API key, the internal note, or the
  injected attacker address in edge-runtime logs.
- **Anon insert enforcement** through the real Data API: 7 invalid contact
  variants rejected 400, valid accepted 201, `status='approved'` rejected 401
  by RLS.
- **Legacy rows still moderatable:** a null-contact row was rejected and
  approved after file 002 was applied.
- **Real browser** (headless Chromium, dev server): blank contact → form
  invalid at "Your name"; filled → submitted; network trace shows
  `POST send-submission-email` with body exactly
  `{"submissionId":"…","event":"received"}` then `…"awaiting_review"}` —
  no recipient field; success card shown **despite both emails failing**,
  and the row persisted as `pending` with both failures recorded.

That last point is the reliability rule proven end to end: email delivery
failed completely and the submission was unaffected.

## 12. Requires the Project Owner

1. **Apply SQL, in order** — `001` (required), `002` (recommended), then
   `003` to verify. Run each file's pre-flight query first. Not executed
   automatically.
2. **Deploy the function** —
   `npx supabase functions deploy send-submission-email`.
3. **Remove the deleted relay from production** — `send-email` is gone from
   the repo but may still be deployed. Delete it in the dashboard
   (Functions → `send-email` → Delete), or:
   ```bash
   npx supabase functions delete send-email
   ```
   Until it is removed, the open relay remains live in production. This is
   the highest-priority item here.
4. **Confirm secrets** — `RESEND_API_KEY` and `AUTH_EMAIL_FROM` (expected:
   `Salsa Segura Team <team@contact.salsasegura.com>`). Do not re-set unless
   absent.
5. **Confirm `platform_settings`** — `support_email` is where moderator
   notifications go; `public_site_url` must be the canonical https origin
   (`https://www.salsasegura.com`) or approval emails omit the View event CTA.
6. **Run the manual QA passes** in §10 with a real address, then verify with
   `resend emails list` / `resend emails get`.
7. **Decide on the anti-abuse gap** in §8 — no rate limit or honeypot on the
   anonymous submission endpoint.
8. **Optional:** review `003_postcheck.sql` query 9 for historical anonymous
   rows with no contact address. They keep working but can never be emailed;
   `still_pending` is the actionable count.

No DNS changes. No new environment variables. No production environment-
variable changes.

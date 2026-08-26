# Organizer email invitations — production operations

Repository changes only provide local configuration and copy/paste references. **No hosted Supabase, Resend, or Azure Static Web Apps setting has been changed by this repository work.** Complete every hosted step below in the production environment before enabling organizer invitations.

## 1. Deploy the Edge Functions

From the repository root, authenticated to the intended Supabase production project:

```bash
supabase functions deploy send-auth-email --no-verify-jwt
supabase functions deploy invite-organizer
```

`send-auth-email` is deliberately deployed without JWT verification because Supabase Auth calls it as an Auth Hook. The hook function itself must validate the hook secret. `invite-organizer` is deployed without the `--no-verify-jwt` flag; instead, `supabase/config.toml` sets `verify_jwt = false` for it directly, because the function performs its own internal caller-JWT validation against the trusted `app_metadata.role` claim, which is the sole enforcement point for authorizing this function's callers.

## 2. Set production Function secrets

Set these on the target Supabase project. Use the secret values from the approved secret-management system; never commit or paste their values into this repository.

```bash
supabase secrets set RESEND_API_KEY=<approved-resend-api-key>
supabase secrets set SEND_EMAIL_HOOK_SECRET=<approved-random-hook-secret>
supabase secrets set AUTH_EXTERNAL_URL=https://www.salsasegura.com
```

`SUPABASE_SERVICE_ROLE_KEY` is required by the invitation workflow. Supply it through the platform-provided Function secret/environment mechanism for the production project; do not place a service-role key in source control, frontend configuration, or an email template.

`INVITE_REDIRECT_URL` is optional and not required for normal operation: the function already computes the correct redirect URL per environment (`ENVIRONMENT=local|production`). If set, it MUST exactly match one of the two hardcoded allowed URLs (`http://localhost:5173/auth/invite` or `https://www.salsasegura.com/auth/invite`); any other value causes the function to return `500`.

## 3. Configure the Supabase Auth Hook manually

In **Supabase Dashboard → Authentication → Hooks**, configure the **Send Email** hook:

- **URL:** `https://<production-project-ref>.supabase.co/functions/v1/send-auth-email`
- **Secret:** the same value configured as `SEND_EMAIL_HOOK_SECRET`

Save the dashboard setting, then send a controlled invitation and confirm the hook succeeds in the function logs. The local development equivalent is configured in `supabase/config.toml` as `http://host.docker.internal:54321/functions/v1/send-auth-email`; do not copy that Docker-only hostname into the hosted dashboard.

## 4. Configure the Auth redirect allowlist

In **Supabase Dashboard → Authentication → URL Configuration**, add this exact production redirect URL to the additional redirect URLs allowlist:

```text
https://www.salsasegura.com/auth/invite
```

For local development, the repository configuration includes the exact URL:

```text
http://localhost:5173/auth/invite
```

Do not use a lookalike route or append a suffix to `/auth/invite`.

## 5. Configure the invitation email template manually

In **Supabase Dashboard → Authentication → Email Templates → Invite user**, copy the subject and HTML from `auth-templates/invite-organizer.md`. The link must use this unmodified Supabase variable:

```html
<a href="{{ .ConfirmationURL }}">Accept your organizer invitation</a>
```

Do not paste an access token, service-role credential, or handcrafted confirmation URL into the template.

## 6. Verify Resend delivery prerequisites

Before sending production invitations:

1. In Resend, verify the sender domain/address used by `send-auth-email`.
2. Confirm the approved `RESEND_API_KEY` is authorized to send from that verified sender.
3. Send a controlled organizer invitation to a monitored address and verify receipt, sender identity, and the Supabase-generated link.

## 7. Verify Azure Static Web Apps deep linking manually

After deployment to Azure Static Web Apps, paste `https://www.salsasegura.com/auth/invite` into a fresh browser tab and refresh the page. It must serve the SPA rather than a platform 404, then allow the invitation route to handle the confirmation result.

The current `staticwebapp.config.json` has `navigationFallback.rewrite` set to `/index.html`, which is intended to cover this non-asset route. No route-specific rewrite is included. This Azure verification remains **unexecuted** until a deployed production environment is tested.

## Local configuration notes

The checked-in local Auth Hook targets the host machine from the Supabase Docker network:

```toml
[auth.hook.send_email]
enabled = true
uri = "http://host.docker.internal:54321/functions/v1/send-auth-email"

[functions.send-auth-email]
verify_jwt = false
```

Local Auth also allowlists `http://localhost:5173/auth/invite`. These settings do not configure Supabase hosted Auth; apply the hosted dashboard steps above separately.

## 8. Release readiness report (as of 2026-08-26)

This section records the actual, evidence-backed status of the organizer email invitations feature
at the end of implementation (Tasks 1–9 of `Docs/superpowers/plans/2026-08-26-organizer-email-invitations.md`,
full history in `.superpowers/sdd/2026-08-26-organizer-email-invitations/progress.md` and the
per-task `task-N-report.md` files). It supersedes nothing above — Sections 1–7 remain the exact
manual steps a human operator must still perform.

### 8.1 Root cause and implementation shape: old flow vs. new flow

**Old flow (still the default fallback for every role, including Organizer on request):** the
`admin_invite_user` Postgres RPC directly inserts an `auth.users` row and a `public.profiles` row from
application code with a generated temporary password, which the Admin UI displays once ("Copy
credentials"). No Supabase Auth invitation, no email, no `{{ .ConfirmationURL }}` link — the recipient
is handed a plaintext temporary password out-of-band and must sign in and change it. This RPC and its
UI rendering path (`AdminUserCredentials`) are **unchanged** by this feature (Task 6 report, lines
7–29, 162–178: "`createUser`/`admin_invite_user` behavior is byte-identical to before").

**New flow (Organizer role, default delivery):** `AdminUsersPage` → `createUserAccount` →
`inviteOrganizerByEmail` invokes the new, trusted `invite-organizer` Supabase Edge Function
(service-role context, JWT-authenticated caller, admin-role-checked) with only `{ email, displayName }`
— no client-supplied role or redirect (Task 2/6 reports). `invite-organizer` calls Supabase Auth's
`admin.inviteUserByEmail`, which triggers GoTrue's **Send Email Auth Hook**: GoTrue POSTs a
`standardwebhooks`-signed payload to the new `send-auth-email` Edge Function, which verifies the HMAC
signature, builds the email from `email_data.token_hash`/`redirect_to` (never a raw access token), and
sends it via Resend. The recipient's link uses Supabase's own `{{ .ConfirmationURL }}` semantics and
lands on `/auth/invite`, which verifies the session, requires the organizer to set their own password,
and routes to `/host`. No temporary password is ever generated or displayed for this path
(`AdminEmailInviteSent` success view, Task 6).

### 8.2 Manual production actions required (none executed by this implementation)

All of the following are **hosted, production-only configuration** that no agent in this project had
the authority or credentials to perform. None were executed; repository work is limited to code,
local (`supabase/config.toml`) config, and this documentation. Full commands/values are in Sections
1–7 above; status:

| Action | Status |
|---|---|
| Deploy `send-auth-email` (`--no-verify-jwt`) and `invite-organizer` Edge Functions to the production Supabase project (Section 1) | **NOT executed** |
| Set production Function secrets `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EXTERNAL_URL`, and the service-role key via the platform secret mechanism (Section 2) | **NOT executed** |
| Configure the Supabase Dashboard → Authentication → Hooks → Send Email hook, URL `https://<production-project-ref>.supabase.co/functions/v1/send-auth-email` + the `SEND_EMAIL_HOOK_SECRET` value (Section 3) | **NOT executed** |
| Add `https://www.salsasegura.com/auth/invite` to the Dashboard → Authentication → URL Configuration redirect allowlist (Section 4) | **NOT executed** |
| Paste the Invite user email template from `auth-templates/invite-organizer.md` into Dashboard → Authentication → Email Templates, using only `{{ .ConfirmationURL }}` (Section 5) | **NOT executed** |
| Verify the Resend sender domain/address and that the approved `RESEND_API_KEY` is authorized to send from it; send one controlled invitation to a monitored inbox (Section 6) | **NOT executed** |
| Verify `https://www.salsasegura.com/auth/invite` serves the SPA (not a platform 404) on Azure Static Web Apps after a real deploy, then completes the invite flow (Section 7) | **NOT executed** |

Local equivalents of the redirect allowlist, Send Email hook wiring, and `verify_jwt = false` function
config are already committed in `supabase/config.toml` and were exercised against the real local
Supabase stack (Section 8.4) — they do not configure or imply anything about the hosted project.

### 8.3 Compatibility status

- **Temporary-password fallback: intact, unchanged.** Every non-Organizer role, and Organizer with the
  fallback radio explicitly selected, still uses the original `admin_invite_user` RPC and
  `AdminUserCredentials` rendering, verified byte-identical to the pre-feature version (Task 6 report).
  No existing caller, test, or UI behavior for this path was modified.
- **Organizer email delivery: functionally proven end-to-end against a real (local) Supabase stack;
  genuine emailed delivery to a real inbox via Resend is NOT proven and remains incomplete.** See 8.4
  and 8.5 for the exact evidence and the exact blocker.
- **Exact blocker:** no real Resend account API key was available to any implementation agent
  (out of agent authority per the plan's Global Constraints). With the local placeholder key
  (`RESEND_API_KEY=re_test_placeholder`), Resend's real API correctly rejects it with a real `401 API
  key is invalid`; GoTrue then transactionally rolls back the entire invite (the `auth.users` row is
  never persisted) because its Send Email hook did not return `2xx` (Task 7 report, "Important
  finding, not a defect"). This is expected GoTrue hook semantics, not a bug in `invite-organizer` or
  `send-auth-email`. **Per the plan's Completion Gate: "If Resend/Auth Hook/hosted redirect
  configuration cannot be supplied, preserve the temporary-password fallback and report email
  invitations as incomplete." That is the exact state at the end of this implementation — the
  temporary-password fallback is preserved, and email invitations are reported as incomplete for the
  live-delivery requirement.**

### 8.4 Verification evidence (all real, no fabricated results)

**Automated checks (Task 8 report):**
- `npm test -- --run`: **818/818 Vitest tests pass**, 0 regressions. 3 suites fail to *collect* (not
  test failures): 1 (`supabase/functions/_shared/invitation.test.ts`) is confirmed pre-existing on
  `main` itself (reproduced identically against the main checkout); the other 2
  (`invite-organizer/index.test.ts`, `send-auth-email/index.test.ts`) are net-new Deno-only test files
  this feature added that vitest cannot collect without a `deno` binary, which is unavailable in this
  environment — a documented environment limitation, not an application regression.
- `npm run lint`: 0 problems (after fixing one genuine unbalanced-braces syntax defect in
  `invite-organizer/index.test.ts`, commit `3d0482c`).
- `npm run build` (includes `tsc -b`): builds clean, no TypeScript errors.
- Deep-link matrix: `/auth/invite`, `/auth/callback`, `/host`, `/admin` all served correctly (no 404,
  no premature redirect) on initial load and hard reload against the real local dev server.
- Responsive/accessibility matrix at 375/768/1024/1440px across invalid-token, role-mismatch, and
  organizer-setup-form states: no horizontal overflow, correct `role="alert"` semantics, zero console
  errors, correct `:focus-visible` keyboard-focus styling, all at every width.
- Secrets/malformed-URL scan across the full tracked repository (not just this feature's files): no
  real `service_role`/`RESEND_API_KEY`/`SEND_EMAIL_HOOK_SECRET` values, no raw invite tokens, no
  client-side use of `inviteUserByEmail` (server-side Edge Function only) — clean.

**Real Admin → Organizer invitation, `/auth/invite` acceptance, and security journeys (Task 7 report),
all against the real local Supabase Docker stack with a real headless browser, no mocks:**
- A real Admin JWT (`app_metadata.role: "admin"`) calling `invite-organizer` produces a real, HMAC
  `standardwebhooks`-signed webhook to `send-auth-email` — signature verification passes, the payload
  shape and `redirect_to` (`http://localhost:5173/auth/invite`) match exactly — confirmed via
  edge-runtime logs (`TASK7_DIAG signature verification passed` → `payload parsed` →
  `resend send failed {statusCode:401, message:"API key is invalid"}`). This proves the entire pipeline
  up to the Resend transport boundary; only the final send fails, for the documented placeholder-key
  reason.
- Because the standard invite path cannot complete locally without a real Resend key, `POST
  /auth/v1/admin/generate_link` (a distinct, legitimate Supabase Admin endpoint that skips only the
  `send_email` hook, exercising the identical GoTrue verification/session code the real emailed link
  would) was used to reach the acceptance flow: real browser navigation to
  `/auth/invite#access_token=...&type=invite` → "Set your organizer password" form → submit → real
  navigation to `/host` (Host Dashboard rendered) → `/host/events` nav works → hard reload of `/host`
  persists the session.
- Reuse/expiry: replaying the already-consumed token produced the real GoTrue
  `error=access_denied&error_code=otp_expired` hash redirect and the correct "invalid, expired, or
  already used" error card, no `/host`, no password form.
- Malformed/unauthorized/security journeys, all with real HTTP against the live local functions:
  malformed email → `400`; malformed JSON → `400`; `GET` instead of `POST` → `405`; missing/garbage
  `Authorization` → `401`; a real non-admin user's JWT → `403 Forbidden`; inviting an email that
  already has an account → `409`; a non-organizer user's session on `/auth/invite` → correct
  "could not be verified for your account" message, no `/host`.
- Compatibility: the temporary-password `admin_invite_user` RPC was independently re-exercised via a
  real Admin JWT during this same verification pass — `200`, real temp-password row returned,
  unaffected by the new code paths.
- Two genuine pre-existing defects were found and fixed while proving the above (not before): a broken
  `esm.sh` remote import in `invite-organizer/index.ts` that caused `503 BOOT_ERROR` on every real
  invocation, and a React `StrictMode` double-invoke deadlock plus missed hash-fragment error parsing
  in `InviteActivationPage.tsx` that hung "Activating your invitation…" forever on every real
  navigation. Both fixes are committed with regression tests (Task 7 report, Task 7 addendum for a
  post-review test-quality fix confirmed by reverting/re-running against the pre-fix code).

### 8.5 Overall completion verdict

Per the plan's own Completion Gate, the feature is **complete except for the one requirement the gate
itself anticipates might be unprovable in this environment: genuine emailed Resend delivery to a real
inbox.** Every other gate condition is met with real evidence: a real Organizer session established via
the real GoTrue verification path, required password setup, routing to `/host`, and passing
reuse/expiry/security/compatibility checks (Section 8.4). The temporary-password fallback remains
intact and is the safe default until a human operator supplies real Resend/Auth Hook/hosted redirect
configuration (Section 8.2) and confirms one real invitation is received in a monitored inbox
(Section 6). Until that manual step is done, **organizer email invitations must be reported as
incomplete for the original "genuinely emailed invitation" requirement**, exactly as the plan
instructs.

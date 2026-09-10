# Organizer Email Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real Supabase Organizer email invitation path that safely activates an Organizer at `/auth/invite` and routes them to `/host`, while preserving the current temporary-password fallback until live email delivery is proven.

**Architecture:** Add a trusted `invite-organizer` Supabase Edge Function that authenticates Admin callers and invokes `auth.admin.inviteUserByEmail` with a fixed invitation redirect. Add a signed Supabase Auth Send Email Hook Edge Function that constructs token-hash verification URLs and sends action-specific mail via the existing Resend dependency pattern. Add a separate `/auth/invite` SPA activation page that consumes PKCE/query/hash invitation results, requires a trusted Organizer role, sets a password, and then enters `/host`. Extend the Admin user form only for Organizer delivery selection; do not remove the temporary-password path.

**Tech Stack:** React 19, TypeScript, Vite, React Router v7 classic `<Routes>`, Supabase JS v2, Supabase Edge Functions/Deno, Supabase Auth Admin API, Supabase Auth Send Email Hook, Standard Webhooks, Resend, Vitest, Testing Library, Playwright-compatible browser harness.

## Global Constraints

- `inviteUserByEmail` MUST run only in a trusted Supabase Edge Function; no Supabase service-role key, Resend API key, or Auth Hook secret may enter frontend code or browser responses.
- Admin authorization MUST use a validated authenticated caller and trusted `app_metadata.role === "admin"`; never use editable `user_metadata` for authorization.
- The invitation endpoint MUST hardcode/validate its redirect to exactly `https://www.salsasegura.com/auth/invite` in production and `http://localhost:5173/auth/invite` locally; request bodies MUST NOT supply arbitrary redirect destinations or roles.
- The Auth Send Email Hook MUST verify Standard Webhooks signatures before parsing/sending, use `email_data.token_hash` (never the raw `token`) in `/auth/v1/verify` links, and return HTTP 200 only after successful delivery.
- `/auth/callback` remains the existing signup/OAuth callback. `/auth/invite` is a separate activation flow. Do not add `/auth/reset-password` in this patch.
- Preserve the existing temporary-password Organizer invitation path until the real emailed invitation has passed local/staging end-to-end verification.
- A post-invite provisioning failure MUST leave no contradictory role/profile records: delete partial profile state and the newly-created Auth user, then return an actionable retry error.
- `profiles.role` and `auth.users.app_metadata.role` remain single-valued; do not add multi-role schema changes or authorize from `user_metadata`.
- Existing route guards, capabilities, RLS, signup/login/sign-out redirects, and Admin/Moderator/regular-user behavior remain authoritative and unchanged unless a test proves a required compatibility update.
- No hosted Supabase dashboard, SMTP, Resend secret, Azure deployment, or production data mutation may be performed by the implementation agent; produce exact manual configuration steps and report live-email blockers honestly.
- TDD is mandatory for every code task: write a failing behavior test first, run it, implement the minimum change, rerun focused tests, then commit only task-owned files.
- Never use `git add -A`; stage exact files for each task.

---

## File and module map

- `supabase/functions/_shared/invitation.ts` — pure email normalization, exact redirect allowlist, invite request/response types, and safe error helpers shared by the invitation function/tests.
- `supabase/functions/invite-organizer/index.ts` — authenticated Admin-only invitation endpoint; Auth Admin API call, role/profile provisioning, rollback, audit record.
- `supabase/functions/send-auth-email/index.ts` — signed Supabase Auth Send Email Hook; action templates, token-hash verification URL generation, Resend delivery.
- `supabase/functions/invite-organizer/index.test.ts` and `supabase/functions/send-auth-email/index.test.ts` — Deno-compatible unit tests for pure helpers and mocked boundaries; no network or real secrets.
- `src/features/admin/api/profilesRepo.ts` — typed frontend repository branches for email Organizer invitations vs. existing temporary-password RPC.
- `src/hooks/useAdminUsers.ts` — passes delivery choice through the existing mutation and invalidates existing user/profile queries.
- `src/components/Admin/AdminUserForm.tsx/.css/.test.tsx` — Organizer-only delivery choice and distinct email-success vs. credential-handoff UI.
- `src/pages/AdminUsersPage.tsx/.test.tsx` — wire the delivery-aware result and preserve current announcements/error handling.
- `src/components/Auth/InviteActivationPage.tsx/.css/.test.tsx` — dedicated invite token consumption, Organizer authorization, password setup, and accessible failures.
- `src/App.tsx` — add `/auth/invite` route without changing `/auth/callback` ownership.
- `src/lib/inviteAuth.ts/.test.ts` — pure callback-result parser/one-time handling helpers if needed to keep activation component focused; exact implementation may remain in the page only if tests demonstrate the boundary is unnecessary.
- `supabase/config.toml` — local Auth Send Email Hook URI, local invite redirect allowlist, and local function JWT settings only.
- `supabase/functions/send-auth-email/README.md` or `Docs/operations/organizer-email-invitations.md` — manual production deployment, secrets, Auth Hook, template, redirect allowlist, and Azure deep-link checklist. Create documentation only in the task that owns deployment instructions.
- `staticwebapp.config.json` — modify only if direct `/auth/invite` refresh is not covered by the existing SPA fallback; otherwise add a test/evidence note and leave it unchanged.

---

## Task 1: Define invitation contracts and pure validation helpers

**Files:**
- Create: `supabase/functions/_shared/invitation.ts`
- Create: `supabase/functions/_shared/invitation.test.ts`

**Interfaces:**
- Produce `normalizeEmail(value: unknown): string | null`.
- Produce `normalizeDisplayName(value: unknown): string | null`.
- Produce `inviteRedirectUrl(environment: "local" | "production"): string`.
- Produce `isAllowedInviteRedirect(value: string): boolean`.
- Produce `type InviteOrganizerRequest = { email: string; displayName?: string }`.
- Produce `type EmailInviteSuccess = { delivery: "email_invitation"; userId: string; email: string }`.

- [ ] **Step 1: Write failing helper tests.** Cover trimming/lower-casing valid email, rejecting empty/invalid/overlong email, trimming/bounding optional display name, accepting exactly the two allowed redirect URLs, rejecting `/`, `/auth/callback`, protocol-relative URLs, external domains, malformed schemes, and request-supplied role values.
- [ ] **Step 2: Run focused tests and observe failure.** Run `deno test --allow-env supabase/functions/_shared/invitation.test.ts` if Deno is available; otherwise run the repository's configured Edge Function test command and record the missing-runtime blocker without substituting a weaker test.
- [ ] **Step 3: Implement pure helpers.** Keep helpers dependency-free and deterministic. Do not read request headers, decode JWTs, call Supabase, or call Resend here.
- [ ] **Step 4: Rerun focused tests.** Confirm every validation boundary passes and no secret/config value is embedded in source.
- [ ] **Step 5: Commit.**
  ```bash
  git add supabase/functions/_shared/invitation.ts supabase/functions/_shared/invitation.test.ts
  git commit -m "feat(auth): add invitation validation contracts"
  ```

---

## Task 2: Build the trusted Admin invitation Edge Function

**Files:**
- Create: `supabase/functions/invite-organizer/index.ts`
- Create: `supabase/functions/invite-organizer/index.test.ts`
- Modify: `supabase/config.toml` only for function-local settings if required by the chosen invocation/deployment pattern

**Consumes:** Task 1 validation helpers. Existing Supabase Edge Function Deno style. Existing profile/audit schema (`public.profiles`, `public.audit_logs`).

**Produces:** `POST /functions/v1/invite-organizer`, invoked by an authenticated Admin browser session, with response `EmailInviteSuccess` or safe JSON error.

- [ ] **Step 1: Write failing endpoint tests.** Use injected/mocked Auth and database clients, not real service keys. Cover:
  - non-POST → 405;
  - missing/malformed Authorization → 401;
  - valid authenticated non-Admin (`app_metadata.role` organizer/moderator/user) → 403;
  - malformed email → 400;
  - request-supplied redirect/role ignored or rejected;
  - successful Admin call passes exact email and `redirectTo: "http://localhost:5173/auth/invite"` in local test configuration, and `data` contains only display-name data (never role);
  - successful Auth response is followed by trusted `updateUserById(... app_metadata.role = "organizer")`, profile upsert with `role = "organizer"`, and audit insert without tokens;
  - duplicate Auth error → safe 409;
  - role/profile/audit failure after Auth creation → deletes the new user and partial profile, returns safe retry error;
  - response never contains service-role key, Resend key, webhook secret, or invitation token.
- [ ] **Step 2: Run focused tests and observe failure.** Use the available Deno test runner or repository Edge Function test harness; do not call a hosted project.
- [ ] **Step 3: Implement authenticated Admin boundary.** Create an anon-key client with the caller Authorization header to validate the caller and load trusted user data. Create a separate service-role client only inside the function runtime. Reject unknown/missing role rather than defaulting to Admin. Validate `INVITE_REDIRECT_URL` against Task 1's exact allowlist before making the Auth call.
- [ ] **Step 4: Implement provisioning and compensation.** Call `auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name } })`. Then merge existing returned `app_metadata` and set only trusted `role: "organizer"`; upsert profile and audit row. On any post-create failure, delete partial profile and the created Auth user. Return stable safe errors; log only correlation/user id, never token or secret.
- [ ] **Step 5: Rerun focused tests and a local function smoke test.** Confirm Admin/non-Admin boundaries and rollback behavior.
- [ ] **Step 6: Commit.**
  ```bash
  git add supabase/functions/invite-organizer/index.ts supabase/functions/invite-organizer/index.test.ts supabase/config.toml
  git commit -m "feat(auth): add trusted organizer invitation endpoint"
  ```

---

## Task 3: Build the signed Supabase Auth Send Email Hook

**Files:**
- Create: `supabase/functions/send-auth-email/index.ts`
- Create: `supabase/functions/send-auth-email/index.test.ts`

**Interfaces:**
- Consume signed POST payload `{ user, email_data }` from Supabase Auth.
- Produce HTTP 200 `{}` only after Resend success; HTTP 401 with `{ error: { http_code, message } }` for invalid signature/payload/provider failure.

- [ ] **Step 1: Write failing hook tests.** Mock `standardwebhooks` and Resend boundaries. Cover invalid method, malformed JSON, invalid signature, missing `user.email`, missing `token_hash`/redirect/action type, `invite`, `signup`, `magiclink`, and `recovery` action templates, exact verification URL containing `token=<token_hash>`, exact payload `redirect_to`, no use of raw `token` in URL, Resend failure, and success response.
- [ ] **Step 2: Run focused tests and observe failure.** Use Deno test or configured Edge Function harness.
- [ ] **Step 3: Implement signature verification first.** Read `await req.text()` once, construct `new Webhook(secretWithoutV1Prefix)`, call `verify(rawPayload, Object.fromEntries(req.headers))`, and reject before parsing or sending when verification fails. Use `SEND_EMAIL_HOOK_SECRET` and `RESEND_API_KEY` only via `Deno.env.get()`.
- [ ] **Step 4: Implement URL/template delivery.** Build `{SUPABASE_URL}/auth/v1/verify?token={encodeURIComponent(token_hash)}&type={...}&redirect_to={...}` from verified payload. Add action-specific subjects/body; invite copy must say “Accept invitation”, single-use/expiry, and set-password next step. Support existing signup confirmation so enabling the hook does not break current signup. Handle recovery/magiclink without adding a frontend recovery route.
- [ ] **Step 5: Rerun focused tests and inspect source.** Confirm no service/Resend/webhook secrets or raw tokens are returned or logged.
- [ ] **Step 6: Commit.**
  ```bash
  git add supabase/functions/send-auth-email/index.ts supabase/functions/send-auth-email/index.test.ts
  git commit -m "feat(auth): send signed auth emails through resend"
  ```

---

## Task 4: Add local Auth Hook and invitation configuration documentation

- Create: `auth-templates/invite-organizer.md` (dashboard copy/paste reference)
- Modify: `supabase/config.toml`
- Modify or create: `Docs/operations/organizer-email-invitations.md`
- Modify: `staticwebapp.config.json` only if verification proves the current fallback does not cover `/auth/invite`

- [ ] **Step 1: Write a configuration/documentation verification check.** Verify exact strings are present: local `/auth/invite`, production `https://www.salsasegura.com/auth/invite`, local Hook URI using `host.docker.internal`, `send-auth-email`, `verify_jwt = false`, `{{ .ConfirmationURL }}`, required secrets, and no `/auth/inviteThen` typo.
- [ ] **Step 2: Add local config.** Add the exact local invite URL to `[auth] additional_redirect_urls`. Add `[auth.hook.send_email] enabled = true` with `uri = "http://host.docker.internal:54321/functions/v1/send-auth-email"` and add `[functions.send-auth-email] verify_jwt = false` if supported by the current Supabase CLI format. Do not commit secret values.
- [ ] **Step 3: Add the Invite template reference.** Create `auth-templates/invite-organizer.md` with exact dashboard instructions and an HTML invitation body using `{{ .ConfirmationURL }}`; the template must not contain a hardcoded token, raw service credential, or malformed `/auth/inviteThen` URL.
- [ ] **Step 4: Document production manual steps.** Include deploy commands (`supabase functions deploy send-auth-email --no-verify-jwt`, deploy `invite-organizer`), Function secrets (`RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EXTERNAL_URL`, `SUPABASE_SERVICE_ROLE_KEY` via platform-provided secret), Dashboard → Authentication → Hooks URL/secret, Auth redirect allowlist exact URL, Invite template using `{{ .ConfirmationURL }}`, Resend sender verification, and Azure Static Web Apps direct-refresh check. State clearly that no hosted setting is changed by repository work.
- [ ] **Step 5: Verify SPA deep-link behavior.** Load `/auth/invite` directly and refresh through the local dev server. Inspect `staticwebapp.config.json` before changing it; its current `navigationFallback.rewrite = "/index.html"` should normally cover this path. Add no redundant route rewrite if it already works.
- [ ] **Step 6: Commit.**
  ```bash
  git add supabase/config.toml auth-templates/invite-organizer.md Docs/operations/organizer-email-invitations.md staticwebapp.config.json
  git commit -m "docs(auth): document organizer invitation configuration"
  ```

---

## Task 5: Add the dedicated `/auth/invite` activation page

**Files:**
- Create: `src/components/Auth/InviteActivationPage.tsx`
- Create: `src/components/Auth/InviteActivationPage.css`
- Create: `src/components/Auth/InviteActivationPage.test.tsx`
- Modify: `src/App.tsx`
- Create `src/lib/inviteAuth.ts/.test.ts` only if pure callback parsing cannot stay small and testable in the page.

**Interfaces:**
- `InviteActivationPage` owns one-time callback consumption, session confirmation, trusted Organizer check, password setup, and final `/host` navigation.
- Existing `AuthCallback` remains unchanged except for imports only if a shared parser is explicitly proven necessary; do not silently merge route responsibilities.

- [ ] **Step 1: Write failing component tests.** Mock only Supabase boundary methods and render through real `MemoryRouter` routes. Cover:
  - query `error`/`error_description` → accessible alert + Back to sign in;
  - PKCE `?code=` → `exchangeCodeForSession` exactly once, then Organizer password form;
  - fragment `#access_token` + `#refresh_token` → `setSession` exactly once, then Organizer password form;
  - query token-hash variant, if the live URL probe demonstrates it is generated → `verifyOtp` exactly once;
  - no session → accessible expired/invalid/reused invitation error;
  - regular user, Moderator, or Admin session → no password form and no `/host`, authorization error + sign-in action;
  - Organizer password mismatch/short password → inline validation, no update call;
  - valid matching password → `updateUser({ password })` and `/host` only after success;
  - update failure → alert, setup form remains usable;
  - effect rerender/navigation does not consume code/token twice.
- [ ] **Step 2: Run focused tests and observe failure.** `npm test -- --run src/components/Auth/InviteActivationPage.test.tsx`.
- [ ] **Step 3: Implement callback consumption matching actual links.** Parse query error/code first. Exchange PKCE code once. If no code, explicitly parse and clear hash access/refresh tokens and call `supabase.auth.setSession`; support `verifyOtp` only if the actual invitation URL uses a token-hash query form. Do not rely on a race-prone `getSession()` immediately after client initialization without handling the concrete callback form.
- [ ] **Step 4: Implement role/setup gate.** Fetch/refresh the authenticated user after session establishment, derive trusted role from `app_metadata`, require `organizer`, then show labeled password + confirmation fields. Use `updateUser({ password })`; never write role/user metadata from this page. Navigate with `replace: true` only after success.
- [ ] **Step 5: Add route and accessible styles.** Register `/auth/invite` before the public catch-all route. Use `role="status"` while processing, `role="alert"` for errors, semantic labels, disabled submit while busy, and visible focus states. Preserve current auth visual language without touching Admin shell tokens.
- [ ] **Step 6: Rerun focused and existing AuthCallback tests.** Confirm existing `/auth/callback` behavior remains unchanged.
- [ ] **Step 7: Commit.**
  ```bash
  git add src/components/Auth/InviteActivationPage.tsx src/components/Auth/InviteActivationPage.css src/components/Auth/InviteActivationPage.test.tsx src/App.tsx src/lib/inviteAuth.ts src/lib/inviteAuth.test.ts
  git commit -m "feat(auth): add organizer invitation activation route"
  ```

---

## Task 6: Add delivery-aware Admin repository and UI while preserving fallback

**Files:**
- Modify: `src/features/admin/api/profilesRepo.ts`
- Modify: `src/hooks/useAdminUsers.ts`
- Modify: `src/components/Admin/AdminUserForm.tsx`
- Modify: `src/components/Admin/AdminUserForm.css`
- Modify: `src/components/Admin/AdminUserForm.test.tsx`
- Modify: `src/pages/AdminUsersPage.tsx`
- Modify: `src/pages/AdminUsersPage.test.tsx`

**Interfaces:**
```ts
type InviteDelivery = "email_invitation" | "temporary_password";
type CreateUserParams = { email: string; display_name?: string; role?: UserRole; delivery?: InviteDelivery };
type CreatedAccount =
  | { delivery: "email_invitation"; id: string; email: string; role: "organizer"; display_name: string | null; status: "active"; created_at: string }
  | { delivery: "temporary_password"; id: string; email: string; role: UserRole; display_name: string | null; username: string | null; status: AccountStatus; created_at: string; temp_password: string };
```

- [ ] **Step 1: Write failing repository/UI tests.** Cover email branch invoking `supabase.functions.invoke("invite-organizer", { body: { email, displayName } })` with no role/redirect/token fields; non-Organizer roles still invoking `admin_invite_user`; Organizer defaults to email; selecting fallback returns/render temp password exactly as before; email success never renders temp password; safe duplicate/config errors render `role="alert"`; mutation invalidates existing queries.
- [ ] **Step 2: Run focused tests and observe failure.** Run repository, form, and page test files.
- [ ] **Step 3: Implement typed branch.** Keep existing `createUser` temporary-password behavior intact. Add a delivery-aware function that calls the authenticated Edge Function only for Organizer email delivery. Preserve the returned discriminated union through `useAdminUsers` and `AdminUsersPage`.
- [ ] **Step 4: Implement truthful UI.** When role is Organizer, show a labeled radio/select delivery control defaulted to “Email invitation”; switching to other roles removes it and preserves temporary-password behavior. Email success says invitation sent and instructs the recipient to accept/set a password. Do not expose any service error internals or credentials in the email branch.
- [ ] **Step 5: Rerun focused tests and verify keyboard behavior.** Check labels, radio state, error alerts, cancel paths, and unchanged non-Organizer credential handoff.
- [ ] **Step 6: Commit.**
  ```bash
  git add src/features/admin/api/profilesRepo.ts src/hooks/useAdminUsers.ts src/components/Admin/AdminUserForm.tsx src/components/Admin/AdminUserForm.css src/components/Admin/AdminUserForm.test.tsx src/pages/AdminUsersPage.tsx src/pages/AdminUsersPage.test.tsx
  git commit -m "feat(admin): add organizer email invitation delivery"
  ```

---

## Task 7: Function integration, local email proof, and security verification

**Files:**
- Modify tests or fixtures only where a real integration contract requires it.
- Create temporary verification scripts outside the repository or under the plan's ignored SDD workspace; do not commit generated tokens, credentials, or email bodies.

- [ ] **Step 1: Start local Supabase and the local Edge Functions runtime.** Set test-only `RESEND_API_KEY`/Hook secret through local environment or a mock provider. Do not use production secrets.
- [ ] **Step 2: Probe actual invite URL format.** Invoke the trusted `invite-organizer` endpoint with a real local Admin session. Capture only URL shape/metadata, not secrets. Confirm the generated email payload/link uses the exact `redirect_to = http://localhost:5173/auth/invite` and `token_hash` verification value.
- [ ] **Step 3: Prove email delivery.** Use a local/staging Resend test destination or deterministic provider stub accepted by the Edge Function harness. Assert an actual invitation message is generated with `{{ .ConfirmationURL }}`-equivalent output, “Accept invitation” copy, and no raw service secrets.
- [ ] **Step 4: Accept once in a real browser.** Follow the genuine invite URL, assert `/auth/invite`, session establishment, Organizer password setup, `/host`, Host dashboard panels, Host Dashboard/My Events navigation, and refresh persistence.
- [ ] **Step 5: Negative security journeys.** Verify regular user cannot use `/auth/invite` to gain Organizer access; non-Admin cannot invoke `invite-organizer`; malformed redirect/body cannot alter destination; duplicate users do not create contradictory profiles; no service-role/Resend/Hook secret appears in browser requests or built assets.
- [ ] **Step 6: Single-use/expiry journeys.** Reuse the same invite and use an invalid/expired token. Assert accessible error, no `/host`, no password setup, and working sign-in action.
- [ ] **Step 7: Compatibility journeys.** Existing temporary-password Admin invite still works; signup confirmation `/auth/callback`, password sign-in, sign-out, role redirects, Host guards, and Admin/Moderator routes remain unchanged.
- [ ] **Step 8: Commit only durable test fixtures/docs if needed.** Do not commit generated accounts, tokens, invite links, or provider credentials.

---

## Task 8: Full regression, typecheck, lint, build, and browser surface verification

**Files:** None expected; fix only task-owned source/test/docs issues found by verification.

- [ ] **Step 1: Run complete automated checks.**
  ```bash
  npm test -- --run
  npm run lint
  npm run build
  ```
  `npm run build` includes `tsc -b`; record exact counts and any non-blocking pre-existing warnings.
- [ ] **Step 2: Verify deep links.** With the local dev server, directly load and refresh `/auth/invite`, `/auth/callback`, `/host`, and `/admin`; assert no platform 404 and no premature `/` navigation.
- [ ] **Step 3: Browser matrix.** At 375, 768, 1024, and 1440 pixels verify invite setup/error states, no horizontal overflow, keyboard focus, alert/status semantics, public/admin visual language, and no console errors.
- [ ] **Step 4: Inspect repository for secrets and malformed URLs.** Search tracked source/build configuration for `service_role`, `RESEND_API_KEY` values, `SEND_EMAIL_HOOK_SECRET` values, raw invite tokens, `/auth/inviteThen`, and client-side `inviteUserByEmail`; only names/placeholders/documented secret reads may remain.
- [ ] **Step 5: Commit fixes only if required.** Do not weaken tests or remove the fallback to force a pass.

---

## Task 9: Final release-readiness report and manual deployment handoff

**Files:**
- Modify: `Docs/operations/organizer-email-invitations.md` if verification produced exact final results.
- Create: no new source files.

- [ ] **Step 1: Record actual root causes and implementation results.** Distinguish the old direct SQL/temp-password flow from the new trusted Auth Admin API path and signed Auth Email Hook.
- [ ] **Step 2: Report exact manual production actions.** Include production redirect allowlist URL, Auth Hook URL/secret setup, Resend sender/domain/API secret setup, Invite template `{{ .ConfirmationURL}}`, Edge Function deploy commands, and Azure Static Web Apps deep-link result. Mark each as executed or not executed; do not claim hosted configuration changed from repo work.
- [ ] **Step 3: Report compatibility status.** State whether temporary-password fallback remains, whether Organizer email delivery is live-proven, and any exact blocker. If live email cannot be proven, Phase 6 remains incomplete for the original requirement.
- [ ] **Step 4: Report verification evidence.** Include function/unit tests, full suite/lint/build, real Admin→Organizer invitation, `/auth/invite` acceptance, setup/password, `/host`, reuse/expiry/malformed/unauthorized checks, and secret exposure scan.
- [ ] **Step 5: Commit final documentation.**
  ```bash
  git add Docs/operations/organizer-email-invitations.md
  git commit -m "docs(auth): record organizer invitation release readiness"
  ```

## Completion gate

The implementation may be described as complete only when Task 7 proves a **genuine emailed Supabase invitation**—not a temporary-password substitute—reaches `/auth/invite`, establishes a real Organizer session, permits required password setup, and routes to `/host`, with reuse/expiry/security/compatibility checks passing. If Resend/Auth Hook/hosted redirect configuration cannot be supplied, preserve the temporary-password fallback and report email invitations as incomplete.

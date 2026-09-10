# Phase 1 — Auth & Email Foundation: Operations Runbook

Repository changes for Phase 1 only add frontend/auth logic and documentation. No hosted Supabase, Resend, or Azure Static Web Apps setting has been changed by this repository work. This runbook consolidates every hosted step a human operator must perform (or verify) to make the auth/email foundation production-ready, and records the audit findings from Phase 1.

---

## 1. Architecture summary (as of Phase 1)

- One canonical auth callback route: `/auth/callback` (`src/components/Auth/AuthCallback.tsx`) handles signup confirmation, password recovery, and future OAuth/magic-link returns.
- Password recovery request: "Forgot password?" on `/signin` calls `resetPasswordForEmail` with `redirectTo: ${origin}/auth/callback`.
- Recovery detection: `exchangeCodeForSession` returns `redirectType: "recovery"` directly (or `type=recovery` on the legacy implicit-hash path) — no event subscription, nothing to race.
- Safe redirects: `isSafeInternalPath` + `resolveCallbackDestination` in `src/lib/authDestination.ts`; `/auth/callback` honors a `?next=` param (internal paths only).
- Auth intent hint: `src/lib/authIntent.ts` records a short `sessionStorage` hint of which flow (signup/recovery) the current tab initiated, so the callback's error copy is flow-appropriate.
- Transactional email: Supabase Auth email actions (signup confirmation, password recovery, invite, magic link) are sent via the `send-auth-email` Edge Function through Resend (when the Auth Hook is enabled), else by Supabase's built-in mailer.

## 2. Auth redirect URL configuration (manual, hosted Supabase)

In **Supabase Dashboard → Authentication → URL Configuration**, the redirect allowlist must contain:

```text
https://www.salsasegura.com/auth/callback
https://www.salsasegura.com/auth/invite
http://localhost:5173/auth/callback
http://localhost:5173/auth/invite
```

Notes:
- The canonical production hostname is `https://www.salsasegura.com` (README, ROADMAP, config.toml reference URLs, and CI/CD all use the `www` form).
- Redirect matching is exact (query strings are not stripped by default, though supabase-js now appends a reserved `flow_id` param which GoTrue strips server-side). Do not append query strings to these URLs.
- The `Site URL` should be `https://www.salsasegura.com`.

## 3. Email templates (manual, hosted Supabase)

Dashboard → Authentication → Email Templates:

- **Confirm signup**: paste from `auth-templates/confirm-signup.md` (uses `{{ .ConfirmationURL }}`).
- **Reset password**: paste from `auth-templates/reset-password.md` (uses `{{ .ConfirmationURL }}`).
- **Invite user**: paste from `auth-templates/invite-organizer.md` (uses `{{ .ConfirmationURL }}`).

## 4. Transactional email transport status (audit)

- `send-auth-email` Edge Function already supports all four email action types: `invite`, `signup`, `magiclink`, and `recovery`.
- Local development: the Auth Hook is wired in `supabase/config.toml`. However, **a valid `RESEND_API_KEY` is required for the hook to succeed** — without one, GoTrue transactionally rolls back the auth operation (signup/recovery/invite rows are deleted). Local sign-in (password grant) is unaffected.
- Production: per `Docs/operations/organizer-email-invitations.md` §8.2, the production Send Email hook, secrets, and redirect allowlist have **not yet been configured** in the hosted dashboard. Until that manual configuration is completed and verified, production auth emails (confirmation, recovery, invite) are sent by Supabase's default built-in mailer (rate-limited, not suitable for production use).

## 5. Required environment variables

- Frontend (`VITE_`-prefixed, set in Azure Static Web Apps / GitHub Actions secrets):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- Edge Functions (set via `supabase secrets set`, per `Docs/operations/organizer-email-invitations.md` §2):
  - `RESEND_API_KEY`
  - `SEND_EMAIL_HOOK_SECRET`
  - `AUTH_EXTERNAL_URL` (`https://www.salsasegura.com` in production)
  - `SUPABASE_SERVICE_ROLE_KEY` (platform-provided secret mechanism, never in source control)

## 6. Manual QA matrix

| Scenario | Expected Result | Status |
|---|---|---|
| New signup | Confirmation email arrives | Requires production Resend/hook config (see §4) |
| Confirm signup | User becomes authenticated, routed to role-appropriate destination | Verified locally (real browser, real GoTrue PKCE verify) |
| Confirmation link reused | Helpful recovery state (generic invalid-link card, back to sign in) | Verified locally |
| Confirmation link expired | Resend option (signup-intent hint from sessionStorage) | Verified via unit tests |
| Resend confirmation | New email sent, "Confirmation email sent" status | Verified via unit tests |
| Normal sign-in | Works normally | Verified locally (real sign-in + profile landing) |
| Forgot password | Recovery email sent, "if an account exists" generic message | Verified locally (real request, real token persisted) |
| Valid reset link | "Set a new password" form on /auth/callback | Verified locally (real PKCE recovery verify) |
| New password set | Password updated, user routed authenticated, new password works for sign-in | Verified locally end-to-end |
| Expired reset link | Helpful recovery state (recovery-intent hint, "Request a new reset email") | Verified via unit tests |
| Auth callback with safe `next` | Redirects to `next` destination | Verified via unit tests |
| Auth callback with external `next` | External redirect rejected, falls back to role default | Verified via unit tests |
| Mobile auth flow | No layout or navigation issues | Smoke-checked at 375px, no horizontal overflow |

## 7. Phase 1 findings (pre-existing defects discovered during audit)

1. **Duplicate migration timestamp collision (blocks local dev startup):** `supabase/migrations/20260830000000_account_deletion_storage_check.sql` and `20260830000000_phase6_host_organizer_access.sql` share the same `20260830000000` prefix, causing `schema_migrations_pkey` violation on any fresh `supabase db reset`. Recommended fix (outside Phase 1 scope): re-timestamp one migration file (e.g. `20260831000001_phase6_host_organizer_access.sql`).
2. **`_shared/invitation.ts` redirect constants stale:** `inviteRedirectUrl`/`isAllowedInviteRedirect` hardcoded `http://localhost:3000/auth/invite-confirm` and `https://salsasegura.com/auth/invite-confirm`, matching no registered route and no allowlist entry. Fixed in Phase 1 to `http://localhost:5173/auth/invite` / `https://www.salsasegura.com/auth/invite` (matching `config.toml`, `App.tsx` route, and `Docs/operations/organizer-email-invitations.md`).
3. **`detectSessionInUrl` auto-exchange race:** the client's automatic PKCE code exchange on construction raced the callback component's manual exchange (two token-endpoint calls for one code, and the automatic flow's `PASSWORD_RECOVERY` notification firing before the lazy-loaded component ever subscribed). Fixed in Phase 1: `detectSessionInUrl` is now `false`, both callback routes do all session handling manually.
4. **`AccountPage.tsx` unused eslint-disable (pre-existing):** `src/pages/AccountPage.tsx:297` has a `react-hooks/set-state-in-effect` disable directive that ESLint reports as unused. Pre-existing on committed `main`; out of Phase 1 scope.
5. **`HostEventDetailPage.tsx` missing modules (pre-existing):** imports `SalsaSeguraFallbackImage` and `eventFallbacks` which do not exist in the working tree. Pre-existing on committed `main`; out of Phase 1 scope.

# Phase 6 Final Fix — Organizer Email Invitations

## Context

The current Admin-created Organizer flow is not an email invitation. `AdminUsersPage` calls `profilesRepo.createUser()`, which calls `public.admin_invite_user`. That SQL `SECURITY DEFINER` RPC directly creates a confirmed `auth.users` account, assigns its role, returns a one-time temporary password, and requires the Admin to hand credentials over out-of-band.

The requested flow is a real Supabase invitation:

```text
Admin invites Organizer
  → trusted server calls auth.admin.inviteUserByEmail
  → Supabase Auth creates invitation state
  → authenticated Send Email Hook delivers an invite email through Resend
  → recipient accepts link
  → /auth/invite establishes the invitation session
  → recipient establishes a password
  → verified Organizer enters /host
```

This design extends—not replaces—the current temporary-password flow. Email delivery cannot be claimed complete until the deployed Auth Send Email Hook has Resend and webhook secrets configured and a live invitation has been accepted. Until then, the existing temporary-password route remains the supported fallback.

## Grounded state of the codebase

| Area | Verified current state | Consequence |
|---|---|---|
| Admin UI | `src/pages/AdminUsersPage.tsx` calls `useAdminUsers().createUser`; `src/components/Admin/AdminUserForm.tsx` says “No email is sent” and shows temp credentials after creation. | The UI needs an Organizer-specific invitation-method choice and a distinct email-invitation success state. |
| Browser repository | `src/features/admin/api/profilesRepo.ts#createUser` calls `supabase.rpc("admin_invite_user")`; `InvitedUser` contains `temp_password`. | Keep this RPC only for the explicit temporary-password fallback. Add a separate email invitation repository call; do not overload the RPC. |
| SQL invitation implementation | `supabase/migrations/20260820000000_fix_admin_invite_user.sql` directly inserts `auth.users` and `auth.identities`, assigns `raw_app_meta_data.role`, upserts `public.profiles`, and returns a generated temp password. | PostgreSQL does not call the Supabase Auth Admin API. A real invitation needs trusted server-side Admin API access. |
| Trusted runtime | `supabase/functions/send-email/index.ts` and `supabase/functions/liner-search/index.ts` already exist. | A narrowly scoped Supabase Edge Function is an existing project convention; no Azure Function or frontend secret is needed. |
| Email delivery | `send-email` already uses `RESEND_API_KEY` inside an Edge Function, but it is generic application mail. `supabase/config.toml` has no SMTP setup and no `[auth.hook.send_email]`. | Create a dedicated Auth-hook function; do not repurpose the generic caller-controlled mail endpoint for Auth tokens. |
| Auth callbacks | `/auth/callback` exists, exchanges PKCE `?code=` or verifies an existing session, then role-routes. It is deliberately confirmation/OAuth-focused. | Add a separate `/auth/invite` route; do not overload `/auth/callback`. |
| Role trust | `AuthContext` reads the single role from `user.app_metadata.role`; `profiles.role` is `text`, not an array. | The invite endpoint assigns `organizer` only in trusted `app_metadata`; never use `user_metadata` as authorization. Multi-role navigation is out of scope because it is not supported by the schema. |
| Current redirects | Local Auth allowlist contains `http://localhost:5173/auth/callback` only. | Add exact `/auth/invite` local URL; production requires exact `https://www.salsasegura.com/auth/invite` manual configuration. |
| Supabase hook contract | Official Send Email Hook payload contains signed `user` and `email_data` fields including `token_hash`, `redirect_to`, and `email_action_type`. Success is HTTP 200 with no required output. | Auth email function verifies Standard Webhooks signatures and sends `token_hash` verification links. |

## Core architecture decision

**Decision: implement two independent Supabase Edge Functions, plus a dedicated browser activation route.**

1. **`invite-organizer`** is a normal authenticated function invoked by an Admin browser session. It verifies the caller through Supabase Auth, checks trusted `app_metadata.role === "admin"`, calls `auth.admin.inviteUserByEmail`, assigns trusted Organizer role, upserts the profile, and returns a safe result.
2. **`send-auth-email`** is a Supabase Auth HTTPS Send Email Hook. It accepts only signed Supabase Auth webhook payloads, verifies their Standard Webhooks signature using `SEND_EMAIL_HOOK_SECRET`, then sends the correctly scoped email through Resend. It is deployed `--no-verify-jwt` because Auth itself—not a browser JWT—calls it; signature verification is mandatory.
3. **`/auth/invite`** is a distinct SPA route. It consumes the real invitation result, verifies a session and Organizer role, requires the recipient to set a password, then navigates to `/host`.

| Decision | Benefit | Cost / ripple |
|---|---|---|
| Separate `invite-organizer` function | Service-role key stays server-side; Admin authorization is explicit and testable. | New deployment + function secret/configuration. |
| Separate `send-auth-email` hook | Uses the exact Supabase Auth email-token lifecycle; Auth owns single-use/expiry semantics. | Requires Resend + webhook configuration before live email is available. |
| Dedicated `/auth/invite` route | Password setup and organizer-role check stay distinct from signup/OAuth callback behavior. | New page, route, tests, SPA deep-link configuration verification. |
| Explicit temp-password fallback | No regression while email delivery is unproven; Admin can still provision users. | Small extra UI branch and discriminated response type. |
| Compensating rollback after invite provisioning failure | No partial Organizer profile/role state survives an error. | An email may already have been sent before rollback; its link then fails safely and Admin can retry. |

## 1. Trusted invitation endpoint

### Function contract

Create `supabase/functions/invite-organizer/index.ts`.

Request body:

```ts
type InviteOrganizerRequest = {
  email: string;
  displayName?: string;
};
```

Success response:

```ts
type InviteOrganizerResponse = {
  userId: string;
  email: string;
  delivery: "email_invitation";
};
```

The client cannot supply a role or redirect URL. The only role issued by this endpoint is `organizer`; the only redirect is a deployment-owned configuration value:

```text
production: https://www.salsasegura.com/auth/invite
local:      http://localhost:5173/auth/invite
```

### Authorization and validation

1. Reject all non-`POST` methods.
2. Read the caller JWT from `Authorization: Bearer …` and validate it with a client using the caller token. Do not decode unverified JWT text.
3. Require `caller.app_metadata.role === "admin"`. Never inspect `user_metadata` for authorization.
4. Parse JSON strictly; normalize `email` with `trim().toLowerCase()`; reject absent, overlong, or syntactically invalid addresses with a safe 400 response.
5. Normalize an optional display name; bound its length; pass it only as user-facing profile/user metadata, never role metadata.
6. Construct no redirect from input. Read a server-owned `INVITE_REDIRECT_URL` secret/config value and validate it against an internal two-value allowlist (local/production values above).

### Provisioning sequence and failure behavior

1. Call the privileged `auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name } })` using the service-role Edge Function client.
2. If Auth returns duplicate/existing-account error, return an actionable but privacy-safe 409: “An account already exists for this email. Use the existing account or choose the temporary-password fallback only if the account is removed first.” Do not reveal account state to non-Admins; only authenticated Admins can invoke this endpoint.
3. On success, call `auth.admin.updateUserById(user.id, { app_metadata: { …existingAppMetadata, role: "organizer" } })`.
4. Upsert `public.profiles` for the same `id`, preserving `handle_new_user()` behavior and setting `display_name`, `role = "organizer"`, `status = "active"`.
5. Write one existing-style audit-log entry identifying email invitation issuance, without storing invitation links/tokens.
6. If role assignment, profile upsert, or audit persistence fails after Auth user creation, delete the just-created Auth user through the same service-role client and remove any partial profile data. Return a safe 500 retry error. If Supabase Auth has already delivered mail, the recipient’s link targets a deleted account and fails as expired/invalid; that is safe and recoverable through a new Admin invite.

`inviteUserByEmail` is not atomic with profile provisioning. The rollback provides a safe retry boundary; no contradictory role/profile state is retained.

## 2. Auth Send Email Hook + Resend delivery

### Hook function

Create `supabase/functions/send-auth-email/index.ts`, distinct from existing generic `send-email`.

- Accept `POST` only.
- Read the **raw request text** before parsing.
- Verify it with `standardwebhooks` `Webhook` using `SEND_EMAIL_HOOK_SECRET` after stripping the dashboard-generated `v1,whsec_` prefix. Standard Webhooks headers (`webhook-id`, `webhook-timestamp`, `webhook-signature`) are authoritative.
- Return HTTP 401 with the documented Auth Hook error object for signature, payload, or Resend failure. Never send mail for an unverifiable request.
- Use `RESEND_API_KEY` only from Edge Function secrets. No frontend module, browser network request, or response includes it.
- Support at least `invite`, `signup`, `magiclink`, and `recovery` email action types so enabling the hook does not silently break existing signup confirmation. Treat unsupported notification variants as an actionable error rather than sending a malformed message.
- Select an action-specific subject/body. The invite message must say “Accept invitation”, state that the invite is single-use, and link to the exact Auth verification URL.

### Confirmation URL construction

The hook builds the real Supabase verification URL from the verified payload—never from untrusted browser input:

```text
{AUTH_EXTERNAL_URL}/auth/v1/verify
  ?token={urlEncode(email_data.token_hash)}
  &type={urlEncode(email_data.email_action_type)}
  &redirect_to={urlEncode(email_data.redirect_to)}
```

Use `token_hash`, not the raw OTP `token`. `AUTH_EXTERNAL_URL` is a server-owned configuration value: production project Auth URL in hosted Edge Functions; `http://127.0.0.1:54321` locally. `redirect_to` was supplied by the trusted invitation endpoint for invites, and by existing known auth calls for signup/recovery.

### Required Supabase configuration

Local `supabase/config.toml` gains an Auth Send Email Hook URI that the Auth container can reach through the host gateway:

```toml
[auth.hook.send_email]
enabled = true
uri = "http://host.docker.internal:54321/functions/v1/send-auth-email"
```

The hook secret is never committed. Local use requires `SEND_EMAIL_HOOK_SECRET` and `RESEND_API_KEY` supplied through function secrets/environment. Production configuration is manual and documented in the deployment guide:

1. Deploy `send-auth-email` with `--no-verify-jwt`.
2. Store `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, and `AUTH_EXTERNAL_URL` as Supabase Function secrets.
3. In Supabase Dashboard → Authentication → Hooks, configure **Send Email** HTTPS hook to `https://<project-ref>.supabase.co/functions/v1/send-auth-email`, using the same generated webhook secret.
4. Keep email provider signups enabled.
5. Configure the Supabase Invite template to contain `{{ .ConfirmationURL }}` as a fallback/contract reference; the hook is the active delivery mechanism when enabled.

## 3. Invitation activation route

### Route and deep-link behavior

Add `/auth/invite` before the public `MainLayout` route in `src/App.tsx`. It must be an explicit SPA route, not a visual alias of `/auth/callback`.

Azure Static Web Apps must serve this direct URL through the app entrypoint. Verify an existing SPA fallback rule already covers it; add the narrow rewrite only if the repository proves it is missing. Test direct refresh locally and require production deep-link verification after deploy.

### `InviteActivationPage`

Create a dedicated component/page with these phases:

```text
processing → setup-password → redirecting
           ↘ error
```

1. On load, inspect Supabase-auth callback data:
   - If query contains `error` or `error_description`, show accessible invitation error.
   - If query contains PKCE `code`, call `exchangeCodeForSession(code)` once.
   - Otherwise read the session after Supabase client URL detection for legacy hash/fragment results.
2. If no session exists, display accessible error: link expired, invalid, malformed, or already used. Provide `Back to sign in`; do not claim email was resent.
3. Derive role with existing `roleFromUser(session.user)`. If it is not `organizer`, do not show password setup and do not navigate to `/host`. Display accessible authorization error with a sign-in link. The route does not grant roles.
4. For a verified Organizer, show an explicit password-setup form. Validate password using the same minimum length/password requirements as the current sign-up surface; call `supabase.auth.updateUser({ password })`.
5. Only after password update succeeds, navigate to `/host` with `replace: true`.
6. Preserve browser focus and use `role="alert"` for errors, `role="status"` while processing, semantic `<label>` controls, and clear submit state.

No password-recovery route is added. `/auth/reset-password` remains future work because the product has no current reset-password request/update flow.

## 4. Admin UI and compatibility boundary

### Form behavior

`AdminUserForm` gains an Organizer-specific "Delivery" field when role is `organizer`:

```text
Email invitation (default)
Temporary password (fallback)
```

- The default is **Email invitation** for Organizer, because that is the requested product flow.
- Switching away from Organizer removes the delivery choice and continues existing temporary-password creation for `user`, `moderator`, and `admin` roles.
- The old “No email is sent” hint becomes method-specific, truthful copy.
- Email success state says that an invitation email was sent and the recipient must accept it and set a password. It never renders `temp_password`.
- Fallback success preserves the current one-time credential handoff UI unchanged.
- Errors clearly distinguish configuration/delivery failure from duplicate account without exposing tokens, service errors, or secret details.

### Repository contract

Replace the single `InvitedUser` response assumption with a discriminated result:

```ts
type CreatedAccount =
  | { delivery: "email_invitation"; id: string; email: string; role: "organizer"; display_name: string | null; status: "active"; created_at: string }
  | { delivery: "temporary_password"; id: string; email: string; role: UserRole; display_name: string | null; username: string | null; status: AccountStatus; created_at: string; temp_password: string };
```

`profilesRepo` calls the authenticated Edge Function for the email branch and keeps `admin_invite_user` for the fallback branch. `useAdminUsers` still invalidates the same user/profile queries on either success.

## 5. Security model

| Boundary | Rule |
|---|---|
| Browser → invite function | Browser sends only email/display name and its access token; it cannot choose role, redirect, service key, or mail body. |
| Invite function authorization | Real caller verified through Supabase Auth; trusted `app_metadata.role === "admin"` required. |
| Function → Auth Admin API | Service-role key exists only in the Edge Function runtime. |
| Organizer role | Assigned only in trusted `app_metadata` by privileged Admin API; profile row mirrors it but does not authorize the route. |
| Auth email hook | Public JWT verification disabled solely because caller is Supabase Auth; Standard Webhooks signature verification is mandatory before parsing/sending. |
| Link token | Hook uses verified `token_hash`; recipient link goes through Supabase `/auth/v1/verify`; client never generates or receives a raw server token. |
| Redirect | Server-owned exact `/auth/invite` URL; no body/query-supplied target accepted. |
| Existing guards/RLS | `RequireOrganizer`, Admin/Reviewer guards, and database ownership policies remain authoritative; menu visibility is not authorization. |

## 6. Test and verification design

### Unit/component tests

1. `invite-organizer` function: rejects no/malformed JWT, non-Admin caller, malformed email, unsupported method, duplicate Auth user; invokes Auth Admin API with exact trusted `redirectTo`; assigns role through `app_metadata`; compensates on profile/audit failure; never includes secrets in result/logs.
2. `send-auth-email`: rejects invalid Standard Webhooks signatures; uses `token_hash`; sends invite to the verified recipient with exact `redirect_to`; rejects Resend failure safely; returns 200 success only after provider success.
3. `InviteActivationPage`: PKCE code exchange success → password setup; organizer password setup → `/host`; non-Organizer session is denied; no session/invalid/reused/error-param cases expose accessible error; update-password failure keeps setup visible and shows alert.
4. `profilesRepo`, `useAdminUsers`, `AdminUserForm`, and `AdminUsersPage`: default Organizer email delivery, fallback temp-password path, success rendering differences, error state, query invalidation.
5. Regression: existing signup, password sign-in, sign-out, role redirects, `/auth/callback`, Host guards, and temp-password Admin create flow remain unchanged.

### Real local/staging verification

1. Configure local Edge Function secrets; start functions and Auth hook.
2. Sign in as a real Admin, issue a real Organizer email invitation, and capture the hook payload/provider test delivery.
3. Verify the outgoing email uses the verified `token_hash` URL and exactly redirects to `/auth/invite`.
4. Accept once: establish session, set password, reach `/host`, refresh `/host`, confirm dashboard/navigation.
5. Reuse and expire invitation tokens: accessible errors, no session privilege escalation.
6. Regular user manually reaching `/auth/invite`: cannot gain Organizer access.
7. Non-Admin function caller: cannot issue invitation.
8. Inspect browser network/source artifacts: no service-role key, Resend key, webhook secret, or raw invite token exposed outside intended Supabase verification URL.
9. Test direct `/auth/invite` page load and refresh locally; verify production Azure Static Web Apps equivalent after deployment.
10. Run full tests, `tsc -b`, lint, and production build.

## Wireframe

### Admin Add User — Organizer selected

```text
┌ Add User ──────────────────────────────────────────────┐
│ Email          [ organizer@example.com                ] │
│ Display name   [ Optional                             ] │
│ Role           [ Organizer                        ▾   ] │
│                                                           │
│ Delivery                                                │
│ ◉ Email invitation                                      │
│   Sends a secure invitation. The organizer sets their   │
│   own password after accepting.                          │
│ ○ Temporary password (fallback)                          │
│   Creates an account now and shows credentials once.    │
│                                                           │
│                         [Cancel] [Send invitation]       │
└───────────────────────────────────────────────────────────┘
```

### Organizer invitation acceptance

```text
┌ Welcome to SalsaSegura ────────────────────────────────┐
│ You were invited to host events on SalsaSegura.          │
│                                                           │
│ Set your password                                         │
│ Password          [                         ]             │
│ Confirm password  [                         ]             │
│                                                           │
│                          [Finish setup and open Host]     │
└───────────────────────────────────────────────────────────┘
```

### Invalid/reused invitation

```text
┌ We couldn't complete your invitation ──────────────────┐
│ This link may have expired or already been used.         │
│                                                          │
│                         [Back to sign in]               │
└──────────────────────────────────────────────────────────┘
```

## What this phase does not decide

- Adding password recovery (`/auth/reset-password`) or a general “forgot password” UI.
- Supporting multi-role accounts; the production role model remains a single trusted `app_metadata.role` string.
- Replacing email invitation fallback for non-Organizer roles.
- Removing the temporary-password Organizer fallback before live email delivery is proven.
- Changing production Supabase dashboard, Azure Static Web Apps, DNS, or Resend secrets from this repository. Those steps are explicitly documented/manual and gate release completion.

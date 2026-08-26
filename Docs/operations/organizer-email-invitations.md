# Organizer email invitations — production operations

Repository changes only provide local configuration and copy/paste references. **No hosted Supabase, Resend, or Azure Static Web Apps setting has been changed by this repository work.** Complete every hosted step below in the production environment before enabling organizer invitations.

## 1. Deploy the Edge Functions

From the repository root, authenticated to the intended Supabase production project:

```bash
supabase functions deploy send-auth-email --no-verify-jwt
supabase functions deploy invite-organizer
```

`send-auth-email` is deliberately deployed without JWT verification because Supabase Auth calls it as an Auth Hook. The hook function itself must validate the hook secret. `invite-organizer` authorizes the inviting caller in its implementation.

## 2. Set production Function secrets

Set these on the target Supabase project. Use the secret values from the approved secret-management system; never commit or paste their values into this repository.

```bash
supabase secrets set RESEND_API_KEY=<approved-resend-api-key>
supabase secrets set SEND_EMAIL_HOOK_SECRET=<approved-random-hook-secret>
supabase secrets set AUTH_EXTERNAL_URL=https://www.salsasegura.com
```

`SUPABASE_SERVICE_ROLE_KEY` is required by the invitation workflow. Supply it through the platform-provided Function secret/environment mechanism for the production project; do not place a service-role key in source control, frontend configuration, or an email template.

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

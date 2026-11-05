# SalsaSegura social authentication — provider rollout

Status: Frontend implementation prepared; **providers are not activated** until their
OAuth applications are configured, secrets are stored in Supabase, and E2E testing passes.

## Production auth URLs

- Supabase project: `tlajzziavbnfomhfwofw`
- **Provider OAuth redirect URI** (register at Google, Apple, Meta):
  `https://tlajzziavbnfomhfwofw.supabase.co/auth/v1/callback`
- **App redirect URI** (allow in Supabase Auth > URL Configuration):
  `https://www.salsasegura.com/auth/callback`
- App canonical origin: `https://www.salsasegura.com`
- Local app redirect URIs: `http://localhost:5173/auth/callback`,
  `http://127.0.0.1:5173/auth/callback`, and ports 3000 when needed.

The **provider callback URI** goes to Supabase; the **app callback URI** goes to
SalsaSegura. Do not reverse them. Keep production redirects on the canonical www host.

## 1. Google

1. In Google Cloud Console, configure the OAuth consent screen/branding,
   authorized domain, and a **Web application** OAuth client.
2. Authorized JavaScript origin: `https://www.salsasegura.com`.
3. Authorized redirect URI: Supabase's `/auth/v1/callback` above.
4. In Supabase Authentication > Sign In / Providers > Google, enable the
   provider and enter the Google client ID and secret.
5. Use test users while the Google OAuth app is in testing mode, then publish
   the consent screen as appropriate. Test first login and repeated login.

Guide: https://supabase.com/docs/guides/auth/social-sign-in/auth-google

## 2. Apple

1. An Apple Developer Program membership is typically required to configure
   Sign in with Apple for a third-party website.
2. Create/configure the primary App ID, a **Services ID** for web sign-in, and
   Sign in with Apple signing key.
3. Configure the Services ID using the SalsaSegura domain and Supabase provider
   callback URI. If Apple requires domain verification, complete that step.
4. Create the Apple client secret (signed JWT) and set up Supabase's Apple
   provider with the proper identifier/key details.
5. Calendar a rotation for the Apple client secret **before its six-month
   maximum lifetime**. Do not store private keys in frontend code or the repo.
6. Test both personal and private-relay email variants. Do not assume a real
   email address is exposed, and do not require first name on subsequent logins.

Guide: https://supabase.com/docs/guides/auth/social-sign-in/auth-apple

## 3. Facebook (Meta)

1. Create a Meta developer app and configure **Facebook Login for Web**.
2. Configure the application domain, privacy-policy/data-deletion details
   as required, and valid OAuth redirect URI pointing to Supabase.
3. Enable the provider in Supabase using Meta App ID and App Secret.
4. Request the minimum `email` permission needed for Supabase signup;
   availability of the email claim is controlled by Meta and the person.
5. Start with Meta development-role test accounts, and complete required
   live mode/review steps before making Facebook sign-in public.

Guide: https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook

## 4. Enable one provider at a time

Production build env flags:

```dotenv
VITE_OAUTH_GOOGLE_ENABLED=false
VITE_OAUTH_APPLE_ENABLED=false
VITE_OAUTH_FACEBOOK_ENABLED=false
```

Switch each to `true` **only after** corresponding provider configuration
and callback verification, then rebuild/redeploy the frontend. The flags are
**public UI switches**, not OAuth configuration and not secrets.

Credentials (OAuth client secrets, Apple signing keys) belong in provider
consoles and Supabase Auth server-side settings. No provider secrets belong in
`VITE_*` variables, the repo, or `localStorage`.

## Existing app integration

- `SignInForm.tsx`: gated provider buttons when sign-in/sign-up is offered;
  no social controls for email-locked founder invite screens or password reset.
- `src/lib/authCallbackUrl.ts`: shared canonical return URL.
- `AuthCallback.tsx`: explicit PKCE `exchangeCodeForSession`; client intentionally
  disables automatic session exchange to avoid duplicate token consumption.
- `authReturnDestination.ts`: session-scoped return path preserved across OAuth;
  unsafe/external redirect targets are not accepted.
- `authIntent.ts`: OAuth intent for cancel/failure copy.
- `RequireOnboarding`: new OAuth accounts follow the existing profile flow.
- Existing email/password sign-in and all app-metadata role guards remain.
- Existing `auth.users` trigger `on_auth_user_created` creates profile rows.
- **No new public tables, RPCs, schema grants, or RLS bypasses are required.**

## Account identity behavior

Supabase may automatically link verified identities with the same email.
Do **not** manually merge users or profiles based on matching names or
unverified email strings. Apple private relay may yield a distinct address;
a separate user is possible. If needed later, offer authenticated, explicit
identity linking via Supabase rather than inventing a custom merge.

Existing privileged access must continue to depend on trusted app metadata,
not OAuth provider/user-editable metadata. Founder invite acceptance must still
verify the invited email; keeping social controls hidden for locked invitations
avoids an accidental change of auth account during acceptance.

## Acceptance checklist before switching a flag on

- [ ] Supabase provider enabled with actual external credentials.
- [ ] Provider redirect URI and Supabase allow-listed app callback exact.
- [ ] New user: successful OAuth -> account/profile -> onboarding.
- [ ] Existing user: repeat OAuth -> same Supabase user ID, no duplicate profile.
- [ ] Existing password user with same verified email: verify proper identity linking.
- [ ] Apple private relay tested; Facebook permission-denied tested.
- [ ] Provider cancel/error returns friendly feedback and no token logs.
- [ ] Return to requested internal route after social authentication.
- [ ] External/unsafe return destinations rejected.
- [ ] Founder invitation email cannot be circumvented by OAuth.
- [ ] Organizer/admin privilege remains unchanged across identity connections.
- [ ] Password reset/email confirmation paths continue to work.
- [ ] Verify browser tests and `npm run build` in CI.
- [ ] Deploy provider flag after test pass; monitor auth failures.

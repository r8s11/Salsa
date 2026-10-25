# SalsaSegura — Confirm signup email template

Paste into Supabase Dashboard → Authentication → Email Templates → Confirm signup.
Keep variables from Supabase; don't insert tokens manually.

---

## Sender branding (set in SMTP settings / from address)

- Sender email: `auth@salsasegura.com` (or a verified subdomain)
- Sender name: `SalsaSegura`

---

## Subject

```
Confirm your SalsaSegura account
```

---

## Body (HTML preferred; plain-text below for reference)

```html
<p>Welcome to SalsaSegura.</p>
<p>
  Confirm your email to finish creating your account and start discovering salsa, bachata, and other
  dance events.
</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm my email</a>
</p>
<p>If you didn't sign up for SalsaSegura, you can safely ignore this email.</p>
```

---

## Fallback / variables used

- `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` — **not** `{{ .ConfirmationURL }}`. `{{ .ConfirmationURL }}` resolves to Supabase's own single-shot `GET /auth/v1/verify`, which enterprise link scanners (Microsoft Safe Links, etc.) prefetch and silently consume before the recipient clicks — see Supabase's own documented guidance on this. `{{ .TokenHash }}` is the hashed, single-use verification token; never `{{ .Token }}` (the raw OTP).
- `/auth/confirm` is this app's own route (`src/components/Auth/ConfirmSignupPage.tsx`). It never calls `verifyOtp()` on page load — only after the user explicitly clicks "Confirm email" — so a prefetch/scan of the link (or the page simply rendering) can never consume the token.
- This is the fallback path used only when the Send Email Hook (`supabase/functions/send-auth-email`) is disabled; when the Hook is enabled it builds the same `/auth/confirm` URL directly from the webhook payload and this template is unused.

---

## Notes

- Tone: friendly, minimal, dance-focused, no marketing copy beyond the product name.
- `{{ .SiteURL }}` resolves to `https://www.salsasegura.com` in production (and `http://localhost:5173` locally via `supabase/config.toml`'s `site_url`).
- The user explicitly clicks "Confirm email" on `/auth/confirm`, which calls `supabase.auth.verifyOtp({ token_hash, type: "signup" })`, establishes the session, and navigates to a role-appropriate destination (`/host` for organizers, `/admin` for admins/moderators, `/profile` otherwise, or a preserved `?next=`/return destination).

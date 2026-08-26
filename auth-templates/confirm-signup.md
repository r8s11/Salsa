# SalsaSegura — Confirm signup email template

Paste into Supabase Dashboard → Authentication → Email Templates → Confirm signup.
Keep variables from Supabase; don't insert tokens manually.

---

## Sender branding (set in SMTP settings / from address)

- Sender email: `auth@salsasegura.com`   (or a verified subdomain)
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
<p>Confirm your email to finish creating your account and start discovering salsa, bachata, and other dance events.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm my email</a></p>
<p>If you didn't sign up for SalsaSegura, you can safely ignore this email.</p>
```

---

## Fallback / variables used

- `{{ .ConfirmationURL }}` — Supabase-managed confirmation link pointing to `/auth/callback` (already configured in `emailRedirectTo` and `supabase/config.toml`).
- No custom `{{ .Token }}` or `{{ .SiteURL }}` needed — the link carries the PKCE `?code=` return path set in Phase 2.

---

## Notes

- Tone: friendly, minimal, dance-focused, no marketing copy beyond the product name.
- The `emailRedirectTo` configured in Phase 2 ensures the confirmation link lands at `https://www.salsasegura.com/auth/callback` (and `http://localhost:5173/auth/callback` locally).
- Once the user clicks the link, `/auth/callback` exchanges the code, confirms the session, and navigates to `/`.

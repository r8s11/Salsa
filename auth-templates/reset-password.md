# SalsaSegura — Reset password email template

Paste into Supabase Dashboard → Authentication → Email Templates → Reset password.
Keep variables from Supabase; don't insert tokens manually.

---

## Sender branding (set in SMTP settings / from address)

- Sender email: `auth@salsasegura.com`   (or a verified subdomain)
- Sender name: `SalsaSegura`

---

## Subject

```
Reset your SalsaSegura password
```

---

## Body (HTML preferred; plain-text below for reference)

```html
<p>You requested a password reset for your SalsaSegura account.</p>
<p><a href="{{ .ConfirmationURL }}">Reset your password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

---

## Fallback / variables used

- `{{ .ConfirmationURL }}` — Supabase-managed reset link pointing to `/auth/callback` (already configured in `resetPasswordForEmail`'s `redirectTo` and `supabase/config.toml`).
- No custom `{{ .Token }}` or `{{ .SiteURL }}` needed — the link carries the PKCE `?code=` return path.

---

## Notes

- Tone: friendly, minimal, dance-focused, no marketing copy beyond the product name.
- The `resetPasswordForEmail` call in `AuthContext.tsx` sets `redirectTo: ${origin}/auth/callback`, ensuring the reset link lands at `https://www.salsasegura.com/auth/callback` (and `http://localhost:5173/auth/callback` locally).
- Once the user clicks the link, `/auth/callback` exchanges the code, detects a `redirectType: "recovery"` in the response, and shows a "Set a new password" form instead of navigating away immediately.
- After the new password is set, the user is signed in and routed to a role-appropriate destination (`/host` for organizers, `/admin` for admins/moderators, `/profile` otherwise), or to a safe `?next=` destination if explicitly provided.
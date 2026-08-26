# SalsaSegura — Organizer invitation email template

Paste these values into **Supabase Dashboard → Authentication → Email Templates → Invite user**. Keep Supabase variables intact; do not insert tokens, credentials, or a handcrafted invitation link.

## Subject

```text
You’re invited to organize events on SalsaSegura
```

## Body (HTML)

```html
<p>You’ve been invited to organize dance events on SalsaSegura.</p>
<p><a href="{{ .ConfirmationURL }}">Accept your organizer invitation</a></p>
<p>This invitation link expires according to the project’s Supabase Auth settings. If you were not expecting this invitation, you can safely ignore this email.</p>
```

## Required dashboard configuration

- The invitation flow must supply `https://www.salsasegura.com/auth/invite` as its production redirect URL (or `http://localhost:5173/auth/invite` locally).
- `{{ .ConfirmationURL }}` is the complete Supabase-generated invitation link. Do not replace it with a token or append a custom path.

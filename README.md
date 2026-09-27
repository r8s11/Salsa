# Salsa Segura

Boston & NYC Latin dance events calendar — [salsasegura.com](https://www.salsasegura.com)

The site shows salsa fanatics where to go dancing and lets the community submit events, without needing social media.

## Stack

React 19 · TypeScript · Vite · React Router v7 · Supabase · Schedule-X calendar · temporal-polyfill

Deployed to Azure Static Web Apps via GitHub Actions.

## Getting started

```bash
npm install
npm run dev
```

Requires a `.env` (or `.env.local`) with:

```ini
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
```

## Commands

| Command                 | Purpose                              |
| ----------------------- | ------------------------------------ |
| `npm run dev`           | Vite dev server                      |
| `npm run build`         | TypeScript check + production build  |
| `npm run test`          | Vitest test suite                    |
| `npm run lint`          | ESLint                               |
| `npm run format`        | Prettier                             |
| `npm run import-events` | Import events from an ICS feed (dry run by default) |

## Bulk flyer import

Organizer owners and managers can open **My Events → Import Flyers**; admins can open
**Events → Import Flyers**. Select multiple JPEG, PNG, or WebP images (up to 5 MB
each). The app uploads and analyzes each flyer, then shows its extracted details
beside an editable event form. Review each row, correct any missing or inaccurate
details, and skip flyers that should not be imported. Only reviewed, valid rows
are eligible for **Save reviewed drafts** or **Publish reviewed events**.
Failed rows remain visible so a successful row does not need to be imported again.
Flyer analysis requires the configured `extract-flyer` Supabase Edge Function.

## Documentation

- [docs/STATUS_SUMMARY.md](docs/STATUS_SUMMARY.md) — current project status
- [docs/ROADMAP.md](docs/ROADMAP.md) — 52-week roadmap
- [DESIGN.md](DESIGN.md) — "Ritmo Vivo" design system
- [docs/plans/MODERNIZATION_BLUEPRINT.md](docs/plans/MODERNIZATION_BLUEPRINT.md) — architecture audit & refactor plan
- [CLAUDE.md](CLAUDE.md) — agent/contributor guide

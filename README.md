# Salsa Segura

Boston & NYC Latin dance events calendar — [salsasegura.com](https://www.salsasegura.com)

The site shows salsa fanatics where to go dancing and lets the community submit events, without needing social media.

## Stack

React 19 · TypeScript · Vite · React Router v7 · Supabase · Schedule-X calendar · temporal-polyfill

Deployed to Azure Static Web Apps via GitHub Actions.

CI pins its runners to Ubuntu 24.04 and uses `actions/setup-node@v6` (Node 24 action
runtime); the application's Node version still comes from `.nvmrc`. Deployment
checkout disables persisted Git credentials before the Azure container runs,
avoiding credential-cleanup permission errors after deployment.

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

The site publishes `https://www.salsasegura.com` as its canonical host. After Vite
builds, the sitemap generator queries the public approved-event view with the
Supabase URL and publishable key; if those credentials or that view are unavailable,
it emits the stable public routes without event URLs. Azure Static Web Apps route
rules are path-based, so redirecting the non-`www` hostname requires domain or
edge configuration outside this repository.

The frontend is still a client-rendered SPA: route metadata and event structured
data update after JavaScript starts, while deep links initially receive the shared
HTML shell. Route-specific server rendering or prerendering is not configured.


## Public calendar and event suggestions

The calendar keeps Salsa Segura's dark nightlife identity. Desktop offers month,
week, list, and cards; compact screens offer list and cards. Search event titles,
venues, descriptions, and styles, then narrow by city, event type, or dance style.
**New event** is the calendar's single submission action and opens the form in place.
List view groups approved events by date in chronological batches of 50, with a
keyboard-accessible “Show more events” control. Rows show descriptions, category/style
labels, venue, and start–end times; multi-night events show their actual end date,
overnight events show a next-day marker, and unavailable flyers use event-type artwork.
The entire search bar uses a lazy-loaded `@paper-design/shaders` liquid-metal focus pulse:
650ms of motion, then a static frame; blur disposes it. Reduced-motion and non-WebGL
devices keep a static metal perimeter. Focus feedback stays around the whole bar
while moving between its icon, input, and clear button, without an inner input outline.
Clearing a search returns focus to the input.

On phones, date navigation and List/Cards share a row; type/style filters live in
a native **Filters** disclosure with an active-selection count. Selections persist
when it closes or the view changes. The header city picker replaces duplicate
calendar city controls. Narrow phones retain 44px view buttons with accessible
icon-only labels; short touch-device landscape viewports also use the compact list.

Guests can submit without an account when public suggestions are enabled. Contact
details and required event fields are validated; submissions enter the moderation
queue as `pending` and do not appear publicly until approved. A flyer is optional.
Events without one reuse the generated Sleeve cover and shareable poster system,
not an external image-generation service.

The submission form locks its fields while saving. If the submission-access check fails,
visitors can retry it in place without reloading the calendar.

### Component setup

TypeScript and Tailwind CSS v4 are configured. `components.json` maps shadcn's
`@/components/ui` alias to `src/components/ui/`, the reusable UI directory;
`@/lib/utils` supplies `cn`. Keep shared primitives there rather than creating a
second root-level `components/ui` tree. Global styles enter through
`src/styles/index.css`; calendar and dialog styles remain with the feature.
Tailwind utilities are enabled without Preflight so they do not reset existing
site styling. Semantic shadcn colors map to the current brand tokens.

`src/components/ui/event-manager.tsx` is a controlled calendar toolbar, not the
attachment's local demo-event store. Schedule-X and approved Supabase events
remain the source of truth. It reuses the existing `Button.tsx` and Radix Dialog;
public visitors cannot drag, edit, or delete approved listings.

## Bulk flyer import

Organizer owners and managers can open **My Events → Import Flyers**; admins can open
**Events → Import Flyers**. Select multiple JPEG, PNG, or WebP images (up to 5 MB
each). The app uploads and analyzes each flyer, then shows its extracted details
beside an editable event form. Review each row, correct any missing or inaccurate
details, and skip flyers that should not be imported. Only reviewed, valid rows
are eligible for **Save reviewed drafts** or **Publish reviewed events**.
Failed rows remain visible so a successful row does not need to be imported again.
If analysis fails after upload, retry analysis or continue with the retained flyer
and enter details manually. If saving fails, the row keeps its image and draft;
**Retry save** retries only that event with the original draft/publish choice.
The queue also shows analyzed, reviewed, and failed counts. Selected event facts stay
beside the flyer during editing; commit buttons show how many reviewed rows they will
attempt to save or publish.
Flyer analysis requires the configured `extract-flyer` Supabase Edge Function.

Flyer extraction also returns separate venue, organizer, instructor, and school
candidates, with contacts and geography only when printed. Review can reuse an
existing record, search for alternatives, edit, mark a candidate new, or remove it.
Automatic links require deterministic identity signals; ambiguous names remain
unresolved. Manual event values and deliberate entity choices survive retries.
Creation is optional: an event can be saved without resolving every candidate.

Anonymous uploads and pending submissions never create canonical entities.
Authenticated extraction runs server-side. Admin saves and moderator approval
atomically resolve authorized choices, create unverified flyer-sourced records,
and write explicit venue/organizer IDs plus instructor/school join rows. Host
bulk imports retain suggestions only. Existing metro data drives event geography.
Canonical public pages use `/v/:slug`, `/o/:slug`, `/i/:slug`, and `/s/:slug`;
their public projection excludes email and phone.

Deploy migration `20260929000000_flyer_entity_foundation.sql` after the existing
dynamic-metros migration, then deploy the updated `extract-flyer` function and
frontend together. The old venue-only `reconcile-flyer` function is retired;
matching uses authenticated database RPCs. Local verification:
`node scripts/verify-flyer-entities.mjs`, the rollback-only
`supabase/manual/flyer-entity-foundation-smoke.sql`, and
`bash supabase/manual/flyer-entity-foundation-concurrency.sh`.


## Host event access

Host event cards show **Manage Event** only when the user has active owner or manager
membership in that event's organizer. Other memberships show **View Event**.

## Repository layout

- `src/app/` owns routes and providers; `src/features/` owns feature-specific UI, hooks, and data access.
- Founder routes and their form live in `src/features/founder/pages/` and `src/features/founder/components/`; shared UI remains in `src/components/`.
- Admin route pages, tests, and CSS live in `src/features/admin/pages/`; the admin feature's hooks, models, and data access remain alongside them. Shared admin/host UI remains in `src/components/Admin/`.
- `docs/` is the single documentation tree (including historical plans and audits); `scripts/` holds executable tooling, and `supabase/` holds database and Edge Function assets.

## Documentation

- [docs/STATUS_SUMMARY.md](docs/STATUS_SUMMARY.md) — current project status
- [docs/ROADMAP.md](docs/ROADMAP.md) — 52-week roadmap
- [DESIGN.md](DESIGN.md) — "Ritmo Vivo" design system
- [docs/plans/MODERNIZATION_BLUEPRINT.md](docs/plans/MODERNIZATION_BLUEPRINT.md) — architecture audit & refactor plan
- [CLAUDE.md](CLAUDE.md) — agent/contributor guide

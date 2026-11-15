# Salsa Segura

City-scoped salsa and bachata events, classes, and live music — [salsasegura.com](https://www.salsasegura.com)

The site shows salsa fanatics where to go dancing and lets the community submit events, without needing social media.

Using the app? Start with the in-product [Help](https://www.salsasegura.com/help) for
dancers, DJs, venue owners/managers, organizers, artists, and school owners.

Canonical [user manuals](docs/user-guides/README.md) include [guest artist-event signup](docs/user-guides/dancers.md#sign-up-for-an-artist-event), [artist event publishing and private rosters](docs/user-guides/artists.md#create-and-publish-an-artist-event), and [organizer publication acknowledgements](docs/user-guides/organizers.md#before-you-publish). These additions were verified locally; [artist RSVP rollout prerequisites](docs/operations/events-and-geography.md#artist-events-and-rsvp-rollout) distinguish implementation from production availability and live email.

Geography follows **City → Borough → Neighborhood** in NYC and
**City → Neighborhood** elsewhere. The explorer keeps each level collapsible;
selecting a city or borough includes all its neighborhoods. Selected geography
persists locally and uses `?borough=` / `?neighborhood=` on city discovery URLs.
Changing a parent clears its selected child.

Deployment prerequisites and rollback-only database checks:
[Events and geography](docs/operations/events-and-geography.md#neighborhoods) ·
[Weekly itineraries](docs/operations/seo-and-itineraries.md#weekly-itinerary-database-verification).

## Stack

React 19 · TypeScript · Vite · React Router v7 · Supabase · Schedule-X calendar · temporal-polyfill

Deployed to Azure Static Web Apps via GitHub Actions.

CI pins its runners to Ubuntu 24.04 and uses `actions/setup-node@v6` (Node 24 action
runtime); the application's Node version still comes from `.nvmrc`. Deployment
checkout disables persisted Git credentials before the Azure container runs,
avoiding credential-cleanup permission errors after deployment.

## Getting started

Use the Node version in `.nvmrc`, then install locked dependencies:

```bash
npm ci
cp -n .env.example .env.local  # Preserve an existing local configuration
```

Configure `.env.local`:

```ini
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

PostHog requires a public project token (`phc_`), never a personal or secret API key.
Shopify configuration is optional; see the [storefront runbook](docs/operations/shopify-storefront.md).

Start the app after setting these values:

```bash
npm run dev
```

## Commands

| Command                 | Purpose                              |
| ----------------------- | ------------------------------------ |
| `npm run dev`           | Vite dev server                      |
| `npm run build`         | TypeScript check + production build  |
| `npx vitest run`        | Vitest test suite, single pass       |
| `npm run lint`          | ESLint                               |
| `npm run check:docs`    | Offline Markdown and instruction checks |
| `npm run format`        | Prettier                             |
| `npm run import-events` | Import events from an ICS feed (dry run by default) |

Vitest runs application test files serially to avoid CPU/memory contention
between DOM-heavy integration suites; test timeouts remain unchanged. Tests
under `.grok/skills/`, `.kiro/skills/`, `.vibe/skills/`, `.windsurf/skills/`, and
`data/skills/` are agent-skill `node:test` suites, not application tests, and
are excluded from Vitest discovery. Application `src/**` discovery is unchanged.

Shared browser API shims live in `src/test/setup.ts` and run before component
imports. The `matchMedia` shim defaults to nonmatching queries and supports
modern and legacy change listeners; media-sensitive tests supply their own matches.

### Documentation checks and protected instructions

Run `npm run check:docs` before submitting maintained documentation or shared-instruction
changes. The read-only checker validates local Markdown links and heading fragments,
canonical agent entry points, required headings, and protected Trail/Caveman blocks.
It runs offline; external URLs are not fetched. CI runs it after dependency installation
and before the existing lint, test, and build gates.

`scripts/docs-instructions.json` holds the reviewed required headings and SHA-256
fingerprints of protected blocks in `AGENTS.md`. A failure is not permission to refresh
the baseline. For an intentional protected-rule change:

1. Review the exact instruction diff, including prohibitions, with the reviewer approving
   the rule change. Preserve the block markers and required canonical headings.
2. After reviewing the text, calculate candidate hashes with Node's built-in crypto.
   This command normalizes CRLF to LF and hashes each complete block, including both
   markers but excluding the newline after the closing marker. It prints candidates;
   it does not update files.

   ```bash
   node --input-type=module <<'NODE'
   import { readFileSync } from 'node:fs';
   import { createHash } from 'node:crypto';

   const text = readFileSync('AGENTS.md', 'utf8').replace(/\r\n/g, '\n');
   const { blocks } = JSON.parse(readFileSync('scripts/docs-instructions.json', 'utf8'));
   for (const { name, start, end } of blocks) {
     const first = text.indexOf(start);
     const last = text.indexOf(end);
     if (first < 0 || last < first + start.length ||
         text.indexOf(start, first + start.length) !== -1 ||
         text.indexOf(end, last + end.length) !== -1) {
       throw new Error(`Missing, duplicated, or misplaced markers: ${name}`);
     }
     const block = text.slice(first, last + end.length);
     console.log(name, createHash('sha256').update(block).digest('hex'));
   }
   NODE
   ```

3. Manually replace only the affected `sha256` values in
   `scripts/docs-instructions.json`. Include the instruction diff, baseline diff, and
   reason for the change in the same review. Never auto-refresh hashes to silence failures.
4. Run `npm run check:docs` and `npx vitest run scripts/check-docs.test.mjs` before
   submitting the reviewed change.

## SEO and prerendering

Public routes receive build-time HTML; weekly itinerary previews use the Azure
Functions handler in `api/`. Read the [SEO and itinerary runbook](docs/operations/seo-and-itineraries.md)
for credentials, failure behavior, cache boundaries, deployment, and smoke checks.

### Weekly itinerary link previews

Runtime settings and local routing verification:
[Weekly itinerary link previews](docs/operations/seo-and-itineraries.md#weekly-itinerary-link-previews).

## Analytics baseline

Umami measures cookieless visits; PostHog uses memory-only persistence.
See [Analytics](docs/operations/analytics.md) for privacy boundaries, event meanings,
weekly returning-dancer reporting, and recurring-coverage verification.

### Weekly returning dancers

Reporting command, observation windows, and identity limits:
[Weekly returning dancers](docs/operations/analytics.md#weekly-returning-dancers).

### Recurring coverage

Score definition, deployment prerequisite, and database smoke:
[Recurring coverage](docs/operations/analytics.md#recurring-coverage).

## Native Shopify shop

Shopify owns products, prices, cart totals, and checkout. Retail Edit is the
production storefront. See the [storefront runbook](docs/operations/shopify-storefront.md)
for public-token setup, merchant prerequisites, cart behavior, and offline tests.

## Public calendar and event suggestions

The calendar shows approved events; public suggestions enter moderation.
See [Events and geography](docs/operations/events-and-geography.md#public-calendar-and-event-suggestions)
for calendar interactions and submission behavior.

### Multiple flyers per event

Limits, primary-flyer behavior, and migration order:
[Multiple flyers per event](docs/operations/events-and-geography.md#multiple-flyers-per-event).

### NYC boroughs

Filtering, CSV import, and rollback-only database verification:
[NYC boroughs](docs/operations/events-and-geography.md#nyc-boroughs).

### Component setup

Shared primitives, Tailwind, and calendar ownership:
[Component setup](docs/operations/events-and-geography.md#component-setup).

## Bulk flyer import

Review, retries, entity matching, and deployment:
[Bulk flyer import](docs/operations/events-and-geography.md#bulk-flyer-import).

## Host event access

Active organizer owners and managers can manage events; other memberships can only view them.
See [Host event access](docs/operations/events-and-geography.md#host-event-access).

## Repository layout

- `src/app/` owns routes and providers; `src/features/` owns feature-specific UI, hooks, and data access.
- Founder routes and their form live in `src/features/founder/pages/` and `src/features/founder/components/`.
- Admin route pages live in `src/features/admin/pages/`; admin UI lives in `src/features/admin/components/<area>/` (`shell/`, `common/`, `events/`, `users/`, …). Host pages reuse `shell/` and `common/` from there.
- Auth guards, sign-in form, and auth landing pages live in `src/features/auth/`; event cards, the homepage events section, and the event modal live in `src/features/events/components/`; the host dashboard lives in `src/features/host/components/`.
- `src/components/` holds only cross-feature UI: `ui/` (primitives and brand), `layout/` (header, footer, mobile tab bar, city pill, scroll restoration, error boundary), `marketing/` (hero, home CTA, contact, work-in-progress), and `desk/` (operator desk layout).
- `docs/` is the single documentation tree (including historical plans and audits); `scripts/` holds executable tooling, and `supabase/` holds database and Edge Function assets.

## Documentation

- [Help](https://www.salsasegura.com/help) — in-product guides; canonical Markdown lives in [docs/user-guides/](docs/user-guides/README.md)
- [PRODUCT.md](PRODUCT.md) — product purpose, audiences, and constraints
- [DESIGN.md](DESIGN.md) — visual authority and interaction contracts
- [AGENTS.md](AGENTS.md) — shared coding-agent guidance; tool-specific entry points load this file
- [Operations](docs/operations/) — deployment prerequisites, integrations, and verification runbooks
- [Product improvement backlog](docs/user-guides/improvements.md) — guide-driven evidence and proposals
- [Status snapshot](docs/STATUS_SUMMARY.md) · [Roadmap](docs/ROADMAP.md) — dated progress and planning records
- [Modernization blueprint](docs/plans/MODERNIZATION_BLUEPRINT.md) · [Plans](docs/plans/) · [Audits](docs/audits/) — historical decisions and evidence; check dates before treating them as current
- [Archive](docs/archive/) — superseded guides retained for reference

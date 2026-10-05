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

Vitest runs application test files serially to avoid CPU/memory contention
between DOM-heavy integration suites; test timeouts remain unchanged. Tests
under `.grok/skills/`, `.kiro/skills/`, `.vibe/skills/`, `.windsurf/skills/`, and
`data/skills/` are agent-skill `node:test` suites, not application tests, and
are excluded from Vitest discovery. Application `src/**` discovery is unchanged.

The site publishes `https://www.salsasegura.com` as its canonical host. After Vite
builds, the sitemap generator queries approved events and the public entity
directory RPC with the Supabase URL and publishable key. If public reads are
unavailable, it retains the stable directory routes without inventing detail URLs.
Azure Static Web Apps route
rules are path-based, so redirecting the non-`www` hostname requires domain or
edge configuration outside this repository.

The frontend is still a client-rendered SPA: route metadata and event structured
data update after JavaScript starts, while deep links initially receive the shared
HTML shell. Route-specific server rendering or prerendering is not configured.

Entity routes, migration prerequisites, privacy boundaries, local verification,
and production acceptance steps are recorded in
[`docs/entity-accessibility-completion.md`](docs/entity-accessibility-completion.md).
Run `node scripts/entity-accessibility/verify.mjs` against the local Supabase
stack for real anonymous/admin JWT and RLS checks. The verifier refuses hosted
URLs; `--keep-fixtures` retains isolated browser fixtures, and
`--cleanup <artifact-path>` removes only those recorded fixtures.

## Native Shopify shop

Public routes `/shop` and `/shop/products/:handle` use the existing Salsa Segura
layout. Shopify Storefront API `2026-10` owns products, variants, prices,
availability, cart calculations, and checkout. Integration code lives in
`src/features/shopify/`; the app never processes payments or stores card data.

**Retail Edit is the production storefront**, not a development preview.
The catalog pairs an editorial product-photo hero and condensed display type
with whole-product photography, direct product links, checkout guidance and a
calendar CTA. Page-scoped GSAP/Lenis motion respects reduced motion and native
touch scrolling. Solar icons are bundled locally with attribution.
Product pages use named option buttons, a gallery, a details disclosure and
a mobile purchase bar above the public dock. Catalog navigation preloads
product data and uses a shared-image transition where supported; confirmed
adds animate into the cart. Reduced motion retains the same purchase flow
without either effect. The discarded Drop Grid and preview switcher are removed;
`?variant=retail` or `?variant=drop` no longer selects another design.
With JavaScript disabled, the app shell offers a static Salsa Segura shop
message and a direct link to the public merchant storefront.

Set these optional build-time values in `.env.local`:

```ini
VITE_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
VITE_SHOPIFY_STOREFRONT_TOKEN=your-public-storefront-token
```

Use the canonical `*.myshopify.com` domain without a URL scheme/path and a
**public Storefront access token** from Shopify's Headless sales channel.
Never supply Admin API tokens, private Storefront tokens, or app secrets:
Vite embeds `VITE_*` values in the browser bundle. Missing configuration leaves
the rest of the app usable and displays a shop-unavailable state.

Shell exports take precedence over `.env` and `.env.local`. After correcting the
domain, update or unset a stale `VITE_SHOPIFY_STORE_DOMAIN` export before starting
Vite or building; changing the file alone does not override an exported value.

For local launches/builds that must use the values already in `.env.local`,
clear inherited Shopify overrides for that process:

```bash
env -u VITE_SHOPIFY_STORE_DOMAIN -u VITE_SHOPIFY_STOREFRONT_TOKEN npm run dev
env -u VITE_SHOPIFY_STORE_DOMAIN -u VITE_SHOPIFY_STOREFRONT_TOKEN npm run build
```

Do not use these commands in CI where the intended values come from secrets.
No token or local environment-file change is required for the Retail Edit cutover.

In Shopify, install/configure the Headless channel, enable product and cart/
checkout Storefront access, and publish the intended products to that channel.
Configure variant inventory, currency/markets, shipping, taxes, payments, and
checkout branding in Shopify. Prices and availability are not duplicated locally.
For Azure Static Web Apps, set the two same-named GitHub repository secrets;
the existing workflow forwards them to both build steps. Rebuild/redeploy after
changing them: Azure runtime application settings do not replace Vite build values.

Current launch-blocker remediation and merchant-review policy drafts are in
[`docs/shopify-phase-2-6-readiness.md`](docs/shopify-phase-2-6-readiness.md);
the [Phase 2.5 report](docs/shopify-phase-2-5-readiness.md) is historical evidence.

The cart provider stores only the Shopify cart ID at
`salsasegura:shopify-cart-id`. It restores the cart on public-layout startup,
removes IDs confirmed missing by Shopify, and retains IDs on network failures.
Cart mutations display Shopify's returned quantities and totals. Warning-only
responses with a valid cart are accepted, with a curated adjustment notice;
Shopify user errors still report failure. Checkout follows Shopify's returned `checkoutUrl`.
Keyboard mutations keep focus with the affected item while controls are locked,
then restore an enabled action; removals focus a surviving item or Browse the shop.
Escape restores the opener, and deliberate focus movement is not overridden.
Mobile navigation retains its dialog semantics and focus handling; the header
can wrap at enlarged text sizes without hiding the Shop destination or menu toggle.

The catalog and product pages share the public site's navy, rose and gold UI.
Product galleries use Shopify image dimensions when available; named options,
sold-out choices and prices come from Shopify. Select a quantity before adding.
An add stays on the product page and announces success; open the cart to review
Shopify's returned quantities and estimated totals. Removing a line is separate
from decreasing its quantity. Shipping and taxes are calculated at Shopify checkout.
Changing products resets purchase options and quantity. Feedback from an in-flight
add does not appear on a different product after navigation.

Shop and product pages use the existing client-side metadata helpers with clean,
query-free canonicals. Product JSON-LD includes only supplied product data and
Shopify variant offers; it does not invent ratings, reviews or inventory counts.
This is not SSR: client-side metadata does **not** provide true server-rendered
product social previews to crawlers that do not execute JavaScript.

Focused tests mock Shopify and never contact a production shop:

```bash
npm test -- --run src/features/shopify src/app/App.shopRoutes.test.tsx
```

All exported documents in `src/features/shopify/api/operations.ts` are validated
offline against the credential-free
[`2026-10` schema fixture](src/features/shopify/api/fixtures/storefront-2026-10.schema.json),
retrieved from Shopify's public versioned introspection endpoint. The validation
uses GraphQL.js `parse`, `buildClientSchema`, and `validate`; CI makes no Shopify
request. Re-fetch and review the fixture only when intentionally updating the
API version. The Storefront client remains pinned to `2026-10`.

Run the schema check with:

```bash
npm test -- --run src/features/shopify/api/operations.schema.test.ts
```

The client distinguishes configuration, transport, HTTP, GraphQL, malformed
response, mutation, pagination, and invalid-checkout failures. Product, variant,
gallery-image and cart-line pages use Shopify cursors and fail rather than silently truncate.
Money remains Shopify decimal strings. Cart mutations keep Shopify-returned
quantities and totals; checkout accepts only Shopify-returned HTTPS URLs without
rewriting them.


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
- Founder routes and their form live in `src/features/founder/pages/` and `src/features/founder/components/`.
- Admin route pages live in `src/features/admin/pages/`; admin UI lives in `src/features/admin/components/<area>/` (`shell/`, `common/`, `events/`, `users/`, …). Host pages reuse `shell/` and `common/` from there.
- Auth guards, sign-in form, and auth landing pages live in `src/features/auth/`; event cards, the homepage events section, and the event modal live in `src/features/events/components/`; the host dashboard lives in `src/features/host/components/`.
- `src/components/` holds only cross-feature UI: `ui/` (primitives and brand), `layout/` (header, footer, mobile tab bar, city pill, scroll restoration, error boundary), `marketing/` (hero, home CTA, contact, work-in-progress), and `desk/` (operator desk layout).
- `docs/` is the single documentation tree (including historical plans and audits); `scripts/` holds executable tooling, and `supabase/` holds database and Edge Function assets.

## Documentation

- [docs/STATUS_SUMMARY.md](docs/STATUS_SUMMARY.md) — current project status
- [docs/ROADMAP.md](docs/ROADMAP.md) — 52-week roadmap
- [DESIGN.md](DESIGN.md) — "Ritmo Vivo" design system
- [docs/plans/MODERNIZATION_BLUEPRINT.md](docs/plans/MODERNIZATION_BLUEPRINT.md) — architecture audit & refactor plan
- [CLAUDE.md](CLAUDE.md) — agent/contributor guide

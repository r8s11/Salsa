# SEO and itinerary previews

Run commands from the repository root. [Project setup](../../README.md).

## Public route prerendering

The site publishes `https://www.salsasegura.com` as its canonical host. After Vite
builds, `scripts/generate-sitemap.mjs` and `scripts/prerender-routes.mjs` both take
their route list from `scripts/public-routes.mjs`: the stable routes in
`src/shared/seo/routeMeta.json` plus approved events (`public_events`) and public
entities (`public_entity_directory`), read with the Supabase URL and publishable
key. The sitemap warns and falls back to stable URLs if public reads fail; the
prerender fails the build instead, and writes only stable routes when no Supabase
credentials are configured. Azure Static Web Apps route
rules are path-based, so redirecting the non-`www` hostname requires domain or
edge configuration outside this repository.

Every public route is prerendered to `dist/<path>/index.html` with its own title,
description, canonical, robots and social tags and real content in `#app` (event
and entity pages also list their public details; event pages add `DanceEvent`
JSON-LD). React replaces that markup when JavaScript starts. The public homepage
in `dist/index.html` also remains the SPA fallback; it contains no private data.
Hosts must serve a directory's `index.html` for `/path` (nginx `try_files $uri $uri/index.html`, Azure Static Web Apps).
The pages are a build-time snapshot, so rebuild on a schedule or when events are
approved to keep crawlable content fresh.
For a no-JavaScript check, use the production nginx routing or request
`/path/index.html` explicitly in `vite preview`; its SPA fallback does not
resolve extensionless directory routes the same way as the production hosts.

Route metadata retains the branded social image when no page artwork is supplied.
Robots directives are created even when absent from the HTML shell and restored
on navigation. Event JSON-LD includes every available flyer, including a single
flyer; events without artwork do not receive invented event images.
SEO regression checks:
`npx vitest run src/shared/seo/useDocumentMeta.test.tsx src/utils/seo.test.ts scripts/generate-sitemap.test.mjs scripts/prerender-routes.test.mjs src/pages/EventsParamRoute.test.tsx src/pages/EventDetailPage.test.tsx`.

### Weekly itinerary link previews

`/itineraries/<metro>/<date>` is served dynamically by the anonymous Node 22
Azure Functions v4 handler in `api/`, not by the build-time prerender. It resolves
metro aliases and the week's Monday, then reads only `public_itineraries` using
the anon key. Published responses contain the immutable 1200×630 JPEG card;
`Cache-Control: no-cache` makes publishes and updates visible on the next request.
Missing/draft/invalid routes return noindex 404s without an image and with
`Cache-Control: no-store`; upstream failures return no-store 503s, not misleading
successful cards. External messaging apps can still keep their own preview caches.

Install API dependencies separately with `npm ci --prefix api`. Handler behavior
and metadata regression checks: `npx vitest run api`. For a local routing smoke,
build the SPA, then start the SWA CLI with Azure Functions Core Tools installed:

```sh
npm run build
ITINERARY_SITE_ORIGIN=http://localhost:4280 \
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY='<local anon key>' \
  npx @azure/static-web-apps-cli start dist --api-location api
curl -i http://localhost:4280/itineraries/new-york-city/<published-Monday>
curl -i -A 'WhatsApp/2' http://localhost:4280/itineraries/new-york-city/<published-Monday>
```

Use an existing published fixture: both requests should return 200, one `og:image`,
its 1200×630 dimensions, and the canonical itinerary URL. Also request an invalid
date and an unpublished week: both must return 404, `no-store`, `noindex`, and no
social image. Publish/update that week and request again to confirm immediate
metadata changes. These are operator smoke steps, not performed by the build.

Before deployment, set **runtime application settings** on the Azure Static Web
App: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Do not use a service-role key or rely
on the frontend's `VITE_*` build settings for the function. The shell is fetched
only from `https://www.salsasegura.com/index.html` and memoized per function
instance; request hosts never choose its origin. Optional
`ITINERARY_SITE_ORIGIN` explicitly overrides that trusted origin for local or
staging verification (including canonical URLs); omit it in production.

Optional `POSTHOG_PROJECT_TOKEN` (the `phc_` project token, never a `phx_`/`phs_`
key) sends function failures to [PostHog Logs](https://posthog.com/docs/logs/installation/nodejs)
over OTLP as service `salsa-segura-api`; `POSTHOG_HOST` defaults to
`https://us.i.posthog.com`. Unset → no log export.

After the smoke, deploy frontend and `api/` together through the existing Azure
Static Web Apps workflow (`api_location: "api"`); the first itinerary route rule
rewrites requests to `/api/itinerary-page`. Azure preserves the original path in
[`x-ms-original-url`](https://github.com/Azure/static-web-apps/issues/580#issuecomment-957971855).
The local SWA CLI can omit that header; the handler also accepts `request.url`
when it already contains the itinerary route, never a client-supplied query path.

Entity routes, migration prerequisites, privacy boundaries, local verification,
and production acceptance steps are recorded in
[`docs/entity-accessibility-completion.md`](../entity-accessibility-completion.md).
Run `node scripts/entity-accessibility/verify.mjs` against the local Supabase
stack for real anonymous/admin JWT and RLS checks. The verifier refuses hosted
URLs; `--keep-fixtures` retains isolated browser fixtures, and
`--cleanup <artifact-path>` removes only those recorded fixtures.

## Weekly itinerary database verification

Weekly itinerary database behavior checks (after applying
`supabase/migrations/20261103120000_weekly_itineraries.sql` to a disposable
local/staging database):

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/weekly_itineraries.sql
```

Run as `postgres` or an equivalent migration owner able to `SET ROLE anon`
and `authenticated`. No pgTAP needed: the script asserts SQL behavior,
catches exact expected SQLSTATEs, and rolls back its real auth, metro,
event and itinerary fixtures. It covers public visibility, active-moderator
RPC authority, validation, transitions, dance-night/DST boundaries, stale
render rejection and cover suppression. Do not reset or seed the hosted project
for this check. Cover registration accepts the exact in-memory header and every
selected item's public render facts (`set_itinerary_cover`'s `p_snapshot`), not
an upload-completion timestamp. A changed/deleted event or changed header/item
requires reloading and regenerating; publication rejects an obsolete source.
Fresh public reads compare the retained source with current canonical public
event facts, also closing concurrent edits after registration validation. This
comparison excludes private event fields and ignores derived flyer-cache warming
when its original artwork source is unchanged. Unavailable, cancelled, moved or
deleted picks disappear from fresh public reads; stale card URLs are suppressed
until regeneration. Already-shared JPEGs or messaging-app caches cannot be recalled.

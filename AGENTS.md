# AGENTS.md

Guidance for coding agents (Claude Code, Codex, Gemini, etc.) working in this repository.
`CLAUDE.md` imports this file; edit this file, not that one.

Salsa Segura is a city-scoped guide to salsa and bachata events, classes and live music, with
community submission, moderation, host (organizer) and admin workflows, a public entity
directory, and a Shopify-backed shop. Read `PRODUCT.md` for product context and `DESIGN.md`
before any UI change: it is the visual authority (Ritmo Vivo public site, Listings Desk admin,
The Sleeve poster) and documents most interaction contracts.

## Commands

```bash
npm run dev               # Vite dev server :5173
npm run build             # tsc -b && vite build; postbuild runs generate-sitemap + prerender-routes
npm run preview           # Serve the production build
npm test                  # Vitest (watch); `npx vitest run` for a single pass
npx vitest run src/path/to/file.test.tsx   # Single file
npm run lint              # ESLint, --max-warnings 0
npm run format            # Prettier, src/**/*.{ts,tsx,css} only
npm run import-events     # scripts/import-ics.mjs: dry run by default; --insert / --sql / --days=N
npm run db:start | db:stop | db:reset      # Local Supabase stack (Docker)
npm run check:admin-tokens                 # scripts/check-admin-tokens.sh
npm run verify:storage:no-docker           # bun scripts/storage-acceptance/verify.mjs
```

Edge functions in `supabase/functions/` are Deno: test them with `deno test`, never Vitest.

## Environment

`.env` / `.env.local` (see `.env.example`):

- Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`. `src/lib/supabase.ts`
  throws at startup without them.
- `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`: read in `src/main.tsx`, which throws in dev when they
  are missing. They are not in `.env.example`.
- Optional: `VITE_SHOPIFY_STORE_DOMAIN`, `VITE_SHOPIFY_STOREFRONT_TOKEN` (shop), `LINER_API_KEY`.
- `postbuild` prerendering fails the build if Supabase is configured and a fetch fails; without
  Supabase config only stable routes are prerendered.

## Stack

React 19, TypeScript, Vite, React Router v7, Supabase (Postgres, Auth, Storage, Deno edge
functions), TanStack Query v5, Schedule-X calendar, temporal-polyfill, Tailwind v4 (utilities
only, alongside hand-written CSS), Radix primitives, GSAP + Lenis + motion for animation,
Iconify Solar and Lucide icons, PostHog analytics, Shopify Storefront API.

## Layout

- `src/features/<feature>/`: feature modules with their own `api/`, `model/`, `hooks/` and
  `components/`. Features: account, admin, auth, calendar, entities, entity-matching, events,
  flyer-extraction, founder, host, metros, search, shopify, submit-event, workspaces.
- `src/components/`: cross-feature UI only (`ui/`, `layout/`, `marketing/`, `desk/`).
- `src/shared/`: cross-feature code (`a11y/`, `analytics/`, `forms/`, `hooks/`, `seo/`, `utils/`).
- `src/contexts/`: Auth, City and Theme providers with `useAuth` / `useCity` / `useTheme`.
- `src/app/`: `App.tsx` (routes) and `providers.tsx`
  (`StrictMode > QueryClientProvider > ThemeProvider > AuthProvider > CityProvider`).
- `src/layouts/`: `MainLayout` (public) and `AdminLayout` (shared by `/admin` and `/host`).
- `src/pages/`: route components. Some are thin shells (`HomePage`); others own real logic
  (`SubmitEventPage`, `UserEventEditPage`).
- `src/types/events.ts` is a re-export shim; new code imports from `src/features/events/model/*`.
- `supabase/migrations/`: SQL migrations; `supabase/functions/`: edge functions; `scripts/`:
  build, prerender, import and verification scripts; `docs/`: plans and audits.

## Routing

`src/app/App.tsx`. Public pages render inside `MainLayout`; pages other than `HomePage` are lazy.

- Public: `/`, `/calendar`, `/submit`, `/discover` and directory pages, `/about`, `/contact`,
  `/shop`, `/shop/:collection`, `/shop/products/:handle`.
- `/events/:id` (`EventsParamRoute`): a UUID or event slug opens `EventDetailPage`; a metro slug
  or alias renders the metro homepage and canonicalizes the URL.
- `/e/:code` short links; entity pages `/v/`, `/o/`, `/i/`, `/dj/`, `/s/` + `:slug`.
- `/admin` (`RequireReviewer`, some pages `RequireAdmin`) and `/host` (`RequireOrganizer`) use
  `AdminLayout`. `/signin`, `/auth/*` and `/founders*` sit outside the layouts.
- `/calendar?event=<id>` opens that event's modal via
  `src/features/calendar/hooks/useEventDeepLink.ts`; Escape closes it and strips the parameter
  (`useEscapeKey.ts` in the same folder).

## Events

Read path:

```
public_events view (approved events only)
  -> fetchApprovedEvents(city, subLocation?, neighborhood?)   src/features/events/api/eventsRepo.ts
  -> useEventsQuery: key ["events", city, subLocation(, neighborhood)]
  -> useEvents()                                              src/features/events/hooks/useEvent.ts
  -> databaseEventToScheduleX()                               src/features/events/model/convert.ts
```

- Query defaults (`staleTime` 5 min, `retry: 1`) are global, set in `src/app/providers.tsx`.
- Components and hooks never call Supabase directly; go through a feature's `api/*Repo.ts`.
  Event data is spread across several repos (`eventsRepo`, `admin/api/*`, `host/api/*`,
  `entities/api/entitiesRepo`). Privileged writes go through RPCs such as
  `save_event_with_entities`, `approve_event_submission` and `set_event_featured`, not direct
  updates.
- Public reads use projection views (`public_events`, `public_active_metros`,
  `public_active_locations`); the raw `events` table is not readable by anon users.
- Event types: `social`, `class`, `workshop`, `live_music`, `concert` (`model/types.ts`). An event
  can have several: `event_type` mirrors `event_types[1]`, and `image_url` mirrors
  `image_urls[1]` (maintained by database triggers).
- Status: `draft | pending | approved | rejected | cancelled | archived`. Only approved events are
  public.
- Featured events: `events.featured_at`, written only by the `set_event_featured` RPC. The
  homepage spotlights the earliest upcoming featured event, otherwise the next event.

## Metros and locations

`City` is any metro slug from `public.metros`, not a fixed list. `useCity()`
(`src/contexts/CityContext.tsx`) resolves the stored choice, profile, or approximate location,
and persists `salsa.metro`, `salsa.sublocation` (NYC borough) and `salsa.neighborhood`. Pickers
(`features/metros/components/MetroExplorer.tsx`, Discover) offer only locations with approved
upcoming events, and keep a failed lookup distinct from a verified-empty result.

## Time

`src/features/events/model/convert.ts` is the only place event datetimes are converted.
`event_date` is `timestamptz`, parsed as `Temporal.Instant` and shown in the zone from
`timeZoneForDisplay()` (`src/shared/utils/timezone.ts`: event, series, venue, then metro; default
`America/New_York`). Never use `new Date(` in `convert.ts`. Output is `"YYYY-MM-DD HH:mm"` for
Schedule-X; `DEFAULT_DURATION_HOURS = 4` when no end time is given. Each file that uses the
global `Temporal` must `import "temporal-polyfill/global"` itself.

## Submission

`/submit` (`src/pages/SubmitEventPage.tsx` + `features/submit-event/hooks/useSubmitEventForm.ts`):
optional flyer upload, then the `extract-flyer` edge function prefills the form. Signed-in
submitters can link existing venues, organizers, instructors and schools
(`features/entity-matching/`). Validation is in `submit-event/model/validation.ts`. Submitting
calls `createSubmission()` (`features/admin/api/submissionsRepo.ts`), which inserts into
`event_submissions`, then notifies via `send-submission-email`. Moderators approve with the
`approve_event_submission` RPC; nothing is public until approved.

## Database changes

- Add new migrations with a new timestamp; never edit an applied one. A migration must be applied
  to the deployed database before deploying the frontend that depends on it.
- When rebuilding a public view, keep existing column order and append new columns at the end.
  Keep `security_invoker = false` and the existing `revoke` / `grant` statements.
- `supabase/migrations/public_projections.test.ts` pins projection security in Vitest.

## SEO and prerendering

`src/shared/seo/useDocumentMeta.ts` (title and description with restore on unmount) wraps
`src/utils/seo.ts`; route metadata lives in `src/shared/seo/routeMeta.json`. After the build,
`scripts/generate-sitemap.mjs` and `scripts/prerender-routes.mjs` write the sitemap and static
HTML for public routes and metro homes. The calendar injects `DanceEvent` / `ItemList` JSON-LD.

## Styling

`src/main.tsx` imports `src/styles/index.css` (Tailwind theme and utilities, then `global.css`
and `handoff-bridge.css`). Without it every `var(--token)` resolves to nothing. `global.css`
holds tokens, resets and shared primitives; component styles live next to their component;
admin and form styles are in `admin.css` and `forms.css`. Use DESIGN.md tokens, not literal
colors or font sizes.

## Testing

Vitest + jsdom + Testing Library, `globals: true`, setup in `src/test/setup.ts` (polyfills
storage; `src/test/mockMetros.ts` provides metro fixtures). `fileParallelism` is off.
`vite.config.ts` `test.exclude` skips agent-tooling folders (`.claude/`, `.agents/`,
`.worktrees/`, skill mirrors) and `supabase/functions/`; don't remove those entries.
`npm run lint` lints the whole tree: untracked local folders such as `.agents/`, `agent/` and
`videos/` are not in the ESLint ignores and will fail lint if present.

## Deployment

Azure Static Web Apps (`staticwebapp.config.json`, `.github/workflows/`) and a Docker image
(`Dockerfile`: Node build, then nginx serving on port 3001 with SPA fallback).

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

<!-- trail:start -->
## Trail — repo context graph

This repo is indexed in `.trail/cache/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `trail map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `trail ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `trail grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `trail skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `trail callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `.trail/cache/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `trail ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `trail build` (deterministic,
no API key, $0).
<!-- trail:end -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

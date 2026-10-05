# Entity accessibility completion

Status: local implementation and acceptance complete. Production deployment,
Azure-hosted refresh acceptance, and official Supabase advisor reports remain
unverified; catalog advisor-equivalent checks passed with the findings below.

## Baseline

The existing anonymous calendar read used the approved-only `public_events`
projection. Organizer, Venue, School, and Instructor already had slugs and short
public routes (`/o`, `/v`, `/s`, `/i`), but their detail pages were minimal and
noindex; School and Instructor directories were placeholders. Series had no
table. Cities and taxonomy had registry/admin access but no public detail pages.
Venue and taxonomy admin directories already existed and were retained.
The public flyer helper admitted needs_review Venues, Schools, and Instructors,
and `public_events` exposed contact fields and cancellation metadata.
Full baseline: [`entity-accessibility-audit.md`](entity-accessibility-audit.md).

## Additions

### Database (`supabase/migrations/20260930000000_entity_accessibility.sql`)

Applied transactionally to the local stack (`psql -1 -v ON_ERROR_STOP=1`).

- **Tables/indexes**: `event_series`; `events.slug` (stable, unique,
  existing UUID routes preserved) and `events.series_id`; metros status
  lifecycle (`active|needs_review|archived`, NOT NULL); schools/instructors
  gain `description`/`image_url`. New indexes: `events_slug_key`,
  `events_series_date_status_idx`, `event_series_city_status_idx`,
  `event_series_venue_idx`, `event_series_organizer_idx`,
  `events_venue_date_status_idx`, `events_organizer_date_status_idx`,
  `events_approved_city_date_idx` (verified present in live catalog).
- **Public RPCs** (fixed `search_path=public,pg_temp`, execute granted only to
  `anon`/`authenticated`): `public_entity_detail(kind,slug)`,
  `public_entity_directory(kind,query,city,limit,offset)`,
  `public_event_entities(event_id)` and `public_flyer_entity`. Their internal
  allowlisted projector `entity_access_public_ref` is not executable by
  `anon`/`authenticated`. Every payload is built from an explicit field
  allowlist — contact/submitter/moderation/membership fields are structurally
  absent, not filtered downstream.
- **Admin RPCs** (execute to `authenticated`, body enforces
  `public.is_admin() AND account_is_active()`): `admin_entity_directory`,
  `admin_entity_detail`, `admin_entity_save` (create/edit/archive; partial
  payloads inherit identity fields; an existing public slug can never be
  replaced — attempts fail with 22023; duplicate rejection returns SQLSTATE
  23505; returns the same normalized row shape as detail), `admin_entity_merge`
  (explicit confirm; organizer donors with members refused).
- **Projections**: `public_events` recreated (approved-only, no contact or
  submitter keys, keeps `source_type`, and exposes `slug`/`series_id`/
  `event_taxonomy_terms`/`public_entities`. Private columns are removed outright,
  so their prior column positions are not preserved. `public_active_metros`
  remains active-only with its approved-upcoming gate.
- **RLS**: enabled on every `public` base table (catalog-verified: zero tables
  without RLS). Anon read of raw `events`/`venues`/`schools`/`instructors`/
  `event_series` denied (verified over the Data API); `metros` and
  `taxonomy_terms` anonymous policies require `status='active'`.
- **Guards**: `entity_access_guard_delete` converts hard deletes of linked
  series/organizers/schools/instructors into archive-required errors (23503).

### Frontend

- One public directory + detail implementation (`src/features/entities/`,
  `src/pages/PublicEntityPage.tsx`) serving all eight kinds: `/discover`,
  `/series`, `/organizers`, `/venues`, `/schools`, `/instructors`, `/cities`,
  `/styles` and `/series/:slug`, `/cities/:slug`, `/styles/:slug` alongside the
  preserved canonical short routes `/o/:slug`, `/v/:slug`, `/s/:slug`,
  `/i/:slug`, `/events/:slug`.
- One generic admin surface (`src/features/admin/entities/`) for Series,
  Organizers, Schools, Instructors: `/admin/{series,organizers,schools,
  instructors}` + `/new` + `/:id`, with search/status filters, quality-review
  flags, linked events, explicit create confirmation, archive, and confirmed
  merge dialogs. Venues/tags keep their existing admin pages.
- Event pages/cards link every displayed entity name via
  `EventEntityLinks` to its canonical route (proven live on a fixture event).
- SEO: title/description/canonical/robots per entity page, `noindex` fallback
  when not found; sitemap includes the eight directory routes plus entity
  detail URLs from `public_entity_directory`.
- Fixes found during verification: header city pill capped so long data-driven
  metro names cannot push the action cluster past the viewport; related-panel
  kind badges never break words.
- Two additional browser-proven fixes: image-free directory/event cards now
  use the full text width rather than the thumbnail column; admin search submits
  a complete query and preserves the status filter, avoiding lost keystrokes
  during per-character URL navigation.

## Verification evidence (all executed, local stack)

| Gate | Result |
| --- | --- |
| `node scripts/entity-accessibility/verify.mjs` | **403/403 checks, ok:true, exit 0**, empty stderr; DB/auth fixtures removed. Includes the stable-URL regression (failed before the fix: Series slug was replaceable; green after) |
| `--keep-fixtures` then `--cleanup <artifact>` | both paths exit 0; final catalog check found zero recorded fixture IDs in Events, Series, Organizers, Venues, Schools, Instructors, metros, taxonomy, and auth.users |
| `npm run build` (`tsc -b && vite build`) | green; sitemap regenerated after cleanup: 30 URLs, no verification fixture URLs |
| Final tree type check | `node node_modules/typescript/bin/tsc -b`: clean, exit 0 |
| Targeted ESLint | clean: public/admin entity modules, PublicEntityPage, and AdminEventEditor |
| Final unit verification | `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --pool=threads`: **227/227 files and 2327/2327 tests passed**, exit 0. The preceding contended run had one 5-second editor-test timeout. The manual-link retention case now uses single text-change events without raising its timeout or removing assertions; its focused file also passed 33/33. |
| Catalog lint (advisor-equivalent) | all 12 entity tables RLS-enabled with policies; every new function pins `search_path`; internal helpers not executable by `anon`/`authenticated`; public RPCs anon-executable; admin RPCs authenticated-only (body enforces admin) |
| Public routes, production preview, direct hard loads | All eight canonical kinds render names, canonical URLs, social titles, and live relations. Desktop 1440 and mobile 390 surfaces inspected; no horizontal overflow. Unknown slug: 404. Empty organizer has no upcoming/past events; an unmatched directory query shows its empty state. |
| Admin UI, real admin JWT, 1440 and 390 | `/admin/{series,organizers,schools,instructors,venues}` render search + status filter without errors or overflow; School detail shows 2 linked events, quality flags, Edit/Archive/Merge actions; slug field read-only on edit |
| Discovery directory and recovery | `/discover` lists all kinds; combined name/type/city filtering returns the matching School; keyboard Tab shows a 2px gold outline. A failed public detail request shows an error; retry restores live Instructor data. |
| Final admin search regression | 7/7 tests, targeted ESLint, and production build passed. Browser Enter submission retained the exact query and active-status filter. |
| Persistent admin/editor actions | School description saved; confirmed archive retained both linked events; existing-school selection saved without duplicate creation; event Series and other links remained intact. Create and merge confirmation dialogs exercised without creating unrelated rows. |

Verifier coverage highlights: all 8 kinds slug/empty/unknown lookups; inactive
and archived-city exclusion from detail/directory/Data API; approved-only
upcoming/past ordering; private-field exclusion (contact, submitter, phone,
internal notes, membership); anonymous raw-table denial; real-admin JWT vs
plain/spoofed-metadata denial (42501); organizer creation without membership;
strong-match reuse and ambiguous-match pending review; exact-duplicate 23505
rejection; Series empty-occurrence detail with venue/organizer links and
Organizer→default-only-Series link; school↔instructor relation through shared
events; Series defaults inheritance vs manual precedence; admin edit/archive/
merge link retention, member-donor refusal, unconfirmed-merge refusal.

## Limitations

- Evidence is local: production schema, Azure refresh, and hosted advisors are
  not inspectable from this environment.
- Organizer membership stays an independent boundary: entity creation never
  provisions accounts, roles, or Host Dashboard access.
- No inferred affiliations: school↔instructor and city/taxonomy relations are
  shown only where approved events provide evidence; Series links only explicit
  `venue_id`/`organizer_id`.
- Existing security-definer views are retained intentionally: anonymous users
  have no raw Events SELECT grant. Their approved/active filters and explicit
  public fields are the access boundary. Official advisors may flag these views;
  review those findings against this deliberate contract.
- Pre-existing duplicate slug indexes remain on `organizers`
  (`organizers_slug_key`, `organizers_slug_unique_idx`) and `venues`
  (`venues_slug_key`, `venues_slug_unique_idx`). They predate this work and were
  not dropped.
- Catalog checks found zero public security-definer functions without a fixed
  `search_path` and zero affected RLS tables without policies. Whitespace in
  `search_path=public, pg_temp` is intentional; exact no-space comparisons
  are not a valid security check.
- Five pre-existing foreign keys lack leading indexes:
  `events_submitter_id_fkey` and
  `{schools,venues,instructors,organizers}_source_submission_id_fkey`.
  Public School/Instructor/taxonomy reverse junction indexes are present.
  Review those older write/query workloads before adding indexes.
- Full-suite timeout runs occurred with the host swap full and sustained swap
  traffic. No timeout threshold was raised. These catalog checks are
  advisor-equivalent checks, not official Supabase advisor reports.
- Metadata is client-rendered. Deep links initially receive the shared HTML
  shell; route-specific SSR/prerendering is not configured.

## Production acceptance steps

1. Back up production and verify all prerequisite migrations and functions,
   including the dynamic-metro and flyer-entity foundation migrations. The local
   ledger is stale relative to manually applied objects; do not copy that drift
   or replay the entire history blindly.
2. Apply `20260930000000_entity_accessibility.sql` transactionally through the
   project's reviewed migration workflow, then build and deploy the frontend.
3. Run the local-only verifier against a disposable parity stack. It deliberately
   refuses hosted URLs; do not point it at production.
4. Confirm anonymous directory/detail/event reads and unauthorized admin writes
   on production with disposable approved fixtures and real per-role JWTs.
5. Hard-refresh every canonical route on Azure, inspect metadata and public
   entity links, and regenerate the production sitemap without local fixtures.
6. Run official Supabase security/performance advisors and resolve or document
   intentional findings. These official reports are unavailable here.
# Entity accessibility audit

## Scope and evidence boundary

Read-only audit recorded before application or database remediation. Evidence: current routes and page/repository source, migration SQL, and read-only catalog queries against the running **Salsa** local stack (`supabase_db_Salsa`, API 54331, DB 54332). The sibling stack was not touched. No production database was inspected. Repository SQL is not proof that a deployed database contains it.

## Verified inventory

| Entity | Database / public access | Client and existing routes | Verified accessibility gaps |
|---|---|---|---|
| Event | `events`; `public_events` approved-only projection; taxonomy junction; `eventsRepo.fetchApprovedEvents` and `fetchApprovedEventById`; owner/admin raw queries are separate | `EventsParamRoute`, `EventDetailPage`, calendar/home cards; `/events/:UUID`, `/e/:code`; metro home shares `/events/:metro` | No persisted event slug. Detail renders venue/host as text. `public_event_entities` has no client callers. No series link. Taxonomy is rendered but not a public detail surface. |
| Series | No Series table or RPC in the examined schema/foundation; events carry `recurrence='weekly'` only | No public/admin series route in the complete App route table; review kinds omit Series | Needs explicit entity model and event association, safe reads, defaults, public/admin surfaces. Do not infer recurring events belong together. |
| Organizer | `organizers`; events.organizer_id; `organizer_members`, `organizer_requests` are separate account-access models; `public_flyer_entity` and `public_event_entities` | `PublicEntityPage` `/o/:slug`; host organization/account request flows; no canonical organizer admin directory route | Detail noindex, minimal metadata, no events/series/discovery directory. Creating attribution must not create membership. |
| Venue | `venues`; events.venue_id; public flyer RPC; `venuesRepo`, `useAdminVenues`, `AdminVenuesPage`, `AdminVenueDetailPage` | `/v/:slug`; `/admin/venues`, `/admin/venues/:id`; event combobox | Public detail lacks events/discovery. Public helper includes needs_review. Existing venue admin search/status/quality/archive/merge should be reused. Raw delete repository comment promises a guard; database behavior must be tested, not assumed. |
| School | `schools`, `event_schools`; flyer reconciliation/write/read RPCs | `/s/:slug`; `/schools` is WorkInProgress; entity review slot `school` | Public needs_review exposure, placeholder directory, no linked events/instructors/admin directory. |
| Instructor | `instructors`, `event_instructors` (position ordering); flyer reconciliation/write/read RPCs | `/i/:slug`; `/instructors` is WorkInProgress; entity review instructors array | Public needs_review exposure, placeholder directory, no linked events/schools/admin directory. |
| Metropolitan city | `metros` registry; events.city canonical slug; `public_active_metros` approved-upcoming counts; metros repository/hooks and City context | Existing `/events/:metro` city home and homepage city discovery | No entity-detail route/description/status; registry SELECT permits all rows. Preserve existing city-aware home URLs and empty-metro discovery semantics. |
| Styles / taxonomy | `taxonomy_terms`, `event_taxonomy_terms`; active terms embedded in public_events; taxonomy admin repository/hooks/list/edit/merge | `/admin/tags`, `/admin/tags/new`, `/admin/tags/:id`; event chips | No public term detail/directory. Raw taxonomy SELECT policy allows inactive terms. Both dance_style and event_attribute need safe classified-event lookup. |

### Source evidence

- `src/app/App.tsx`: public routes 238–295; admin routes 90–210. Four short entity URLs already exist; retain them as canonical equivalents rather than creating competing long routes.
- `src/pages/PublicEntityPage.tsx`: direct restricted RPC read 30–40; unconditional noindex 41–48; minimal name/location/external-link rendering 69–106; no event queries.
- `src/pages/EventsParamRoute.tsx`: UUID vs metro routing 11–31; explicit metro selection before paint 34–44. Slug support must not break metro aliases or UUID links.
- `src/pages/EventDetailPage.tsx`: safe approved event lookup 78–95; UUID canonical 99–105; unlinked location/host names 225–234.
- `src/features/events/api/eventsRepo.ts`: public projection reads 52–76; raw ownership/admin paths 108–141; canonical write RPC 159–165.
- `src/features/admin/api/venuesRepo.ts`: existing enriched directory/detail, admin CRUD, merge and event counting. Existing venue and taxonomy management conventions are reusable.
- `src/features/admin/components/AdminEventEditor.tsx`: manual venue choice 138–149; entity review rendered only when entity_review exists 429–436. Thus non-flyer Organizer/School/Instructor selection is not always available.
- `src/features/entity-matching/EntityReviewSection.tsx`: existing record search and explicit selection, asynchronous reconciliation with stale-result protection, manual changes retained. New record confirmation and creation signals exist; retain the workflow rather than creating a second matcher.
- `src/features/entity-matching/entityReview.ts`: review decisions and manual-over-extraction merge contract. `EntityKind` includes venue/organizer/instructor/school, not Series.
- `supabase/migrations/20260929000000_flyer_entity_foundation.sql`: explicit school/instructor tables and junctions, normalized matching, sorted advisory locks and corroborated strong reuse, authorized atomic writes, moderator-confirmed submission review. Public helpers at 1825–1918 return narrow JSON. Venue/School/Instructor use status <> archived, which exposes needs_review. Organizer already uses active-only.
- `supabase/migrations/20260925000000_dynamic_metros.sql`: registry/reference policy and approved-upcoming discovery. A registered metro without upcoming events is intentionally absent from the selector.
- `scripts/generate-sitemap.mjs`: static URLs and approved UUID events only; no entity entries; query failure silently falls back to static URLs with warning.
- `staticwebapp.config.json`: SPA fallback exists; schools/instructors currently have noindex HTTP headers. Actual Azure refresh behavior requires deployment acceptance; local fallback can be exercised without deployment.

## Live local database: verified, not inferred from migrations

- All entity base tables inspected have RLS enabled.
- `events`, `venues`, `schools`, `instructors` have no anonymous SELECT grant. `organizers` and `organizer_members` have SELECT grants, but policies restrict records to admins/actual members; a grant alone does not prove exposure.
- `metros` and `taxonomy_terms` have anonymous SELECT grants and unconditional read policies; taxonomy includes inactive records.
- `public_events` and `public_active_metros` have `security_invoker=false`. This is deliberate because anon cannot read underlying events; changing invoker mode without changing access would break anonymous pages. Prefer explicit safe JSON RPCs for new entity access instead of exposing underlying rows.
- Live `public_events` includes `contact_email`, `contact_instagram`, `contact_website`, `source_type`, and cancellation metadata. Submitter fields are omitted. Contact privacy needs an explicit narrowed public contract, not reliance on SELECT *.
- Live `flyer_public_entity_json` exposes only named fields, excludes phone/private provenance, but admits needs_review venues/schools/instructors. Live `public_flyer_entity` has fixed search_path and returns null for unknown kinds/empty slugs.
- Slug unique indexes already exist on four flyer entities, metros and taxonomy; reverse event-school/instructor indexes exist. Venue and organizer each have redundant unique slug indexes. Related-event composite indexes and event/series slugs remain to add.
- Live has no Series table. Events has no slug/series_id. It has zero events/schools/instructors at audit time, so live pages cannot prove nonempty relationships until isolated fixtures are seeded.
- Migration ledger reports latest 20260830000000, while later tables/functions are present. **Manual schema drift is verified.** Do not reset this stack or replay all migrations blindly. Apply prerequisite-aware remediation transactionally and verify against both source contracts and live schema.

## RLS/privacy remediation decisions

1. Active/approved-only anonymous entity results, explicit public field allowlists, approved related events only. Exclude private contacts, submitter/review/internal notes, moderation and membership data.
2. Narrow public RPCs with fixed search_path and explicit grants; preserve account/host authorization separately. Keep existing safe event projection compatible while remove private values from public reads.
3. Add Series and relationships explicitly; never backfill relationships from matching names or recurrence strings. Generate stable slugs only where missing; preserve existing UUID/short/city URLs.
4. Add authenticated admin-only directory/detail/edit/archive/confirmed merge RPCs for missing directories. Preserve venue/taxonomy management; prevent destructive deletion of linked entities.
5. Always expose the existing entity review selector in editor. Extend canonical save for series_id; propagate selected Venue/Organizer only into empty Series defaults, never replace manual values.
6. Build one public detail/directory/search implementation over explicit kinds, preserve /v /o /s /i canonical URLs, add Series/City/Style routes, link cards/detail names, include sitemap/social metadata.

## Assumptions and unverified items

- Production schema, production grants, Azure responses, actual production content and advisor output have not been inspected.
- Existing matching, unauthorized-write denial, membership isolation and duplicate concurrency contracts are source-supported but not yet exercised in this audit. They require real role JWT/Data API verification.
- No direct school-instructor relationship is defined. Related schools/instructors can be shown only where approved shared events provide evidence; do not invent affiliations.
- No Supabase advisor MCP is mounted in this environment. Catalog-based advisor-equivalent security/performance checks can be run and explicitly labeled; official advisor output must remain a production acceptance step if unavailable.

## Verification plan

Permanent behavior tests plus real local Data API role matrix: all kinds slug lookup; active/approved filtering; exact privacy exclusions; upcoming/past relations; missing/empty; duplicate prevention and ambiguous creation; unauthenticated/ordinary-user edits; organizer membership isolation; empty-only Series defaults. Exercise public/admin desktop/mobile surfaces against fixtures, direct production-preview refresh, typecheck/unit/integration/build, and catalog security/performance lint. Record exact outcomes and remaining production-only acceptance in the completion document.

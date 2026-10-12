# Admin Analytics Phase 5 — operational decision support and reporting

## Prerequisite audit and release boundary

Execution was single-agent. Caveman, Graft and Impeccable were invoked directly; no subagents, delegated skills or worker agents were used. The indexed analytics repository, hook, model, existing administrator routes and earlier migrations were inspected before implementation. Impeccable's launcher treated `/admin/analytics` as a filesystem target rather than the application route; this was reported, and the incumbent dashboard and `DESIGN.md` supplied the actual visual context. No design-world replacement was performed. The language-server tool reported no server; Graft supplied the call graph and affected-test scope.

Phase 1 is locally verified, but its last production audit found a matching RPC without its migration-ledger entry and an older incompatible frontend. Phase 2 is locally verified but not production accepted. Phase 3 is locally verified; its last production inspection found no telemetry table. Phase 4 is locally verified, not production accepted. These findings come from the existing Phase 1–4 and release-readiness audits, not a new production inspection. Earlier full-suite gates remain unresolved. No production deployment, migration application, ledger reconciliation or live-data verification was authorized or performed here.

Local catalog inspection confirmed the actual `event_submissions` statuses (`pending`, `in_review`, `needs_information`, `approved`, `rejected`, `withdrawn`), its non-null timestamptz `submitted_at`, canonical `events.organizer_id`/`venue_id`, `events.city` referencing unique `metros.slug`, canonical `metros.id`, entity creation timestamps, event schedule/title constraints, dance taxonomy and Phase 3 interactions. `events.event_date` is non-null. There is no immutable event approval/publication timestamp. Neither current approved status nor mutable review/update timestamps establish historical approval activity.

## Architecture

The existing `analyticsRepo`, `useAdminAnalytics`, `dateRangeFor`, authenticated Supabase client, React Query, admin shell, native controls and route guards are reused. Phase 1–4 function definitions and signatures remain unchanged. One additional independently queried operations snapshot is keyed by administrator ID, activity boundaries and four queue offsets. New-key loading and failed refreshes hide old data; revoked administrator access hides cached operational data immediately. Other analytics sources remain usable when operations fail.

Migration `supabase/migrations/20261015000000_admin_analytics_phase5.sql` adds two read-only administrator RPCs:

- `admin_analytics_operations(from_date, to_date, metro_offset, organizer_offset, quality_offset, engagement_offset, page_size, minimum_views, maximum_ratio, healthy_inventory, limited_inventory)`.
- `admin_analytics_report(report_name, from_date, to_date, sort_by)`.

Both are STABLE SECURITY DEFINER with empty search paths, fully qualified sources, authenticated-subject and trusted `app_metadata.role = admin` checks before aggregation, allowlisted input parameters, and revoked PUBLIC/anonymous execution. Only authenticated execution is granted. No tables, views, indexes, policies, collection infrastructure, jobs, third-party services or dependencies were added. Source relations are `events`, `event_submissions`, `organizers`, `venues`, `metros`, `event_taxonomy_terms`, `taxonomy_terms`, `event_touches` and `auth.users`. The latter supplies aggregate account counts only; no raw Auth or submitter records are returned.

Aggregation runs in the database. Interaction rows are grouped before canonical event/entity joins. Taxonomy checks use EXISTS, not multiplicative joins. Entity participation uses distinct IDs. Operational sections fail independently to null, never an invented zero. Dashboard queues use 25-row pages and full totals, with stable canonical-ID tie-breaks. Export projections extend the bounded Phase 3/4 ranking contracts rather than incorrectly downloading only their first 50/25 rows.

## Inspectable metric definitions

### Action Center and destinations

Priority order is Critical, Attention, Informational. Pending review becomes Attention over 48 elapsed hours and Critical over seven elapsed days. Missing optional venue/organizer associations remain Informational. Required-title defects are Critical; recommended quality and critical/empty recorded metro inventory receive Attention. No weighted scores or automated mutations exist.

Actions reuse `/admin/submissions`, `/admin/events`, `/admin/events?edit=<canonical event ID>`, `/admin/organizers` and `/admin/organizers/<canonical ID>`. Metro coverage and quality actions expand their existing in-page disclosures. There is no metro-management route, so this limitation is visible; inventory review uses the existing Events page rather than an invented destination. Venue performance keeps the existing venue-management architecture. No email, invitation, contact, approval, reassignment or correction occurs here.

### Submission review

Current moderation backlog includes `pending` and `in_review` only, independent of the creation-period selector. Average and oldest age use `statement_timestamp() - submitted_at`, in elapsed hours; future timestamps have zero elapsed age. Empty backlog has null average/oldest age, not a fabricated measurement. Cumulative counts are strictly older than 24 hours, 48 hours and 168 hours. Mutually exclusive buckets are at most 24 hours, over 24–48 hours, over 48–168 hours, and over 168 hours. `needs_information` awaits the submitter and is excluded; approved/rejected/withdrawn states are unchanged and excluded.

### Metropolitan inventory

Upcoming inventory is approved events at or after today's Eastern midnight, preserving Phase 1–4 semantics including events earlier today. Seven/thirty-day horizons use exclusive Eastern midnight boundaries with calendar arithmetic, not fixed UTC-hour intervals. Counts use canonical metro IDs/slugs and distinct linked organizers/venues. Last known event date is the latest recorded currently approved schedule, which may be future; it is not a publication timestamp.

Only metros with recorded currently approved event associations enter Phase 5 inventory health. Never-active registry entries and draft-only metro associations are not labeled lost inventory. Zero upcoming events with approved past records is Previously active; upcoming events without recorded approved past records is Newly emerging; otherwise it is Currently active. Newly emerging is a stored-history classification, not proof of a launch date. No declining-inventory trend is claimed without snapshots.

Defaults: healthy at least five upcoming approved events; limited two through four; critical one; none zero. These configurable RPC parameters are product screening defaults, not statistical findings. Phase 4's broader registry coverage and fewer-than-three coverage threshold remain unchanged and separately labeled; Phase 5 deliberately adds a different, historical-presence-aware operational classification rather than silently redefining Phase 4.

### Organizer monitoring

All canonical organizers are counted, including archived entities, using `events.organizer_id`, never host text. Active has upcoming approved events. No Upcoming Events has approved event history but none upcoming. No Event History has no associated stored events. A fourth explicit state distinguishes organizers with associated records but no currently approved event history. The overall without-upcoming count includes no-history/unapproved-only entities; each is separately explained. Past-only means every associated event is an approved past event. Last occurred event is the latest approved schedule before today's Eastern midnight. Previously frequent is an explicit screening flag for at least five recorded approved past occurrences, not a claim about regular publishing or a rate of decline.

### Event quality

Only approved upcoming events enter the Phase 5 action queue. Missing canonical venue/organizer is optional/Informational. Missing usable flyer, location or address, canonical metro, or dance-style information is recommended/Attention. Blank required title is Critical. Missing schedules cannot occur under the inspected NOT NULL constraint and are not inferred from past schedules or absent optional detail fields.

Either original or poster HTTP(S) reference with a host, or a same-origin absolute path, satisfies the flyer-reference check, including root HTTP endpoints with query strings. Unsafe schemes, null/blank references do not. Network reachability, actual image contents and remote availability are not claimed. Location and address accept canonical venue fallback. Canonical dance-style taxonomy is authoritative; nonblank legacy styles are accepted when canonical links are absent. Location/address combine into one issue per event, preventing duplicate location issue rows. Counts distinguish affected events from issue rows. Phase 4's broader quality scopes and nonblank-flyer check remain intact; Phase 5's upcoming-only, reference-usability-aware queue is explicitly separate.

### Engagement opportunities

Phase 3 reporting signature and retained tracking history must exist, with history overlapping the reporting window. Otherwise the section is unavailable, not historical zeros. No tracking was fabricated or backfilled. Only currently approved events qualify; interaction timestamps, not event creation/schedule dates, define the activity cohort. Screening defaults are at least 25 detail views and an outbound ratio strictly below 5%, both configurable RPC parameters. The ratio is `(RSVP clicks + ticket clicks) / detail views * 100`, uncapped; it is an interaction ratio, not completed registration, purchase or attendance conversion. Shares are recorded actions; saves remain unsupported. Earliest retained interaction is not a claimed collection-start date.

### Platform activity

Events, actual Auth registrations, organizers and venues use authoritative `created_at`; submissions use `submitted_at`, across all submission statuses. Undated rows are excluded even for All time, unlike Phase 1's all-stored-row totals. This difference is visible and justified because activity requires a timestamp. First recorded metro event creation counts canonical metros whose earliest stored event creation timestamp lies within the period, across stored statuses; it is not approval/activation history. Approval activity is explicitly unavailable.

All finite periods reuse inclusive Eastern start and exclusive next-day midnight: 7, 30 or 90 calendar days including today. All time has null boundaries. Inventory, review backlog, organizer monitoring and quality remain current state, not retrospective creation cohorts.

## CSV reporting contract

Seven reports: Platform Overview, Event Performance, Organizer Performance, Venue Performance, Metro Coverage, Event Data Quality and Submission Review Summary. Overview reuses Phase 1 metrics plus the new timestamp activity and current metro distribution. Event Performance exports recorded event interactions, not just the visible top 50; canonical entity reports use the existing inventory/creation/interaction definitions across all entities, not the visible page. Selected period and applicable leaderboard order are passed to the secure reporting RPC. Queue pagination is not an export filter.

Reports disclose their current-state versus activity scope, inclusive/exclusive period boundaries, snapshot time, total matching rows and applied limit. Headers are stable, identifiers canonical, and schedule/creation dates rendered as human-readable Eastern timestamps with EST/EDT. UTC timestamps in arbitrary entity names are not converted as dates. No personal submitter/account/profile fields, invitation tokens or privileged credentials appear.

Exports are bounded to **10,000 rows per report**, with the full authorized matching count. Above the cap the UI, CSV coverage metadata and `-partial.csv` filename explicitly identify partial coverage; nothing labels a first page or capped report complete. The frontend rejects report payloads whose row count does not equal `min(total, limit)`. This prevents silent truncated responses. File names include report, selected period and actual Eastern export date: `salsasegura-analytics-<report>-<period>-YYYY-MM-DD[-partial].csv`.

CSV uses CRLF, UTF-8 BOM, correct quote/delimiter/newline escaping, and apostrophe neutralization of formula-like text beginning with `=`, `+`, `-` or `@`, including concealed whitespace/control prefixes. Real numeric cells keep their signs; only designated date columns are formatted. Unavailable values remain labeled unavailable rather than zero. A failed or unauthorized report creates no fabricated fallback. Unmounted/scope-replaced report controls discard in-flight responses before triggering a download.

## Database, browser and security verification

A disposable empty schema clone was restored from local Supabase, not production. `--no-owner` was required because the local postgres connection could not SET ROLE supabase_admin; the new database's default public schema was removed before restore. The extension-generated GraphQL grant was excluded, and restoration reached a default-privilege operation requiring another owner. Application tables/functions/policies and the relevant execution grants were restored; clone ownership/default-privilege parity with production is not claimed. Actual local Auth/PostgREST calls separately exercised the deployed local authorization boundary.

The Phase 5 SQL regression first failed because the RPC was absent, then passed after its migration. Later behavioral regressions caught and fixed a valid root HTTP flyer endpoint falsely marked missing. Final Phase 5 transactional assertions cover submission statuses/ages and exact 24/48/168-hour boundaries, Eastern-today inventory, healthy/limited/critical/none thresholds, canonical history and organizer classifications, optional versus critical quality, null/unsafe/valid flyers, canonical taxonomy without join multiplication, minimum-view and exact 5% screening boundaries, uncapped 124% click ratios, a spring-DST 23-hour reporting day, inclusive/exclusive export filtering, genuine empty sources, missing dependencies, denied roles, sanitized fields, stable pagination and an actual 10,004-organizer dataset returning a declared 10,000-row partial report with unique IDs. All fixtures roll back. Phase 1, 2, 3 and 4 SQL regressions also passed on the same isolated clone.

Actual local HTTP reporting returned administrator 200 for operations and all seven report types. Anonymous calls to both new RPCs returned 401/42501; regular, organizer, host and moderator calls returned 403/42501. Catalog snapshots before/after the local installation and fixture cleanup matched for existing relation grants/owners/RLS flags, policies and prior analytics/collection definitions/ACLs. No RLS or public-projection cutover was made.

A real local administrator session exercised the actual `/admin/analytics` route, not a mocked dashboard. Local verification fixtures supplied four pending submissions with cumulative backlogs 3/2/1 and approximately 78-hour average/192-hour oldest age, one critical-inventory emerging metro, one previously active empty metro, a canonical past-only organizer, and an event with 25 views, one RSVP click and one share (4% interaction ratio). These are test fixtures, not production platform metrics. Independent local SQL confirmed pending/backlog and inventory counts.

Seven real export controls produced actual Blob contents with the full authorized rows: overview 21, event performance 1, organizers 3, venues 19, metros 11, quality 511 issue rows and submission summary 9 metric rows in the exercised fixture snapshot. The formula-prefixed fixture event title was neutralized in event/quality exports. CSV boundaries were exercised for 7/30/90/all selections. An early browser response waiter captured a prior-period request; it was not accepted as proof of the next selection. Selected-period export metadata, direct scoped HTTP calls, query-isolation tests and SQL boundaries provide the scope evidence.

An intercepted operations HTTP 503 hid stale action counts/queues while existing overview metrics remained available. Retry recovered the actual fixture data. Keyboard report selection retained focus, a visible 2px outline and 44px height. Browser pagination exposed focus loss when pending state unmounted the pager; a failing regression was retained, controls were moved outside the loading boundary with guarded aria-disabled actions, and real keyboard pagination then retained focus on Next quality issues with a visible 2px outline.

Chromium review at **375×812, 768×1024 and 1440×900** showed matching document/viewport widths, readable labeled mobile table rows, long canonical names, expandable queues, visible severity labels and 44px interactive targets. The first mobile overflow scan counted intentionally clipped table headers, not body overflow. Final body/table/control checks excluded those hidden headers and found no overflow. Priority ordering and compact native report-help disclosure were refined in the bounded review. Impeccable's mechanical detector returned `[]` on the exercised implementation. Dedicated screen-reader, physical-device gestures and a separate dark-theme pass were not performed; this is not accessibility certification.

A local read-only EXPLAIN (ANALYZE, BUFFERS) operations invocation took 77.650ms on the exercised local workload. It is a wrapper timing, not a production load test or proof of inner-query index necessity. No index was added.

## Cleanup and production dependencies

All two local fixture events and their 27 interactions, four submissions, one organizer, one venue, three metros and five ephemeral Auth accounts were removed. The disposable schema clone was dropped, the managed browser released and the owned Vite smoke server stopped. Only the local Phase 5 RPC installation persists; no production state changed.

An authorized release still must reconcile the actual Phase 1 ledger/frontend mismatch, apply only reviewed prerequisite/Phase 2–5 definitions as needed, resolve or explicitly review full-suite gates, and deploy the matching frontend. Do not blanket-push unrelated migrations. Production engagement requires the separately reviewed Phase 3 collection/reporting release, retention ownership and privacy/abuse review. Then verify actual administrator counts, source availability, all denied roles, exports, earlier sections and all three viewports against production. A rollback restores the captured frontend and compatible RPC definitions/ACLs together; no application record correction or destructive history rewrite is involved.

## Changed paths

Existing: `src/features/admin/api/analyticsRepo.ts`, `src/features/admin/hooks/useAdminAnalytics.ts` and its test, `src/features/admin/pages/AdminAnalyticsPage.tsx` and its test.

New: `src/features/admin/model/operationalAnalytics.ts` and test; `src/features/admin/components/analytics/OperationalInsights.tsx`, CSS and test; `src/features/admin/components/analytics/AnalyticsReporting.tsx`; the Phase 5 migration; `sql/final-verification/admin-analytics-phase5-regression.sql`; this audit. Package manifests and unrelated product workflows remain unchanged.

## Final quality gates

The final post-repair pipeline passed **84 tests across eight affected analytics/authorization files**, `npm run lint -- --max-warnings 0`, `npm run build` and `git diff --check`. This includes the retained failing-before/passing-after pager-focus regression, CSV neutralization/partial-contract checks, query isolation, earlier dashboard sections and existing administrator guard coverage. TypeScript and Vite passed; the existing shared bundle above 500kB remains a build warning, not a failed gate. Phase 1–5 database regressions passed separately on the disposable schema clone.

The requested full `npx vitest run` was attempted with a 300-second deadline and did not complete. Its output reported three failures among 33 tests in the untouched `AdminEventEditor.extraction.test.tsx` file:

- `hands the reviewed entities and the admin's decisions to onSubmit`
- `keeps decided and edited candidates and never re-adds the original`
- `keeps a link the admin clicked when they edit the event's venue text`

No unrelated test or implementation was changed to suppress those failures. Their cause was not established in this task; the current run does not prove a new Phase 5 regression or independently establish baseline status. The prior release-readiness audit's fuller baseline classification and unresolved suite timeouts still apply. An incomplete full run is not a passing full-suite gate.

Implementation, focused tests, SQL, actual local HTTP/security, CSV and responsive-browser verification are complete. Production acceptance and the full-suite release gate remain unverified. The overall release verdict is **ADMIN ANALYTICS PHASE 5 NOT YET VERIFIED**.

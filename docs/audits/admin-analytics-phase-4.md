# Admin Analytics Phase 4 — organizer, venue and operational intelligence

## Preimplementation audit

Execution is single-agent only. Caveman, Graft and Impeccable are used directly; no delegated review or implementation is permitted.

The existing `/admin/analytics` route composes `AdminAnalyticsPage`, `useAdminAnalytics`, `analyticsRepo` and `analyticsQuery`. Phase 1's metrics RPC, Phase 2's timeseries RPC and Phase 3's engagement RPC remain separate, independently available sources. Existing admin cards, native period/sort controls, CSS, React Query, Supabase client and Eastern calendar boundaries are reusable. No charting library or new tracking system is needed.

Previous audit evidence does not establish production acceptance. Phase 1 has a recorded production RPC/migration-ledger/frontend mismatch. Phase 2 is not production accepted. Phase 3's production audit found no telemetry table; its collection/reporting and abuse controls were verified locally only. Earlier full-suite failures and repeated timeouts remain unresolved. This task neither deploys nor applies production migrations.

Local schema inspection confirms canonical `events.organizer_id` and `events.venue_id`; `organizers.id/name/status/created_at`; `venues.id/name/city/address_line1/status/created_at`; `events.city` referencing `metros.slug`; `events.event_date`, `created_at`, `image_url`, `poster_image_url`, `location`, `address`, `dance_styles`; canonical taxonomy links; and existing `event_touches(kind,touched_at,event_id)`. No reliable immutable publication timestamp exists. Event creation and mutable update timestamps must not be labeled publication time. Organizer membership/request/invitation rows are not event ownership relationships.

Admin SQL authority is a non-null authenticated subject plus trusted JWT `app_metadata.role = admin`. Existing analytics functions use SECURITY DEFINER with empty search paths and independent source availability. Preserve all existing RLS, grants and public projections.

## Definitions and response contract

- Organizer/venue totals count canonical entities, including archived entities, not name-matched hosts or locations. Active entities have at least one approved event scheduled at or after today's Eastern midnight, independent of the activity selector.
- Associated event totals use canonical IDs and all stored statuses, over the current stored history. Separate `created_events` uses `events.created_at` and the selected period. Upcoming counts always describe current approved inventory; past-only labels require approved past inventory and no other associated events.
- Organizer last publication is unavailable. Show latest approved past occurrence where available, not a fabricated publication date. Venue latest scheduled event uses the associated event's schedule; a separate last occurred date excludes future events.
- Leaderboards paginate server-side with stable count/name/ID ordering. Sort organizer rows by upcoming, total, views, RSVP or ticket counts; venue rows by upcoming, total, views or RSVP. Preserve controls during loading; do not display prior-sort/page/period results under new controls.
- Engagement uses Phase 3's existing recorded interactions and `touched_at`, attributed only through current canonical event IDs. Missing Phase 3 reporting contract, missing interaction source, empty tracking history or a period entirely before the earliest retained record yields unavailable engagement, not invented historical zeros. Earliest retained data is not proof of the tracking start date. No saves or completion claims.
- Relationships derive from event associations: organizer/venue pairs with event counts, organizer active metros from approved upcoming events, and venue dance styles from currently approved events. Canonical styles take precedence; distinct normalized legacy styles are fallback only. Bounded relationship previews disclose total distinct relationships and use existing admin navigation.
- Coverage includes canonical metro registry rows, even zero-inventory metros, with approved upcoming event counts and distinct canonical organizers/venues. Active metros have positive upcoming inventory. Low inventory means fewer than three upcoming events; limited participation means fewer than two canonical organizers in a metro with inventory. These are explicit counts/thresholds, not health scores. Declining inventory and stopped-publication claims remain unavailable without historical inventory snapshots/immutable publication history.
- Data quality reports only; no repair or workflow changes. Approved missing canonical associations are optional information. Upcoming missing flyer, location/address and taxonomy are recommended information. Canonical metro and inconsistent-city checks cover all stored events and describe recommended discovery information. Location/address checks consider existing canonical venue fallback. Blank titles or missing schedules are invalid required information. Each issue returns a count plus at most ten affected-record links; no private fields.

Finite activity periods reuse inclusive Eastern day start and exclusive next-day midnight, DST-safe through existing date utilities. All time has null boundaries. Entity creation counts use entity `created_at`; event creation uses event `created_at`; engagement uses `touched_at`; operational inventory, coverage and data quality are current state and do not silently become creation cohorts.

## Release constraints

Author one narrowly scoped administrator-only performance RPC without changing earlier RPC signatures or creating tables, views, tracking infrastructure, jobs or materialized views. Validate locally, including missing Phase 3 and individual source failures. No indexes without query-plan evidence. Production engagement remains unavailable until Phase 3 is released and accepted. Inventory intelligence must work independently.

An authorized release must reconcile prerequisite schema and migration history, apply the reviewed Phase 4 RPC, then deploy its matching frontend. Verify independent source counts, all denied roles, earlier dashboard sections and responsive layouts. Rollback restores the captured frontend and matching RPC definition/ACL together; no record rewriting, table deletion or silent ledger changes.

## Implemented architecture

`20261014000000_admin_analytics_phase4.sql` adds only `admin_analytics_entity_performance(from_date, to_date, organizer_sort, venue_sort, organizer_offset, venue_offset, page_size)`. Existing analytics and collection signatures remain unchanged. The new function is STABLE, SECURITY DEFINER, uses an empty search path, validates both date boundaries and allowlisted sorts/pagination, and checks authenticated administrator authority before any guarded source section. Default page size is 25; the database accepts only 1–100. Stable tie-breaks use entity name and canonical ID. Collaboration, metro and style previews return at most ten rows and disclose their total distinct relationships.

Engagement availability requires the Phase 3 reporting signature, a readable interaction source and retained records overlapping the requested historical coverage. Periods entirely before the earliest retained record, empty history and missing Phase 3 remain unavailable. A period with tracking history but no selected interactions may legitimately report zero. This availability check is not a production-acceptance flag: an authorized release must still verify Phase 3 collection, limits and real data. No tracking table, identifier, endpoint, SDK, retention process or new interaction kind was added.

Inventory sections remain independently available when an entity source fails. Missing collaboration/style/metro dependencies leave the affected preview unavailable rather than deleting otherwise healthy inventory. Coverage and quality fail independently. No raw event or interaction rows are downloaded for client-side counting; the response contains bounded rankings/previews, counts and non-private event/entity labels only.

The existing repository and hook now consume this fourth aggregate source. Query identity includes administrator ID, date boundaries, both sorts and both offsets. New-key pending data and failed refresh data are hidden, rather than presented under another selection. Existing overview/trend/engagement sections and refresh behavior are preserved. No unrelated page, public projection, RLS policy or workflow was changed.

## Verification evidence

### Database and access

The SQL regression first failed because the new RPC was absent, then passed after the migration on a disposable schema-only clone of the current local database. The clone required excluding GraphQL-wrapper grants for an extension-generated function unavailable in a new database; application definitions and permissions were restored completely. No production dump or production migration was performed.

Transactional regression fixtures cover canonical totals, today-at-Eastern-midnight inventory, past/draft/archived and unassociated events, entity creation cohorts, null event creation timestamps, canonical organizer/venue pairs, distinct cross-metro activity, canonical taxonomy precedence, legacy-style dedupe, engagement across multiple events, server pagination, untracked historical periods, invalid parameters, missing Phase 3/source dependencies, independent section failures and empty datasets. An unregistered nonblank legacy city is reported without modifying it. Every fixture and source rename rolls back.

Actual local HTTP calls returned 200 for an administrator, 401/42501 for anonymous reporting, and 403/42501 for regular, host, organizer and moderator reporting. The same four authenticated non-admin roles redirected away from `/admin/analytics`; anonymous navigation reached `/signin`. None issued private analytics RPCs. Administrator access used a real local Auth session, not a mocked dashboard.

Before/after local catalog snapshots were identical for relation grants/owners/RLS flags, policies, public view definitions and the Phase 1/2/3 analytics plus collection definitions/ACLs. Only the new Phase 4 RPC was added. No private profile, submitter identity, invitation token, service credential or authorization metadata is returned.

Independent local SQL matched the actual HTTP report for canonical organizer/venue totals, distinct active organizer/venue counts, approved missing associations, upcoming missing flyers and missing canonical metros. A local read-only `EXPLAIN (ANALYZE, BUFFERS)` invocation took 77.649ms on the exercised fixture/database workload; this is not a production load test or an inner-query plan study. No index was justified or added.

### Actual dashboard

Chromium exercised all four activity periods against local Supabase. Finite requests used the expected Eastern boundaries; All time used null boundaries. Active organizer/venue inventory stayed unchanged while all-time entity-creation totals differed. Real venue pagination returned 25 rows followed by the final two rows of the 27-venue verification dataset. Keyboard sorting retained selector focus, a visible 2px outline and a 44px control height. Real collaboration and existing management links were inspected.

The responsive review used 375×812, 768×1024 and 1440×900 with a long canonical organizer name. The first review caught a mobile specificity defect that retained the desktop 32% identity-cell width. The mobile override was corrected; final identity width was 309px at the 375px viewport. Final document widths matched each viewport and no table cell or intelligence container overflowed. Mobile tables use stacked labeled rows while retaining table headers/semantics. Physical-device gestures, a dedicated screen reader and a separate dark-theme pass remain unverified.

A real intercepted reporting HTTP 503 hid all Phase 4 rankings and showed a recoverable alert while the existing overview retained its actual counts. Retry restored the three intelligence tables. Early smoke synchronization captured one previous-period response before the new selection settled; verification was repeated with the current URL and request boundaries explicitly checked. The final 30-day request used September 12 through October 12 Eastern day boundaries, not the prior All-time request.

Impeccable's detector initially flagged a 1.25rem value outside the documented type ramp; it was replaced with the existing 1.125rem step. The review preserved admin tokens, typography, native controls, visible focus, collapsible relationship detail and bounded record previews. No delegated skill functionality or subagent was used.

### Quality gates and limitations

The final post-review pipeline passed **158 tests across nine files** (44.59s), `npm run lint -- --max-warnings 0`, `npm run build` and `git diff --check`. TypeScript and Vite completed successfully; the existing >500kB shared-chunk warning remains. The final Impeccable detector returned `[]` after the type-ramp correction. These commands cover the final mobile CSS and all affected Phase 1–4 plus public engagement paths, not a completed full suite.

The full suite was not rerun in Phase 4: earlier repeated 1,800-second runs and a 900-second broad-subset timeout remain unresolved release gates. Prior classification remains 25 original failures with baseline evidence, three current-only timeout outcomes and two unreproduced outcomes. Passing the affected paths does not prove a passing full suite or classify all prior failures as pre-existing. No unrelated test was rewritten. One forwarding-only RPC argument assertion in the affected repository test was removed; real response/error behavior, SQL date/sort tests and browser request verification cover the consumer contract instead.

All seven local event fixtures, four organizer fixtures, nine venue fixtures, three metros, two taxonomy fixtures and five ephemeral Auth accounts were removed. The clone was dropped, the managed browser was released and the smoke server stopped. Local migration installation was the only persistent database change. Production changes performed: **NONE**.

## Remaining production gates

Resolve or explicitly review prior full-suite readiness and migration-ledger/deployed-frontend mismatches. Reconcile the actual schema and apply only reviewed prerequisites and the Phase 4 RPC after authorization, then deploy the matching frontend. Organizer/venue inventory does not require Phase 3; production engagement remains unavailable without its reporting/collection release and verified history. Phase 3's distributed-abuse/payload-limit, retention-owner and consent/privacy review remain prerequisites for enabling production tracking.

Verify source counts, data-quality samples, date boundaries, pagination, denied roles, all earlier analytics sections and the three viewport sizes after the separately authorized release. Publication-history and declining-inventory metrics remain unavailable unless authoritative historical data is added in a separately scoped task. If rollback is needed, restore the captured frontend; restore a captured previous performance RPC/ACL if one existed. If this function was newly added, an unused admin-only RPC can remain installed rather than deleting data or rewriting migration history.

Changed paths: existing `analyticsQuery.ts`, `analyticsRepo.ts`, `useAdminAnalytics.ts`, `AdminAnalyticsPage.tsx` and their tests; new `EntityIntelligenceSection.tsx`, CSS and test; the tracked Phase 4 migration, transactional SQL regression and this audit. New dependencies, tables, views, indexes, background workers and materialized views: **NONE**.

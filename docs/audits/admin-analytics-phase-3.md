# Admin Analytics Phase 3 — audit and implementation contract

## Prerequisite audit (before Phase 3 changes)

Phase 1 and Phase 2 code/migrations exist, but neither phase is production-accepted. Phase 1 production RPC/ledger and frontend mismatch plus the unresolved full-suite gate are documented in `admin-analytics-phase-1.md` and `admin-analytics-release-readiness.md`. Phase 2's own audit says production deployment/live-data verification remain outstanding. No prior phase may be described as production verified.

The app already contains a suitable telemetry store and collection RPC in `20260922000000_event_demand_telemetry.sql`: `public.event_touches(id,event_id,kind,touched_at)` and `record_event_touch(uuid,text)`. Direct client table access is revoked; the RPC accepts only approved event IDs and the existing `view`/`rsvp_click` kinds. Client calls are nonblocking, swallow errors, and use `sessionStorage` to suppress repeated per-event/per-kind daily touches. `useEventViewTouch` is used only by the approved event detail page and full event modal, after event data resolves; cards/impressions do not call it. Direct production read-only catalog inspection found no `public.event_touches` table, so its production data collection is not live.

The only external event URL is `events.rsvp_link`; there is no separate ticket URL. The event has `price_type` (`free`/`paid`) and a nullable price amount. The existing modal labels paid event links “Get Tickets” and free links “RSVP · Free”; the detail-page CTA currently says “RSVP”. Phase 3 classifies a paid linked event as `ticket_click`, otherwise `rsvp_click`, without changing its destination or gating navigation. Public event details have native share, copy-link and WhatsApp actions; the modal has “Send to friends”/copy-link actions. Organizer/admin `EventShareControls` are not attendee-engagement surfaces and remain unchanged.

No attendee “save event” capability exists. “Save poster” downloads an image and is not an event save; no saves will be counted. No persistent visitor identifier, profile/email, IP, precise location, source URL, user-agent, query string, or tracking cookie is added. Existing sessionStorage deduplication for detail views is retained; outbound clicks and shares count each explicit action. Canonical `events.city`/`metros.slug` and `taxonomy_terms`/`event_taxonomy_terms` provide event-centric metro/style attribution. Canonical dance taxonomy overrides legacy event arrays, and one interaction counts once per distinct current style; overlapping style totals are not exclusive.

## Security and abuse decision

Reuse and narrowly extend `event_touches`; do not grant direct table reads/writes or create an open insert endpoint. Keep the public, fixed-argument RPC as the only ingestion path; reject null/malformed event IDs and unsupported interaction kinds, and silently discard unknown/non-public event IDs to avoid an event-existence oracle. Apply atomic server-side per-approved-event/per-interaction-type per-minute burst caps using a transaction advisory lock and existing timestamp/event indexes. This limits aggregate inflation without storing an IP, account, session identifier, or other visitor fingerprint. Cap is not a unique-visitor limit and does not claim to defeat distributed bots; disclose this limitation. The client submits only the fixed UUID and allowlisted kind, and tracking failures never block navigation.

The new reporting RPC is aggregate-only `SECURITY DEFINER` with empty search path, authenticated subject plus trusted administrator-role check before source exception handling. It returns no visitor-level records. Keep per-source sections nullable on failure, preserve the Phase 1/2 RPCs and all table/view grants, RLS, policies and public projections.

## Engagement definitions

- **Detail views:** explicit successful detail page/full event modal display; client session storage dedupes same event/kind/day across rerenders/remounts. The measure is not unique people; repeat opens suppressed within that browser tab's session/day.
- **RSVP clicks:** explicit external click for free/registration events with `rsvp_link`.
- **Ticket clicks:** explicit external click for paid events with `rsvp_link`. A click is not checkout completion or purchase.
- **Shares:** explicit share/copy-event-link/share-destination action; attempted share sheet activation counts even if dismissed. Poster download alone is not a share.
- **Saves:** unavailable; product has no event-save capability.
- **Outbound click-to-view ratio:** (RSVP + ticket clicks) / detail views × 100. Raw event counts, not unique people. Never cap; ratios above 100% are valid.
- **Metro/style grouping:** attributed by the event's canonical city and current canonical styles, not by viewer location. Multi-style interactions appear once in each linked style.
- **Ranking:** only tracked interactions in the selected Eastern calendar range. Status, title and scheduled date are the event's current values. Events without tracked interactions do not appear.

All periods reuse `dateRangeFor`: inclusive Eastern calendar start and exclusive next-day midnight; `interaction.touched_at` supplies the metric date, never the event schedule. All time has null boundaries. No backfill is inferred. The earliest recorded touch is a data-availability lower bound, not proof that collection started then. Actual production tracking start can only be stated after authorized deployment.

## Release dependencies

The Phase 1/2 production release remains unverified. Production read-only catalog access found no telemetry table, so the Phase 1 telemetry migration must be reconciled/applied in the authorized sequence before this Phase 3 migration, followed by the reviewed Phase 1 and Phase 2 RPC replacements and matching frontend. Never deploy only one component, apply production changes, alter a ledger, or claim live engagement without explicit authorization. No production migration/deployment is authorized in this task.

## Validation evidence

### Local implementation

The implementation extends the existing telemetry helper, store and collection RPC rather than adding an SDK, Edge Function, collector service or new table. `admin_event_engagement(timestamptz,timestamptz,text)` returns independently nullable summary, top-50 event rankings, metro and dance-style sections. SQL aggregates interaction rows before joining event metadata; canonical metro slugs remain distinct. Legacy style arrays are normalized and deduplicated before attribution, with canonical links authoritative and an Unspecified bucket for missing/blank styles. Deleted events cascade-delete their interactions; archived events retain existing interactions and report their current status, but cannot collect new activity.

The browser's existing Supabase RPC calls are fire-and-forget; external CTAs keep their existing new-tab navigation. Native share activation, event-link copy and destination share count as actions, including dismissed native share sheets; generating or downloading a poster alone does not count. Native-share fallback copying does not produce a second action. Instagram Story preview's explicit Share/Copy actions participate through an optional callback, leaving non-attendee callsites unchanged. Browser Do Not Track and Global Privacy Control suppress collection before any view marker is written. No event-save feature was added.

The server rejects null/unsupported kinds and malformed UUIDs, accepts only approved events, and allows outbound kinds only when a matching free/paid event has its external link. Unknown/non-public IDs are silent no-ops. PostgREST rejects unexpected RPC arguments rather than storing them. The fixed UUID/kind arguments prevent arbitrary counts, timestamps, identities or sources from being supplied. Existing gateway request-size controls were not changed or production-verified; oversized invalid kind values fail validation before lock/count/insert. Direct interaction-table read/write permissions remain revoked.

The per-event/per-kind cap is **120 interactions per UTC minute**, atomically serialized with a transaction advisory lock. This is burst containment, not reliable bot detection, unique sessions, per-IP limiting or a guarantee against slow/distributed inflation. Counters remain action counts subject to collection loss and abuse; production release requires operational review of this limitation. No Origin-header trust is used.

### Retention and historical availability

Keep raw interactions for **180 days** after collection is authorized. All-time engagement means retained recorded history, not activity before tracking existed. Do not backfill from event creation, URL presence or assumed traffic.

Cleanup is an operator-run monthly database maintenance step, not a new background service. Before execution, use read-only `SELECT count(*), min(touched_at), max(touched_at) FROM public.event_touches WHERE touched_at < now() - interval '180 days'` to review the affected cohort; after explicit maintenance authorization, delete only that cohort in a transaction. Retention cleanup was **not executed** in this task. Assign an operational owner and review retention/consent requirements before production activation; no jurisdiction-wide privacy-law compliance claim is made.

Actual production collection-start date is **unknown** because no deployment was authorized. `first_recorded_at` is only the earliest surviving stored interaction. Local fixtures are isolated verification data, not production engagement.

### Release order and rollback

1. Resolve or explicitly review Phase 1/2 release-readiness gates and deployed migration-ledger/frontend mismatch. Capture the deployed frontend, analytics/collection function definitions and ACLs securely.
2. Reconcile the actual telemetry-table prerequisite. In an authorized maintenance window, apply only reviewed telemetry and Phase 1/2 prerequisites followed by `20261013000000_admin_analytics_phase3.sql`; do not blanket-push unrelated migrations. The older telemetry migration replaces earlier analytics contracts, so the reviewed Phase 1/2 replacements must follow it before the database release is considered ready.
3. Verify administrator aggregation and anonymous/regular/host/organizer/moderator denial at the database boundary. Publish the matching frontend immediately after the compatible database is available; do not enable frontend collection before the reviewed collector is installed.
4. Verify a logged-out approved-event visit, exactly one intended view, RSVP/ticket navigation, ranking/filter/city/style totals, and core browsing during collection outage against real production data. Record the actual enablement date. Local tests do not satisfy production acceptance.
5. Rollback restores the captured frontend and compatible analytics definitions together. Disable public collection if the new collector must be withdrawn; do not revert to the old unrestricted collector or drop interaction history. Retain expanded kind constraints while ticket/share rows exist, rather than applying a destructive constraint rollback. Reload PostgREST and recheck public discovery and denied roles. Never rewrite migration history silently.

### Verification evidence

The migration and transactional SQL regression ran only on local Supabase and a disposable existing-schema snapshot clone. The clone accepted the reviewed telemetry → Phase 1 → Phase 2 → Phase 3 migration order. This establishes local schema compatibility, not a fresh production-schema guarantee. Fixtures rolled back.

SQL regression covers real counts, exclusive date filtering, ranking, canonical metro/style attribution, overlapping multi-style counts, fallback styles, Unspecified styles, admin/anonymous/regular/moderator/organizer authorization, revoked direct client table privileges, invalid/null kinds and IDs, unknown/non-approved IDs, burst-cap enforcement, and partial taxonomy-source failure without falsifying healthy sections.

Real local HTTP calls allowed admin aggregation and public valid collection. Anonymous reporting returned 401; regular/host/organizer/moderator reporting returned 403 (`42501`). Unsupported/null kinds and malformed IDs returned 400; unknown approved-ineligible IDs returned a no-op 204; unexpected arguments were rejected. Public browser detail display, RSVP click and copy-link produced exactly one view, one RSVP click and one share; reload kept the intended existing session/day view dedupe. Another RSVP click produced an uncapped 200% click-to-view ratio. All four date filters and ranking selection exercised the actual local RPC.

Chromium inspected the dashboard at **375×812**, **768×1024**, **1440×900**: no horizontal document/engagement overflow. Existing admin tokens, native labeled controls, text values alongside decorative bars, mobile card-stack rankings, and current admin event-management links are retained. A simulated reporting HTTP 503 hid engagement rankings while preserving overview data; retry recovered. A simulated collection outage left event browsing usable. Physical touch gestures, dedicated screen-reader testing and production UI acceptance remain unverified.

The Impeccable implementation-integrity detector returned `[]` for the changed dashboard/detail/modal/Story-share components. No unrelated design surface, Host Analytics, event-management workflow, authentication code or public projection was redesigned.

Final quality pipeline passed: `npm run lint -- --max-warnings 0`, `npm run build`, all **145 focused tests across eight affected files**, and `git diff --check`. Build retained the existing shared-chunk size warning; it did not fail. Focused coverage includes collection opt-out, render dedupe, outbound/share actions, independent reporting failures, date-query isolation, rounded and uncapped ratios, unavailable/empty states, and ranking-control focus retention.

The full suite was **not rerun for Phase 3**. Earlier release-readiness evidence remains unresolved: the original 30 failures across eight files and 1,800-second timeout were investigated against a baseline, with 25 baseline-supported failures, three current-only timeout outcomes and two unreproduced outcomes. Subsequent broad runs also timed out. Passing affected-path tests does not establish a passing full suite or classify every earlier outcome as pre-existing.

Final browser checks confirmed paid-event ticket collection and an uncapped **300%** click-to-view ratio. Keyboard ranking changes initially removed the focused selector during loading; keeping the selector mounted fixed this. The final native control remained focused, had a 44px height and visible 2px outline. A fresh-document Global Privacy Control check suppressed collection without preventing public event display. Signing out and opening `/admin/analytics` redirected to sign-in and issued no private analytics RPCs.

Local fixture events and accounts were removed, the disposable schema clone was dropped, browser tabs were closed and the smoke server was stopped. No production migrations, deployments, retention cleanup or production tracking verification were performed.

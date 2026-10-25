# Admin Analytics Phase 2 — audit and definitions

## Before implementation

The target is the existing `/admin/analytics` page, `AdminAnalyticsPage.tsx`, its `useAdminAnalytics` hook, `analyticsRepo.ts`, and `analyticsQuery.ts`. Phase 1 supplies five scalar cards and the sixth metric, a CSS-bar city distribution, through `admin_analytics_metrics`. That RPC remains unchanged. There is no installed charting library to reuse. The existing unused `admin_analytics_timeseries(timestamptz,timestamptz,text)` will be replaced in place, not supplemented with another analytics service. React Query, the existing Supabase client, admin route guard, period selector, Eastern date utilities, page styling, canonical metro relationships and taxonomy tables are reused.

Local and read-only production catalog inspection confirm `events.created_at`, `event_date`, `status`, `city`, `organizer_id`, `dance_styles`; `event_submissions.submitted_at`, `reviewed_at`, `status`; `auth.users.created_at`; `metros.slug`, `name`; and `taxonomy_terms` / `event_taxonomy_terms`. Event city references the unique canonical metro slug. Canonical dance-style assignments can differ from the legacy array: `replace_event_taxonomy_terms` does not synchronize `events.dance_styles`. Canonical dance-style links therefore take precedence, with legacy fallback only when an event has no canonical dance-style links.

## Phase 1 readiness

Phase 1 focused local validation passed. Production acceptance remains blocked: the production metrics RPC definition matches Phase 1, but its migration ledger entry is absent, and the served frontend still has the older analytics contract. No authenticated administrator production browser verification exists. Do not blindly apply or reconcile the ledger, and do not deploy without authorization. See `admin-analytics-release-readiness.md`.

The original full-suite run timed out after 1,800 seconds with 30 failures. Isolated comparison against preimplementation commit `e741f55` found 25 failures with baseline evidence, three current-only timeouts and two unreproduced failures. The complete classification is in `admin-analytics-phase15-test-failures.md`. A subsequent pre-Phase-2 single-worker full run also timed out after 1,800 seconds; its output reported 20 failures across six files. These results are not a passing full-suite gate and do not prove a common cause. Unrelated tests will not be rewritten to make analytics pass.

## Definitions

- Event growth: creation cohorts from `events.created_at`, all statuses. Approved and pending/draft subdivisions describe each cohort's current status, not historical moderation transitions.
- User growth: registrations from `auth.users.created_at`; daily for 7/30 days, weekly for 90 days, monthly for all time. Total accounts always describes current platform state, independently of the selected period.
- Submission performance: cohorts received at `submitted_at`; current approved, rejected, pending/in-review, needs-information and withdrawn statuses. Approval rate is approved divided by approved plus rejected; an empty decided cohort has no rate. `reviewed_at` is mutable, not an immutable approval history.
- Geography: approved upcoming inventory uses the Eastern start of today and canonical metro slug/name. Scheduled series use `event_date` and current approval status. Emerging metros are currently active metros whose first observed creation date among currently approved events falls in the selected creation window; this is a proxy, not a historical activation date. Historical upcoming-inventory snapshots do not exist, so declining upcoming inventory cannot be reported reliably and is explicitly unavailable.
- Dance styles: distinct event/style associations, canonical links authoritative, legacy arrays only as fallback. Unspecified events remain visible. Percentages use all approved upcoming events as denominator; multi-style percentages can sum above 100%. Scheduled trends describe current associations, not historical style changes.

## Dates, security and performance

Finite periods include today: inclusive Eastern calendar start and exclusive next-day midnight. Comparisons use the preceding equivalent number of Eastern calendar days, including across DST. Weekly buckets start Monday; monthly buckets start on day one; first/last buckets may be partial. All time has no preceding equivalent period. A zero comparison baseline produces an unavailable percentage, never infinity or an invented zero.

Database-side grouped aggregation returns only counts, period labels, public metro/style labels and aggregate timestamps. The timeseries RPC must require both a non-null Auth identity and trusted `app_metadata.role = admin` before any source-level exception handling. Anonymous, regular, host/organizer and moderator callers are denied. Source failures return an unavailable section, not a misleading zero. No raw permissions, public projections, RLS policies or unrelated RPCs change. No credentials or individual account/submission/profile records reach the browser.

## Production safety

Only tracked migrations and non-production validation are authorized. No production migration, deployment or ledger reconciliation is part of Phase 2. Phase 2 production acceptance remains blocked until an authorized coordinated release and real-data/access verification.

## Coordinated Phase 2 release — authorization required

1. Resolve or explicitly review the documented test gates and Phase 1 migration-ledger/frontend mismatch. Capture the actual deployed frontend artifacts, both analytics function definitions, owner/ACL and ledger securely.
2. Verify schema prerequisites and prepare the production-key frontend artifact without publishing it. The existing timeseries signature and jsonb return type match production; its old response payload does not match Phase 2.
3. In a coordinated analytics maintenance window, apply only the reviewed timeseries migration after the authorized Phase 1 reconciliation. Do not blanket-push unrelated pending migrations. Validate the database payload and denied roles before immediately publishing the matching frontend.
4. Require administrators to refresh cached clients. An old frontend may consume the old timeseries contract; a new frontend with the old RPC correctly shows unavailable insights, but does not meet acceptance. Neither partial release is acceptable.
5. Compare event/user creation cohorts, submission statuses, current city/style inventory and scheduled series with independent read-only source aggregates using identical Eastern boundaries. Verify a real administrator session and direct RPC denial for anonymous/regular/host/organizer/moderator sessions. Recheck public projections and responsive layouts.
6. On failure, restore the captured deployed frontend and its matching captured metrics/timeseries definitions together, preserving captured owner/ACL and reloading PostgREST. Never erase tables or silently rewrite migration history. The captured deployed pair, not an assumed historical migration, is the rollback authority.

Read-only production catalog inspection confirmed the existing timeseries argument identity, jsonb result and owner `postgres`; the new function replaces it in place. No production function or migration ledger was changed.

## Validation evidence

The tracked `20261012000000_admin_analytics_phase2.sql` migration was applied only to disposable local schema-only clones and the local Supabase runtime, never production. `admin-analytics-phase2-regression.sql` first failed against the previous RPC payload, then passed against the replacement. Its transaction rolls back all fixtures. It covers creation cohorts/statuses, actual Auth accounts without profile rows, submission statuses, canonical same-name metros, canonical style authority, legacy fallback, multistyle and unspecified events, null timestamps, empty datasets, all-time totals, independent source failures, private-field exclusion and administrator authorization. Additional included/excluded boundary rows prove preceding-window counts across both spring and fall DST transitions, not merely bucket lengths.

Before/after catalog snapshots excluding only the replaced timeseries function were identical: relation grants/owners/RLS flags, policies, public view definitions, default privileges and other public/auth functions, including the Phase 1 metrics RPC. The target function preserves its identity/owner/ACL, becomes STABLE with an empty search path and checks the trusted admin role before source-level exception handlers.

Actual local HTTP calls returned 200 for administrators for all four periods. Event/user creation totals, total Auth accounts and received-submission totals matched independent SQL queries. Regular, host, organizer and moderator sessions returned 403; anonymous calls returned 401. Real browser sessions for these denied roles redirected away from analytics without requesting either private RPC.

Local and production anonymous raw SELECT remain denied for events, profiles and auth.users. Local event_submissions retains its existing SELECT grant subject to RLS: an actual anonymous request returned zero rows. Production denies that raw SELECT grant. Neither environment's permissions were changed by analytics.

Chromium exercised the real local Supabase dashboard at 375×812, 768×1024 and 1440×900. Document and chart widths fit every viewport. Native keyboard period selection changed the URL and reporting resolution; browser back restored the previous period. A simulated HTTP 503 for the timeseries request hid insight values while leaving overview metrics available; retry recovered real data. Genuine zero-filled charts show an empty state, and positive minority-style shares no longer round to a misleading 0%.

### Impeccable review

Existing admin typography, spacing, tokens and controls are preserved. Charts use accessible table headers and text counts alongside decorative bars; bounded vertical scrolling avoids unmanageably tall histories. Sampled text contrast ratios were 14.63:1 for section headings, 5.17:1 for definitions and 5.41:1 for chart headers. The native period control has a visible 2px focus outline and 44px height. The final implementation-integrity detector exited successfully with no findings. Physical touch gestures, dedicated screen-reader use, a separate dark-theme pass and production browser acceptance remain unverified; this is not a WCAG certification.

The Impeccable context reported stale design-sidecar metadata relative to DESIGN.md. It was not repaired as an unrelated side effect.

### Quality gates

Final focused verification passed: **44 tests across four analytics files**. The SQL regression passed in disposable local clones, including an undated Auth account that contributes to all-time totals but receives no fabricated registration bucket. Temporary local administrator/regular/host/organizer/moderator accounts, browser tabs, smoke server and disposable databases were removed.

The Phase 2 broad run excluded the eight already-investigated failing files rather than pretending they passed. Before its **900.25-second deadline**, **59 files / 1,002 tests** reported passing, with no failed-file markers in the progress log. It did not produce a completed suite summary or final JSON report, so it is **not a full-suite pass**. React `act(...)` and jsdom navigation/scroll warnings remained in unrelated existing tests. The broad run included one forwarding-only chart-label test subsequently removed; the final focused run covers the cleaned analytics tests. No unrelated test or timeout configuration changed.

The earlier unexcluded pre-Phase-2 full run still timed out at 1,800.24 seconds with 20 failures reported across six files. The original 30-failure classification remains: 25 with preimplementation evidence, three current-only timeout outcomes and two historically unreproduced failures. None is silently classified as an analytics regression or a proven resource problem. Full-suite release readiness remains unresolved.

| Gate | Result |
| --- | --- |
| Focused Vitest | PASS — 44 tests, four analytics files |
| Transactional SQL regression | PASS — empty clones, all source/role/date invariants, rolled back |
| Full suite | NOT COMPLETE — known failures remain; broad subset timed out after 59 passing files / 1,002 tests |
| `npm run lint -- --max-warnings 0` | PASS |
| `npm run build` | PASS — TypeScript and Vite; existing >500kB shared-chunk warning remains |
| `git diff --check` | PASS |
| Real local Supabase/browser smoke | PASS — admin data, denied roles, four filters, failure/recovery, three viewports |
| Production deployment / acceptance | NOT PERFORMED |

Changed analytics files: existing `analyticsQuery.ts`, `analyticsRepo.ts`, `useAdminAnalytics.ts` and their focused tests; `AdminAnalyticsPage.tsx`, its CSS and tests; new `components/analytics/AnalyticsInsightChart.tsx` and CSS; the tracked Phase 2 migration and SQL regression. This audit and the Phase 1.5 failure evidence document the results. No new dependencies, indexes, materialized views, workers, tracking infrastructure or Host Analytics changes were introduced.

Production acceptance remains blocked by unresolved full-suite readiness, the Phase 1 ledger/deployed-frontend mismatch, and the absence of an authorized coordinated deployment with real production administrator/access/data checks. Missing immutable moderation/style histories and upcoming-inventory snapshots are explicit data limitations, not invented insights.

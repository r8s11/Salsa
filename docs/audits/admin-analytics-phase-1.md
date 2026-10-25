# Admin Analytics Phase 1

## Preimplementation audit (2026-10-11)

- Route: `/admin/analytics`, composed by `src/app/App.tsx` inside `RequireAdmin` and `AdminLayout`. The existing analytics page, repository, React Query hook, filter, metric cards, and SVG trend chart are reusable infrastructure.
- Existing sources: `admin_analytics_metrics(timestamptz,timestamptz)` and `admin_analytics_timeseries(timestamptz,timestamptz,text)`; tracked migrations define real database aggregation, not hardcoded dashboard counts. Existing metrics are Published Events, New Users (incorrectly counted from profiles for this brief), Event Views, RSVP Clicks, and all Submissions. None implements the complete requested six-metric contract. Engagement telemetry already exists but is outside this phase and will not be changed.
- Misleading behavior: the parser turns missing or malformed metric values into zero; the page ignores analytics errors; previous-period query data can remain visible under a newly selected period; URL-written custom boundaries prevent subsequent preset changes from updating the dates. There is no city distribution chart.
- Local database inspection confirms `events.created_at`, `events.event_date` (timestamptz), `events.status`, nullable `events.city`, and nullable `events.organizer_id`; `event_submissions.submitted_at`, `created_at`, and statuses pending/in_review/needs_information/approved/rejected/withdrawn; `auth.users.created_at`; `organizers.id`; and `metros.slug/name`. `organizer_members` is membership, not an event-to-organizer count source.
- Existing metro normalization resolves legacy borough/suburb input to canonical `events.city` slugs at entry time. The dynamic metros migration gives `events.city` a foreign key to `metros.slug`. Aggregation can join this registry once, without copying the frontend alias map or hardcoding cities. Public discovery uses `public_events` and `public_active_metros`; those views and their privileges remain untouched.
- Existing SQL administrator authority is trusted JWT `app_metadata.role = admin`, through `is_admin()` / `is_platform_admin()`. Existing analytics RPCs are SECURITY DEFINER, grant authenticated execution, revoke public/anonymous execution, and independently check this role. The replacement must also require a real authenticated subject, not frontend protection alone.
- No chart library is installed; retain existing admin tokens/cards and build a small accessible CSS horizontal bar distribution rather than add a dependency.

## Implementation contract

Use the existing metrics RPC and existing repository/hook/model, replacing the obsolete dashboard contract rather than creating a parallel analytics service. The response is aggregate counts only: `total_events`, `upcoming_events`, `registered_users`, `pending_submissions`, `active_organizers`, `events_by_city` (`[{slug, city, count}]`), and `as_of`.

### Date semantics

The selectable period is creation activity over 7, 30, or 90 Eastern calendar days including today, with inclusive start and exclusive next-day midnight. All time has no creation-date boundaries. Boundaries use America/New_York and calendar arithmetic (including DST), independent of browser timezone.

- Total Events: all stored event statuses; `events.created_at` within the selected period, or all rows for All time.
- Registered Users: actual `auth.users` rows; account `created_at` within the selected period, or all accounts for All time. No profile-based approximation.
- Pending Submissions: currently `pending` or `in_review` submissions awaiting moderation; filter `submitted_at` (the existing moderation queue timestamp), not the scheduled date. `needs_information` is waiting on the submitter, not the moderation queue.
- Upcoming Events: current approved inventory with `event_date` at or after today's America/New_York midnight. Includes events earlier today; no retrospective creation filter.
- Active Organizers: distinct non-null `organizer_id` associated with that approved upcoming inventory. Does not count host text, membership rows, or every registered organizer.
- Events by City: the same current inventory grouped by canonical city slug and displayed with dynamic metro names. Missing city is Unknown city; unmatched legacy city remains visible. Metros sharing a display name remain separate and receive slug-qualified chart labels. Sort count descending, label ascending, then slug for ties.

Upcoming Events, Active Organizers, and Events by City are explicitly current platform state; they do not change with the retrospective activity selector. No invented growth comparisons, tracking metrics, or host analytics.

## Production safety

No production migration or deployment is authorized. Author a tracked migration, validate on a non-production database, and leave production application and verification pending authorization. Never report local fixture counts as production counts.

## Implemented behavior and local verification

- `20261011120000_admin_analytics_phase1.sql` replaces the existing metrics RPC in place. Its fixed empty search path and fully qualified relations prevent relation-name substitution; the authenticated subject and trusted administrator role are checked outside the per-source exception blocks.
- The five scalar aggregates and city distribution share a stable statement snapshot. A failed aggregation returns null for its source, not zero; the page retains healthy metrics and offers retry for unavailable sources. A failed refresh hides stale counts, and queries are scoped by authenticated administrator ID and activity boundaries.
- The page reuses `AdminPageHeader`, `AdminMetricCard`, the existing Supabase client/repository, and TanStack Query. Old dashboard-only trend rendering and custom granularity/date overrides were removed; existing telemetry tables and timeseries RPCs were not modified.
- The native Activity period select is URL-driven, keyboard accessible, and follows browser history. Upcoming inventory has a separate Current platform state section. The update timestamp is displayed in America/New_York.
- Real local PostgREST requests returned 200 for an administrator, 401/42501 for anonymous access, and 403/42501 for regular, organizer, host, and moderator accounts. Real frontend navigation redirected non-admin accounts away from `/admin/analytics`; anonymous navigation reached sign-in.
- A schema-only disposable database clone passed the executable SQL regression script, including Auth-account counts without profile rows, creation boundaries, today-at-midnight events, distinct organizers, a newly registered metro, unknown/null cities, empty sources, unauthorized roles, and an intentionally unavailable Auth source. The old RPC failed the empty six-metric contract before replacement. All regression fixtures rolled back and the clone was removed.
- Browser verification used the actual local Supabase instance, real administrator sign-in, and local database records, not a mocked dashboard. Independent Eastern-calendar SQL confirmed the upcoming count and the city counts summed to that inventory. Temporary test Auth accounts were removed afterward.
- Emulated Chromium viewports 375 × 812, 768 × 1024, and 1440 × 900 showed no horizontal overflow. Selector and refresh targets measured 44px high after correcting a shared admin-input override. Keyboard selection worked with a visible focus outline. Measured secondary-text contrast was 5.17:1–5.41:1; chart labels were 17.85:1 on the light theme. Physical-device touch and a separate dark-theme visual pass were not exercised.
- A simulated HTTP 503 during a real Refresh displayed the recovery alert, unavailable values for every card rather than false zeros, and unavailable city data. Retry recovered the real database values. The Impeccable detector reported no findings.
- Canonical city identity is carried through SQL, the response model, and chart keys. Additional SQL and UI regressions ensure two distinct metros named Boston are not combined or rendered with ambiguous labels.

### Preserved access architecture

The local database already grants anonymous table-level SELECT on `event_submissions` and `organizers`, but their SELECT policies restrict reads to authenticated submitters/reviewers or members/admins. This phase does not rewrite those existing workflows or grants. Anonymous raw SELECT on `events`, `profiles`, and `auth.users` remains denied. Public event and metropolitan discovery views are unchanged.

### Release readiness

The migration was exercised on an isolated clone and applied only to the local development Supabase database. Both configured `.env` files point at that local instance. Production schema reconciliation, migration application, application deployment, and post-deployment live-data/security checks require explicit authorization and production access. The frontend and replacement RPC must be released together; an older production RPC does not provide the six-metric contract.

After an authorized release, verify all four activity periods, administrator access, direct unauthorized RPC requests, real counts against independent read-only SQL, and the three viewport sizes. No production credentials or private identity/submission fields are returned by this RPC.

## Change inventory

- `src/features/admin/model/analyticsQuery.ts` and `.test.ts`: six-metric response model, unavailable-value parsing, city contract, Eastern calendar boundaries, and DST/empty regression coverage.
- `src/features/admin/api/analyticsRepo.ts` and `.test.ts`: existing metrics RPC only, sanitized request failure, and source-level availability.
- `src/features/admin/hooks/useAdminAnalytics.ts` and new `.test.tsx`: administrator-scoped query identity, period changes without stale values, and refresh/access-change regression coverage.
- `src/features/admin/pages/AdminAnalyticsPage.tsx`, `.css`, and `.test.tsx`: creation/current-state separation, five live cards, city distribution, loading/empty/error/retry behavior, keyboard/history tests, and scoped touch targets.
- `src/features/admin/components/analytics/AdminAnalyticsFilters.tsx` and `.css`: native activity-period selector.
- Removed unused `src/features/admin/components/analytics/AdminTrendChart.tsx`, `.css`, and `.test.tsx`. The backend timeseries RPC remains unchanged.
- `supabase/migrations/20261011120000_admin_analytics_phase1.sql`: reviewed local aggregation/security implementation.
- `sql/final-verification/admin-analytics-phase1.test.sql`: isolated executable database regression.
- This audit documents sources, date definitions, access architecture, implementation, and deployment prerequisites.

Focused validation: 29 tests passed across the model, repository, hook, page, and existing RequireAdmin test files. The executable SQL regression passed and rolled back. `npm run lint -- --max-warnings 0` and `npm run build` completed successfully with extended command deadlines after initial deadline expirations; Vite reported its chunk-size warning. `git diff --check` completed successfully.

### Full-suite limitation

`npx vitest run` did not complete within its 1800-second deadline. It reported 30 failed tests across the following untouched files before termination:

- `src/features/admin/components/events/AdminEventEditor.extraction.test.tsx` (16)
- `src/pages/SubmitEventPage.extraction.test.tsx` (1)
- `src/features/calendar/Calendar.test.tsx` (2)
- `src/pages/BulkFlyerImportPage.test.tsx` (4)
- `src/pages/account/ProfileEditPage.test.tsx` (2)
- `src/features/workspaces/components/public/PublicWorkspaceSurfaces.test.tsx` (1)
- `src/features/calendar/components/CalendarListView.test.tsx` (1)
- `src/features/calendar/components/CalendarSubmissionDialog.test.tsx` (3)

Their preimplementation baseline was not measured, so these failures are not claimed to be proven pre-existing or caused by this change. No unrelated workflow was edited to suppress them. The separately exercised analytics and RequireAdmin focused suite passed all 29 tests. Full-suite acceptance remains unverified.

Graft's wiring graph was refreshed with `graft build --no-gitignore --no-ignore`; no dependency or tool upgrade was installed.

## Phase 1.5 reconciliation

The later [release-readiness audit](admin-analytics-release-readiness.md) and [per-test classification](admin-analytics-phase15-test-failures.md) supersede the unclassified failure and production-access assumptions above. Individual current/baseline runs provide preimplementation failure evidence for 25 of the original 30 named tests; three current-only outcomes and two historical non-reproductions remain unresolved. No unrelated test or application fix was made.

An existing CLI login enabled direct Management API read-only production inspection. Production already contains the exact reviewed Phase 1 RPC definition but has no matching migration-ledger row, while its served analytics frontend chunk still contains the old metric contract. No production migration or deployment was performed in Phase 1.5. The coordinated-release audit documents this mismatch, required reconciliation, release order, and rollback.

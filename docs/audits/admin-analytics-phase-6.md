# Admin Analytics Phase 6 — reports, alerts, monitoring

## Scope and acceptance

Single-agent implementation. No subagents, production migration, deployment, activated scheduler, or live email. Local readiness is not production acceptance. Required Caveman, Graft, and Impeccable skills were invoked directly. Existing event submission/approval, onboarding, extraction, calendar, host analytics, authentication, storefront, and discovery behavior were not changed.

### Prerequisite audit

Read Phase 1–5 audit reports and inspected their current RPCs, repositories, hooks, CSV/export path, Action Center, admin authorization, timezone handling, Supabase functions, and shared Resend email builders. All five phases have local implementation/verification evidence; none has documented complete production acceptance. The last Phase 1 production audit found a matching metrics RPC but a missing migration ledger entry and incompatible served frontend. The last Phase 3 production audit found missing engagement storage. These are historical audit observations, not fresh production checks. Phases 2, 4, and 5 remain production-unverified.

Existing `admin_analytics_metrics`, `admin_analytics_timeseries`, `admin_event_engagement`, `admin_analytics_entity_performance`, `admin_analytics_operations`, and `admin_analytics_report` signatures and implementations are preserved. CSV exports remain unchanged. No suitable existing generic notifications/preferences model was found: invitation/founder delivery tables have separate domain semantics. Local Supabase had pg_cron/pg_net available but not installed or activated. Scheduling therefore uses a separately gated manual activation script, not a migration side effect.

Missing-source recovery: the current `20261013000000_admin_analytics_phase3.sql` now creates the existing canonical telemetry table/indexes with RLS and revoked raw access when absent. After a missing `public.event_touches` migration error, retry that complete updated migration, then continue Phase 4, Phase 5, and Phase 6 in order. Do not replay `20260922000000_event_demand_telemetry.sql` after newer analytics phases; it also replaces superseded analytics RPC definitions. This repair was verified on an isolated local clone, not applied to production.

## Implementation

Migration: `supabase/migrations/20261016000000_admin_analytics_phase6.sql`.

Five narrow tables are necessary for personal subscriptions, global condition lifecycles, immutable reports, recipient-specific delivery leases/idempotency, and durable source-failure streaks:

- `admin_analytics_preferences`: authenticated administrator identity, disabled/daily/weekly frequency, explicit email opt-in, category toggles, activation timestamp.
- `admin_analytics_alerts`: stable condition key, canonical entity where applicable, active/resolved lifecycle and timestamps. No submitter records or emails.
- `admin_analytics_report_runs`: unique frequency/from/to period, success/error, generated timestamp, bounded summary.
- `admin_analytics_notification_deliveries`: unique administrator/notification key, frozen public-safe payload, delivery status, lease/token/attempt metadata.
- `admin_analytics_monitor_state`: singleton evaluation timestamp and per-source health/failure streaks.

Client RPCs: `admin_analytics_monitoring()` and `admin_analytics_save_preferences(...)`. Service-only RPCs: `admin_analytics_evaluate(...)`, `admin_analytics_due_deliveries()`, `admin_analytics_claim_delivery(...)`, `admin_analytics_finish_delivery(...)`, and `admin_analytics_delivery_allowed(...)`. Helper functions are private. No existing analytics RPC is replaced.

Edge function: `admin-analytics-monitor`; deployment JWT verification is disabled only for this function because it validates a separate server-only, at least 32-character scheduler secret. Request bodies cannot select recipients or reporting windows. SHA-256 digests are compared without early character exits. Wrong secrets fail before database evaluation. Optional email configuration does not prevent dashboard evaluation/report generation when no email is queued.

Frontend: an independent monitoring section on `/admin/analytics`, linked from the existing `/admin/settings` page. It includes priority-filtered active alerts, separate resolved history, saved reports, source health, and personal preferences. Optional query failures do not block existing analytics. Unsaved settings survive failed refreshes. Asynchronously loaded preference deep links move focus to the settings heading. Native controls, visible dirty/saving/error states, and existing design tokens are retained.

Shared `analyticsSummary.ts` supplies dashboard and email report rows/comparison labels. `analyticsEmail.ts` reuses existing `emailLayout.ts`, branding, sender configuration, plain-text builder, and Resend failure classification. `analyticsWorker.ts` isolates runtime orchestration for deterministic tests. No dependency manifests changed.

## Report contract

Timezone: `America/New_York`. Daily: previous complete local calendar day, due 09:00 Eastern. Weekly: previous complete Monday–Sunday calendar week, due Monday 09:00 Eastern. SQL converts local date boundaries independently; spring/fall DST days are 23/25 hours, not forced 24-hour intervals. Bounds are inclusive start/exclusive end. Newly enabled subscriptions begin at the next due boundary.

The evaluator generates the latest currently due period for each subscribed frequency. Failed generation retries that period until a later period becomes due; older missed periods are not backfilled. Previously successful snapshots are immutable. Reports remain accessible without email; the dashboard shows the latest 20 runs, including generation errors.

Historical activity uses the existing definitions: Auth account registration timestamps, event creation, submissions received, canonical organizer and venue creation. Approval activity is explicitly unavailable because authoritative approval timestamps do not exist. Current pending/overdue submissions, upcoming approved inventory, active/limited metros, and quality issues are labeled as a current-state snapshot, not activity during the historical window.

Engagement uses retained Phase 3 event touches only when tracking history covers the relevant start boundary. The summary includes views/RSVP/ticket clicks and top five events. Previous engagement comparisons require retained history covering the previous equivalent window. Missing/unreliable engagement is labeled unavailable, never manufactured as zero. Optional engagement failure does not turn complete required activity into a failed report.

Previous equivalent activity comparisons use Increased, Decreased, No change, or No comparison available. A zero baseline never produces an invented percentage. Email rendering reads the saved snapshot; it does not query/recalculate metrics.

## Alert contract

Reuse Phase 5 operational classifications, not new AI scores:

- Submission backlog: pending/in_review older than 48 elapsed hours; warning, critical after seven days. One aggregate `backlog:48h` condition avoids a flood of historical submission notifications.
- Critical metro inventory: a previously active canonical metro with zero upcoming approved events. Never-active metros are excluded.
- Limited metro inventory: positive inventory below Phase 5's existing configured healthy threshold (default five). Thresholds remain those of `admin_analytics_operations`; Phase 6 does not introduce a conflicting per-admin threshold editor.
- Critical event data quality: upcoming approved events missing a required title. Optional venue/organizer associations remain noncritical summary issues. Aggregate `quality:required` identity avoids one notification per historical row.
- Analytics data health: three consecutive scheduled failures/malformed required aggregations produce a warning per source. Genuine numeric zero is valid. Incomplete metro pagination, negative/missing/noninteger counts, and unavailable sources are failures rather than empty inventory.

Condition identity is stable across checks; one row per condition. Reconciliation changes active to resolved when the actual condition clears. Reoccurrence increments its lifecycle and detection timestamp. There is no dismiss-as-resolution action or automatic administrative correction. Missing sources preserve the affected existing alerts until a successful evaluation can reconcile them.

First evaluation establishes an email-suppressed baseline. A newly detected eligible critical lifecycle can notify opted-in administrators once. A warning becoming critical also becomes eligible, including a baseline warning escalating after initialization; its lifecycle and original detection timestamp remain unchanged. Cooldown is lifecycle-long: no periodic repeat emails for an unchanged condition. Persistent conditions remain in regular report summaries. Resolved/reoccurring conditions may notify again with a new lifecycle key. An explicit later opt-in can receive an eligible persistent critical lifecycle once; historical baseline conditions remain suppressed unless they escalate or recur.

Health has success/unavailable/error/stale states. Staleness is independently derived after 45 minutes without evaluation. Failed generation never becomes a successful zero report. Email failures/exhausted retries remain diagnostic even when another delivery succeeds. Diagnostics are administrator/service-only; this is not a general observability platform.

## Delivery, concurrency, and security

A transaction-scoped advisory lock serializes evaluators; overlapping executions return busy. Unique report windows and administrator/notification keys provide database-level safeguards. Sending never creates another alert.

Delivery claim takes a row lock and a five-minute lease/token. Failed sends retry after 15 minutes, maximum five attempts, only within 23 hours of first attempt. The same outbox UUID is the Resend idempotency key on every retry. Resend's documented idempotency retention is 24 hours; exhausting the bounded retry window suppresses further sends rather than risking a duplicate with a new key. A stale/incorrect token cannot finish another worker's claim. An ambiguous provider timeout can safely retry the same key. Provider failure codes are sanitized; secrets and full payloads are not logged.

Addresses come only from trusted Auth records. The worker rechecks current administrator authorization and category/frequency/email preference immediately before provider send; revoked/deleted/banned administrators and opted-out recipients are suppressed. Regular users, hosts, organizers, moderators, and anonymous requests cannot read reports or change preferences. Preference RPCs derive `auth.uid()` and accept no alternate administrator/recipient identity. There is no arbitrary recipient injection path. Report access also rechecks current Auth administrator state rather than trusting an old role claim alone.

All five new tables have RLS enabled and client table privileges revoked; private helpers/service RPCs are unavailable to frontend roles. Existing relation RLS/ACLs and original analytics definitions were compared before/after the local migration and unchanged. No Auth users view, raw submitter email, service key, or scheduler credential is exposed to the frontend.

## Local verification

Database harness: `node scripts/verify-admin-analytics-phase6.mjs [salsa_analytics_p6]`. It refuses database names outside the disposable Phase 6 clone prefix. Regression SQL rolls fixtures/function substitutions back. The separate concurrency checks use real PostgreSQL connections and clean their clone state.

Coverage includes daily/weekly period generation, exact boundaries, both DST transitions, genuine empty periods, real activity/engagement accuracy, opt-in/out, stale JWT revocation, nonadmin denial, own-preference isolation, baseline suppression, warning-to-critical escalation, alert deduplication/resolution/reactivation, lifecycle cooldown, malformed/unavailable sources and recovery, report failures, exclusive delivery claims, wrong completion tokens, failed delivery backoff, provider identity stability, maximum attempts, expired retry window, and overlapping evaluator report/outbox uniqueness.

Real local smoke used local Supabase Auth/PostgREST, the Deno HTTP function, and Chromium; provider send was mocked with a fixture-recipient-only guard. No external email was sent. Wrong scheduler secret returned 401. Baseline evaluation sent zero; fixture evaluation sent three unique mocked notifications; repeat evaluation sent zero. Daily/weekly reports were read through the actual dashboard. Saved preferences survived reload. Opt-out stopped subsequent notifications. Fixture resolution/reactivation changed lifecycle without another condition row. Anonymous access returned 401; user/organizer/host/moderator RPC access returned 403. Client invocation of scheduler RPC returned 403.

Responsive visual/DOM checks: 375×812, 768×1024, 1440×900; no page or new-section horizontal overflow, minimum control height 44px. Keyboard select/focus, report disclosures, settings deep-link focus, actual save/reload, and optional RPC error/retry were exercised. Simulated optional failure kept the original analytics visible and preserved unsaved preferences. Sample heading/notes contrast was 17.85:1/5.41:1. Dedicated screen-reader, physical touch, and dark-theme testing were not performed; this is not a blanket WCAG certification. Impeccable detector returned no findings for the four changed UI surfaces.

- Focused tests: 12 files, 111 tests passed, including existing analytics/settings/authorization coverage.
- Database regression/concurrency harness: passed after fresh full migration installation on a disposable local clone. Warning-to-critical notification regression failed before its fix and passed afterward.
- Strict lint: `npm run lint -- --max-warnings 0` passed.
- Production build: passed; Vite reported a >500kB chunk warning. No bundle-warning suppression or unrelated code splitting was introduced.
- `git diff --check`: passed, including after the final SQL escalation fix.
- Deno: `deno check supabase/functions/admin-analytics-monitor/index.ts` passed.
- Full suite: the first run timed out at 300 seconds without individual test results. The verbose retry timed out at 900 seconds after reporting 2,545 passing tests and zero assertion failures, without a final Vitest summary. Classification: incomplete full-suite execution, not a certified pass, not a proven assertion failure, and not a proven pre-existing defect. Logged simulated network errors in founder/submission notification tests were expected failure-path output, not failing tests. Earlier audit failure lists cannot establish the cause of these current timeouts.
- Temporary Auth, event, submission, metro, report, and alert fixtures were removed from local Supabase; the isolated worker/dashboard servers and browser were stopped, temporary smoke script removed, and disposable database dropped. The local migration remains installed; no scheduler was enabled.

## Retention and cleanup

Suggested retention: 180 days for completed/error report runs, resolved alerts, and terminal delivery records. Never purge active conditions, pending/failed/sending delivery attempts, or live leases. Keep permanent personal preferences and singleton health metadata. Retention is a separately authorized, bounded operator task, not another automatically activated cron job.

Cleanup order: terminal deliveries first, then report/history rows that are no longer referenced. Do not remove an idempotency record while a provider retry can still occur. Use bounded batches (for example 500 records) and a fixed cutoff; repeatedly execute until no eligible rows remain. For resolved alert deletion, require `resolved_at` older than the cutoff. For reports, require `generated_at` older than cutoff and no remaining `report:<id>` delivery key. Delivery deletion requires terminal sent/suppressed status and creation/first-attempt timestamps older than cutoff. Preserve permanently failed retries until an operator intentionally closes them as suppressed. Cleanup does not alter live events, submissions, or Auth data.

## Production release order — authorization required

1. Reconcile/deploy/verify required Phase 1–5 migrations and production migration ledger, canonical RPCs, engagement storage/tracking, and served frontend. Resolve the full-suite failures below or explicitly accept their classified risk. Verify real source counts independently.
2. Apply the tracked Phase 6 migration with an authorized deployment process. Verify ACL/RLS/nonadmin denial, current-admin revocation, bounded RPC projections, and function definitions. Do not run the evaluator against production as part of migration execution.
3. Deploy the Edge function with the dedicated scheduler secret and existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_EMAIL_FROM`, `AUTH_EXTERNAL_URL`, and `RESEND_API_KEY`. Confirm the actual sender is verified in Resend; development inspected configuration paths but did not prove production domain/sender verification. `AUTH_EXTERNAL_URL` must be the trusted HTTPS SalsaSegura app origin.
4. Deploy the frontend. Verify administrator-only settings/report access, defaults disabled/email off, and preference isolation. No administrator is subscribed by migration.
5. Perform an explicitly authorized controlled evaluation and approved recipient test; verify database values, provider response, recipient reauthorization, repeated-run deduplication, and observability. Do not email every administrator as a test.
6. Store `analytics_monitor_url` (HTTPS full Edge endpoint) and `analytics_scheduler_secret` in Supabase Vault. Review `supabase/manual/admin-analytics-phase6-scheduler.sql`. Default invocation leaves scheduling unchanged. Only with explicit production authorization run with `psql -v activate=true -f ...`; this installs/reuses pg_cron/pg_net and creates one 15-minute UTC job. SQL report boundaries provide Eastern DST correctness; cron itself need not change with DST.
7. Verify real scheduled runs, health freshness, opt-out/revocation, critical-condition lifecycle suppression, daily/weekly saved summaries, and actual delivery outcomes. Production acceptance requires these observations separately from local tests.

Rollback: unschedule `admin-analytics-monitor` first (`select cron.unschedule('admin-analytics-monitor');`), then stop/revert the Edge function and frontend monitoring UI. Preserve report/outbox/alert tables and idempotency records; do not reset lifecycle/delivery identities to recover a failed send. Revert the new SQL objects only after dependencies are stopped, records retained/exported according to policy, and explicit database authorization. Existing Phase 1–5 definitions need no rollback because Phase 6 does not modify them. Optional monitoring RPC errors leave the existing dashboard operational during a coordinated rollback.

References: [Supabase scheduled functions](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/functions/schedule-functions.mdx), [Resend idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys).

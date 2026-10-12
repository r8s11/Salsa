# Admin Analytics Phase 1.5 — Release Readiness

## Scope and release boundary

This phase investigates the Phase 1 test failures, verifies the existing aggregation migration, and prepares a coordinated release. It adds no analytics features and changes no Host Analytics, calendar, submission, moderation, organizer, profile, authentication-email, or storefront behavior.

Phase 1 is commit `6689ce1`; its parent `e741f55` is the exact preimplementation baseline. The commit changes only the 17 files listed by its diff. Package manifests, lockfile, test configuration, and shared test setup are unchanged. Baseline comparison uses a detached disposable worktree, the same installed dependencies, and copied local-only environment files. The original full-suite progress log was recovered from the archived session; the run timed out before emitting the final failed-test error stacks. Original test names and durations are available, but original exact error messages cannot be reconstructed from that progress output.

## Migration verification

Reviewed `supabase/migrations/20261011120000_admin_analytics_phase1.sql`. The RPC requires both `auth.uid()` and trusted JWT `app_metadata.role = admin`, before any per-source exception handling. User metadata cannot confer administrator access. It is STABLE SECURITY DEFINER with an empty search path and fully qualified relations. Registered-user totals read `auth.users`, not profiles. Counts and city grouping are database-side; approved inventory and creation activity retain the documented Eastern boundaries. Distinct organizer IDs and unique metro slugs prevent join duplication. No private rows are returned.

A disposable local schema-only clone was restored, given the prior RPC definition, then migrated. The executable SQL regression passed, covering empty/null sources, date boundaries, all six aggregates, status exclusions, distinct organizers, dynamic and same-name metros, partial-source failure, and denied roles. Additional execution under actual `authenticated` and `anon` database roles verified administrator success and denial for a missing subject, moderator claims, and an administrator claim placed only in user metadata.

Before/after catalog snapshots were identical for public/auth relation grants, owners, RLS flags, policies, public-view definitions, default privileges, and all other public/auth functions. The target RPC kept its OID, signature, owner, and existing ACL. Anonymous execution remains denied, authenticated execution is role-gated, and existing service-role execution is unchanged. Restoring the prior RPC in the clone recovered its old response contract without changing those permissions. All fixtures rolled back and the clone was deleted.

### Production read-only reconciliation

The configured frontend environment remains local (`http://127.0.0.1:54331`), but an existing Supabase CLI login provided access to the linked, healthy SalsaSegura project `tlajzziavbnfomhfwofw`. An attempted CLI `db query --linked` did not run the read-only SQL file: CLI login-role initialization attempted a role alteration and was rejected with SQLSTATE 42501. It was not retried. The direct Management API query endpoint was then used with `read_only: true`, sending only catalog SELECTs and aggregate SELECTs. No production migration, deployment, table write, policy change, or successful role change was performed. No token, password, or private row is included in this report.

Production catalog checks passed for every required column/type, RPC identity and jsonb return type, Auth helpers, database roles, RPC-owner SELECT/unfiltered access to all sources, approved/pending/in_review status constraints, unique metro slugs, canonical city FK, organizer FK, and anonymous raw-table SELECT denial for events/profiles/auth.users.

**Important reconciliation finding:** production already contains a function definition byte-for-byte identical to the reviewed Phase 1 local RPC, including owner `postgres`, STABLE, SECURITY DEFINER, and empty search path. The migration ledger has **no `20261011120000` row**. This report cannot establish when or by whom that definition was installed. Do not assume production still needs its RPC replaced, and do not mark the migration applied in the ledger without an authorized reconciliation. No production schema change was made by this phase.

The public production entry asset referenced `assets/AdminAnalyticsPage-B7zWIIpP.js`. Read-only inspection of that served lazy chunk found the old `Published Events` and `Event Views` labels, and none of the six Phase 1 labels or response-field markers. This is a verified frontend/RPC contract mismatch already present, not a hypothetical cutover risk. An authenticated production browser session was not exercised, so its exact rendered counts are unverified.

The read-only production permission/policy/view/other-function catalog snapshot had SHA-256 `4cd2d4ce9dd77ede47720c1c1aafb349e5c0a7fc47d31b9a1cd90b6f70c415b1`; it is an audit fingerprint, not a replacement for storing the full pre-release catalog securely. Concurrent authorized changes can legitimately alter a later fingerprint.

Independent production aggregate snapshot:

| Source result | Value |
| --- | --- |
| as_of | 2026-10-11 23:34:04.125967+00 |
| 30-day inclusive start | 2026-09-12 04:00:00+00 |
| exclusive end | 2026-10-12 04:00:00+00 |
| Total Events, creation activity | 59 |
| Registered Users, account creation activity | 10 |
| Pending Submissions, submission creation activity | 0 |
| Upcoming Events, current inventory | 2 |
| Active Organizers, linked current inventory | 0 |
| Boston / boston | 1 |
| New York City / new-york-city | 1 |

These are read-only source counts, not proof that the production dashboard is deployed or authorized correctly. Zero linked organizers is a real result, not a fabricated fallback. No production administrator browser session was created.

## Coordinated release procedure — requires authorization

1. **Resolve release gates first.** Review the classified failures below; do not weaken unrelated tests or bypass the existing quality job. Select a reviewed frontend release containing only intended changes against the actual deployed baseline. Preserve the last known-good frontend artifact and its production public-key/environment configuration. Do not assume the current feature branch is the production baseline.
2. **Capture production state securely.** Run `sql/final-verification/admin-analytics-phase1-preflight.sql` using an authorized read-only connection. Preserve the deployed RPC's exact `pg_get_functiondef`, owner, ACL, public-view definitions, policies, and migration ledger. Reconfirm the production project identity and all schema prerequisites. Abort if columns/types, status constraints, metro uniqueness, or owner access differ. The generic script is intended for a read-only Postgres connection; do not use the current CLI linked-query path, which attempted login-role provisioning. If using the documented Management API endpoint, send individual SELECT statements with `read_only: true`.
3. **Reconcile the database first.** Production currently has the correct function but lacks the tracked migration row. Obtain explicit approval for the project's migration-ledger reconciliation or reviewed targeted migration application. Do not run a blanket migration push that applies unrelated pending migrations. If the live definition has drifted, apply only the reviewed analytics migration transactionally through the authorized workflow. Confirm committed function identity, owner, security attributes, grants, and healthy six-metric payload before releasing the frontend.
4. **Deploy the matching frontend immediately afterward.** The tracked CI workflow runs lint, tests, and build and gates deployment with `needs: quality`. Publishing to `main` can trigger deployment; coordinate that trigger only after the database check. Use production Supabase URL and publishable key at build time, never local `.env` values or privileged credentials. Preserve the SPA fallback for direct `/admin/analytics` navigation. Confirm the deployed artifact revision rather than relying on a successful build alone.
5. **Administrator authentication acceptance.** Use an existing authorized administrator with a refreshed real session. Open and refresh `/admin/analytics`; verify account-scoped data, 7/30/90/all selections, browser history, current-state labels, loading/empty/error/retry behavior, and no unavailable source values. Do not create production fixture accounts unless separately authorized.
6. **Live metric comparison.** Run `sql/final-verification/admin-analytics-phase1-live-counts.sql` over an authorized read-only connection and compare exact boundaries with the administrator RPC response/dashboard. Repeat with 7, 90, and all-time boundaries; account for concurrent data changes by comparing within a controlled snapshot/window. Check city totals equal approved upcoming inventory, canonical identities remain distinct, and no private fields appear in network responses. Do not execute the destructive-fixture regression script against production.
7. **Unauthorized HTTP acceptance.** With actual sessions for anonymous, regular, organizer, host, and moderator users, call the RPC directly as well as navigating to the page. Expect anonymous/non-admin denial and administrator success. Frontend redirection alone is insufficient. Verify anonymous raw events/profiles/auth.users remain inaccessible and existing public projections still work.
8. **Visual and release acceptance.** Check 375×812, 768×1024, and 1440×900, keyboard focus, chart labels, touch targets, and horizontal overflow. Record physical-device and theme coverage separately. Only then close Phase 1; no trends or additional metrics are included.

### Partial-release risks

- New frontend with an old RPC: missing six-metric fields become unavailable; live cards cannot satisfy acceptance.
- New RPC with an old frontend: the old parser expects published_events/new_users/engagement fields and can display misleading zeros. Cached old clients can outlive the deployment; coordinate the change and require an artifact/session refresh for administrator acceptance rather than adding compatibility shims.
- Correct function without a ledger entry: migration history and live schema disagree; future broad pushes are unsafe until reconciled.
- Local-built artifact with local Supabase URL: production dashboard can point at an unreachable or wrong database. Build-time environment verification is mandatory.

### Rollback

During a failed cutover, suspend analytics acceptance and avoid leaving an incompatible frontend/RPC pair advertised as healthy. Restore the last known-good frontend artifact and its matching **captured deployed RPC definition**, transactionally restoring the captured owner/ACL and notifying PostgREST to reload its schema. Restore both components in a coordinated window, then repeat administrator/unauthorized/public-view checks. Do not drop tables or erase analytics/application data.

Because production already contains the Phase 1 function, its current captured definition is the real rollback starting point; the historical 202609 RPC is not automatically an appropriate production rollback target. It counted profiles and has a weaker authentication guard. The historical definition was used only to prove the local cutover is reversible. If an older frontend artifact requires that historical contract, review and authorize the matching rollback pair before execution.

Keep the original migration ledger intact after a committed release; record rollback/reconciliation as an authorized follow-up migration or release record according to the existing workflow, rather than silently deleting migration history. No rollback was executed against production.

Documentation for the direct read-only API contract: https://github.com/supabase/supabase/blob/master/apps/ui-library/registry/default/platform/platform-kit-nextjs/hooks/use-run-query.ts .

## Failure investigation

Every original failure and every additional individual-run failure is documented in [admin-analytics-phase15-test-failures.md](admin-analytics-phase15-test-failures.md), including current/baseline status and captured errors. Of the original 30 names, 24 fail in both trees, one fails only in the baseline, three editor cases fail only currently, and two pass in both. Thus 25 have direct preimplementation failure evidence; three current-only outcomes and two historical non-reproductions remain unresolved. No analytics-introduced defect has been established. The eight files contain 141 tests: individual runs report 38 current failures and 39 baseline failures. Counts vary between runs and must not replace the original named inventory.

## Impeccable release review

No UI implementation changed during Phase 1.5. The implementation-integrity detector returned `[]` for the analytics page/filter TypeScript and CSS. The unchanged Phase 1 commit retains the prior actual local Supabase browser evidence at all three required viewports, measured contrast, native keyboard selection, focus visibility, 44px controls, no horizontal overflow, and recovery from a simulated HTTP 503. Physical-device touch, a separate dark-theme visual pass, and authenticated production rendering remain unverified. These limits are not represented as passing accessibility or visual certification.

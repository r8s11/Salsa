# SQL current-state consolidation

## Context

The repository currently contains 67 SQL files spread across `supabase/migrations/`, top-level `supabase/`, `supabase/manual/`, `sql/`, and `Docs/sql queries/`. They mix several different concerns: schema history, production drift repair, feature-phase delivery, security corrections, diagnostics, verification, seeds, and optional rollback scripts.

No single file represents the complete database contract used by the application. Numbered migrations omit objects later delivered through manual phase scripts and production repair files; `supabase/reconcile-prod-schema.sql` predates newer Host, flyer, account, and security work. Mechanical concatenation would retain superseded functions and policies rather than express one final state.

The worktree also contains untracked SQL for Host phases, flyer automation, recommendations, manual verification, and the Phase 6 organizer-access migration. Those files are user work and are included when determining the current repository state; they must not be overwritten or discarded.

## Grounded state of the codebase

| SQL surface | Current purpose | Consolidation treatment |
| --- | --- | --- |
| `supabase/migrations/*.sql` | Numbered schema history through Phase 6 organizer access | Fold final object definitions into the canonical migration, then archive unchanged |
| `supabase/reconcile-prod-schema.sql` | Historical production drift reconciliation | Use as an input for missing production-safe guards, then archive unchanged |
| `sql/phase-*` and `sql/host-phase-*` | Manually delivered feature schema, functions, RLS, grants, indexes, and rollback | Fold required current-state definitions into the canonical migration; retain optional rollback only as operational history |
| Root `sql/*.sql` and `sql/recommendations/*.sql` | Production repairs, security hardening, and storage fixes | Security and storage final states supersede earlier definitions; archive superseded repair scripts unchanged |
| `sql/flyer-automation/**` | Preflight, function correction, and postcheck | Fold the final function definition into the canonical migration; retain checks as operational files |
| `sql/final-verification/**`, `supabase/diagnose-*.sql`, `supabase/manual/**` | Diagnostics and verification | Keep active and separate; update paths or assumptions if consolidation changes them |
| `supabase/seed.sql`, `supabase/placeholder-prod.sql`, taxonomy seeds, generated event seeds | Development, production placeholder, and reference data | Keep separate from schema; never merge production and development data |
| `Docs/sql queries/*.sql` | Early ad hoc setup, fixes, and generated data | Archive unchanged; these files are not current setup instructions |

Known precedence requirements:

- Security corrections supersede vulnerable earlier grants and view definitions. In particular, the final audit-log surface must not restore broad authenticated access.
- Event editing requires the final venue and taxonomy objects, `events.venue_id`, taxonomy replacement functions, RLS, grants, and PostgREST schema reload behavior.
- Flyer automation requires the final approval function to carry the persisted submission image into the canonical event.
- Host and account SQL currently present in untracked files is part of the repository state being consolidated.
- Production SQL is never executed automatically. The owner continues to review and run production SQL manually in Supabase Studio.

## Approaches considered

### Repo-derived canonical migration — selected

Resolve every schema object from all repository SQL inputs into one final, idempotent migration, then prove it against a fresh local Supabase database. This includes unapplied repository work and respects the production-execution safety boundary.

### Hosted production dump

A hosted schema dump would best describe the currently deployed database, but it would omit unapplied repository work and require production access. This violates the established no-automated-production-execution boundary, so it is rejected.

### Mechanical concatenation

Concatenating files is fast but leaves duplicate tables, stale functions, conflicting policies, obsolete grants, and order-dependent repairs. It does not produce a current-state contract and is rejected.

## Architecture decision

Create one canonical numbered migration:

`supabase/migrations/20260830010000_current_schema.sql`

This file becomes the sole schema bootstrap and upgrade script in `supabase/migrations/`. It must be safe both for a fresh local database and for manual application to an existing database that may contain any earlier subset of the schema.

Move superseded SQL history into:

`sql/archive/2026-08-30/`

The archive preserves each source file's repository-relative path beneath the dated directory. Files move without content edits. A manifest records original path, archived path, category, whether its current behavior was folded into the canonical migration, and any active replacement.

Operational SQL remains outside the archive only when it still has a current independent purpose:

- local or production data seeds;
- diagnostics and pre/post verification;
- optional rollback scripts;
- manually runnable production data operations that are not schema definitions.

No archived SQL path remains documented as the current setup or upgrade procedure.

## Canonical migration structure

The migration uses dependency order rather than historical phase order:

1. Extensions, shared types, and helper functions.
2. Core tables and final columns/constraints.
3. Reference data required by schema behavior, using conflict-safe inserts.
4. Data normalization and idempotent backfills needed when upgrading an existing database.
5. Foreign keys and integrity constraints, guarded against duplicate creation.
6. Indexes.
7. Trigger functions and triggers.
8. Views and security-definer RPCs.
9. Row-level security enablement and final policies.
10. Grants and explicit revocations.
11. Storage buckets and storage-object policies.
12. PostgREST schema reload notification.

Each database object has one authoritative final definition. Functions and views use `create or replace` where PostgreSQL permits it. Tables, columns, indexes, triggers, and constraints use catalog-aware guards. Policies use `drop policy if exists` followed by one final `create policy`. Grants are paired with explicit revocations when earlier scripts may have widened access.

The header states purpose, required/optional status, execution order, dependencies, safety notes, production review requirement, and rollback limitations. The migration is transaction-wrapped except for statements PostgreSQL or Supabase requires outside a transaction; any such statement is isolated and documented.

## Archive and manifest

The archive is audit history, not an executable migration directory. The manifest separates every SQL file into one of four categories:

- `folded-schema`: final behavior exists in the canonical migration;
- `superseded-repair`: historical repair whose final state exists in the canonical migration;
- `active-operation`: remains runnable outside the archive;
- `historical-data`: retained only for provenance and never presented as current seed data.

Untracked input files are first preserved at their existing paths while their behavior is incorporated. They are moved only after their final object definitions are represented in the canonical migration and the manifest records their provenance.

## Safety and failure handling

- Never connect to or execute against hosted production during consolidation or verification.
- Never run `supabase db push` or `supabase db reset` against production.
- Never merge `supabase/seed.sql` with `supabase/placeholder-prod.sql`.
- Preserve user data: destructive drops are prohibited unless an obsolete object has an explicit, proven replacement and no current caller.
- Fail on unresolved duplicate definitions, unknown dependencies, non-idempotent DDL, policy-name collisions, or schema verification differences. Do not choose an arbitrary winner.
- Preserve the security boundary: authorization remains based on trusted JWT application metadata and final RLS/RPC checks, not profile metadata or UI controls.

## Verification

Verification occurs only in a disposable local Supabase stack.

1. Build an object inventory from all source SQL before moving files.
2. Apply the canonical migration to a fresh local database.
3. Apply it a second time; the second application must succeed without changing the resulting schema or required reference data.
4. Compare tables, columns, constraints, indexes, functions, triggers, views, policies, grants, and storage policies against the resolved final inventory.
5. Run existing SQL preflight, post-migration, diagnostic, and security checks after updating only obsolete paths or assumptions.
6. Exercise RLS and security-definer behavior through the Data API with real role JWTs where existing verification supports it; superuser-only SQL is insufficient evidence for access-control claims.
7. Run application database-contract tests that cover the affected RPCs and tables.
8. Confirm repository documentation and scripts refer to the canonical migration and active operational SQL, not archived setup files.

A successful parse or first application is not sufficient. Required evidence is fresh apply, repeat apply, object-inventory comparison, and security verification.

## Deliverables

- `supabase/migrations/20260830010000_current_schema.sql`
- `sql/archive/2026-08-30/manifest.md`
- Archived historical SQL preserving original relative paths and bytes
- Active, separate seed/diagnostic/verification/rollback SQL
- Updated setup and operational references
- Local verification evidence; no production execution

## Boundaries

This consolidation does not deploy SQL to production, mutate hosted data, infer production drift from an uninspected hosted database, combine development and production seeds, redesign application features, or add new authorization capabilities. It represents the final state expressed by the repository, including current untracked SQL work, and prepares one manually reviewable migration for future controlled application.

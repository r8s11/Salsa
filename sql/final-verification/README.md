# SalsaSegura Admin Dashboard — Final Verification SQL

> **All scripts are READ-ONLY** (SELECT only). They do not modify schema or data.
> **Do not execute production SQL without manual review.** The author runs these
> against production manually.

## Execution Order

1. **`01_preflight_check.sql`** — Run **before** any final SQL changes.
   Verifies that all Phase 1–13 schema objects (tables, columns, RPCs, views,
   indexes, RLS) exist and that grants are correctly scoped. Identifies whether
   the optional backfill (`Phase 14` optional) is needed.

2. **`02_post_migration_verification.sql`** — Run **after** all Phase 12 and
   Phase 13 deployment SQL has been applied. Confirms RPCs exist, grants are
   correct, indexes are present, and smoke-tests both analytics RPCs return
   valid JSON. Also verifies audit log coverage for sensitive actions.

3. **`03_rls_security_check.sql`** — Run **after** deployment. Verifies all
   admin RPCs are `SECURITY DEFINER` with `set search_path = public`, contain
   the runtime admin-role check, and are not granted to `public` or `anon`.

## Script Classification

| Script | Type | Modifies Data? | Modifies Schema? | Risk |
|--------|------|----------------|------------------|------|
| `01_preflight_check.sql` | Read-only | No | No | None |
| `02_post_migration_verification.sql` | Read-only | No | No | None |
| `03_rls_security_check.sql` | Read-only | No | No | None |

## Phase 13 Deployment Scripts (reference)

| Script | Type | Risk |
|--------|------|------|
| `sql/phase-13/001_create_analytics_views.sql` | Schema (view) | None — read-only |
| `sql/phase-13/002_create_analytics_rpcs.sql` | Schema (function) | Security — verify admin role check |
| `sql/phase-13/003_add_analytics_indexes.sql` | Schema (index) | Low — additive, uses `if not exists` |
| `sql/phase-13/004_optional_backfill_dates.sql` | **Data update** | Low — only fills NULL `submitted_at` |

## Phase 12 Deployment Scripts (reference)

| Script | Type | Risk |
|--------|------|------|
| `sql/phase-12/001_create_audit_view_and_rpc.sql` | Schema (view + RPC) | Security — verify admin role check |
| `sql/phase-12/002_add_audit_indexes.sql` | Schema (index) | Low — additive |
| `sql/phase-12/003_add_audit_constraints.sql` | Schema (constraint) | Low — CHECK constraint; no data removal |
| `sql/phase-12/004_optional_backfill_activity.sql` | **Data update** | Low — only backfills null `actor_id` |

## Risks

- **RPC security drift**: If a future edit accidentally removes the
  `if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
  raise exception` guard from `admin_audit_log`,
  `admin_analytics_metrics`, or `admin_analytics_timeseries`, the RPC becomes
  callable by any authenticated user. Re-run `03_rls_security_check.sql`
  regularly to catch this.

- **SECURITY DEFINER + search_path**: All admin functions use
  `set search_path = public`. If this is removed in a future edit, the function
  could be vulnerable to search-path shadowing. The `03_rls_security_check.sql`
  script reports `proconfig` to verify this is set.

- **Backfill scripts**: `sql/phase-12/004_optional_backfill_activity.sql` and
  `sql/phase-13/004_optional_backfill_dates.sql` both UPDATE existing rows.
  They are safe (only fill NULLs) but modify data. Review the affected row count
  from the preflight before running.

## Rollback Considerations

- **RPCs**: `DROP FUNCTION IF EXISTS ... (arg types);`
- **Views**: `DROP VIEW IF EXISTS ...`
- **Indexes**: `DROP INDEX IF EXISTS ...`
- **Constraints**: `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...`
- **Backfills**: Not reversibly harmful — only fills NULLs from existing
  columns. No data is lost.

## Post-execution Verification

1. Run `01_preflight_check.sql` — all `exists` columns should be `true`.
2. Run `02_post_migration_verification.sql` — all checks should pass with
   no errors; RPC smoke tests should return valid JSON.
3. Run `03_rls_security_check.sql` — all admin functions show
   `is_security_definer = true`; zero rows returned for
   public/anon grants on admin or trigger functions.
4. Manually test each admin RPC as a non-admin user — it should raise
   `admin role required`.
5. Verify the admin dashboard loads `/admin/activity` and `/admin/analytics`
   without 500 errors.

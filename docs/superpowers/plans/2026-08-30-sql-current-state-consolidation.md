# SQL Current-State Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragmented schema history with one idempotent current-state Supabase migration, preserve superseded SQL byte-for-byte in a dated archive, retain active operational SQL separately, and prove the result against a disposable local stack.

**Architecture:** Resolve the repository's 67 existing SQL files into one dependency-ordered migration at `supabase/migrations/20260830010000_current_schema.sql`. Historical schema and repair files move beneath `sql/archive/2026-08-30/` with checksums and provenance; seeds, diagnostics, verification, and rollbacks remain operational. Verification uses fresh and repeat local application, catalog comparison, security checks, and real end-user JWTs through PostgREST.

**Tech Stack:** PostgreSQL 15+, Supabase CLI 2.113.0, PostgREST, SQL/PLpgSQL, Node.js 22+, npm 11.6.2

## Global Constraints

- Never connect to or execute SQL against hosted production during implementation or verification.
- Never run `supabase db push`, `supabase db reset`, or destructive database commands against production.
- Production delivery remains a manually reviewed Supabase Studio operation performed by the owner.
- Preserve every input SQL file's bytes before moving it; the untracked Host, flyer, recommendation, manual-verification, and Phase 6 SQL files are user work.
- Do not combine `supabase/seed.sql` with `supabase/placeholder-prod.sql`.
- Do not introduce destructive drops unless the replacement and lack of current callers are proven; keep optional destructive cleanup separate.
- Authorization derives from trusted `auth.users.raw_app_meta_data` / JWT `app_metadata.role`, never `profiles.role` or `user_metadata`.
- Policies use `drop policy if exists` before one final `create policy`; functions use `create or replace`; tables, columns, constraints, triggers, and indexes use idempotent guards.
- Apply grants last, after RLS and policies. Revoke stale broad grants explicitly.
- Final views use `security_invoker = on`; client roles receive no direct access to internal audit or analytics views.
- End the canonical migration with `notify pgrst, 'reload schema';`.
- Run database verification only in a disposable local Supabase stack and exercise access rules with real end-user JWTs through the Data API.

---

## File Structure

| Path | Action | Responsibility |
| --- | --- | --- |
| `supabase/migrations/20260830010000_current_schema.sql` | Create | Sole schema bootstrap and idempotent upgrade migration |
| `sql/archive/2026-08-30/manifest.md` | Create | Provenance, SHA-256, category, folded behavior, replacement for all 67 inputs |
| `sql/archive/2026-08-30/<original-relative-path>` | Create by move | Byte-identical historical migrations, repairs, phase schema, and legacy queries |
| `sql/final-verification/01_preflight_check.sql` | Modify | Pre-apply compatibility/drift checks for an existing database |
| `sql/final-verification/02_post_migration_verification.sql` | Modify | Complete post-apply object, idempotency, and schema-contract checks |
| `sql/final-verification/03_rls_security_check.sql` | Modify | Final view, function, RLS, policy, grant, and advisor-equivalent checks |
| `supabase/manual/phase6_host_access_verification.sql` | Modify | Remove obsolete migration-path wording; retain database-layer host checks |
| `README.md` | Modify | Current local reset, manual production review, active SQL, and archive guidance |
| `supabase/seed.sql` | Keep unchanged unless compatibility requires a minimal column fix | Local development data only |
| `supabase/placeholder-prod.sql` | Keep unchanged | Manually reviewed production placeholder data only |
| `supabase/diagnose-prod-schema.sql` | Keep | Read-only operational diagnostic |
| `supabase/diagnose-prod-events-admin.sql` | Keep | Read-only event-editor diagnostic |
| `sql/flyer-automation/phase-1/001_preflight.sql` | Keep | Flyer preflight operation |
| `sql/flyer-automation/phase-1/001_preflight_flyer_storage.sql` | Keep | Flyer storage preflight operation |
| `sql/flyer-automation/phase-1/004_postcheck.sql` | Keep | Flyer post-apply verification |
| `sql/host-phase-5/900_optional_rollback_host_attendance.sql` | Keep | Optional attendance rollback; never part of bootstrap |
| `sql/phase-10/003_seed_taxonomy_terms.sql` | Keep | Optional/idempotent canonical taxonomy data seed |
| `sql/phase-10/005_remove_events_dance_styles.sql` | Keep | Explicit optional destructive cleanup; never part of bootstrap |

---

### Task 1: Freeze the SQL estate and create the provenance manifest

**Files:**
- Create: `sql/archive/2026-08-30/manifest.md`
- Read without modifying: every existing `*.sql` under `supabase/`, `sql/`, and `Docs/sql queries/`

**Interfaces:**
- Consumes: the 67 SQL files present at task start, including untracked files
- Produces: one manifest row per input with `Original path`, `SHA-256`, `Category`, `Folded current behavior`, and `Replacement/active path`

- [ ] **Step 1: Capture the input list and SHA-256 values before editing SQL**

Run through context-mode from repository root:

```bash
python3 - <<'PY'
from pathlib import Path
import hashlib
roots = [Path('supabase'), Path('sql'), Path('Docs/sql queries')]
files = sorted(p for root in roots for p in root.rglob('*.sql'))
assert len(files) == 67, f'expected 67 input SQL files, found {len(files)}'
for path in files:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    print(f'{digest}  {path.as_posix()}')
PY
```

Expected: exactly 67 unique paths; save the complete output outside the repository as `/tmp/salsa-sql-before.sha256` for later byte comparison.

- [ ] **Step 2: Classify every input with an explicit winner**

Create `sql/archive/2026-08-30/manifest.md` with this header and a row for every input:

```markdown
# SQL archive manifest — 2026-08-30

The archive preserves historical SQL bytes. It is not an executable migration directory.
Production SQL remains manually reviewed and manually run; no repository command targets production.

| Original path | SHA-256 | Category | Folded current behavior | Replacement / active path |
| --- | --- | --- | --- | --- |
```

Use exactly these categories:

```text
folded-schema
superseded-repair
active-operation
historical-data
```

Apply this retained operational allow-list exactly:

```text
supabase/seed.sql
supabase/placeholder-prod.sql
supabase/diagnose-prod-schema.sql
supabase/diagnose-prod-events-admin.sql
supabase/manual/phase6_host_access_verification.sql
sql/final-verification/01_preflight_check.sql
sql/final-verification/02_post_migration_verification.sql
sql/final-verification/03_rls_security_check.sql
sql/flyer-automation/phase-1/001_preflight.sql
sql/flyer-automation/phase-1/001_preflight_flyer_storage.sql
sql/flyer-automation/phase-1/004_postcheck.sql
sql/host-phase-5/900_optional_rollback_host_attendance.sql
sql/phase-10/003_seed_taxonomy_terms.sql
sql/phase-10/005_remove_events_dance_styles.sql
```

All numbered migrations, `supabase/reconcile-prod-schema.sql`, required feature-phase DDL, production repair SQL, and function/policy fixes are `folded-schema` or `superseded-repair`. All `Docs/sql queries/*.sql` are `historical-data`. Do not choose a winner merely by filename date: record the final definition named in Tasks 2–4.

- [ ] **Step 3: Verify complete, duplicate-free manifest coverage**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import re
manifest = Path('sql/archive/2026-08-30/manifest.md').read_text()
inputs = sorted(p.as_posix() for root in [Path('supabase'), Path('sql'), Path('Docs/sql queries')]
                for p in root.rglob('*.sql')
                if 'sql/archive/2026-08-30/' not in p.as_posix())
rows = re.findall(r'^\| (`?)([^|`]+?)\1 \| [0-9a-f]{64} \|', manifest, re.M)
listed = [path.strip() for _, path in rows]
assert len(inputs) == 67
assert sorted(listed) == inputs, (set(inputs) - set(listed), set(listed) - set(inputs))
assert len(listed) == len(set(listed))
print('PASS: manifest covers 67 inputs exactly once')
PY
```

Expected: `PASS: manifest covers 67 inputs exactly once`.

- [ ] **Step 4: Commit the immutable inventory before consolidation**

```bash
git add sql/archive/2026-08-30/manifest.md
git commit -m "docs: inventory SQL consolidation inputs"
```

---

### Task 2: Build the canonical relational schema and upgrade backfills

**Files:**
- Create: `supabase/migrations/20260830010000_current_schema.sql`
- Reference: `supabase/migrations/*.sql`
- Reference: `supabase/reconcile-prod-schema.sql`
- Reference: `sql/phase-10/*.sql`
- Reference: `sql/host-phase-5/*.sql`
- Reference: `supabase/migrations/20260830000000_phase6_host_organizer_access.sql`

**Interfaces:**
- Consumes: final table/column/constraint definitions and idempotent data migrations from historical inputs
- Produces: all final tables and integrity constraints required by Tasks 3–4

- [ ] **Step 1: Add the reviewed migration header and transaction boundary**

Start the file with:

```sql
-- =====================================================================
-- SalsaSegura current schema — REQUIRED
--
-- Purpose: sole schema bootstrap and idempotent upgrade script.
-- Execution order: run before seed, diagnostic, verification, or rollback SQL.
-- Dependencies: Supabase-managed auth, storage, pgcrypto, and PostgREST roles.
-- Safety: review manually before production; never run db push/reset on production.
-- Rollback: no automatic rollback; restore from backup and use reviewed feature
-- rollback scripts where one exists. This script preserves existing user data.
-- =====================================================================

begin;

create extension if not exists pgcrypto with schema extensions;
```

Do not place `notify` inside this transaction; Task 4 adds it after `commit`.

- [ ] **Step 2: Define the final core and feature tables in dependency order**

The file must create these 14 public tables exactly once:

```text
events
profiles
audit_logs
event_submissions
event_import_batches
venues
taxonomy_terms
event_taxonomy_terms
platform_settings
organizer_requests
organizers
organizer_members
event_attendees
event_check_ins
```

Use the final column sets from `supabase/reconcile-prod-schema.sql`, then layer later definitions from Phase 10, Host Phase 5, Phase 6 organizer access, and flyer repairs. The canonical `events` table must include current venue, taxonomy-adjacent, organizer, flyer, moderation, recurrence, submitter, source, publication, and audit columns consumed by the application.

For existing databases, follow every `create table if not exists` with guarded `alter table ... add column if not exists` statements so partial historical states converge on the same columns.

- [ ] **Step 3: Add deterministic upgrade backfills before constraints**

Include only current, idempotent data transitions:

```sql
update public.event_submissions
set submitted_at = coalesce(submitted_at, created_at, now())
where submitted_at is null;
```

Fold the Phase 10 legacy dance-style-to-taxonomy migration with `on conflict do nothing`, but do not include `drop column dance_styles`. Preserve existing rows when deriving venue, organizer, taxonomy, submission, and attendance relationships.

- [ ] **Step 4: Add constraints with catalog guards**

Use this pattern for every named constraint that cannot use `if not exists`:

```sql
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_venue_id_fkey'
  ) then
    alter table public.events
      add constraint events_venue_id_fkey
      foreign key (venue_id) references public.venues(id) on delete set null;
  end if;
end
$$;
```

Retain final check constraints for status, role, member state, attendance state, source type, taxonomy kind, and organizer state. Before adding a stricter check, normalize only values for which an existing historical mapping is explicit; otherwise raise and stop rather than silently rewriting user data.

- [ ] **Step 5: Add all final indexes without duplicates**

Create the resolved set of 53 named indexes with `create [unique] index if not exists`. Composite foreign keys must have matching composite indexes; do not retain redundant single-column indexes when the composite leading prefix covers the same access path.

- [ ] **Step 6: Statistically verify the relational section**

Run a parser-based inventory over the new file:

```bash
python3 - <<'PY'
from pathlib import Path
import re
sql = Path('supabase/migrations/20260830010000_current_schema.sql').read_text()
tables = set(re.findall(r'create\s+table\s+if\s+not\s+exists\s+public\.([a-z0-9_]+)', sql, re.I))
expected = {
 'events','profiles','audit_logs','event_submissions','event_import_batches',
 'venues','taxonomy_terms','event_taxonomy_terms','platform_settings',
 'organizer_requests','organizers','organizer_members','event_attendees','event_check_ins'
}
assert tables == expected, (expected - tables, tables - expected)
assert 'drop column dance_styles' not in sql.lower()
print('PASS: 14 final tables; no destructive taxonomy drop')
PY
```

Expected: `PASS: 14 final tables; no destructive taxonomy drop`.

- [ ] **Step 7: Commit the relational current state**

```bash
git add supabase/migrations/20260830010000_current_schema.sql
git commit -m "feat(db): consolidate current relational schema"
```

---

### Task 3: Fold final functions, views, triggers, and RPC contracts

**Files:**
- Modify: `supabase/migrations/20260830010000_current_schema.sql`
- Reference: `supabase/reconcile-prod-schema.sql`
- Reference: `sql/2026-08-25-repair-event-edit-taxonomy.sql`
- Reference: `sql/flyer-automation/phase-1/002_update_submission_approval_image.sql`
- Reference: `sql/recommendations/handle_new_user_privilege_hardening.sql`
- Reference: `supabase/migrations/20260820000000_fix_admin_invite_user.sql`

**Interfaces:**
- Consumes: the tables and constraints produced by Task 2
- Produces: the 51 final functions, two internal views, and 20 triggers used by Task 4 policies/grants and the application

- [ ] **Step 1: Resolve each duplicated function to one final body**

Add one `create or replace function` definition for each function in the resolved inventory. The duplicate winners must include:

```text
admin_invite_user               -> 20260820000000_fix_admin_invite_user.sql
replace_event_taxonomy_terms    -> sql/phase-10/002_create_event_taxonomy_terms.sql
approve_event_submission       -> sql/flyer-automation/phase-1/002_update_submission_approval_image.sql
handle_new_user                -> sql/recommendations/handle_new_user_privilege_hardening.sql
organizer_create_event         -> 20260830000000_phase6_host_organizer_access.sql
organizer_update_event         -> 20260830000000_phase6_host_organizer_access.sql
```

`approve_event_submission` must copy `submitted_data ->> 'image_url'` into `events.image_url`. `organizer_update_event` must continue rejecting status, ownership, and submitter-field mutation. Every `security definer` function must set an explicit trusted `search_path` and contain its own runtime authorization check.

- [ ] **Step 2: Add the internal views with invoker security**

Create the final view queries, then harden them in the same migration:

```sql
alter view public.audit_log_view set (security_invoker = on);
alter view public.v_analytics_event_counts set (security_invoker = on);
revoke all on public.audit_log_view from public, anon, authenticated;
revoke all on public.v_analytics_event_counts from public, anon, authenticated;
```

Do not restore the historical authenticated `select` grant on `audit_log_view`.

- [ ] **Step 3: Recreate each trigger idempotently**

Use one final body for each of the 20 trigger functions/triggers. For each trigger:

```sql
drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();
```

Include immutable-column guards for attendance/check-in rows, submission ownership guards, audit triggers, derived venue fields, organizer slug generation, and updated-at triggers.

- [ ] **Step 4: Revoke direct execution from non-RPC helpers**

Apply this form to trigger and private helper functions:

```sql
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.log_event_change() from public, anon, authenticated;
revoke all on function public.log_submission_change() from public, anon, authenticated;
```

Repeat for all trigger-only and internal mutation helpers. Publicly callable RPCs receive grants only in Task 4.

- [ ] **Step 5: Verify exact function/view/trigger coverage**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import re
sql = Path('supabase/migrations/20260830010000_current_schema.sql').read_text()
functions = set(re.findall(r'create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)', sql, re.I))
views = set(re.findall(r'create\s+(?:or\s+replace\s+)?view\s+public\.([a-z0-9_]+)', sql, re.I))
triggers = set(re.findall(r'create\s+trigger\s+([a-z0-9_]+)', sql, re.I))
assert len(functions) == 51, len(functions)
assert views == {'audit_log_view', 'v_analytics_event_counts'}
assert len(triggers) == 20, len(triggers)
assert 'security_invoker = on' in sql
print('PASS: 51 functions, 2 invoker views, 20 triggers')
PY
```

Expected: `PASS: 51 functions, 2 invoker views, 20 triggers`.

- [ ] **Step 6: Commit the executable database contracts**

```bash
git add supabase/migrations/20260830010000_current_schema.sql
git commit -m "feat(db): consolidate functions and triggers"
```

---

### Task 4: Resolve final RLS, grants, storage, and schema reload

**Files:**
- Modify: `supabase/migrations/20260830010000_current_schema.sql`
- Reference: `sql/2026-08-25-fix-security-definer-views.sql`
- Reference: `sql/2026-08-25-fix-event-flyer-public-access.sql`
- Reference: `sql/2026-08-21_event_flyers_storage.sql`
- Reference: `sql/host-phase-4/001_owner_read_event_taxonomy_terms.sql`
- Reference: `sql/host-phase-5/006_add_host_attendance_rls.sql`
- Reference: `sql/host-phase-5/007_add_host_attendance_grants.sql`
- Reference: `sql/host-phase-6/001_owner_manage_event_submissions.sql`

**Interfaces:**
- Consumes: tables and predicates from Tasks 2–3
- Produces: final API-visible authorization surface and storage access model

- [ ] **Step 1: Enable RLS on every API-reachable public table**

Use explicit statements:

```sql
alter table public.events enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;
```

Repeat for all 14 public tables. Do not leave an enabled table with no intended policy and a broad table grant.

- [ ] **Step 2: Replace policies rather than stacking historical variants**

For every resolved policy use:

```sql
drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
on public.events for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
```

Resolve all 58 policy names to one final definition. Preserve the hard cutover to `event_submissions`; do not restore the obsolete anonymous direct insert policy on `events`. Preserve Host owner/manager access, moderator/admin inheritance, attendance isolation, and flyer read rules from the latest feature/security scripts.

- [ ] **Step 3: Apply grants only after policies**

Revoke stale privileges only on the 14 repository-owned tables and 51 repository-owned functions before granting the minimum API surface. Never use schema-wide revocation: an existing production database may contain unrelated `public` objects outside this repository's contract.

```sql
revoke all on public.events, public.profiles, public.audit_logs,
  public.event_submissions, public.event_import_batches, public.venues,
  public.taxonomy_terms, public.event_taxonomy_terms, public.platform_settings,
  public.organizer_requests, public.organizers, public.organizer_members,
  public.event_attendees, public.event_check_ins
from anon, authenticated;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'account_is_active', 'admin_analytics_metrics', 'admin_analytics_timeseries',
        'admin_approve_organizer_request', 'admin_audit_log', 'admin_invite_user',
        'admin_organizer_request_counts', 'admin_organizer_request_detail',
        'admin_organizer_requests', 'admin_reject_organizer_request',
        'admin_revoke_organizer_access', 'admin_set_user_role',
        'admin_set_user_status', 'admin_taxonomy_detail',
        'admin_taxonomy_directory', 'admin_taxonomy_search',
        'admin_user_directory', 'admin_venue_detail', 'admin_venue_directory',
        'admin_venue_search', 'approve_event_submission',
        'can_manage_event_attendance', 'category_of',
        'guard_event_attendee_immutable_columns',
        'guard_event_check_in_immutable_columns',
        'guard_submitter_submission_update', 'handle_new_user',
        'is_active_organizer_member', 'is_admin', 'is_moderator', 'is_organizer',
        'is_platform_admin', 'log_event_change', 'log_platform_settings_change',
        'log_submission_change', 'log_taxonomy_term_change',
        'merge_taxonomy_terms', 'merge_venues', 'organizer_create_event',
        'organizer_member_role', 'organizer_update_event',
        'public_event_suggestions_enabled', 'registered_event_submissions_enabled',
        'replace_event_taxonomy_terms', 'require_taxonomy_moderator',
        'set_organizer_slug', 'set_updated_at', 'set_venue_derived_fields',
        'slugify', 'stamp_platform_settings_update', 'venue_quality_issues'
      ])
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      fn.signature
    );
  end loop;
end
$$;
```

Then explicitly grant required table verbs and RPC execution. Admin RPCs are executable by `authenticated` only and still self-gate on JWT `app_metadata.role`. Trigger functions and internal views remain inaccessible to client roles.

- [ ] **Step 4: Fold storage bucket and object policies**

Create/update the event-flyer bucket with idempotent data DML and final policies. Public reads must match the current flyer public-access repair; writes remain scoped to the intended authenticated/owner flow. Do not enable the local Storage service in `supabase/config.toml` as part of this task; verification may inspect catalog policy definitions even when the local service is disabled.

- [ ] **Step 5: Close the transaction and reload PostgREST**

The file must end exactly with:

```sql
commit;

notify pgrst, 'reload schema';
```

- [ ] **Step 6: Run static security assertions**

```bash
python3 - <<'PY'
from pathlib import Path
import re
sql = Path('supabase/migrations/20260830010000_current_schema.sql').read_text()
assert sql.rstrip().endswith("notify pgrst, 'reload schema';")
assert 'grant select on public.audit_log_view to authenticated' not in sql.lower()
assert 'grant select on public.v_analytics_event_counts to authenticated' not in sql.lower()
assert 'drop policy if exists' in sql.lower()
assert "user_metadata" not in sql.lower()
assert len(re.findall(r'create\s+policy\s+', sql, re.I)) == 58
print('PASS: final policy count and critical revocations')
PY
```

Expected: `PASS: final policy count and critical revocations`.

- [ ] **Step 7: Commit the final security surface**

```bash
git add supabase/migrations/20260830010000_current_schema.sql
git commit -m "feat(db): consolidate RLS and grants"
```

---

### Task 5: Prove fresh application and repeat application locally

**Files:**
- Modify only if verification finds a source defect: `supabase/migrations/20260830010000_current_schema.sql`
- Test: `sql/final-verification/02_post_migration_verification.sql`
- Test: `sql/final-verification/03_rls_security_check.sql`

**Interfaces:**
- Consumes: complete canonical migration from Tasks 2–4
- Produces: observed fresh-install and idempotent-upgrade evidence before any history is moved

- [ ] **Step 1: Start the disposable local stack**

Run through context-mode:

```bash
npm run db:start
npx supabase status -o env
```

Expected: local API on `127.0.0.1:54321` and database on `127.0.0.1:54322`. Do not use linked or remote flags.

- [ ] **Step 2: Apply the canonical migration through a fresh reset**

```bash
npm run db:reset
```

Expected: the sole canonical migration applies, then `supabase/seed.sql` applies; no syntax, dependency, constraint, or seed compatibility error.

- [ ] **Step 3: Capture a schema fingerprint**

Run a catalog dump containing tables, columns, constraints, indexes, functions, views, triggers, policies, and grants; hash the normalized output:

```bash
npx supabase db dump --local --schema public --schema storage > /tmp/salsa-schema-first.sql
sha256sum /tmp/salsa-schema-first.sql
```

Record the hash as `/tmp/salsa-schema-first.sha256`.

- [ ] **Step 4: Apply the same migration a second time**

Discover the local database container from `docker ps` and pipe the canonical file to `psql` with `ON_ERROR_STOP=1`:

```bash
docker exec -i -e PGPASSWORD=postgres supabase_db_Salsa \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/migrations/20260830010000_current_schema.sql
```

Expected: exit 0. If the local project container uses a normalized lowercase name, use the exact name reported by `docker ps`; do not change application SQL to accommodate a container-name difference.

- [ ] **Step 5: Prove the second application is state-neutral**

```bash
npx supabase db dump --local --schema public --schema storage > /tmp/salsa-schema-second.sql
diff -u /tmp/salsa-schema-first.sql /tmp/salsa-schema-second.sql
```

Expected: no diff. A changing timestamp or regenerated object definition is a failure; make the migration state-neutral rather than filtering the difference away.

- [ ] **Step 6: Run current catalog/security checks**

```bash
docker exec -i -e PGPASSWORD=postgres supabase_db_Salsa \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < sql/final-verification/02_post_migration_verification.sql

docker exec -i -e PGPASSWORD=postgres supabase_db_Salsa \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < sql/final-verification/03_rls_security_check.sql
```

Expected: all expected object rows present; zero public/anon grants on admin RPCs and internal views; no mutable `search_path`; no public table with RLS disabled; no unindexed foreign keys or duplicate indexes.

- [ ] **Step 7: Commit only source corrections required by observed failures**

```bash
git add supabase/migrations/20260830010000_current_schema.sql
git commit -m "fix(db): make canonical schema repeatable"
```

Skip this commit if verification required no source correction.

---

### Task 6: Archive superseded SQL without changing bytes

**Files:**
- Move: historical SQL to `sql/archive/2026-08-30/<original-relative-path>`
- Modify: `sql/archive/2026-08-30/manifest.md`
- Keep: the exact operational allow-list from Task 1

**Interfaces:**
- Consumes: proven canonical migration and pre-edit checksums
- Produces: one migration in `supabase/migrations/`, active operational SQL outside the archive, and byte-identical historical files inside it

- [ ] **Step 1: Move every non-operational input beneath the dated archive**

Preserve the complete original relative path. Examples:

```text
supabase/migrations/20260101000000_baseline_events_schema.sql
  -> sql/archive/2026-08-30/supabase/migrations/20260101000000_baseline_events_schema.sql
supabase/reconcile-prod-schema.sql
  -> sql/archive/2026-08-30/supabase/reconcile-prod-schema.sql
sql/phase-10/001_create_taxonomy_terms.sql
  -> sql/archive/2026-08-30/sql/phase-10/001_create_taxonomy_terms.sql
Docs/sql queries/events.sql
  -> sql/archive/2026-08-30/Docs/sql queries/events.sql
```

Use `mv`, never rewrite/copy-delete through a formatter. Leave `supabase/migrations/20260830010000_current_schema.sql` as the only migration.

- [ ] **Step 2: Verify preserved bytes against the pre-edit checksum list**

```bash
python3 - <<'PY'
from pathlib import Path
import hashlib
before = {}
for line in Path('/tmp/salsa-sql-before.sha256').read_text().splitlines():
    digest, original = line.split('  ', 1)
    before[original] = digest
active = {
 'supabase/seed.sql','supabase/placeholder-prod.sql',
 'supabase/diagnose-prod-schema.sql','supabase/diagnose-prod-events-admin.sql',
 'supabase/manual/phase6_host_access_verification.sql',
 'sql/final-verification/01_preflight_check.sql',
 'sql/final-verification/02_post_migration_verification.sql',
 'sql/final-verification/03_rls_security_check.sql',
 'sql/flyer-automation/phase-1/001_preflight.sql',
 'sql/flyer-automation/phase-1/001_preflight_flyer_storage.sql',
 'sql/flyer-automation/phase-1/004_postcheck.sql',
 'sql/host-phase-5/900_optional_rollback_host_attendance.sql',
 'sql/phase-10/003_seed_taxonomy_terms.sql',
 'sql/phase-10/005_remove_events_dance_styles.sql',
}
for original, expected in before.items():
    path = Path(original) if original in active else Path('sql/archive/2026-08-30') / original
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    assert actual == expected, f'byte drift: {original}'
print(f'PASS: {len(before)} original SQL files preserved byte-for-byte')
PY
```

Expected: `PASS: 67 original SQL files preserved byte-for-byte`.

- [ ] **Step 3: Verify current layout**

```bash
python3 - <<'PY'
from pathlib import Path
migrations = list(Path('supabase/migrations').glob('*.sql'))
assert [p.name for p in migrations] == ['20260830010000_current_schema.sql']
assert len(list(Path('sql/archive/2026-08-30').rglob('*.sql'))) == 53
print('PASS: one current migration and 53 archived SQL files')
PY
```

If the archived count differs because the initial 67-file inventory changed during implementation, stop and reconcile the manifest and allow-list; do not weaken the assertion.

- [ ] **Step 4: Update manifest paths and folded behavior notes**

Every archived row names its exact archive destination. Every active row names its unchanged or intentionally modified active path. Record the canonical migration as the replacement for every `folded-schema` and `superseded-repair` row.

- [ ] **Step 5: Commit the archive cutover**

```bash
git add -A supabase/migrations supabase/reconcile-prod-schema.sql sql Docs/sql\ queries
git commit -m "chore(db): archive superseded SQL history"
```

---

### Task 7: Update current verification and operational guidance

**Files:**
- Modify: `sql/final-verification/01_preflight_check.sql`
- Modify: `sql/final-verification/02_post_migration_verification.sql`
- Modify: `sql/final-verification/03_rls_security_check.sql`
- Modify: `supabase/manual/phase6_host_access_verification.sql`
- Modify: `README.md`

**Interfaces:**
- Consumes: final object inventory and archive layout
- Produces: current, executable verification and setup instructions with no active reference to archived SQL

- [ ] **Step 1: Correct preflight object names and scope**

Replace stale `taxonomy_term_events` with `event_taxonomy_terms`. Expand the table list to all 14 final tables. Add compatibility checks for columns/backfills the canonical migration needs before tightening constraints. Keep the file read-only.

The header must state:

```sql
-- Run only against the database the owner intends to inspect.
-- This file is read-only and does not establish that hosted production
-- matches the repository; it reports compatibility before manual review.
```

- [ ] **Step 2: Make post-migration verification exhaustive**

Assert exact presence of the 14 tables, 51 functions, two views, 20 triggers, final policy set, storage bucket/policies, required indexes, and zero nulls in required backfilled columns. Add `raise exception` assertions in a transaction that rolls back, so a missing object produces a non-zero exit rather than a visually inspected row.

- [ ] **Step 3: Add advisor-equivalent security failures**

Update `03_rls_security_check.sql` to fail on:

```text
public table with RLS disabled
RLS-enabled table with no policy
security-definer function with missing/mutable search_path
anon/public execution on admin or trigger functions
anon/authenticated SELECT on internal views
security-definer view or missing security_invoker option
multiple equivalent permissive policies for the same table/action/role
unindexed foreign key, including composite foreign keys
exact duplicate index definitions
```

Retain the explicit audit-log check and require zero direct client grants on `audit_log_view` and `v_analytics_event_counts`.

- [ ] **Step 4: Remove obsolete migration-path wording from Host verification**

Change lines 4–6 of `supabase/manual/phase6_host_access_verification.sql` to refer to `supabase/migrations/20260830010000_current_schema.sql`. Preserve its fixture and assertion logic; this is a path correction, not an authorization redesign.

- [ ] **Step 5: Document the current workflow in README**

Add a `## Database schema` section with these exact operational facts:

```markdown
- Current schema: `supabase/migrations/20260830010000_current_schema.sql`.
- Local reset: `npm run db:start` then `npm run db:reset`.
- Production: review SQL manually and run it in Supabase Studio; never run repository reset/push commands against production.
- Local seed: `supabase/seed.sql` only.
- Production placeholder data: `supabase/placeholder-prod.sql` only; never use the local seed in production.
- Historical SQL: `sql/archive/2026-08-30/manifest.md`; archive files are provenance, not an execution sequence.
- Current diagnostics, pre/post checks, and optional rollbacks remain outside the archive.
```

Do not rewrite historical design/plan documents that accurately describe the state at their own date.

- [ ] **Step 6: Verify no active instruction points to archived execution paths**

Run a repository regex search excluding `Docs/Done`, historical plans/specs, and `sql/archive` itself. Expected active references are only the canonical migration and retained operational files.

- [ ] **Step 7: Commit verification and operational guidance**

```bash
git add README.md sql/final-verification supabase/manual/phase6_host_access_verification.sql
git commit -m "docs(db): point operations at canonical schema"
```

---

### Task 8: Prove authorization with real JWTs and run final gates

**Files:**
- Test: `supabase/migrations/20260830010000_current_schema.sql`
- Test: `sql/final-verification/*.sql`
- Test: application database contracts under `src/**/*.test.ts` and `src/**/*.test.tsx`
- No permanent fixture files

**Interfaces:**
- Consumes: final repository layout and current verification SQL
- Produces: end-to-end local evidence and a clean disposable environment

- [ ] **Step 1: Reset from only the canonical migration**

```bash
npm run db:reset
```

Expected: one migration plus `supabase/seed.sql` applies cleanly.

- [ ] **Step 2: Create real local users and decode their claims**

Using the local service-role key from `npx supabase status -o env`, create:

```text
admin@test.local       app_metadata.role = admin
moderator@test.local   app_metadata.role = moderator
organizer-a@test.local app_metadata.role = organizer
organizer-b@test.local app_metadata.role = organizer
user@test.local        app_metadata.role = user
```

Authenticate each by password grant through `/auth/v1/token?grant_type=password`. Decode each JWT payload and assert the role is in `app_metadata.role`; reject a token whose role appears only in `user_metadata`.

- [ ] **Step 3: Seed the adversarial fixture matrix as postgres**

Create two organizers, distinct memberships, own/cross-organizer draft events, pending/rejected/approved submissions, attendance rows, taxonomy links, and audit rows. Include:

```text
organizer A owning organizer/event A
organizer B owning organizer/event B
organizer A removed from organizer B
plain user owning an in-scope-looking submission
admin and moderator actors
anonymous requests
```

Use fresh IDs so unique constraints cannot mask RLS or foreign-key assertions.

- [ ] **Step 4: Exercise Data API reads and writes with each real JWT**

Assert observed PostgREST denial shapes exactly:

```text
blocked SELECT                  -> 200 with []
blocked UPDATE/DELETE           -> 200/204 with zero returned rows
blocked INSERT by RLS           -> 403 with SQLSTATE 42501
unique violation                -> 409 with SQLSTATE 23505
foreign-key violation           -> 409 with SQLSTATE 23503
check violation                 -> 400 with SQLSTATE 23514
```

Positive controls must prove admin access, moderator review access, organizer own-scope access, flyer public read, and permitted submission/attendance operations. Negative controls must prove cross-organizer isolation, plain-user role denial, anonymous denial, approved-event owner immutability, internal-view denial, and admin-RPC denial for non-admin JWTs.

- [ ] **Step 5: Run database-layer checks**

```bash
docker exec -i -e PGPASSWORD=postgres supabase_db_Salsa \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < sql/final-verification/02_post_migration_verification.sql

docker exec -i -e PGPASSWORD=postgres supabase_db_Salsa \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < sql/final-verification/03_rls_security_check.sql

docker exec -i -e PGPASSWORD=postgres supabase_db_Salsa \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/manual/phase6_host_access_verification.sql
```

Expected: all scripts exit 0 and print their pass notices.

- [ ] **Step 6: Run application gates once**

Run through context-mode and inspect the full captured result:

```bash
npm run test -- --run
npm run lint
npm run build
```

Expected: Vitest exits 0, ESLint exits 0 with zero warnings, TypeScript/Vite production build exits 0.

- [ ] **Step 7: Re-check archive integrity after all edits**

Re-run Task 6's SHA-256 verifier. Expected: every archived historical file still matches `/tmp/salsa-sql-before.sha256`; only retained operational files explicitly modified in Task 7 may differ at their active paths.

- [ ] **Step 8: Clean the disposable environment**

Delete fixture rows and Auth users, confirm residual fixture counts are zero, then run:

```bash
npm run db:stop
rm -rf supabase/.temp
```

Do not use `git clean -fdx`; it would delete `.env.local` and `node_modules`.

- [ ] **Step 9: Commit any final verification-driven corrections**

```bash
git add supabase/migrations/20260830010000_current_schema.sql sql/final-verification README.md
git commit -m "fix(db): close consolidation verification gaps"
```

Skip this commit if final verification required no source change.

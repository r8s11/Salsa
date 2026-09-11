# Phase 2 — Founder Access Request: Operations Runbook

Repository changes for Phase 2 add the public request flow, a dedicated table, and a controlled Edge Function. **No hosted Supabase or DNS setting has been changed by this repository work.** This runbook consolidates every hosted step a human operator must perform (or verify) to make the Phase 2 flow production-ready, and records the audit findings discovered during the phase.

---

## 1. Architecture summary (as of Phase 2)

- One canonical submission endpoint: `POST /functions/v1/request-founder-access` (`supabase/functions/request-founder-access/index.ts`).
- Public, unauthenticated: any visitor can submit without an account.
- Write boundary: the Edge Function is the **only** writer for public submissions — it authenticates with the service role, bypasses RLS, and enforces payload validation, normalization, honeypot trip, body-size guard, duplicate suppression, and forced `status='pending'`. No other code path inserts into `founder_access_requests`.
- Safe redirect destination: the page renders an in-page success card and a "Return Home" link; no redirect to `/signin`, no account creation.
- API contract: `200 { success: true }` on every successful path (fresh insert, duplicate suppression, honeypot tripped) — deliberately identical so an external probe cannot learn whether a given email has applied. Errors return a generic message; raw server/Supabase errors are never surfaced.

## 2. Database migration (manual)

In **Supabase Dashboard → SQL Editor** (or `psql` against the production database), run:

```sql
-- supabase/migrations/20260831000001_founder_access_requests.sql
-- (The full file is the canonical source — paste via Dashboard or apply with
--  supabase db push / psql -f.)
```

This single file creates:
- Table `public.founder_access_requests` (20 columns: applicant + org + contact + description + status + admin review fields + timestamps)
- Status `CHECK` constraint: `pending | approved | rejected`
- Status default: `pending`
- **Partial unique index** `(normalized_email) WHERE status='pending'` — atomic duplicate suppression (two concurrent submissions can no longer both insert)
- Indexes for the Phase 3 review queue (status+created_at, normalized_email, normalized_org_name)
- `updated_at` trigger (reuses `set_updated_at()` from `20260813000000_profiles.sql`)
- RLS enabled; policies: `Admins manage founder requests` (admin full), `Moderators read founder requests` (read for the Phase 3 queue)
- `log_founder_request_change()` audit trigger (`actor_id` is null for anon/edge-function inserts; set on admin review actions)

**Execution order**: standalone; depends on `set_updated_at()`, `is_admin()`, `is_moderator()` — all present in earlier migrations. Safe to apply after Phase 6.

**No `anon` privileges** are granted on this table. Public submission goes exclusively through the Edge Function, which uses the service role (bypasses RLS).

**Migration-timestamp note**: this file uses `20260831000001` (after `20260831000000_phase5_host_attendance.sql`). The pre-existing collision on prefix `20260830000000` (two files, documented in `Docs/operations/phase1-auth-email-foundation.md` §7) is unrelated to this phase.

## 3. Edge Function deployment (manual)

The function is auto-discovered by the local stack (`supabase start`) from `supabase/functions/request-founder-access/`. For production, deploy explicitly:

```bash
supabase functions deploy request-founder-access
```

**No `--no-verify-jwt` flag needed**: default gateway JWT verification is correct here. `supabase.functions.invoke()` always sends the publishable key (when signed out) or the session token (when signed in), both of which are valid Supabase JWTs the gateway accepts. No caller identity is used for authorization — payload validation is the whole boundary.

**Function secrets (production)**: the function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Both are platform-provided env vars for Edge Functions and need no manual configuration. There are no other required secrets (no Resend, no custom SMTP — Phase 2 does NOT send email).

## 4. No env var changes for the frontend

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (already set in Azure Static Web Apps / GitHub Actions secrets) are sufficient. The frontend calls the function via the canonical `supabase.functions.invoke()` pattern — the SDK constructs the correct per-environment URL.

## 5. Routing

- The page is registered at `GET /founders` in `src/App.tsx` (public, no guard).
- The Footer (`src/components/Footer/Footer.tsx`) includes a discreet "Host an event" link pointing to `/founders` — the spec's recommended least-disruptive nav surface (existing footer link group).

## 6. Manual QA — verification SQL (run after applying the migration)

These are the queries used to verify the migration in the live local stack. The same queries work against production.

```sql
-- 1. Table exists with expected shape
select 'columns: ' || count(*)
from information_schema.columns
where table_name = 'founder_access_requests';
-- expect: 20

-- 2. Status default
select column_default
from information_schema.columns
where table_name = 'founder_access_requests' and column_name = 'status';
-- expect: 'pending'::text

-- 3. Status CHECK
select pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.founder_access_requests'::regclass and conname like '%status%';
-- expect: CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))

-- 4. Partial unique index (atomic duplicate suppression)
select indexdef from pg_indexes
where tablename = 'founder_access_requests' and indexdef like '%WHERE%';
-- expect: CREATE UNIQUE INDEX founder_access_requests_pending_email_uniq
--   ON public.founder_access_requests USING btree (normalized_email)
--   WHERE (status = 'pending'::text)

-- 5. RLS enabled
select relrowsecurity from pg_class where relname = 'founder_access_requests';
-- expect: t

-- 6. Policies
select string_agg(policyname, ', ') from pg_policies where tablename = 'founder_access_requests';
-- expect: Admins manage founder requests, Moderators read founder requests

-- 7. No anon access (anon can ONLY reach the table via the Edge Function, never directly)
--    Test from an anon-key request against PostgREST — all four CRUD operations
--    must return 401 permission denied. (Verified live in this phase.)
--    Equivalent psql check:
set role anon;
select * from public.founder_access_requests limit 1;
-- expect: ERROR: permission denied for table founder_access_requests
reset role;

-- 8. Anon cannot insert (no policy, no privilege)
set role anon;
insert into public.founder_access_requests
  (applicant_name, email, normalized_email, organization_name, normalized_org_name)
values ('x', '[EMAIL]', '[EMAIL]', 'x', 'x');
-- expect: ERROR: permission denied for table founder_access_requests
reset role;

-- 9. After a real submission, the row is present and forced-pending
select applicant_name, email, status from public.founder_access_requests order by created_at desc limit 1;
-- expect: status = 'pending'

-- 10. Duplicate suppression is atomic — this second INSERT must 23505
insert into public.founder_access_requests
  (applicant_name, email, normalized_email, organization_name, normalized_org_name, status)
select 'Second Try', email, normalized_email, 'Second Org', 'second org', 'pending'
from public.founder_access_requests limit 1;
-- expect: ERROR: duplicate key value violates unique constraint
--   "founder_access_requests_pending_email_uniq"
```

## 7. Manual QA — browser flow (production after deploy)

| Scenario | Expected Result | Verification |
|---|---|---|
| Visit `/founders` while signed out | Form renders, no redirect to signin | Verified locally (real browser, 375px + 1440px) |
| Submit valid required fields | In-page success card with "Return Home" link; H1 focused; no redirect | Verified locally |
| Resubmit same email (different casing) | Identical success card; only one pending row in DB | Verified locally (function returns identical body; index atomically blocks second insert) |
| Try direct PostgREST insert as anon | 401 permission denied | Verified locally (SELECT/INSERT/UPDATE/DELETE all 401) |
| Submit with honeypot field filled | Success card shown, NO row inserted | Verified locally (honeypot trips → success without insert) |
| Submit invalid email | Generic error banner; form values retained; no row | Verified locally (client + server validation) |
| Visit on 375px viewport | No horizontal overflow, tap targets readable | Verified locally (overflow=false) |
| Footer link to `/founders` | Renders, navigates | Verified locally |

## 8. Phase 2 findings (pre-existing defects discovered during audit)

1. **Local-stack `service_role` table-privilege gap** (blocks ALL edge-function writes on postgres-owned tables locally): the local Supabase stack's default `postgres`-owner ACL grants `service_role` only `Dxtm` (DELETE/REFERENCES/TRIGGER/TRUNCATE) — **no SELECT or INSERT** — on tables created by `postgres` (which includes every table created by the migration engine). This means `invite-organizer`, `send-auth-email`, `delete-account`, `request-founder-access`, and every other Edge Function in the repo that uses the service role to write to public tables **fails locally** with `permission denied for table <X>`. Production hosted Supabase grants `service_role` the full CRUD on public tables automatically, so production is unaffected. The repo's own ops doc `Docs/operations/organizer-email-invitations.md` §8.4 verified invite-organizer against the real hosted Supabase (or via `admin/generate_link` as a local bypass), never against the local stack's service-role path. **Not a Phase 2 bug** — affects every function in the repo locally. Local-only fix for verifying any service-role function:

   ```sql
   -- One-time, per function's target table (example for founder_access_requests):
   grant select, insert on public.founder_access_requests to service_role;
   ```

   Production does not need this.
2. **Migration timestamp collision** (`20260830000000` two-file collision) — pre-existing, documented in `Docs/operations/phase1-auth-email-foundation.md` §7. Unrelated to Phase 2. Renaming one of the two files to `20260830000001_phase6_host_organizer_access.sql` is the recommended fix; out of scope for this phase.
3. **Deno test execution** — the Edge Function's Deno test files (`supabase/functions/_shared/founderRequest.test.ts` and `supabase/functions/request-founder-access/index.test.ts`) cannot be executed in this environment (no `deno` binary). This is a pre-existing repo-wide limitation that also affects `invitation.test.ts`, `invite-organizer/index.test.ts`, and `send-auth-email/index.test.ts`. The tests follow the same convention as those files; live verification against the local stack covered the same scenarios end-to-end.

## 9. No Phase 1 / Host Dashboard impact

- The Phase 1 auth callback architecture, safe-redirect helper, and the `authIntent` hint module are untouched.
- The Founder request flow is the sole new public write path; no Phase 1 surface was modified beyond adding the `requestPasswordReset` mock field in six test files (mechanical, required by the new AuthContext type).
- No Host Dashboard code was modified by Phase 2.

## 10. Production readiness for Phase 3

Phase 3 needs to retrieve and act on `founder_access_requests`:
- **List pending requests** (admin/moderator read): `select * from public.founder_access_requests where status='pending' order by created_at;` — covered by the `founder_access_requests_status_created_idx` index.
- **Approve**: `update public.founder_access_requests set status='approved', reviewed_by = auth.uid(), reviewed_at = now() where id = $1;` — `Admins manage founder requests` policy allows it; audit trigger fires `founder_request.approved`.
- **Reject**: same with `status='rejected'` and `rejection_reason_code`/`rejection_message` — the `rejection_reason_code` CHECK constraint is already in place.
- After a request is approved or rejected, the partial unique index frees up — a new pending request from the same email is then permitted (intentional: the user can re-apply after a rejection).
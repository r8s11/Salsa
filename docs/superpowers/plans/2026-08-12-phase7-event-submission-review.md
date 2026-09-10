# Phase 7 — Event Submission Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin/submissions` queue and `/admin/submissions/:id` review workspace on a new `event_submissions` table, per `Docs/plans/phase7-event-submission-review.md` (the approved design doc — read it first, it is the spec of record), including the required two-table-split ripple into the submitter-facing surfaces.

**Architecture:** A dedicated `public.event_submissions` table (immutable `submitted_data` jsonb + `edited_data` jsonb overlay) replaces `events.status='pending'`/`'rejected'` as the moderation staging area. `/admin/submissions` and `/admin/submissions/:id` operate exclusively on it. Approval reads the effective data and **inserts** a new `events` row; the submission row survives permanently with `approved_event_id` pointing at it. Review history reuses `audit_logs` with `entity_type='event_submission'`. `admin_user_directory()` is extended to union submission counts. Submitter-facing surfaces (`ProfilePage`, `UserEventEditPage`, `submitEvent`, `useMySubmissions`) are rewired to read/write `event_submissions` for pending/rejected/withdrawn and `events` only for approved.

**Tech Stack:** React 19 + TypeScript + Vite, React Router v7 classic `<Routes>`, Supabase (Postgres + RLS), TanStack Query v5, Vitest + React Testing Library, `temporal-polyfill`.

**Note on plan size:** This is a large, multi-phase plan (33 tasks) split across this file (Tasks 1–25: database, data layer, model logic, submitter-facing ripple, shared review-panel components) and a continuation file `docs/superpowers/plans/2026-08-12-phase7-event-submission-review-part2.md` (Tasks 26–33: queue page, review page, routing/shell, final verification). Execute both files in order; the continuation file's header is intentionally minimal since it shares this file's Global Constraints and File Structure sections.

## Global Constraints

- TDD: write the failing test before the implementation for every data/model function and every new component's observable behavior; existing project convention per memory.
- `npm run lint -- --max-warnings 0` and `npx tsc --noEmit` MUST be clean before any task is considered done.
- Zero hardcoded hex colors — every new color goes through existing `--admin-*` tokens (`src/styles/admin.css`).
- Migration files: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`, ending with a `revoke ... from public; grant ... to authenticated;` block and `notify pgrst, 'reload schema';` whenever the PostgREST-visible schema changes. Set-returning functions changing their column list MUST use `drop function if exists ...; create function ...;`, never `create or replace function`.
- `supabase/reconcile-prod-schema-phase7.sql` MUST be idempotent (`create or replace` / `if not exists` — except the `admin_user_directory()` extension, which needs `drop function if exists` + `create function` exactly like the migration, per the drift already found in `reconcile-prod-schema-phase5.sql`).
- Every new admin dialog follows the established wiring convention: `isBusy`/`error` derived by comparing a hook-tracked in-flight/error id against the current row's id (never a blanket boolean); `onConfirm` runs the mutation with `{ onSuccess: closeDialog }`; `onCancel` is always `closeDialog`; focus moves to the dialog's primary control on mount and restores the previously focused element on unmount (`AdminConfirmDialog`/`AdminFlagUserDialog` pattern — NOT the filter-drawer's tab-cycling pattern).
- Every status/tier/duplicate-risk indicator pairs color with text/icon — never color-only (WCAG AA, three-signal rule already used by `AdminStatusBadge`).
- No shims, dual-write paths, or "legacy" branches for the `pending`-in-`events` behavior once cut over — clean migration per the design doc's hard-migration decision.
- Reuse existing components/helpers verbatim wherever the design doc says to (`AdminPageHeader`, `AdminViewTabs`, `AdminPagination`, `AdminActionMenu`, `AdminConfirmDialog`, `AdminToast`, `AdminUserAvatar`, `AdminRoleBadge`, `AdminEventForm`, `displayNameFor`, `identityLineFor`, `auditLogLabelFor`, `actorLabelFor`, `useUserAuditLog`'s pattern). Do not fork a second implementation of anything already generic.
- Commit after every task with a `feat:`/`fix:` message naming the task.

---

## File Structure

**New files:**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260817000000_event_submissions.sql` | `event_submissions` table, indexes, `is_moderator()`, RLS, audit trigger, `admin_user_directory()` re-derivation |
| `supabase/reconcile-prod-schema-phase7.sql` | Idempotent mirror of the migration for hand-run prod reconciliation |
| `src/features/submissions/model/types.ts` | `SubmissionRow`, `SubmittedEventData`, `SubmissionStatus`, `RejectionReason` TS types |
| `src/features/submissions/api/submissionsRepo.ts` | All Supabase I/O for `event_submissions` |
| `src/features/submissions/model/quality.ts` | Required/Recommended/Optional quality tiering for submissions |
| `src/features/submissions/model/duplicates.ts` | `DuplicateSignal`/`DuplicateCandidate`/`findDuplicateCandidates` |
| `src/features/submissions/model/venueMatching.ts` | Exact/fuzzy venue match against canonical `events.location` |
| `src/features/submissions/model/submissionsQuery.ts` | Views, filters, predicates, sort — mirrors `eventsQuery.ts` |
| `src/features/submissions/model/submissionForm.ts` | Effective-data resolution + `buildAdminFormFromSubmission` |
| `src/features/admin/api/submissionAuditLogRepo.ts` | `fetchSubmissionAuditLog(submissionId)` |
| `src/hooks/useAdminSubmissions.ts` | TanStack Query hook: list, approve, reject, edit, reopen, dismiss-duplicate, use-existing-venue mutations |
| `src/hooks/useSubmissionAuditLog.ts` | TanStack Query hook wrapping `fetchSubmissionAuditLog` |
| `src/pages/AdminSubmissionsPage.tsx` | `/admin/submissions` queue |
| `src/pages/AdminSubmissionDetailPage.tsx` | `/admin/submissions/:id` review workspace |
| `src/components/Admin/AdminSubmissionStatusBadge.tsx` | Status pill for submission statuses |
| `src/components/Admin/AdminSubmissionsTable.tsx` | Queue table + mobile card list |
| `src/components/Admin/AdminSubmissionsFilterDrawer.tsx` | "More filters" drawer for the queue |
| `src/components/Admin/AdminSubmitterPanel.tsx` | Registered vs magic-link submitter presentation |
| `src/components/Admin/AdminSubmissionQualityPanel.tsx` | Tiered quality checklist for the review panel |
| `src/components/Admin/AdminEditedFieldDisclosure.tsx` | Original/Updated whole-value disclosure |
| `src/components/Admin/AdminDuplicateCheckPanel.tsx` | Duplicate Check review-panel section |
| `src/components/Admin/AdminVenueMatchPanel.tsx` | Venue normalization section (Event Information column) |
| `src/components/Admin/AdminRejectSubmissionDialog.tsx` | Reject dialog (reason select + two separate textareas) |

**Modified files:**

| File | Change |
|---|---|
| `src/features/admin/model/auditLog.ts` | Add `submission.*` cases to `auditLogLabelFor` |
| `src/features/admin/model/usersQuery.ts` | `AdminUserRow.approved_count: number` |
| `src/components/Admin/AdminQualityBadge.tsx` | Widen `issues`/label lookup to accept any string-keyed issue list (additive, events call site unaffected) |
| `src/features/events/api/eventsRepo.ts` | Remove `submitEvent`, `withdrawSubmission`, `updateEventForUser`, `fetchMySubmissions`; add `fetchMyApprovedEvents` (superseded by `submissionsRepo.ts` + `events`-only approved fetch) |
| `src/features/submit-event/useSubmitEventForm.ts` | Insert into `event_submissions` via `submissionsRepo.createSubmission`; fix the `dance_styles: null` bug |
| `src/hooks/useMySubmissions.ts` | Fan out: `event_submissions` (pending/rejected/withdrawn) ∪ `events` (approved, by `submitter_id`) |
| `src/pages/ProfilePage.tsx` | Adapt to the unified submission-or-event row shape |
| `src/pages/UserEventEditPage.tsx` | Edit `event_submissions.submitted_data` via `submissionsRepo.updateOwnSubmission`; withdraw via `submissionsRepo.withdrawOwnSubmission` |
| `src/App.tsx` | New lazy imports + routes for `submissions`/`submissions/:id`; `/admin` guard widened to admin-or-moderator |
| `src/components/Admin/AdminSidebar.tsx` | Flip Event Submissions to `built: true, to: "/admin/submissions"` |
| `src/layouts/AdminLayout.tsx` | `SECTION_LABEL["/admin/submissions"]` + `startsWith("/admin/submissions/")` branch |
| `src/layouts/AdminLayout.test.tsx` | Remove `"Event Submissions"` from the disabled-items assertion array; add a built-link assertion |
| `src/contexts/authContextObject.ts` | Add `isModerator: boolean` to `AuthContextValue` |
| `src/contexts/AuthContext.tsx` | Compute `isModerator` from `app_metadata.role === "moderator"` |
| `src/features/admin/model/overviewMetrics.ts` | `deriveOverviewMetrics`'s `pendingCount` now takes a `pendingSubmissionCount: number` parameter instead of deriving from `events` |
| `src/pages/AdminOverviewPage.tsx` | Pass submission-derived pending count into `deriveOverviewMetrics` |

---

## Task 1: `event_submissions` migration — table, indexes, RLS, `is_moderator()`, audit trigger

**Files:**
- Create: `supabase/migrations/20260817000000_event_submissions.sql`
- Test: manual `supabase db reset` against local Supabase (no automated SQL test harness exists in this repo — verified by scout, no `supabase/tests/` directory)

**Interfaces:**
- Produces: table `public.event_submissions` (columns below), function `public.is_moderator() returns boolean`, trigger `event_submissions_audit_log`, RLS policies.

- [ ] **Step 1: Write the migration**

```sql
-- Phase 7: event_submissions table, is_moderator(), RLS, audit trigger.
-- Hard-migrates the 2 existing pending events.status='pending' rows into
-- event_submissions and deletes them from events (per the approved design
-- doc's architecture decision — no dual-path/legacy pending-in-events
-- support survives this migration).

create table public.event_submissions (
  id                      uuid primary key default gen_random_uuid(),
  submitter_id            uuid null references auth.users(id),
  submitter_email         text null,
  submitter_name          text null,
  status                  text not null default 'pending'
                            check (status in ('pending','in_review','needs_information',
                                              'approved','rejected','withdrawn')),
  submitted_data          jsonb not null,
  edited_data             jsonb null,
  submitted_at            timestamptz not null default now(),
  reviewed_by             uuid null references auth.users(id),
  reviewed_at             timestamptz null,
  rejection_reason        text null check (rejection_reason in
                            ('duplicate','missing_information','invalid_venue',
                             'cannot_verify','spam','inappropriate','out_of_scope','other')),
  rejection_message       text null,
  internal_note           text null,
  duplicate_of_event_id   uuid null references public.events(id) on delete set null,
  dismissed_duplicate_ids uuid[] not null default '{}',
  approved_event_id       uuid null references public.events(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index event_submissions_status_idx on public.event_submissions (status);
create index event_submissions_status_submitted_at_idx
  on public.event_submissions (status, submitted_at desc);
create index event_submissions_submitter_id_idx on public.event_submissions (submitter_id);

create trigger event_submissions_set_updated_at
  before update on public.event_submissions
  for each row execute function public.set_updated_at();

-- Moderator role finally means something: every event_submissions RLS
-- policy checks this instead of the admin-only literal used elsewhere.
create function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'moderator');
$$;

alter table public.event_submissions enable row level security;

create policy "Submitters read own submissions"
  on public.event_submissions
  for select
  to authenticated
  using (submitter_id = auth.uid());

create policy "Anyone can submit"
  on public.event_submissions
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and submitter_id is not distinct from auth.uid()
  );

create policy "Submitters update own pending or rejected submission"
  on public.event_submissions
  for update
  to authenticated
  using (
    submitter_id = auth.uid()
    and status in ('pending', 'rejected')
  )
  with check (
    submitter_id = auth.uid()
    and status in ('pending', 'rejected', 'withdrawn')
  );

create policy "Moderators and admins read all submissions"
  on public.event_submissions
  for select
  to authenticated
  using (public.is_moderator());

create policy "Moderators and admins update all submissions"
  on public.event_submissions
  for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- No delete policy at all — submissions are never destroyed.

create function public.log_submission_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'submission.created';
  elsif old.status is distinct from new.status then
    v_action := case new.status
      when 'approved' then 'submission.approved'
      when 'rejected' then 'submission.rejected'
      when 'pending' then case when old.status = 'rejected' then 'submission.reopened' else 'submission.review_started' end
      when 'withdrawn' then 'submission.withdrawn'
      else 'submission.status_changed'
    end;
  elsif old.edited_data is distinct from new.edited_data then
    v_action := 'submission.edited';
  elsif old.dismissed_duplicate_ids is distinct from new.dismissed_duplicate_ids then
    v_action := 'submission.marked_duplicate';
  else
    v_action := 'submission.updated';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    v_action,
    'event_submission',
    new.id,
    jsonb_build_object(
      'from_status', case when tg_op = 'INSERT' then null else old.status end,
      'to_status', new.status,
      'reason', new.rejection_reason
    )
  );

  return new;
end;
$$;

create trigger event_submissions_audit_log
  after insert or update on public.event_submissions
  for each row execute function public.log_submission_change();

-- Hard migration: move the existing pending rows out of events.
insert into public.event_submissions (
  submitter_id, submitter_email, submitter_name, status, submitted_data, submitted_at
)
select
  e.submitter_id,
  e.submitter_email,
  e.submitter_name,
  'pending',
  to_jsonb(e) - 'id' - 'status' - 'source_type' - 'updated_at' - 'created_at' - 'cancellation_reason',
  e.created_at
from public.events e
where e.status = 'pending';

delete from public.events where status = 'pending';

revoke execute on function public.is_moderator() from public;
grant  execute on function public.is_moderator() to authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Run the migration locally**

Run: `npx supabase db reset` (from repo root, requires local Supabase running — start with `npx supabase start` first if not already).
Expected: migration applies cleanly, no errors; `select count(*) from public.event_submissions where status = 'pending';` returns `2` (the migrated rows); `select count(*) from public.events where status = 'pending';` returns `0`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260817000000_event_submissions.sql
git commit -m "feat: add event_submissions table, is_moderator(), RLS, audit trigger"
```

---

## Task 2: Extend `admin_user_directory()` with `approved_count` and submission-derived counts

**Files:**
- Modify (append to the same migration file from Task 1, before the final `notify`): `supabase/migrations/20260817000000_event_submissions.sql`

**Interfaces:**
- Produces: `admin_user_directory()` returning 16 columns (adds `approved_count integer`), `contributions`/`pending_count` now union `event_submissions`.

- [ ] **Step 1: Add the function replacement to the migration, before `notify pgrst, 'reload schema';`**

```sql
drop function if exists public.admin_user_directory();

create function public.admin_user_directory()
returns table (
  kind                text,
  id                  text,
  user_id             uuid,
  email               text,
  display_name        text,
  username            text,
  avatar_url          text,
  role                text,
  status              text,
  status_reason       text,
  created_at          timestamptz,
  last_active_at      timestamptz,
  contributions       integer,
  pending_count       integer,
  approved_count      integer,
  email_confirmed_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  with submission_stats as (
    select s.submitter_id                                          as uid,
           count(*)::int                                           as total,
           count(*) filter (where s.status = 'pending')::int        as pending,
           max(s.submitted_at)                                      as last_event_at
      from public.event_submissions s
     where s.submitter_id is not null
     group by s.submitter_id
  ),
  event_stats as (
    select e.submitter_id                                          as uid,
           count(*)::int                                           as total,
           count(*) filter (where e.status = 'approved')::int       as approved,
           max(e.created_at)                                        as last_event_at
      from public.events e
     where e.submitter_id is not null
     group by e.submitter_id
  ),
  guest_submission_stats as (
    select lower(btrim(s.submitter_email))                                       as email,
           min(coalesce(nullif(btrim(s.submitter_name), ''), 'Guest Submitter'))  as name,
           count(*)::int                                                         as total,
           count(*) filter (where s.status = 'pending')::int                      as pending,
           max(s.submitted_at)                                                    as last_event_at,
           min(s.submitted_at)                                                    as first_event_at
      from public.event_submissions s
     where s.submitter_id is null
       and btrim(coalesce(s.submitter_email, '')) <> ''
     group by lower(btrim(s.submitter_email))
  ),
  guest_event_stats as (
    select lower(btrim(e.submitter_email))                     as email,
           count(*)::int                                       as total,
           count(*) filter (where e.status = 'approved')::int   as approved,
           max(e.created_at)                                    as last_event_at,
           min(e.created_at)                                    as first_event_at
      from public.events e
     where e.submitter_id is null
       and e.source_type = 'user_submission'
       and btrim(coalesce(e.submitter_email, '')) <> ''
     group by lower(btrim(e.submitter_email))
  ),
  guest_emails as (
    select email, min(first_event_at) as first_event_at, max(last_event_at) as last_event_at,
           max(name) as name
      from (
        select email, first_event_at, last_event_at, name from guest_submission_stats
        union all
        select email, first_event_at, last_event_at, null as name from guest_event_stats
      ) u
     group by email
  )
  select 'profile'::text, p.id::text, p.id, u.email::text,
         p.display_name, p.username, p.avatar_url,
         p.role, p.status, p.status_reason, p.created_at,
         greatest(coalesce(u.last_sign_in_at, p.created_at),
                  coalesce(ss.last_event_at, p.created_at),
                  coalesce(es.last_event_at, p.created_at)),
         coalesce(ss.total, 0) + coalesce(es.total, 0),
         coalesce(ss.pending, 0),
         coalesce(es.approved, 0),
         u.email_confirmed_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join submission_stats ss on ss.uid = p.id
    left join event_stats es on es.uid = p.id
  union all
  select 'guest'::text, 'guest:' || g.email, null::uuid, g.email,
         coalesce(g.name, 'Guest Submitter'), null::text, null::text,
         null::text, 'active', null::text, g.first_event_at,
         g.last_event_at,
         coalesce(gs.total, 0) + coalesce(ge.total, 0),
         coalesce(gs.pending, 0),
         coalesce(ge.approved, 0),
         null::timestamptz
    from guest_emails g
    left join guest_submission_stats gs on gs.email = g.email
    left join guest_event_stats ge on ge.email = g.email
   where not exists (select 1 from auth.users u2 where lower(u2.email) = g.email);
end;
$$;

revoke execute on function public.admin_user_directory() from public;
grant  execute on function public.admin_user_directory() to authenticated;
```

- [ ] **Step 2: Update the TS return type**

In `src/features/admin/model/usersQuery.ts`, add `approved_count: number;` to the `AdminUserRow` interface, immediately after `pending_count: number;`.

- [ ] **Step 3: Run local migration and verify**

Run: `npx supabase db reset`
Expected: no errors; `select approved_count from admin_user_directory() limit 1;` (via `psql` or Supabase Studio) returns a row with an integer, not an error.

Run: `npx tsc --noEmit`
Expected: no new errors (no call site destructures a fixed-length tuple from `AdminUserRow`, so an additive field is safe).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260817000000_event_submissions.sql src/features/admin/model/usersQuery.ts
git commit -m "feat: extend admin_user_directory with approved_count and submission-derived counts"
```

---

## Task 3: `supabase/reconcile-prod-schema-phase7.sql`

**Files:**
- Create: `supabase/reconcile-prod-schema-phase7.sql`

**Interfaces:**
- Consumes: nothing (standalone hand-run script).
- Produces: idempotent mirror of Task 1 + Task 2's schema changes, safe to run against a production database that already has Phase 6 applied.

- [ ] **Step 1: Write the file**

Copy the full body of `20260817000000_event_submissions.sql` (Tasks 1–2 combined) verbatim, with two changes: (a) wrap the `create table`/`create index`/`create policy`/`create trigger` statements in `if not exists` / `drop policy if exists ... ; create policy ...` guards per the project's established idempotent-script convention (mirror the structure of `supabase/reconcile-prod-schema-phase5.sql`'s guarding style — read that file's header comment block first for the exact idiom used), and (b) **omit the hard-migration `insert ... delete from events` block** — reconciliation scripts apply schema only, never data migrations (the data migration already ran via the numbered migration in any environment this script targets). Use `drop function if exists public.admin_user_directory();` + `create function` (not `create or replace`) for the directory function, exactly as Task 2, to avoid repeating the exact drift bug documented in `reconcile-prod-schema-phase5.sql`.

- [ ] **Step 2: Commit**

```bash
git add supabase/reconcile-prod-schema-phase7.sql
git commit -m "feat: add idempotent reconcile script for Phase 7 schema"
```

---

## Task 4: Submission TS types

**Files:**
- Create: `src/features/submissions/model/types.ts`
- Test: `src/features/submissions/model/types.test.ts`

**Interfaces:**
- Produces: `SubmissionStatus`, `RejectionReason`, `SubmittedEventData`, `SubmissionRow`, `REJECTION_REASON_LABEL` — consumed by every other Task in Phases 2–6.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { REJECTION_REASON_LABEL } from "./types";

describe("REJECTION_REASON_LABEL", () => {
  it("has a label for every rejection reason", () => {
    const reasons = [
      "duplicate", "missing_information", "invalid_venue", "cannot_verify",
      "spam", "inappropriate", "out_of_scope", "other",
    ] as const;
    for (const reason of reasons) {
      expect(REJECTION_REASON_LABEL[reason]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/submissions/model/types.test.ts`
Expected: FAIL — `./types` has no export `REJECTION_REASON_LABEL`.

- [ ] **Step 3: Write the implementation**

```ts
import type { City, EventType } from "../../events/model/types";

export type SubmissionStatus =
  | "pending" | "in_review" | "needs_information"
  | "approved" | "rejected" | "withdrawn";

export type RejectionReason =
  | "duplicate" | "missing_information" | "invalid_venue" | "cannot_verify"
  | "spam" | "inappropriate" | "out_of_scope" | "other";

export const REJECTION_REASON_LABEL: Record<RejectionReason, string> = {
  duplicate: "Duplicate Event",
  missing_information: "Missing Information",
  invalid_venue: "Invalid Venue",
  cannot_verify: "Cannot Verify Event",
  spam: "Spam",
  inappropriate: "Inappropriate Content",
  out_of_scope: "Outside Platform Scope",
  other: "Other",
};

// Mirrors DatabaseEvent minus the submission-table-owned columns
// (id, status, source_type, updated_at, created_at, cancellation_reason) —
// this is exactly what event_submissions.submitted_data/edited_data holds.
export interface SubmittedEventData {
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string;
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: "free" | "paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  image_url: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_id: string | null;
  dance_styles: string[] | null;
  city: City;
  host: string | null;
  recurrence: string | null;
  gallery: string[] | null;
  contact_email: string | null;
  contact_instagram: string | null;
  contact_website: string | null;
}

export interface SubmissionRow {
  id: string;
  submitter_id: string | null;
  submitter_email: string | null;
  submitter_name: string | null;
  status: SubmissionStatus;
  submitted_data: SubmittedEventData;
  edited_data: Partial<SubmittedEventData> | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: RejectionReason | null;
  rejection_message: string | null;
  internal_note: string | null;
  duplicate_of_event_id: string | null;
  dismissed_duplicate_ids: string[];
  approved_event_id: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/submissions/model/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/submissions/model/types.ts src/features/submissions/model/types.test.ts
git commit -m "feat: add event_submissions TS types"
```

---

## Task 5: `submissionForm.ts` — effective-data resolution

**Files:**
- Create: `src/features/submissions/model/submissionForm.ts`
- Test: `src/features/submissions/model/submissionForm.test.ts`

**Interfaces:**
- Consumes: `SubmissionRow`, `SubmittedEventData` (Task 4).
- Produces: `effectiveData(submission: SubmissionRow): SubmittedEventData`, `editedFields(submission: SubmissionRow): (keyof SubmittedEventData)[]`, `buildAdminFormFromSubmission(data: SubmittedEventData): AdminEventForm` — consumed by Tasks 6–9, 15–20, 28.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { effectiveData, editedFields, buildAdminFormFromSubmission } from "./submissionForm";
import type { SubmissionRow, SubmittedEventData } from "./types";

const baseData: SubmittedEventData = {
  title: "Havanna club social", description: null, event_type: "social",
  event_date: "2026-08-24", event_time: "18:00:00", location: "Havanna club",
  address: null, price_type: null, price_amount: null, rsvp_link: null,
  image_url: null, submitter_name: null, submitter_email: "guest@example.com",
  submitter_id: null, dance_styles: null, city: "boston", host: null,
  recurrence: null, gallery: null, contact_email: null, contact_instagram: null,
  contact_website: null,
};

function submission(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
  return {
    id: "sub-1", submitter_id: null, submitter_email: "guest@example.com",
    submitter_name: null, status: "pending", submitted_data: baseData,
    edited_data: null, submitted_at: "2026-08-12T00:00:00Z", reviewed_by: null,
    reviewed_at: null, rejection_reason: null, rejection_message: null,
    internal_note: null, duplicate_of_event_id: null, dismissed_duplicate_ids: [],
    approved_event_id: null, created_at: "2026-08-12T00:00:00Z",
    updated_at: "2026-08-12T00:00:00Z", ...overrides,
  };
}

describe("effectiveData", () => {
  it("returns submitted_data unchanged when edited_data is null", () => {
    expect(effectiveData(submission())).toEqual(baseData);
  });

  it("overlays edited_data field by field, leaving unedited fields as submitted", () => {
    const result = effectiveData(submission({ edited_data: { location: "Havana Club" } }));
    expect(result.location).toBe("Havana Club");
    expect(result.title).toBe(baseData.title);
  });
});

describe("editedFields", () => {
  it("returns an empty list when nothing was edited", () => {
    expect(editedFields(submission())).toEqual([]);
  });

  it("lists only the keys present in edited_data", () => {
    const result = editedFields(submission({ edited_data: { location: "Havana Club", title: "Bachata" } }));
    expect(result.sort()).toEqual(["location", "title"]);
  });
});

describe("buildAdminFormFromSubmission", () => {
  it("maps dance_styles null to an empty array, mirroring buildAdminFormFromEvent's defensive pattern", () => {
    const form = buildAdminFormFromSubmission({ ...baseData, dance_styles: null });
    expect(form.dance_styles).toEqual([]);
  });

  it("maps price_amount to a stringified value like buildAdminFormFromEvent", () => {
    const form = buildAdminFormFromSubmission({ ...baseData, price_amount: 10 });
    expect(form.price_amount).toBe("10");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/submissions/model/submissionForm.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
import type { SubmissionRow, SubmittedEventData } from "./types";
import type { AdminEventForm } from "../../admin/model/adminEventForm";
import { fromEventDateInstant } from "../../events/model/eventDateTime";

export function effectiveData(submission: SubmissionRow): SubmittedEventData {
  if (!submission.edited_data) return submission.submitted_data;
  return { ...submission.submitted_data, ...submission.edited_data };
}

export function editedFields(submission: SubmissionRow): (keyof SubmittedEventData)[] {
  if (!submission.edited_data) return [];
  return Object.keys(submission.edited_data) as (keyof SubmittedEventData)[];
}

// Mirrors buildAdminFormFromEvent's null-coalescing conventions exactly
// (../../admin/model/adminEventForm.ts) — same defensive `dance_styles ?? []`
// pattern, since submitted_data can carry the pre-existing NULL-vs-[] bug
// from useSubmitEventForm.ts.
export function buildAdminFormFromSubmission(data: SubmittedEventData): AdminEventForm {
  const { date, time } = fromEventDateInstant(data.event_date);
  return {
    title: data.title,
    description: data.description ?? "",
    event_type: data.event_type,
    city: data.city,
    event_date: date,
    event_time: time,
    location: data.location ?? "",
    address: data.address ?? "",
    price_type: data.price_type ?? "",
    price_amount: data.price_amount != null ? String(data.price_amount) : "",
    rsvp_link: data.rsvp_link ?? "",
    submitter_name: data.submitter_name ?? "",
    submitter_email: data.submitter_email ?? "",
    recurrence: data.recurrence === "weekly" ? "weekly" : "",
    host: data.host ?? "",
    image_url: data.image_url ?? "",
    contact_email: data.contact_email ?? "",
    contact_instagram: data.contact_instagram ?? "",
    contact_website: data.contact_website ?? "",
    dance_styles: data.dance_styles ?? [],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/submissions/model/submissionForm.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/submissions/model/submissionForm.ts src/features/submissions/model/submissionForm.test.ts
git commit -m "feat: add submission effective-data resolution and admin-form mapping"
```

---

## Task 6: `quality.ts` — tiered quality model

**Files:**
- Create: `src/features/submissions/model/quality.ts`
- Test: `src/features/submissions/model/quality.test.ts`

**Interfaces:**
- Consumes: `SubmittedEventData` (Task 4).
- Produces: `QualityTier`, `SubmissionQualityIssue`, `QUALITY_TIER`, `SUBMISSION_QUALITY_LABEL`, `submissionQualityIssues(data): SubmissionQualityIssue[]`, `hasRequiredGap(issues): boolean` — consumed by Tasks 9, 15, 16, 24, 28.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { submissionQualityIssues, hasRequiredGap, QUALITY_TIER } from "./quality";
import type { SubmittedEventData } from "./types";

const complete: SubmittedEventData = {
  title: "Salsa Mondays", description: "A weekly social.", event_type: "social",
  event_date: "2026-08-24", event_time: "18:00:00", location: "Havana Club",
  address: "288 Green St", price_type: "free", price_amount: null,
  rsvp_link: null, image_url: "https://x.test/f.jpg", submitter_name: "Maria",
  submitter_email: "maria@example.com", submitter_id: "user-1",
  dance_styles: ["salsa"], city: "boston", host: "Maria Santos",
  recurrence: null, gallery: null, contact_email: null,
  contact_instagram: null, contact_website: null,
};

describe("submissionQualityIssues", () => {
  it("returns no issues for a fully complete submission", () => {
    expect(submissionQualityIssues(complete)).toEqual([]);
  });

  it("flags missing title, event_date, city, event_type as required-tier", () => {
    const issues = submissionQualityIssues({ ...complete, title: "" });
    expect(issues).toContain("title");
    expect(QUALITY_TIER.title).toBe("required");
  });

  it("flags missing location, event_time, description as recommended-tier, never blocking", () => {
    const issues = submissionQualityIssues({ ...complete, location: null });
    expect(issues).toContain("location");
    expect(QUALITY_TIER.location).toBe("recommended");
  });

  it("flags missing image_url, host, price_type, dance_styles as optional-tier", () => {
    const issues = submissionQualityIssues({ ...complete, host: null });
    expect(issues).toContain("host");
    expect(QUALITY_TIER.host).toBe("optional");
  });

  it("treats a null dance_styles the same as an empty array (the known submit-form bug)", () => {
    const issues = submissionQualityIssues({ ...complete, dance_styles: null });
    expect(issues).toContain("dance_styles");
  });
});

describe("hasRequiredGap", () => {
  it("is true only when a required-tier issue is present", () => {
    expect(hasRequiredGap(["location"])).toBe(false);
    expect(hasRequiredGap(["title"])).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/submissions/model/quality.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
import type { SubmittedEventData } from "./types";

export type QualityTier = "required" | "recommended" | "optional";

export type SubmissionQualityIssue =
  | "title" | "event_date" | "city" | "event_type"
  | "location" | "event_time" | "description"
  | "image_url" | "host" | "price_type" | "dance_styles";

export const QUALITY_TIER: Record<SubmissionQualityIssue, QualityTier> = {
  title: "required", event_date: "required", city: "required", event_type: "required",
  location: "recommended", event_time: "recommended", description: "recommended",
  image_url: "optional", host: "optional", price_type: "optional", dance_styles: "optional",
};

export const SUBMISSION_QUALITY_LABEL: Record<SubmissionQualityIssue, string> = {
  title: "Event name", event_date: "Date & time", city: "City", event_type: "Event type",
  location: "Venue not matched", event_time: "Start time", description: "Description",
  image_url: "Flyer", host: "Organizer", price_type: "Pricing", dance_styles: "Dance style",
};

// Fixed, deterministic order: required tier first, then recommended, then
// optional — matches the review panel's top-to-bottom rendering order.
const CHECK_ORDER: SubmissionQualityIssue[] = [
  "title", "event_date", "city", "event_type",
  "location", "event_time", "description",
  "image_url", "host", "price_type", "dance_styles",
];

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim() === "";
}

export function submissionQualityIssues(data: SubmittedEventData): SubmissionQualityIssue[] {
  const issues: SubmissionQualityIssue[] = [];
  if (isBlank(data.title)) issues.push("title");
  if (isBlank(data.event_date)) issues.push("event_date");
  if (isBlank(data.city)) issues.push("city");
  if (isBlank(data.event_type)) issues.push("event_type");
  if (isBlank(data.location)) issues.push("location");
  if (isBlank(data.event_time)) issues.push("event_time");
  if (isBlank(data.description)) issues.push("description");
  if (isBlank(data.image_url)) issues.push("image_url");
  if (isBlank(data.host)) issues.push("host");
  if (!data.price_type) issues.push("price_type");
  if (!data.dance_styles || data.dance_styles.length === 0) issues.push("dance_styles");
  return CHECK_ORDER.filter((issue) => issues.includes(issue));
}

export function hasRequiredGap(issues: SubmissionQualityIssue[]): boolean {
  return issues.some((issue) => QUALITY_TIER[issue] === "required");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/submissions/model/quality.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/submissions/model/quality.ts src/features/submissions/model/quality.test.ts
git commit -m "feat: add tiered quality model for submissions"
```

---

## Task 7: `duplicates.ts` — per-signal duplicate detection

**Files:**
- Create: `src/features/submissions/model/duplicates.ts`
- Test: `src/features/submissions/model/duplicates.test.ts`

**Interfaces:**
- Consumes: `DatabaseEvent` (`src/features/events/model/types.ts`), `SubmittedEventData` (Task 4). Uses `temporal-polyfill/global` side-effect import, matching `eventsQuery.ts`'s established pattern.
- Produces: `DuplicateSignal`, `DuplicateCandidate`, `findDuplicateCandidates(data, canonicalEvents, otherPendingSubmissions): DuplicateCandidate[]` — consumed by Tasks 9, 19, 28.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { findDuplicateCandidates } from "./duplicates";
import type { SubmittedEventData } from "./types";
import type { DatabaseEvent } from "../../events/model/types";

const submitted: SubmittedEventData = {
  title: "Salsa Sundays at Havana Club", description: null, event_type: "social",
  event_date: "2026-08-23", event_time: "19:00:00", location: "Havana Club",
  address: null, price_type: null, price_amount: null, rsvp_link: null,
  image_url: null, submitter_name: null, submitter_email: null,
  submitter_id: null, dance_styles: null, city: "boston", host: "Maria",
  recurrence: null, gallery: null, contact_email: null,
  contact_instagram: null, contact_website: null,
};

function event(overrides: Partial<DatabaseEvent> = {}): DatabaseEvent {
  return {
    id: "evt-1", title: "Salsa Sundays at Havana Club", description: null,
    event_type: "social", event_date: "2026-08-23T19:00:00Z", event_time: "19:00:00",
    location: "Havana Club", address: null, price_type: null, price_amount: null,
    rsvp_link: null, image_url: null, submitter_name: null, submitter_email: null,
    submitter_id: null, status: "approved", source_type: "user_submission",
    dance_styles: null, updated_at: "2026-08-01T00:00:00Z", cancellation_reason: null,
    city: "boston", created_at: "2026-08-01T00:00:00Z", host: "Maria", recurrence: null,
    gallery: null, contact_email: null, contact_instagram: null, contact_website: null,
    ...overrides,
  };
}

describe("findDuplicateCandidates", () => {
  it("returns high confidence when venue and date both match", () => {
    const [candidate] = findDuplicateCandidates(submitted, [event()], []);
    expect(candidate.confidence).toBe("high");
    expect(candidate.signals).toEqual(expect.arrayContaining(["same-venue", "same-date"]));
  });

  it("returns medium confidence for exactly two signals without venue+date both matching", () => {
    const [candidate] = findDuplicateCandidates(submitted, [event({ event_date: "2026-09-01T19:00:00Z", host: "Maria" })], []);
    expect(candidate.confidence).toBe("medium");
  });

  it("suppresses a candidate with only one signal", () => {
    const candidates = findDuplicateCandidates(
      submitted,
      [event({ event_date: "2026-09-01T19:00:00Z", location: "Other Venue", host: "Someone Else" })],
      []
    );
    expect(candidates).toHaveLength(0);
  });

  it("never auto-matches when both venue and title are empty", () => {
    const candidates = findDuplicateCandidates(
      { ...submitted, location: null, host: null },
      [event({ location: null, host: null })],
      []
    );
    expect(candidates.every((c) => !c.signals.includes("same-venue"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/submissions/model/duplicates.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
import "temporal-polyfill/global";
import type { SubmittedEventData } from "./types";
import type { DatabaseEvent } from "../../events/model/types";

export type DuplicateSignal = "same-venue" | "same-date" | "similar-title" | "same-organizer";

export interface DuplicateCandidate {
  event: DatabaseEvent;
  signals: DuplicateSignal[];
  confidence: "high" | "medium";
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function jaccard(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter(Boolean));
  const wordsB = new Set(b.split(" ").filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

function dayKey(isoDate: string): string {
  return Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York")
    .toPlainDate().toString();
}

function signalsFor(data: SubmittedEventData, event: DatabaseEvent): DuplicateSignal[] {
  const signals: DuplicateSignal[] = [];

  const submittedVenue = normalize(data.location);
  const eventVenue = normalize(event.location);
  if (submittedVenue !== "" && submittedVenue === eventVenue) signals.push("same-venue");

  try {
    if (dayKey(data.event_date) === dayKey(event.event_date)) signals.push("same-date");
  } catch {
    // Unparseable date — no same-date signal, never throw out of a review panel.
  }

  const submittedTitle = normalizeTitle(data.title);
  const eventTitle = normalizeTitle(event.title);
  if (submittedTitle !== "" && (submittedTitle === eventTitle || jaccard(submittedTitle, eventTitle) >= 0.6)) {
    signals.push("similar-title");
  }

  const submittedHost = normalize(data.host);
  const eventHost = normalize(event.host);
  if (submittedHost !== "" && submittedHost === eventHost) signals.push("same-organizer");

  return signals;
}

function confidenceFor(signals: DuplicateSignal[]): "high" | "medium" | null {
  if (signals.length >= 3) return "high";
  if (signals.includes("same-venue") && signals.includes("same-date")) return "high";
  if (signals.length === 2) return "medium";
  return null;
}

// Matches against canonical events AND other pending submissions — a
// duplicate pair can arrive before either is approved. otherSubmissions is
// pre-converted to DatabaseEvent-shaped stand-ins by the caller (repo layer)
// since this module has no I/O and takes plain data in.
export function findDuplicateCandidates(
  data: SubmittedEventData,
  canonicalEvents: DatabaseEvent[],
  otherPendingSubmissions: DatabaseEvent[]
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  for (const event of [...canonicalEvents, ...otherPendingSubmissions]) {
    const signals = signalsFor(data, event);
    const confidence = confidenceFor(signals);
    if (confidence) candidates.push({ event, signals, confidence });
  }
  return candidates;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/submissions/model/duplicates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/submissions/model/duplicates.ts src/features/submissions/model/duplicates.test.ts
git commit -m "feat: add per-signal duplicate detection for submissions"
```

---

## Task 8: `venueMatching.ts` — venue normalization

**Files:**
- Create: `src/features/submissions/model/venueMatching.ts`
- Test: `src/features/submissions/model/venueMatching.test.ts`

**Interfaces:**
- Consumes: `DatabaseEvent[]` (for the canonical `location` set).
- Produces: `VenueMatch = { kind: "exact"; location: string } | { kind: "fuzzy"; location: string; address: string | null } | { kind: "none" }`, `matchVenue(submittedLocation: string | null, canonicalEvents: DatabaseEvent[]): VenueMatch` — consumed by Tasks 9, 20, 28.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { matchVenue } from "./venueMatching";
import type { DatabaseEvent } from "../../events/model/types";

function event(location: string, address: string | null = null): DatabaseEvent {
  return {
    id: "evt-1", title: "x", description: null, event_type: "social",
    event_date: "2026-08-23T19:00:00Z", event_time: null, location, address,
    price_type: null, price_amount: null, rsvp_link: null, image_url: null,
    submitter_name: null, submitter_email: null, submitter_id: null,
    status: "approved", source_type: "user_submission", dance_styles: null,
    updated_at: "2026-08-01T00:00:00Z", cancellation_reason: null, city: "boston",
    created_at: "2026-08-01T00:00:00Z", host: null, recurrence: null, gallery: null,
    contact_email: null, contact_instagram: null, contact_website: null,
  };
}

describe("matchVenue", () => {
  it("returns exact when normalized location matches an existing venue exactly", () => {
    const result = matchVenue("  Havana Club  ", [event("havana club")]);
    expect(result).toEqual({ kind: "exact", location: "havana club" });
  });

  it("returns fuzzy with the canonical location+address when similarity clears 0.6", () => {
    const result = matchVenue("Havanna Club", [event("Havana Club", "288 Green St, Cambridge, MA")]);
    expect(result.kind).toBe("fuzzy");
    if (result.kind === "fuzzy") {
      expect(result.location).toBe("Havana Club");
      expect(result.address).toBe("288 Green St, Cambridge, MA");
    }
  });

  it("returns none for an unrelated venue name", () => {
    const result = matchVenue("Totally Different Place", [event("Havana Club")]);
    expect(result.kind).toBe("none");
  });

  it("returns none when the submission has no location", () => {
    expect(matchVenue(null, [event("Havana Club")]).kind).toBe("none");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/submissions/model/venueMatching.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
import type { DatabaseEvent } from "../../events/model/types";

export type VenueMatch =
  | { kind: "exact"; location: string }
  | { kind: "fuzzy"; location: string; address: string | null }
  | { kind: "none" };

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function jaccard(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter(Boolean));
  const wordsB = new Set(b.split(" ").filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function matchVenue(
  submittedLocation: string | null,
  canonicalEvents: DatabaseEvent[]
): VenueMatch {
  const submitted = submittedLocation?.trim();
  if (!submitted) return { kind: "none" };

  const canonicalLocations = new Map<string, { location: string; address: string | null }>();
  for (const event of canonicalEvents) {
    if (!event.location?.trim()) continue;
    const key = normalize(event.location);
    if (!canonicalLocations.has(key)) {
      canonicalLocations.set(key, { location: event.location, address: event.address });
    }
  }

  const normalizedSubmitted = normalize(submitted);
  const exact = canonicalLocations.get(normalizedSubmitted);
  if (exact) return { kind: "exact", location: normalizedSubmitted };

  let best: { location: string; address: string | null } | null = null;
  let bestScore = 0;
  for (const [key, value] of canonicalLocations) {
    const score = jaccard(normalizedSubmitted, key);
    if (score >= 0.6 && score > bestScore) {
      best = value;
      bestScore = score;
    }
  }
  if (best) return { kind: "fuzzy", location: best.location, address: best.address };

  return { kind: "none" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/submissions/model/venueMatching.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/submissions/model/venueMatching.ts src/features/submissions/model/venueMatching.test.ts
git commit -m "feat: add venue normalization matching for submissions"
```

---

## Task 9: `submissionsQuery.ts` — views, filters, predicates

**Files:**
- Create: `src/features/submissions/model/submissionsQuery.ts`
- Test: `src/features/submissions/model/submissionsQuery.test.ts`

**Interfaces:**
- Consumes: `SubmissionRow` (Task 4), `effectiveData` (Task 5), `submissionQualityIssues`/`hasRequiredGap` (Task 6), `findDuplicateCandidates` (Task 7), `DatabaseEvent[]`.
- Produces: `SubmissionView = "pending" | "needs-attention" | "duplicates" | "upcoming-soon" | "all"`, `SUBMISSION_VIEWS`, `SubmissionFilters`, `applySubmissionView`, `applySubmissionFilters`, `viewCounts` — consumed by Tasks 23, 24, 26.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { applySubmissionView } from "./submissionsQuery";
import type { SubmissionRow, SubmittedEventData } from "./types";

const data: SubmittedEventData = {
  title: "Salsa Mondays", description: null, event_type: "social",
  event_date: "2026-08-13", event_time: null, location: null, address: null,
  price_type: null, price_amount: null, rsvp_link: null, image_url: null,
  submitter_name: null, submitter_email: null, submitter_id: null,
  dance_styles: null, city: "boston", host: null, recurrence: null,
  gallery: null, contact_email: null, contact_instagram: null, contact_website: null,
};

function row(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
  return {
    id: "sub-1", submitter_id: null, submitter_email: null, submitter_name: null,
    status: "pending", submitted_data: data, edited_data: null,
    submitted_at: "2026-08-12T00:00:00Z", reviewed_by: null, reviewed_at: null,
    rejection_reason: null, rejection_message: null, internal_note: null,
    duplicate_of_event_id: null, dismissed_duplicate_ids: [], approved_event_id: null,
    created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:00Z", ...overrides,
  };
}

describe("applySubmissionView", () => {
  const now = new Date("2026-08-12T00:00:00Z");

  it("needs-attention includes only pending rows with a required-tier gap", () => {
    const missing = row({ submitted_data: { ...data, title: "" } });
    const complete = row({ id: "sub-2", submitted_data: { ...data, title: "Ok" } });
    const result = applySubmissionView([missing, complete], "needs-attention", now, [], []);
    expect(result.map((r) => r.id)).toEqual(["sub-1"]);
  });

  it("upcoming-soon includes only pending rows whose event starts within 7 days", () => {
    const soon = row({ submitted_data: { ...data, event_date: "2026-08-13" } });
    const later = row({ id: "sub-2", submitted_data: { ...data, event_date: "2026-09-30" } });
    const result = applySubmissionView([soon, later], "upcoming-soon", now, [], []);
    expect(result.map((r) => r.id)).toEqual(["sub-1"]);
  });

  it("all includes every status", () => {
    const approved = row({ status: "approved" });
    const rejected = row({ id: "sub-2", status: "rejected" });
    const result = applySubmissionView([approved, rejected], "all", now, [], []);
    expect(result).toHaveLength(2);
  });

  it("pending excludes non-pending rows", () => {
    const pending = row();
    const approved = row({ id: "sub-2", status: "approved" });
    const result = applySubmissionView([pending, approved], "pending", now, [], []);
    expect(result.map((r) => r.id)).toEqual(["sub-1"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/submissions/model/submissionsQuery.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
import "temporal-polyfill/global";
import type { SubmissionRow, SubmissionStatus } from "./types";
import type { City } from "../../events/model/types";
import { effectiveData } from "./submissionForm";
import { submissionQualityIssues, hasRequiredGap } from "./quality";
import { findDuplicateCandidates } from "./duplicates";
import type { DatabaseEvent } from "../../events/model/types";

export type SubmissionView = "pending" | "needs-attention" | "duplicates" | "upcoming-soon" | "all";

export const SUBMISSION_VIEWS: { view: SubmissionView; label: string }[] = [
  { view: "pending", label: "Pending" },
  { view: "needs-attention", label: "Needs Attention" },
  { view: "duplicates", label: "Duplicates" },
  { view: "upcoming-soon", label: "Upcoming Soon" },
  { view: "all", label: "All" },
];

export interface SubmissionFilters {
  q: string;
  city: City | null;
  style: string | null;
  submitterKind: "profile" | "guest" | null;
  status: SubmissionStatus | null;
}

function withinDays(isoDate: string, now: Date, days: number): boolean {
  try {
    const target = Temporal.Instant.from(isoDate).epochMilliseconds;
    const nowMs = now.getTime();
    return target >= nowMs && target <= nowMs + days * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function applySubmissionView(
  rows: SubmissionRow[],
  view: SubmissionView,
  now: Date,
  canonicalEvents: DatabaseEvent[],
  otherPendingAsEvents: DatabaseEvent[]
): SubmissionRow[] {
  switch (view) {
    case "pending":
      return rows.filter((r) => r.status === "pending");
    case "needs-attention":
      return rows.filter(
        (r) => r.status === "pending" && hasRequiredGap(submissionQualityIssues(effectiveData(r)))
      );
    case "duplicates":
      return rows.filter((r) => {
        if (r.status !== "pending") return false;
        const candidates = findDuplicateCandidates(effectiveData(r), canonicalEvents, otherPendingAsEvents);
        return candidates.some((c) => c.confidence === "high");
      });
    case "upcoming-soon":
      return rows.filter(
        (r) => r.status === "pending" && withinDays(effectiveData(r).event_date, now, 7)
      );
    case "all":
      return rows;
  }
}

export function applySubmissionFilters(rows: SubmissionRow[], filters: SubmissionFilters): SubmissionRow[] {
  return rows.filter((r) => {
    const data = effectiveData(r);
    if (filters.q) {
      const q = filters.q.trim().toLowerCase();
      const haystack = `${data.title} ${data.location ?? ""} ${data.host ?? ""} ${r.submitter_name ?? ""} ${r.submitter_email ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.city && data.city !== filters.city) return false;
    if (filters.style && !(data.dance_styles ?? []).includes(filters.style)) return false;
    if (filters.submitterKind) {
      const kind = r.submitter_id ? "profile" : "guest";
      if (kind !== filters.submitterKind) return false;
    }
    if (filters.status && r.status !== filters.status) return false;
    return true;
  });
}

export function viewCounts(
  rows: SubmissionRow[],
  now: Date,
  canonicalEvents: DatabaseEvent[],
  otherPendingAsEvents: DatabaseEvent[]
): Record<SubmissionView, number> {
  const counts = {} as Record<SubmissionView, number>;
  for (const { view } of SUBMISSION_VIEWS) {
    counts[view] = applySubmissionView(rows, view, now, canonicalEvents, otherPendingAsEvents).length;
  }
  return counts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/submissions/model/submissionsQuery.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/submissions/model/submissionsQuery.ts src/features/submissions/model/submissionsQuery.test.ts
git commit -m "feat: add submission views, filters, and predicates"
```

---

## Task 10: `submissionsRepo.ts` — all Supabase I/O for `event_submissions`

**Files:**
- Create: `src/features/submissions/api/submissionsRepo.ts`
- Test: `src/features/submissions/api/submissionsRepo.test.ts`

**Interfaces:**
- Consumes: `supabase` client (`src/lib/supabase.ts`), `SubmissionRow`, `SubmittedEventData`, `RejectionReason` (Task 4).
- Produces (all exported, consumed by Tasks 11–14, 23, 28):
  - `createSubmission(data: SubmittedEventData): Promise<void>`
  - `fetchAllSubmissions(): Promise<SubmissionRow[]>`
  - `fetchSubmissionById(id: string): Promise<SubmissionRow | null>`
  - `fetchMySubmissions(userId: string): Promise<SubmissionRow[]>`
  - `updateOwnSubmission(id: string, userId: string, data: SubmittedEventData): Promise<void>`
  - `withdrawOwnSubmission(id: string, userId: string): Promise<void>`
  - `saveEdits(id: string, edited: Partial<SubmittedEventData>): Promise<void>`
  - `approveSubmission(id: string, reviewerId: string): Promise<{ eventId: string }>`
  - `rejectSubmission(id: string, reviewerId: string, input: { reason: RejectionReason; message: string | null; internalNote: string | null }): Promise<void>`
  - `reopenSubmission(id: string): Promise<void>`
  - `dismissDuplicate(id: string, eventId: string, currentDismissed: string[]): Promise<void>`
  - `useExistingVenueEdit(id: string, edited: Partial<SubmittedEventData>): Promise<void>` (thin alias of `saveEdits` — kept distinct in the repo's export surface since callers reach for the concept, not the mechanism)

- [ ] **Step 1: Write the failing tests (Supabase client mocked)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const from = vi.fn();
const rpc = vi.fn();
vi.mock("../../../lib/supabase", () => ({ supabase: { from, rpc } }));

import {
  createSubmission, saveEdits, reopenSubmission,
} from "./submissionsRepo";

function chain(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "in", "order", "limit", "single"];
  for (const m of methods) builder[m] = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return builder;
}

beforeEach(() => {
  from.mockReset();
  rpc.mockReset();
});

describe("createSubmission", () => {
  it("inserts into event_submissions with status pending and submitted_data set", async () => {
    const insert = vi.fn(() => ({ error: null }));
    from.mockReturnValue({ insert });
    await createSubmission({
      title: "T", description: null, event_type: "social", event_date: "2026-08-24",
      event_time: null, location: null, address: null, price_type: null, price_amount: null,
      rsvp_link: null, image_url: null, submitter_name: null, submitter_email: "a@b.com",
      submitter_id: "u1", dance_styles: null, city: "boston", host: null, recurrence: null,
      gallery: null, contact_email: null, contact_instagram: null, contact_website: null,
    });
    expect(from).toHaveBeenCalledWith("event_submissions");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", submitted_data: expect.objectContaining({ title: "T" }) })
    );
  });
});

describe("saveEdits", () => {
  it("updates edited_data for the given id", async () => {
    const update = vi.fn(() => chain({ error: null }));
    from.mockReturnValue({ update });
    await saveEdits("sub-1", { location: "Havana Club" });
    expect(update).toHaveBeenCalledWith({ edited_data: { location: "Havana Club" } });
  });
});

describe("reopenSubmission", () => {
  it("sets status back to pending", async () => {
    const update = vi.fn(() => chain({ error: null }));
    from.mockReturnValue({ update });
    await reopenSubmission("sub-1");
    expect(update).toHaveBeenCalledWith({ status: "pending" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/submissions/api/submissionsRepo.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
import { supabase } from "../../../lib/supabase";
import type { SubmissionRow, SubmittedEventData, RejectionReason } from "../model/types";

export async function createSubmission(data: SubmittedEventData): Promise<void> {
  const { error } = await supabase.from("event_submissions").insert({
    submitter_id: data.submitter_id,
    submitter_email: data.submitter_email,
    submitter_name: data.submitter_name,
    status: "pending",
    submitted_data: data,
  });
  if (error) throw new Error(error.message);
}

export async function fetchAllSubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from("event_submissions")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SubmissionRow[]) ?? [];
}

export async function fetchSubmissionById(id: string): Promise<SubmissionRow | null> {
  const { data, error } = await supabase
    .from("event_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubmissionRow | null) ?? null;
}

export async function fetchMySubmissions(userId: string): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from("event_submissions")
    .select("*")
    .eq("submitter_id", userId)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SubmissionRow[]) ?? [];
}

export async function updateOwnSubmission(
  id: string,
  userId: string,
  data: SubmittedEventData
): Promise<void> {
  const { error } = await supabase
    .from("event_submissions")
    .update({ submitted_data: data })
    .eq("id", id)
    .eq("submitter_id", userId)
    .in("status", ["pending", "rejected"]);
  if (error) throw new Error(error.message);
}

export async function withdrawOwnSubmission(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("event_submissions")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .eq("submitter_id", userId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

export async function saveEdits(id: string, edited: Partial<SubmittedEventData>): Promise<void> {
  const { error } = await supabase
    .from("event_submissions")
    .update({ edited_data: edited })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export const useExistingVenueEdit = saveEdits;

// Reads the submission, inserts the events row from its effective data, then
// marks the submission approved with a pointer to the new event. Not a
// single RPC (per the design doc — a plain client-side read+insert+update is
// enough; the audit trigger on event_submissions covers the log entry).
export async function approveSubmission(
  id: string,
  reviewerId: string
): Promise<{ eventId: string }> {
  const submission = await fetchSubmissionById(id);
  if (!submission) throw new Error("Submission not found");
  const effective = submission.edited_data
    ? { ...submission.submitted_data, ...submission.edited_data }
    : submission.submitted_data;

  const { data: inserted, error: insertError } = await supabase
    .from("events")
    .insert({
      ...effective,
      status: "approved",
      source_type: "user_submission",
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  const { error: updateError } = await supabase
    .from("event_submissions")
    .update({
      status: "approved",
      approved_event_id: inserted.id,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  return { eventId: inserted.id as string };
}

export async function rejectSubmission(
  id: string,
  reviewerId: string,
  input: { reason: RejectionReason; message: string | null; internalNote: string | null }
): Promise<void> {
  const { error } = await supabase
    .from("event_submissions")
    .update({
      status: "rejected",
      rejection_reason: input.reason,
      rejection_message: input.message,
      internal_note: input.internalNote,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reopenSubmission(id: string): Promise<void> {
  const { error } = await supabase
    .from("event_submissions")
    .update({ status: "pending" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function dismissDuplicate(
  id: string,
  eventId: string,
  currentDismissed: string[]
): Promise<void> {
  const { error } = await supabase
    .from("event_submissions")
    .update({ dismissed_duplicate_ids: [...currentDismissed, eventId] })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/submissions/api/submissionsRepo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/submissions/api/submissionsRepo.ts src/features/submissions/api/submissionsRepo.test.ts
git commit -m "feat: add submissionsRepo for all event_submissions I/O"
```

---

## Task 11: Submission audit log — repo function, hook, `auditLogLabelFor` cases

**Files:**
- Create: `src/features/admin/api/submissionAuditLogRepo.ts`
- Create: `src/hooks/useSubmissionAuditLog.ts`
- Modify: `src/features/admin/model/auditLog.ts`
- Test: `src/features/admin/model/auditLog.test.ts` (extend if it exists, else create), `src/features/admin/api/submissionAuditLogRepo.test.ts`

**Interfaces:**
- Consumes: `AuditLogRow` (existing, `auditLog.ts`), `REJECTION_REASON_LABEL` (Task 4).
- Produces: `fetchSubmissionAuditLog(submissionId, limit=50): Promise<AuditLogRow[]>`, `useSubmissionAuditLog(submissionId: string)` — consumed by Task 28.

- [ ] **Step 1: Write the failing test for the new `auditLogLabelFor` cases**

```ts
import { describe, it, expect } from "vitest";
import { auditLogLabelFor, type AuditLogRow } from "./auditLog";

function entry(overrides: Partial<AuditLogRow>): AuditLogRow {
  return {
    id: "log-1", actor_id: null, entity_type: "event_submission", entity_id: "sub-1",
    action: "submission.created", metadata: null, created_at: "2026-08-12T00:00:00Z",
    ...overrides,
  };
}

describe("auditLogLabelFor — submission actions", () => {
  it("renders submission.created", () => {
    expect(auditLogLabelFor(entry({ action: "submission.created" }))).toBe("Submission received");
  });

  it("renders submission.edited with the field list from metadata", () => {
    const label = auditLogLabelFor(entry({
      action: "submission.edited", metadata: { fields: ["location", "title"] },
    }));
    expect(label).toBe("location, title corrected");
  });

  it("renders submission.rejected with the reason label", () => {
    const label = auditLogLabelFor(entry({
      action: "submission.rejected", metadata: { reason: "missing_information" },
    }));
    expect(label).toBe("Rejected — Missing Information");
  });

  it("renders submission.approved, submission.reopened, submission.withdrawn, submission.marked_duplicate, submission.review_started", () => {
    expect(auditLogLabelFor(entry({ action: "submission.approved" }))).toBe("Approved");
    expect(auditLogLabelFor(entry({ action: "submission.reopened" }))).toBe("Reopened");
    expect(auditLogLabelFor(entry({ action: "submission.withdrawn" }))).toBe("Withdrawn by submitter");
    expect(auditLogLabelFor(entry({ action: "submission.marked_duplicate" }))).toBe("Marked as duplicate");
    expect(auditLogLabelFor(entry({ action: "submission.review_started" }))).toBe("Review started");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/admin/model/auditLog.test.ts`
Expected: FAIL — new cases fall through to the raw `entry.action` string.

- [ ] **Step 3: Add the cases to `auditLogLabelFor`'s switch**

In `src/features/admin/model/auditLog.ts`, add `import { REJECTION_REASON_LABEL, type RejectionReason } from "../../submissions/model/types";` at the top, then insert these `case`s into the existing `switch (entry.action)` before the `default:` branch:

```ts
    case "submission.created":
      return "Submission received";
    case "submission.review_started":
      return "Review started";
    case "submission.edited": {
      const fields = (metadata.fields as string[] | undefined) ?? [];
      return fields.length > 0 ? `${fields.join(", ")} corrected` : "Fields corrected";
    }
    case "submission.approved":
      return "Approved";
    case "submission.rejected": {
      const reason = metadata.reason as RejectionReason | undefined;
      return `Rejected${reason ? ` — ${REJECTION_REASON_LABEL[reason]}` : ""}`;
    }
    case "submission.marked_duplicate":
      return "Marked as duplicate";
    case "submission.reopened":
      return "Reopened";
    case "submission.withdrawn":
      return "Withdrawn by submitter";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/admin/model/auditLog.test.ts`
Expected: PASS

- [ ] **Step 5: Write `submissionAuditLogRepo.ts` + its test**

```ts
// src/features/admin/api/submissionAuditLogRepo.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const from = vi.fn();
vi.mock("../../../lib/supabase", () => ({ supabase: { from } }));
import { fetchSubmissionAuditLog } from "./submissionAuditLogRepo";

beforeEach(() => from.mockReset());

describe("fetchSubmissionAuditLog", () => {
  it("filters by entity_id and entity_type, ordered newest-first", async () => {
    const order = vi.fn(() => ({ limit: vi.fn(() => Promise.resolve({ data: [], error: null })) }));
    const eqEntityType = vi.fn(() => ({ order }));
    const eqEntityId = vi.fn(() => ({ eq: eqEntityType }));
    from.mockReturnValue({ select: vi.fn(() => ({ eq: eqEntityId })) });

    await fetchSubmissionAuditLog("sub-1");

    expect(from).toHaveBeenCalledWith("audit_logs");
    expect(eqEntityId).toHaveBeenCalledWith("entity_id", "sub-1");
    expect(eqEntityType).toHaveBeenCalledWith("entity_type", "event_submission");
  });
});
```

```ts
// src/features/admin/api/submissionAuditLogRepo.ts
import { supabase } from "../../../lib/supabase";
import type { AuditLogRow } from "../model/auditLog";

export async function fetchSubmissionAuditLog(
  submissionId: string,
  limit = 50
): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_id", submissionId)
    .eq("entity_type", "event_submission")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as AuditLogRow[]) ?? [];
}
```

- [ ] **Step 6: Write `useSubmissionAuditLog.ts` (no separate test — thin wrapper, covered by Task 28's review page test)**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchSubmissionAuditLog } from "../features/admin/api/submissionAuditLogRepo";

export function useSubmissionAuditLog(submissionId: string) {
  const query = useQuery({
    queryKey: ["admin", "submissionAuditLog", submissionId],
    queryFn: () => fetchSubmissionAuditLog(submissionId),
  });

  return {
    entries: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
```

- [ ] **Step 7: Run all new/changed tests**

Run: `npx vitest run src/features/admin/model/auditLog.test.ts src/features/admin/api/submissionAuditLogRepo.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/features/admin/model/auditLog.ts src/features/admin/model/auditLog.test.ts src/features/admin/api/submissionAuditLogRepo.ts src/features/admin/api/submissionAuditLogRepo.test.ts src/hooks/useSubmissionAuditLog.ts
git commit -m "feat: add submission audit log vocabulary, repo function, and hook"
```

---

## Task 12: `useSubmitEventForm.ts` — write to `event_submissions`, fix the `dance_styles` bug

**Files:**
- Modify: `src/features/submit-event/useSubmitEventForm.ts`
- Modify (delete `submitEvent`): `src/features/events/api/eventsRepo.ts`
- Test: `src/features/submit-event/useSubmitEventForm.test.ts` (extend existing tests for this hook if present, else the existing test file's assertions on the insert payload)

**Interfaces:**
- Consumes: `createSubmission` (Task 10).
- Produces: same public hook shape `{ form, update, handleSubmit, isSubmitting, isSubmitted, error, resetSubmitted }` — no consumer-facing change.

- [ ] **Step 1: Update/add the failing test asserting the new call and the bug fix**

Locate the existing test file covering `useSubmitEventForm` (grep confirms one exists per repo TDD convention) and update its mock target and assertion:

```ts
vi.mock("../events/api/eventsRepo", () => ({})); // submitEvent no longer lives here
vi.mock("../submissions/api/submissionsRepo", () => ({ createSubmission: vi.fn(() => Promise.resolve()) }));
import { createSubmission } from "../submissions/api/submissionsRepo";

it("submits dance_styles as an empty array, not null, when nothing is selected", async () => {
  // ...render hook, submit with no dance styles selected...
  expect(createSubmission).toHaveBeenCalledWith(
    expect.objectContaining({ dance_styles: [] })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/submit-event/useSubmitEventForm.test.ts`
Expected: FAIL — still imports `submitEvent` from `eventsRepo` and still sends `null`.

- [ ] **Step 3: Update the hook**

In `src/features/submit-event/useSubmitEventForm.ts`: replace the `submitEvent` import with `import { createSubmission } from "../submissions/api/submissionsRepo";`, replace the `await submitEvent({...})` call with `await createSubmission({...})` using the exact same field mapping, EXCEPT the last line:

```ts
  dance_styles: form.dance_styles.length > 0 ? form.dance_styles : [],
```

(was `: null` — this is the bug fix; `event_submissions.submitted_data` is a jsonb blob so there's no `NOT NULL DEFAULT '{}'` column constraint to bypass, but `[]` is still correct since it matches what an approved event's `dance_styles` column expects at Approve time).

- [ ] **Step 4: Remove `submitEvent` from `eventsRepo.ts`**

Delete the `NewEventSubmission` interface and `submitEvent` function from `src/features/events/api/eventsRepo.ts` (lines identified by AdminUiScout/EventsDataScout as lines 5-21 and 78-86). Run `xd://lsp` `references` on `submitEvent` first to confirm no other caller remains before deleting.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/submit-event/useSubmitEventForm.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/submit-event/useSubmitEventForm.ts src/features/submit-event/useSubmitEventForm.test.ts src/features/events/api/eventsRepo.ts
git commit -m "fix: submit events into event_submissions, fix dance_styles null bug"
```

---

## Task 13: `useMySubmissions.ts` — fan out across `event_submissions` and `events`

**Files:**
- Modify: `src/hooks/useMySubmissions.ts`
- Modify (delete `fetchMySubmissions`): `src/features/events/api/eventsRepo.ts`
- Test: `src/hooks/useMySubmissions.test.ts` (create if absent)

**Interfaces:**
- Consumes: `fetchMySubmissions` (Task 10, from `submissionsRepo`), `fetchApprovedEvents`-style query for a submitter's approved events (new small repo function `fetchMyApprovedEvents(userId)` in `eventsRepo.ts` since none exists — approved events are the only `events`-table concern left for a submitter).
- Produces: a discriminated union so `ProfilePage`/`UserEventEditPage` can render both shapes: `type MySubmission = { source: "submission"; row: SubmissionRow } | { source: "event"; row: DatabaseEvent };` — return shape `{ submissions: MySubmission[] | undefined, isLoading, error, refetch }` (same field names as before, `submissions` now holds the union array instead of `DatabaseEvent[]`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("../features/submissions/api/submissionsRepo", () => ({
  fetchMySubmissions: vi.fn(() => Promise.resolve([{ id: "sub-1", status: "pending" }])),
}));
vi.mock("../features/events/api/eventsRepo", () => ({
  fetchMyApprovedEvents: vi.fn(() => Promise.resolve([{ id: "evt-1", status: "approved" }])),
}));

import { useMySubmissions } from "./useMySubmissions";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("useMySubmissions", () => {
  it("merges pending/rejected/withdrawn submissions with approved events", async () => {
    const { result } = renderHook(() => useMySubmissions("user-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.submissions).toEqual([
      { source: "submission", row: { id: "sub-1", status: "pending" } },
      { source: "event", row: { id: "evt-1", status: "approved" } },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useMySubmissions.test.ts`
Expected: FAIL — current hook only wraps `fetchMySubmissions` from `eventsRepo` and returns `DatabaseEvent[]`.

- [ ] **Step 3: Add `fetchMyApprovedEvents` to `eventsRepo.ts` and rewrite the hook**

Add to `src/features/events/api/eventsRepo.ts` (near `fetchApprovedEvents`):

```ts
export async function fetchMyApprovedEvents(userId: string): Promise<DatabaseEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("submitter_id", userId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DatabaseEvent[]) || [];
}
```

Rewrite `src/hooks/useMySubmissions.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchMySubmissions as fetchSubmissionRows } from "../features/submissions/api/submissionsRepo";
import { fetchMyApprovedEvents } from "../features/events/api/eventsRepo";
import type { SubmissionRow } from "../features/submissions/model/types";
import type { DatabaseEvent } from "../features/events/model/types";

export type MySubmission =
  | { source: "submission"; row: SubmissionRow }
  | { source: "event"; row: DatabaseEvent };

export function useMySubmissions(userId: string | undefined) {
  const query = useQuery({
    queryKey: ["events", "mine", userId],
    queryFn: async (): Promise<MySubmission[]> => {
      const [submissionRows, approvedEvents] = await Promise.all([
        fetchSubmissionRows(userId!),
        fetchMyApprovedEvents(userId!),
      ]);
      return [
        ...submissionRows.map((row): MySubmission => ({ source: "submission", row })),
        ...approvedEvents.map((row): MySubmission => ({ source: "event", row })),
      ];
    },
    enabled: !!userId,
  });

  return {
    submissions: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
```

Note: the query key `["events", "mine", userId]` is kept identical so `ProfilePage`/`UserEventEditPage`'s existing `invalidateQueries` calls keep working without modification.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useMySubmissions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMySubmissions.ts src/hooks/useMySubmissions.test.ts src/features/events/api/eventsRepo.ts
git commit -m "feat: fan useMySubmissions out across event_submissions and approved events"
```

---

## Task 14: `ProfilePage.tsx` — adapt to the `MySubmission` union

**Files:**
- Modify: `src/pages/ProfilePage.tsx`
- Test: `src/pages/ProfilePage.test.tsx` (extend existing)

**Interfaces:**
- Consumes: `MySubmission` (Task 13), `withdrawOwnSubmission` (Task 10, replacing `withdrawSubmission` from `eventsRepo`).

- [ ] **Step 1: Update the failing test**

In the existing `ProfilePage.test.tsx`, update the `useMySubmissions` mock to return `MySubmission[]` shape instead of flat `DatabaseEvent[]`, and add:

```ts
it("shows Withdraw only for pending submissions, not for approved events", () => {
  // render with one { source: "submission", row: { status: "pending", ... } }
  // and one { source: "event", row: { status: "approved", ... } }
  // assert exactly one Withdraw button is present
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/ProfilePage.test.tsx`
Expected: FAIL — page still destructures `event.status` off a flat `DatabaseEvent[]`.

- [ ] **Step 3: Rewrite the page's data access**

Replace `events = submissions ?? []` and all downstream `.status`/`.event_type`/`.event_date` field access with a normalized view built once per item:

```ts
import { effectiveData } from "../features/submissions/model/submissionForm";

const items = (submissions ?? []).map((item) => ({
  id: item.row.id,
  status: item.source === "submission" ? item.row.status : item.row.status, // "approved" for events
  data: item.source === "submission" ? effectiveData(item.row) : item.row,
  source: item.source,
}));
```

Update `canEdit`/`canWithdraw` to read `item.source === "submission" && (item.status === "pending" || item.status === "rejected")` / `item.source === "submission" && item.status === "pending"` — approved `events`-sourced rows are never editable/withdrawable from this page (matches current behavior: approval already blocks edit). Replace the `withdrawMutation`'s `mutationFn` to call `withdrawOwnSubmission(id, user!.id)` from `submissionsRepo` instead of `withdrawSubmission` from `eventsRepo`. Keep the `STATUS_LABEL` map, `formatSubmissionDate`, and the 4-tab filter row (`all`/`pending`/`approved`/`rejected`) unchanged — they operate on the normalized `status` string either way.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/ProfilePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProfilePage.tsx src/pages/ProfilePage.test.tsx
git commit -m "feat: adapt ProfilePage to the submission/event union shape"
```

---

## Task 15: `UserEventEditPage.tsx` — edit `event_submissions.submitted_data`

**Files:**
- Modify: `src/pages/UserEventEditPage.tsx`
- Test: `src/pages/UserEventEditPage.test.tsx` (extend existing)

**Interfaces:**
- Consumes: `fetchMySubmissions`/`updateOwnSubmission`/`withdrawOwnSubmission` (Task 10), `MySubmission` (Task 13).

- [ ] **Step 1: Update the failing test**

Update the existing test's `useMySubmissions` mock to the `MySubmission` shape; assert the save mutation calls `updateOwnSubmission` (not `updateEventForUser`) with the submission's `id` and a rebuilt `SubmittedEventData` payload.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/UserEventEditPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite the page**

Replace `editingEvent = submissions.find(e => e.id === eventId)` with a lookup over the `MySubmission[]` union filtered to `source === "submission"`, since editable rows are always submissions (approved `events`-sourced rows already redirect away via the existing "not pending/rejected" effect — keep that guard, now checking `item.row.status`). Replace `buildUserFormFromEvent(event: DatabaseEvent)` with a call to `effectiveData(submission)` (Task 5) followed by the same field-mapping the existing `buildUserFormFromEvent` used (they're structurally identical — `SubmittedEventData` and `DatabaseEvent` share every field this function reads). Replace `saveMutation`'s `mutationFn` from `updateEventForUser(id, payload, user!.id)` to `updateOwnSubmission(id, user!.id, userFormToSubmittedData(form))` where `userFormToSubmittedData` is `userFormToPayload`'s existing logic renamed/adjusted to produce a full `SubmittedEventData` (add back `submitter_id`/`submitter_email`/`submitter_name` from the original submission row, since `SubmittedEventData` — unlike the old `UserEventPayload` — carries them). Replace `withdrawMutation`'s call from `withdrawSubmission` to `withdrawOwnSubmission`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/UserEventEditPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Remove the now-dead `updateEventForUser`/`withdrawSubmission`/`UserEventPayload` from `eventsRepo.ts`**

Run `xd://lsp` `references` on each symbol first to confirm zero remaining callers, then delete.

- [ ] **Step 6: Commit**

```bash
git add src/pages/UserEventEditPage.tsx src/pages/UserEventEditPage.test.tsx src/features/events/api/eventsRepo.ts
git commit -m "feat: edit event_submissions.submitted_data from UserEventEditPage"
```

---

## Task 16: `overviewMetrics.ts` — decouple `pendingCount` from `events`

**Files:**
- Modify: `src/features/admin/model/overviewMetrics.ts`
- Modify: `src/pages/AdminOverviewPage.tsx`
- Test: `src/features/admin/model/overviewMetrics.test.ts` (extend existing)

**Interfaces:**
- `deriveOverviewMetrics(events, now, users, pendingSubmissionCount)` — new 4th required parameter.

- [ ] **Step 1: Update the failing test**

Update the existing `deriveOverviewMetrics` test suite: every call site now passes a 4th argument; add:

```ts
it("pendingCount reflects the passed-in submission count, not events", () => {
  const result = deriveOverviewMetrics([], new Date(), [], 5);
  expect(result.pendingCount).toBe(5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/admin/model/overviewMetrics.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update the function**

```ts
export function deriveOverviewMetrics(
  events: DatabaseEvent[],
  now: Date,
  users: AdminUserRow[] = [],
  pendingSubmissionCount: number
): OverviewMetrics {
  // ... existing body, but delete the `const pendingCount = events.filter(...)` line
  // and use `pendingSubmissionCount` directly in the returned object.
}
```

- [ ] **Step 4: Update `AdminOverviewPage.tsx`'s call site**

Fetch submission counts via a new lightweight hook `useAdminSubmissions()` (Task 23 — if Task 23 isn't done yet when this task runs, stub with `fetchAllSubmissions().then(rows => rows.filter(r => r.status === "pending").length)` inline via `useQuery`; Task 23 will replace this with the shared hook once it exists) and pass `.filter(s => s.status === "pending").length` as the 4th argument to `deriveOverviewMetrics`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/admin/model/overviewMetrics.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/model/overviewMetrics.ts src/features/admin/model/overviewMetrics.test.ts src/pages/AdminOverviewPage.tsx
git commit -m "fix: derive admin overview pendingCount from event_submissions"
```

---

## Task 17: `AdminQualityBadge` — widen to accept any labeled issue list

**Files:**
- Modify: `src/components/Admin/AdminQualityBadge.tsx`
- Test: `src/components/Admin/AdminQualityBadge.test.tsx` (extend existing)

**Interfaces:**
- Old: `{ issues: QualityIssue[]; eventTitle: string; cancellationReason?: string | null }`.
- New (additive, backward compatible): `{ issues: string[]; labelFor: (issue: string) => string; eventTitle: string; cancellationReason?: string | null }`. Existing Events-page call site passes `labelFor={(issue) => QUALITY_ISSUE_LABEL[issue as QualityIssue]}`; Task 24's queue column passes `labelFor={(issue) => SUBMISSION_QUALITY_LABEL[issue as SubmissionQualityIssue]}`.

- [ ] **Step 1: Add a failing test for the new `labelFor` prop**

```ts
it("renders labels via the labelFor prop instead of a fixed map", () => {
  render(
    <AdminQualityBadge
      issues={["custom-issue"]}
      labelFor={(issue) => `Custom: ${issue}`}
      eventTitle="Test Event"
    />
  );
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByText("Custom: custom-issue")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Admin/AdminQualityBadge.test.tsx`
Expected: FAIL — `labelFor` prop doesn't exist yet, component still imports `QUALITY_ISSUE_LABEL` directly.

- [ ] **Step 3: Update the component**

Replace the `QualityIssue[]`-typed prop with `issues: string[]` and add `labelFor: (issue: string) => string`; replace every internal `QUALITY_ISSUE_LABEL[issue]` lookup with `labelFor(issue)`. Remove the now-unused `QualityIssue`/`QUALITY_ISSUE_LABEL` import from this file.

- [ ] **Step 4: Update the existing Events-page call site**

In `src/pages/AdminEventsPage.tsx` (or wherever `<AdminQualityBadge issues={...}>` is rendered for events — confirmed by AdminUiScout to be inside `AdminEventsTable.tsx`), add `labelFor={(issue) => QUALITY_ISSUE_LABEL[issue as QualityIssue]}`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Admin/AdminQualityBadge.test.tsx`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: clean (no other call site breaks — `xd://lsp` `references` on `AdminQualityBadge` confirms this is the only caller before Task 24 adds a second).

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminQualityBadge.tsx src/components/Admin/AdminQualityBadge.test.tsx src/components/Admin/AdminEventsTable.tsx
git commit -m "feat: generalize AdminQualityBadge to accept any labeled issue list"
```

---

## Task 18: `AdminSubmissionStatusBadge`

**Files:**
- Create: `src/components/Admin/AdminSubmissionStatusBadge.tsx`
- Test: `src/components/Admin/AdminSubmissionStatusBadge.test.tsx`

**Interfaces:**
- Consumes: `SubmissionStatus` (Task 4).
- Produces: `<AdminSubmissionStatusBadge status={SubmissionStatus} />` — consumed by Tasks 25, 28.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AdminSubmissionStatusBadge from "./AdminSubmissionStatusBadge";

describe("AdminSubmissionStatusBadge", () => {
  it("renders text for every submission status, never icon-only", () => {
    const statuses = ["pending", "in_review", "needs_information", "approved", "rejected", "withdrawn"] as const;
    for (const status of statuses) {
      const { unmount } = render(<AdminSubmissionStatusBadge status={status} />);
      expect(screen.getByText(/./)).toBeInTheDocument();
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Admin/AdminSubmissionStatusBadge.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**

Mirror `AdminStatusBadge.tsx`'s exact structure (three-signal: CSS-driven tint via `admin-status admin-status--{status}` class + icon + text):

```tsx
import { Clock, Eye, AlertCircle, CheckCircle2, XCircle, Undo2 } from "lucide-react";
import type { SubmissionStatus } from "../../features/submissions/model/types";

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "Pending", in_review: "In Review", needs_information: "Needs Information",
  approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn",
};

const STATUS_ICON: Partial<Record<SubmissionStatus, typeof Clock>> = {
  pending: Clock, in_review: Eye, needs_information: AlertCircle,
  approved: CheckCircle2, rejected: XCircle, withdrawn: Undo2,
};

export default function AdminSubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`admin-status admin-status--${status}`}>
      {Icon && <Icon size={12} />}
      {STATUS_LABEL[status]}
    </span>
  );
}
```

- [ ] **Step 4: Add CSS for the two new status modifiers not already covered by `admin-status--*`**

In `src/styles/admin.css`, near the existing `.admin-status--*` rules, add `.admin-shell .admin-status--in_review` and `.admin-shell .admin-status--needs_information` and `.admin-shell .admin-status--withdrawn`, each using existing `--admin-*` tokens only (e.g. `in_review`/`needs_information` reuse the same tint/border tokens as `pending`; `withdrawn` reuses the same neutral tokens as `archived`/`draft` — read the existing block first and match its exact declaration shape, do not invent new tokens).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Admin/AdminSubmissionStatusBadge.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminSubmissionStatusBadge.tsx src/components/Admin/AdminSubmissionStatusBadge.test.tsx src/styles/admin.css
git commit -m "feat: add AdminSubmissionStatusBadge"
```

---

## Task 19: `AdminSubmitterPanel` — registered vs magic-link presentation

**Files:**
- Create: `src/components/Admin/AdminSubmitterPanel.tsx`
- Test: `src/components/Admin/AdminSubmitterPanel.test.tsx`

**Interfaces:**
- Consumes: `AdminUserRow` (existing, now with `approved_count`), `AdminUserAvatar`, `displayNameFor`, `identityLineFor`, `AdminRoleBadge` (all existing, reused verbatim).
- Produces: `<AdminSubmitterPanel submitter={AdminUserRow} contributions={number} approvedCount={number} />` — consumed by Task 28.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AdminSubmitterPanel from "./AdminSubmitterPanel";
import type { AdminUserRow } from "../../features/admin/model/usersQuery";

function guestRow(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    kind: "guest", id: "guest:guest@example.com", user_id: null, email: "guest@example.com",
    display_name: "Guest Submitter", username: null, avatar_url: null, role: null,
    status: "active", status_reason: null, created_at: "2026-08-01T00:00:00Z",
    last_active_at: "2026-08-12T00:00:00Z", contributions: 1, pending_count: 1,
    approved_count: 0, email_confirmed_at: null, ...overrides,
  };
}

describe("AdminSubmitterPanel", () => {
  it("renders 'Magic-link only' chip and never renders a username for guest rows", () => {
    render(<AdminSubmitterPanel submitter={guestRow()} contributions={1} approvedCount={0} />);
    expect(screen.getByText("Magic-link only")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("renders 'Email not verified' with icon and text when email_confirmed_at is null", () => {
    render(<AdminSubmitterPanel submitter={guestRow()} contributions={1} approvedCount={0} />);
    expect(screen.getByText("Email not verified")).toBeInTheDocument();
  });

  it("renders 'Email verified' when email_confirmed_at is set", () => {
    render(<AdminSubmitterPanel submitter={guestRow({ email_confirmed_at: "2026-08-01T00:00:00Z" })} contributions={1} approvedCount={0} />);
    expect(screen.getByText("Email verified")).toBeInTheDocument();
  });

  it("renders contributions and approved count together for a registered submitter", () => {
    const row = guestRow({ kind: "profile", user_id: "user-1", username: "mariasalsa", role: "user" });
    render(<AdminSubmitterPanel submitter={row} contributions={8} approvedCount={7} />);
    expect(screen.getByText("8 previous submissions · 7 approved")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Admin/AdminSubmitterPanel.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**

```tsx
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import AdminUserAvatar from "./AdminUserAvatar";
import AdminRoleBadge from "./AdminRoleBadge";
import { displayNameFor, identityLineFor, type AdminUserRow } from "../../features/admin/model/usersQuery";

export default function AdminSubmitterPanel({
  submitter, contributions, approvedCount,
}: { submitter: AdminUserRow; contributions: number; approvedCount: number }) {
  const isGuest = submitter.kind === "guest";

  return (
    <div className="admin-submitter-panel">
      <AdminUserAvatar row={submitter} size={40} />
      <div className="admin-submitter-panel__details">
        <p className="admin-submitter-panel__name">{displayNameFor(submitter)}</p>
        {isGuest ? (
          <span className="admin-chip">Magic-link only</span>
        ) : (
          <>
            <p className="admin-submitter-panel__identity">{identityLineFor(submitter)}</p>
            <AdminRoleBadge role={submitter.role} />
          </>
        )}
        {submitter.email_confirmed_at ? (
          <p className="admin-submitter-panel__verification">
            <CheckCircle2 size={14} aria-hidden="true" /> Email verified
          </p>
        ) : (
          <p className="admin-submitter-panel__verification admin-submitter-panel__verification--warning">
            <AlertTriangle size={14} aria-hidden="true" /> Email not verified
          </p>
        )}
        <p className="admin-submitter-panel__stats">
          {contributions} previous submission{contributions === 1 ? "" : "s"} · {approvedCount} approved
        </p>
        <p className="admin-submitter-panel__email">{submitter.email}</p>
        <Link
          to={isGuest ? `/admin/users/${submitter.id}` : `/admin/users/${submitter.user_id}`}
        >
          {isGuest ? "View submitter →" : "View full profile →"}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add CSS** in `src/styles/admin.css`, matching `AdminUsersTable`'s existing email de-emphasis treatment (`.admin-submitter-panel__email { color: var(--admin-text-muted); font-size: 0.8125rem; }`) and the warning-color pairing (`.admin-submitter-panel__verification--warning { color: var(--admin-danger); }` in light theme, using the theme's existing danger token — never a new hex).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminSubmitterPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminSubmitterPanel.tsx src/components/Admin/AdminSubmitterPanel.test.tsx src/styles/admin.css
git commit -m "feat: add AdminSubmitterPanel for registered vs magic-link presentation"
```

---

## Task 20: `AdminEditedFieldDisclosure`

**Files:**
- Create: `src/components/Admin/AdminEditedFieldDisclosure.tsx`
- Test: `src/components/Admin/AdminEditedFieldDisclosure.test.tsx`

**Interfaces:**
- Produces: `<AdminEditedFieldDisclosure label={string} current={string} original={string} />` — renders nothing extra when `current === original`; consumed by Task 28.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AdminEditedFieldDisclosure from "./AdminEditedFieldDisclosure";

describe("AdminEditedFieldDisclosure", () => {
  it("renders no Edited chip or disclosure when current equals original", () => {
    render(<AdminEditedFieldDisclosure label="Venue" current="Havana Club" original="Havana Club" />);
    expect(screen.queryByText("Edited")).not.toBeInTheDocument();
  });

  it("renders an Edited chip and a collapsed disclosure when values differ", () => {
    render(<AdminEditedFieldDisclosure label="Venue" current="Havana Club" original="Havanna club" />);
    expect(screen.getByText("Edited")).toBeInTheDocument();
    const button = screen.getByRole("button", { expanded: false });
    fireEvent.click(button);
    expect(screen.getByText("Havanna club")).toBeInTheDocument();
  });

  it("labels original and updated values for assistive tech", () => {
    render(<AdminEditedFieldDisclosure label="Venue" current="Havana Club" original="Havanna club" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Original value:")).toHaveClass("admin-visually-hidden");
    expect(screen.getByText("Updated value:")).toHaveClass("admin-visually-hidden");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Admin/AdminEditedFieldDisclosure.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**

```tsx
import { useState } from "react";

export default function AdminEditedFieldDisclosure({
  label, current, original,
}: { label: string; current: string; original: string }) {
  const [open, setOpen] = useState(false);
  const isEdited = current !== original;

  return (
    <div className="admin-edited-field">
      <div className="admin-edited-field__row">
        <span className="admin-edited-field__label">{label}</span>
        {isEdited && (
          <button
            type="button"
            className="admin-chip admin-edited-field__toggle"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Edited ▾
          </button>
        )}
      </div>
      <p className="admin-edited-field__value">{current}</p>
      {isEdited && open && (
        <dl className="admin-edited-field__diff">
          <dt>
            <span className="admin-visually-hidden">Original value:</span>
          </dt>
          <dd>{original}</dd>
          <dt>
            <span className="admin-visually-hidden">Updated value:</span>
          </dt>
          <dd>{current}</dd>
        </dl>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add CSS** using existing `--admin-*` tokens for the disclosure border/indent (a `border-left` on the `<dl>` can stand in for the wireframe's `┌`/`└` connector notation — those box-drawing characters are wireframe-only notation, never literal markup).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminEditedFieldDisclosure.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminEditedFieldDisclosure.tsx src/components/Admin/AdminEditedFieldDisclosure.test.tsx src/styles/admin.css
git commit -m "feat: add AdminEditedFieldDisclosure for original-vs-edited field UX"
```

---

## Task 21: `AdminDuplicateCheckPanel`

**Files:**
- Create: `src/components/Admin/AdminDuplicateCheckPanel.tsx`
- Test: `src/components/Admin/AdminDuplicateCheckPanel.test.tsx`

**Interfaces:**
- Consumes: `DuplicateCandidate` (Task 7).
- Produces: `<AdminDuplicateCheckPanel candidates={DuplicateCandidate[]} onDismiss={(eventId) => void} onReject={(eventId) => void} />` — consumed by Task 28.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AdminDuplicateCheckPanel from "./AdminDuplicateCheckPanel";
import type { DuplicateCandidate } from "../../features/submissions/model/duplicates";
import type { DatabaseEvent } from "../../features/events/model/types";

function candidate(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return {
    event: { id: "evt-1", title: "Salsa Sundays at Havana Club" } as DatabaseEvent,
    signals: ["same-venue", "same-date", "similar-title"],
    confidence: "high",
    ...overrides,
  };
}

describe("AdminDuplicateCheckPanel", () => {
  it("renders nothing when there are no candidates", () => {
    const { container } = render(<AdminDuplicateCheckPanel candidates={[]} onDismiss={vi.fn()} onReject={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each signal as bullet text, never color-only", () => {
    render(<AdminDuplicateCheckPanel candidates={[candidate()]} onDismiss={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText("Same venue")).toBeInTheDocument();
    expect(screen.getByText("Same date")).toBeInTheDocument();
    expect(screen.getByText("Similar title")).toBeInTheDocument();
  });

  it("calls onDismiss with the event id when Not a Duplicate is clicked", () => {
    const onDismiss = vi.fn();
    render(<AdminDuplicateCheckPanel candidates={[candidate()]} onDismiss={onDismiss} onReject={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Not a Duplicate" }));
    expect(onDismiss).toHaveBeenCalledWith("evt-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Admin/AdminDuplicateCheckPanel.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**

```tsx
import { Link } from "react-router-dom";
import type { DuplicateCandidate, DuplicateSignal } from "../../features/submissions/model/duplicates";

const SIGNAL_LABEL: Record<DuplicateSignal, string> = {
  "same-venue": "Same venue", "same-date": "Same date",
  "similar-title": "Similar title", "same-organizer": "Same organizer",
};

export default function AdminDuplicateCheckPanel({
  candidates, onDismiss, onReject,
}: {
  candidates: DuplicateCandidate[];
  onDismiss: (eventId: string) => void;
  onReject: (eventId: string) => void;
}) {
  if (candidates.length === 0) return null;

  return (
    <section className="admin-duplicate-check">
      <h3>Duplicate Check</h3>
      {candidates.map(({ event, signals }) => (
        <div key={event.id} className="admin-duplicate-check__candidate">
          <p className="admin-duplicate-check__flag">⚠ Possible Duplicate</p>
          <p className="admin-duplicate-check__title">{event.title}</p>
          <ul>
            {signals.map((signal) => (
              <li key={signal}>{SIGNAL_LABEL[signal]}</li>
            ))}
          </ul>
          <div className="admin-duplicate-check__actions">
            <Link to={`/admin/events?edit=${event.id}`} className="admin-btn admin-btn--secondary">
              View Existing Event
            </Link>
            <button type="button" className="admin-btn admin-btn--secondary" onClick={() => onDismiss(event.id)}>
              Not a Duplicate
            </button>
            <button type="button" className="admin-btn admin-btn--danger" onClick={() => onReject(event.id)}>
              Reject as Duplicate
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Add CSS** reusing `--admin-danger`/`--admin-brand-tint`-style tokens for the warning flag, matching the existing warning-treatment pattern used elsewhere in admin components.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminDuplicateCheckPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminDuplicateCheckPanel.tsx src/components/Admin/AdminDuplicateCheckPanel.test.tsx src/styles/admin.css
git commit -m "feat: add AdminDuplicateCheckPanel"
```

---

## Task 22: `AdminVenueMatchPanel`

**Files:**
- Create: `src/components/Admin/AdminVenueMatchPanel.tsx`
- Test: `src/components/Admin/AdminVenueMatchPanel.test.tsx`

**Interfaces:**
- Consumes: `VenueMatch` (Task 8).
- Produces: `<AdminVenueMatchPanel match={VenueMatch} submittedLocation={string} submittedAddress={string | null} onUseExisting={() => void} />` — consumed by Task 28.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AdminVenueMatchPanel from "./AdminVenueMatchPanel";

describe("AdminVenueMatchPanel", () => {
  it("shows an informational exact-match message with no action button", () => {
    render(<AdminVenueMatchPanel match={{ kind: "exact", location: "havana club" }} submittedLocation="Havana Club" submittedAddress={null} onUseExisting={vi.fn()} />);
    expect(screen.getByText("Matches existing venue")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows Use Existing Venue for a fuzzy match and calls onUseExisting when clicked", () => {
    const onUseExisting = vi.fn();
    render(<AdminVenueMatchPanel match={{ kind: "fuzzy", location: "Havana Club", address: "288 Green St" }} submittedLocation="Havanna Club" submittedAddress="288 Green Street" onUseExisting={onUseExisting} />);
    fireEvent.click(screen.getByRole("button", { name: "Use Existing Venue" }));
    expect(onUseExisting).toHaveBeenCalled();
  });

  it("shows the honest no-create-button message when there is no match", () => {
    render(<AdminVenueMatchPanel match={{ kind: "none" }} submittedLocation="New Place" submittedAddress={null} onUseExisting={vi.fn()} />);
    expect(screen.getByText("New venue — will be recorded as free text.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Admin/AdminVenueMatchPanel.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**

```tsx
import type { VenueMatch } from "../../features/submissions/model/venueMatching";

export default function AdminVenueMatchPanel({
  match, submittedLocation, submittedAddress, onUseExisting,
}: {
  match: VenueMatch;
  submittedLocation: string;
  submittedAddress: string | null;
  onUseExisting: () => void;
}) {
  if (match.kind === "exact") {
    return <p className="admin-venue-match admin-venue-match--exact">✓ Matches existing venue</p>;
  }

  if (match.kind === "fuzzy") {
    return (
      <div className="admin-venue-match admin-venue-match--fuzzy">
        <dl>
          <dt>Submitted:</dt>
          <dd>{submittedLocation}{submittedAddress ? ` — ${submittedAddress}` : ""}</dd>
          <dt>Existing venue:</dt>
          <dd>{match.location}{match.address ? ` — ${match.address}` : ""}</dd>
        </dl>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={onUseExisting}>
          Use Existing Venue
        </button>
      </div>
    );
  }

  return <p className="admin-venue-match admin-venue-match--none">New venue — will be recorded as free text.</p>;
}
```

- [ ] **Step 4: Add CSS** reusing existing token set.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminVenueMatchPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminVenueMatchPanel.tsx src/components/Admin/AdminVenueMatchPanel.test.tsx src/styles/admin.css
git commit -m "feat: add AdminVenueMatchPanel"
```

---

## Task 23: `AdminSubmissionQualityPanel`

**Files:**
- Create: `src/components/Admin/AdminSubmissionQualityPanel.tsx`
- Test: `src/components/Admin/AdminSubmissionQualityPanel.test.tsx`

**Interfaces:**
- Consumes: `SubmissionQualityIssue`, `QUALITY_TIER`, `SUBMISSION_QUALITY_LABEL` (Task 6), all 11 possible check keys (a fixed checklist, not just the failing ones — the design doc's wireframe shows ✓ for passing checks too).

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AdminSubmissionQualityPanel from "./AdminSubmissionQualityPanel";

describe("AdminSubmissionQualityPanel", () => {
  it("renders a check for every tracked field, complete ones marked passing", () => {
    render(<AdminSubmissionQualityPanel issues={["location"]} />);
    expect(screen.getByText("Complete: Event name")).toHaveClass("admin-visually-hidden");
    expect(screen.getByText("Recommended: Venue not matched")).toHaveClass("admin-visually-hidden");
  });

  it("never renders a numeric score", () => {
    render(<AdminSubmissionQualityPanel issues={[]} />);
    expect(screen.queryByText(/%|\/\d+/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Admin/AdminSubmissionQualityPanel.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**

```tsx
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { QUALITY_TIER, SUBMISSION_QUALITY_LABEL, type SubmissionQualityIssue } from "../../features/submissions/model/quality";

const ALL_CHECKS: SubmissionQualityIssue[] = [
  "title", "event_date", "city", "event_type",
  "location", "event_time", "description",
  "image_url", "host", "price_type", "dance_styles",
];

const TIER_PREFIX: Record<"required" | "recommended", string> = {
  required: "Required", recommended: "Recommended",
};

export default function AdminSubmissionQualityPanel({ issues }: { issues: SubmissionQualityIssue[] }) {
  return (
    <section className="admin-submission-quality">
      <h3>Quality</h3>
      <ul>
        {ALL_CHECKS.map((check) => {
          const failing = issues.includes(check);
          const tier = QUALITY_TIER[check];
          const label = SUBMISSION_QUALITY_LABEL[check];
          const Icon = !failing ? CheckCircle2 : tier === "required" ? XCircle : AlertTriangle;
          const prefix = !failing ? "Complete" : TIER_PREFIX[tier as "required" | "recommended"] ?? "Optional";
          return (
            <li key={check} className={!failing ? "admin-submission-quality__ok" : `admin-submission-quality__${tier}`}>
              <Icon size={14} aria-hidden="true" />
              <span className="admin-visually-hidden">{`${prefix}: ${label}`}</span>
              <span aria-hidden="true">{label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Add CSS** using existing status tint tokens for required (danger), recommended (warning/brand), ok (success) — grep `admin.css` for the existing success/warning token names before inventing new ones.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminSubmissionQualityPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminSubmissionQualityPanel.tsx src/components/Admin/AdminSubmissionQualityPanel.test.tsx src/styles/admin.css
git commit -m "feat: add AdminSubmissionQualityPanel"
```

---

## Task 24: `AdminRejectSubmissionDialog`

**Files:**
- Create: `src/components/Admin/AdminRejectSubmissionDialog.tsx`
- Test: `src/components/Admin/AdminRejectSubmissionDialog.test.tsx`

**Interfaces:**
- Consumes: `RejectionReason`, `REJECTION_REASON_LABEL` (Task 4), the existing `useEscapeKey` hook (already used by `AdminConfirmDialog`/`AdminFlagUserDialog` — reuse verbatim, do not reimplement).
- Produces: `<AdminRejectSubmissionDialog title={string} isBusy={boolean} error={string | null} onConfirm={(input: { reason: RejectionReason; message: string | null; internalNote: string | null }) => void} onCancel={() => void} />` — consumed by Task 28.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AdminRejectSubmissionDialog from "./AdminRejectSubmissionDialog";

describe("AdminRejectSubmissionDialog", () => {
  it("focuses the reason select on mount", () => {
    render(<AdminRejectSubmissionDialog title="Reject x?" isBusy={false} error={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Reason for rejection *")).toHaveFocus();
  });

  it("requires the internal note when reason is Other", () => {
    const onConfirm = vi.fn();
    render(<AdminRejectSubmissionDialog title="Reject x?" isBusy={false} error={null} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Reason for rejection *"), { target: { value: "other" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Internal note is required when reason is Other.")).toBeInTheDocument();
  });

  it("submits reason, message, and internal note as three separate fields", () => {
    const onConfirm = vi.fn();
    render(<AdminRejectSubmissionDialog title="Reject x?" isBusy={false} error={null} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Reason for rejection *"), { target: { value: "missing_information" } });
    fireEvent.change(screen.getByLabelText("Message to submitter"), { target: { value: "Please add a venue." } });
    fireEvent.change(screen.getByLabelText("Internal moderator note"), { target: { value: "Looks like spam-adjacent." } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onConfirm).toHaveBeenCalledWith({
      reason: "missing_information", message: "Please add a venue.", internalNote: "Looks like spam-adjacent.",
    });
  });

  it("keeps message and internal note in visually separate containers", () => {
    render(<AdminRejectSubmissionDialog title="Reject x?" isBusy={false} error={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const messageField = screen.getByLabelText("Message to submitter").closest("div");
    const noteField = screen.getByLabelText("Internal moderator note").closest("div");
    expect(messageField).not.toBe(noteField);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Admin/AdminRejectSubmissionDialog.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**, following `AdminFlagUserDialog.tsx`'s exact focus-on-select-mount + `notesRequired`-when-Other pattern, but with THREE independent fields instead of one combined string:

```tsx
import { useEffect, useRef, useState } from "react";
import { REJECTION_REASON_LABEL, type RejectionReason } from "../../features/submissions/model/types";
import { useEscapeKey } from "../../hooks/useEscapeKey";

const REASONS = Object.keys(REJECTION_REASON_LABEL) as RejectionReason[];

export default function AdminRejectSubmissionDialog({
  title, isBusy, error, onConfirm, onCancel,
}: {
  title: string;
  isBusy: boolean;
  error: string | null;
  onConfirm: (input: { reason: RejectionReason; message: string | null; internalNote: string | null }) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<RejectionReason>("missing_information");
  const [message, setMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [showNoteRequiredError, setShowNoteRequiredError] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const titleId = "admin-reject-submission-title";

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    selectRef.current?.focus();
    return () => {
      if (previouslyFocusedRef.current instanceof HTMLElement) previouslyFocusedRef.current.focus();
    };
  }, []);

  useEscapeKey(onCancel);

  const notesRequired = reason === "other";

  function handleConfirm() {
    const trimmedNote = internalNote.trim();
    if (notesRequired && trimmedNote === "") {
      setShowNoteRequiredError(true);
      return;
    }
    onConfirm({
      reason,
      message: message.trim() === "" ? null : message.trim(),
      internalNote: trimmedNote === "" ? null : trimmedNote,
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="admin-dialog">
      <h2 id={titleId}>{title}</h2>

      <div className="admin-field">
        <label htmlFor="reject-reason">Reason for rejection *</label>
        <select
          id="reject-reason"
          ref={selectRef}
          value={reason}
          onChange={(e) => setReason(e.target.value as RejectionReason)}
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>{REJECTION_REASON_LABEL[r]}</option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor="reject-message">Message to submitter</label>
        <textarea id="reject-message" value={message} onChange={(e) => setMessage(e.target.value)} />
        <p className="admin-field__hint">Shared with the submitter.</p>
      </div>

      <div className="admin-field admin-field--internal">
        <label htmlFor="reject-internal-note">Internal moderator note</label>
        <textarea
          id="reject-internal-note"
          value={internalNote}
          onChange={(e) => { setInternalNote(e.target.value); setShowNoteRequiredError(false); }}
        />
        <p className="admin-field__hint">Only visible to moderators and admins. Never shown to the submitter.</p>
        {showNoteRequiredError && (
          <p role="alert">Internal note is required when reason is Other.</p>
        )}
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="admin-dialog__actions">
        <button type="button" className="admin-btn admin-btn--ghost" onClick={onCancel} disabled={isBusy}>
          Cancel
        </button>
        <button type="button" className="admin-btn admin-btn--danger" onClick={handleConfirm} disabled={isBusy}>
          {isBusy ? "Working…" : "Reject"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add CSS** for `.admin-field--internal` visually separating it from `.admin-field` (border-top or distinct background using an existing subtle-surface token — grep for the pattern already used to separate sections within `AdminFlagUserDialog`'s stylesheet).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminRejectSubmissionDialog.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/AdminRejectSubmissionDialog.tsx src/components/Admin/AdminRejectSubmissionDialog.test.tsx src/styles/admin.css
git commit -m "feat: add AdminRejectSubmissionDialog with separated submitter/internal fields"
```

---

## Task 25: `useAdminSubmissions` hook

**Files:**
- Create: `src/hooks/useAdminSubmissions.ts`
- Test: `src/hooks/useAdminSubmissions.test.ts`

**Interfaces:**
- Consumes: every `submissionsRepo.ts` function (Task 10).
- Produces: `useAdminSubmissions()` returning `{ submissions, isLoading, error, refetch, approve, reject, saveEdits, reopen, dismissDuplicate, approvingId, approveError, rejectingId, rejectError }` (mirrors `useAdminUsers`/`useAdminEvents`'s per-id busy/error tracking convention) — consumed by Tasks 26, 28.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("../features/submissions/api/submissionsRepo", () => ({
  fetchAllSubmissions: vi.fn(() => Promise.resolve([{ id: "sub-1", status: "pending" }])),
  approveSubmission: vi.fn(() => Promise.resolve({ eventId: "evt-1" })),
  rejectSubmission: vi.fn(() => Promise.resolve()),
  saveEdits: vi.fn(() => Promise.resolve()),
  reopenSubmission: vi.fn(() => Promise.resolve()),
  dismissDuplicate: vi.fn(() => Promise.resolve()),
}));

import { useAdminSubmissions } from "./useAdminSubmissions";
import { approveSubmission } from "../features/submissions/api/submissionsRepo";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("useAdminSubmissions", () => {
  it("loads submissions and exposes an approve mutation keyed by id", async () => {
    const { result } = renderHook(() => useAdminSubmissions(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.submissions).toHaveLength(1);

    await act(async () => {
      await result.current.approve({ id: "sub-1", reviewerId: "admin-1" });
    });
    expect(approveSubmission).toHaveBeenCalledWith("sub-1", "admin-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useAdminSubmissions.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**, following the id-keyed mutation pattern established by `useAdminUsers`/`useAdminEvents` (per AdminUiScout's finding on `changingStatusId`/`settingStatusId` conventions):

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchAllSubmissions, approveSubmission, rejectSubmission, saveEdits,
  reopenSubmission, dismissDuplicate,
} from "../features/submissions/api/submissionsRepo";
import type { RejectionReason } from "../features/submissions/model/types";
import type { SubmittedEventData } from "../features/submissions/model/types";

const QUERY_KEY = ["admin", "submissions"];

export function useAdminSubmissions() {
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveErrorId, setApproveErrorId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectErrorId, setRejectErrorId] = useState<string | null>(null);

  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAllSubmissions });

  const approveMutation = useMutation({
    mutationFn: ({ id, reviewerId }: { id: string; reviewerId: string }) => {
      setApprovingId(id);
      setApproveErrorId(null);
      return approveSubmission(id, reviewerId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (_err, vars) => setApproveErrorId(vars.id),
    onSettled: () => setApprovingId(null),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reviewerId, input }: {
      id: string; reviewerId: string;
      input: { reason: RejectionReason; message: string | null; internalNote: string | null };
    }) => {
      setRejectingId(id);
      setRejectErrorId(null);
      return rejectSubmission(id, reviewerId, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (_err, vars) => setRejectErrorId(vars.id),
    onSettled: () => setRejectingId(null),
  });

  const saveEditsMutation = useMutation({
    mutationFn: ({ id, edited }: { id: string; edited: Partial<SubmittedEventData> }) => saveEdits(id, edited),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenSubmission(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const dismissDuplicateMutation = useMutation({
    mutationFn: ({ id, eventId, currentDismissed }: { id: string; eventId: string; currentDismissed: string[] }) =>
      dismissDuplicate(id, eventId, currentDismissed),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    submissions: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
    approve: approveMutation.mutateAsync,
    approvingId,
    approveError: approveErrorId ? approveMutation.error?.message ?? null : null,
    reject: rejectMutation.mutateAsync,
    rejectingId,
    rejectError: rejectErrorId ? rejectMutation.error?.message ?? null : null,
    saveEdits: saveEditsMutation.mutateAsync,
    reopen: reopenMutation.mutateAsync,
    dismissDuplicate: dismissDuplicateMutation.mutateAsync,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useAdminSubmissions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAdminSubmissions.ts src/hooks/useAdminSubmissions.test.ts
git commit -m "feat: add useAdminSubmissions hook with id-keyed mutations"
```

---

**Continue in `docs/superpowers/plans/2026-08-12-phase7-event-submission-review-part2.md` for Tasks 26–33** (queue table/page, review detail page, routing/shell wiring, moderator auth widening, and final verification).

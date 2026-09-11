-- ============================================================================
-- Event Submission Email Notifications — 003: post-migration verification
-- ============================================================================
--
-- PURPOSE
--   Read-only verification that 001 and 002 landed as intended. Run after
--   applying them. Every query is a SELECT — nothing here modifies data.
--
-- EXECUTION ORDER
--   1. 001_email_delivery_attempts.sql                      — required
--   2. 002_anon_submitter_contact_required.sql              — recommended
--   3. THIS FILE (003_postcheck.sql)                        — verification
--
-- Expected results are stated above each query.
-- ============================================================================

-- ── 1. Attempts table exists with the expected columns ──────────────────────
-- Expect: 11 rows, all `exists = t`.
select
  col,
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'event_submission_email_attempts'
       and column_name  = col
  ) as exists
from (values
  ('id'), ('submission_id'), ('email_event'), ('status'), ('recipient_kind'),
  ('provider'), ('provider_message_id'), ('error_code'),
  ('claimed_at'), ('completed_at'), ('created_at')
) as v(col)
order by col;

-- ── 2. The idempotency guard is the partial unique index ────────────────────
-- Expect: exactly 1 row. indexdef MUST contain `UNIQUE` and a WHERE clause
-- restricting to status pending/sent. The 'failed' exclusion is what allows a
-- deliberate retry after a failure while keeping a success permanently
-- deduplicated.
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename  = 'event_submission_email_attempts'
   and indexname  = 'event_submission_email_attempts_active_key';

-- ── 3. Completion constraint present ────────────────────────────────────────
-- Expect: 1 row. A 'sent' attempt must carry a provider_message_id; a
-- 'failed' attempt must carry an error_code; a 'pending' attempt neither.
select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.event_submission_email_attempts'::regclass
   and conname  = 'event_submission_email_attempts_completion_check';

-- ── 4. RLS enabled, moderator-read-only ────────────────────────────────────
-- Expect: rls_enabled = t, and exactly one SELECT policy for `authenticated`
-- using is_moderator(). There must be NO insert/update/delete policy — the
-- Edge Function writes with the service role, which bypasses RLS.
select relrowsecurity as rls_enabled
  from pg_class
 where oid = 'public.event_submission_email_attempts'::regclass;

select policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename  = 'event_submission_email_attempts'
 order by policyname;

-- ── 5. Claim/completion functions exist and are service-role only ──────────
-- Expect: 2 rows, both `security_definer = t`, both with an explicit
-- search_path in proconfig.
--
-- CRITICAL on acl: service_role MUST appear with EXECUTE. `service_role`
-- bypasses RLS but NOT function EXECUTE ACLs, so revoking the default PUBLIC
-- grant without an explicit service_role grant would lock the Edge Function
-- out (it would get 503 on every send). `anon` and `authenticated` MUST NOT
-- appear.
select
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig,
  pg_catalog.array_to_string(p.proacl, E'\n') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'claim_submission_email_attempt',
    'complete_submission_email_attempt'
  )
order by p.proname;

-- ── 6. Anonymous insert policy: contact rule ADDED, gate PRESERVED ─────────
-- Expect: 1 row. with_check MUST contain ALL FOUR of:
--     public_event_suggestions_enabled   <- the owner's master switch
--     status = 'pending'
--     submitter_id IS NULL
--     anon_submitter_contact_is_valid    <- added by file 002
--
-- If public_event_suggestions_enabled is MISSING, stop and re-apply file 002:
-- anonymous inserts would still be accepted after the owner disables public
-- suggestions in /admin/settings.
-- If anon_submitter_contact_is_valid is missing, file 002 was not applied.
select
  policyname,
  cmd,
  roles,
  with_check,
  with_check::text like '%public_event_suggestions_enabled%' as gate_preserved,
  with_check::text like '%anon_submitter_contact_is_valid%'  as contact_rule_present
from pg_policies
 where schemaname = 'public'
   and tablename  = 'event_submissions'
   and policyname = 'Anon can submit';

-- ── 7. Contact rule is a BEFORE INSERT trigger, not a CHECK ────────────────
-- Expect: 1 trigger row with action_timing = 'BEFORE' and
-- event_manipulation = 'INSERT' only.
--
-- Expect the CHECK query to return ZERO rows. A CHECK constraint here would
-- be a bug: NOT VALID only skips the initial scan, and PostgreSQL still
-- enforces a CHECK on every later UPDATE — which would make legacy anonymous
-- rows with no email impossible to approve or reject.
select trigger_name, action_timing, event_manipulation
  from information_schema.triggers
 where event_object_schema = 'public'
   and event_object_table  = 'event_submissions'
   and trigger_name        = 'event_submissions_require_anon_contact';

select conname, convalidated, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.event_submissions'::regclass
   and pg_get_constraintdef(oid) ilike '%submitter_email%';

-- ── 8. PROOF that legacy rows stay moderatable ─────────────────────────────
-- The safety claim in file 002 is that a historical anonymous row with no
-- contact details can still be approved/rejected. Verify it rather than
-- trusting it. Runs inside a transaction that is ROLLED BACK, so nothing is
-- actually modified.
--
-- Expect: `legacy_update_succeeded = t`. If it errors with 23514, a CHECK
-- constraint slipped in and the review queue is broken for legacy rows.
--
--   begin;
--     insert into public.event_submissions
--       (submitter_id, submitter_email, submitter_name, status, submitted_data)
--     values
--       (null, null, null, 'pending', '{"title":"postcheck legacy row"}'::jsonb);
--     -- ^ This insert FAILS once file 002 is applied, which is the point of
--     --   the trigger. To exercise the UPDATE path against a genuine legacy
--     --   row, disable the trigger for this transaction only:
--   rollback;
--
--   begin;
--     alter table public.event_submissions disable trigger
--       event_submissions_require_anon_contact;
--     insert into public.event_submissions
--       (id, submitter_id, submitter_email, submitter_name, status, submitted_data)
--     values
--       ('00000000-0000-4000-8000-0000000000ff', null, null, null, 'pending',
--        '{"title":"postcheck legacy row"}'::jsonb);
--     alter table public.event_submissions enable trigger
--       event_submissions_require_anon_contact;
--
--     -- The real assertion: moderating a null-contact legacy row still works.
--     update public.event_submissions
--        set status = 'rejected',
--            rejection_reason = 'other',
--            reviewed_at = now()
--      where id = '00000000-0000-4000-8000-0000000000ff';
--
--     select count(*) = 1 as legacy_update_succeeded
--       from public.event_submissions
--      where id = '00000000-0000-4000-8000-0000000000ff'
--        and status = 'rejected';
--   rollback;

-- ── 9. Historical rows that can never be emailed ───────────────────────────
-- Informational. These rows predate file 002 and are deliberately left
-- alone. `still_pending` is the actionable number: those submissions are in
-- the queue but their submitter cannot be notified of the outcome.
select
  count(*)                                    as anon_rows_without_contact,
  count(*) filter (where status = 'pending')  as still_pending,
  count(*) filter (where status = 'approved') as already_approved,
  count(*) filter (where status = 'rejected') as already_rejected
from public.event_submissions
where submitter_id is null
  and (
    coalesce(btrim(submitter_email), '') = ''
    or coalesce(btrim(submitter_name), '') = ''
  );

-- ── 10. Operational: email delivery health ─────────────────────────────────
-- Run any time. Zero rows before the first submission is expected.
select
  email_event,
  status,
  count(*) as attempts,
  max(created_at) as most_recent
from public.event_submission_email_attempts
group by email_event, status
order by email_event, status;

-- ── 11. Operational: failures needing attention ────────────────────────────
-- Expect: zero rows in a healthy system. `no_recipient` means the submission
-- had no submitter_email (a pre-002 row); anything else is a provider or
-- network problem. The submission itself is unaffected either way.
select
  a.submission_id,
  a.email_event,
  a.error_code,
  a.created_at,
  s.status as submission_status
from public.event_submission_email_attempts a
join public.event_submissions s on s.id = a.submission_id
where a.status = 'failed'
order by a.created_at desc
limit 50;

-- ── 12. Operational: stale claims ──────────────────────────────────────────
-- Expect: zero rows. A 'pending' attempt older than a few minutes means an
-- Edge Function instance died mid-send. claim_submission_email_attempt()
-- reclaims these automatically after 5 minutes, so this is diagnostic only.
select id, submission_id, email_event, claimed_at
  from public.event_submission_email_attempts
 where status = 'pending'
   and claimed_at < now() - interval '5 minutes'
 order by claimed_at;

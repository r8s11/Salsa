-- =====================================================================
-- Founder Request Applicant Confirmation — regression tests
-- =====================================================================
--
-- PURPOSE
--   Executable proof that
--   20260907000000_founder_request_applicant_confirmation.sql behaves as
--   documented. Pure SQL — one `begin; ... rollback;` transaction, each
--   test a `do $$ ... $$;` block that RAISES AN EXCEPTION on assertion
--   failure. No psql meta-commands (`\gset`, `\set`, `\g...`) anywhere,
--   so this runs unmodified through ANY Postgres client capable of
--   executing a plain `.sql` script — `psql -f`, a Bun `postgres`/`pg`
--   client, TablePlus, DBeaver, the Supabase SQL editor, etc.
--
--   A clean run prints one `NOTICE:  PASS ...` line per test and ends
--   with `ROLLBACK` — nothing here leaves residual data, even though
--   every test performs real inserts/updates against the real tables.
--   A FAILING assertion aborts the whole script with a thrown error
--   (non-zero exit for any driver that checks it) instead of silently
--   printing a wrong boolean, so this is CI-safe: "the script exited 0"
--   is the pass/fail signal, not eyeballing SELECT output.
--
--   NEVER run against production — even though every write is rolled
--   back, this is a local/staging verification script, not an
--   operational query.
--
-- EXECUTION ORDER
--   1. 20260904000000_founder_request_admin_notifications.sql — required
--   2. 20260907000000_founder_request_applicant_confirmation.sql — required
--   3. THIS FILE — verification
--
-- HOW TO RUN
--   psql:
--     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--       -v ON_ERROR_STOP=1 \
--       -f sql/2026-09-07-founder-request-applicant-confirmation-regression.sql
--
--   Bun (no CLI dependency):
--     bun -e '
--       const sql = new (await import("bun")).SQL("postgresql://postgres:postgres@127.0.0.1:54322/postgres");
--       await sql.file("sql/2026-09-07-founder-request-applicant-confirmation-regression.sql");
--       console.log("regression script completed without error");
--       process.exit(0);
--     '
--   (Bun.SQL executes a multi-statement file as one batch; a RAISE
--   EXCEPTION anywhere rejects the promise — catch it to see which
--   assertion failed.)
-- =====================================================================

begin;

-- ── Test 1: the two purposes claim independently for the same request ──────
do $$
declare
  v_request_id      uuid;
  v_admin_attempt    uuid;
  v_confirm_attempt  uuid;
begin
  insert into public.founder_access_requests
    (applicant_name, email, normalized_email, organization_name, normalized_org_name, status)
  values
    ('Regression Applicant', 'regress1@example.com', 'regress1@example.com',
     'Regression Org', 'regression org', 'pending')
  returning id into v_request_id;

  v_admin_attempt   := public.claim_founder_request_notification_attempt(v_request_id, 'admin_request_notification');
  v_confirm_attempt := public.claim_founder_request_notification_attempt(v_request_id, 'applicant_confirmation');

  if v_admin_attempt is null or v_confirm_attempt is null then
    raise exception 'test1 FAILED: expected both purposes to claim independently (admin=%, confirm=%)',
      v_admin_attempt, v_confirm_attempt;
  end if;
  if v_admin_attempt = v_confirm_attempt then
    raise exception 'test1 FAILED: the two purposes were assigned the same attempt row';
  end if;

  raise notice 'PASS test1: admin_request_notification and applicant_confirmation claim independently for one request';
end $$;

-- ── Test 2: a second claim for the same (request, purpose) is refused ──────
do $$
declare
  v_request_id   uuid;
  v_first_claim  uuid;
  v_second_claim uuid;
begin
  insert into public.founder_access_requests
    (applicant_name, email, normalized_email, organization_name, normalized_org_name, status)
  values
    ('Regression Applicant', 'regress2@example.com', 'regress2@example.com',
     'Regression Org', 'regression org', 'pending')
  returning id into v_request_id;

  v_first_claim  := public.claim_founder_request_notification_attempt(v_request_id, 'applicant_confirmation');
  v_second_claim := public.claim_founder_request_notification_attempt(v_request_id, 'applicant_confirmation');

  if v_first_claim is null then
    raise exception 'test2 FAILED: the first claim for a fresh (request, purpose) must succeed';
  end if;
  if v_second_claim is not null then
    raise exception 'test2 FAILED: a duplicate claim while the first is pending must return NULL, got %', v_second_claim;
  end if;

  raise notice 'PASS test2: a duplicate claim for a still-pending (request, purpose) is refused';
end $$;

-- ── Test 3: completion rejects a request_id/email_event mismatch ───────────
do $$
declare
  v_request_id       uuid;
  v_other_request_id uuid;
  v_attempt_id       uuid;
begin
  insert into public.founder_access_requests
    (applicant_name, email, normalized_email, organization_name, normalized_org_name, status)
  values
    ('Regression Applicant', 'regress3@example.com', 'regress3@example.com',
     'Regression Org', 'regression org', 'pending')
  returning id into v_request_id;

  insert into public.founder_access_requests
    (applicant_name, email, normalized_email, organization_name, normalized_org_name, status)
  values
    ('Other Applicant', 'regress3b@example.com', 'regress3b@example.com',
     'Other Org', 'other org', 'pending')
  returning id into v_other_request_id;

  v_attempt_id := public.claim_founder_request_notification_attempt(v_request_id, 'applicant_confirmation');
  if v_attempt_id is null then
    raise exception 'test3 FAILED: setup claim did not succeed';
  end if;

  -- Wrong request_id (a different, real request):
  if public.complete_founder_request_notification_attempt(
       v_attempt_id, v_other_request_id, 'applicant_confirmation', 'sent', 'resend-msg-id', null
     ) then
    raise exception 'test3 FAILED: completion with the WRONG request_id must return false';
  end if;

  -- Wrong email_event (correct request_id, wrong purpose):
  if public.complete_founder_request_notification_attempt(
       v_attempt_id, v_request_id, 'admin_request_notification', 'sent', 'resend-msg-id', null
     ) then
    raise exception 'test3 FAILED: completion with the WRONG email_event must return false';
  end if;

  -- Neither mismatched call may have touched the row:
  if exists (
    select 1 from public.founder_request_notification_attempts
     where id = v_attempt_id and (status <> 'pending' or completed_at is not null)
  ) then
    raise exception 'test3 FAILED: a mismatched completion call mutated the attempt row';
  end if;

  -- The correctly-bound completion now succeeds:
  if not public.complete_founder_request_notification_attempt(
       v_attempt_id, v_request_id, 'applicant_confirmation', 'sent', 'resend-msg-id', null
     ) then
    raise exception 'test3 FAILED: the correctly-bound completion call must return true';
  end if;

  if not exists (
    select 1 from public.founder_request_notification_attempts
     where id = v_attempt_id and status = 'sent' and provider_message_id = 'resend-msg-id'
  ) then
    raise exception 'test3 FAILED: the attempt was not recorded as sent after the correctly-bound completion';
  end if;

  raise notice 'PASS test3: completion rejects a request_id/email_event mismatch and accepts the correctly-bound call';
end $$;

-- ── Test 4: double completion of an already-settled attempt is refused ─────
do $$
declare
  v_request_id uuid;
  v_attempt_id uuid;
begin
  insert into public.founder_access_requests
    (applicant_name, email, normalized_email, organization_name, normalized_org_name, status)
  values
    ('Regression Applicant', 'regress4@example.com', 'regress4@example.com',
     'Regression Org', 'regression org', 'pending')
  returning id into v_request_id;

  v_attempt_id := public.claim_founder_request_notification_attempt(v_request_id, 'applicant_confirmation');

  if not public.complete_founder_request_notification_attempt(
       v_attempt_id, v_request_id, 'applicant_confirmation', 'sent', 'resend-msg-id-1', null
     ) then
    raise exception 'test4 FAILED: the first completion call must succeed';
  end if;

  -- A second completion of the same already-'sent' attempt — even with a
  -- perfectly matching id/request/purpose — must be refused: only a
  -- 'pending' row can ever be completed, so a settled attempt can never be
  -- silently rewritten (e.g. by a slow retry racing a faster success).
  if public.complete_founder_request_notification_attempt(
       v_attempt_id, v_request_id, 'applicant_confirmation', 'sent', 'resend-msg-id-2', null
     ) then
    raise exception 'test4 FAILED: completing an already-sent attempt a second time must return false';
  end if;

  if not exists (
    select 1 from public.founder_request_notification_attempts
     where id = v_attempt_id and provider_message_id = 'resend-msg-id-1'
  ) then
    raise exception 'test4 FAILED: the second completion call overwrote the first''s provider_message_id';
  end if;

  raise notice 'PASS test4: a settled attempt cannot be completed a second time';
end $$;

-- ── Test 5: a permanently-sent claim is never reclaimable, a failed one is ─
do $$
declare
  v_request_id  uuid;
  v_sent_claim  uuid;
  v_reclaim     uuid;
  v_failed_claim uuid;
  v_retry_claim  uuid;
begin
  insert into public.founder_access_requests
    (applicant_name, email, normalized_email, organization_name, normalized_org_name, status)
  values
    ('Regression Applicant', 'regress5@example.com', 'regress5@example.com',
     'Regression Org', 'regression org', 'pending')
  returning id into v_request_id;

  -- 'sent' rows stay in the unique partial index forever: no reclaim, ever.
  v_sent_claim := public.claim_founder_request_notification_attempt(v_request_id, 'admin_request_notification');
  perform public.complete_founder_request_notification_attempt(
    v_sent_claim, v_request_id, 'admin_request_notification', 'sent', 'resend-msg-id', null
  );
  v_reclaim := public.claim_founder_request_notification_attempt(v_request_id, 'admin_request_notification');
  if v_reclaim is not null then
    raise exception 'test5 FAILED: claiming after a permanent success must return NULL, got %', v_reclaim;
  end if;

  -- 'failed' rows fall OUT of the unique partial index: a genuine retry
  -- must be able to claim again, as a fresh (distinct) attempt row.
  v_failed_claim := public.claim_founder_request_notification_attempt(v_request_id, 'applicant_confirmation');
  perform public.complete_founder_request_notification_attempt(
    v_failed_claim, v_request_id, 'applicant_confirmation', 'failed', null, 'provider_error'
  );
  v_retry_claim := public.claim_founder_request_notification_attempt(v_request_id, 'applicant_confirmation');
  if v_retry_claim is null then
    raise exception 'test5 FAILED: claiming after a failure must succeed (retry allowed)';
  end if;
  if v_retry_claim = v_failed_claim then
    raise exception 'test5 FAILED: a retry after failure must be a distinct attempt row, not the same one';
  end if;

  raise notice 'PASS test5: a sent claim is never reclaimable; a failed claim is retryable as a new row';
end $$;

-- ── Test 6: a stale pending claim is reclaimable; a fresh one is not ───────
do $$
declare
  v_request_id       uuid;
  v_original_attempt uuid;
  v_reclaimed        uuid;
  v_immediate_retry  uuid;
begin
  insert into public.founder_access_requests
    (applicant_name, email, normalized_email, organization_name, normalized_org_name, status)
  values
    ('Regression Applicant', 'regress6@example.com', 'regress6@example.com',
     'Regression Org', 'regression org', 'pending')
  returning id into v_request_id;

  v_original_attempt := public.claim_founder_request_notification_attempt(v_request_id, 'applicant_confirmation');

  update public.founder_request_notification_attempts
     set claimed_at = now() - interval '10 minutes'
   where id = v_original_attempt;

  v_reclaimed := public.claim_founder_request_notification_attempt(
    v_request_id, 'applicant_confirmation', interval '5 minutes'
  );
  if v_reclaimed is distinct from v_original_attempt then
    raise exception 'test6 FAILED: a stale claim must be reclaimed as the SAME row, got % (expected %)',
      v_reclaimed, v_original_attempt;
  end if;

  -- The reclaim above just reset claimed_at to now() — immediately calling
  -- claim again, well inside the 5-minute window, must NOT reclaim it.
  v_immediate_retry := public.claim_founder_request_notification_attempt(
    v_request_id, 'applicant_confirmation', interval '5 minutes'
  );
  if v_immediate_retry is not null then
    raise exception 'test6 FAILED: a freshly (re)claimed pending row must not be reclaimable again immediately, got %',
      v_immediate_retry;
  end if;

  raise notice 'PASS test6: a stale pending claim is reclaimed as the same row; a fresh claim is not';
end $$;

-- ── Test 7: neither RPC is executable by anon or authenticated ─────────────
do $$
declare
  v_request_id uuid;
  v_attempt_id uuid;
  v_caught     boolean;
begin
  insert into public.founder_access_requests
    (applicant_name, email, normalized_email, organization_name, normalized_org_name, status)
  values
    ('Regression Applicant', 'regress7@example.com', 'regress7@example.com',
     'Regression Org', 'regression org', 'pending')
  returning id into v_request_id;

  -- A service_role-held attempt id to try (and fail) to complete below.
  v_attempt_id := public.claim_founder_request_notification_attempt(v_request_id, 'admin_request_notification');

  -- anon: claim
  v_caught := false;
  set local role anon;
  begin
    perform public.claim_founder_request_notification_attempt(v_request_id, 'applicant_confirmation');
  exception when insufficient_privilege then
    v_caught := true;
  end;
  reset role;
  if not v_caught then
    raise exception 'test7 FAILED: anon must not be able to execute claim_founder_request_notification_attempt';
  end if;

  -- anon: complete
  v_caught := false;
  set local role anon;
  begin
    perform public.complete_founder_request_notification_attempt(
      v_attempt_id, v_request_id, 'admin_request_notification', 'sent', 'resend-msg-id', null
    );
  exception when insufficient_privilege then
    v_caught := true;
  end;
  reset role;
  if not v_caught then
    raise exception 'test7 FAILED: anon must not be able to execute complete_founder_request_notification_attempt';
  end if;

  -- authenticated: claim
  v_caught := false;
  set local role authenticated;
  begin
    perform public.claim_founder_request_notification_attempt(v_request_id, 'applicant_confirmation');
  exception when insufficient_privilege then
    v_caught := true;
  end;
  reset role;
  if not v_caught then
    raise exception 'test7 FAILED: authenticated must not be able to execute claim_founder_request_notification_attempt';
  end if;

  -- authenticated: complete
  v_caught := false;
  set local role authenticated;
  begin
    perform public.complete_founder_request_notification_attempt(
      v_attempt_id, v_request_id, 'admin_request_notification', 'sent', 'resend-msg-id', null
    );
  exception when insufficient_privilege then
    v_caught := true;
  end;
  reset role;
  if not v_caught then
    raise exception 'test7 FAILED: authenticated must not be able to execute complete_founder_request_notification_attempt';
  end if;

  -- Prove the attempt used above is genuinely still untouched by any of the
  -- four rejected calls (permission checks happen before the function body
  -- runs, so this should trivially hold — verified rather than assumed).
  if exists (
    select 1 from public.founder_request_notification_attempts
     where id = v_attempt_id and (status <> 'pending' or completed_at is not null)
  ) then
    raise exception 'test7 FAILED: a permission-denied call somehow mutated the attempt row';
  end if;

  raise notice 'PASS test7: neither claim_... nor complete_... is executable by anon or authenticated';
end $$;

rollback;

-- =====================================================================
-- If the script above completed with 7 "PASS" notices and printed
-- ROLLBACK with no error, the migration is verified. Nothing here
-- modified persistent data.
-- =====================================================================

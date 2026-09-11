-- =====================================================================
-- Host Phase 5 — 007 — Data API grants
--
-- Purpose:
--   Grants the table privileges PostgREST needs. RLS decides WHICH ROWS a
--   caller may touch; grants decide whether the role may attempt the verb at
--   all. Both are required — a table with perfect policies and no grants is
--   invisible through the Data API, and a table with grants and no policies
--   is deny-all.
--
-- Required or optional: REQUIRED for any application access.
--
-- Execution order: LAST (after 006). Deliberately last so the tables are
--   never reachable through the Data API before their policies exist.
--
-- Dependencies: 002, 003 (tables), 006 (policies must already be in place).
--
-- Safety notes:
--   - anon receives NOTHING. Attendance is private operational data: it must
--     never be readable from a public event page, an anonymous Data API call,
--     or an unauthenticated Realtime subscription.
--   - authenticated receives select/insert/update on both tables and delete
--     on event_attendees only. Every one of those verbs is still gated by the
--     006 policies, so a normal registered user gains nothing from the grant.
--   - No delete grant on event_check_ins, matching the absent delete policy.
--     Two independent layers both refuse it.
--   - Grants follow the existing repo convention (explicit per-table verb
--     grants to authenticated, as used for public.event_submissions).
--   - Realtime is not enabled for these tables by this file. If it is ever
--     enabled, re-verify that the publication respects RLS for the roles in
--     use before turning it on.
--
-- Whether destructive: NO. Adds privileges only.
--
-- Rollback considerations: see 900. Revoking these grants makes the tables
--   inaccessible to the application but destroys no data.
-- =====================================================================

-- event_attendees: full CRUD surface, all row-gated by 006.
grant select, insert, update, delete on public.event_attendees to authenticated;

-- event_check_ins: no delete. Reversal (an update) is the only way to undo.
grant select, insert, update on public.event_check_ins to authenticated;

-- Explicitly ensure anon holds nothing, even if a broad default privilege is
-- ever introduced upstream.
revoke all on public.event_attendees  from anon;
revoke all on public.event_check_ins  from anon;

notify pgrst, 'reload schema';

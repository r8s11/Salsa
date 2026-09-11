-- Release Blocker Phase 2 — SEC-02 (public.audit_log_view) + SEC-06 (venue
-- authorization) reconciliation.
--
-- Forward-only: no prior migration file is edited. Every statement below is
-- idempotent, so this file is safe to apply whether the target database
-- currently reflects the source-intended secure state, the pre-fix insecure
-- state, or some drifted mix of the two (see the per-section notes).
--
-- No unrelated cleanup: this migration touches only public.audit_log_view
-- grants/options and public.venues RLS policies.

-- ============================================================
-- SEC-02 — public.audit_log_view
-- ============================================================
-- Source of truth: 20260818000000_phase12_audit_view_and_rpc.sql already
-- intends `security_invoker = on` with SELECT revoked from
-- public/anon/authenticated. The admin Activity UI reads the audit log
-- exclusively through admin_audit_log() / admin_audit_log_detail()
-- (SECURITY DEFINER, gated internally on auth.jwt() app_metadata role —
-- see the same migration file). No application code queries the view
-- directly (confirmed: no `audit_log_view` reference outside that
-- migration and the two admin RPCs it defines).
--
-- supabase/manual/reconcile-prod-schema.sql recreates the view without the
-- security_invoker option and then does:
--     revoke select on public.audit_log_view from public, anon;
--     grant  select on public.audit_log_view to authenticated;
-- which reintroduces exactly the security_definer_view / broad-authenticated-
-- read regression that supabase/manual/2026-08-25-fix-security-definer-views.sql
-- had previously closed. Re-apply both fixes idempotently; do not touch the
-- view's query definition (a body drift would be a separate, unrelated
-- schema issue and must not be silently papered over here).

alter view public.audit_log_view set (security_invoker = on);
revoke select on public.audit_log_view from public, anon, authenticated;

-- ============================================================
-- SEC-06 — public.venues authorization
-- ============================================================
-- Source of truth: 20260902000012_venues.sql already defines admin-only
-- SELECT/INSERT/UPDATE/DELETE. Per that migration's own comment and
-- src/features/admin/api/venuesRepo.ts ("This is the sole module that
-- calls supabase.from('venues') — no component or hook queries Supabase
-- directly"), no anon/regular/moderator code path reads this table
-- directly; public-facing venue data is served through the admin_venue_*
-- SECURITY DEFINER RPCs and the events table's own fields. There is no
-- legitimate product requirement for direct client SELECT on this table by
-- any non-admin actor.
--
-- Two manual reconciliation scripts left broader legacy policies in place
-- that PostgreSQL combines with the canonical ones via OR:
--   - "Anyone can read venues"  (anon+authenticated SELECT true)
--   - "Staff manage venues"     (admin+moderator ALL, raw JWT claim check —
--                                 this is the SEC-06 moderator-write defect)
--   - "Admins manage venues"    (redundant is_admin() ALL policy, superseded
--                                 by the four granular policies below)
-- Drop every known legacy/duplicate policy by name — supplementing them
-- with a new restrictive policy would not remove the OR'd permissive
-- grants — then recreate the canonical four exactly as
-- 20260902000012_venues.sql defines them, using public.is_admin() (the
-- repository's single trusted admin-authorization helper; it reads
-- auth.jwt() app_metadata, never profiles.role/user_metadata).

alter table public.venues enable row level security;

drop policy if exists "Venues are viewable by authenticated users" on public.venues;
drop policy if exists "Anyone can read venues" on public.venues;
drop policy if exists "Staff manage venues" on public.venues;
drop policy if exists "Admins manage venues" on public.venues;

drop policy if exists "Admins read venues" on public.venues;
create policy "Admins read venues"
  on public.venues
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert venues" on public.venues;
create policy "Admins can insert venues"
  on public.venues
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update venues" on public.venues;
create policy "Admins can update venues"
  on public.venues
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete venues" on public.venues;
create policy "Admins can delete venues"
  on public.venues
  for delete
  to authenticated
  using (public.is_admin());

-- Defense in depth: a legacy manual script granted anon table-level SELECT
-- on venues alongside "Anyone can read venues". RLS already blocks anon
-- under the canonical policies above, but the grant must not linger.
revoke all on public.venues from anon;

notify pgrst, 'reload schema';

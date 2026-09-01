-- =====================================================================
-- Founder Access Requests — Phase 2
-- =====================================================================
-- Purpose:
--   Public, unauthenticated Founder/Host access request intake.
--   Separate from organizer_requests (which requires auth and a
--   profiles.user_id FK): a founder request is an application from a
--   person, NOT an account, organization, or membership.
--
-- Write boundary:
--   The ONLY writer for public submissions is the `request-founder-access`
--   Edge Function, which authenticates to Postgres with the service role
--   (bypasses RLS) and enforces payload validation, normalization,
--   honeypot/size checks, duplicate suppression, and status='pending'.
--   This table grants anon NOTHING — no privileges, no policies. Admins
--   get full access via RLS; moderators get read access for the Phase 3
--   review queue.
--
-- Required: REQUIRED before deploying Phase 2 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: standalone. Depends on public.set_updated_at()
--   (20260813000000_profiles.sql), public.is_admin()
--   (20260830000000_phase6_host_organizer_access.sql), and
--   public.is_moderator() (20260817000000_event_submissions.sql).
--
-- Migration-timestamp note: the pre-existing collision on prefix
--   20260830000000 (two files, documented in
--   Docs/operations/phase1-auth-email-foundation.md §7) is unrelated to
--   this file; this migration uses 20260831000001, after
--   20260831000000_phase5_host_attendance.sql.
--
-- Data impact: no existing row is changed.
--
-- Rollback considerations:
--   Drop the audit trigger + its function, the INSERT/SELECT policies,
--   and the table. Indexes/constraints drop with the table.
-- =====================================================================

-- ------------------------------------------------------------
-- 1. Table: founder_access_requests
-- ------------------------------------------------------------

create table if not exists public.founder_access_requests (
  id                     uuid primary key default gen_random_uuid(),

  -- Applicant identity (presentation values + normalized keys)
  applicant_name         text not null,
  email                  text not null,
  normalized_email       text not null,

  -- Organization / brand
  organization_name      text not null,
  normalized_org_name    text not null,
  instagram              text,
  normalized_instagram   text,
  website                text,
  city                   text,
  region                 text,

  -- Free-form
  description            text,
  message                text,

  -- Status lifecycle (Phase 3 adds the review UI; the states exist now
  -- so no constraint migration is needed later)
  status                 text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),

  -- Admin review (Phase 3+)
  reviewed_by            uuid references auth.users(id) on delete set null,
  reviewed_at            timestamptz,
  rejection_reason_code  text
    check (rejection_reason_code is null or rejection_reason_code in (
      'insufficient_information',
      'unable_to_verify_organizer',
      'account_activity_concerns',
      'duplicate_organizer_brand',
      'not_currently_eligible',
      'other'
    )),
  rejection_message      text,

  -- Timestamps
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Query-pattern indexes: default admin sort is created_at desc within a
-- status partition; duplicate lookup is by normalized email.
create index if not exists founder_access_requests_status_created_idx
  on public.founder_access_requests (status, created_at desc);

create index if not exists founder_access_requests_normalized_email_idx
  on public.founder_access_requests (normalized_email);

create index if not exists founder_access_requests_normalized_org_idx
  on public.founder_access_requests (normalized_org_name);

-- ATOMIC duplicate suppression: at most one pending request per
-- normalized email. The Edge Function checks for duplicates before
-- inserting, but two concurrent submissions would otherwise both pass
-- the check and both insert (TOCTOU). This partial unique index closes
-- that race at the database layer: the loser gets a 23505 unique
-- violation, which the Edge Function maps to the same enumeration-safe
-- duplicate response. Rejected/approved requests do NOT block a new
-- pending request from the same email — only pending ones do.
create unique index if not exists founder_access_requests_pending_email_uniq
  on public.founder_access_requests (normalized_email)
  where status = 'pending';

-- updated_at trigger (reuses set_updated_at from 20260813000000_profiles.sql)
create trigger founder_access_requests_set_updated_at
  before update on public.founder_access_requests
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------
-- anon gets NOTHING here: no table privileges, no policies. Public
-- submissions enter exclusively through the Edge Function's service-role
-- connection. Authenticated admins/moderators access via the policies
-- below (service role bypasses RLS regardless).

alter table public.founder_access_requests enable row level security;

-- Admin full access (Phase 3 review/approve/reject).
drop policy if exists "Admins manage founder requests" on public.founder_access_requests;
create policy "Admins manage founder requests"
  on public.founder_access_requests
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Moderators can read for the Phase 3 review queue.
drop policy if exists "Moderators read founder requests" on public.founder_access_requests;
create policy "Moderators read founder requests"
  on public.founder_access_requests
  for select
  to authenticated
  using (public.is_moderator());

-- ------------------------------------------------------------
-- 3. Audit trigger
-- ------------------------------------------------------------
-- Mirrors log_submission_change() from 20260817000000_event_submissions.sql.
-- actor_id is null for public submissions (the Edge Function's service-role
-- connection has no auth.uid(); audit_logs.actor_id is nullable for exactly
-- this reason) and is set on admin review actions.

create or replace function public.log_founder_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'founder_request.created',
      'founder_access_request',
      new.id,
      jsonb_build_object(
        'email', new.normalized_email,
        'organization', new.normalized_org_name,
        'status', new.status
      )
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      case new.status
        when 'approved' then 'founder_request.approved'
        when 'rejected' then 'founder_request.rejected'
        else 'founder_request.status_changed'
      end,
      'founder_access_request',
      new.id,
      jsonb_build_object(
        'from_status', old.status,
        'to_status', new.status,
        'rejection_reason', new.rejection_reason_code
      )
    );
  end if;

  return new;
end;
$$;

create trigger founder_access_requests_audit_log
  after insert or update on public.founder_access_requests
  for each row execute function public.log_founder_request_change();

-- Trigger functions are not safe to call via RPC — revoke from public/anon.
revoke execute on function public.log_founder_request_change() from public, anon;

-- ------------------------------------------------------------
-- 4. Notify PostgREST to reload schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
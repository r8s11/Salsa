-- =====================================================================
-- Founder Invitation Delivery Tracking — Phase 5
-- =====================================================================
-- Purpose:
--   Records email-delivery attempts for founder_invitations, kept as a
--   dedicated table (spec §8 Option B) rather than columns on
--   founder_invitations: invitation lifecycle (pending/accepted/revoked)
--   and email-delivery lifecycle (sent/failed, possibly retried in
--   Phase 9) are different concerns with different cardinality — one
--   invitation may accumulate multiple delivery attempts over time,
--   which a single set of columns cannot represent without overwriting
--   history.
--
-- Required: REQUIRED before deploying Phase 5 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: depends on public.founder_invitations
--   (20260831000004_founder_invitations.sql), public.is_admin() and
--   public.is_moderator().
--
-- Data impact: no existing row is changed.
--
-- Rollback considerations:
--   Drop the audit trigger + its function, the RPCs in the companion
--   file, the RLS policies, the indexes, and the table.
-- =====================================================================

-- ------------------------------------------------------------
-- 1. Table: founder_invitation_delivery_attempts
-- ------------------------------------------------------------

create table if not exists public.founder_invitation_delivery_attempts (
  id                     uuid primary key default gen_random_uuid(),
  invitation_id          uuid not null references public.founder_invitations(id) on delete cascade,

  -- 1-based, per invitation. Computed server-side inside the recording
  -- RPC (max(attempt_number)+1) — never client-supplied.
  attempt_number         integer not null check (attempt_number >= 1),

  provider               text not null default 'resend',
  provider_message_id    text,

  status                 text not null check (status in ('sent', 'failed')),

  -- A normalized failure category, never a raw provider exception message
  -- or response body (spec §22: no sensitive/raw provider text stored).
  -- Expected values produced by the send-founder-invitation Edge
  -- Function: 'missing_configuration', 'rate_limited', 'provider_error',
  -- 'network_error', 'invalid_recipient'.
  error_code             text,

  attempted_by           uuid not null references auth.users(id),
  attempted_at           timestamptz not null default now(),
  completed_at           timestamptz,

  check (status <> 'sent' or provider_message_id is not null),
  check (status <> 'failed' or error_code is not null),
  unique (invitation_id, attempt_number)
);

comment on table public.founder_invitation_delivery_attempts is
  'Email-delivery attempt history for founder_invitations. Never stores the plaintext token, the full acceptance URL, or raw provider response bodies.';
comment on column public.founder_invitation_delivery_attempts.error_code is
  'Normalized failure category only (e.g. provider_error, rate_limited, network_error, missing_configuration, invalid_recipient) — never a raw exception message or provider response body.';

create index if not exists founder_invitation_delivery_attempts_invitation_idx
  on public.founder_invitation_delivery_attempts (invitation_id, attempted_at desc);

-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------
-- Same admin-full / moderator-read split as founder_invitations. anon
-- gets nothing — this table is never written or read by an
-- unauthenticated caller.

alter table public.founder_invitation_delivery_attempts enable row level security;

drop policy if exists "Admins manage founder invitation delivery attempts" on public.founder_invitation_delivery_attempts;
create policy "Admins manage founder invitation delivery attempts"
  on public.founder_invitation_delivery_attempts
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Moderators read founder invitation delivery attempts" on public.founder_invitation_delivery_attempts;
create policy "Moderators read founder invitation delivery attempts"
  on public.founder_invitation_delivery_attempts
  for select
  to authenticated
  using (public.is_moderator());

-- ------------------------------------------------------------
-- 3. Audit trigger
-- ------------------------------------------------------------
-- Mirrors log_founder_invitation_change() (Phase 4). Feeds the single,
-- unified audit_logs trail rather than requiring a second admin surface
-- to reconstruct delivery history — never logs provider_message_id
-- alongside anything token-shaped, and never the token itself (this
-- table structurally cannot contain it).

create or replace function public.log_founder_invitation_delivery_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    new.attempted_by,
    case new.status
      when 'sent' then 'founder_invitation.email_sent'
      else 'founder_invitation.email_failed'
    end,
    'founder_invitation_delivery_attempt',
    new.id,
    jsonb_build_object(
      'invitation_id', new.invitation_id,
      'attempt_number', new.attempt_number,
      'provider', new.provider,
      'provider_message_id', new.provider_message_id,
      'error_code', new.error_code
    )
  );
  return new;
end;
$$;

create trigger founder_invitation_delivery_attempts_audit_log
  after insert on public.founder_invitation_delivery_attempts
  for each row execute function public.log_founder_invitation_delivery_attempt();

revoke execute on function public.log_founder_invitation_delivery_attempt() from public, anon;

-- ------------------------------------------------------------
-- 4. Notify PostgREST to reload schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

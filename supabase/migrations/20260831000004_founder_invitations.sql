-- =====================================================================
-- Founder Invitations — Phase 4
-- =====================================================================
-- Purpose:
--   Secure, auditable invitation lifecycle for approved Founder requests.
--   Deliberately separate from founder_access_requests: that table answers
--   "did SalsaSegura approve this person's request?"; this table answers
--   "has a secure onboarding invitation been issued, and what happened to
--   it?" The two domains are linked by founder_request_id only.
--
-- Architecture decision (Phase 4 audit finding):
--   The existing organizer-invitation flow (`invite-organizer` Edge
--   Function) delegates entirely to Supabase Auth's
--   `auth.admin.inviteUserByEmail`, which owns its own opaque token and
--   immediately creates an Auth user + Auth email. That mechanism is
--   unsuitable for reuse here: Phase 4 explicitly must NOT create an Auth
--   user, must NOT send email, and must own a custom, revocable,
--   single-use token independent of Auth account creation (Phase 6 will
--   decide how acceptance maps to an Auth identity). No prior custom
--   invitation *table* or token/hash utility exists anywhere in the repo
--   to reuse (audited: `supabase/functions/_shared/invitation.ts` only
--   has email/redirect-URL normalization, no token logic). Phase 4
--   therefore introduces its own table and its own token primitive.
--
-- Write boundary:
--   Every state transition (create/revoke) goes through a SECURITY
--   DEFINER RPC in 20260831000005_founder_invitation_rpcs.sql — mirrors
--   the Phase 3 `admin_review_founder_request` pattern rather than an
--   Edge Function, matching the codebase's existing convention for
--   authenticated privileged admin writes (`supabase.rpc(...)`, not
--   `supabase.functions.invoke(...)`), and keeping token generation/
--   hashing in one place (Postgres pgcrypto) rather than duplicating it
--   between a Deno Edge Function and a hypothetical client-side check.
--
-- Required: REQUIRED before deploying Phase 4 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: depends on public.founder_access_requests
--   (20260831000001_founder_access_requests.sql), public.is_admin() and
--   public.is_moderator() (20260830000001_phase6_host_organizer_access.sql,
--   20260817000000_event_submissions.sql), and public.set_updated_at()
--   (20260813000000_profiles.sql). Timestamp 20260831000004 is the next
--   free slot after Phase 3's highest migration (20260831000003); Phase 3
--   already repaired one prior timestamp collision
--   (20260830000000 -> 20260830000001), so this file was checked against
--   the full `supabase/migrations/` listing before naming.
--
-- Data impact: no existing row is changed.
--
-- Rollback considerations:
--   Drop the audit trigger + its function, the RLS policies, the indexes,
--   and the table. No other object depends on this one.
-- =====================================================================

-- ------------------------------------------------------------
-- 1. Table: founder_invitations
-- ------------------------------------------------------------

create table if not exists public.founder_invitations (
  id                  uuid primary key default gen_random_uuid(),

  -- Link to the approved request this invitation was issued for.
  founder_request_id  uuid not null references public.founder_access_requests(id) on delete cascade,

  -- Immutable snapshot of who was invited, copied server-side from the
  -- approved request at creation time (spec §29/§30) — never client-supplied,
  -- never silently re-synced if the source request is edited later.
  email               text not null,
  normalized_email    text not null,

  -- The plaintext token is never stored. Only its SHA-256 hash (hex) is
  -- persisted; lookup at validation time re-hashes the presented token and
  -- compares hashes (see 20260831000005_founder_invitation_rpcs.sql).
  token_hash          text not null,

  -- Lifecycle. Expiration is derived (`expires_at < now()`), never a
  -- materialized status value, so no scheduled job is needed to keep it
  -- accurate — see spec §18. "pending" covers both live and stale (past
  -- expires_at, not yet revoked) invitations; validation and the admin UI
  -- both treat expires_at as authoritative regardless of status.
  status              text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),

  expires_at          timestamptz not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Actor columns are always set server-side from auth.uid() inside the
  -- RPCs — never accepted from client input (spec §23).
  created_by          uuid not null references auth.users(id),

  revoked_at          timestamptz,
  -- Nullable even though every revoke is admin-initiated: a NULL
  -- revoked_by on a status='revoked' row distinguishes a system
  -- supersede (the create RPC auto-revoking a stale expired pending row
  -- to keep the "one active invitation" invariant — spec §9/§19) from an
  -- explicit admin revoke, which always has revoked_by set.
  revoked_by          uuid references auth.users(id) on delete set null,

  accepted_at         timestamptz,
  accepted_by         uuid references auth.users(id) on delete set null,

  check (expires_at > created_at),
  -- Only a pending invitation may still be missing its resolution audit
  -- pair, and a resolved invitation must carry the matching timestamp.
  check (status <> 'revoked' or revoked_at is not null),
  check (status <> 'accepted' or (accepted_at is not null and accepted_by is not null))
);

comment on table public.founder_invitations is
  'Secure, single-use invitation tokens issued for approved founder_access_requests rows. Only token_hash is stored; the plaintext token is returned once at creation and never retrievable again.';
comment on column public.founder_invitations.token_hash is
  'SHA-256 hex digest of the plaintext token (extensions.digest(token, ''sha256'')). Never the plaintext.';
comment on column public.founder_invitations.revoked_by is
  'NULL on a system-superseded row (stale pending invitation replaced by a fresh one at create time); set to the acting admin on an explicit revoke.';

-- Query-pattern indexes.
create unique index if not exists founder_invitations_token_hash_uniq
  on public.founder_invitations (token_hash);

create index if not exists founder_invitations_founder_request_idx
  on public.founder_invitations (founder_request_id, created_at desc);

-- Single-active-invitation invariant (spec §9). now() is not IMMUTABLE and
-- cannot appear in an index predicate, so this index only enforces "at
-- most one pending row per request" — the create RPC transactionally
-- supersedes a stale (expired) pending row into 'revoked' before insert
-- so this index never blocks a legitimate reissue. See the RPC file for
-- the transactional half of this invariant.
create unique index if not exists founder_invitations_pending_per_request_uniq
  on public.founder_invitations (founder_request_id)
  where status = 'pending';

-- updated_at trigger (reuses set_updated_at from 20260813000000_profiles.sql).
create trigger founder_invitations_set_updated_at
  before update on public.founder_invitations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------
-- anon gets NOTHING here: no table privileges, no policies. Token
-- validation for anonymous visitors goes exclusively through the
-- SECURITY DEFINER validate_founder_invitation() RPC (bypasses RLS,
-- returns only safe public fields — never a raw row).

alter table public.founder_invitations enable row level security;

-- Admin full access (create/revoke happen through the RPCs below, which
-- are also SECURITY DEFINER and re-check is_admin() themselves; this
-- policy is the direct-table-access boundary for admin tooling/Studio).
drop policy if exists "Admins manage founder invitations" on public.founder_invitations;
create policy "Admins manage founder invitations"
  on public.founder_invitations
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Moderators can read for the Phase 3/4 admin detail view (spec §21).
drop policy if exists "Moderators read founder invitations" on public.founder_invitations;
create policy "Moderators read founder invitations"
  on public.founder_invitations
  for select
  to authenticated
  using (public.is_moderator());

-- ------------------------------------------------------------
-- 3. Audit trigger
-- ------------------------------------------------------------
-- Mirrors log_founder_request_change() from
-- 20260831000001_founder_access_requests.sql. Logs only safe metadata
-- (spec §24): invitation id, founder_request_id, actor, transition,
-- timestamp. Never the token or its hash.

create or replace function public.log_founder_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      new.created_by,
      'founder_invitation.created',
      'founder_invitation',
      new.id,
      jsonb_build_object(
        'founder_request_id', new.founder_request_id,
        'expires_at', new.expires_at
      )
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      case new.status
        when 'revoked' then new.revoked_by
        when 'accepted' then new.accepted_by
        else auth.uid()
      end,
      case new.status
        when 'revoked' then 'founder_invitation.revoked'
        when 'accepted' then 'founder_invitation.accepted'
        else 'founder_invitation.status_changed'
      end,
      'founder_invitation',
      new.id,
      jsonb_build_object(
        'founder_request_id', new.founder_request_id,
        'from_status', old.status,
        'to_status', new.status,
        'system_superseded', new.status = 'revoked' and new.revoked_by is null
      )
    );
  end if;

  return new;
end;
$$;

create trigger founder_invitations_audit_log
  after insert or update on public.founder_invitations
  for each row execute function public.log_founder_invitation_change();

-- Trigger functions are not safe to call via RPC — revoke from public/anon.
revoke execute on function public.log_founder_invitation_change() from public, anon;

-- ------------------------------------------------------------
-- 4. Notify PostgREST to reload schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

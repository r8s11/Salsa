-- Phase 12 — supporting view and RPC for the admin Activity UI.
-- REQUIRED after 20260813000100_audit_logs.sql and all trigger migrations.
-- None of this is destructive: it adds a read-only view + a secured RPC on top
-- of the existing audit_logs table.
--
-- admin_audit_log(): returns enriched audit entries joined with profiles so the
-- Activity UI can resolve actor + target identities without per-row client joins.
-- This mirrors the admin_user_directory() RPC pattern (single admin-scoped call).
--

-- -----------------------------------------------------------------
-- 1. Extend audit_logs with columns needed for the detail page
--    (before/after state diffs, reason, target metadata).
--    These columns are all nullable and additive — existing rows
--    and triggers are unaffected.
-- -----------------------------------------------------------------

alter table public.audit_logs
  add column if not exists before_state jsonb,
  add column if not exists after_state jsonb,
  add column if not exists reason    text,
  add column if not exists target_type text,
  add column if not exists target_id   uuid,
  add column if not exists target_name text;

-- -----------------------------------------------------------------
-- 2. View: audit_logs joined with profiles for actor identity
-- -----------------------------------------------------------------

create or replace view public.audit_log_view as
  select
    a.id,
    a.actor_id,
    a.action,
    a.entity_type,
    a.entity_id,
    a.metadata,
    a.created_at,
    a.before_state,
    a.after_state,
    a.reason,
    a.target_type,
    a.target_id,
    a.target_name,
    -- Resolved actor identity (null when actor_id is null → System)
    p_roles.display_name     as actor_display_name,
    p_roles.username         as actor_username,
    p_roles.avatar_url       as actor_avatar_url
  from public.audit_logs a
  left join public.profiles p_roles on p_roles.id = a.actor_id;

-- security_invoker: without it the view runs as its owner (postgres) and
-- bypasses RLS on audit_logs and profiles entirely. Flagged as ERROR by the
-- Supabase linter (0010_security_definer_view).
alter view public.audit_log_view set (security_invoker = on);

-- No client role gets SELECT on this view. The admin Activity UI reads the
-- audit log through admin_audit_log() / admin_audit_log_detail(), which are
-- SECURITY DEFINER and gate on the admin role internally. Granting the view
-- to `authenticated` previously let any signed-in user read every audit
-- entry (before_state, after_state, reason, actor identity) and skip that
-- gate completely.
revoke select on public.audit_log_view from public, anon, authenticated;

-- -----------------------------------------------------------------
-- 3. Helper function: category_of — maps action/entity_type to a category label
--    Used by the RPC query and also testable independently.
-- -----------------------------------------------------------------

create or replace function public.category_of(p_action text, p_entity_type text)
returns text
language sql
stable
as $$
  select case
    -- Security-sensitive actions always take priority over entity_type
    -- so bans/suspensions/role-changes/access-policy changes are always "security".
    when p_action in ('user.banned', 'user.suspended', 'user.role_changed',
                      'platform_settings.access_policy_changed') then 'security'
    when p_entity_type = 'platform_settings' then 'settings'
    when p_entity_type = 'event' then 'events'
    when p_entity_type = 'event_submission' then 'submissions'
    when p_entity_type = 'profile' or p_entity_type = 'organizer' then 'users'
    when p_entity_type = 'venue' then 'venues'
    when p_entity_type = 'taxonomy_term' then 'taxonomy'
    else 'events'  -- default to 'events' to match the TS model (categoryOf fallback)
  end;
$$;

-- -----------------------------------------------------------------
-- 4. RPC: admin_audit_log — paginated, filterable
--    Accepts all Activity-page filter parameters so the client never loads
--    the full table. Returns newest-first. Deterministic tie-break on (created_at, id).
-- -----------------------------------------------------------------

create or replace function public.admin_audit_log(
  p_limit      integer default 25,
  p_offset     integer default 0,
  p_q            text default null,
  p_category     text[] default null,
  p_action       text[] default null,
  p_actor_id     uuid default null,
  p_entity_type  text default null,
  p_from         timestamptz default null,
  p_to           timestamptz default null
)
returns table (
  id              uuid,
  actor_id        uuid,
  actor_display_name text,
  actor_username    text,
  actor_avatar_url  text,
  action          text,
  entity_type     text,
  entity_id       uuid,
  metadata        jsonb,
  before_state    jsonb,
  after_state     jsonb,
  reason          text,
  target_type     text,
  target_id       uuid,
  target_name     text,
  created_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  return query
  select
    v.id,
    v.actor_id,
    v.actor_display_name,
    v.actor_username,
    v.actor_avatar_url,
    v.action,
    v.entity_type,
    v.entity_id,
    v.metadata,
    v.before_state,
    v.after_state,
    v.reason,
    v.target_type,
    v.target_id,
    v.target_name,
    v.created_at
  from public.audit_log_view v
  where (p_q is null or
         (v.actor_display_name ilike ('%' || p_q || '%')
          or v.actor_username ilike ('%' || p_q || '%')
          or v.entity_type ilike ('%' || p_q || '%')
          or v.metadata::text ilike ('%' || p_q || '%')))
    and (p_category is null or category_of(v.action, v.entity_type) = any(p_category))
    and (p_action is null or v.action = any(p_action))
    and (p_actor_id is null or v.actor_id = p_actor_id)
    and (p_entity_type is null or v.entity_type = p_entity_type)
    and (p_from is null or v.created_at >= p_from)
    and (p_to is null or v.created_at <= p_to)
  order by v.created_at desc, v.id desc
  limit p_limit offset p_offset;
end;
$$;

-- Grants — admins only, matching audit_logs policy.
-- Must include parameter types because PostgreSQL resolves functions by signature.
revoke execute on function public.admin_audit_log(integer, integer, text, text[], text[], uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_audit_log(integer, integer, text, text[], text[], uuid, text, timestamptz, timestamptz) to authenticated;
revoke execute on function public.category_of(text, text) from public, anon;
grant execute on function public.category_of(text, text) to authenticated;

notify pgrst, 'reload schema';

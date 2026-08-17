-- Phase 12 — single-entry detail RPC for the admin Activity detail page.
-- REQUIRED after 001_create_audit_view_and_rpc.sql.
-- Additive only: adds one new SECURITY DEFINER function.
--
-- Why this exists: AdminActivityDetailPage reads a single audit_logs row by
-- id via the client. Before this script, that read went straight to
-- `audit_logs` (or would have needed a direct grant on `audit_log_view`),
-- which either skipped the actor_display_name/actor_username join entirely
-- (actorLabelFor rendering "Unknown admin" for every real admin action) or
-- would have required granting SELECT on `audit_log_view` to `authenticated`
-- — which has no row-level admin check of its own and would let ANY signed-in
-- user read the full audit trail, not just admins.
--
-- `admin_audit_log_detail` mirrors `admin_audit_log`'s existing pattern
-- (SECURITY DEFINER + explicit admin-role check), returning the same
-- profile-enriched shape for a single id. `audit_log_view` intentionally
-- keeps zero direct grants — only the two admin-gated RPCs may read it.

create or replace function public.admin_audit_log_detail(p_id uuid)
returns table (
  id              uuid,
  actor_id        uuid,
  action          text,
  entity_type     text,
  entity_id       uuid,
  metadata        jsonb,
  created_at      timestamptz,
  actor_display_name text,
  actor_username    text,
  actor_avatar_url  text
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
    v.action,
    v.entity_type,
    v.entity_id,
    v.metadata,
    v.created_at,
    v.actor_display_name,
    v.actor_username,
    v.actor_avatar_url
  from public.audit_log_view v
  where v.id = p_id;
end;
$$;

-- Grants — admins only, matching admin_audit_log.
revoke execute on function public.admin_audit_log_detail(uuid) from public, anon;
grant execute on function public.admin_audit_log_detail(uuid) to authenticated;

notify pgrst, 'reload schema';

-- is_platform_admin(): JWT-claim helper mirroring is_admin(), used by the
-- platform_settings RLS policies (Phase 14 — Platform Settings Consolidation).
--
-- Historically this function existed only in the manual production
-- reconciliation script (supabase/reconcile-prod-schema.sql), never in a
-- migration — a fresh local stack could not reproduce it, so the
-- platform_settings migration's RLS policies failed to create with
-- "function public.is_platform_admin() does not exist".
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- Phase 6 — Profile Edit Visual Foundation: owner-scoped, column-limited
-- update path for the existing public.profiles row.
--
-- Scope rules (enforced at the database boundary, not only in the UI):
--   1. The authenticated user may only update rows where id = auth.uid().
--   2. They may only update display_name and avatar_url.
--   3. display_name must remain a non-empty trimmed value.
--   4. Other profile-lifecycle columns (username, role, status,
--      status_reason, created_at, id) cannot be updated through this path.
--
-- Supabase requires SELECT to be granted alongside UPDATE — the existing
-- "Users read own profile" SELECT policy is therefore preserved.

-- 1. Revoke any prior broad UPDATE grant on public.profiles, then
--    re-grant at column level. This ensures a previously-shipped broad
--    grant cannot be widened silently.
do $$
begin
  if exists (
    select 1 from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'profiles'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE'
  ) then
    revoke update on public.profiles from authenticated;
  end if;
end
$$;

grant update (display_name, avatar_url) on public.profiles to authenticated;

-- 2. Enforce non-empty trimmed display_name at the trusted database
--    boundary. The UI also disables Save on empty input; this CHECK
--    makes the promise a database fact.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_display_name_nonempty'
  ) then
    alter table public.profiles
      add constraint profiles_display_name_nonempty
      check (display_name is null or length(btrim(display_name)) > 0);
  end if;
end
$$;

-- 3. Owner-only UPDATE policy. USING and WITH CHECK both restrict to
--    the caller's own row, so the row id cannot be reassigned to a
--    different user mid-update. No column allow-list is needed here
--    because the column-level GRANT above already blocks updates to
--    username, role, status, status_reason, created_at, updated_at, id.
drop policy if exists "Users update own profile fields" on public.profiles;
create policy "Users update own profile fields"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

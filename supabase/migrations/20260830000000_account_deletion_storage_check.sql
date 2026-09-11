-- Service-role-only account dependency check for account deletion.
-- It returns only a blocker category, never protected-row metadata.
drop function if exists public.account_has_storage_objects(uuid);

create or replace function public.account_deletion_blocker(target_user_id uuid, target_email text)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if exists (select 1 from public.events where submitter_id = target_user_id) then return 'event_history'; end if;
  if exists (select 1 from public.event_submissions where submitter_id = target_user_id) then return 'event_history'; end if;
  if exists (select 1 from public.event_submissions where reviewed_by = target_user_id) then return 'operational_history'; end if;
  if exists (select 1 from public.audit_logs where actor_id = target_user_id) then return 'operational_history'; end if;
  if exists (select 1 from public.organizer_requests where user_id = target_user_id) then return 'organizer'; end if;
  if exists (select 1 from public.organizer_requests where reviewed_by = target_user_id) then return 'operational_history'; end if;
  if exists (select 1 from public.organizer_members where user_id = target_user_id) then return 'organizer'; end if;
  if exists (select 1 from public.event_import_batches where imported_by = target_user_id) then return 'operational_history'; end if;
  if exists (select 1 from public.platform_settings where updated_by = target_user_id) then return 'operational_history'; end if;
  if target_email is not null and exists (
    select 1
    from public.events
    where submitter_email ilike target_email or contact_email ilike target_email
  ) then return 'event_history'; end if;
  if target_email is not null and exists (
    select 1 from public.event_submissions where submitter_email ilike target_email
  ) then return 'event_history'; end if;
  if exists (select 1 from storage.objects where owner_id = target_user_id) then return 'storage'; end if;
  return null;
end;
$$;

revoke all on function public.account_deletion_blocker(uuid, text) from public;
grant execute on function public.account_deletion_blocker(uuid, text) to service_role;

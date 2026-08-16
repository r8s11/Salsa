-- Phase 11 — audit trail for platform-setting changes.
-- REQUIRED after 001 and 002, and after the existing audit_logs migration.
-- No secret values exist in platform_settings. The log records changed field names,
-- not prior or new field values, to keep the audit feed concise and privacy-safe.

create or replace function public.log_platform_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed_keys text[];
  v_action text;
begin
  select coalesce(array_agg(entry.key order by entry.key), '{}')
    into v_changed_keys
  from jsonb_each(to_jsonb(new) - 'updated_at' - 'updated_by') as entry
  where (to_jsonb(old) -> entry.key) is distinct from entry.value;

  if cardinality(v_changed_keys) = 0 then
    return new;
  end if;

  v_action := case
    when v_changed_keys && array[
      'allow_public_event_suggestions',
      'allow_registered_user_submissions'
    ] then 'platform_settings.access_policy_changed'
    else 'platform_settings.updated'
  end;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    v_action,
    'platform_settings',
    null,
    jsonb_build_object('changed_keys', to_jsonb(v_changed_keys))
  );

  return new;
end;
$$;
revoke all on function public.log_platform_settings_change() from public, anon;

drop trigger if exists platform_settings_audit_log on public.platform_settings;
create trigger platform_settings_audit_log
  after update on public.platform_settings
  for each row execute function public.log_platform_settings_change();

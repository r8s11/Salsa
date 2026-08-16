create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- Never blocks the mutation it observes: plain insert, no side effects,
-- no exceptions raised.
create function public.log_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action      text;
  v_entity_id   uuid;
  v_title       text;
  v_from_status text;
  v_to_status   text;
begin
  -- OLD is unassigned on INSERT and NEW is unassigned on DELETE — touching
  -- either raises "record is not assigned yet", so every field read below
  -- is guarded by tg_op before it happens.
  if tg_op = 'INSERT' then
    v_action      := 'event.created';
    v_entity_id   := new.id;
    v_title       := new.title;
    v_from_status := null;
    v_to_status   := new.status;
  elsif tg_op = 'DELETE' then
    v_action      := 'event.deleted';
    v_entity_id   := old.id;
    v_title       := old.title;
    v_from_status := old.status;
    v_to_status   := null;
  else
    v_entity_id   := new.id;
    v_title       := new.title;
    v_from_status := old.status;
    v_to_status   := new.status;
    if old.status is distinct from new.status then
      v_action := case new.status
        when 'approved' then 'event.approved'
        when 'rejected' then 'event.rejected'
        else 'event.status_changed'
      end;
    else
      v_action := 'event.updated';
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    v_action,
    'event',
    v_entity_id,
    jsonb_build_object(
      'title', v_title,
      'from_status', v_from_status,
      'to_status', v_to_status
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger events_audit_log
  after insert or update or delete on public.events
  for each row execute function public.log_event_change();

-- Trigger functions are not safe to call via RPC — revoke from public/anon.
revoke execute on function public.log_event_change() from public, anon;

alter table public.audit_logs enable row level security;

-- Grants sit below policies — without grant select, RLS policy is never evaluated.
grant select on public.audit_logs to authenticated;

create policy "Admins read audit log"
  on public.audit_logs
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

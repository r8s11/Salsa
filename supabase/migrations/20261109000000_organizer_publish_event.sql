-- Let authorised organizers publish an existing draft event.
--
-- Applies exactly the gate organizer_create_event(..., p_publish => true)
-- applies: authenticated, active account, active organizer, platform admin
-- (public.is_admin()) or an active owner/manager membership on the organizer.
-- The organizer is read from the event row, never from the caller. Publishing
-- sets the same status value create-with-publish sets ('approved') and nothing
-- else. Only a draft can be published; anything else raises 55000.
-- A missing event is reported as 42501, like organizer_update_event's
-- authorisation failures, so callers cannot probe for event ids.
-- The whole body is one transaction: any failure leaves the event a draft.

create or replace function public.organizer_publish_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_role  text;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.account_is_active(auth.uid()) then
    raise exception 'account is not active' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null or v_event.organizer_id is null then
    raise exception 'event is not organizer-owned' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organizers
     where id = v_event.organizer_id and status = 'active'
  ) then
    raise exception 'organizer is not active' using errcode = '42501';
  end if;

  if public.is_admin() then
    v_role := 'platform';
  else
    v_role := public.organizer_member_role(v_event.organizer_id);
    if v_role is null or v_role not in ('owner', 'manager') then
      raise exception 'active owner or manager membership required' using errcode = '42501';
    end if;
  end if;

  if v_event.status is distinct from 'draft' then
    raise exception 'only a draft event can be published (current status: %)', v_event.status
      using errcode = '55000';
  end if;

  -- Same required fields organizer_create_event enforces on its payload.
  if nullif(btrim(v_event.title), '') is null then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if v_event.event_date is null then
    raise exception 'event date is required' using errcode = '22023';
  end if;
  if nullif(btrim(v_event.event_type), '') is null then
    raise exception 'event type is required' using errcode = '22023';
  end if;

  update public.events set status = 'approved'
   where id = p_event_id and status = 'draft';

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'event.organizer_published',
    'event',
    p_event_id,
    jsonb_build_object('organizer_id', v_event.organizer_id, 'member_role', v_role)
  );
end;
$$;

revoke execute on function public.organizer_publish_event(uuid) from public, anon;
grant execute on function public.organizer_publish_event(uuid) to authenticated;

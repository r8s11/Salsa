-- Admin organizer assignment workflow.
--
-- Platform role (profiles.role) and organizer team membership
-- (organizer_members) stay separate: admin_set_user_role grants no membership.
-- This migration adds the explicit, admin-only follow-up actions:
--
--   admin_assign_organizer_member   add / change a user's team role on an
--                                   organizer (optionally creating the
--                                   organizer in the same transaction)
--   admin_set_event_organizer       link an event to an organizer, with a
--                                   confirmation flag when changing owner
--   admin_user_organizer_memberships / admin_organizer_team
--                                   read models for the admin screens
--   events organizer guard + audit  trigger-level invariant: archived or
--                                   suspended organizers cannot receive
--                                   events, every organizer_id change is
--                                   written to audit_logs (any write path)
--
-- Forward-only. No existing row is rewritten; existing memberships, events and
-- organizers are untouched. Duplicate organizer profiles keep being refused by
-- admin_entity_save (same name + city + website). A table-level unique index
-- is deliberately not added: the flyer/founder flows legitimately create
-- same-name organizers that differ by website, and an index would fail on
-- existing production rows.

-- ------------------------------------------------------------
-- 1. Events: organizer guard + audit (covers every write path)
-- ------------------------------------------------------------

create or replace function public.events_guard_organizer_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if new.organizer_id is null
     or (tg_op = 'UPDATE' and new.organizer_id is not distinct from old.organizer_id) then
    return new;
  end if;
  select status into v_status from public.organizers where id = new.organizer_id;
  if v_status in ('archived', 'suspended') then
    raise exception 'Organizer is % and cannot receive events. Choose an active organizer or reactivate this one first.', v_status
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists events_guard_organizer_status on public.events;
create trigger events_guard_organizer_status
  before insert or update of organizer_id on public.events
  for each row execute function public.events_guard_organizer_status();

-- Never blocks the mutation it observes (same contract as log_event_change).
create or replace function public.log_event_organizer_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'event.organizer_changed', 'event', new.id,
          jsonb_build_object(
            'title', new.title,
            'from_organizer_id', old.organizer_id,
            'to_organizer_id', new.organizer_id
          ));
  return new;
end;
$$;

drop trigger if exists events_audit_organizer_change on public.events;
create trigger events_audit_organizer_change
  after update of organizer_id on public.events
  for each row
  when (old.organizer_id is distinct from new.organizer_id)
  execute function public.log_event_organizer_change();

-- ------------------------------------------------------------
-- 2. Admin: assign a user to an organizer team
-- ------------------------------------------------------------

create or replace function public.admin_assign_organizer_member(
  p_user_id       uuid,
  p_organizer_id  uuid default null,
  p_member_role   text default 'editor',
  p_new_organizer jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org       uuid := p_organizer_id;
  v_status    text;
  v_user      record;
  v_member    public.organizer_members%rowtype;
  v_outcome   text;
  v_prev_role text;
  v_created   boolean := false;
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if p_member_role is null or p_member_role not in ('owner', 'manager', 'editor') then
    raise exception 'Choose a team role: Owner, Manager or Editor.' using errcode = '22023';
  end if;
  if (p_organizer_id is null) = (p_new_organizer is null) then
    raise exception 'Choose an existing organizer or provide details for a new one.' using errcode = '22023';
  end if;

  select id, role, status into v_user from public.profiles where id = p_user_id;
  if v_user.id is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_user.status <> 'active' then
    raise exception 'This account is % and cannot join an organizer team. Restore access first.', v_user.status
      using errcode = '22023';
  end if;

  if p_new_organizer is not null then
    -- Reuses the admin entity pipeline, including its duplicate-organizer
    -- refusal, so a new profile is created in this same transaction.
    v_org := (public.admin_entity_save('organizer', null, p_new_organizer) ->> 'id')::uuid;
    v_created := true;
  end if;

  select status into v_status from public.organizers where id = v_org for update;
  if v_status is null then
    raise exception 'Organizer not found' using errcode = 'P0002';
  end if;
  if v_status <> 'active' then
    raise exception 'Organizer is % and cannot receive new team members. Activate it first.', v_status
      using errcode = '22023';
  end if;

  select * into v_member from public.organizer_members
   where organizer_id = v_org and user_id = p_user_id for update;

  if v_member.user_id is null then
    insert into public.organizer_members (organizer_id, user_id, member_role, status)
    values (v_org, p_user_id, p_member_role, 'active');
    v_outcome := 'created';
  elsif v_member.status = 'removed' then
    update public.organizer_members
       set member_role = p_member_role, status = 'active', updated_at = now()
     where organizer_id = v_org and user_id = p_user_id;
    v_outcome := 'reactivated';
    v_prev_role := v_member.member_role;
  elsif v_member.member_role = p_member_role then
    v_outcome := 'unchanged';
    v_prev_role := v_member.member_role;
  else
    if v_member.member_role = 'owner' and not exists (
      select 1 from public.organizer_members
       where organizer_id = v_org and status = 'active'
         and member_role = 'owner' and user_id <> p_user_id
    ) then
      raise exception 'This is the only active Owner of the organizer. Assign another Owner first.'
        using errcode = '23514';
    end if;
    update public.organizer_members
       set member_role = p_member_role, updated_at = now()
     where organizer_id = v_org and user_id = p_user_id;
    v_outcome := 'role_changed';
    v_prev_role := v_member.member_role;
  end if;

  if v_outcome <> 'unchanged' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'organizer.member_assigned', 'organizer', v_org,
            jsonb_build_object(
              'user_id', p_user_id,
              'member_role', p_member_role,
              'previous_role', v_prev_role,
              'outcome', v_outcome,
              'organizer_created', v_created
            ));
  end if;

  return jsonb_build_object(
    'organizer_id', v_org,
    'user_id', p_user_id,
    'member_role', p_member_role,
    'status', 'active',
    'outcome', v_outcome,
    'previous_role', v_prev_role,
    'organizer_created', v_created,
    'user_platform_role', v_user.role
  );
end;
$$;

-- ------------------------------------------------------------
-- 3. Admin: link an event to an organizer
-- ------------------------------------------------------------

create or replace function public.admin_set_event_organizer(
  p_event_id       uuid,
  p_organizer_id   uuid,
  p_confirm_change boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event  public.events%rowtype;
  v_status text;
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if p_organizer_id is null then
    raise exception 'Choose an organizer.' using errcode = '22023';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if v_event.artist_id is not null then
    raise exception 'Artist events cannot be assigned to an organizer.' using errcode = '22023';
  end if;

  select status into v_status from public.organizers where id = p_organizer_id;
  if v_status is null then
    raise exception 'Organizer not found' using errcode = 'P0002';
  end if;
  if v_status in ('archived', 'suspended') then
    raise exception 'Organizer is % and cannot receive events. Choose an active organizer.', v_status
      using errcode = '22023';
  end if;

  if v_event.organizer_id is not distinct from p_organizer_id then
    return jsonb_build_object('event_id', p_event_id, 'organizer_id', p_organizer_id,
                              'previous_organizer_id', v_event.organizer_id, 'changed', false);
  end if;
  if v_event.organizer_id is not null and not coalesce(p_confirm_change, false) then
    raise exception 'This event already belongs to another organizer. Confirm the change to continue.'
      using errcode = '22023';
  end if;

  -- Only organizer_id changes: status, schedule and other links are untouched.
  update public.events set organizer_id = p_organizer_id where id = p_event_id;

  return jsonb_build_object('event_id', p_event_id, 'organizer_id', p_organizer_id,
                            'previous_organizer_id', v_event.organizer_id, 'changed', true);
end;
$$;

-- ------------------------------------------------------------
-- 4. Admin read models
-- ------------------------------------------------------------

create or replace function public.admin_user_organizer_memberships(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'organizer_id', o.id,
      'organizer_name', o.name,
      'organizer_slug', o.slug,
      'organizer_status', o.status,
      'member_role', m.member_role,
      'member_status', m.status,
      'event_count', (select count(*) from public.events e where e.organizer_id = o.id)
    ) order by o.name, o.id)
    from public.organizer_members m
    join public.organizers o on o.id = m.organizer_id
    where m.user_id = p_user_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_organizer_team(p_organizer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org record;
begin
  if not public.is_admin() or not public.account_is_active(auth.uid()) then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  select id, name, status into v_org from public.organizers where id = p_organizer_id;
  if v_org.id is null then
    raise exception 'Organizer not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'organizer_id', v_org.id,
    'organizer_name', v_org.name,
    'organizer_status', v_org.status,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'display_name', p.display_name,
        'username', p.username,
        'email', u.email,
        'account_status', p.status,
        'member_role', m.member_role,
        'member_status', m.status
      ) order by (m.status = 'active') desc,
                 array_position(array['owner','manager','editor'], m.member_role),
                 p.display_name, m.user_id)
      from public.organizer_members m
      join public.profiles p on p.id = m.user_id
      left join auth.users u on u.id = m.user_id
      where m.organizer_id = p_organizer_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------
-- 5. Grants: authenticated callers only; each function checks admin itself.
-- ------------------------------------------------------------

revoke execute on function public.admin_assign_organizer_member(uuid, uuid, text, jsonb) from public, anon;
revoke execute on function public.admin_set_event_organizer(uuid, uuid, boolean) from public, anon;
revoke execute on function public.admin_user_organizer_memberships(uuid) from public, anon;
revoke execute on function public.admin_organizer_team(uuid) from public, anon;
grant  execute on function public.admin_assign_organizer_member(uuid, uuid, text, jsonb) to authenticated;
grant  execute on function public.admin_set_event_organizer(uuid, uuid, boolean) to authenticated;
grant  execute on function public.admin_user_organizer_memberships(uuid) to authenticated;
grant  execute on function public.admin_organizer_team(uuid) to authenticated;

revoke execute on function public.events_guard_organizer_status() from public, anon, authenticated;
revoke execute on function public.log_event_organizer_change() from public, anon, authenticated;

notify pgrst, 'reload schema';

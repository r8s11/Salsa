-- Match admin_entity_save's organizer identity: normalized name, the same
-- city (including NULL), and the same website (NULL and empty are equivalent).
-- Archived profiles still count, as they do in admin_entity_save.
-- Hold the write lock from the precheck through index creation so a concurrent
-- insert cannot slip in between them. No organizer rows are changed.
do $$
declare
  v_dupes text;
begin
  lock table public.organizers in share mode;
  select string_agg(d.records, E'\n' order by d.records)
    into v_dupes
    from (
      select string_agg(format('%s (%s)', id, name), ', ' order by id) as records
        from public.organizers
       group by public.flyer_norm_text(name), primary_city, coalesce(website, '')
      having count(*) > 1
    ) d;
  if v_dupes is not null then
    raise exception using errcode = '23505',
      message = 'Duplicate organizer profiles exist; resolve these records before rerunning the migration.',
      detail = v_dupes;
  end if;

  create unique index if not exists organizers_identity_uidx
    on public.organizers (public.flyer_norm_text(name), primary_city, (coalesce(website, '')))
    nulls not distinct;
end $$;

-- Keep the assignment transaction and grants; translate organizer identity conflicts.
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
  v_constraint text;
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
    begin
      v_org := (public.admin_entity_save('organizer', null, p_new_organizer) ->> 'id')::uuid;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint in ('organizers_identity_uidx', 'organizers_slug_unique_idx')
         or sqlerrm = 'Duplicate or ambiguous organizer' then
        raise exception 'An organizer named % already exists. Assign the user to it instead.',
          btrim(p_new_organizer ->> 'name') using errcode = '23505';
      end if;
      raise;
    end;
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

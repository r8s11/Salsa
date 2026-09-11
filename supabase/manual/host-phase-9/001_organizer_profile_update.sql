-- =====================================================================
-- Phase 9 — Organizer Profile Update RPC
--
-- Purpose:
--   Allow active organizer owners and managers to update their
--   organizer's canonical brand/profile information through a secure
--   RPC boundary, rather than granting broad direct UPDATE access.
--
-- Authorization:
--   - Authenticated user with active account
--   - Active membership on the target organizer
--   - member_role in ('owner', 'manager')
--   - Admins are exempt from membership check (preserving existing pattern)
--
-- Field whitelist:
--   name, description, logo_url, website, instagram, organizer_type, primary_city
--
-- Immutable fields (enforced by the RPC):
--   id, slug, status, created_at, updated_at
--
-- Execution: standalone. Safe after Phase 6 migration set.
-- =====================================================================

create or replace function public.organizer_update_profile(
  p_organizer_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      public.organizers%rowtype;
  v_role     text;
  v_keys     text[];
  v_bad      text[];
  v_allowed  constant text[] := array[
    'name','description','logo_url','website','instagram',
    'organizer_type','primary_city'
  ];
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.account_is_active(auth.uid()) then
    raise exception 'account is not active' using errcode = '42501';
  end if;
  if p_payload is null or p_payload = '{}'::jsonb then
    raise exception 'nothing to update' using errcode = '22023';
  end if;

  -- Validate field whitelist
  select array_agg(k) into v_keys from jsonb_object_keys(p_payload) as k;
  select array_agg(k order by k)
    into v_bad
    from unnest(v_keys) as keys(k)
   where not (k = any(v_allowed));
  if v_bad is not null and cardinality(v_bad) > 0 then
    raise exception 'field not editable: %', v_bad using errcode = '42501';
  end if;

  -- Validate name is non-empty when provided
  if p_payload ? 'name' and nullif(btrim(p_payload ->> 'name'), '') is null then
    raise exception 'name must not be empty' using errcode = '22023';
  end if;

  -- Validate organizer_type constraint
  if p_payload ? 'organizer_type' and p_payload ->> 'organizer_type' is not null then
    if not (p_payload ->> 'organizer_type' in (
      'promoter','dance-studio','dj','venue','dance-company','festival','independent','other'
    )) then
      raise exception 'invalid organizer_type' using errcode = '22023';
    end if;
  end if;

  -- Load organizer
  select * into v_org from public.organizers where id = p_organizer_id for update;
  if v_org.id is null then
    raise exception 'organizer not found' using errcode = 'P0002';
  end if;

  -- Authorization: admin exempt, otherwise require active owner/manager
  if not public.is_admin() then
    v_role := public.organizer_member_role(p_organizer_id);
    if v_role is null or v_role not in ('owner', 'manager') then
      raise exception 'active owner or manager membership required' using errcode = '42501';
    end if;
  else
    v_role := 'platform';
  end if;

  update public.organizers o set
    name           = case when p_payload ? 'name'           then btrim(p_payload ->> 'name')           else o.name           end,
    description    = case when p_payload ? 'description'    then p_payload ->> 'description'           else o.description    end,
    logo_url       = case when p_payload ? 'logo_url'       then nullif(btrim(p_payload ->> 'logo_url'), '') else o.logo_url  end,
    website        = case when p_payload ? 'website'        then nullif(btrim(p_payload ->> 'website'), '')  else o.website   end,
    instagram      = case when p_payload ? 'instagram'      then nullif(btrim(p_payload ->> 'instagram'), '') else o.instagram end,
    organizer_type = case when p_payload ? 'organizer_type' then p_payload ->> 'organizer_type'        else o.organizer_type end,
    primary_city   = case when p_payload ? 'primary_city'   then nullif(btrim(p_payload ->> 'primary_city'), '') else o.primary_city end,
    updated_at     = now()
   where o.id = p_organizer_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'organizer.profile_updated', 'organizer', p_organizer_id,
          jsonb_build_object('member_role', v_role, 'fields', v_keys));
end;
$$;

revoke execute on function public.organizer_update_profile(uuid, jsonb) from public, anon;
grant  execute on function public.organizer_update_profile(uuid, jsonb) to authenticated;

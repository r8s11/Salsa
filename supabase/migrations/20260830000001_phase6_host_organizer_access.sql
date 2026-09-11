-- =====================================================================
-- Phase 6 — Host Dashboard Organizer Access Foundation
--
-- Purpose:
--   Establish the authorization foundation the future Host Dashboard
--   relies on: which organizers the authenticated user manages, which
--   events belong to those organizers, and a mutation seam that denies
--   cross-organizer access independently of the frontend.
--
--   Account/User -> Organizer Membership -> Organizer -> Event.
--   No parallel event/organizer models are introduced; canonical events
--   gain a nullable organizer_id link.
--
-- Required: REQUIRED before deploying Phase 6 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: standalone. Safe after any prior migration set; the
--   organizers cluster is created-once (mirrors reconcile-prod-schema.sql
--   so a fresh local stack has the same shape production already has).
--
-- Tables affected:
--   public.organizers / organizer_requests / organizer_members (create-once
--   mirror + RLS policies), public.events (organizer_id + read policy).
--
-- Data impact: no existing row is changed when this file runs.
--   events.organizer_id starts null everywhere; linking events to
--   organizers is a later, deliberate data operation.
--
-- Safety notes:
--   - Membership predicates are SECURITY DEFINER so RLS on
--     organizer_members cannot filter them out for non-admin callers.
--   - Organizer members get READ access to their organizers' events via
--     RLS. Mutation never happens through a broad UPDATE policy: it goes
--     through public.organizer_update_event(), which verifies an active
--     owner/manager membership (admin/moderator exempt, preserving current
--     tooling), whitelists editable fields, and can never change status,
--     ownership, or submitter identity.
--   - Platform role alone grants nothing here: access derives from
--     organizer_members rows created by the existing approval flow
--     (admin_approve_organizer_request) or by admin tooling.
--
-- Rollback considerations:
--   Drop the three member-read policies, the two helper functions, the
--   organizer_update_event RPC, and finally events.organizer_id. Linked
--   organizer ids are lost with the column; membership rows are untouched.
-- =====================================================================

-- ------------------------------------------------------------
-- 1. Organizers cluster (create-once mirror of reconcile-prod-schema.sql)
-- ------------------------------------------------------------

create table if not exists public.organizers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique,
  description     text,
  logo_url        text,
  website         text,
  instagram       text,
  organizer_type  text,
  primary_city    text,
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.organizers drop constraint if exists organizers_status_check;
alter table public.organizers add constraint organizers_status_check
  check (status in ('active', 'suspended', 'archived'));

alter table public.organizers drop constraint if exists organizers_type_check;
alter table public.organizers add constraint organizers_type_check
  check (organizer_type is null or organizer_type in ('promoter','dance-studio','dj','venue','dance-company','festival','independent','other'));

create table if not exists public.organizer_requests (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  proposed_organizer_id uuid references public.organizers(id) on delete set null,
  proposed_name         text,
  organizer_type        text,
  description           text,
  website               text,
  instagram             text,
  primary_city          text,
  request_message       text,
  status                text not null default 'pending',
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  rejection_reason_code text,
  rejection_message     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.organizer_requests drop constraint if exists organizer_requests_status_check;
alter table public.organizer_requests add constraint organizer_requests_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.organizer_requests drop constraint if exists organizer_requests_reason_check;
alter table public.organizer_requests add constraint organizer_requests_reason_check
  check (rejection_reason_code is null or rejection_reason_code in ('insufficient_information','unable_to_verify_organizer','account_activity_concerns','duplicate_organizer_brand','not_currently_eligible','other'));

alter table public.organizer_requests drop constraint if exists organizer_requests_brand_required;
alter table public.organizer_requests add constraint organizer_requests_brand_required
  check (proposed_organizer_id is not null or nullif(btrim(coalesce(proposed_name, '')), '') is not null);

create table if not exists public.organizer_members (
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  member_role  text not null default 'owner',
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (organizer_id, user_id)
);

alter table public.organizer_members drop constraint if exists organizer_members_role_check;
alter table public.organizer_members add constraint organizer_members_role_check
  check (member_role in ('owner', 'manager', 'editor'));

alter table public.organizer_members drop constraint if exists organizer_members_status_check;
alter table public.organizer_members add constraint organizer_members_status_check
  check (status in ('active', 'removed'));

create unique index if not exists organizers_slug_unique_idx on public.organizers (slug);
create index if not exists organizers_status_idx on public.organizers (status);
create index if not exists organizer_requests_user_id_idx on public.organizer_requests (user_id);
create index if not exists organizer_requests_status_created_idx on public.organizer_requests (status, created_at desc);
create index if not exists organizer_members_user_id_idx on public.organizer_members (user_id);

-- ------------------------------------------------------------
-- 2. events -> organizers link
-- ------------------------------------------------------------

alter table public.events
  add column if not exists organizer_id uuid references public.organizers(id) on delete set null;

create index if not exists events_organizer_id_idx on public.events (organizer_id);

-- ------------------------------------------------------------
-- 3. Auth helpers
-- ------------------------------------------------------------

-- Mirrors reconcile-prod-schema.sql; create-or-replace keeps local and prod
-- definitions identical.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- Single membership predicate. SECURITY DEFINER because organizer_members
-- carries admin-managed RLS: an invoker-style function would see zero rows
-- for non-admin callers and silently deny every member.
create or replace function public.is_active_organizer_member(p_organizer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.organizer_members m
      join public.organizers o on o.id = m.organizer_id
     where m.organizer_id = p_organizer_id
       and m.user_id = auth.uid()
       and m.status = 'active'
       and o.status = 'active'
  );
$$;

-- Active membership role for the caller, null when there is none.
create or replace function public.organizer_member_role(p_organizer_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.member_role
    from public.organizer_members m
   where m.organizer_id = p_organizer_id
     and m.user_id = auth.uid()
     and m.status = 'active';
$$;

revoke execute on function public.is_active_organizer_member(uuid) from public, anon;
grant  execute on function public.is_active_organizer_member(uuid) to authenticated;
revoke execute on function public.organizer_member_role(uuid) from public, anon;
grant  execute on function public.organizer_member_role(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------

alter table public.organizers enable row level security;
alter table public.organizer_requests enable row level security;
alter table public.organizer_members enable row level security;

drop policy if exists "Admins manage organizers" on public.organizers;
create policy "Admins manage organizers" on public.organizers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Members can read organizers they are actively attached to. Write access
-- stays admin-only, and moderators retain their existing RPC-scoped access.
drop policy if exists "Members read managed organizers" on public.organizers;
create policy "Members read managed organizers" on public.organizers for select to authenticated
  using (public.is_active_organizer_member(id) or public.is_admin());

drop policy if exists "Admins read organizer requests" on public.organizer_requests;
create policy "Admins read organizer requests" on public.organizer_requests for select to authenticated using (public.is_admin());

drop policy if exists "Users create own organizer requests" on public.organizer_requests;
create policy "Users create own organizer requests" on public.organizer_requests for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Admins update organizer requests" on public.organizer_requests;
create policy "Admins update organizer requests" on public.organizer_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage organizer members" on public.organizer_members;
create policy "Admins manage organizer members" on public.organizer_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Members read their own membership rows (any status, so a removed member
-- can see the removal; management stays admin-only).
drop policy if exists "Members read own memberships" on public.organizer_members;
create policy "Members read own memberships" on public.organizer_members for select to authenticated
  using (user_id = auth.uid());

-- Members read their organizers' events in every status — the Host area
-- must see drafts and pending rows the public select policy hides.
drop policy if exists "Organizer members read own organizer events" on public.events;
create policy "Organizer members read own organizer events" on public.events for select to authenticated
  using (organizer_id is not null and public.is_active_organizer_member(organizer_id));

-- ------------------------------------------------------------
-- 5. Organizer event mutation seam
-- ------------------------------------------------------------

-- Updates an organizer-owned event on behalf of an active owner/manager of
-- the event's organizer. Admins keep their existing direct policy and are
-- exempt from the membership check here. Moderators are not elevated by
-- this RPC. Field whitelist:
-- status, organizer_id, submitter identity, source_type, venue_id and
-- everything else not listed is structurally immutable through this seam.
create or replace function public.organizer_update_event(p_event_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event    public.events%rowtype;
  v_role     text;
  v_keys     text[];
  v_bad      text[];
  v_allowed  constant text[] := array[
    'title','description','event_type','city','event_date','event_time',
    'location','address','price_type','price_amount','rsvp_link','recurrence',
    'contact_email','contact_instagram','contact_website','image_url','host',
    'dance_styles'
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
  if p_payload ? 'title' and nullif(btrim(p_payload ->> 'title'), '') is null then
    raise exception 'title must not be empty' using errcode = '22023';
  end if;

  select array_agg(k) into v_keys from jsonb_object_keys(p_payload) as k;
  select array_agg(k order by k)
    into v_bad
    from unnest(v_keys) as keys(k)
   where not (k = any(v_allowed));
  if v_bad is not null and cardinality(v_bad) > 0 then
    raise exception 'field not editable by organizers: %', v_bad using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if not public.is_admin() then
    if v_event.organizer_id is null then
      raise exception 'event is not organizer-owned' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.organizers
       where id = v_event.organizer_id
         and status = 'active'
    ) then
      raise exception 'organizer is not active' using errcode = '42501';
    end if;
    v_role := public.organizer_member_role(v_event.organizer_id);
    if v_role is null or v_role not in ('owner', 'manager') then
      raise exception 'active owner or manager membership required' using errcode = '42501';
    end if;
  else
    v_role := 'platform';
  end if;

  update public.events e set
    title              = case when p_payload ? 'title'              then p_payload ->> 'title'              else e.title              end,
    description        = case when p_payload ? 'description'        then p_payload ->> 'description'        else e.description        end,
    event_type         = case when p_payload ? 'event_type'         then p_payload ->> 'event_type'         else e.event_type         end,
    city               = case when p_payload ? 'city'               then p_payload ->> 'city'               else e.city               end,
    event_date         = case when p_payload ? 'event_date'         then (p_payload ->> 'event_date')::timestamptz else e.event_date   end,
    event_time         = case when p_payload ? 'event_time'         then p_payload ->> 'event_time'         else e.event_time         end,
    location           = case when p_payload ? 'location'           then p_payload ->> 'location'           else e.location           end,
    address            = case when p_payload ? 'address'            then p_payload ->> 'address'            else e.address            end,
    price_type         = case when p_payload ? 'price_type'         then p_payload ->> 'price_type'         else e.price_type         end,
    price_amount       = case when p_payload ? 'price_amount'       then (p_payload ->> 'price_amount')::numeric  else e.price_amount  end,
    rsvp_link          = case when p_payload ? 'rsvp_link'          then p_payload ->> 'rsvp_link'          else e.rsvp_link          end,
    recurrence         = case when p_payload ? 'recurrence'         then p_payload ->> 'recurrence'         else e.recurrence         end,
    contact_email      = case when p_payload ? 'contact_email'      then p_payload ->> 'contact_email'      else e.contact_email      end,
    contact_instagram  = case when p_payload ? 'contact_instagram'  then p_payload ->> 'contact_instagram'  else e.contact_instagram  end,
    contact_website    = case when p_payload ? 'contact_website'    then p_payload ->> 'contact_website'    else e.contact_website    end,
    image_url          = case when p_payload ? 'image_url'          then p_payload ->> 'image_url'          else e.image_url          end,
    host               = case when p_payload ? 'host'               then p_payload ->> 'host'               else e.host               end,
    dance_styles       = case when p_payload ? 'dance_styles'
                              then (select coalesce(array_agg(x), '{}')
                                      from jsonb_array_elements_text(p_payload -> 'dance_styles') as x)
                              else e.dance_styles end
   where e.id = p_event_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'event.organizer_updated', 'event', p_event_id,
          jsonb_build_object(
            'organizer_id', v_event.organizer_id,
            'member_role', v_role,
            'fields', v_keys
          ));
end;
$$;

revoke execute on function public.organizer_update_event(uuid, jsonb) from public, anon;
grant  execute on function public.organizer_update_event(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 6. Grants
-- ------------------------------------------------------------

grant select, insert, update on public.organizers to authenticated;
grant select, insert, update on public.organizer_requests to authenticated;
grant select, insert, update on public.organizer_members to authenticated;

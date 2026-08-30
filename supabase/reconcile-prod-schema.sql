-- Consolidated production schema reconciliation — all phases.
-- NOT `supabase db push` / `db reset` — those reset the entire local
-- database and cannot safely target production.
--
-- Covers every migration from the baseline through Phase 13 (analytics):
--   Phase 1–2  events baseline, profiles, audit_logs
--   Phase 3    events management fields (source_type, dance_styles, etc.)
--   Phase 4    dashboard indexes
--   Phase 5    user management (admin_set_user_role/status, account_is_active)
--   Phase 6    admin_user_directory email_confirmed_at
--   Phase 7    event_submissions, is_moderator
--   Phase 8    organizer requests + venues
--   Phase 9    venue directory + merge
--   Phase 11   platform_settings + submission gate RPCs
--   Phase 12   audit log view, RPC, indexes, constraints
--   Phase 13   analytics views, RPCs, indexes
--   Moderator  CSV import permissions + event_import_batches
--
-- Every statement is idempotent. Safe to run more than once against any
-- production database at Phase 5 or later. Never drops or rewrites data.
--
-- admin_user_directory() uses DROP+CREATE (not CREATE OR REPLACE) because
-- Postgres rejects CREATE OR REPLACE when a set-returning function's column
-- list changes. All other functions use CREATE OR REPLACE where safe.

begin;

-- ============================================================
-- 1. Core tables
-- ============================================================

-- 1a. events (baseline)
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  event_type      text check (event_type in ('social', 'workshop', 'class')),
  event_date      timestamp with time zone not null,
  event_time      text,
  location        text,
  address         text,
  price_type      text check (price_type in ('free', 'paid')),
  price_amount    numeric(10, 2),
  rsvp_link       text,
  image_url       text,
  status          text default 'approved',
  submitter_name  text,
  submitter_email text,
  created_at      timestamp with time zone default now(),
  city            text check (city in ('boston', 'new-york-city')) default 'boston'
);

-- Phase 1 additions
alter table public.events
  add column if not exists host text,
  add column if not exists recurrence text,
  add column if not exists gallery text[];

-- Phase 2 additions
alter table public.events
  add column if not exists submitter_id uuid references auth.users(id),
  add column if not exists contact_email text,
  add column if not exists contact_instagram text,
  add column if not exists contact_website text;

-- Phase 3 additions
alter table public.events
  add column if not exists source_type text not null default 'user_submission',
  add column if not exists dance_styles text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancellation_reason text;

-- Phase 9 addition
alter table public.events add column if not exists venue_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_venue_id_fkey' and conrelid = 'public.events'::regclass) then
    alter table public.events add constraint events_venue_id_fkey foreign key (venue_id) references public.venues(id);
  end if;
end;
$$;

-- Constraints
alter table public.events drop constraint if exists events_source_type_check;
alter table public.events
  add constraint events_source_type_check
  check (source_type in ('admin','user_submission','organizer','moderator','imported'));

alter table public.events drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
  check (status in ('draft','pending','approved','rejected','cancelled','archived'));

-- 1b. profiles
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  role         text not null default 'user'
                 check (role in ('user', 'moderator', 'organizer', 'admin')),
  status       text not null default 'active'
                 check (status in ('active', 'flagged', 'suspended', 'banned')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles
  add column if not exists username      text,
  add column if not exists status_reason text;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$');

-- One-time backfill for every existing auth user; ON CONFLICT makes rerunning safe.
insert into public.profiles (id, display_name, role)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
       case when (u.raw_app_meta_data ->> 'role') = 'admin' then 'admin' else 'user' end
from auth.users u
on conflict (id) do nothing;

-- 1c. audit_logs
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- Phase 12 extensions
alter table public.audit_logs
  add column if not exists before_state jsonb,
  add column if not exists after_state  jsonb,
  add column if not exists reason       text,
  add column if not exists target_type  text,
  add column if not exists target_id    uuid,
  add column if not exists target_name  text;

-- Phase 12 constraints
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_target_type_check'
  ) then
    alter table public.audit_logs
      add constraint audit_logs_target_type_check
      check (target_type is null or target_type in (
        'event', 'event_submission', 'profile', 'organizer',
        'venue', 'taxonomy_term', 'platform_settings'
      ));
  end if;
end;
$$;

alter table public.audit_logs
  alter column action set not null,
  alter column entity_type set not null;

-- 1d. event_submissions (Phase 7)
create table if not exists public.event_submissions (
  id                      uuid        primary key default gen_random_uuid(),
  submitter_id            uuid        null references auth.users(id),
  submitter_email         text        null,
  submitter_name          text        null,
  status                  text        not null default 'pending',
  submitted_data          jsonb       not null,
  edited_data             jsonb       null,
  submitted_at            timestamptz not null default now(),
  reviewed_by             uuid        null references auth.users(id),
  reviewed_at             timestamptz null,
  rejection_reason        text        null,
  rejection_message       text        null,
  internal_note           text        null,
  duplicate_of_event_id   uuid        null references public.events(id) on delete set null,
  dismissed_duplicate_ids uuid[]      not null default '{}',
  approved_event_id       uuid        null references public.events(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.event_submissions
  drop constraint if exists event_submissions_status_check;
alter table public.event_submissions
  add constraint event_submissions_status_check
  check (status in (
    'pending', 'in_review', 'needs_information',
    'approved', 'rejected', 'withdrawn'
  ));

alter table public.event_submissions
  drop constraint if exists event_submissions_rejection_reason_check;
alter table public.event_submissions
  add constraint event_submissions_rejection_reason_check
  check (rejection_reason is null or rejection_reason in (
    'duplicate', 'missing_information', 'invalid_venue',
    'cannot_verify', 'spam', 'inappropriate',
    'out_of_scope', 'other'
  ));

-- 1e. organizers cluster (Phase 8)
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

alter table public.organizers
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists logo_url text,
  add column if not exists website text,
  add column if not exists instagram text,
  add column if not exists organizer_type text,
  add column if not exists primary_city text,
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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

alter table public.organizer_requests
  add column if not exists proposed_organizer_id uuid references public.organizers(id) on delete set null,
  add column if not exists proposed_name text,
  add column if not exists organizer_type text,
  add column if not exists description text,
  add column if not exists website text,
  add column if not exists instagram text,
  add column if not exists primary_city text,
  add column if not exists request_message text,
  add column if not exists status text not null default 'pending',
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason_code text,
  add column if not exists rejection_message text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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

-- 1f. venues (Phase 9)
create table if not exists public.venues (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  slug                 text unique,
  address_line1        text,
  address_line2        text,
  city                 text,
  state_region         text,
  postal_code          text,
  country              text not null default 'US',
  latitude             numeric(10, 8),
  longitude            numeric(11, 8),
  timezone             text,
  website              text,
  instagram            text,
  phone                text,
  status               text not null default 'active',
  normalized_name      text,
  normalized_address   text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.venues
  add column if not exists slug text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state_region text,
  add column if not exists postal_code text,
  add column if not exists country text not null default 'US',
  add column if not exists latitude numeric(10, 8),
  add column if not exists longitude numeric(11, 8),
  add column if not exists timezone text,
  add column if not exists website text,
  add column if not exists instagram text,
  add column if not exists phone text,
  add column if not exists status text not null default 'active',
  add column if not exists normalized_name text,
  add column if not exists normalized_address text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.venues drop constraint if exists venues_status_check;
alter table public.venues add constraint venues_status_check
  check (status in ('active', 'needs_review', 'archived'));

-- 1g. event_import_batches (moderator CSV import)
create table if not exists public.event_import_batches (
  id                      uuid primary key default gen_random_uuid(),
  imported_by             uuid references auth.users(id),
  filename                text not null,
  total_rows              integer not null,
  created_count           integer not null,
  duplicate_skipped_count integer not null,
  failed_count            integer not null,
  created_at              timestamptz not null default now()
);

-- 1h. platform_settings (Phase 11 — singleton runtime config)
create table if not exists public.platform_settings (
  singleton boolean primary key default true,
  platform_name text not null,
  public_site_url text not null,
  support_email text not null,
  default_city text not null,
  default_country_code text not null,
  default_timezone text not null,
  default_locale text not null,
  default_currency_code text not null,
  default_event_duration_minutes integer not null,
  allow_public_event_suggestions boolean not null,
  allow_registered_user_submissions boolean not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_singleton_check') then
    alter table public.platform_settings add constraint platform_settings_singleton_check check (singleton);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_name_check') then
    alter table public.platform_settings add constraint platform_settings_name_check check (char_length(btrim(platform_name)) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_site_url_check') then
    alter table public.platform_settings add constraint platform_settings_site_url_check check (public_site_url ~ '^https://[^[:space:]]+$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_support_email_check') then
    alter table public.platform_settings add constraint platform_settings_support_email_check check (position('@' in support_email) > 1);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_city_check') then
    alter table public.platform_settings add constraint platform_settings_city_check check (default_city in ('boston', 'new-york-city'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_country_check') then
    alter table public.platform_settings add constraint platform_settings_country_check check (default_country_code = 'US');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_timezone_check') then
    alter table public.platform_settings add constraint platform_settings_timezone_check check (default_timezone = 'America/New_York');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_locale_check') then
    alter table public.platform_settings add constraint platform_settings_locale_check check (default_locale = 'en-US');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_currency_check') then
    alter table public.platform_settings add constraint platform_settings_currency_check check (default_currency_code = 'USD');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_duration_check') then
    alter table public.platform_settings add constraint platform_settings_duration_check check (
      default_event_duration_minutes between 30 and 720
      and mod(default_event_duration_minutes, 30) = 0
    );
  end if;
end;
$$;

-- ============================================================
-- 2. Helper functions (security, utilities)
-- ============================================================

-- Service-role-only account dependency check for account deletion.
-- It returns only a blocker category, never protected-row metadata.
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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'moderator');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create or replace function public.account_is_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select status = 'active' from public.profiles where id = p_user_id), true);
$$;

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g')), ''), 'item');
$$;

create or replace function public.category_of(p_action text, p_entity_type text)
returns text
language sql
stable
as $$
  select case
    when p_action in ('user.banned', 'user.suspended', 'user.role_changed',
                      'platform_settings.access_policy_changed') then 'security'
    when p_entity_type = 'platform_settings' then 'settings'
    when p_entity_type = 'event' then 'events'
    when p_entity_type = 'event_submission' then 'submissions'
    when p_entity_type = 'profile' or p_entity_type = 'organizer' then 'users'
    when p_entity_type = 'venue' then 'venues'
    when p_entity_type = 'taxonomy_term' then 'taxonomy'
    else 'events'
  end;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ============================================================
-- 3. Trigger functions
-- ============================================================

create or replace function public.log_event_change()
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
        when 'cancelled' then 'event.cancelled'
        when 'archived' then 'event.archived'
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

create or replace function public.log_submission_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action    text;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action    := 'submission.created';
    v_entity_id := new.id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      coalesce(auth.uid(), new.submitter_id),
      v_action,
      'event_submission',
      v_entity_id,
      jsonb_build_object(
        'title',           new.submitted_data ->> 'title',
        'to_status',       new.status,
        'submitter_email', new.submitter_email
      )
    );
    return new;
  end if;

  v_entity_id := new.id;

  if old.status is distinct from new.status then
    v_action := case new.status
      when 'approved'  then 'submission.approved'
      when 'rejected'  then 'submission.rejected'
      when 'withdrawn' then 'submission.withdrawn'
      else 'submission.status_changed'
    end;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      v_action,
      'event_submission',
      v_entity_id,
      jsonb_build_object(
        'title',             coalesce(new.submitted_data ->> 'title', old.submitted_data ->> 'title'),
        'from_status',       old.status,
        'to_status',         new.status,
        'rejection_reason',  new.rejection_reason,
        'approved_event_id', new.approved_event_id
      )
    );
  elsif old.edited_data is distinct from new.edited_data then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'submission.edited',
      'event_submission',
      v_entity_id,
      jsonb_build_object(
        'title',  coalesce(new.submitted_data ->> 'title', old.submitted_data ->> 'title'),
        'fields', (
          select jsonb_agg(key)
            from jsonb_each_text(coalesce(new.edited_data, '{}'::jsonb)) as kv(key, val)
           where coalesce(new.edited_data ->> key, '') is distinct from
                 coalesce(old.edited_data ->> key, '')
        )
      )
    );
  end if;

  return new;
end;
$$;

create or replace function public.set_organizer_slug()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 1;
begin
  if new.slug is null or btrim(new.slug) = '' then
    v_base := public.slugify(new.name);
    v_candidate := v_base;
    while exists (select 1 from public.organizers o where o.slug = v_candidate and o.id is distinct from new.id) loop
      v_suffix := v_suffix + 1;
      v_candidate := v_base || '-' || v_suffix::text;
    end loop;
    new.slug := v_candidate;
  else
    new.slug := public.slugify(new.slug);
  end if;
  return new;
end;
$$;

create or replace function public.set_venue_derived_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 1;
begin
  new.normalized_name := lower(btrim(regexp_replace(coalesce(new.name, ''), '\s+', ' ', 'g')));
  new.normalized_address := lower(btrim(regexp_replace(concat_ws(' ', new.address_line1, new.address_line2, new.city, new.state_region, new.postal_code), '\s+', ' ', 'g')));
  if new.slug is null or btrim(new.slug) = '' then
    v_base := public.slugify(new.name);
    v_candidate := v_base;
    while exists (select 1 from public.venues v where v.slug = v_candidate and v.id is distinct from new.id) loop
      v_suffix := v_suffix + 1;
      v_candidate := v_base || '-' || v_suffix::text;
    end loop;
    new.slug := v_candidate;
  else
    new.slug := public.slugify(new.slug);
  end if;
  return new;
end;
$$;

create or replace function public.venue_quality_issues(p_venue public.venues)
returns text[]
language sql
stable
set search_path = public
as $$
  select array_remove(array[
    case when nullif(btrim(coalesce(p_venue.address_line1, '')), '') is null then 'missing_address'::text end,
    case when p_venue.latitude is null or p_venue.longitude is null then 'missing_coordinates'::text end,
    case when nullif(btrim(coalesce(p_venue.timezone, '')), '') is null then 'no_timezone'::text end,
    case when nullif(btrim(coalesce(p_venue.website, '')), '') is not null and p_venue.website !~* '^https?://' then 'invalid_website'::text end,
    case when exists (select 1 from public.venues other where other.id <> p_venue.id and other.normalized_name = p_venue.normalized_name and nullif(other.normalized_name, '') is not null) then 'possible_duplicate'::text end
  ], null)::text[];
$$;

create or replace function public.stamp_platform_settings_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

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

-- ============================================================
-- 4. Admin RPC functions
-- ============================================================

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_admins  int;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role.' using errcode = '42501';
  end if;
  if p_role not in ('user', 'moderator', 'organizer', 'admin') then
    raise exception 'Unknown role %', p_role using errcode = '22023';
  end if;

  select role into v_current from public.profiles where id = p_user_id for update;
  if v_current is null then
    raise exception 'No profile for %', p_user_id using errcode = 'P0002';
  end if;

  if v_current = 'admin' and p_role <> 'admin' then
    select count(*) into v_admins from public.profiles where role = 'admin';
    if v_admins <= 1 then
      raise exception 'This is the only Admin account. Promote another Admin first.'
        using errcode = '42501';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', p_role)
   where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'user.role_changed', 'profile', p_user_id,
          jsonb_build_object('from_role', v_current, 'to_role', p_role));
end;
$$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_role    text;
  v_admins  int;
  v_reason  text := nullif(btrim(p_reason), '');
  v_action  text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own account status.' using errcode = '42501';
  end if;
  if p_status not in ('active', 'flagged', 'suspended', 'banned') then
    raise exception 'Unknown status %', p_status using errcode = '22023';
  end if;
  if p_status = 'banned' and v_reason is null then
    raise exception 'A reason is required to ban an account.' using errcode = '22023';
  end if;

  select status, role into v_current, v_role
    from public.profiles where id = p_user_id for update;
  if v_current is null then
    raise exception 'No profile for %', p_user_id using errcode = 'P0002';
  end if;

  if v_role = 'admin' and p_status in ('suspended', 'banned') then
    select count(*) into v_admins
      from public.profiles where role = 'admin' and status = 'active';
    if v_admins <= 1 then
      raise exception 'This is the only active Admin account.' using errcode = '42501';
    end if;
  end if;

  update public.profiles
     set status        = p_status,
         status_reason = case when p_status = 'active' then null else v_reason end
   where id = p_user_id;

  update auth.users
     set banned_until = case when p_status = 'banned' then 'infinity'::timestamptz end
   where id = p_user_id;

  v_action := case
    when p_status = 'flagged'   then 'user.flagged'
    when p_status = 'suspended' then 'user.suspended'
    when p_status = 'banned'    then 'user.banned'
    when v_current = 'flagged'  then 'user.unflagged'
    else 'user.restored'
  end;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_action, 'profile', p_user_id,
          jsonb_build_object('from_status', v_current, 'to_status', p_status, 'reason', v_reason));
end;
$$;

-- admin_user_directory: DROP+CREATE (column list changed across phases).
drop function if exists public.admin_user_directory();

create function public.admin_user_directory()
returns table (
  kind                text,
  id                  text,
  user_id             uuid,
  email               text,
  display_name        text,
  username            text,
  avatar_url          text,
  role                text,
  status              text,
  status_reason       text,
  created_at          timestamptz,
  last_active_at      timestamptz,
  contributions       integer,
  pending_count       integer,
  email_confirmed_at  timestamptz,
  approved_count      integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  with profile_stats as (
    select e.submitter_id                                         as uid,
           count(*)::int                                          as total,
           count(*) filter (where e.status = 'pending')::int      as pending,
           count(*) filter (where e.status = 'approved')::int     as approved,
           max(e.created_at)                                       as last_event_at
      from public.events e
     where e.submitter_id is not null
     group by e.submitter_id
  ),
  guest_stats as (
    select lower(btrim(e.submitter_email))                                         as email,
           min(coalesce(nullif(btrim(e.submitter_name), ''), 'Guest Submitter'))    as name,
           count(*)::int                                                            as total,
           count(*) filter (where e.status = 'pending')::int                        as pending,
           count(*) filter (where e.status = 'approved')::int                       as approved,
           max(e.created_at)                                                         as last_event_at,
           min(e.created_at)                                                         as first_event_at
      from public.events e
     where e.submitter_id is null
       and e.source_type = 'user_submission'
       and btrim(coalesce(e.submitter_email, '')) <> ''
     group by lower(btrim(e.submitter_email))
  )
  select 'profile'::text, p.id::text, p.id, u.email::text,
         p.display_name, p.username, p.avatar_url,
         p.role, p.status, p.status_reason, p.created_at,
         greatest(coalesce(u.last_sign_in_at, p.created_at),
                  coalesce(s.last_event_at, p.created_at)),
         coalesce(s.total, 0), coalesce(s.pending, 0),
         u.email_confirmed_at,
         coalesce(s.approved, 0)
    from public.profiles p
    join auth.users u on u.id = p.id
    left join profile_stats s on s.uid = p.id
  union all
  select 'guest'::text, 'guest:' || g.email, null::uuid, g.email,
         g.name, null::text, null::text,
         null::text, 'active', null::text, g.first_event_at,
         g.last_event_at, g.total, g.pending,
         null::timestamptz,
         coalesce(g.approved, 0)
    from guest_stats g
   where not exists (select 1 from auth.users u2 where lower(u2.email) = g.email);
end;
$$;

-- Organizer request RPCs (Phase 8)
drop function if exists public.admin_organizer_requests();
create function public.admin_organizer_requests()
returns table (
  id uuid,
  applicant_id text,
  applicant_kind text,
  applicant_user_id uuid,
  applicant_email text,
  applicant_display_name text,
  applicant_username text,
  applicant_avatar_url text,
  applicant_role text,
  applicant_status text,
  applicant_status_reason text,
  applicant_created_at timestamptz,
  applicant_email_confirmed_at timestamptz,
  applicant_contributions integer,
  applicant_approved_count integer,
  applicant_pending_count integer,
  proposed_organizer_id uuid,
  proposed_name text,
  organizer_type text,
  description text,
  website text,
  instagram text,
  primary_city text,
  request_message text,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason_code text,
  rejection_message text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  with event_stats as (
    select e.submitter_id as user_id,
           count(*)::int as contributions,
           count(*) filter (where e.status = 'approved')::int as approved_count,
           count(*) filter (where e.status = 'pending')::int as pending_count
      from public.events e
     where e.submitter_id is not null
     group by e.submitter_id
  )
  select r.id,
         p.id::text,
         'profile'::text,
         p.id,
         u.email::text,
         p.display_name,
         p.username,
         p.avatar_url,
         p.role,
         p.status,
         p.status_reason,
         p.created_at,
         u.email_confirmed_at,
         coalesce(s.contributions, 0),
         coalesce(s.approved_count, 0),
         coalesce(s.pending_count, 0),
         r.proposed_organizer_id,
         coalesce(r.proposed_name, o.name),
         coalesce(r.organizer_type, o.organizer_type),
         coalesce(r.description, o.description),
         coalesce(r.website, o.website),
         coalesce(r.instagram, o.instagram),
         coalesce(r.primary_city, o.primary_city),
         r.request_message,
         r.status,
         r.reviewed_by,
         r.reviewed_at,
         r.rejection_reason_code,
         r.rejection_message,
         r.created_at,
         r.updated_at
    from public.organizer_requests r
    join public.profiles p on p.id = r.user_id
    join auth.users u on u.id = p.id
    left join public.organizers o on o.id = r.proposed_organizer_id
    left join event_stats s on s.user_id = r.user_id
   order by r.created_at asc;
end;
$$;

drop function if exists public.admin_organizer_request_detail(uuid);
create function public.admin_organizer_request_detail(p_id uuid)
returns table (
  id uuid,
  applicant_id text,
  applicant_kind text,
  applicant_user_id uuid,
  applicant_email text,
  applicant_display_name text,
  applicant_username text,
  applicant_avatar_url text,
  applicant_role text,
  applicant_status text,
  applicant_status_reason text,
  applicant_created_at timestamptz,
  applicant_email_confirmed_at timestamptz,
  applicant_contributions integer,
  applicant_approved_count integer,
  applicant_pending_count integer,
  proposed_organizer_id uuid,
  proposed_name text,
  organizer_type text,
  description text,
  website text,
  instagram text,
  primary_city text,
  request_message text,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason_code text,
  rejection_message text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.admin_organizer_requests() where id = p_id;
$$;

drop function if exists public.admin_approve_organizer_request(uuid, uuid, text);
create function public.admin_approve_organizer_request(p_request_id uuid, p_reviewer_id uuid, p_internal_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.organizer_requests%rowtype;
  v_organizer_id uuid;
  v_name text;
begin
  if not public.is_admin() then raise exception 'admin role required' using errcode = '42501'; end if;

  select * into v_request from public.organizer_requests where id = p_request_id for update;
  if not found then raise exception 'Organizer request not found.' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then raise exception 'Organizer request is already %.', v_request.status using errcode = '22023'; end if;

  if v_request.proposed_organizer_id is null then
    v_name := nullif(btrim(coalesce(v_request.proposed_name, '')), '');
    if v_name is null then raise exception 'Organizer name is required.' using errcode = '22023'; end if;
    insert into public.organizers (name, description, website, instagram, organizer_type, primary_city, status)
    values (v_name, v_request.description, v_request.website, v_request.instagram, v_request.organizer_type, v_request.primary_city, 'active')
    returning id into v_organizer_id;
  else
    v_organizer_id := v_request.proposed_organizer_id;
  end if;

  insert into public.organizer_members (organizer_id, user_id, member_role, status)
  values (v_organizer_id, v_request.user_id, 'owner', 'active')
  on conflict (organizer_id, user_id) do update set member_role = 'owner', status = 'active', updated_at = now();

  update public.profiles set role = 'organizer' where id = v_request.user_id and role = 'user';
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'organizer') where id = v_request.user_id;

  update public.organizer_requests
     set status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now(), rejection_reason_code = null, rejection_message = null, proposed_organizer_id = v_organizer_id
   where id = p_request_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_reviewer_id, 'organizer_request.approved', 'organizer_request', p_request_id,
          jsonb_build_object('organizer_id', v_organizer_id, 'user_id', v_request.user_id, 'internal_note', nullif(btrim(coalesce(p_internal_note, '')), '')));
end;
$$;

drop function if exists public.admin_reject_organizer_request(uuid, uuid, text, text, text);
create function public.admin_reject_organizer_request(p_request_id uuid, p_reviewer_id uuid, p_reason_code text, p_reason_message text default null, p_internal_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.organizer_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'admin role required' using errcode = '42501'; end if;
  if p_reason_code not in ('insufficient_information','unable_to_verify_organizer','account_activity_concerns','duplicate_organizer_brand','not_currently_eligible','other') then
    raise exception 'Unknown rejection reason %', p_reason_code using errcode = '22023';
  end if;
  select * into v_request from public.organizer_requests where id = p_request_id for update;
  if not found then raise exception 'Organizer request not found.' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then raise exception 'Organizer request is already %.', v_request.status using errcode = '22023'; end if;

  update public.organizer_requests
     set status = 'rejected', reviewed_by = p_reviewer_id, reviewed_at = now(), rejection_reason_code = p_reason_code, rejection_message = nullif(btrim(coalesce(p_reason_message, '')), '')
   where id = p_request_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_reviewer_id, 'organizer_request.rejected', 'organizer_request', p_request_id,
          jsonb_build_object('user_id', v_request.user_id, 'reason_code', p_reason_code, 'reason_message', nullif(btrim(coalesce(p_reason_message, '')), ''), 'internal_note', nullif(btrim(coalesce(p_internal_note, '')), '')));
end;
$$;

drop function if exists public.admin_revoke_organizer_access(uuid, uuid, text);
create function public.admin_revoke_organizer_access(p_organizer_id uuid, p_reviewer_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required' using errcode = '42501'; end if;
  update public.organizer_members set status = 'removed', updated_at = now() where organizer_id = p_organizer_id and status = 'active';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_reviewer_id, 'organizer.access_revoked', 'organizer', p_organizer_id, jsonb_build_object('reason', nullif(btrim(coalesce(p_reason, '')), '')));
end;
$$;

drop function if exists public.admin_organizer_request_counts();
create function public.admin_organizer_request_counts()
returns table (id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required' using errcode = '42501'; end if;
  return query select r.id from public.organizer_requests r where r.status = 'pending';
end;
$$;

-- Venue RPCs (Phase 9)
drop function if exists public.admin_venue_directory(text, text[], text[], text[], boolean, text, integer, integer);
create function public.admin_venue_directory(
  p_search text default '',
  p_status text[] default null,
  p_city text[] default null,
  p_state text[] default null,
  p_has_upcoming boolean default null,
  p_sort text default 'name-asc',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  slug text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country text,
  latitude numeric,
  longitude numeric,
  timezone text,
  website text,
  instagram text,
  phone text,
  status text,
  upcoming_count integer,
  quality_issues text[],
  updated_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required' using errcode = '42501'; end if;
  return query
  with rows as (
    select v.*,
           coalesce((select count(*)::int from public.events e where e.venue_id = v.id and e.status = 'approved' and e.event_date >= now()), 0)::int as upcoming_count,
           public.venue_quality_issues(v) as quality_issues
      from public.venues v
     where (coalesce(btrim(p_search), '') = '' or v.name ilike '%' || p_search || '%' or coalesce(v.address_line1, '') ilike '%' || p_search || '%' or coalesce(v.city, '') ilike '%' || p_search || '%' or coalesce(v.postal_code, '') ilike '%' || p_search || '%')
       and (p_status is null or cardinality(p_status) = 0 or v.status = any(p_status))
       and (p_city is null or cardinality(p_city) = 0 or v.city = any(p_city))
       and (p_state is null or cardinality(p_state) = 0 or v.state_region = any(p_state))
  )
  select rows.id, rows.name, rows.slug, rows.address_line1, rows.address_line2, rows.city, rows.state_region, rows.postal_code, rows.country,
         rows.latitude, rows.longitude, rows.timezone, rows.website, rows.instagram, rows.phone, rows.status, rows.upcoming_count, rows.quality_issues, rows.updated_at, rows.created_at
    from rows
   where p_has_upcoming is null or (p_has_upcoming and rows.upcoming_count > 0) or (not p_has_upcoming and rows.upcoming_count = 0)
   order by
     case when p_sort = 'name-asc' then rows.name end asc,
     case when p_sort = 'name-desc' then rows.name end desc,
     case when p_sort = 'city-asc' then rows.city end asc nulls last,
     case when p_sort = 'city-desc' then rows.city end desc nulls last,
     case when p_sort = 'updated-desc' then rows.updated_at end desc,
     case when p_sort = 'updated-asc' then rows.updated_at end asc,
     case when p_sort = 'upcoming-desc' then rows.upcoming_count end desc,
     case when p_sort = 'upcoming-asc' then rows.upcoming_count end asc,
     rows.name asc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

drop function if exists public.admin_venue_detail(uuid);
create function public.admin_venue_detail(p_id uuid)
returns table (
  id uuid,
  name text,
  slug text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country text,
  latitude numeric,
  longitude numeric,
  timezone text,
  website text,
  instagram text,
  phone text,
  status text,
  upcoming_count integer,
  quality_issues text[],
  updated_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required' using errcode = '42501'; end if;
  return query
  select v.id, v.name, v.slug, v.address_line1, v.address_line2, v.city, v.state_region, v.postal_code, v.country,
         v.latitude, v.longitude, v.timezone, v.website, v.instagram, v.phone, v.status,
         coalesce((select count(*)::int from public.events e where e.venue_id = v.id and e.status = 'approved' and e.event_date >= now()), 0)::int,
         public.venue_quality_issues(v), v.updated_at, v.created_at
    from public.venues v
   where v.id = p_id;
end;
$$;

drop function if exists public.admin_venue_search(text, integer);
create function public.admin_venue_search(p_query text, p_limit integer default 10)
returns table (
  id uuid,
  name text,
  slug text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country text,
  latitude numeric,
  longitude numeric,
  timezone text,
  website text,
  instagram text,
  phone text,
  status text,
  upcoming_count integer,
  quality_issues text[],
  updated_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.admin_venue_directory(p_query, array['active','needs_review'], null, null, null, 'name-asc', greatest(coalesce(p_limit, 10), 1), 0)
  where nullif(btrim(coalesce(p_query, '')), '') is not null;
$$;

drop function if exists public.merge_venues(uuid, uuid);
create function public.merge_venues(p_keep_id uuid, p_merge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required' using errcode = '42501'; end if;
  if p_keep_id = p_merge_id then raise exception 'Choose two different venues.' using errcode = '22023'; end if;
  if not exists (select 1 from public.venues where id = p_keep_id) then raise exception 'Venue to keep not found.' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.venues where id = p_merge_id) then raise exception 'Venue to merge not found.' using errcode = 'P0002'; end if;

  update public.events set venue_id = p_keep_id where venue_id = p_merge_id;

  update public.venues keep
     set address_line1 = coalesce(keep.address_line1, merge.address_line1),
         address_line2 = coalesce(keep.address_line2, merge.address_line2),
         city = coalesce(keep.city, merge.city),
         state_region = coalesce(keep.state_region, merge.state_region),
         postal_code = coalesce(keep.postal_code, merge.postal_code),
         country = coalesce(keep.country, merge.country),
         latitude = coalesce(keep.latitude, merge.latitude),
         longitude = coalesce(keep.longitude, merge.longitude),
         timezone = coalesce(keep.timezone, merge.timezone),
         website = coalesce(keep.website, merge.website),
         instagram = coalesce(keep.instagram, merge.instagram),
         phone = coalesce(keep.phone, merge.phone)
    from public.venues merge
   where keep.id = p_keep_id and merge.id = p_merge_id;

  update public.venues set status = 'archived' where id = p_merge_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'venue.merged', 'venue', p_keep_id, jsonb_build_object('merged_venue_id', p_merge_id));
end;
$$;

-- Phase 12: audit log RPC
drop function if exists public.admin_audit_log(integer, integer, text, text[], text[], uuid, text, timestamptz, timestamptz);
create function public.admin_audit_log(
  p_limit      integer default 25,
  p_offset     integer default 0,
  p_q            text default null,
  p_category     text[] default null,
  p_action       text[] default null,
  p_actor_id     uuid default null,
  p_entity_type  text default null,
  p_from         timestamptz default null,
  p_to           timestamptz default null
)
returns table (
  id              uuid,
  actor_id        uuid,
  actor_display_name text,
  actor_username    text,
  actor_avatar_url  text,
  action          text,
  entity_type     text,
  entity_id       uuid,
  metadata        jsonb,
  before_state    jsonb,
  after_state     jsonb,
  reason          text,
  target_type     text,
  target_id       uuid,
  target_name     text,
  created_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  return query
  select
    v.id,
    v.actor_id,
    v.actor_display_name,
    v.actor_username,
    v.actor_avatar_url,
    v.action,
    v.entity_type,
    v.entity_id,
    v.metadata,
    v.before_state,
    v.after_state,
    v.reason,
    v.target_type,
    v.target_id,
    v.target_name,
    v.created_at
  from public.audit_log_view v
  where (p_q is null or
         (v.actor_display_name ilike ('%' || p_q || '%')
          or v.actor_username ilike ('%' || p_q || '%')
          or v.entity_type ilike ('%' || p_q || '%')
          or v.metadata::text ilike ('%' || p_q || '%')))
    and (p_category is null or category_of(v.action, v.entity_type) = any(p_category))
    and (p_action is null or v.action = any(p_action))
    and (p_actor_id is null or v.actor_id = p_actor_id)
    and (p_entity_type is null or v.entity_type = p_entity_type)
    and (p_from is null or v.created_at >= p_from)
    and (p_to is null or v.created_at <= p_to)
  order by v.created_at desc, v.id desc
  limit p_limit offset p_offset;
end;
$$;

-- Phase 13: analytics RPCs
drop function if exists public.admin_analytics_metrics(timestamptz, timestamptz);
create function public.admin_analytics_metrics(
  from_date timestamptz,
  to_date   timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  declare
    v_range_days interval := to_date - from_date;
    v_prev_from  timestamptz := from_date - v_range_days;
    v_prev_to    timestamptz := from_date;
  begin
    select jsonb_build_object(
      'published_events',    count(*) filter (where status = 'approved' and event_date >= from_date and event_date < to_date),
      'published_events_prev', count(*) filter (where status = 'approved' and event_date >= v_prev_from and event_date < v_prev_to),
      'new_users',           (select count(*) from profiles where created_at >= from_date and created_at < to_date),
      'new_users_prev',      (select count(*) from profiles where created_at >= v_prev_from and created_at < v_prev_to),
      'rsvps',               count(*) filter (where rsvp_link is not null and rsvp_link <> '' and event_date >= from_date and event_date < to_date),
      'rsvps_prev',          count(*) filter (where rsvp_link is not null and rsvp_link <> '' and event_date >= v_prev_from and event_date < v_prev_to),
      'submissions',         (select count(*) from event_submissions where submitted_at >= from_date and submitted_at < to_date),
      'submissions_prev',    (select count(*) from event_submissions where submitted_at >= v_prev_from and submitted_at < v_prev_to)
    )
    into v_result
    from events;

    v_result := v_result || jsonb_build_object(
      'published_events_delta',    (v_result->>'published_events')::int - (v_result->>'published_events_prev')::int,
      'new_users_delta',           (v_result->>'new_users')::int - (v_result->>'new_users_prev')::int,
      'rsvps_delta',               (v_result->>'rsvps')::int - (v_result->>'rsvps_prev')::int,
      'submissions_delta',         (v_result->>'submissions')::int - (v_result->>'submissions_prev')::int
    );
  end;

  return v_result;
end;
$$;

drop function if exists public.admin_analytics_timeseries(timestamptz, timestamptz, text);
create function public.admin_analytics_timeseries(
  from_date    timestamptz,
  to_date      timestamptz,
  granularity  text default 'weekly'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_events_series jsonb;
  v_submissions_series jsonb;
  v_bucket_fn text;
  v_label_fmt text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  if granularity = 'daily' then
    v_bucket_fn := 'day';
    v_label_fmt := 'Dy Mon DD';
  elsif granularity = 'monthly' then
    v_bucket_fn := 'month';
    v_label_fmt := 'Mon YYYY';
  else
    v_bucket_fn := 'week';
    v_label_fmt := 'Mon DD';
  end if;

  execute format($q$
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by sort_key), '[]'::jsonb)
    from (
      select to_char(date_trunc('%I', event_date), '%s') as label,
             date_trunc('%I', event_date) as sort_key,
             count(*) as cnt
      from events
      where status = 'approved'
        and event_date >= from_date and event_date < to_date
      group by date_trunc('%I', event_date)
      order by sort_key
    ) s
  $q$, v_bucket_fn, v_label_fmt)
  into v_events_series;

  execute format($q$
    select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', cnt) order by sort_key), '[]'::jsonb)
    from (
      select to_char(date_trunc('%I', submitted_at), '%s') as label,
             date_trunc('%I', submitted_at) as sort_key,
             count(*) as cnt
      from event_submissions
      where submitted_at >= from_date and submitted_at < to_date
      group by date_trunc('%I', submitted_at)
      order by sort_key
    ) s
  $q$, v_bucket_fn, v_label_fmt)
  into v_submissions_series;

  return jsonb_build_object(
    'events_by_week', v_events_series,
    'submissions_by_week', v_submissions_series
  );
end;
$$;

create or replace function public.public_event_suggestions_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select allow_public_event_suggestions
    from public.platform_settings
    where singleton
  ), false);
$$;

create or replace function public.registered_event_submissions_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select allow_registered_user_submissions
    from public.platform_settings
    where singleton
  ), false);
$$;

-- ============================================================
-- 5. Views
-- ============================================================

create or replace view public.audit_log_view as
  select
    a.id,
    a.actor_id,
    a.action,
    a.entity_type,
    a.entity_id,
    a.metadata,
    a.created_at,
    a.before_state,
    a.after_state,
    a.reason,
    a.target_type,
    a.target_id,
    a.target_name,
    p_roles.display_name     as actor_display_name,
    p_roles.username         as actor_username,
    p_roles.avatar_url       as actor_avatar_url
  from public.audit_logs a
  left join public.profiles p_roles on p_roles.id = a.actor_id;

create or replace view v_analytics_event_counts as
select
  count(*) filter (where status = 'approved')         as approved_count,
  count(*) filter (where status = 'pending')          as pending_count,
  count(*) filter (where status = 'rejected')         as rejected_count,
  count(*) filter (where rsvp_link is not null)       as rsvp_count,
  count(*)                                            as total_count
from events
where event_date >= current_date - interval '30 days'
  and event_date <  current_date + interval '1 day';

-- ============================================================
-- 6. Triggers
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists events_audit_log on public.events;
create trigger events_audit_log
  after insert or update or delete on public.events
  for each row execute function public.log_event_change();

drop trigger if exists event_submissions_set_updated_at on public.event_submissions;
create trigger event_submissions_set_updated_at
  before update on public.event_submissions
  for each row execute function public.set_updated_at();

drop trigger if exists event_submissions_audit_log on public.event_submissions;
create trigger event_submissions_audit_log
  after insert or update on public.event_submissions
  for each row execute function public.log_submission_change();

drop trigger if exists organizers_set_slug on public.organizers;
create trigger organizers_set_slug
  before insert or update of name, slug on public.organizers
  for each row execute function public.set_organizer_slug();

drop trigger if exists organizers_set_updated_at on public.organizers;
create trigger organizers_set_updated_at
  before update on public.organizers
  for each row execute function public.set_updated_at();

drop trigger if exists organizer_requests_set_updated_at on public.organizer_requests;
create trigger organizer_requests_set_updated_at
  before update on public.organizer_requests
  for each row execute function public.set_updated_at();

drop trigger if exists organizer_members_set_updated_at on public.organizer_members;
create trigger organizer_members_set_updated_at
  before update on public.organizer_members
  for each row execute function public.set_updated_at();

drop trigger if exists venues_set_derived_fields on public.venues;
create trigger venues_set_derived_fields
  before insert or update of name, slug, address_line1, address_line2, city, state_region, postal_code
  on public.venues
  for each row execute function public.set_venue_derived_fields();

drop trigger if exists venues_set_updated_at on public.venues;
create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

drop trigger if exists platform_settings_stamp_update on public.platform_settings;
create trigger platform_settings_stamp_update
  before update on public.platform_settings
  for each row execute function public.stamp_platform_settings_update();

drop trigger if exists platform_settings_audit_log on public.platform_settings;
create trigger platform_settings_audit_log
  after update on public.platform_settings
  for each row execute function public.log_platform_settings_change();

-- ============================================================
-- 7. Indexes
-- ============================================================

-- events
create index if not exists events_event_date_idx on public.events (event_date);
create index if not exists events_city_idx on public.events (city);
create index if not exists events_status_idx on public.events (status);
create index if not exists events_status_event_date_idx on public.events (status, event_date);
create index if not exists events_dance_styles_idx on public.events using gin (dance_styles);
create index if not exists events_venue_id_idx on public.events (venue_id);
create index if not exists events_event_date_status_idx on public.events (event_date, status);

-- profiles
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create index if not exists profiles_role_idx   on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- audit_logs (base + Phase 12)
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_type_id_idx
  on public.audit_logs (entity_type, entity_id)
  where entity_id is not null;
create index if not exists audit_logs_actor_id_created_idx
  on public.audit_logs (actor_id, created_at desc)
  where actor_id is not null;
create index if not exists audit_logs_action_idx
  on public.audit_logs (action);
create index if not exists audit_logs_created_at_id_idx
  on public.audit_logs (created_at desc, id desc);
create index if not exists audit_logs_metadata_gin
  on public.audit_logs using gin (metadata);
create index if not exists audit_logs_target_lookup_idx
  on public.audit_logs (target_type, target_id)
  where target_id is not null;
create index if not exists audit_logs_reason_idx
  on public.audit_logs (reason)
  where reason is not null;

-- event_submissions
create index if not exists event_submissions_status_idx
  on public.event_submissions (status);
create index if not exists event_submissions_status_submitted_idx
  on public.event_submissions (status, submitted_at desc);
create index if not exists event_submissions_submitter_id_idx
  on public.event_submissions (submitter_id);
create index if not exists event_submissions_submitted_at_idx
  on public.event_submissions (submitted_at);

-- organizers
create unique index if not exists organizers_slug_unique_idx on public.organizers (slug);
create index if not exists organizers_status_idx on public.organizers (status);
create index if not exists organizers_primary_city_idx on public.organizers (primary_city);

-- organizer_requests
create index if not exists organizer_requests_user_id_idx on public.organizer_requests (user_id);
create index if not exists organizer_requests_status_created_idx on public.organizer_requests (status, created_at desc);

-- organizer_members
create index if not exists organizer_members_user_id_idx on public.organizer_members (user_id);

-- venues
create unique index if not exists venues_slug_unique_idx on public.venues (slug);
create index if not exists venues_normalized_name_idx on public.venues (normalized_name);
create index if not exists venues_city_idx on public.venues (city);
create index if not exists venues_status_idx on public.venues (status);

-- event_import_batches
create index if not exists event_import_batches_created_at_idx
  on public.event_import_batches (created_at desc);
create index if not exists event_import_batches_imported_by_idx
  on public.event_import_batches (imported_by);

-- ============================================================
-- 8. RLS — enable + policies
-- ============================================================

-- events
alter table public.events enable row level security;

drop policy if exists "Public events are viewable by everyone" on public.events;
create policy "Public events are viewable by everyone"
  on public.events for select using (status = 'approved');

drop policy if exists "Users can view own submissions" on public.events;
create policy "Users can view own submissions"
  on public.events for select to authenticated
  using (submitter_id = auth.uid());

drop policy if exists "Admins can view all events" on public.events;
create policy "Admins can view all events"
  on public.events for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
  on public.events for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
  on public.events for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Insert policy: admin + moderator (Phase 6 moderator CSV import widening).
drop policy if exists "Admins can insert events" on public.events;
create policy "Admins can insert events"
  on public.events for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator'));

-- Anon/authenticated submit with full hardening.
drop policy if exists "Anon can submit pending events" on public.events;
create policy "Anon can submit pending events"
  on public.events for insert to anon, authenticated
  with check (status = 'pending'
              and submitter_id is not distinct from auth.uid()
              and public.account_is_active(auth.uid()));

-- Submitter UPDATE/DELETE: edit while pending/rejected, withdraw while alone pending.
drop policy if exists "Submitters update own pending or rejected events" on public.events;
create policy "Submitters update own pending or rejected events"
  on public.events for update to authenticated
  using (submitter_id = auth.uid() and status in ('pending', 'rejected'))
  with check (submitter_id = auth.uid() and status in ('pending', 'rejected'));
drop policy if exists "Submitters can withdraw own pending events" on public.events;
create policy "Submitters can withdraw own pending events"
  on public.events for delete to authenticated
  using (submitter_id = auth.uid() and status = 'pending');

-- profiles
alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
  on public.profiles for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- audit_logs
alter table public.audit_logs enable row level security;

drop policy if exists "Admins read audit log" on public.audit_logs;
create policy "Admins read audit log"
  on public.audit_logs for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- event_submissions
alter table public.event_submissions enable row level security;

drop policy if exists "Submitters read own submissions" on public.event_submissions;
create policy "Submitters read own submissions"
  on public.event_submissions for select to authenticated
  using (submitter_id = auth.uid());

drop policy if exists "Authenticated users can submit" on public.event_submissions;
create policy "Authenticated users can submit"
  on public.event_submissions for insert to authenticated
  with check (
    public.registered_event_submissions_enabled()
    and status = 'pending'
    and submitter_id = auth.uid()
    and public.account_is_active(auth.uid())
  );

drop policy if exists "Anon can submit" on public.event_submissions;
create policy "Anon can submit"
  on public.event_submissions for insert to anon
  with check (
    public.public_event_suggestions_enabled()
    and status = 'pending'
    and submitter_id is null
  );

drop policy if exists "Moderators read all submissions" on public.event_submissions;
create policy "Moderators read all submissions"
  on public.event_submissions for select to authenticated
  using (public.is_moderator());

drop policy if exists "Moderators update submissions" on public.event_submissions;
create policy "Moderators update submissions"
  on public.event_submissions for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- organizers
alter table public.organizers enable row level security;
alter table public.organizer_requests enable row level security;
alter table public.organizer_members enable row level security;

drop policy if exists "Admins manage organizers" on public.organizers;
create policy "Admins manage organizers" on public.organizers for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins read organizer requests" on public.organizer_requests;
create policy "Admins read organizer requests" on public.organizer_requests for select to authenticated using (public.is_admin());

drop policy if exists "Users create own organizer requests" on public.organizer_requests;
create policy "Users create own organizer requests" on public.organizer_requests for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Admins update organizer requests" on public.organizer_requests;
create policy "Admins update organizer requests" on public.organizer_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage organizer members" on public.organizer_members;
create policy "Admins manage organizer members" on public.organizer_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- venues
alter table public.venues enable row level security;

drop policy if exists "Admins manage venues" on public.venues;
create policy "Admins manage venues" on public.venues for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- event_import_batches
alter table public.event_import_batches enable row level security;

drop policy if exists "Admins read all import batches" on public.event_import_batches;
create policy "Admins read all import batches"
  on public.event_import_batches for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Moderators read own import batches" on public.event_import_batches;
create policy "Moderators read own import batches"
  on public.event_import_batches for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'moderator'
    and imported_by = auth.uid()
  );

drop policy if exists "Admins and moderators insert own import batch" on public.event_import_batches;
create policy "Admins and moderators insert own import batch"
  on public.event_import_batches for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator')
    and imported_by = auth.uid()
  );

-- platform_settings
alter table public.platform_settings enable row level security;

drop policy if exists "Admins read platform settings" on public.platform_settings;
create policy "Admins read platform settings"
  on public.platform_settings for select to authenticated
  using (public.is_platform_admin());

drop policy if exists "Admins update platform settings" on public.platform_settings;
create policy "Admins update platform settings"
  on public.platform_settings for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ============================================================
-- 9. Grants
-- ============================================================

-- events
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

-- profiles
grant select on public.profiles to authenticated;

-- audit_logs
grant select on public.audit_logs to authenticated;

-- audit_log_view
revoke select on public.audit_log_view from public, anon;
grant select on public.audit_log_view to authenticated;

-- event_submissions
grant select, insert, update on public.event_submissions to authenticated;
revoke all privileges on public.event_submissions from anon;
grant insert on public.event_submissions to anon;

-- organizers
grant select, insert, update on public.organizers to authenticated;
grant select, insert, update on public.organizer_requests to authenticated;
grant select, insert, update on public.organizer_members to authenticated;

-- venues
grant select, insert, update, delete on public.venues to authenticated;

-- event_import_batches
grant select, insert on public.event_import_batches to authenticated;

-- platform_settings
grant select, update on public.platform_settings to authenticated;

-- Function grants: trigger functions (defense-in-depth revoke)
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.log_event_change() from public, anon;
revoke execute on function public.log_submission_change() from public, anon;

revoke execute on function public.stamp_platform_settings_update() from public, anon;
revoke execute on function public.log_platform_settings_change() from public, anon;

-- Security helpers
revoke execute on function public.is_moderator() from public, anon;
grant  execute on function public.is_moderator() to authenticated;

revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

revoke execute on function public.is_platform_admin() from public, anon;
grant  execute on function public.is_platform_admin() to authenticated;

revoke execute on function public.account_is_active(uuid) from public;
grant  execute on function public.account_is_active(uuid) to anon, authenticated;

revoke execute on function public.slugify(text) from public, anon;
grant  execute on function public.slugify(text) to authenticated;

revoke execute on function public.category_of(text, text) from public, anon;
grant  execute on function public.category_of(text, text) to authenticated;

revoke execute on function public.venue_quality_issues(public.venues) from public, anon;
grant  execute on function public.venue_quality_issues(public.venues) to authenticated;

-- Submission gate RPCs
revoke execute on function public.public_event_suggestions_enabled() from public;
grant  execute on function public.public_event_suggestions_enabled() to anon, authenticated;

revoke execute on function public.registered_event_submissions_enabled() from public, anon;
grant  execute on function public.registered_event_submissions_enabled() to authenticated;

-- Admin RPCs
revoke execute on function public.admin_user_directory() from public, anon;
grant  execute on function public.admin_user_directory() to authenticated;

revoke execute on function public.admin_set_user_role(uuid, text) from public, anon;
grant  execute on function public.admin_set_user_role(uuid, text) to authenticated;

revoke execute on function public.admin_set_user_status(uuid, text, text) from public, anon;
grant  execute on function public.admin_set_user_status(uuid, text, text) to authenticated;

revoke execute on function public.admin_organizer_requests() from public, anon;
grant  execute on function public.admin_organizer_requests() to authenticated;

revoke execute on function public.admin_organizer_request_detail(uuid) from public, anon;
grant  execute on function public.admin_organizer_request_detail(uuid) to authenticated;

revoke execute on function public.admin_approve_organizer_request(uuid, uuid, text) from public, anon;
grant  execute on function public.admin_approve_organizer_request(uuid, uuid, text) to authenticated;

revoke execute on function public.admin_reject_organizer_request(uuid, uuid, text, text, text) from public, anon;
grant  execute on function public.admin_reject_organizer_request(uuid, uuid, text, text, text) to authenticated;

revoke execute on function public.admin_revoke_organizer_access(uuid, uuid, text) from public, anon;
grant  execute on function public.admin_revoke_organizer_access(uuid, uuid, text) to authenticated;

revoke execute on function public.admin_organizer_request_counts() from public, anon;
grant  execute on function public.admin_organizer_request_counts() to authenticated;

revoke execute on function public.admin_venue_directory(text, text[], text[], text[], boolean, text, integer, integer) from public, anon;
grant  execute on function public.admin_venue_directory(text, text[], text[], text[], boolean, text, integer, integer) to authenticated;

revoke execute on function public.admin_venue_detail(uuid) from public, anon;
grant  execute on function public.admin_venue_detail(uuid) to authenticated;

revoke execute on function public.admin_venue_search(text, integer) from public, anon;
grant  execute on function public.admin_venue_search(text, integer) to authenticated;

revoke execute on function public.merge_venues(uuid, uuid) from public, anon;
grant  execute on function public.merge_venues(uuid, uuid) to authenticated;

revoke execute on function public.admin_audit_log(integer, integer, text, text[], text[], uuid, text, timestamptz, timestamptz) from public, anon;
grant  execute on function public.admin_audit_log(integer, integer, text, text[], text[], uuid, text, timestamptz, timestamptz) to authenticated;

revoke execute on function public.admin_analytics_metrics(timestamptz, timestamptz) from public, anon;
grant  execute on function public.admin_analytics_metrics(timestamptz, timestamptz) to authenticated;

revoke execute on function public.admin_analytics_timeseries(timestamptz, timestamptz, text) from public, anon;
grant  execute on function public.admin_analytics_timeseries(timestamptz, timestamptz, text) to authenticated;

-- ============================================================
-- 10. Security hardening: deny anon broad SELECT
-- ============================================================
revoke select on public.audit_logs from anon;
revoke select on public.profiles   from anon;

-- Phase 11: remove legacy anon insert path into events (use event_submissions instead)
revoke insert on public.events from anon;

-- ============================================================
-- 11. Backfill data
-- ============================================================

-- Phase 3: source_type backfill
update public.events set source_type = case
  when submitter_email like '%@import.local' then 'imported'
  when submitter_name in ('Salsa Segura', 'Seed Data') then 'admin'
  else coalesce(source_type, 'user_submission')
end;

update public.events
  set dance_styles = array_remove(array[
    case when (title || ' ' || coalesce(description, '')) ~* 'salsa|casino|rueda|on1|on2|mambo|timba' then 'salsa' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'bachata' then 'bachata' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'kizomba|urban kiz' then 'kizomba' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'merengue' then 'merengue' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'cha[ -]?cha' then 'cha-cha' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'zouk' then 'zouk' end,
    case when (title || ' ' || coalesce(description, '')) ~* 'afro[ -]?cuban|rumba' then 'afro-cuban' end
  ], null);

-- Phase 11: seed platform_settings defaults (does not overwrite admin changes)
insert into public.platform_settings (
  singleton,
  platform_name,
  public_site_url,
  support_email,
  default_city,
  default_country_code,
  default_timezone,
  default_locale,
  default_currency_code,
  default_event_duration_minutes,
  allow_public_event_suggestions,
  allow_registered_user_submissions
)
values (
  true,
  'Salsa Segura',
  'https://salsasegura.com',
  'info@salsasegura.com',
  'boston',
  'US',
  'America/New_York',
  'en-US',
  'USD',
  180,
  true,
  true
)
on conflict (singleton) do nothing;

-- ============================================================
-- 12. Notify PostgREST to reload schema
-- ============================================================
notify pgrst, 'reload schema';

commit;

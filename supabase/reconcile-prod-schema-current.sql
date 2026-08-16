-- Reconcile hosted Supabase schema for current deployed admin app.
-- Safe manual production script: additive/idempotent, no db reset, no broad anon SELECT.
-- Production check showed only: tables audit_logs/events/profiles and function admin_user_directory.
-- This file therefore includes prerequisite drift repair, Phase 7 submissions,
-- Phase 8 organizer requests, and Phase 9 venues.

begin;

-- Core prerequisites used by later reconcile sections. These are idempotent and
-- deliberately small; existing data is preserved.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.profiles
  add column if not exists username text,
  add column if not exists status_reason text;

create index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

alter table public.events
  add column if not exists source_type text not null default 'user_submission',
  add column if not exists dance_styles text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancellation_reason text;

update public.events set source_type = case
  when submitter_email like '%@import.local' then 'imported'
  when submitter_name in ('Salsa Segura', 'Seed Data') then 'admin'
  else coalesce(source_type, 'user_submission')
end
where source_type is null or source_type = 'user_submission';

alter table public.events drop constraint if exists events_source_type_check;
alter table public.events add constraint events_source_type_check
  check (source_type in ('admin','user_submission','organizer','moderator','imported'));

alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check
  check (status in ('draft','pending','approved','rejected','cancelled','archived'));

create index if not exists events_dance_styles_idx on public.events using gin (dance_styles);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create or replace function public.account_is_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select status = 'active' from public.profiles where id = p_user_id), true);
$$;

revoke execute on function public.account_is_active(uuid) from public;
grant execute on function public.account_is_active(uuid) to anon, authenticated;

commit;

-- Reconcile the hosted (production) Supabase project's schema for Phase 7
-- (Event Submission Review). NOT `supabase db push` / `db reset` — those
-- reset the entire local database and cannot safely target production.
--
-- KNOWN DRIFT WARNING: reconcile-prod-schema-phase5.sql:276-342 carries a
-- CREATE OR REPLACE admin_user_directory() whose column list does NOT include
-- email_confirmed_at (added in 20260816) or approved_count (added in 20260817).
-- Postgres rejects a CREATE OR REPLACE that changes a set-returning function's
-- column list, so the Phase 5 reconcile script would FAIL mid-transaction on
-- a production database that already has the Phase 6 version of the function.
-- This script handles the situation correctly: it always drops and recreates
-- admin_user_directory() at the Phase 7 column list, making it idempotent
-- regardless of which prior version is in place. Run THIS script on any
-- production database already at Phase 5, 6, or Phase 7.
--
-- What this script applies (in dependency order):
--   1. public.is_moderator() — new security helper
--   2. public.event_submissions — new table with constraints, indexes,
--      set_updated_at trigger, and RLS policies
--   3. public.log_submission_change() — new audit trigger function +
--      event_submissions_audit_log trigger
--   4. public.admin_user_directory() — drop+recreate to add approved_count
--      and email_confirmed_at (the latter from Phase 6, included here so the
--      Phase 5 drift described above does not leave prod at Phase 6 column list)
--
-- Every statement is idempotent: CREATE TABLE / INDEX / TRIGGER / POLICY all
-- use IF NOT EXISTS or DROP IF EXISTS + CREATE; functions use DROP IF EXISTS
-- then CREATE; table RLS enable is idempotent; grants are naturally idempotent.
-- Safe to run more than once against any state. Never drops or rewrites data.
--
-- Prerequisite: production must already be at Phase 5 (profiles, set_updated_at,
-- account_is_active, audit_logs, events.source_type all exist). Phase 6's
-- email_confirmed_at column on admin_user_directory() may or may not be present —
-- this script handles both cases.

begin;

-- ============================================================
-- 1. public.is_moderator()
-- ============================================================
-- Shared predicate so all event_submissions RLS policies call one stable,
-- inlineable expression. Also finally makes the 'moderator' role meaningful —
-- every existing RLS policy checks for 'admin' only.

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'moderator');
$$;

revoke execute on function public.is_moderator() from public;
grant  execute on function public.is_moderator() to authenticated;

-- ============================================================
-- 2. public.event_submissions
-- ============================================================

create table if not exists public.event_submissions (
  id                     uuid        primary key default gen_random_uuid(),
  submitter_id           uuid        null references auth.users(id),
  submitter_email        text        null,
  submitter_name         text        null,
  status                 text        not null default 'pending',
  submitted_data         jsonb       not null,
  edited_data            jsonb       null,
  submitted_at           timestamptz not null default now(),
  reviewed_by            uuid        null references auth.users(id),
  reviewed_at            timestamptz null,
  rejection_reason       text        null,
  rejection_message      text        null,
  internal_note          text        null,
  duplicate_of_event_id  uuid        null references public.events(id) on delete set null,
  dismissed_duplicate_ids uuid[]     not null default '{}',
  approved_event_id      uuid        null references public.events(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Add constraints if not present (idempotent via drop+add pattern).
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

create index if not exists event_submissions_status_idx
  on public.event_submissions (status);

create index if not exists event_submissions_status_submitted_idx
  on public.event_submissions (status, submitted_at desc);

create index if not exists event_submissions_submitter_id_idx
  on public.event_submissions (submitter_id);

-- Trigger: keep updated_at current. Reuses set_updated_at() from Phase 3.
drop trigger if exists event_submissions_set_updated_at on public.event_submissions;
create trigger event_submissions_set_updated_at
  before update on public.event_submissions
  for each row execute function public.set_updated_at();

-- RLS
alter table public.event_submissions enable row level security;

grant select, insert, update on public.event_submissions to authenticated;
revoke all privileges on public.event_submissions from anon;
grant insert on public.event_submissions to anon;

drop policy if exists "Submitters read own submissions" on public.event_submissions;
create policy "Submitters read own submissions"
  on public.event_submissions
  for select
  to authenticated
  using (submitter_id = auth.uid());

drop policy if exists "Authenticated users can submit" on public.event_submissions;
create policy "Authenticated users can submit"
  on public.event_submissions
  for insert
  to authenticated
  with check (
    status = 'pending'
    and submitter_id = auth.uid()
    and public.account_is_active(auth.uid())
  );

drop policy if exists "Anon can submit" on public.event_submissions;
create policy "Anon can submit"
  on public.event_submissions
  for insert
  to anon
  with check (
    status = 'pending'
    and submitter_id is null
  );

drop policy if exists "Moderators read all submissions" on public.event_submissions;
create policy "Moderators read all submissions"
  on public.event_submissions
  for select
  to authenticated
  using (public.is_moderator());

drop policy if exists "Moderators update submissions" on public.event_submissions;
create policy "Moderators update submissions"
  on public.event_submissions
  for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- ============================================================
-- 3. Audit trigger for event_submissions
-- ============================================================

drop trigger if exists event_submissions_audit_log on public.event_submissions;
drop function if exists public.log_submission_change();

create function public.log_submission_change()
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

  -- UPDATE path
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

create trigger event_submissions_audit_log
  after insert or update on public.event_submissions
  for each row execute function public.log_submission_change();

-- Trigger functions are not safe to call via RPC — revoke from public/anon.
revoke execute on function public.log_submission_change() from public;

-- ============================================================
-- 4. admin_user_directory() — add approved_count (and email_confirmed_at
--    from Phase 6, so this script is safe against Phase 5 drift)
-- ============================================================
-- Must drop before recreate: Postgres rejects CREATE OR REPLACE when the
-- set-returning column list changes. Grants from prior migrations do not
-- survive a drop (the function becomes a new catalog object), so they are
-- re-applied below.

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

revoke execute on function public.admin_user_directory() from public;
grant  execute on function public.admin_user_directory() to authenticated;

-- Without this, recently-added columns/functions/policies can be invisible
-- to the PostgREST API layer (which supabase-js talks to) for up to a minute.
notify pgrst, 'reload schema';

commit;


-- ============================================================
-- Phase 8/9 reconcile: organizer requests + venues
-- ============================================================

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g')), ''), 'item');
$$;

revoke execute on function public.slugify(text) from public;
grant execute on function public.slugify(text) to authenticated;

-- ---------------- Organizer request approval ----------------

create table if not exists public.organizers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  logo_url text,
  website text,
  instagram text,
  organizer_type text,
  primary_city text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create unique index if not exists organizers_slug_unique_idx on public.organizers (slug);
create index if not exists organizers_status_idx on public.organizers (status);
create index if not exists organizers_primary_city_idx on public.organizers (primary_city);

alter table public.organizers drop constraint if exists organizers_status_check;
alter table public.organizers add constraint organizers_status_check
  check (status in ('active', 'suspended', 'archived'));

alter table public.organizers drop constraint if exists organizers_type_check;
alter table public.organizers add constraint organizers_type_check
  check (organizer_type is null or organizer_type in ('promoter','dance-studio','dj','venue','dance-company','festival','independent','other'));

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

drop trigger if exists organizers_set_slug on public.organizers;
create trigger organizers_set_slug
  before insert or update of name, slug on public.organizers
  for each row execute function public.set_organizer_slug();

drop trigger if exists organizers_set_updated_at on public.organizers;
create trigger organizers_set_updated_at
  before update on public.organizers
  for each row execute function public.set_updated_at();

create table if not exists public.organizer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  proposed_organizer_id uuid references public.organizers(id) on delete set null,
  proposed_name text,
  organizer_type text,
  description text,
  website text,
  instagram text,
  primary_city text,
  request_message text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason_code text,
  rejection_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create index if not exists organizer_requests_user_id_idx on public.organizer_requests (user_id);
create index if not exists organizer_requests_status_created_idx on public.organizer_requests (status, created_at desc);

alter table public.organizer_requests drop constraint if exists organizer_requests_status_check;
alter table public.organizer_requests add constraint organizer_requests_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.organizer_requests drop constraint if exists organizer_requests_reason_check;
alter table public.organizer_requests add constraint organizer_requests_reason_check
  check (rejection_reason_code is null or rejection_reason_code in ('insufficient_information','unable_to_verify_organizer','account_activity_concerns','duplicate_organizer_brand','not_currently_eligible','other'));

alter table public.organizer_requests drop constraint if exists organizer_requests_brand_required;
alter table public.organizer_requests add constraint organizer_requests_brand_required
  check (proposed_organizer_id is not null or nullif(btrim(coalesce(proposed_name, '')), '') is not null);

drop trigger if exists organizer_requests_set_updated_at on public.organizer_requests;
create trigger organizer_requests_set_updated_at
  before update on public.organizer_requests
  for each row execute function public.set_updated_at();

create table if not exists public.organizer_members (
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'owner',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organizer_id, user_id)
);

alter table public.organizer_members drop constraint if exists organizer_members_role_check;
alter table public.organizer_members add constraint organizer_members_role_check
  check (member_role in ('owner', 'manager', 'editor'));

alter table public.organizer_members drop constraint if exists organizer_members_status_check;
alter table public.organizer_members add constraint organizer_members_status_check
  check (status in ('active', 'removed'));

create index if not exists organizer_members_user_id_idx on public.organizer_members (user_id);

drop trigger if exists organizer_members_set_updated_at on public.organizer_members;
create trigger organizer_members_set_updated_at
  before update on public.organizer_members
  for each row execute function public.set_updated_at();

alter table public.organizers enable row level security;
alter table public.organizer_requests enable row level security;
alter table public.organizer_members enable row level security;

grant select, insert, update on public.organizers to authenticated;
grant select, insert, update on public.organizer_requests to authenticated;
grant select, insert, update on public.organizer_members to authenticated;

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

revoke execute on function public.admin_organizer_requests() from public;
revoke execute on function public.admin_organizer_request_detail(uuid) from public;
revoke execute on function public.admin_approve_organizer_request(uuid, uuid, text) from public;
revoke execute on function public.admin_reject_organizer_request(uuid, uuid, text, text, text) from public;
revoke execute on function public.admin_revoke_organizer_access(uuid, uuid, text) from public;
revoke execute on function public.admin_organizer_request_counts() from public;
grant execute on function public.admin_organizer_requests() to authenticated;
grant execute on function public.admin_organizer_request_detail(uuid) to authenticated;
grant execute on function public.admin_approve_organizer_request(uuid, uuid, text) to authenticated;
grant execute on function public.admin_reject_organizer_request(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.admin_revoke_organizer_access(uuid, uuid, text) to authenticated;
grant execute on function public.admin_organizer_request_counts() to authenticated;

-- ---------------- Venue management ----------------

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country text not null default 'US',
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  timezone text,
  website text,
  instagram text,
  phone text,
  status text not null default 'active',
  normalized_name text,
  normalized_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create unique index if not exists venues_slug_unique_idx on public.venues (slug);
create index if not exists venues_normalized_name_idx on public.venues (normalized_name);
create index if not exists venues_city_idx on public.venues (city);
create index if not exists venues_status_idx on public.venues (status);

alter table public.venues drop constraint if exists venues_status_check;
alter table public.venues add constraint venues_status_check
  check (status in ('active', 'needs_review', 'archived'));

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

drop trigger if exists venues_set_derived_fields on public.venues;
create trigger venues_set_derived_fields
  before insert or update of name, slug, address_line1, address_line2, city, state_region, postal_code
  on public.venues
  for each row execute function public.set_venue_derived_fields();

drop trigger if exists venues_set_updated_at on public.venues;
create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

alter table public.events add column if not exists venue_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_venue_id_fkey' and conrelid = 'public.events'::regclass) then
    alter table public.events add constraint events_venue_id_fkey foreign key (venue_id) references public.venues(id);
  end if;
end;
$$;

create index if not exists events_venue_id_idx on public.events (venue_id);

alter table public.venues enable row level security;
grant select, insert, update, delete on public.venues to authenticated;

drop policy if exists "Admins manage venues" on public.venues;
create policy "Admins manage venues" on public.venues for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop function if exists public.venue_quality_issues(public.venues);
create function public.venue_quality_issues(p_venue public.venues)
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

revoke execute on function public.venue_quality_issues(public.venues) from public;
revoke execute on function public.admin_venue_directory(text, text[], text[], text[], boolean, text, integer, integer) from public;
revoke execute on function public.admin_venue_detail(uuid) from public;
revoke execute on function public.admin_venue_search(text, integer) from public;
revoke execute on function public.merge_venues(uuid, uuid) from public;
grant execute on function public.venue_quality_issues(public.venues) to authenticated;
grant execute on function public.admin_venue_directory(text, text[], text[], text[], boolean, text, integer, integer) to authenticated;
grant execute on function public.admin_venue_detail(uuid) to authenticated;
grant execute on function public.admin_venue_search(text, integer) to authenticated;
grant execute on function public.merge_venues(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

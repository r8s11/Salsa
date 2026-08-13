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

drop function if exists public.is_moderator();

create function public.is_moderator()
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

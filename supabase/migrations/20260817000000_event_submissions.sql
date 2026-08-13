-- Phase 7 — event_submissions table + is_moderator() helper +
-- audit trigger + admin_user_directory() extended with approved_count.
--
-- The two-table split is the core architectural decision: /admin/submissions
-- operates on this table exclusively; /admin/events continues to own
-- canonical calendar events. Approval reads a submission and CREATEs an
-- events row, preserving the submission record permanently with a pointer to
-- what it became.
--
-- admin_user_directory() is rebuilt here (drop+recreate, as in 0816) to add
-- the approved_count column. The column list changes, so CREATE OR REPLACE
-- is rejected by Postgres — drop is required.
--
-- This file ends with `notify pgrst, 'reload schema';` because it changes
-- the PostgREST-visible surface (new table, new RPC column, new function).

-- ============================================================
-- 1. public.is_moderator() — shared predicate for RLS policies
-- ============================================================
-- STABLE, SECURITY DEFINER so RLS policies can call it without
-- invoking auth.jwt() repeatedly per row. Grants admin OR moderator.
-- This is what finally makes the moderator role mean something —
-- today every policy only checks for 'admin'.

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

create table public.event_submissions (
  id                     uuid        primary key default gen_random_uuid(),

  -- Submitter identity. submitter_id is null for magic-link/anon submitters.
  -- submitter_email is the stable key for guest continuity: if a guest later
  -- registers with the same email, admin_user_directory() links them
  -- automatically through its union — no backfill needed.
  submitter_id           uuid        null references auth.users(id),
  submitter_email        text        null,
  submitter_name         text        null,

  -- Status lifecycle. in_review and needs_information are in the CHECK
  -- from day one so Later features don't require a constraint migration,
  -- even though no Phase 7 UI writes them.
  status                 text        not null default 'pending'
                           check (status in (
                             'pending', 'in_review', 'needs_information',
                             'approved', 'rejected', 'withdrawn'
                           )),

  -- submitted_data is the immutable original — never mutated after insert.
  -- edited_data holds moderator corrections only. The effective value for
  -- any field is coalesce(edited_data->>field, submitted_data->>field).
  -- edited_data being a separate column (not a mutation of submitted_data)
  -- is what makes "Edited" a real, independent timeline entry in audit_logs.
  submitted_data         jsonb       not null,
  edited_data            jsonb       null,

  -- Timestamps
  submitted_at           timestamptz not null default now(),
  reviewed_by            uuid        null references auth.users(id),
  reviewed_at            timestamptz null,

  -- Rejection fields. rejection_message is shown to the submitter;
  -- internal_note is NEVER shown to the submitter — the layout separation
  -- is enforced at the data layer, not only the UI layer.
  rejection_reason       text        null
                           check (rejection_reason is null or rejection_reason in (
                             'duplicate', 'missing_information', 'invalid_venue',
                             'cannot_verify', 'spam', 'inappropriate',
                             'out_of_scope', 'other'
                           )),
  rejection_message      text        null,
  internal_note          text        null,

  -- Duplicate tracking. duplicate_of_event_id makes "Reject as Duplicate"
  -- mean something (links to the canonical event). dismissed_duplicate_ids
  -- makes "Not a Duplicate" survive a reload — without this column the
  -- dismissal is a no-op after refresh.
  duplicate_of_event_id  uuid        null references public.events(id) on delete set null,
  dismissed_duplicate_ids uuid[]     not null default '{}',

  -- Set on approval; links back to the canonical event that was created.
  approved_event_id      uuid        null references public.events(id) on delete set null,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Indexes support the queue views: default sort is submitted_at desc;
-- status is the primary partition for the tab views.
create index event_submissions_status_idx
  on public.event_submissions (status);

create index event_submissions_status_submitted_idx
  on public.event_submissions (status, submitted_at desc);

create index event_submissions_submitter_id_idx
  on public.event_submissions (submitter_id);

-- Keep updated_at current. Reuses the set_updated_at() function from
-- 20260813000000_profiles.sql — no new function needed.
create trigger event_submissions_set_updated_at
  before update on public.event_submissions
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. RLS on event_submissions
-- ============================================================

alter table public.event_submissions enable row level security;

grant select, insert, update on public.event_submissions to authenticated;
grant insert on public.event_submissions to anon;

-- Submitters can read their own submissions.
create policy "Submitters read own submissions"
  on public.event_submissions
  for select
  to authenticated
  using (submitter_id = auth.uid());

-- Authenticated users can submit (status must start as 'pending';
-- submitter_id must match the calling user). This mirrors the events
-- anon-submit policy pattern from 20260815000000_users_management.sql.
create policy "Authenticated users can submit"
  on public.event_submissions
  for insert
  to authenticated
  with check (
    status = 'pending'
    and submitter_id = auth.uid()
    and public.account_is_active(auth.uid())
  );

-- Anon insert for magic-link/import paths; submitter_id must be null.
create policy "Anon can submit"
  on public.event_submissions
  for insert
  to anon
  with check (
    status = 'pending'
    and submitter_id is null
  );

-- Moderators and admins can read all submissions.
create policy "Moderators read all submissions"
  on public.event_submissions
  for select
  to authenticated
  using (public.is_moderator());

-- Moderators and admins can update submissions (approve, reject, edit, etc.).
-- No DELETE policy — submissions are never destroyed; this is the entire
-- point of having a separate table.
create policy "Moderators update submissions"
  on public.event_submissions
  for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- ============================================================
-- 4. Audit trigger for event_submissions
-- ============================================================
-- Mirrors log_event_change() from 20260813000100_audit_logs.sql.
-- One entry per save for edits (carrying changed field list in metadata),
-- never one per field or per keystroke.

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
    -- One entry per save, carrying the list of changed field names.
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
-- 5. admin_user_directory() — add approved_count
-- ============================================================
-- Postgres rejects changing a set-returning function's column list via
-- CREATE OR REPLACE, so this drops and recreates (same pattern as 0816).
-- The grants from prior migrations do not survive a drop — the function
-- becomes a new catalog object — so revoke/grant is repeated below.
--
-- approved_count: needed by the review panel's "N previous submissions · M approved"
-- submitter line (plan Step 4). The underlying stats still source from
-- public.events (not event_submissions) for continuity with existing data;
-- the implementation phase will migrate pending rows and update this query.

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

notify pgrst, 'reload schema';

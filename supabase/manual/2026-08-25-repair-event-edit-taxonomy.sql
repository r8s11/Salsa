-- =====================================================================
-- Repair: production event edit save after 2026-08-25-fix-production-event-edits.sql
--
-- Run this AFTER sql/2026-08-25-fix-production-event-edits.sql.
--
-- Why this exists: the first script created event_taxonomy_terms but omitted
-- the RPC that the app actually calls after updating events:
--
--   supabase.rpc('replace_event_taxonomy_terms', {
--     p_event_id, p_taxonomy_term_ids
--   })
--
-- Without this function, an event update can write the event row then fail on
-- taxonomy replacement with PostgREST "Could not find the function
-- public.replace_event_taxonomy_terms". This repair installs that RPC and
-- fills Phase-10 taxonomy columns needed by admin taxonomy screens.
--
-- Safe to re-run. Additive DDL; CREATE OR REPLACE function; no row deletion.
-- =====================================================================

begin;

-- Phase-10 taxonomy fields missing from the earlier event-edit repair.
alter table public.taxonomy_terms
  add column if not exists description text,
  add column if not exists parent_id uuid,
  add column if not exists display_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'taxonomy_terms_parent_id_fkey'
      and conrelid = 'public.taxonomy_terms'::regclass
  ) then
    alter table public.taxonomy_terms
      add constraint taxonomy_terms_parent_id_fkey
      foreign key (parent_id) references public.taxonomy_terms(id) on delete restrict;
  end if;
end;
$$;

-- Existing Phase-10 production installs use a global slug. Keep existing data
-- intact and enforce that expectation only for new/upgraded installs.
create unique index if not exists taxonomy_terms_slug_key
  on public.taxonomy_terms (slug);

create index if not exists taxonomy_terms_directory_idx
  on public.taxonomy_terms (category, status, display_order, name);

-- Shared admin/moderator predicate. CREATE OR REPLACE makes this safe whether
-- Phase 7 was already applied or not.
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'moderator');
$$;
revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- This is the exact RPC called by src/features/admin/api/taxonomyRepo.ts.
create or replace function public.replace_event_taxonomy_terms(
  p_event_id uuid,
  p_taxonomy_term_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := coalesce(p_taxonomy_term_ids, '{}'::uuid[]);
begin
  if not public.is_moderator() then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  if cardinality(v_ids) <> (select count(distinct id) from unnest(v_ids) id) then
    raise exception 'Duplicate taxonomy term IDs are not allowed';
  end if;

  if (select count(*) from public.taxonomy_terms where id = any(v_ids)) <> cardinality(v_ids) then
    raise exception 'Unknown taxonomy term ID';
  end if;

  if exists (
    select 1
    from public.taxonomy_terms term
    where term.id = any(v_ids)
      and term.status <> 'active'
      and not exists (
        select 1
        from public.event_taxonomy_terms link
        where link.event_id = p_event_id
          and link.taxonomy_term_id = term.id
      )
  ) then
    raise exception 'New relationships must use active terms';
  end if;

  delete from public.event_taxonomy_terms
  where event_id = p_event_id
    and taxonomy_term_id <> all(v_ids);

  insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
  select p_event_id, id
  from unnest(v_ids) as selected(id)
  on conflict do nothing;
end;
$$;

revoke all on function public.replace_event_taxonomy_terms(uuid, uuid[]) from public, anon;
grant execute on function public.replace_event_taxonomy_terms(uuid, uuid[]) to authenticated;

commit;

notify pgrst, 'reload schema';

-- =====================================================================
-- Verification — run separately. Expect one row: rpc_visible = true.
-- =====================================================================
-- select
--   to_regprocedure('public.replace_event_taxonomy_terms(uuid,uuid[])')
--     is not null as rpc_visible,
--   to_regprocedure('public.is_moderator()') is not null as role_helper_visible,
--   (select count(*) from information_schema.columns
--      where table_schema = 'public' and table_name = 'taxonomy_terms'
--        and column_name in ('description', 'parent_id', 'display_order', 'updated_at')
--   ) as phase10_columns_present; -- expect 4

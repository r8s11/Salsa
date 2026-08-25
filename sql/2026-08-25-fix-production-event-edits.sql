-- =====================================================================
-- Fix: admin/moderator event edits fail to save in production
--
-- Run this in the Supabase SQL Editor (production project).
--
-- Why edits fail: the admin editor's UPDATE writes `venue_id` and then
-- replaces rows in `event_taxonomy_terms`. Those objects were introduced in
-- `supabase/reconcile-prod-schema.sql` and `sql/phase-10/*`, NOT in a
-- numbered file under `supabase/migrations/`. A production database migrated
-- only from `supabase/migrations/` therefore has no `events.venue_id`, no
-- `venues`, and no taxonomy tables — every save fails on the missing column
-- ("Could not find the 'venue_id' column of 'events' in the schema cache")
-- or on the follow-up taxonomy write.
--
-- Safe to run more than once: every statement is additive and guarded
-- (create table if not exists / add column if not exists / drop-then-add for
-- constraints and policies). Nothing is dropped and no row data is deleted.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Venues (Phase 9) — must exist before events.venue_id references it
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 2. Columns the admin editor writes on events
-- ---------------------------------------------------------------------
alter table public.events
  add column if not exists venue_id uuid,
  add column if not exists host text,
  add column if not exists image_url text,
  add column if not exists recurrence text,
  add column if not exists gallery text[],
  add column if not exists contact_email text,
  add column if not exists contact_instagram text,
  add column if not exists contact_website text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_venue_id_fkey'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_venue_id_fkey
      foreign key (venue_id) references public.venues(id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Taxonomy tables (Phase 10) — the save's second write targets these
-- ---------------------------------------------------------------------
create table if not exists public.taxonomy_terms (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('dance_style', 'event_attribute')),
  name        text not null check (btrim(name) <> ''),
  slug        text not null,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.taxonomy_terms drop constraint if exists taxonomy_terms_status_check;
alter table public.taxonomy_terms add constraint taxonomy_terms_status_check
  check (status in ('active', 'needs_review', 'archived'));

create unique index if not exists taxonomy_terms_category_slug_key
  on public.taxonomy_terms (category, slug);

create table if not exists public.event_taxonomy_terms (
  event_id         uuid not null references public.events(id) on delete cascade,
  taxonomy_term_id uuid not null references public.taxonomy_terms(id) on delete restrict,
  primary key (event_id, taxonomy_term_id)
);

create index if not exists event_taxonomy_terms_term_idx
  on public.event_taxonomy_terms (taxonomy_term_id);

-- ---------------------------------------------------------------------
-- 4. Row Level Security for the new tables
--    Public read (the event page renders tags), admin/moderator write.
-- ---------------------------------------------------------------------
alter table public.venues enable row level security;
alter table public.taxonomy_terms enable row level security;
alter table public.event_taxonomy_terms enable row level security;

grant select on public.venues, public.taxonomy_terms, public.event_taxonomy_terms
  to anon, authenticated;
grant insert, update, delete on public.venues, public.taxonomy_terms, public.event_taxonomy_terms
  to authenticated;

drop policy if exists "Anyone can read venues" on public.venues;
create policy "Anyone can read venues"
  on public.venues for select to anon, authenticated using (true);

drop policy if exists "Staff manage venues" on public.venues;
create policy "Staff manage venues"
  on public.venues for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator'));

drop policy if exists "Anyone can read taxonomy terms" on public.taxonomy_terms;
create policy "Anyone can read taxonomy terms"
  on public.taxonomy_terms for select to anon, authenticated using (true);

drop policy if exists "Staff manage taxonomy terms" on public.taxonomy_terms;
create policy "Staff manage taxonomy terms"
  on public.taxonomy_terms for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator'));

drop policy if exists "Anyone can read event taxonomy links" on public.event_taxonomy_terms;
create policy "Anyone can read event taxonomy links"
  on public.event_taxonomy_terms for select to anon, authenticated using (true);

drop policy if exists "Staff manage event taxonomy links" on public.event_taxonomy_terms;
create policy "Staff manage event taxonomy links"
  on public.event_taxonomy_terms for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator'));

-- ---------------------------------------------------------------------
-- 5. Admin UPDATE policy on events (idempotent re-assert)
-- ---------------------------------------------------------------------
grant update on public.events to authenticated;

drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
  on public.events for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

commit;

-- Supabase caches the schema for the REST API; without this the client keeps
-- reporting the old "column not found in schema cache" error after the DDL.
notify pgrst, 'reload schema';

-- =====================================================================
-- Verification — run separately, expect one row per item and no nulls
-- =====================================================================
-- select
--   (select count(*) from information_schema.columns
--      where table_schema = 'public' and table_name = 'events'
--        and column_name in ('venue_id','host','image_url','recurrence','gallery',
--                            'contact_email','contact_instagram','contact_website')
--   ) as event_columns_present,   -- expect 8
--   to_regclass('public.venues')                as venues_table,
--   to_regclass('public.taxonomy_terms')        as taxonomy_terms_table,
--   to_regclass('public.event_taxonomy_terms')  as event_taxonomy_link_table,
--   (select count(*) from pg_policies
--      where schemaname = 'public' and tablename = 'events'
--        and policyname = 'Admins can update events'
--   ) as admin_update_policy;     -- expect 1

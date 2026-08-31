-- =====================================================================
-- SalsaSegura current schema — REQUIRED
--
-- Purpose: sole schema bootstrap and idempotent upgrade script.
-- Execution order: run before seed, diagnostic, verification, or rollback SQL.
-- Dependencies: Supabase-managed auth, storage, pgcrypto, and PostgREST roles.
-- Safety: review manually before production; never run db push/reset on production.
-- Rollback: no automatic rollback; restore from backup and use reviewed feature
-- rollback scripts where one exists. This script preserves existing user data.
-- =====================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- Relational tables.  Every table is created once; the following guarded
-- column additions make partially-applied historical states converge.
-- =====================================================================

-- 1. Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  username text,
  status_reason text
);
alter table public.profiles
  add column if not exists id uuid,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists role text default 'user',
  add column if not exists status text default 'active',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists username text,
  add column if not exists status_reason text;

-- 2. Venues (created before events so event foreign keys are valid)
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
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
  updated_at timestamptz not null default now(),
  constraint venues_slug_key unique (slug)
);
alter table public.venues
  add column if not exists id uuid,
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state_region text,
  add column if not exists postal_code text,
  add column if not exists country text default 'US',
  add column if not exists latitude numeric(10, 8),
  add column if not exists longitude numeric(11, 8),
  add column if not exists timezone text,
  add column if not exists website text,
  add column if not exists instagram text,
  add column if not exists phone text,
  add column if not exists status text default 'active',
  add column if not exists normalized_name text,
  add column if not exists normalized_address text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- 3. Organizers
create table if not exists public.organizers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  description text,
  logo_url text,
  website text,
  instagram text,
  organizer_type text,
  primary_city text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizers_slug_key unique (slug)
);
alter table public.organizers
  add column if not exists id uuid,
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists logo_url text,
  add column if not exists website text,
  add column if not exists instagram text,
  add column if not exists organizer_type text,
  add column if not exists primary_city text,
  add column if not exists status text default 'active',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- 4. Events: baseline fields plus module, flyer, moderation, recurrence,
-- submitter, venue, organizer, source, publication, and audit fields.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text,
  event_date timestamptz not null,
  event_time text,
  location text,
  address text,
  price_type text,
  price_amount numeric(10, 2),
  rsvp_link text,
  image_url text,
  status text default 'approved',
  submitter_name text,
  submitter_email text,
  created_at timestamptz default now(),
  city text default 'boston',
  host text,
  recurrence text,
  gallery text[],
  submitter_id uuid references auth.users(id),
  contact_email text,
  contact_instagram text,
  contact_website text,
  source_type text not null default 'user_submission',
  dance_styles text[] not null default '{}',
  updated_at timestamptz not null default now(),
  cancellation_reason text,
  venue_id uuid references public.venues(id) on delete set null,
  organizer_id uuid references public.organizers(id) on delete set null
);
alter table public.events
  add column if not exists id uuid,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists event_type text,
  add column if not exists event_date timestamptz,
  add column if not exists event_time text,
  add column if not exists location text,
  add column if not exists address text,
  add column if not exists price_type text,
  add column if not exists price_amount numeric(10, 2),
  add column if not exists rsvp_link text,
  add column if not exists image_url text,
  add column if not exists status text default 'approved',
  add column if not exists submitter_name text,
  add column if not exists submitter_email text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists city text default 'boston',
  add column if not exists host text,
  add column if not exists recurrence text,
  add column if not exists gallery text[],
  add column if not exists submitter_id uuid,
  add column if not exists contact_email text,
  add column if not exists contact_instagram text,
  add column if not exists contact_website text,
  add column if not exists source_type text default 'user_submission',
  add column if not exists dance_styles text[] default '{}',
  add column if not exists updated_at timestamptz default now(),
  add column if not exists cancellation_reason text,
  add column if not exists venue_id uuid,
  add column if not exists organizer_id uuid;

-- 5. Event submissions
create table if not exists public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid references auth.users(id),
  submitter_email text,
  submitter_name text,
  status text not null default 'pending',
  submitted_data jsonb not null,
  edited_data jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  rejection_message text,
  internal_note text,
  duplicate_of_event_id uuid references public.events(id) on delete set null,
  dismissed_duplicate_ids uuid[] not null default '{}',
  approved_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.event_submissions
  add column if not exists id uuid,
  add column if not exists submitter_id uuid,
  add column if not exists submitter_email text,
  add column if not exists submitter_name text,
  add column if not exists status text default 'pending',
  add column if not exists submitted_data jsonb,
  add column if not exists edited_data jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists rejection_message text,
  add column if not exists internal_note text,
  add column if not exists duplicate_of_event_id uuid,
  add column if not exists dismissed_duplicate_ids uuid[] default '{}',
  add column if not exists approved_event_id uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- 6. Taxonomy terms
create table if not exists public.taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  normalized_name text generated always as (lower(btrim(normalize(name, NFKC)))) stored,
  slug text not null,
  description text,
  parent_id uuid references public.taxonomy_terms(id) on delete restrict,
  status text not null default 'active',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.taxonomy_terms
  add column if not exists id uuid,
  add column if not exists category text,
  add column if not exists name text,
  add column if not exists normalized_name text generated always as (lower(btrim(normalize(name, NFKC)))) stored,
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists parent_id uuid,
  add column if not exists status text default 'active',
  add column if not exists display_order integer default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- 7. Event/taxonomy relationship
create table if not exists public.event_taxonomy_terms (
  event_id uuid not null references public.events(id) on delete cascade,
  taxonomy_term_id uuid not null references public.taxonomy_terms(id) on delete restrict,
  primary key (event_id, taxonomy_term_id)
);
alter table public.event_taxonomy_terms
  add column if not exists event_id uuid,
  add column if not exists taxonomy_term_id uuid;

-- 8. Organizer requests
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
  add column if not exists id uuid,
  add column if not exists user_id uuid,
  add column if not exists proposed_organizer_id uuid,
  add column if not exists proposed_name text,
  add column if not exists organizer_type text,
  add column if not exists description text,
  add column if not exists website text,
  add column if not exists instagram text,
  add column if not exists primary_city text,
  add column if not exists request_message text,
  add column if not exists status text default 'pending',
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason_code text,
  add column if not exists rejection_message text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- 9. Organizer memberships
create table if not exists public.organizer_members (
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'owner',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organizer_id, user_id)
);
alter table public.organizer_members
  add column if not exists organizer_id uuid,
  add column if not exists user_id uuid,
  add column if not exists member_role text default 'owner',
  add column if not exists status text default 'active',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- 10. Moderator import batches
create table if not exists public.event_import_batches (
  id uuid primary key default gen_random_uuid(),
  imported_by uuid references auth.users(id),
  filename text not null,
  total_rows integer not null,
  created_count integer not null,
  duplicate_skipped_count integer not null,
  failed_count integer not null,
  created_at timestamptz not null default now()
);
alter table public.event_import_batches
  add column if not exists id uuid,
  add column if not exists imported_by uuid,
  add column if not exists filename text,
  add column if not exists total_rows integer,
  add column if not exists created_count integer,
  add column if not exists duplicate_skipped_count integer,
  add column if not exists failed_count integer,
  add column if not exists created_at timestamptz default now();

-- 11. Singleton platform settings
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
alter table public.platform_settings
  add column if not exists singleton boolean default true,
  add column if not exists platform_name text,
  add column if not exists public_site_url text,
  add column if not exists support_email text,
  add column if not exists default_city text,
  add column if not exists default_country_code text,
  add column if not exists default_timezone text,
  add column if not exists default_locale text,
  add column if not exists default_currency_code text,
  add column if not exists default_event_duration_minutes integer,
  add column if not exists allow_public_event_suggestions boolean,
  add column if not exists allow_registered_user_submissions boolean,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz default now();

-- 12. Host event roster
create table if not exists public.event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  email text,
  category text not null,
  source text not null default 'host',
  party_size integer not null default 1,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id)
);
alter table public.event_attendees
  add column if not exists id uuid,
  add column if not exists event_id uuid,
  add column if not exists profile_id uuid,
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists category text,
  add column if not exists source text default 'host',
  add column if not exists party_size integer default 1,
  add column if not exists notes text,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- 13. Append-only check-in history
create table if not exists public.event_check_ins (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null,
  event_id uuid not null,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid not null references auth.users(id),
  method text not null default 'manual',
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id),
  reversal_reason text,
  created_at timestamptz not null default now(),
  constraint event_check_ins_attendee_event_fkey foreign key (attendee_id, event_id)
    references public.event_attendees (id, event_id) on delete cascade
);
alter table public.event_check_ins
  add column if not exists id uuid,
  add column if not exists attendee_id uuid,
  add column if not exists event_id uuid,
  add column if not exists checked_in_at timestamptz default now(),
  add column if not exists checked_in_by uuid,
  add column if not exists method text default 'manual',
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid,
  add column if not exists reversal_reason text,
  add column if not exists created_at timestamptz default now();

-- 14. Audit trail
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  before_state jsonb,
  after_state jsonb,
  reason text,
  target_type text,
  target_id uuid,
  target_name text
);
alter table public.audit_logs
  add column if not exists id uuid,
  add column if not exists actor_id uuid,
  add column if not exists action text,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists metadata jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists before_state jsonb,
  add column if not exists after_state jsonb,
  add column if not exists reason text,
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists target_name text;

-- =====================================================================
-- Current, idempotent data transitions. These run before stricter guards.
-- =====================================================================

update public.event_submissions
set submitted_at = coalesce(submitted_at, created_at, now())
where submitted_at is null;

alter table public.event_submissions
  alter column submitted_at set not null;

-- Migrate only legacy dance-style values with a reviewed taxonomy target.
-- Unknown values abort before any relationship rows are written.
do $$
begin
  if exists (
    select 1
    from (select distinct unnest(coalesce(dance_styles, '{}')) as legacy_style from public.events) legacy
    left join public.taxonomy_terms term
      on term.category = 'dance_style' and term.slug = legacy.legacy_style
    where term.id is null
  ) then
    raise exception 'Legacy dance_styles contains unmapped values; review before migration';
  end if;
end;
$$;

insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
select distinct event.id, term.id
from public.events event
cross join lateral unnest(coalesce(event.dance_styles, '{}')) as legacy_style
join public.taxonomy_terms term
  on term.category = 'dance_style' and term.slug = legacy_style
on conflict do nothing;

-- =====================================================================
-- Named constraints. Catalog guards make the migration safe on partial
-- historical states while preserving explicit final checks.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizers'::regclass and conname = 'organizers_slug_key') then
    alter table public.organizers add constraint organizers_slug_key unique (slug);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.venues'::regclass and conname = 'venues_slug_key') then
    alter table public.venues add constraint venues_slug_key unique (slug);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.taxonomy_terms'::regclass and conname = 'taxonomy_terms_category_normalized_name_key') then
    alter table public.taxonomy_terms add constraint taxonomy_terms_category_normalized_name_key unique (category, normalized_name);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.taxonomy_terms'::regclass and conname = 'taxonomy_terms_slug_key') then
    alter table public.taxonomy_terms add constraint taxonomy_terms_slug_key unique (slug);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.event_taxonomy_terms'::regclass and conname = 'event_taxonomy_terms_pkey') then
    alter table public.event_taxonomy_terms add constraint event_taxonomy_terms_pkey primary key (event_id, taxonomy_term_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_id_event_key') then
    alter table public.event_attendees add constraint event_attendees_id_event_key unique (id, event_id);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.taxonomy_terms'::regclass and conname = 'taxonomy_terms_parent_id_fkey') then
    alter table public.taxonomy_terms add constraint taxonomy_terms_parent_id_fkey foreign key (parent_id) references public.taxonomy_terms(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_taxonomy_terms'::regclass and conname = 'event_taxonomy_terms_event_id_fkey') then
    alter table public.event_taxonomy_terms add constraint event_taxonomy_terms_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_taxonomy_terms'::regclass and conname = 'event_taxonomy_terms_taxonomy_term_id_fkey') then
    alter table public.event_taxonomy_terms add constraint event_taxonomy_terms_taxonomy_term_id_fkey foreign key (taxonomy_term_id) references public.taxonomy_terms(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_id_fkey') then
    alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_event_type_check') then
    alter table public.events add constraint events_event_type_check check (event_type is null or event_type in ('social', 'workshop', 'class'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_price_type_check') then
    alter table public.events add constraint events_price_type_check check (price_type is null or price_type in ('free', 'paid'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_city_check') then
    alter table public.events add constraint events_city_check check (city is null or city in ('boston', 'new-york-city'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_source_type_check') then
    alter table public.events add constraint events_source_type_check check (source_type in ('admin','user_submission','organizer','moderator','imported'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_status_check') then
    alter table public.events add constraint events_status_check check (status in ('draft','pending','approved','rejected','cancelled','archived'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_venue_id_fkey') then
    alter table public.events add constraint events_venue_id_fkey foreign key (venue_id) references public.venues(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_organizer_id_fkey') then
    alter table public.events add constraint events_organizer_id_fkey foreign key (organizer_id) references public.organizers(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check') then
    alter table public.profiles add constraint profiles_role_check check (role in ('user', 'moderator', 'organizer', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_status_check') then
    alter table public.profiles add constraint profiles_status_check check (status in ('active', 'flagged', 'suspended', 'banned'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$');
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.audit_logs'::regclass and conname = 'audit_logs_target_type_check') then
    alter table public.audit_logs add constraint audit_logs_target_type_check check (target_type is null or target_type in ('event', 'event_submission', 'profile', 'organizer', 'venue', 'taxonomy_term', 'platform_settings'));
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.event_submissions'::regclass and conname = 'event_submissions_status_check') then
    alter table public.event_submissions add constraint event_submissions_status_check check (status in ('pending', 'in_review', 'needs_information', 'approved', 'rejected', 'withdrawn'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_submissions'::regclass and conname = 'event_submissions_rejection_reason_check') then
    alter table public.event_submissions add constraint event_submissions_rejection_reason_check check (rejection_reason is null or rejection_reason in ('duplicate', 'missing_information', 'invalid_venue', 'cannot_verify', 'spam', 'inappropriate', 'out_of_scope', 'other'));
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.organizers'::regclass and conname = 'organizers_status_check') then
    alter table public.organizers add constraint organizers_status_check check (status in ('active', 'suspended', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizers'::regclass and conname = 'organizers_type_check') then
    alter table public.organizers add constraint organizers_type_check check (organizer_type is null or organizer_type in ('promoter','dance-studio','dj','venue','dance-company','festival','independent','other'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_requests'::regclass and conname = 'organizer_requests_status_check') then
    alter table public.organizer_requests add constraint organizer_requests_status_check check (status in ('pending', 'approved', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_requests'::regclass and conname = 'organizer_requests_reason_check') then
    alter table public.organizer_requests add constraint organizer_requests_reason_check check (rejection_reason_code is null or rejection_reason_code in ('insufficient_information','unable_to_verify_organizer','account_activity_concerns','duplicate_organizer_brand','not_currently_eligible','other'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_requests'::regclass and conname = 'organizer_requests_brand_required') then
    alter table public.organizer_requests add constraint organizer_requests_brand_required check (proposed_organizer_id is not null or nullif(btrim(coalesce(proposed_name, '')), '') is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_members'::regclass and conname = 'organizer_members_role_check') then
    alter table public.organizer_members add constraint organizer_members_role_check check (member_role in ('owner', 'manager', 'editor'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_members'::regclass and conname = 'organizer_members_status_check') then
    alter table public.organizer_members add constraint organizer_members_status_check check (status in ('active', 'removed'));
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.venues'::regclass and conname = 'venues_status_check') then
    alter table public.venues add constraint venues_status_check check (status in ('active', 'needs_review', 'archived'));
  end if;

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
    alter table public.platform_settings add constraint platform_settings_duration_check check (default_event_duration_minutes between 30 and 720 and mod(default_event_duration_minutes, 30) = 0);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_display_name_check') then
    alter table public.event_attendees add constraint event_attendees_display_name_check check (btrim(display_name) <> '' and length(display_name) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_email_check') then
    alter table public.event_attendees add constraint event_attendees_email_check check (email is null or (btrim(email) <> '' and length(email) <= 300));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_category_check') then
    alter table public.event_attendees add constraint event_attendees_category_check check (category in ('registered', 'guest', 'comp', 'staff', 'performer', 'instructor', 'walk_in'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_source_check') then
    alter table public.event_attendees add constraint event_attendees_source_check check (source in ('host', 'door', 'future_registration', 'system'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_party_size_check') then
    alter table public.event_attendees add constraint event_attendees_party_size_check check (party_size >= 1 and party_size <= 20);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_notes_check') then
    alter table public.event_attendees add constraint event_attendees_notes_check check (notes is null or length(notes) <= 500);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.event_check_ins'::regclass and conname = 'event_check_ins_method_check') then
    alter table public.event_check_ins add constraint event_check_ins_method_check check (method in ('manual', 'door', 'future_qr', 'future_self_check_in'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_check_ins'::regclass and conname = 'event_check_ins_reversal_complete') then
    alter table public.event_check_ins add constraint event_check_ins_reversal_complete check ((reversed_at is null and reversed_by is null) or (reversed_at is not null and reversed_by is not null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_check_ins'::regclass and conname = 'event_check_ins_reason_requires_reversal') then
    alter table public.event_check_ins add constraint event_check_ins_reason_requires_reversal check (reversal_reason is null or reversed_at is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_check_ins'::regclass and conname = 'event_check_ins_reversal_after_check_in') then
    alter table public.event_check_ins add constraint event_check_ins_reversal_after_check_in check (reversed_at is null or reversed_at >= checked_in_at);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_check_ins'::regclass and conname = 'event_check_ins_attendee_event_fkey') then
    alter table public.event_check_ins add constraint event_check_ins_attendee_event_fkey foreign key (attendee_id, event_id) references public.event_attendees (id, event_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.taxonomy_terms'::regclass and conname = 'taxonomy_terms_category_check') then
    alter table public.taxonomy_terms add constraint taxonomy_terms_category_check check (category in ('dance_style', 'event_attribute'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.taxonomy_terms'::regclass and conname = 'taxonomy_terms_name_check') then
    alter table public.taxonomy_terms add constraint taxonomy_terms_name_check check (btrim(name) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.taxonomy_terms'::regclass and conname = 'taxonomy_terms_slug_check') then
    alter table public.taxonomy_terms add constraint taxonomy_terms_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.taxonomy_terms'::regclass and conname = 'taxonomy_terms_status_check') then
    alter table public.taxonomy_terms add constraint taxonomy_terms_status_check check (status in ('active', 'needs_review', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.taxonomy_terms'::regclass and conname = 'taxonomy_terms_not_own_parent') then
    alter table public.taxonomy_terms add constraint taxonomy_terms_not_own_parent check (parent_id is null or parent_id <> id);
  end if;
end;
$$;

-- =====================================================================
-- Existing-state convergence. Defaults and nullability are applied after
-- the backfills above; invalid historical rows fail instead of being
-- silently rewritten.
-- =====================================================================

alter table public.profiles
  alter column role set default 'user',
  alter column role set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.venues
  alter column id set default gen_random_uuid(),
  alter column name set not null,
  alter column country set default 'US',
  alter column country set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.organizers
  alter column id set default gen_random_uuid(),
  alter column name set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.events
  alter column id set default gen_random_uuid(),
  alter column title set not null,
  alter column event_date set not null,
  alter column status set default 'approved',
  alter column city set default 'boston',
  alter column created_at set default now(),
  alter column source_type set default 'user_submission',
  alter column source_type set not null,
  alter column dance_styles set default '{}',
  alter column dance_styles set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.event_submissions
  alter column id set default gen_random_uuid(),
  alter column status set default 'pending',
  alter column status set not null,
  alter column submitted_data set not null,
  alter column submitted_at set default now(),
  alter column submitted_at set not null,
  alter column dismissed_duplicate_ids set default '{}',
  alter column dismissed_duplicate_ids set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;
alter table public.taxonomy_terms
  alter column id set default gen_random_uuid(),
  alter column category set not null,
  alter column name set not null,
  alter column slug set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column display_order set default 0,
  alter column display_order set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;
alter table public.organizer_requests
  alter column id set default gen_random_uuid(),
  alter column user_id set not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;
alter table public.event_import_batches
  alter column id set default gen_random_uuid(),
  alter column filename set not null,
  alter column total_rows set not null,
  alter column created_count set not null,
  alter column duplicate_skipped_count set not null,
  alter column failed_count set not null,
  alter column created_at set default now(),
  alter column created_at set not null;
alter table public.event_attendees
  alter column id set default gen_random_uuid(),
  alter column display_name set not null,
  alter column category set not null,
  alter column source set default 'host',
  alter column source set not null,
  alter column party_size set default 1,
  alter column party_size set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;
alter table public.event_check_ins
  alter column id set default gen_random_uuid(),
  alter column checked_in_at set default now(),
  alter column checked_in_at set not null,
  alter column checked_in_by set not null,
  alter column method set default 'manual',
  alter column method set not null,
  alter column created_at set default now(),
  alter column created_at set not null;
alter table public.audit_logs
  alter column id set default gen_random_uuid(),
  alter column action set not null,
  alter column entity_type set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.event_taxonomy_terms
  alter column event_id set not null,
  alter column taxonomy_term_id set not null;

alter table public.organizer_members
  alter column member_role set default 'owner',
  alter column member_role set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.platform_settings
  alter column singleton set default true,
  alter column singleton set not null,
  alter column platform_name set not null,
  alter column public_site_url set not null,
  alter column support_email set not null,
  alter column default_city set not null,
  alter column default_country_code set not null,
  alter column default_timezone set not null,
  alter column default_locale set not null,
  alter column default_currency_code set not null,
  alter column default_event_duration_minutes set not null,
  alter column allow_public_event_suggestions set not null,
  alter column allow_registered_user_submissions set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- Canonical column types are checked with format_type, including array
-- element types and numeric typmods. A mismatch fails before constraints.
do $$
declare expected record; actual_type text;
begin
  for expected in
    select * from (values
      ('profiles','id','uuid'),
      ('profiles','display_name','text'),
      ('profiles','avatar_url','text'),
      ('profiles','role','text'),
      ('profiles','status','text'),
      ('profiles','created_at','timestamp with time zone'),
      ('profiles','updated_at','timestamp with time zone'),
      ('profiles','username','text'),
      ('profiles','status_reason','text'),
      ('venues','id','uuid'),
      ('venues','name','text'),
      ('venues','slug','text'),
      ('venues','address_line1','text'),
      ('venues','address_line2','text'),
      ('venues','city','text'),
      ('venues','state_region','text'),
      ('venues','postal_code','text'),
      ('venues','country','text'),
      ('venues','latitude','numeric(10,8)'),
      ('venues','longitude','numeric(11,8)'),
      ('venues','timezone','text'),
      ('venues','website','text'),
      ('venues','instagram','text'),
      ('venues','phone','text'),
      ('venues','status','text'),
      ('venues','normalized_name','text'),
      ('venues','normalized_address','text'),
      ('venues','created_at','timestamp with time zone'),
      ('venues','updated_at','timestamp with time zone'),
      ('organizers','id','uuid'),
      ('organizers','name','text'),
      ('organizers','slug','text'),
      ('organizers','description','text'),
      ('organizers','logo_url','text'),
      ('organizers','website','text'),
      ('organizers','instagram','text'),
      ('organizers','organizer_type','text'),
      ('organizers','primary_city','text'),
      ('organizers','status','text'),
      ('organizers','created_at','timestamp with time zone'),
      ('organizers','updated_at','timestamp with time zone'),
      ('events','id','uuid'),
      ('events','title','text'),
      ('events','description','text'),
      ('events','event_type','text'),
      ('events','event_date','timestamp with time zone'),
      ('events','event_time','text'),
      ('events','location','text'),
      ('events','address','text'),
      ('events','price_type','text'),
      ('events','price_amount','numeric(10,2)'),
      ('events','rsvp_link','text'),
      ('events','image_url','text'),
      ('events','status','text'),
      ('events','submitter_name','text'),
      ('events','submitter_email','text'),
      ('events','created_at','timestamp with time zone'),
      ('events','city','text'),
      ('events','host','text'),
      ('events','recurrence','text'),
      ('events','gallery','text[]'),
      ('events','submitter_id','uuid'),
      ('events','contact_email','text'),
      ('events','contact_instagram','text'),
      ('events','contact_website','text'),
      ('events','source_type','text'),
      ('events','dance_styles','text[]'),
      ('events','updated_at','timestamp with time zone'),
      ('events','cancellation_reason','text'),
      ('events','venue_id','uuid'),
      ('events','organizer_id','uuid'),
      ('event_submissions','id','uuid'),
      ('event_submissions','submitter_id','uuid'),
      ('event_submissions','submitter_email','text'),
      ('event_submissions','submitter_name','text'),
      ('event_submissions','status','text'),
      ('event_submissions','submitted_data','jsonb'),
      ('event_submissions','edited_data','jsonb'),
      ('event_submissions','submitted_at','timestamp with time zone'),
      ('event_submissions','reviewed_by','uuid'),
      ('event_submissions','reviewed_at','timestamp with time zone'),
      ('event_submissions','rejection_reason','text'),
      ('event_submissions','rejection_message','text'),
      ('event_submissions','internal_note','text'),
      ('event_submissions','duplicate_of_event_id','uuid'),
      ('event_submissions','dismissed_duplicate_ids','uuid[]'),
      ('event_submissions','approved_event_id','uuid'),
      ('event_submissions','created_at','timestamp with time zone'),
      ('event_submissions','updated_at','timestamp with time zone'),
      ('taxonomy_terms','id','uuid'),
      ('taxonomy_terms','category','text'),
      ('taxonomy_terms','name','text'),
      ('taxonomy_terms','normalized_name','text'),
      ('taxonomy_terms','slug','text'),
      ('taxonomy_terms','description','text'),
      ('taxonomy_terms','parent_id','uuid'),
      ('taxonomy_terms','status','text'),
      ('taxonomy_terms','display_order','integer'),
      ('taxonomy_terms','created_at','timestamp with time zone'),
      ('taxonomy_terms','updated_at','timestamp with time zone'),
      ('event_taxonomy_terms','event_id','uuid'),
      ('event_taxonomy_terms','taxonomy_term_id','uuid'),
      ('organizer_requests','id','uuid'),
      ('organizer_requests','user_id','uuid'),
      ('organizer_requests','proposed_organizer_id','uuid'),
      ('organizer_requests','proposed_name','text'),
      ('organizer_requests','organizer_type','text'),
      ('organizer_requests','description','text'),
      ('organizer_requests','website','text'),
      ('organizer_requests','instagram','text'),
      ('organizer_requests','primary_city','text'),
      ('organizer_requests','request_message','text'),
      ('organizer_requests','status','text'),
      ('organizer_requests','reviewed_by','uuid'),
      ('organizer_requests','reviewed_at','timestamp with time zone'),
      ('organizer_requests','rejection_reason_code','text'),
      ('organizer_requests','rejection_message','text'),
      ('organizer_requests','created_at','timestamp with time zone'),
      ('organizer_requests','updated_at','timestamp with time zone'),
      ('organizer_members','organizer_id','uuid'),
      ('organizer_members','user_id','uuid'),
      ('organizer_members','member_role','text'),
      ('organizer_members','status','text'),
      ('organizer_members','created_at','timestamp with time zone'),
      ('organizer_members','updated_at','timestamp with time zone'),
      ('event_import_batches','id','uuid'),
      ('event_import_batches','imported_by','uuid'),
      ('event_import_batches','filename','text'),
      ('event_import_batches','total_rows','integer'),
      ('event_import_batches','created_count','integer'),
      ('event_import_batches','duplicate_skipped_count','integer'),
      ('event_import_batches','failed_count','integer'),
      ('event_import_batches','created_at','timestamp with time zone'),
      ('platform_settings','singleton','boolean'),
      ('platform_settings','platform_name','text'),
      ('platform_settings','public_site_url','text'),
      ('platform_settings','support_email','text'),
      ('platform_settings','default_city','text'),
      ('platform_settings','default_country_code','text'),
      ('platform_settings','default_timezone','text'),
      ('platform_settings','default_locale','text'),
      ('platform_settings','default_currency_code','text'),
      ('platform_settings','default_event_duration_minutes','integer'),
      ('platform_settings','allow_public_event_suggestions','boolean'),
      ('platform_settings','allow_registered_user_submissions','boolean'),
      ('platform_settings','updated_by','uuid'),
      ('platform_settings','updated_at','timestamp with time zone'),
      ('event_attendees','id','uuid'),
      ('event_attendees','event_id','uuid'),
      ('event_attendees','profile_id','uuid'),
      ('event_attendees','display_name','text'),
      ('event_attendees','email','text'),
      ('event_attendees','category','text'),
      ('event_attendees','source','text'),
      ('event_attendees','party_size','integer'),
      ('event_attendees','notes','text'),
      ('event_attendees','created_by','uuid'),
      ('event_attendees','created_at','timestamp with time zone'),
      ('event_attendees','updated_at','timestamp with time zone'),
      ('event_check_ins','id','uuid'),
      ('event_check_ins','attendee_id','uuid'),
      ('event_check_ins','event_id','uuid'),
      ('event_check_ins','checked_in_at','timestamp with time zone'),
      ('event_check_ins','checked_in_by','uuid'),
      ('event_check_ins','method','text'),
      ('event_check_ins','reversed_at','timestamp with time zone'),
      ('event_check_ins','reversed_by','uuid'),
      ('event_check_ins','reversal_reason','text'),
      ('event_check_ins','created_at','timestamp with time zone'),
      ('audit_logs','id','uuid'),
      ('audit_logs','actor_id','uuid'),
      ('audit_logs','action','text'),
      ('audit_logs','entity_type','text'),
      ('audit_logs','entity_id','uuid'),
      ('audit_logs','metadata','jsonb'),
      ('audit_logs','created_at','timestamp with time zone'),
      ('audit_logs','before_state','jsonb'),
      ('audit_logs','after_state','jsonb'),
      ('audit_logs','reason','text'),
      ('audit_logs','target_type','text'),
      ('audit_logs','target_id','uuid'),
      ('audit_logs','target_name','text')
    ) as v(table_name, column_name, expected_type)
  loop
    select format_type(a.atttypid, a.atttypmod)
      into actual_type
      from pg_attribute a
      where a.attrelid = format('public.%s', expected.table_name)::regclass
        and a.attname = expected.column_name
        and a.attnum > 0
        and not a.attisdropped;
    if actual_type is distinct from expected.expected_type then
      raise exception 'Current schema type mismatch: public.%.% is %, expected %',
        expected.table_name, expected.column_name, coalesce(actual_type, '<missing>'), expected.expected_type;
    end if;
  end loop;
  if not exists (
    select 1
    from pg_attribute a
    join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = 'public.taxonomy_terms'::regclass
      and a.attname = 'normalized_name'
      and a.attgenerated = 's'
      and regexp_replace(pg_get_expr(d.adbin, d.adrelid), '\s+', '', 'g') =
          'lower(btrim(normalize(name,''NFKC''::text)))'
  ) then
    raise exception 'Current schema mismatch: taxonomy_terms.normalized_name expression differs from canonical normalization';
  end if;
end;
$$;

-- Remaining foreign keys and key constraints are guarded by catalog lookup.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_pkey') then
    alter table public.profiles add constraint profiles_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.venues'::regclass and conname = 'venues_pkey') then
    alter table public.venues add constraint venues_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizers'::regclass and conname = 'organizers_pkey') then
    alter table public.organizers add constraint organizers_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_pkey') then
    alter table public.events add constraint events_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_submissions'::regclass and conname = 'event_submissions_pkey') then
    alter table public.event_submissions add constraint event_submissions_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.taxonomy_terms'::regclass and conname = 'taxonomy_terms_pkey') then
    alter table public.taxonomy_terms add constraint taxonomy_terms_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_requests'::regclass and conname = 'organizer_requests_pkey') then
    alter table public.organizer_requests add constraint organizer_requests_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_members'::regclass and conname = 'organizer_members_pkey') then
    alter table public.organizer_members add constraint organizer_members_pkey primary key (organizer_id, user_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_import_batches'::regclass and conname = 'event_import_batches_pkey') then
    alter table public.event_import_batches add constraint event_import_batches_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_pkey') then
    alter table public.platform_settings add constraint platform_settings_pkey primary key (singleton);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_pkey') then
    alter table public.event_attendees add constraint event_attendees_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_check_ins'::regclass and conname = 'event_check_ins_pkey') then
    alter table public.event_check_ins add constraint event_check_ins_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.audit_logs'::regclass and conname = 'audit_logs_pkey') then
    alter table public.audit_logs add constraint audit_logs_pkey primary key (id);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_submitter_id_fkey') then
    alter table public.events add constraint events_submitter_id_fkey foreign key (submitter_id) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_submissions'::regclass and conname = 'event_submissions_submitter_id_fkey') then
    alter table public.event_submissions add constraint event_submissions_submitter_id_fkey foreign key (submitter_id) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_submissions'::regclass and conname = 'event_submissions_reviewed_by_fkey') then
    alter table public.event_submissions add constraint event_submissions_reviewed_by_fkey foreign key (reviewed_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_submissions'::regclass and conname = 'event_submissions_duplicate_of_event_id_fkey') then
    alter table public.event_submissions add constraint event_submissions_duplicate_of_event_id_fkey foreign key (duplicate_of_event_id) references public.events(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_submissions'::regclass and conname = 'event_submissions_approved_event_id_fkey') then
    alter table public.event_submissions add constraint event_submissions_approved_event_id_fkey foreign key (approved_event_id) references public.events(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_requests'::regclass and conname = 'organizer_requests_user_id_fkey') then
    alter table public.organizer_requests add constraint organizer_requests_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_requests'::regclass and conname = 'organizer_requests_proposed_organizer_id_fkey') then
    alter table public.organizer_requests add constraint organizer_requests_proposed_organizer_id_fkey foreign key (proposed_organizer_id) references public.organizers(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_requests'::regclass and conname = 'organizer_requests_reviewed_by_fkey') then
    alter table public.organizer_requests add constraint organizer_requests_reviewed_by_fkey foreign key (reviewed_by) references public.profiles(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_members'::regclass and conname = 'organizer_members_organizer_id_fkey') then
    alter table public.organizer_members add constraint organizer_members_organizer_id_fkey foreign key (organizer_id) references public.organizers(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.organizer_members'::regclass and conname = 'organizer_members_user_id_fkey') then
    alter table public.organizer_members add constraint organizer_members_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_import_batches'::regclass and conname = 'event_import_batches_imported_by_fkey') then
    alter table public.event_import_batches add constraint event_import_batches_imported_by_fkey foreign key (imported_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.platform_settings'::regclass and conname = 'platform_settings_updated_by_fkey') then
    alter table public.platform_settings add constraint platform_settings_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_event_id_fkey') then
    alter table public.event_attendees add constraint event_attendees_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_profile_id_fkey') then
    alter table public.event_attendees add constraint event_attendees_profile_id_fkey foreign key (profile_id) references public.profiles(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_attendees'::regclass and conname = 'event_attendees_created_by_fkey') then
    alter table public.event_attendees add constraint event_attendees_created_by_fkey foreign key (created_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_check_ins'::regclass and conname = 'event_check_ins_checked_in_by_fkey') then
    alter table public.event_check_ins add constraint event_check_ins_checked_in_by_fkey foreign key (checked_in_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_check_ins'::regclass and conname = 'event_check_ins_reversed_by_fkey') then
    alter table public.event_check_ins add constraint event_check_ins_reversed_by_fkey foreign key (reversed_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.audit_logs'::regclass and conname = 'audit_logs_actor_id_fkey') then
    alter table public.audit_logs add constraint audit_logs_actor_id_fkey foreign key (actor_id) references auth.users(id);
  end if;
end;
$$;

-- =====================================================================
-- Resolved relational indexes (53 named indexes; all idempotent).
-- =====================================================================

create index if not exists events_city_idx on public.events (city);
create index if not exists events_status_event_date_idx on public.events (status, event_date);
create index if not exists events_dance_styles_idx on public.events using gin (dance_styles);
create index if not exists events_venue_id_idx on public.events (venue_id);
create index if not exists events_event_date_status_idx on public.events (event_date, status);
create index if not exists events_organizer_id_idx on public.events (organizer_id);
create index if not exists events_submitter_id_idx on public.events (submitter_id);

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_type_id_idx on public.audit_logs (entity_type, entity_id) where entity_id is not null;
create index if not exists audit_logs_actor_id_created_idx on public.audit_logs (actor_id, created_at desc) where actor_id is not null;
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_created_at_id_idx on public.audit_logs (created_at desc, id desc);
create index if not exists audit_logs_metadata_gin on public.audit_logs using gin (metadata);
create index if not exists audit_logs_target_lookup_idx on public.audit_logs (target_type, target_id) where target_id is not null;
create index if not exists audit_logs_reason_idx on public.audit_logs (reason) where reason is not null;

create index if not exists event_submissions_status_submitted_idx on public.event_submissions (status, submitted_at desc);
create index if not exists event_submissions_submitter_id_idx on public.event_submissions (submitter_id);
create index if not exists event_submissions_submitted_at_idx on public.event_submissions (submitted_at);
create index if not exists event_submissions_approved_event_id_idx on public.event_submissions (approved_event_id) where approved_event_id is not null;
create index if not exists event_submissions_reviewed_by_idx on public.event_submissions (reviewed_by);
create index if not exists event_submissions_duplicate_of_event_id_idx on public.event_submissions (duplicate_of_event_id) where duplicate_of_event_id is not null;

create unique index if not exists organizers_slug_unique_idx on public.organizers (slug);
create index if not exists organizers_status_idx on public.organizers (status);
create index if not exists organizers_primary_city_idx on public.organizers (primary_city);
create index if not exists organizer_requests_user_id_idx on public.organizer_requests (user_id);
create index if not exists organizer_requests_proposed_organizer_id_idx on public.organizer_requests (proposed_organizer_id) where proposed_organizer_id is not null;
create index if not exists organizer_requests_reviewed_by_idx on public.organizer_requests (reviewed_by) where reviewed_by is not null;
create index if not exists organizer_requests_status_created_idx on public.organizer_requests (status, created_at desc);
create index if not exists organizer_members_user_id_idx on public.organizer_members (user_id);
create index if not exists organizer_members_organizer_status_idx on public.organizer_members (organizer_id, status);

create unique index if not exists venues_slug_unique_idx on public.venues (slug);
create index if not exists venues_normalized_name_idx on public.venues (normalized_name);
create index if not exists venues_city_idx on public.venues (city);
create index if not exists venues_status_idx on public.venues (status);
create index if not exists venues_normalized_address_idx on public.venues (normalized_address) where normalized_address is not null;

create index if not exists event_import_batches_created_at_idx on public.event_import_batches (created_at desc);
create index if not exists event_import_batches_imported_by_idx on public.event_import_batches (imported_by);

create index if not exists taxonomy_terms_directory_idx on public.taxonomy_terms (category, status, display_order, name);
create index if not exists taxonomy_terms_parent_idx on public.taxonomy_terms (parent_id) where parent_id is not null;
create index if not exists event_taxonomy_terms_term_event_idx on public.event_taxonomy_terms (taxonomy_term_id, event_id);

create index if not exists event_attendees_event_category_idx on public.event_attendees (event_id, category);
create index if not exists event_attendees_event_display_name_idx on public.event_attendees (event_id, display_name);
create index if not exists event_check_ins_one_active_per_attendee_idx on public.event_check_ins (attendee_id) where reversed_at is null;
create index if not exists event_check_ins_attendee_event_idx on public.event_check_ins (attendee_id, event_id);
create index if not exists event_attendees_profile_id_idx on public.event_attendees (profile_id) where profile_id is not null;
create index if not exists event_attendees_created_by_idx on public.event_attendees (created_by);
create index if not exists event_check_ins_checked_in_by_idx on public.event_check_ins (checked_in_by);
create index if not exists event_check_ins_reversed_by_idx on public.event_check_ins (reversed_by) where reversed_by is not null;
create index if not exists event_check_ins_event_checked_in_at_idx on public.event_check_ins (event_id, checked_in_at desc);

commit;

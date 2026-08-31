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

-- =====================================================================
-- Task 3: functions, views, triggers, and RPC contracts
-- =====================================================================

-- Final function: set_updated_at
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

-- Final function: handle_new_user
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

-- Final function: is_moderator
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'moderator');
$$;

-- Final function: is_admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- Final function: account_is_active
create or replace function public.account_is_active(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((select status = 'active' from public.profiles where id = p_user_id), true);
$$;

-- Final function: slugify
create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g')), ''), 'item');
$$;

-- Final function: category_of
create or replace function public.category_of(p_action text, p_entity_type text)
returns text
language sql
stable
as $$
  select case
    -- Security-sensitive actions always take priority over entity_type
    -- so bans/suspensions/role-changes/access-policy changes are always "security".
    when p_action in ('user.banned', 'user.suspended', 'user.role_changed',
                      'platform_settings.access_policy_changed') then 'security'
    when p_entity_type = 'platform_settings' then 'settings'
    when p_entity_type = 'event' then 'events'
    when p_entity_type = 'event_submission' then 'submissions'
    when p_entity_type = 'profile' or p_entity_type = 'organizer' then 'users'
    when p_entity_type = 'venue' then 'venues'
    when p_entity_type = 'taxonomy_term' then 'taxonomy'
    else 'events'  -- default to 'events' to match the TS model (categoryOf fallback)
  end;
$$;

-- Final function: is_platform_admin
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Final function: log_event_change
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

-- Final function: log_submission_change
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

-- Final function: set_organizer_slug
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

-- Final function: set_venue_derived_fields
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

-- Final function: venue_quality_issues
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

-- Final function: stamp_platform_settings_update
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

-- Final function: log_platform_settings_change
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

-- Final function: admin_set_user_role
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

-- Final function: admin_set_user_status
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

-- Final function: admin_user_directory
drop function if exists public.admin_user_directory();

create or replace function public.admin_user_directory()
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

-- Final function: admin_organizer_requests
create or replace function public.admin_organizer_requests()
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

-- Final function: admin_organizer_request_detail
create or replace function public.admin_organizer_request_detail(p_id uuid)
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

-- Final function: admin_approve_organizer_request
create or replace function public.admin_approve_organizer_request(p_request_id uuid, p_reviewer_id uuid, p_internal_note text default null)
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

-- Final function: admin_reject_organizer_request
create or replace function public.admin_reject_organizer_request(p_request_id uuid, p_reviewer_id uuid, p_reason_code text, p_reason_message text default null, p_internal_note text default null)
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

-- Final function: admin_revoke_organizer_access
create or replace function public.admin_revoke_organizer_access(p_organizer_id uuid, p_reviewer_id uuid, p_reason text default null)
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

-- Final function: admin_organizer_request_counts
create or replace function public.admin_organizer_request_counts()
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

-- Final function: admin_venue_directory
create or replace function public.admin_venue_directory(
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

-- Final function: admin_venue_detail
create or replace function public.admin_venue_detail(p_id uuid)
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

-- Final function: admin_venue_search
create or replace function public.admin_venue_search(p_query text, p_limit integer default 10)
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

-- Final function: merge_venues
create or replace function public.merge_venues(p_keep_id uuid, p_merge_id uuid)
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

-- Final function: admin_audit_log
create or replace function public.admin_audit_log(
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

-- Final function: admin_analytics_metrics
create or replace function public.admin_analytics_metrics(
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
  -- Admin role check
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  -- Previous period boundaries (same length, immediately before)
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

    -- Attach deltas
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

-- Final function: admin_analytics_timeseries
create or replace function public.admin_analytics_timeseries(
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
  v_bucket_fn text; -- the date_trunc unit: 'day', 'week', 'month'
  v_label_fmt text; -- to_char format for the label
begin
  -- Admin role check
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  -- Map granularity to date_trunc unit + label format
  if granularity = 'daily' then
    v_bucket_fn := 'day';
    v_label_fmt := 'Dy Mon DD';
  elsif granularity = 'monthly' then
    v_bucket_fn := 'month';
    v_label_fmt := 'Mon YYYY';
  else  -- weekly (default)
    v_bucket_fn := 'week';
    v_label_fmt := 'Mon DD';
  end if;

  -- Published events by bucket
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

  -- Submissions by bucket (same granularity)
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

-- Final function: public_event_suggestions_enabled
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

-- Final function: registered_event_submissions_enabled
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

-- Final function: admin_invite_user
drop function if exists public.admin_invite_user(text, text, text);

create or replace function public.admin_invite_user(
  p_email        text,
  p_display_name text default null,
  p_role         text  default 'user'
)
returns table (
  id             uuid,
  email          text,
  display_name   text,
  username       text,
  role           text,
  status         text,
  created_at     timestamptz,
  temp_password  text
)
language plpgsql
security definer
set search_path = public
as $$
-- RETURNS TABLE names (id, email, role, status, ...) are plpgsql variables and
-- would shadow the identically named profiles columns in `on conflict (id)`.
-- Every local below is v_-prefixed and no OUT parameter is ever read, so
-- resolving bare names to columns is unambiguously correct.
#variable_conflict use_column
declare
  v_user_id       uuid := gen_random_uuid();
  v_email         text := lower(btrim(p_email));
  v_display_name  text := nullif(btrim(p_display_name), '');
  v_password      text;
  v_now           timestamptz := now();
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_role not in ('user', 'moderator', 'organizer', 'admin') then
    raise exception 'Unknown role %', p_role using errcode = '22023';
  end if;
  if v_email = '' then
    raise exception 'Email is required' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception '% is not a valid email address', v_email using errcode = '22023';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'An account already exists for %', v_email using errcode = '23505';
  end if;

  -- 16 URL-safe characters from 12 random bytes; comfortably above
  -- auth.minimum_password_length and never persisted in plaintext.
  v_password := translate(
    encode(extensions.gen_random_bytes(12), 'base64'),
    '+/=', 'xyz'
  );

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    reauthentication_token, phone_change, phone_change_token,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated',
    'authenticated', v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    v_now, v_now, v_now, v_now,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', p_role),
    jsonb_build_object('display_name', v_display_name, 'email_verified', true),
    '', '', '', '', '', '', '', '',
    false, false
  );

  insert into auth.identities (
    provider_id, user_id, provider, identity_data, created_at, updated_at
  ) values (
    v_user_id::text, v_user_id, 'email',
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    v_now, v_now
  );

  -- handle_new_user() has already created this row with role 'user'; adopt the
  -- requested role and display name instead of colliding with it.
  insert into public.profiles as p (id, display_name, role, status)
  values (v_user_id, v_display_name, p_role, 'active')
  on conflict (id) do update
    set display_name = coalesce(excluded.display_name, p.display_name),
        role         = excluded.role,
        status       = excluded.status;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'user.invited', 'profile', v_user_id,
          jsonb_build_object('email', v_email, 'role', p_role));

  return query
  select v_user_id,
         v_email,
         v_display_name,
         null::text,
         p_role,
         'active'::text,
         v_now,
         v_password;
end;
$$;

-- Final function: is_active_organizer_member
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
     where m.organizer_id = p_organizer_id
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

-- Final function: organizer_member_role
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

-- Final function: organizer_update_event
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

-- Final function: replace_event_taxonomy_terms
create or replace function public.replace_event_taxonomy_terms(p_event_id uuid, p_taxonomy_term_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_ids uuid[] := coalesce(p_taxonomy_term_ids,'{}'::uuid[]);
begin
  perform public.require_taxonomy_moderator();
  if not exists(select 1 from events where id=p_event_id) then raise exception 'Event not found'; end if;
  if cardinality(v_ids) <> (select count(distinct id) from unnest(v_ids) id) then raise exception 'Duplicate taxonomy term IDs are not allowed'; end if;
  if (select count(*) from taxonomy_terms where id=any(v_ids)) <> cardinality(v_ids) then raise exception 'Unknown taxonomy term ID'; end if;
  if exists(select 1 from taxonomy_terms t where t.id=any(v_ids) and t.status<>'active' and not exists(select 1 from event_taxonomy_terms ett where ett.event_id=p_event_id and ett.taxonomy_term_id=t.id)) then raise exception 'New relationships must use active terms'; end if;
  delete from event_taxonomy_terms where event_id=p_event_id and taxonomy_term_id<>all(v_ids);
  insert into event_taxonomy_terms(event_id,taxonomy_term_id) select p_event_id,id from unnest(v_ids) id on conflict do nothing;
end; $$;

-- Final function: approve_event_submission
create or replace function public.approve_event_submission(p_submission_id uuid, p_taxonomy_term_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare s event_submissions%rowtype; d jsonb; v_event_id uuid; ids uuid[]:=coalesce(p_taxonomy_term_ids,'{}'::uuid[]);
begin
  perform public.require_taxonomy_moderator();
  select * into s from event_submissions where id=p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  if s.status not in ('pending','in_review','needs_information') then raise exception 'Submission is not approvable'; end if;
  d:=s.submitted_data||coalesce(s.edited_data,'{}'::jsonb);
  if coalesce(btrim(d->>'title'),'')='' or coalesce(d->>'event_type','')='' or coalesce(d->>'city','')='' or coalesce(d->>'event_date','')='' then raise exception 'Effective submission is missing title, event type, city, or event date'; end if;
  if (select count(*) from taxonomy_terms where id=any(ids) and status='active')<>cardinality(ids) then raise exception 'Approval requires known active taxonomy terms'; end if;
  insert into events(title,description,event_type,event_date,event_time,location,address,price_type,price_amount,rsvp_link,city,status,source_type,submitter_name,submitter_email,image_url)
  values(d->>'title',nullif(d->>'description',''),d->>'event_type',(d->>'event_date')::timestamptz,nullif(d->>'event_time',''),nullif(d->>'location',''),nullif(d->>'address',''),nullif(d->>'price_type',''),nullif(d->>'price_amount','')::numeric,nullif(d->>'rsvp_link',''),d->>'city','approved','moderator',s.submitter_name,s.submitter_email,nullif(d->>'image_url',''))
  returning id into v_event_id;
  insert into event_taxonomy_terms(event_id,taxonomy_term_id) select v_event_id, term_id from unnest(ids) as selected(term_id) on conflict do nothing;
  update event_submissions set status='approved',approved_event_id=v_event_id,reviewed_by=auth.uid(),reviewed_at=now() where id=p_submission_id;
  return v_event_id;
end; $$;

-- Final function: organizer_create_event
create or replace function public.organizer_create_event(
  p_organizer_id uuid,
  p_payload jsonb,
  p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_keys text[];
  v_bad text[];
  v_allowed constant text[] := array[
    'title','description','event_type','city','event_date','event_time',
    'location','address','price_type','price_amount','rsvp_link','recurrence',
    'contact_email','contact_instagram','contact_website','image_url','host',
    'dance_styles','venue_id'
  ];
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.account_is_active(auth.uid()) then
    raise exception 'account is not active' using errcode = '42501';
  end if;
  if not public.is_admin() and coalesce(public.organizer_member_role(p_organizer_id), '') not in ('owner', 'manager') then
    raise exception 'active owner or manager membership required' using errcode = '42501';
  end if;
  if p_payload is null or p_payload = '{}'::jsonb then
    raise exception 'event details are required' using errcode = '22023';
  end if;
  if nullif(btrim(p_payload ->> 'title'), '') is null then
    raise exception 'title must not be empty' using errcode = '22023';
  end if;

  select array_agg(k) into v_keys from jsonb_object_keys(p_payload) as k;
  select array_agg(k order by k) into v_bad
    from unnest(v_keys) as keys(k)
   where not (k = any(v_allowed));
  if v_bad is not null and cardinality(v_bad) > 0 then
    raise exception 'field not accepted for organizer creation: %', v_bad using errcode = '42501';
  end if;

  insert into public.events (
    title, description, event_type, city, event_date, event_time, location, address,
    price_type, price_amount, rsvp_link, recurrence, contact_email, contact_instagram,
    contact_website, image_url, host, dance_styles, venue_id, organizer_id,
    status, source_type, submitter_id, submitter_email, submitter_name
  ) values (
    p_payload ->> 'title', nullif(p_payload ->> 'description', ''),
    p_payload ->> 'event_type', p_payload ->> 'city',
    (p_payload ->> 'event_date')::timestamptz, nullif(p_payload ->> 'event_time', ''),
    nullif(p_payload ->> 'location', ''), nullif(p_payload ->> 'address', ''),
    nullif(p_payload ->> 'price_type', ''), nullif(p_payload ->> 'price_amount', '')::numeric,
    nullif(p_payload ->> 'rsvp_link', ''), nullif(p_payload ->> 'recurrence', ''),
    nullif(p_payload ->> 'contact_email', ''), nullif(p_payload ->> 'contact_instagram', ''),
    nullif(p_payload ->> 'contact_website', ''), nullif(p_payload ->> 'image_url', ''),
    nullif(p_payload ->> 'host', ''),
    coalesce(array(select value from jsonb_array_elements_text(coalesce(p_payload -> 'dance_styles', '[]'::jsonb))), '{}'),
    nullif(p_payload ->> 'venue_id', '')::uuid, p_organizer_id,
    case when p_publish then 'approved' else 'draft' end, 'organizer',
    auth.uid(), auth.jwt() ->> 'email', null
  ) returning id into v_event_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'event.organizer_created', 'event', v_event_id,
          jsonb_build_object('organizer_id', p_organizer_id, 'published', p_publish));
  return v_event_id;
end;
$$;

-- Final function: is_organizer
create or replace function public.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'organizer';
$$;

-- Final function: can_manage_event_attendance
create or replace function public.can_manage_event_attendance(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (
        (
          e.status = 'approved'
          and e.submitter_id = (select auth.uid())
          and public.is_organizer()
          and public.account_is_active((select auth.uid()))
        )
        or public.is_admin()
      )
  );
$$;

-- Final function: guard_event_attendee_immutable_columns
create or replace function public.guard_event_attendee_immutable_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_id is distinct from old.event_id then
    raise exception 'event_attendees.event_id is immutable'
      using errcode = '42501';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'event_attendees.created_by is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Final function: guard_event_check_in_immutable_columns
create or replace function public.guard_event_check_in_immutable_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.attendee_id is distinct from old.attendee_id
     or new.event_id is distinct from old.event_id then
    raise exception 'event_check_ins attendee_id and event_id are immutable'
      using errcode = '42501';
  end if;

  if new.checked_in_at is distinct from old.checked_in_at
     or new.checked_in_by is distinct from old.checked_in_by
     or new.method is distinct from old.method
     or new.created_at is distinct from old.created_at then
    raise exception 'event_check_ins arrival facts are immutable; reverse the check-in instead'
      using errcode = '42501';
  end if;

  -- Reversal is one-way. Clearing reversed_at would erase the fact that a
  -- reversal happened, which is exactly the history this table exists to keep.
  if old.reversed_at is not null and new.reversed_at is null then
    raise exception 'event_check_ins reversal cannot be undone; record a new check-in instead'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Final function: guard_submitter_submission_update
create or replace function public.guard_submitter_submission_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_moderator() then
    return new;
  end if;

  if old.submitter_id is distinct from auth.uid() then
    raise exception 'submission owner required' using errcode = '42501';
  end if;

  if old.status not in ('pending', 'rejected') then
    raise exception 'only pending or rejected submissions may be changed by submitter'
      using errcode = '42501';
  end if;

  -- Owner may retain status while saving edits, or withdraw a pending record.
  if not (
    new.status = old.status
    or (old.status = 'pending' and new.status = 'withdrawn')
  ) then
    raise exception 'submitter may only withdraw a pending submission'
      using errcode = '42501';
  end if;

  -- Canonical source, identity, reviewer workflow, and duplicate handling
  -- remain moderator-owned. An owner may only alter edited_data and the
  -- narrow status transition above; updated_at is maintained separately.
  if new.submitted_data is distinct from old.submitted_data
     or new.submitter_id is distinct from old.submitter_id
     or new.submitter_email is distinct from old.submitter_email
     or new.submitter_name is distinct from old.submitter_name
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.rejection_reason is distinct from old.rejection_reason
     or new.rejection_message is distinct from old.rejection_message
     or new.internal_note is distinct from old.internal_note
     or new.duplicate_of_event_id is distinct from old.duplicate_of_event_id
     or new.dismissed_duplicate_ids is distinct from old.dismissed_duplicate_ids
     or new.approved_event_id is distinct from old.approved_event_id
     or new.submitted_at is distinct from old.submitted_at
     or new.created_at is distinct from old.created_at then
    raise exception 'submitter may only save edited event data or withdraw'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Final function: log_taxonomy_term_change
create or replace function public.log_taxonomy_term_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_term taxonomy_terms%rowtype;
begin
  v_term := case when tg_op = 'DELETE' then old else new end;
  v_action := case
    when tg_op = 'INSERT' then 'taxonomy.created'
    when tg_op = 'DELETE' then 'taxonomy.deleted'
    when old.status is distinct from new.status then 'taxonomy.status_changed'
    else 'taxonomy.updated'
  end;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    v_action,
    'taxonomy_term',
    v_term.id,
    jsonb_build_object(
      'name', v_term.name,
      'slug', v_term.slug,
      'category', v_term.category,
      'from_status', case when tg_op = 'UPDATE' then old.status else null end,
      'to_status', case when tg_op = 'DELETE' then null else new.status end
    )
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Final function: require_taxonomy_moderator
create or replace function public.require_taxonomy_moderator()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'Moderator role required'; end if;
end;
$$;

-- Final function: admin_taxonomy_directory
create or replace function public.admin_taxonomy_directory(p_search text default '', p_category text default null, p_status text default null, p_view text default 'all')
returns table (id uuid, category text, name text, slug text, description text, parent_id uuid, status text, display_order integer, usage_count bigint, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_taxonomy_moderator();
  return query select t.id,t.category,t.name,t.slug,t.description,t.parent_id,t.status,t.display_order,count(ett.event_id)::bigint,t.updated_at
  from taxonomy_terms t left join event_taxonomy_terms ett on ett.taxonomy_term_id=t.id
  where (p_search='' or t.name ilike '%'||p_search||'%' or t.slug ilike '%'||p_search||'%') and (p_category is null or t.category=p_category) and (p_status is null or t.status=p_status)
  group by t.id
  having (p_view<>'unused' or count(ett.event_id)=0) and (p_view<>'active' or t.status='active') and (p_view<>'archived' or t.status='archived') and (p_view<>'needs_review' or t.status='needs_review') and (p_view<>'dance_styles' or t.category='dance_style') and (p_view<>'attributes' or t.category='event_attribute')
  order by t.category,t.display_order,t.name;
end; $$;

-- Final function: admin_taxonomy_detail
create or replace function public.admin_taxonomy_detail(p_id uuid)
returns table (id uuid, category text, name text, slug text, description text, parent_id uuid, status text, display_order integer, usage_count bigint, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_taxonomy_moderator();
  return query select t.id,t.category,t.name,t.slug,t.description,t.parent_id,t.status,t.display_order,count(ett.event_id)::bigint,t.created_at,t.updated_at from taxonomy_terms t left join event_taxonomy_terms ett on ett.taxonomy_term_id=t.id where t.id=p_id group by t.id;
end; $$;

-- Final function: admin_taxonomy_search
create or replace function public.admin_taxonomy_search(p_category text, p_search text default '')
returns table (id uuid, category text, name text, slug text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_taxonomy_moderator();
  return query select t.id,t.category,t.name,t.slug,t.status from taxonomy_terms t where t.category=p_category and t.status='active' and (p_search='' or t.name ilike '%'||p_search||'%' or t.slug ilike '%'||p_search||'%') order by t.display_order,t.name;
end; $$;

-- Final function: merge_taxonomy_terms
create or replace function public.merge_taxonomy_terms(p_keep_id uuid, p_merge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_taxonomy_moderator();
  if p_keep_id=p_merge_id then raise exception 'Choose two different terms'; end if;
  if not exists(select 1 from taxonomy_terms k join taxonomy_terms s on s.id=p_merge_id where k.id=p_keep_id and k.category=s.category) then raise exception 'Terms must exist in the same category'; end if;
  insert into event_taxonomy_terms(event_id,taxonomy_term_id) select event_id,p_keep_id from event_taxonomy_terms where taxonomy_term_id=p_merge_id on conflict do nothing;
  delete from event_taxonomy_terms where taxonomy_term_id=p_merge_id;
  update taxonomy_terms set status='archived' where id=p_merge_id;
  insert into audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'taxonomy.merged','taxonomy_term',p_merge_id,jsonb_build_object('keep_id',p_keep_id));
end; $$;

-- Internal views are invoker-secured; Task 4 owns their table/function grants.
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
    p_roles.display_name as actor_display_name,
    p_roles.username as actor_username,
    p_roles.avatar_url as actor_avatar_url
  from public.audit_logs a
  left join public.profiles p_roles on p_roles.id = a.actor_id;
create or replace view public.v_analytics_event_counts as
select
  count(*) filter (where status = 'approved') as approved_count,
  count(*) filter (where status = 'pending') as pending_count,
  count(*) filter (where status = 'rejected') as rejected_count,
  count(*) filter (where rsvp_link is not null) as rsvp_count,
  count(*) as total_count
from public.events
where event_date >= current_date - interval '30 days'
  and event_date < current_date + interval '1 day';

alter view public.audit_log_view set (security_invoker = on);
alter view public.v_analytics_event_counts set (security_invoker = on);
revoke all on public.audit_log_view from public, anon, authenticated;
revoke all on public.v_analytics_event_counts from public, anon, authenticated;

-- Final 20 triggers (Task 4 owns table grants and RLS).
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

drop trigger if exists event_attendees_set_updated_at on public.event_attendees;
create trigger event_attendees_set_updated_at
  before update on public.event_attendees
  for each row execute function public.set_updated_at();

drop trigger if exists event_attendees_guard_immutable on public.event_attendees;
create trigger event_attendees_guard_immutable
  before update on public.event_attendees
  for each row execute function public.guard_event_attendee_immutable_columns();

drop trigger if exists event_check_ins_guard_immutable on public.event_check_ins;
create trigger event_check_ins_guard_immutable
  before update on public.event_check_ins
  for each row execute function public.guard_event_check_in_immutable_columns();

drop trigger if exists event_submissions_guard_submitter_update on public.event_submissions;
create trigger event_submissions_guard_submitter_update
  before update on public.event_submissions
  for each row execute function public.guard_submitter_submission_update();

drop trigger if exists taxonomy_terms_set_updated_at on public.taxonomy_terms;
create trigger taxonomy_terms_set_updated_at
  before update on public.taxonomy_terms
  for each row execute function public.set_updated_at();

drop trigger if exists taxonomy_terms_audit_log on public.taxonomy_terms;
create trigger taxonomy_terms_audit_log
  after insert or update or delete on public.taxonomy_terms
  for each row execute function public.log_taxonomy_term_change();

-- Trigger-only and internal mutation helpers are never directly callable.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.log_event_change() from public, anon, authenticated;
revoke all on function public.log_submission_change() from public, anon, authenticated;
revoke all on function public.set_organizer_slug() from public, anon, authenticated;
revoke all on function public.set_venue_derived_fields() from public, anon, authenticated;
revoke all on function public.stamp_platform_settings_update() from public, anon, authenticated;
revoke all on function public.log_platform_settings_change() from public, anon, authenticated;
revoke all on function public.log_taxonomy_term_change() from public, anon, authenticated;
revoke all on function public.guard_event_attendee_immutable_columns() from public, anon, authenticated;
revoke all on function public.guard_event_check_in_immutable_columns() from public, anon, authenticated;
revoke all on function public.guard_submitter_submission_update() from public, anon, authenticated;
revoke all on function public.require_taxonomy_moderator() from public, anon, authenticated;
revoke all on function public.account_is_active(uuid) from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.is_moderator() from public, anon, authenticated;
revoke all on function public.is_platform_admin() from public, anon, authenticated;
revoke all on function public.is_organizer() from public, anon, authenticated;
revoke all on function public.slugify(text) from public, anon, authenticated;
revoke all on function public.category_of(text, text) from public, anon, authenticated;
revoke all on function public.venue_quality_issues(public.venues) from public, anon, authenticated;
revoke all on function public.can_manage_event_attendance(uuid) from public, anon, authenticated;
revoke all on function public.is_active_organizer_member(uuid) from public, anon, authenticated;
revoke all on function public.organizer_member_role(uuid) from public, anon, authenticated;

commit;

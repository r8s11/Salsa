-- Flyer -> entity foundation.
--
-- Explicit Venue / Organizer / Instructor / School entities (no polymorphic
-- entity table), flyer-candidate reconciliation, and authorized, atomic,
-- idempotent canonical writes from the admin event editor and from
-- submission approval.
--
-- PREREQUISITES (all already present in every database built from this repo):
--   tables  public.events, public.venues, public.organizers,
--           public.event_submissions, public.taxonomy_terms,
--           public.event_taxonomy_terms, public.audit_logs
--   funcs   public.is_admin(), public.is_moderator(),
--           public.account_is_active(uuid), public.set_updated_at()
-- It deliberately does NOT depend on public.slugify, the venue/organizer slug
-- triggers, public.require_taxonomy_moderator, or on an existing
-- approve_event_submission: a drifted database that lacks them still works,
-- and a database that has them keeps working (slugs and normalized columns
-- are always supplied explicitly on insert).
--
-- SECURITY MODEL
--   * Public / anon: no direct access to any new table. Public reads go only
--     through public_flyer_entity() / public_event_entities(), which return
--     safe fields of non-archived entities. Existing RLS on venues,
--     organizers, events, event_submissions is NOT modified.
--   * Authenticated: reconcile_flyer_entities() and search_flyer_entities()
--     (read-only, safe public fields, active/needs_review rows only).
--   * Moderator/admin: save_event_with_entities() and
--     approve_event_submission(). Every canonical entity write happens inside
--     those SECURITY DEFINER functions, in the caller's transaction.
--   * A public submitter's entity_review (event_submissions.submitted_data)
--     is a suggestion only. approve_event_submission() trusts ONLY
--     event_submissions.moderator_entity_review, a column a trigger fills
--     from edited_data.entity_review when (and only when) the writer is a
--     moderator/admin; submitter writes null it. Items that are byte-identical
--     to the submitter's suggestion are downgraded to pending unless the
--     moderator marked them "moderator_confirmed": true.
--
-- IDEMPOTENCE / CONCURRENCY
--   Entity creation takes transaction-scoped advisory locks (sorted, so no
--   lock-order deadlock) on (kind, normalized name) and (kind, slug base),
--   then RE-QUERIES inside the lock. A concurrent or replayed identical save
--   therefore reuses the entity the first transaction committed instead of
--   creating a second one. Events are locked FOR UPDATE on update; submissions
--   are locked FOR UPDATE on approval and a replay returns the existing event.
--   Strong-match reuse happens only with corroboration (see
--   flyer_match_strength): a bare name match is never auto-linked.

-- ============================================================
-- 1. Tables and columns
-- ============================================================

-- Pure helpers first: expression indexes below depend on them.

create or replace function public.flyer_norm_text(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(
    regexp_replace(
      translate(
        lower(replace(coalesce(p, ''), '&', ' and ')),
        'àáâãäåāçćčèéêëēìíîïīñńòóôõöøōùúûüūýÿšž',
        'aaaaaaaccceeeeeiiiiinnooooooouuuuuyysz'
      ),
      '[''’`]', '', 'g'),
    '[^[:alnum:]]+', ' ', 'g'));
$$;

create or replace function public.flyer_norm_address(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
      public.flyer_norm_text(p),
      '\m(st)\M', 'street', 'g'),
      '\m(ave|av)\M', 'avenue', 'g'),
      '\m(rd)\M', 'road', 'g'),
      '\m(blvd|blv)\M', 'boulevard', 'g'),
      '\m(ct)\M', 'court', 'g'),
      '\m(pl)\M', 'place', 'g'),
      '\m(ln)\M', 'lane', 'g'),
      '\m(dr)\M', 'drive', 'g'),
      '\m(pkwy|pky)\M', 'parkway', 'g'),
      '\m(hwy)\M', 'highway', 'g'));
$$;

create or replace function public.flyer_norm_handle(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    regexp_replace(
      split_part(split_part(split_part(split_part(
        regexp_replace(lower(btrim(coalesce(p, ''))), '^(https?://)?(www\.)?(instagram\.com|instagr\.am)/', ''),
        '?', 1), '#', 1), '/', 1), ' ', 1),
      '^@+', ''),
    '');
$$;

create or replace function public.flyer_norm_host(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when h in ('instagram.com', 'facebook.com', 'fb.com', 'linktr.ee', 'eventbrite.com', 'meetup.com',
               'tiktok.com', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'linkedin.com',
               'google.com', 'goo.gl', 'bit.ly', 'forms.gle', 'docs.google.com') then null
    else nullif(h, '')
  end
  from (
    select regexp_replace(
             split_part(split_part(split_part(split_part(
               regexp_replace(lower(btrim(coalesce(p, ''))), '^[a-z]+://', ''),
               '/', 1), '?', 1), '#', 1), ':', 1),
             '^www\.', '') as h
  ) s;
$$;

create or replace function public.flyer_slugify(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(btrim(left(regexp_replace(public.flyer_norm_text(p), '[^a-z0-9]+', '-', 'g'), 80), '-'), ''),
    'item');
$$;

create or replace function public.flyer_uuid_or_null(p text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid
    else null
  end;
$$;

create or replace function public.flyer_country_code(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(btrim(coalesce(p, '')), '') is null then null
    when btrim(p) ~ '^[A-Za-z]{2}$' then upper(btrim(p))
    when public.flyer_norm_text(p) in ('usa', 'united states', 'united states of america', 'us of a') then 'US'
    when public.flyer_norm_text(p) = 'canada' then 'CA'
    when public.flyer_norm_text(p) = 'mexico' then 'MX'
    when public.flyer_norm_text(p) in ('uk', 'united kingdom', 'great britain', 'england') then 'GB'
    else null
  end;
$$;

create table if not exists public.instructors (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (length(btrim(name)) between 2 and 200),
  slug                  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  organization          text,
  city                  text,
  state_region          text,
  country               text check (country is null or country ~ '^[A-Z]{2}$'),
  website               text,
  instagram             text,
  status                text not null default 'active' check (status in ('active', 'needs_review', 'archived')),
  source_type           text not null default 'admin'
                          check (source_type in ('admin', 'flyer_extraction', 'submission_approval', 'import')),
  source_event_id       uuid references public.events (id) on delete set null,
  source_submission_id  uuid references public.event_submissions (id) on delete set null,
  source_flyer_url      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.schools (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (length(btrim(name)) between 2 and 200),
  slug                  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  address_line1         text,
  postal_code           text,
  city                  text,
  state_region          text,
  country               text check (country is null or country ~ '^[A-Z]{2}$'),
  latitude              numeric(10, 8),
  longitude             numeric(11, 8),
  website               text,
  instagram             text,
  phone                 text,
  status                text not null default 'active' check (status in ('active', 'needs_review', 'archived')),
  source_type           text not null default 'admin'
                          check (source_type in ('admin', 'flyer_extraction', 'submission_approval', 'import')),
  source_event_id       uuid references public.events (id) on delete set null,
  source_submission_id  uuid references public.event_submissions (id) on delete set null,
  source_flyer_url      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Source attribution + geography on the pre-existing entity tables. Existing
-- rows keep NULL source_type ("legacy/manual").
alter table public.venues
  add column if not exists source_type text
    check (source_type is null or source_type in ('admin', 'flyer_extraction', 'submission_approval', 'import')),
  add column if not exists source_event_id uuid references public.events (id) on delete set null,
  add column if not exists source_submission_id uuid references public.event_submissions (id) on delete set null,
  add column if not exists source_flyer_url text;

alter table public.organizers
  add column if not exists state_region text,
  add column if not exists country text,
  add column if not exists source_type text
    check (source_type is null or source_type in ('admin', 'flyer_extraction', 'submission_approval', 'import')),
  add column if not exists source_event_id uuid references public.events (id) on delete set null,
  add column if not exists source_submission_id uuid references public.event_submissions (id) on delete set null,
  add column if not exists source_flyer_url text;

create index if not exists venues_flyer_norm_name_idx on public.venues (public.flyer_norm_text(name));
create index if not exists organizers_flyer_norm_name_idx on public.organizers (public.flyer_norm_text(name));
create index if not exists instructors_flyer_norm_name_idx on public.instructors (public.flyer_norm_text(name));
create index if not exists schools_flyer_norm_name_idx on public.schools (public.flyer_norm_text(name));
create index if not exists venues_source_event_idx on public.venues (source_event_id) where source_event_id is not null;
create index if not exists organizers_source_event_idx on public.organizers (source_event_id) where source_event_id is not null;
create index if not exists instructors_source_event_idx on public.instructors (source_event_id) where source_event_id is not null;
create index if not exists schools_source_event_idx on public.schools (source_event_id) where source_event_id is not null;

drop trigger if exists instructors_set_updated_at on public.instructors;
create trigger instructors_set_updated_at
  before update on public.instructors
  for each row execute function public.set_updated_at();

drop trigger if exists schools_set_updated_at on public.schools;
create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

create table if not exists public.event_instructors (
  event_id      uuid not null references public.events (id) on delete cascade,
  instructor_id uuid not null references public.instructors (id) on delete restrict,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  primary key (event_id, instructor_id)
);
create index if not exists event_instructors_instructor_idx on public.event_instructors (instructor_id, event_id);

create table if not exists public.event_schools (
  event_id   uuid not null references public.events (id) on delete cascade,
  school_id  uuid not null references public.schools (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (event_id, school_id)
);
create index if not exists event_schools_school_idx on public.event_schools (school_id, event_id);

-- Review decisions retained on the event (candidate email/phone are stripped
-- before storage; see flyer_resolve_item) and the moderator-only snapshot on
-- submissions.
alter table public.events
  add column if not exists entity_review jsonb;

alter table public.event_submissions
  add column if not exists moderator_entity_review jsonb,
  add column if not exists entity_review_confirmed_by uuid references auth.users (id) on delete set null,
  add column if not exists entity_review_confirmed_at timestamptz,
  add column if not exists edited_data_by uuid;

-- ============================================================
-- 2. RLS / grants (new tables only; existing policies untouched)
-- ============================================================

alter table public.instructors enable row level security;
alter table public.schools enable row level security;
alter table public.event_instructors enable row level security;
alter table public.event_schools enable row level security;

revoke all on table public.instructors, public.schools, public.event_instructors, public.event_schools
  from anon, authenticated;
grant select, insert, update, delete on table
  public.instructors, public.schools, public.event_instructors, public.event_schools to authenticated;

drop policy if exists "Admins manage instructors" on public.instructors;
create policy "Admins manage instructors" on public.instructors
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage schools" on public.schools;
create policy "Admins manage schools" on public.schools
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Moderators read event instructors" on public.event_instructors;
create policy "Moderators read event instructors" on public.event_instructors
  for select to authenticated using (public.is_moderator());
drop policy if exists "Admins manage event instructors" on public.event_instructors;
create policy "Admins manage event instructors" on public.event_instructors
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Moderators read event schools" on public.event_schools;
create policy "Moderators read event schools" on public.event_schools
  for select to authenticated using (public.is_moderator());
drop policy if exists "Admins manage event schools" on public.event_schools;
create policy "Admins manage event schools" on public.event_schools
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 3. Candidate cleaning + matching
-- ============================================================

create or replace function public.flyer_json_text(p jsonb, p_key text, p_max integer)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p is not null and jsonb_typeof(p) = 'object' and jsonb_typeof(p -> p_key) = 'string'
      then nullif(left(btrim(p ->> p_key), p_max), '')
    else null
  end;
$$;

-- Whitelisted, trimmed, length-clamped candidate. NULL when not an object.
create or replace function public.flyer_clean_candidate(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when p is null or jsonb_typeof(p) <> 'object' then null else jsonb_build_object(
    'name', public.flyer_json_text(p, 'name', 200),
    'address', public.flyer_json_text(p, 'address', 300),
    'city', public.flyer_json_text(p, 'city', 120),
    'state_region', public.flyer_json_text(p, 'state_region', 120),
    'country', public.flyer_json_text(p, 'country', 80),
    'website', public.flyer_json_text(p, 'website', 300),
    'instagram', public.flyer_json_text(p, 'instagram', 120),
    'email', public.flyer_json_text(p, 'email', 200),
    'phone', public.flyer_json_text(p, 'phone', 60),
    'organization', public.flyer_json_text(p, 'organization', 200)
  ) end;
$$;

create or replace function public.flyer_clean_website(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(btrim(coalesce(p, '')), '') is null then null
    when btrim(p) ~* '^https?://[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(:[0-9]+)?([/?#]\S*)?$' then btrim(p)
    when btrim(p) ~* '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}([/?#]\S*)?$' then 'https://' || btrim(p)
    else null
  end;
$$;

create or replace function public.flyer_addr_same(a text, b text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(a, '') <> '' and coalesce(b, '') <> ''
     and (a = b or a like b || ' %' or b like a || ' %');
$$;

-- Deterministic strength of one existing entity against one candidate. All
-- inputs are already normalized (case/diacritics/whitespace/address
-- abbreviations, Instagram URL->handle, website->host, country->ISO code).
--   strong   same name + at least one IDENTITY signal (same street address,
--            website host or Instagram handle) + NO contradicting field (a
--            differing address, city, state, country, website host or
--            Instagram handle when both sides have one). City alone and the
--            source flyer are never identity signals.
--   conflict same name + an identity signal that another field contradicts
--            -> needs human review.
--   possible same name without an identity signal (incl. same source flyer),
--            a shared host/handle with a different name, or one long name
--            containing the other.
-- p_linked (the entity came from the same event/submission) only lets a
-- replayed candidate with NO identity fields of its own reuse it; it can never
-- override a contradiction, so two same-name people on one flyer stay distinct.
-- A bare name match is never 'strong'. NULL = not a match.
create or replace function public.flyer_match_strength(
  c_name text, c_addr text, c_city text, c_state text, c_country text, c_host text, c_ig text, c_flyer text,
  e_name text, e_addr text, e_city text, e_state text, e_country text, e_host text, e_ig text, e_flyer text,
  p_linked boolean
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_c_name text := coalesce(c_name, '');
  v_e_name text := coalesce(e_name, '');
  v_addr_same boolean := public.flyer_addr_same(c_addr, e_addr);
  v_host_same boolean := coalesce(c_host, '') <> '' and c_host = coalesce(e_host, '');
  v_ig_same boolean := coalesce(c_ig, '') <> '' and c_ig = coalesce(e_ig, '');
  v_conflict boolean :=
       (coalesce(c_addr, '') <> '' and coalesce(e_addr, '') <> '' and not v_addr_same)
    or (coalesce(c_city, '') <> '' and coalesce(e_city, '') <> '' and c_city <> e_city)
    or (coalesce(c_state, '') <> '' and coalesce(e_state, '') <> '' and c_state <> e_state)
    or (coalesce(c_country, '') <> '' and coalesce(e_country, '') <> '' and c_country <> e_country)
    or (coalesce(c_host, '') <> '' and coalesce(e_host, '') <> '' and not v_host_same)
    or (coalesce(c_ig, '') <> '' and coalesce(e_ig, '') <> '' and not v_ig_same);
  v_identity boolean := v_addr_same or v_host_same or v_ig_same;
  v_has_identity boolean := coalesce(c_addr, '') <> '' or coalesce(c_host, '') <> '' or coalesce(c_ig, '') <> '';
begin
  if v_c_name = '' or v_e_name = '' then return null; end if;

  if v_c_name = v_e_name then
    if v_identity and not v_conflict then return 'strong'; end if;
    if v_identity and v_conflict then return 'conflict'; end if;
    if coalesce(p_linked, false) and not v_conflict and not v_has_identity then return 'strong'; end if;
    return 'possible';
  end if;

  if v_host_same or v_ig_same then return 'possible'; end if;

  if length(v_c_name) >= 5 and length(v_e_name) >= 5
     and (position(v_c_name in v_e_name) > 0 or position(v_e_name in v_c_name) > 0) then
    return 'possible';
  end if;

  return null;
end;
$$;

-- A brand-new entity needs at least one kind-appropriate uniqueness signal so
-- a bare name can never mint a duplicate. Places (venue, school): address,
-- website or Instagram. People/brands (organizer, instructor): website or
-- Instagram. Unresolved ("pending") is always allowed instead.
create or replace function public.flyer_candidate_has_signal(p_kind text, p_candidate jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select public.flyer_clean_website(p_candidate ->> 'website') is not null
      or public.flyer_norm_handle(p_candidate ->> 'instagram') is not null
      or (p_kind in ('venue', 'school') and public.flyer_norm_address(p_candidate ->> 'address') <> '');
$$;

create or replace function public.flyer_entity_exists(p_kind text, p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_id is null then return false; end if;
  if p_kind = 'venue' then
    return exists (select 1 from public.venues v where v.id = p_id and v.status <> 'archived');
  elsif p_kind = 'organizer' then
    return exists (select 1 from public.organizers o where o.id = p_id and o.status = 'active');
  elsif p_kind = 'instructor' then
    return exists (select 1 from public.instructors i where i.id = p_id and i.status <> 'archived');
  elsif p_kind = 'school' then
    return exists (select 1 from public.schools s where s.id = p_id and s.status <> 'archived');
  end if;
  raise exception 'Unknown entity kind %', p_kind using errcode = '22023';
end;
$$;

-- Explicit per-table branches. Returns up to 8 candidates, strong first.
create or replace function public.flyer_entity_matches(
  p_kind text,
  p_candidate jsonb,
  p_event_id uuid default null,
  p_submission_id uuid default null,
  p_flyer_url text default null
)
returns table (
  id uuid, name text, address text, city text, state_region text,
  website text, instagram text, strength text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c jsonb := public.flyer_clean_candidate(p_candidate);
  c_name text;
  c_addr text;
  c_city text;
  c_state text;
  c_country text;
  c_host text;
  c_ig text;
  c_flyer text := nullif(btrim(coalesce(p_flyer_url, '')), '');
begin
  if c is null then return; end if;
  c_name := public.flyer_norm_text(c ->> 'name');
  if c_name = '' then return; end if;
  c_addr := public.flyer_norm_address(c ->> 'address');
  c_city := public.flyer_norm_text(c ->> 'city');
  c_state := public.flyer_norm_text(c ->> 'state_region');
  c_country := coalesce(public.flyer_country_code(c ->> 'country'), public.flyer_norm_text(c ->> 'country'));
  c_host := public.flyer_norm_host(c ->> 'website');
  c_ig := public.flyer_norm_handle(c ->> 'instagram');

  if p_kind = 'venue' then
    return query
      select m.id, m.name, m.address, m.city, m.state_region, m.website, m.instagram, m.strength
      from (
        select v.id, v.name, v.address_line1 as address, v.city, v.state_region, v.website, v.instagram,
          public.flyer_match_strength(
            c_name, c_addr, c_city, c_state, c_country, c_host, c_ig, c_flyer,
            public.flyer_norm_text(v.name), public.flyer_norm_address(v.address_line1),
            public.flyer_norm_text(v.city), public.flyer_norm_text(v.state_region),
            coalesce(public.flyer_country_code(v.country), public.flyer_norm_text(v.country)),
            public.flyer_norm_host(v.website),
            public.flyer_norm_handle(v.instagram), v.source_flyer_url,
            coalesce(v.source_event_id = p_event_id, false)
              or coalesce(v.source_submission_id = p_submission_id, false)
              or exists (select 1 from public.events ev where ev.id = p_event_id and ev.venue_id = v.id)
          ) as strength
        from public.venues v
        where v.status <> 'archived'
      ) m
      where m.strength is not null
      order by (m.strength = 'strong') desc, m.name, m.id
      limit 8;
  elsif p_kind = 'organizer' then
    return query
      select m.id, m.name, m.address, m.city, m.state_region, m.website, m.instagram, m.strength
      from (
        select o.id, o.name, null::text as address, o.primary_city as city, o.state_region, o.website, o.instagram,
          public.flyer_match_strength(
            c_name, c_addr, c_city, c_state, c_country, c_host, c_ig, c_flyer,
            public.flyer_norm_text(o.name), null,
            public.flyer_norm_text(o.primary_city), public.flyer_norm_text(o.state_region),
            coalesce(public.flyer_country_code(o.country), public.flyer_norm_text(o.country)),
            public.flyer_norm_host(o.website),
            public.flyer_norm_handle(o.instagram), o.source_flyer_url,
            coalesce(o.source_event_id = p_event_id, false)
              or coalesce(o.source_submission_id = p_submission_id, false)
              or exists (select 1 from public.events ev where ev.id = p_event_id and ev.organizer_id = o.id)
          ) as strength
        from public.organizers o
        where o.status = 'active'
      ) m
      where m.strength is not null
      order by (m.strength = 'strong') desc, m.name, m.id
      limit 8;
  elsif p_kind = 'instructor' then
    return query
      select m.id, m.name, m.address, m.city, m.state_region, m.website, m.instagram, m.strength
      from (
        select i.id, i.name, null::text as address, i.city, i.state_region, i.website, i.instagram,
          public.flyer_match_strength(
            c_name, c_addr, c_city, c_state, c_country, c_host, c_ig, c_flyer,
            public.flyer_norm_text(i.name), null,
            public.flyer_norm_text(i.city), public.flyer_norm_text(i.state_region),
            coalesce(public.flyer_country_code(i.country), public.flyer_norm_text(i.country)),
            public.flyer_norm_host(i.website),
            public.flyer_norm_handle(i.instagram), i.source_flyer_url,
            coalesce(i.source_event_id = p_event_id, false)
              or coalesce(i.source_submission_id = p_submission_id, false)
              or exists (select 1 from public.event_instructors ei
                         where ei.event_id = p_event_id and ei.instructor_id = i.id)
          ) as strength
        from public.instructors i
        where i.status <> 'archived'
      ) m
      where m.strength is not null
      order by (m.strength = 'strong') desc, m.name, m.id
      limit 8;
  elsif p_kind = 'school' then
    return query
      select m.id, m.name, m.address, m.city, m.state_region, m.website, m.instagram, m.strength
      from (
        select s.id, s.name, s.address_line1 as address, s.city, s.state_region, s.website, s.instagram,
          public.flyer_match_strength(
            c_name, c_addr, c_city, c_state, c_country, c_host, c_ig, c_flyer,
            public.flyer_norm_text(s.name), public.flyer_norm_address(s.address_line1),
            public.flyer_norm_text(s.city), public.flyer_norm_text(s.state_region),
            coalesce(public.flyer_country_code(s.country), public.flyer_norm_text(s.country)),
            public.flyer_norm_host(s.website),
            public.flyer_norm_handle(s.instagram), s.source_flyer_url,
            coalesce(s.source_event_id = p_event_id, false)
              or coalesce(s.source_submission_id = p_submission_id, false)
              or exists (select 1 from public.event_schools es
                         where es.event_id = p_event_id and es.school_id = s.id)
          ) as strength
        from public.schools s
        where s.status <> 'archived'
      ) m
      where m.strength is not null
      order by (m.strength = 'strong') desc, m.name, m.id
      limit 8;
  else
    raise exception 'Unknown entity kind %', p_kind using errcode = '22023';
  end if;
end;
$$;

create or replace function public.flyer_match_json(p_kind text, p_candidate jsonb, p_strength text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'name', m.name, 'address', m.address, 'city', m.city,
    'state_region', m.state_region, 'website', m.website, 'instagram', m.instagram
  ) order by (m.strength = 'strong') desc, m.name, m.id), '[]'::jsonb)
  from public.flyer_entity_matches(p_kind, p_candidate) m
  where p_strength is null or m.strength = p_strength;
$$;

-- One EntityReviewItem for a candidate (no event context).
create or replace function public.flyer_review_item(p_kind text, p_candidate jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c jsonb := public.flyer_clean_candidate(p_candidate);
  v_matches jsonb;
  v_strong integer;
  v_strong_id uuid;
  v_conflict integer;
  v_total integer;
  v_state text;
  v_decision text := 'pending';
  v_selected uuid;
begin
  if c is null or c ->> 'name' is null then return null; end if;

  if length(btrim(c ->> 'name')) < 2 then
    return jsonb_build_object('candidate', c, 'state', 'NEEDS REVIEW', 'matches', '[]'::jsonb,
                              'decision', 'pending', 'selected_id', null);
  end if;

  v_matches := public.flyer_match_json(p_kind, c);
  select count(*) filter (where m.strength = 'strong'),
         (array_agg(m.id) filter (where m.strength = 'strong'))[1],
         count(*) filter (where m.strength = 'conflict'),
         count(*)
    into v_strong, v_strong_id, v_conflict, v_total
    from public.flyer_entity_matches(p_kind, c) m;

  if v_strong = 1 then
    v_state := 'MATCHED'; v_decision := 'existing'; v_selected := v_strong_id;
  elsif v_strong >= 2 or v_conflict > 0 then
    v_state := 'NEEDS REVIEW';
  elsif v_total > 0 then
    v_state := 'POSSIBLE MATCH';
  else
    v_state := 'NEW';
  end if;

  return jsonb_build_object('candidate', c, 'state', v_state, 'matches', v_matches,
                            'decision', v_decision, 'selected_id', v_selected);
end;
$$;

create or replace function public.reconcile_flyer_entities(p_candidates jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_instructors jsonb := '[]'::jsonb;
  v_item jsonb;
  v_seen text[] := '{}';
  v_key text;
  e jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_candidates is null or jsonb_typeof(p_candidates) <> 'object' then
    raise exception 'candidates must be a JSON object' using errcode = '22023';
  end if;
  if octet_length(p_candidates::text) > 65536 then
    raise exception 'candidates payload too large' using errcode = '22023';
  end if;
  if jsonb_exists(p_candidates, 'instructors') and jsonb_typeof(p_candidates -> 'instructors') = 'array'
     and jsonb_array_length(p_candidates -> 'instructors') > 12 then
    raise exception 'at most 12 instructors per flyer' using errcode = '22023';
  end if;

  if jsonb_typeof(p_candidates -> 'instructors') = 'array' then
    for e in select x from jsonb_array_elements(p_candidates -> 'instructors') x loop
      v_item := public.flyer_review_item('instructor', e);
      if v_item is null then continue; end if;
      -- Same identity context as the client's instructorCandidateKey: only
      -- identical candidates collapse, never distinct same-name people.
      v_key := jsonb_build_array(
        public.flyer_norm_text(v_item -> 'candidate' ->> 'name'),
        coalesce(public.flyer_norm_handle(v_item -> 'candidate' ->> 'instagram'), ''),
        public.flyer_norm_text(v_item -> 'candidate' ->> 'organization'),
        coalesce(lower(public.flyer_clean_website(v_item -> 'candidate' ->> 'website')), ''),
        lower(coalesce(v_item -> 'candidate' ->> 'email', '')),
        regexp_replace(coalesce(v_item -> 'candidate' ->> 'phone', ''), '\D', '', 'g'),
        public.flyer_norm_text(v_item -> 'candidate' ->> 'city'),
        public.flyer_norm_text(v_item -> 'candidate' ->> 'state_region'),
        coalesce(public.flyer_country_code(v_item -> 'candidate' ->> 'country'),
                 public.flyer_norm_text(v_item -> 'candidate' ->> 'country')),
        public.flyer_norm_address(v_item -> 'candidate' ->> 'address'))::text;
      if v_key = any(v_seen) then continue; end if;
      v_seen := v_seen || v_key;
      v_instructors := v_instructors || jsonb_build_array(v_item);
    end loop;
  end if;

  return jsonb_build_object(
    'venue', public.flyer_review_item('venue', p_candidates -> 'venue'),
    'organizer', public.flyer_review_item('organizer', p_candidates -> 'organizer'),
    'instructors', v_instructors,
    'school', public.flyer_review_item('school', p_candidates -> 'school')
  );
end;
$$;

create or replace function public.search_flyer_entities(p_kind text, p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := public.flyer_norm_text(left(coalesce(p_query, ''), 120));
  h text := public.flyer_norm_handle(left(coalesce(p_query, ''), 120));
  out jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_kind not in ('venue', 'organizer', 'instructor', 'school') then
    raise exception 'Unknown entity kind %', p_kind using errcode = '22023';
  end if;
  if length(q) < 2 then return '[]'::jsonb; end if;

  if p_kind = 'venue' then
    select coalesce(jsonb_agg(r.j order by r.rk, r.nm), '[]'::jsonb) into out from (
      select jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address_line1, 'city', v.city,
               'state_region', v.state_region, 'website', v.website, 'instagram', v.instagram) as j,
             case when public.flyer_norm_text(v.name) = q then 0
                  when public.flyer_norm_text(v.name) like q || '%' then 1 else 2 end as rk,
             v.name as nm
        from public.venues v
       where v.status <> 'archived'
         and (public.flyer_norm_text(v.name) like '%' || q || '%'
              or (h is not null and public.flyer_norm_handle(v.instagram) = h))
       order by 2, 3 limit 10) r;
  elsif p_kind = 'organizer' then
    select coalesce(jsonb_agg(r.j order by r.rk, r.nm), '[]'::jsonb) into out from (
      select jsonb_build_object('id', o.id, 'name', o.name, 'address', null, 'city', o.primary_city,
               'state_region', o.state_region, 'website', o.website, 'instagram', o.instagram) as j,
             case when public.flyer_norm_text(o.name) = q then 0
                  when public.flyer_norm_text(o.name) like q || '%' then 1 else 2 end as rk,
             o.name as nm
        from public.organizers o
       where o.status = 'active'
         and (public.flyer_norm_text(o.name) like '%' || q || '%'
              or (h is not null and public.flyer_norm_handle(o.instagram) = h))
       order by 2, 3 limit 10) r;
  elsif p_kind = 'instructor' then
    select coalesce(jsonb_agg(r.j order by r.rk, r.nm), '[]'::jsonb) into out from (
      select jsonb_build_object('id', i.id, 'name', i.name, 'address', null, 'city', i.city,
               'state_region', i.state_region, 'website', i.website, 'instagram', i.instagram) as j,
             case when public.flyer_norm_text(i.name) = q then 0
                  when public.flyer_norm_text(i.name) like q || '%' then 1 else 2 end as rk,
             i.name as nm
        from public.instructors i
       where i.status <> 'archived'
         and (public.flyer_norm_text(i.name) like '%' || q || '%'
              or (h is not null and public.flyer_norm_handle(i.instagram) = h))
       order by 2, 3 limit 10) r;
  else
    select coalesce(jsonb_agg(r.j order by r.rk, r.nm), '[]'::jsonb) into out from (
      select jsonb_build_object('id', s.id, 'name', s.name, 'address', s.address_line1, 'city', s.city,
               'state_region', s.state_region, 'website', s.website, 'instagram', s.instagram) as j,
             case when public.flyer_norm_text(s.name) = q then 0
                  when public.flyer_norm_text(s.name) like q || '%' then 1 else 2 end as rk,
             s.name as nm
        from public.schools s
       where s.status <> 'archived'
         and (public.flyer_norm_text(s.name) like '%' || q || '%'
              or (h is not null and public.flyer_norm_handle(s.instagram) = h))
       order by 2, 3 limit 10) r;
  end if;
  return out;
end;
$$;

-- ============================================================
-- 4. Canonical creation (internal; never granted to API roles)
-- ============================================================

create or replace function public.flyer_slug_taken(p_kind text, p_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_kind = 'venue' then
    return exists (select 1 from public.venues where slug = p_slug);
  elsif p_kind = 'organizer' then
    return exists (select 1 from public.organizers where slug = p_slug);
  elsif p_kind = 'instructor' then
    return exists (select 1 from public.instructors where slug = p_slug);
  elsif p_kind = 'school' then
    return exists (select 1 from public.schools where slug = p_slug);
  end if;
  raise exception 'Unknown entity kind %', p_kind using errcode = '22023';
end;
$$;

-- name, then name-city, then name-city-state, then numeric suffix.
create or replace function public.flyer_unique_slug(p_kind text, p_name text, p_city text, p_state text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text := public.flyer_slugify(p_name);
  v_city text := case when nullif(btrim(coalesce(p_city, '')), '') is null then null else public.flyer_slugify(p_city) end;
  v_state text := case when nullif(btrim(coalesce(p_state, '')), '') is null then null else public.flyer_slugify(p_state) end;
  v_candidate text;
  v_most text;
  v_n integer := 1;
begin
  perform pg_advisory_xact_lock(hashtextextended('flyer_slug:' || p_kind || ':' || v_base, 0));

  if not public.flyer_slug_taken(p_kind, v_base) then return v_base; end if;
  if v_city is not null then
    v_candidate := left(v_base || '-' || v_city, 120);
    if not public.flyer_slug_taken(p_kind, v_candidate) then return v_candidate; end if;
    if v_state is not null then
      v_candidate := left(v_base || '-' || v_city || '-' || v_state, 140);
      if not public.flyer_slug_taken(p_kind, v_candidate) then return v_candidate; end if;
    end if;
  end if;
  v_most := coalesce(v_candidate, v_base);
  loop
    v_n := v_n + 1;
    v_candidate := v_most || '-' || v_n::text;
    exit when not public.flyer_slug_taken(p_kind, v_candidate);
  end loop;
  return v_candidate;
end;
$$;

create or replace function public.flyer_entity_create(p_kind text, p_candidate jsonb, p_ctx jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb := public.flyer_clean_candidate(p_candidate);
  v_name text;
  v_slug text;
  v_id uuid;
  v_source text := coalesce(nullif(p_ctx ->> 'source_type', ''), 'admin');
  v_event uuid := public.flyer_uuid_or_null(p_ctx ->> 'event_id');
  v_submission uuid := public.flyer_uuid_or_null(p_ctx ->> 'submission_id');
  v_flyer text := nullif(btrim(coalesce(p_ctx ->> 'flyer_url', '')), '');
  v_city text;
  v_state text;
  v_country text;
  v_website text;
  v_ig text;
  v_addr text;
  v_line1 text;
  v_postal text;
begin
  if c is null or c ->> 'name' is null or length(btrim(c ->> 'name')) < 2 then
    raise exception 'A % needs a name of at least 2 characters to be created', p_kind using errcode = '22023';
  end if;
  v_name := c ->> 'name';
  v_city := c ->> 'city';
  v_state := c ->> 'state_region';
  v_country := public.flyer_country_code(c ->> 'country');
  v_website := public.flyer_clean_website(c ->> 'website');
  v_ig := nullif(public.flyer_norm_handle(c ->> 'instagram'), '');
  v_addr := c ->> 'address';
  -- Street line only when the address carries more than the street (city or
  -- state known); otherwise keep the whole string so nothing is lost.
  v_line1 := case
    when v_addr is null then null
    when v_city is not null or v_state is not null then nullif(btrim(split_part(v_addr, ',', 1)), '')
    else v_addr
  end;
  v_postal := substring(coalesce(v_addr, '') from '\m(\d{5}(?:-\d{4})?)\s*$');
  v_slug := public.flyer_unique_slug(p_kind, v_name, v_city, v_state);

  if p_kind = 'venue' then
    insert into public.venues (
      name, slug, address_line1, postal_code, city, state_region, country, website, instagram, phone,
      status, normalized_name, normalized_address,
      source_type, source_event_id, source_submission_id, source_flyer_url)
    values (
      v_name, v_slug, v_line1, v_postal, v_city, v_state, coalesce(v_country, 'US'), v_website, v_ig, c ->> 'phone',
      'active',
      lower(btrim(regexp_replace(v_name, '\s+', ' ', 'g'))),
      lower(btrim(regexp_replace(concat_ws(' ', v_line1, null, v_city, v_state, v_postal), '\s+', ' ', 'g'))),
      v_source, v_event, v_submission, v_flyer)
    returning id into v_id;
  elsif p_kind = 'organizer' then
    insert into public.organizers (
      name, slug, website, instagram, primary_city, state_region, country, status,
      source_type, source_event_id, source_submission_id, source_flyer_url)
    values (
      v_name, v_slug, v_website, v_ig, v_city, v_state, v_country, 'active',
      v_source, v_event, v_submission, v_flyer)
    returning id into v_id;
  elsif p_kind = 'instructor' then
    insert into public.instructors (
      name, slug, organization, city, state_region, country, website, instagram, status,
      source_type, source_event_id, source_submission_id, source_flyer_url)
    values (
      v_name, v_slug, c ->> 'organization', v_city, v_state, v_country, v_website, v_ig, 'active',
      v_source, v_event, v_submission, v_flyer)
    returning id into v_id;
  elsif p_kind = 'school' then
    insert into public.schools (
      name, slug, address_line1, postal_code, city, state_region, country, website, instagram, phone, status,
      source_type, source_event_id, source_submission_id, source_flyer_url)
    values (
      v_name, v_slug, v_line1, v_postal, v_city, v_state, v_country, v_website, v_ig, c ->> 'phone', 'active',
      v_source, v_event, v_submission, v_flyer)
    returning id into v_id;
  else
    raise exception 'Unknown entity kind %', p_kind using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'entity.created', 'event', v_event,
          jsonb_build_object('kind', p_kind, 'entity_id', v_id, 'name', v_name, 'slug', v_slug,
                             'source_type', v_source, 'submission_id', v_submission));
  return v_id;
end;
$$;

-- ============================================================
-- 5. Review resolution (internal)
-- ============================================================

create or replace function public.flyer_clean_matches(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', public.flyer_uuid_or_null(m ->> 'id'),
    'name', public.flyer_json_text(m, 'name', 200),
    'address', public.flyer_json_text(m, 'address', 300),
    'city', public.flyer_json_text(m, 'city', 120),
    'state_region', public.flyer_json_text(m, 'state_region', 120),
    'website', public.flyer_json_text(m, 'website', 300),
    'instagram', public.flyer_json_text(m, 'instagram', 120)
  )), '[]'::jsonb)
  from (
    select x as m from jsonb_array_elements(
      case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) x limit 8
  ) s
  where jsonb_typeof(m) = 'object' and public.flyer_uuid_or_null(m ->> 'id') is not null;
$$;

-- Resolve one review item to a canonical id, creating when explicitly asked.
-- Returns {action, id, item}; action in
-- absent|skipped|linked|created|reused|removed.
create or replace function public.flyer_resolve_item(p_kind text, p_item jsonb, p_ctx jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision text;
  v_cand jsonb;
  v_seen uuid[];
  v_strong uuid[];
  v_unseen uuid[];
  v_id uuid;
  v_action text;
  v_state text;
  v_stored_cand jsonb;
begin
  if p_item is null or jsonb_typeof(p_item) = 'null' then
    return jsonb_build_object('action', 'absent', 'id', null, 'item', null);
  end if;
  if jsonb_typeof(p_item) <> 'object' then
    raise exception '% review item must be an object', p_kind using errcode = '22023';
  end if;

  v_decision := coalesce(p_item ->> 'decision', 'pending');
  if v_decision not in ('pending', 'existing', 'new', 'removed') then
    raise exception 'Invalid % decision "%"', p_kind, v_decision using errcode = '22023';
  end if;

  v_cand := public.flyer_clean_candidate(p_item -> 'candidate');
  v_stored_cand := case when v_cand is null then null else v_cand - 'email' - 'phone' end;
  v_seen := array(
    select public.flyer_uuid_or_null(mm ->> 'id')
      from jsonb_array_elements(case when jsonb_typeof(p_item -> 'matches') = 'array'
                                     then p_item -> 'matches' else '[]'::jsonb end) mm
     where jsonb_typeof(mm) = 'object' and public.flyer_uuid_or_null(mm ->> 'id') is not null);

  if v_decision = 'existing' then
    v_id := public.flyer_uuid_or_null(p_item ->> 'selected_id');
    if v_id is null or not public.flyer_entity_exists(p_kind, v_id) then
      raise exception 'Selected % is not available', p_kind using errcode = '22023';
    end if;
    v_action := 'linked';

  elsif v_decision = 'new' then
    if v_cand is null or v_cand ->> 'name' is null or length(btrim(v_cand ->> 'name')) < 2 then
      raise exception 'A new % needs a name of at least 2 characters', p_kind using errcode = '22023';
    end if;
    if not public.flyer_candidate_has_signal(p_kind, v_cand) then
      raise exception 'new_entity_needs_signal: a new % needs %; add it or choose an existing one',
        p_kind, case when p_kind in ('venue', 'school') then 'an address, website or Instagram'
                     else 'a website or Instagram' end using errcode = '22023';
    end if;
    -- Re-query INSIDE the caller's advisory locks.
    v_strong := array(
      select m.id from public.flyer_entity_matches(
        p_kind, v_cand,
        public.flyer_uuid_or_null(p_ctx ->> 'event_id'),
        public.flyer_uuid_or_null(p_ctx ->> 'submission_id'),
        p_ctx ->> 'flyer_url') m
       where m.strength = 'strong');
    v_unseen := array(select u from unnest(v_strong) u where not (u = any(v_seen)));
    if cardinality(v_strong) = 1 and cardinality(v_unseen) = 1 then
      v_id := v_unseen[1];
      v_action := 'reused';
    elsif cardinality(v_strong) >= 2 and cardinality(v_unseen) >= 1 then
      raise exception 'entity_review_stale: % "%" now has multiple strong matches; re-run review',
        p_kind, v_cand ->> 'name' using errcode = '40001';
    else
      v_id := public.flyer_entity_create(p_kind, v_cand, p_ctx);
      v_action := 'created';
    end if;

  elsif v_decision = 'removed' then
    return jsonb_build_object('action', 'removed', 'id', null, 'item', jsonb_build_object(
      'candidate', v_stored_cand,
      'state', coalesce(nullif(p_item ->> 'state', ''), 'NEEDS REVIEW'),
      'matches', public.flyer_clean_matches(p_item -> 'matches'),
      'decision', 'removed',
      'selected_id', public.flyer_uuid_or_null(p_item ->> 'selected_id')));
  else
    return jsonb_build_object('action', 'skipped', 'id', null, 'item', jsonb_build_object(
      'candidate', v_stored_cand,
      'state', coalesce(nullif(p_item ->> 'state', ''), 'NEEDS REVIEW'),
      'matches', public.flyer_clean_matches(p_item -> 'matches'),
      'decision', 'pending',
      'selected_id', public.flyer_uuid_or_null(p_item ->> 'selected_id')));
  end if;

  v_state := 'MATCHED';
  return jsonb_build_object('action', v_action, 'id', v_id, 'item', jsonb_build_object(
    'candidate', v_stored_cand,
    'state', v_state,
    'matches', public.flyer_clean_matches(p_item -> 'matches'),
    'decision', 'existing',
    'selected_id', v_id));
end;
$$;

-- Does this item override a manual (direct) id? Humans-chosen items do:
-- 'new', anything not auto-MATCHED, or an explicit "explicit": true.
create or replace function public.flyer_item_overrides_direct(p_item jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_item ->> 'decision' = 'new'
      or p_item ->> 'explicit' = 'true'
      or coalesce(p_item ->> 'state', '') <> 'MATCHED';
$$;

-- Resolve a whole review. p_direct_* are the manual ids that win unless the
-- review item was a deliberate human choice. Returns
-- {venue_id, organizer_id, school_id, school_managed, instructor_ids,
--  instructors_managed, review, created:[{kind,id}]}.
create or replace function public.flyer_apply_entity_review(
  p_review jsonb, p_ctx jsonb, p_direct_venue uuid, p_direct_organizer uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[];
  k text;
  r jsonb;
  v_item jsonb;
  v_venue uuid := p_direct_venue;
  v_org uuid := p_direct_organizer;
  v_school uuid;
  v_school_managed boolean := false;
  v_instr uuid[] := '{}';
  v_instr_managed boolean := false;
  v_instr_items jsonb := '[]'::jsonb;
  v_event uuid := public.flyer_uuid_or_null(p_ctx ->> 'event_id');
  v_sel uuid;
  v_created jsonb := '[]'::jsonb;
  e jsonb;
  v_new_school_item jsonb;
begin
  if p_review is null or jsonb_typeof(p_review) <> 'object' then
    raise exception 'entity_review must be an object' using errcode = '22023';
  end if;
  if octet_length(p_review::text) > 131072 then
    raise exception 'entity_review too large' using errcode = '22023';
  end if;
  if jsonb_exists(p_review, 'instructors') and jsonb_typeof(p_review -> 'instructors') not in ('array', 'null') then
    raise exception 'entity_review.instructors must be an array' using errcode = '22023';
  end if;
  if jsonb_typeof(p_review -> 'instructors') = 'array' and jsonb_array_length(p_review -> 'instructors') > 12 then
    raise exception 'at most 12 instructors per flyer' using errcode = '22023';
  end if;

  -- Lock prelude: every creation key, sorted, before any write.
  select coalesce(array_agg(distinct lk order by lk), '{}') into v_keys from (
    select 'flyer_entity:' || kind || ':' || public.flyer_norm_text(item -> 'candidate' ->> 'name') as lk
      from (
        select 'venue' as kind, p_review -> 'venue' as item
        union all select 'organizer', p_review -> 'organizer'
        union all select 'school', p_review -> 'school'
        union all select 'instructor', x from jsonb_array_elements(
          case when jsonb_typeof(p_review -> 'instructors') = 'array'
               then p_review -> 'instructors' else '[]'::jsonb end) x
      ) i
     where jsonb_typeof(item) = 'object' and item ->> 'decision' = 'new'
       and public.flyer_norm_text(item -> 'candidate' ->> 'name') <> ''
    union all
    select 'flyer_slug:' || kind || ':' || public.flyer_slugify(item -> 'candidate' ->> 'name')
      from (
        select 'venue' as kind, p_review -> 'venue' as item
        union all select 'organizer', p_review -> 'organizer'
        union all select 'school', p_review -> 'school'
        union all select 'instructor', x from jsonb_array_elements(
          case when jsonb_typeof(p_review -> 'instructors') = 'array'
               then p_review -> 'instructors' else '[]'::jsonb end) x
      ) i
     where jsonb_typeof(item) = 'object' and item ->> 'decision' = 'new'
       and public.flyer_norm_text(item -> 'candidate' ->> 'name') <> ''
  ) q;
  foreach k in array v_keys loop
    perform pg_advisory_xact_lock(hashtextextended(k, 0));
  end loop;

  -- venue
  r := public.flyer_resolve_item('venue', p_review -> 'venue', p_ctx);
  v_item := r -> 'item';
  if r ->> 'action' in ('linked', 'created', 'reused') then
    if r ->> 'action' = 'created' then
      v_created := v_created || jsonb_build_array(jsonb_build_object('kind', 'venue', 'id', r -> 'id'));
    end if;
    if p_direct_venue is null or public.flyer_item_overrides_direct(p_review -> 'venue') then
      v_venue := (r ->> 'id')::uuid;
    end if;
  elsif r ->> 'action' = 'removed' then
    v_sel := public.flyer_uuid_or_null(v_item ->> 'selected_id');
    if p_direct_venue is null or p_direct_venue = v_sel then v_venue := null; end if;
  end if;
  r := jsonb_build_object('venue', v_item);

  -- organizer
  declare
    ro jsonb := public.flyer_resolve_item('organizer', p_review -> 'organizer', p_ctx);
  begin
    v_item := ro -> 'item';
    if ro ->> 'action' in ('linked', 'created', 'reused') then
      if ro ->> 'action' = 'created' then
        v_created := v_created || jsonb_build_array(jsonb_build_object('kind', 'organizer', 'id', ro -> 'id'));
      end if;
      if p_direct_organizer is null or public.flyer_item_overrides_direct(p_review -> 'organizer') then
        v_org := (ro ->> 'id')::uuid;
      end if;
    elsif ro ->> 'action' = 'removed' then
      v_sel := public.flyer_uuid_or_null(v_item ->> 'selected_id');
      if p_direct_organizer is null or p_direct_organizer = v_sel then v_org := null; end if;
    end if;
    r := r || jsonb_build_object('organizer', v_item);
  end;

  -- instructors (replace set when a non-empty array is supplied)
  if jsonb_typeof(p_review -> 'instructors') = 'array' and jsonb_array_length(p_review -> 'instructors') > 0 then
    v_instr_managed := true;
    for e in select x from jsonb_array_elements(p_review -> 'instructors') x loop
      declare
        ri jsonb := public.flyer_resolve_item('instructor', e, p_ctx);
        v_id uuid;
      begin
        if ri ->> 'action' = 'absent' then continue; end if;
        v_instr_items := v_instr_items || jsonb_build_array(ri -> 'item');
        v_id := public.flyer_uuid_or_null(ri ->> 'id');
        if ri ->> 'action' in ('linked', 'created', 'reused') then
          if ri ->> 'action' = 'created' then
            v_created := v_created || jsonb_build_array(jsonb_build_object('kind', 'instructor', 'id', v_id));
          end if;
          if not (v_id = any(v_instr)) then v_instr := v_instr || v_id; end if;
        elsif ri ->> 'action' = 'skipped' then
          -- Undecided never unlinks an instructor already on the event.
          v_sel := public.flyer_uuid_or_null(ri -> 'item' ->> 'selected_id');
          if v_sel is not null and v_event is not null
             and exists (select 1 from public.event_instructors ei
                          where ei.event_id = v_event and ei.instructor_id = v_sel)
             and not (v_sel = any(v_instr)) then
            v_instr := v_instr || v_sel;
          end if;
        end if;
      end;
    end loop;
  end if;
  r := r || jsonb_build_object('instructors', v_instr_items);

  -- school
  declare
    rs jsonb := public.flyer_resolve_item('school', p_review -> 'school', p_ctx);
  begin
    v_new_school_item := rs -> 'item';
    if rs ->> 'action' in ('linked', 'created', 'reused') then
      v_school_managed := true;
      v_school := (rs ->> 'id')::uuid;
      if rs ->> 'action' = 'created' then
        v_created := v_created || jsonb_build_array(jsonb_build_object('kind', 'school', 'id', v_school));
      end if;
    elsif rs ->> 'action' = 'removed' then
      v_school_managed := true;
      v_school := null;
    end if;
    r := r || jsonb_build_object('school', v_new_school_item);
  end;

  return jsonb_build_object(
    'venue_id', v_venue,
    'organizer_id', v_org,
    'school_id', v_school,
    'school_managed', v_school_managed,
    'instructor_ids', to_jsonb(v_instr),
    'instructors_managed', v_instr_managed,
    'review', r,
    'created', v_created
  );
end;
$$;

create or replace function public.flyer_sync_event_links(p_event_id uuid, p_result jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if (p_result ->> 'instructors_managed')::boolean then
    v_ids := array(select (x)::uuid from jsonb_array_elements_text(p_result -> 'instructor_ids') x);
    delete from public.event_instructors
     where event_id = p_event_id and not (instructor_id = any(v_ids));
    insert into public.event_instructors (event_id, instructor_id, position)
    select p_event_id, ids.id, ids.ord - 1
      from unnest(v_ids) with ordinality as ids(id, ord)
    on conflict (event_id, instructor_id) do update set position = excluded.position;
  end if;

  if (p_result ->> 'school_managed')::boolean then
    delete from public.event_schools
     where event_id = p_event_id
       and school_id is distinct from public.flyer_uuid_or_null(p_result ->> 'school_id');
    if p_result ->> 'school_id' is not null then
      insert into public.event_schools (event_id, school_id)
      values (p_event_id, (p_result ->> 'school_id')::uuid)
      on conflict do nothing;
    end if;
  end if;
end;
$$;

-- ============================================================
-- 6. Authorized, atomic event save
-- ============================================================

create or replace function public.save_event_with_entities(
  p_event_id uuid,
  p_payload jsonb,
  p_publish boolean default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  e public.events%rowtype;
  v_id uuid;
  v_is_update boolean := p_event_id is not null;
  v_review jsonb;
  v_has_review boolean;
  v_title text;
  v_description text;
  v_event_type text;
  v_city text;
  v_event_date timestamptz;
  v_event_time text;
  v_location text;
  v_address text;
  v_price_type text;
  v_price_amount numeric;
  v_rsvp text;
  v_host text;
  v_image text;
  v_recurrence text;
  v_c_email text;
  v_c_ig text;
  v_c_web text;
  v_gallery text[];
  v_direct_venue uuid;
  v_direct_org uuid;
  v_result jsonb;
  v_ctx jsonb;
  v_term_ids uuid[];
  v_status text;
begin
  if v_uid is null or not public.is_moderator() or not public.account_is_active(v_uid) then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = '22023';
  end if;

  if v_is_update then
    select * into e from public.events where id = p_event_id for update;
    if not found then
      raise exception 'Event not found' using errcode = 'P0002';
    end if;
  end if;

  v_title := nullif(btrim(p_payload ->> 'title'), '');
  v_description := nullif(btrim(p_payload ->> 'description'), '');
  v_event_type := nullif(btrim(p_payload ->> 'event_type'), '');
  v_city := nullif(btrim(p_payload ->> 'city'), '');
  v_event_date := nullif(btrim(p_payload ->> 'event_date'), '')::timestamptz;
  v_event_time := nullif(btrim(p_payload ->> 'event_time'), '');
  v_location := nullif(btrim(p_payload ->> 'location'), '');
  v_address := nullif(btrim(p_payload ->> 'address'), '');
  v_price_type := nullif(btrim(p_payload ->> 'price_type'), '');
  v_price_amount := nullif(btrim(p_payload ->> 'price_amount'), '')::numeric;
  v_rsvp := nullif(btrim(p_payload ->> 'rsvp_link'), '');
  v_host := nullif(btrim(p_payload ->> 'host'), '');
  v_image := nullif(btrim(p_payload ->> 'image_url'), '');
  v_recurrence := nullif(btrim(p_payload ->> 'recurrence'), '');
  v_c_email := nullif(btrim(p_payload ->> 'contact_email'), '');
  v_c_ig := nullif(btrim(p_payload ->> 'contact_instagram'), '');
  v_c_web := nullif(btrim(p_payload ->> 'contact_website'), '');
  v_gallery := case when jsonb_typeof(p_payload -> 'gallery') = 'array'
                    then array(select jsonb_array_elements_text(p_payload -> 'gallery')) else null end;

  if jsonb_exists(p_payload, 'taxonomy_term_ids') and jsonb_typeof(p_payload -> 'taxonomy_term_ids') <> 'null' then
    if jsonb_typeof(p_payload -> 'taxonomy_term_ids') <> 'array' then
      raise exception 'taxonomy_term_ids must be an array' using errcode = '22023';
    end if;
    v_term_ids := array(select distinct (x)::uuid from jsonb_array_elements_text(p_payload -> 'taxonomy_term_ids') x);
    if (select count(*) from public.taxonomy_terms t where t.id = any(v_term_ids)) <> cardinality(v_term_ids) then
      raise exception 'Unknown taxonomy term' using errcode = '22023';
    end if;
  elsif jsonb_exists(p_payload, 'taxonomy_term_ids') then
    v_term_ids := '{}';
  end if;

  if not v_is_update then
    if v_title is null or v_event_type is null or v_city is null or v_event_date is null then
      raise exception 'title, event_type, city and event_date are required' using errcode = '22023';
    end if;
  else
    if (jsonb_exists(p_payload, 'title') and v_title is null)
       or (jsonb_exists(p_payload, 'event_type') and v_event_type is null)
       or (jsonb_exists(p_payload, 'city') and v_city is null)
       or (jsonb_exists(p_payload, 'event_date') and v_event_date is null) then
      raise exception 'title, event_type, city and event_date cannot be blank' using errcode = '22023';
    end if;
  end if;

  -- Manual ids: an explicit key (even null) is the manual value; otherwise the
  -- event's current value.
  v_direct_venue := case
    when jsonb_exists(p_payload, 'venue_id') then public.flyer_uuid_or_null(p_payload ->> 'venue_id')
    when v_is_update then e.venue_id else null end;
  v_direct_org := case
    when jsonb_exists(p_payload, 'organizer_id') then public.flyer_uuid_or_null(p_payload ->> 'organizer_id')
    when v_is_update then e.organizer_id else null end;
  if jsonb_exists(p_payload, 'venue_id') and nullif(p_payload ->> 'venue_id', '') is not null
     and v_direct_venue is null then
    raise exception 'venue_id is not a valid id' using errcode = '22023';
  end if;
  if jsonb_exists(p_payload, 'organizer_id') and nullif(p_payload ->> 'organizer_id', '') is not null
     and v_direct_org is null then
    raise exception 'organizer_id is not a valid id' using errcode = '22023';
  end if;
  if v_direct_venue is not null and not exists (select 1 from public.venues where id = v_direct_venue) then
    raise exception 'Venue not found' using errcode = '22023';
  end if;
  if v_direct_org is not null and not exists (select 1 from public.organizers where id = v_direct_org) then
    raise exception 'Organizer not found' using errcode = '22023';
  end if;

  v_has_review := jsonb_exists(p_payload, 'entity_review');
  v_review := case when v_has_review and jsonb_typeof(p_payload -> 'entity_review') = 'object'
                   then p_payload -> 'entity_review' else null end;
  if v_has_review and jsonb_typeof(p_payload -> 'entity_review') not in ('object', 'null') then
    raise exception 'entity_review must be an object' using errcode = '22023';
  end if;

  if not v_is_update then
    -- Provenance is derived from the caller, never from the payload.
    insert into public.events (
      title, description, event_type, event_date, event_time, location, address, price_type, price_amount,
      rsvp_link, host, image_url, recurrence, contact_email, contact_instagram, contact_website, gallery,
      city, status, source_type, submitter_id, submitter_email, submitter_name, venue_id, organizer_id)
    values (
      v_title, v_description, v_event_type, v_event_date, v_event_time, v_location, v_address, v_price_type,
      v_price_amount, v_rsvp, v_host, v_image, v_recurrence, v_c_email, v_c_ig, v_c_web, v_gallery,
      v_city, case when coalesce(p_publish, false) then 'approved' else 'draft' end,
      case when public.is_admin() then 'admin' else 'moderator' end,
      v_uid, auth.jwt() ->> 'email', 'Salsa Segura', v_direct_venue, v_direct_org)
    returning id into v_id;
  else
    v_id := p_event_id;
    update public.events ev set
      title = case when jsonb_exists(p_payload, 'title') then v_title else ev.title end,
      description = case when jsonb_exists(p_payload, 'description') then v_description else ev.description end,
      event_type = case when jsonb_exists(p_payload, 'event_type') then v_event_type else ev.event_type end,
      city = case when jsonb_exists(p_payload, 'city') then v_city else ev.city end,
      event_date = case when jsonb_exists(p_payload, 'event_date') then v_event_date else ev.event_date end,
      event_time = case when jsonb_exists(p_payload, 'event_time') then v_event_time else ev.event_time end,
      location = case when jsonb_exists(p_payload, 'location') then v_location else ev.location end,
      address = case when jsonb_exists(p_payload, 'address') then v_address else ev.address end,
      price_type = case when jsonb_exists(p_payload, 'price_type') then v_price_type else ev.price_type end,
      price_amount = case when jsonb_exists(p_payload, 'price_amount') then v_price_amount else ev.price_amount end,
      rsvp_link = case when jsonb_exists(p_payload, 'rsvp_link') then v_rsvp else ev.rsvp_link end,
      host = case when jsonb_exists(p_payload, 'host') then v_host else ev.host end,
      image_url = case when jsonb_exists(p_payload, 'image_url') then v_image else ev.image_url end,
      recurrence = case when jsonb_exists(p_payload, 'recurrence') then v_recurrence else ev.recurrence end,
      contact_email = case when jsonb_exists(p_payload, 'contact_email') then v_c_email else ev.contact_email end,
      contact_instagram = case when jsonb_exists(p_payload, 'contact_instagram') then v_c_ig else ev.contact_instagram end,
      contact_website = case when jsonb_exists(p_payload, 'contact_website') then v_c_web else ev.contact_website end,
      gallery = case when jsonb_exists(p_payload, 'gallery') then v_gallery else ev.gallery end,
      venue_id = v_direct_venue,
      organizer_id = v_direct_org,
      status = case when p_publish is null then ev.status when p_publish then 'approved' else 'draft' end
    where ev.id = v_id;
  end if;

  if v_review is not null then
    select ev.image_url into v_image from public.events ev where ev.id = v_id;
    v_ctx := jsonb_build_object('source_type', 'flyer_extraction', 'event_id', v_id, 'flyer_url', v_image);
    v_result := public.flyer_apply_entity_review(v_review, v_ctx, v_direct_venue, v_direct_org);
    update public.events ev set
      venue_id = (v_result ->> 'venue_id')::uuid,
      organizer_id = (v_result ->> 'organizer_id')::uuid,
      entity_review = v_result -> 'review'
    where ev.id = v_id;
    perform public.flyer_sync_event_links(v_id, v_result);
  elsif v_has_review then
    update public.events ev set entity_review = null where ev.id = v_id;
  end if;

  if v_term_ids is not null then
    delete from public.event_taxonomy_terms where event_id = v_id;
    insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
    select v_id, t from unnest(v_term_ids) t
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

-- ============================================================
-- 7. Submission approval
-- ============================================================

-- Who is writing? auth.uid() for a signed-in user; the nil UUID for a trusted
-- server-side writer (no JWT at all, or the service role); NULL for anon /
-- anything else (never trusted).
create or replace function public.flyer_write_actor()
returns uuid
language sql
stable
set search_path = public
as $$
  select case
    when auth.uid() is not null then auth.uid()
    when coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role' is null
      or coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role' = 'service_role'
      then '00000000-0000-0000-0000-000000000000'::uuid
    else null
  end;
$$;

-- Moderation provenance guard (BEFORE INSERT/UPDATE), recomputed on every
-- write so clients can never set these columns:
--   * INSERT by anyone who is not an active moderator/admin or a trusted
--     server writer: edited_data and every moderator-only column are cleared,
--     so a public submitter cannot pre-seed corrections or review decisions.
--   * edited_data_by records who last changed edited_data; approval overlays
--     edited_data only when that provenance exists.
--   * A non-privileged update can never write edited_data.entity_review.
--   * moderator_entity_review is promoted from edited_data.entity_review only
--     when an ACTIVE moderator/admin changed it; any other change clears it.
create or replace function public.event_submissions_track_entity_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.flyer_write_actor();
  v_mod boolean := auth.uid() is not null and public.is_moderator() and public.account_is_active(auth.uid());
  v_priv boolean;
begin
  v_priv := v_mod or coalesce(v_actor = '00000000-0000-0000-0000-000000000000'::uuid, false);

  if tg_op = 'INSERT' then
    if not v_priv then
      new.edited_data := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.rejection_reason := null;
      new.rejection_message := null;
      new.internal_note := null;
      new.duplicate_of_event_id := null;
      new.approved_event_id := null;
      new.dismissed_duplicate_ids := '{}';
    end if;
    new.edited_data_by := case when new.edited_data is null then null else v_actor end;
    new.moderator_entity_review := null;
    new.entity_review_confirmed_by := null;
    new.entity_review_confirmed_at := null;
    return new;
  end if;

  if new.edited_data is distinct from old.edited_data then
    if not v_priv and jsonb_typeof(new.edited_data) = 'object' then
      new.edited_data := new.edited_data - 'entity_review';
    end if;
  end if;
  if new.edited_data is distinct from old.edited_data then
    new.edited_data_by := v_actor;
  else
    new.edited_data_by := old.edited_data_by;
  end if;

  if (new.edited_data -> 'entity_review') is distinct from (old.edited_data -> 'entity_review') then
    if v_mod and jsonb_typeof(new.edited_data -> 'entity_review') = 'object' then
      new.moderator_entity_review := new.edited_data -> 'entity_review';
      new.entity_review_confirmed_by := auth.uid();
      new.entity_review_confirmed_at := now();
    else
      new.moderator_entity_review := null;
      new.entity_review_confirmed_by := null;
      new.entity_review_confirmed_at := null;
    end if;
  else
    new.moderator_entity_review := old.moderator_entity_review;
    new.entity_review_confirmed_by := old.entity_review_confirmed_by;
    new.entity_review_confirmed_at := old.entity_review_confirmed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists event_submissions_entity_review_guard on public.event_submissions;
create trigger event_submissions_entity_review_guard
  before insert or update on public.event_submissions
  for each row execute function public.event_submissions_track_entity_review();

-- Legacy hardening (idempotent; run once by this migration, safe to re-run).
-- Triggers are disabled so the cleanup cannot mint provenance or audit noise.
-- Only open submissions are touched.
--   1. Audited edits (submission.edited by a known actor) are the only
--      pre-existing evidence that edited_data came from an UPDATE rather than
--      a forged public INSERT: stamp edited_data_by from the latest one.
--   2. edited_data on an open submission that still has no provenance cannot
--      be trusted at all -> cleared ENTIRELY (title/date/etc. as well as any
--      entity_review), so a later moderator edit that merges edited_data back
--      in cannot launder forged values.
--   3. entity_review cannot predate this feature, so it is stripped from the
--      remaining (audited) edits unless a moderator snapshot exists.
create or replace function public.flyer_harden_legacy_submissions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit boolean := exists (select 1 from pg_trigger where tgrelid = 'public.event_submissions'::regclass
                              and tgname = 'event_submissions_audit_log');
  v_updated boolean := exists (select 1 from pg_trigger where tgrelid = 'public.event_submissions'::regclass
                                and tgname = 'event_submissions_set_updated_at');
begin
  alter table public.event_submissions disable trigger event_submissions_entity_review_guard;
  if v_audit then alter table public.event_submissions disable trigger event_submissions_audit_log; end if;
  if v_updated then alter table public.event_submissions disable trigger event_submissions_set_updated_at; end if;

  update public.event_submissions es
     set edited_data_by = a.actor_id
    from (select distinct on (entity_id) entity_id, actor_id
            from public.audit_logs
           where action = 'submission.edited' and entity_type = 'event_submission' and actor_id is not null
           order by entity_id, created_at desc) a
   where es.id = a.entity_id
     and es.edited_data is not null and es.edited_data_by is null
     and es.status in ('pending', 'in_review', 'needs_information');

  update public.event_submissions
     set edited_data = null
   where edited_data is not null and edited_data_by is null
     and status in ('pending', 'in_review', 'needs_information');

  update public.event_submissions
     set edited_data = edited_data - 'entity_review'
   where moderator_entity_review is null
     and jsonb_typeof(edited_data) = 'object' and jsonb_exists(edited_data, 'entity_review')
     and status in ('pending', 'in_review', 'needs_information');

  alter table public.event_submissions enable trigger event_submissions_entity_review_guard;
  if v_audit then alter table public.event_submissions enable trigger event_submissions_audit_log; end if;
  if v_updated then alter table public.event_submissions enable trigger event_submissions_set_updated_at; end if;
end;
$$;

select public.flyer_harden_legacy_submissions();

create or replace function public.flyer_item_core(p_item jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when p_item is null or jsonb_typeof(p_item) <> 'object' then null else jsonb_build_object(
    'c', public.flyer_clean_candidate(p_item -> 'candidate'),
    'd', p_item ->> 'decision',
    's', p_item ->> 'selected_id') end;
$$;

create or replace function public.flyer_downgrade_item(p_item jsonb, p_submitted jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when p_item is null or jsonb_typeof(p_item) <> 'object' then p_item
    when coalesce(p_item ->> 'decision', '') in ('existing', 'new')
         and p_item ->> 'moderator_confirmed' is distinct from 'true'
         and public.flyer_item_core(p_item) is not distinct from public.flyer_item_core(p_submitted)
      then p_item || jsonb_build_object('decision', 'pending', 'selected_id', null)
    else p_item
  end;
$$;

-- Items the moderator left byte-identical to the submitter's suggestion are not
-- decisions until marked "moderator_confirmed": true.
create or replace function public.flyer_moderated_review(p_moderated jsonb, p_submitted jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  out jsonb;
  v_sub jsonb := case when jsonb_typeof(p_submitted) = 'object' then p_submitted else '{}'::jsonb end;
  v_arr jsonb := '[]'::jsonb;
  v_i integer := 0;
  x jsonb;
begin
  if p_moderated is null or jsonb_typeof(p_moderated) <> 'object' then return null; end if;
  out := p_moderated;
  if jsonb_exists(out, 'venue') then
    out := jsonb_set(out, '{venue}', coalesce(public.flyer_downgrade_item(out -> 'venue', v_sub -> 'venue'), 'null'::jsonb));
  end if;
  if jsonb_exists(out, 'organizer') then
    out := jsonb_set(out, '{organizer}', coalesce(public.flyer_downgrade_item(out -> 'organizer', v_sub -> 'organizer'), 'null'::jsonb));
  end if;
  if jsonb_exists(out, 'school') then
    out := jsonb_set(out, '{school}', coalesce(public.flyer_downgrade_item(out -> 'school', v_sub -> 'school'), 'null'::jsonb));
  end if;
  if jsonb_typeof(out -> 'instructors') = 'array' then
    for x in select y from jsonb_array_elements(out -> 'instructors') y loop
      v_arr := v_arr || jsonb_build_array(coalesce(
        public.flyer_downgrade_item(x, case when jsonb_typeof(v_sub -> 'instructors') = 'array'
                                            then (v_sub -> 'instructors') -> v_i else null end), 'null'::jsonb));
      v_i := v_i + 1;
    end loop;
    out := jsonb_set(out, '{instructors}', v_arr);
  end if;
  return out;
end;
$$;

create or replace function public.approve_event_submission(p_submission_id uuid, p_taxonomy_term_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.event_submissions%rowtype;
  d jsonb;
  v_event_id uuid;
  ids uuid[] := coalesce(p_taxonomy_term_ids, '{}'::uuid[]);
  v_review jsonb;
  v_result jsonb;
  v_ctx jsonb;
begin
  if auth.uid() is null or not public.is_moderator() or not public.account_is_active(auth.uid()) then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;
  select * into s from public.event_submissions where id = p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  -- Replay (or a concurrent second approval that waited on the row lock).
  if s.status = 'approved' and s.approved_event_id is not null then
    return s.approved_event_id;
  end if;
  if s.status not in ('pending', 'in_review', 'needs_information') then
    raise exception 'Submission is not approvable';
  end if;
  -- edited_data is only an overlay when something with write provenance
  -- (a signed-in user's update or a trusted server writer) put it there; a
  -- value that arrived via a public INSERT, or predates provenance tracking
  -- without an audited edit, is ignored.
  d := s.submitted_data || case when s.edited_data_by is not null then coalesce(s.edited_data, '{}'::jsonb) else '{}'::jsonb end;
  if coalesce(btrim(d ->> 'title'), '') = '' or coalesce(d ->> 'event_type', '') = ''
     or coalesce(d ->> 'city', '') = '' or coalesce(d ->> 'event_date', '') = '' then
    raise exception 'Effective submission is missing title, event type, city, or event date';
  end if;
  if (select count(*) from public.taxonomy_terms where id = any(ids) and status = 'active') <> cardinality(ids) then
    raise exception 'Approval requires known active taxonomy terms';
  end if;

  insert into public.events (
    title, description, event_type, event_date, event_time, location, address, price_type, price_amount,
    rsvp_link, city, status, source_type, submitter_name, submitter_email, image_url)
  values (
    d ->> 'title', nullif(d ->> 'description', ''), d ->> 'event_type', (d ->> 'event_date')::timestamptz,
    nullif(d ->> 'event_time', ''), nullif(d ->> 'location', ''), nullif(d ->> 'address', ''),
    nullif(d ->> 'price_type', ''), nullif(d ->> 'price_amount', '')::numeric, nullif(d ->> 'rsvp_link', ''),
    d ->> 'city', 'approved', 'moderator', s.submitter_name, s.submitter_email, nullif(d ->> 'image_url', ''))
  returning id into v_event_id;

  insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
  select v_event_id, term_id from unnest(ids) as selected(term_id)
  on conflict do nothing;

  -- Only the moderator-confirmed snapshot is trusted; the submitter's own
  -- entity_review (submitted_data) never creates or links anything.
  v_review := public.flyer_moderated_review(s.moderator_entity_review, s.submitted_data -> 'entity_review');
  if v_review is not null then
    v_ctx := jsonb_build_object('source_type', 'submission_approval', 'event_id', v_event_id,
                                'submission_id', s.id, 'flyer_url', nullif(d ->> 'image_url', ''));
    v_result := public.flyer_apply_entity_review(v_review, v_ctx, null, null);
    update public.events ev set
      venue_id = (v_result ->> 'venue_id')::uuid,
      organizer_id = (v_result ->> 'organizer_id')::uuid,
      entity_review = v_result -> 'review'
    where ev.id = v_event_id;
    perform public.flyer_sync_event_links(v_event_id, v_result);
  end if;

  update public.event_submissions
     set status = 'approved', approved_event_id = v_event_id, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_submission_id;
  return v_event_id;
end;
$$;

-- ============================================================
-- 8. Public, read-only entity surface (safe fields only)
-- ============================================================

create or replace function public.flyer_origin(p_source_type text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_source_type in ('flyer_extraction', 'submission_approval') then 'flyer' else 'manual' end;
$$;

create or replace function public.flyer_public_entity_json(p_kind text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  if p_id is null then return null; end if;
  if p_kind = 'venue' then
    select jsonb_build_object('id', v.id, 'name', v.name, 'slug', v.slug, 'address', v.address_line1,
             'city', v.city, 'state_region', v.state_region, 'country', v.country,
             'website', case when v.website ~* '^https?://' then v.website end,
             'instagram', v.instagram, 'status', v.status, 'origin', public.flyer_origin(v.source_type))
      into r from public.venues v where v.id = p_id and v.status <> 'archived';
  elsif p_kind = 'organizer' then
    select jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'address', null,
             'city', o.primary_city, 'state_region', o.state_region, 'country', o.country,
             'website', case when o.website ~* '^https?://' then o.website end,
             'instagram', o.instagram, 'status', o.status, 'origin', public.flyer_origin(o.source_type))
      into r from public.organizers o where o.id = p_id and o.status = 'active';
  elsif p_kind = 'instructor' then
    select jsonb_build_object('id', i.id, 'name', i.name, 'slug', i.slug, 'address', null,
             'city', i.city, 'state_region', i.state_region, 'country', i.country,
             'website', case when i.website ~* '^https?://' then i.website end,
             'instagram', i.instagram, 'status', i.status, 'origin', public.flyer_origin(i.source_type))
      into r from public.instructors i where i.id = p_id and i.status <> 'archived';
  elsif p_kind = 'school' then
    select jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'address', s.address_line1,
             'city', s.city, 'state_region', s.state_region, 'country', s.country,
             'website', case when s.website ~* '^https?://' then s.website end,
             'instagram', s.instagram, 'status', s.status, 'origin', public.flyer_origin(s.source_type))
      into r from public.schools s where s.id = p_id and s.status <> 'archived';
  end if;
  return r;
end;
$$;

create or replace function public.public_flyer_entity(p_kind text, p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_id uuid;
begin
  if v_slug = '' or length(v_slug) > 160 then return null; end if;
  if p_kind = 'venue' then
    select v.id into v_id from public.venues v where v.slug = v_slug;
  elsif p_kind = 'organizer' then
    select o.id into v_id from public.organizers o where o.slug = v_slug;
  elsif p_kind = 'instructor' then
    select i.id into v_id from public.instructors i where i.slug = v_slug;
  elsif p_kind = 'school' then
    select s.id into v_id from public.schools s where s.slug = v_slug;
  else
    return null;
  end if;
  return public.flyer_public_entity_json(p_kind, v_id);
end;
$$;

-- Entities linked to one APPROVED event; null for any other event state.
create or replace function public.public_event_entities(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
begin
  select * into ev from public.events where id = p_event_id and status = 'approved';
  if not found then return null; end if;
  return jsonb_build_object(
    'venue', public.flyer_public_entity_json('venue', ev.venue_id),
    'organizer', public.flyer_public_entity_json('organizer', ev.organizer_id),
    'instructors', coalesce((
      select jsonb_agg(public.flyer_public_entity_json('instructor', ei.instructor_id) order by ei.position)
        from public.event_instructors ei
       where ei.event_id = ev.id
         and public.flyer_public_entity_json('instructor', ei.instructor_id) is not null), '[]'::jsonb),
    'school', (
      select public.flyer_public_entity_json('school', es.school_id)
        from public.event_schools es where es.event_id = ev.id limit 1)
  );
end;
$$;

-- ============================================================
-- 8b. Organizer-host bulk create keeps flyer suggestions (never canonical)
-- ============================================================

create or replace function public.flyer_suggestion_item(p_item jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when p_item is null or jsonb_typeof(p_item) <> 'object' then null else jsonb_build_object(
    'candidate', public.flyer_clean_candidate(p_item -> 'candidate') - 'email' - 'phone',
    'state', case when p_item ->> 'state' in ('MATCHED', 'POSSIBLE MATCH', 'NEW', 'NEEDS REVIEW')
                  then p_item ->> 'state' else 'NEEDS REVIEW' end,
    'matches', public.flyer_clean_matches(p_item -> 'matches'),
    'decision', 'pending',
    'selected_id', null) end;
$$;

-- Every decision reset to pending; ids dropped. An authorized reviewer must
-- re-decide in the admin editor (save_event_with_entities).
create or replace function public.flyer_suggestion_review(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'venue', public.flyer_suggestion_item(p -> 'venue'),
    'organizer', public.flyer_suggestion_item(p -> 'organizer'),
    'instructors', coalesce((
      select jsonb_agg(t.item)
        from (select public.flyer_suggestion_item(x) as item
                from jsonb_array_elements(case when jsonb_typeof(p -> 'instructors') = 'array'
                                               then p -> 'instructors' else '[]'::jsonb end) x
               limit 12) t
       where t.item is not null), '[]'::jsonb),
    'school', public.flyer_suggestion_item(p -> 'school'));
$$;

-- Same gate and behavior as 20260903000000 (owner/manager/platform admin,
-- whitelisted fields) plus an optional entity_review stored as pending
-- suggestions on events.entity_review. It never creates or links a
-- venue/organizer/instructor/school and never changes organizer_id.
create or replace function public.organizer_create_event(p_organizer_id uuid, p_payload jsonb, p_publish boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_role text;
  v_keys text[];
  v_bad text[];
  v_allowed constant text[] := array[
    'title','description','event_type','city','event_date','event_time',
    'location','address','price_type','price_amount','rsvp_link','recurrence',
    'contact_email','contact_instagram','contact_website','image_url','host',
    'dance_styles','venue_id','entity_review'
  ];
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.account_is_active(auth.uid()) then
    raise exception 'account is not active' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'event payload must be an object' using errcode = '22023';
  end if;
  if nullif(btrim(p_payload ->> 'title'), '') is null then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_payload ->> 'event_date'), '') is null then
    raise exception 'event date is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_payload ->> 'event_type'), '') is null then
    raise exception 'event type is required' using errcode = '22023';
  end if;
  if jsonb_exists(p_payload, 'entity_review') and jsonb_typeof(p_payload -> 'entity_review') not in ('object', 'null') then
    raise exception 'entity_review must be an object' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > 262144 then
    raise exception 'event payload too large' using errcode = '22023';
  end if;

  select array_agg(k) into v_keys from jsonb_object_keys(p_payload) as k;
  select array_agg(k order by k)
    into v_bad
    from unnest(v_keys) as keys(k)
   where not (k = any(v_allowed));
  if v_bad is not null and cardinality(v_bad) > 0 then
    raise exception 'field not creatable by organizers: %', v_bad using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organizers
     where id = p_organizer_id and status = 'active'
  ) then
    raise exception 'organizer is not active' using errcode = '42501';
  end if;

  if public.is_admin() then
    v_role := 'platform';
  else
    v_role := public.organizer_member_role(p_organizer_id);
    if v_role is null or v_role not in ('owner', 'manager') then
      raise exception 'active owner or manager membership required' using errcode = '42501';
    end if;
  end if;

  insert into public.events (
    title, description, event_type, city, event_date, event_time, location,
    address, price_type, price_amount, rsvp_link, recurrence, contact_email,
    contact_instagram, contact_website, image_url, host, dance_styles,
    venue_id, status, source_type, submitter_id, organizer_id, entity_review
  ) values (
    btrim(p_payload ->> 'title'),
    nullif(btrim(p_payload ->> 'description'), ''),
    p_payload ->> 'event_type',
    coalesce(nullif(p_payload ->> 'city', ''), 'boston'),
    (p_payload ->> 'event_date')::timestamptz,
    nullif(p_payload ->> 'event_time', ''),
    nullif(btrim(p_payload ->> 'location'), ''),
    nullif(btrim(p_payload ->> 'address'), ''),
    nullif(p_payload ->> 'price_type', ''),
    case when nullif(p_payload ->> 'price_amount', '') is null then null else (p_payload ->> 'price_amount')::numeric end,
    nullif(btrim(p_payload ->> 'rsvp_link'), ''),
    nullif(p_payload ->> 'recurrence', ''),
    nullif(btrim(p_payload ->> 'contact_email'), ''),
    nullif(btrim(p_payload ->> 'contact_instagram'), ''),
    nullif(btrim(p_payload ->> 'contact_website'), ''),
    nullif(btrim(p_payload ->> 'image_url'), ''),
    nullif(btrim(p_payload ->> 'host'), ''),
    case
      when jsonb_exists(p_payload, 'dance_styles') then
        (select coalesce(array_agg(style), '{}') from jsonb_array_elements_text(p_payload -> 'dance_styles') as style)
      else '{}'::text[]
    end,
    case when nullif(p_payload ->> 'venue_id', '') is null then null else (p_payload ->> 'venue_id')::uuid end,
    case when coalesce(p_publish, false) then 'approved' else 'draft' end,
    'organizer',
    auth.uid(),
    p_organizer_id,
    case when jsonb_typeof(p_payload -> 'entity_review') = 'object'
         then public.flyer_suggestion_review(p_payload -> 'entity_review') else null end
  )
  returning id into v_event_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'event.organizer_created',
    'event',
    v_event_id,
    jsonb_build_object('organizer_id', p_organizer_id, 'member_role', v_role, 'published', coalesce(p_publish, false),
                       'entity_review_suggested', jsonb_typeof(p_payload -> 'entity_review') = 'object')
  );

  return v_event_id;
end;
$$;

-- ============================================================
-- 9. Grants (Supabase default privileges grant EXECUTE to anon and
--    authenticated on new functions, so revoke explicitly)
-- ============================================================

do $$
declare
  f text;
begin
  foreach f in array array[
    'flyer_norm_text(text)', 'flyer_norm_address(text)', 'flyer_norm_handle(text)', 'flyer_norm_host(text)',
    'flyer_slugify(text)', 'flyer_uuid_or_null(text)', 'flyer_country_code(text)',
    'flyer_json_text(jsonb,text,integer)', 'flyer_clean_candidate(jsonb)', 'flyer_clean_website(text)',
    'flyer_addr_same(text,text)',
    'flyer_match_strength(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean)',
    'flyer_entity_exists(text,uuid)', 'flyer_candidate_has_signal(text,jsonb)', 'flyer_entity_matches(text,jsonb,uuid,uuid,text)',
    'flyer_match_json(text,jsonb,text)', 'flyer_review_item(text,jsonb)',
    'flyer_slug_taken(text,text)', 'flyer_unique_slug(text,text,text,text)',
    'flyer_entity_create(text,jsonb,jsonb)', 'flyer_clean_matches(jsonb)',
    'flyer_resolve_item(text,jsonb,jsonb)', 'flyer_item_overrides_direct(jsonb)',
    'flyer_apply_entity_review(jsonb,jsonb,uuid,uuid)', 'flyer_sync_event_links(uuid,jsonb)',
    'event_submissions_track_entity_review()', 'flyer_item_core(jsonb)',
    'flyer_downgrade_item(jsonb,jsonb)', 'flyer_moderated_review(jsonb,jsonb)',
    'flyer_write_actor()', 'flyer_harden_legacy_submissions()', 'flyer_origin(text)', 'flyer_suggestion_item(jsonb)', 'flyer_suggestion_review(jsonb)', 'flyer_public_entity_json(text,uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- Table index expressions run as the inserting role for direct admin writes.
grant execute on function public.flyer_norm_text(text) to authenticated;

revoke all on function public.reconcile_flyer_entities(jsonb) from public, anon;
revoke all on function public.search_flyer_entities(text, text) from public, anon;
revoke all on function public.save_event_with_entities(uuid, jsonb, boolean) from public, anon;
revoke all on function public.approve_event_submission(uuid, uuid[]) from public, anon;
grant execute on function public.reconcile_flyer_entities(jsonb) to authenticated;
grant execute on function public.search_flyer_entities(text, text) to authenticated;
grant execute on function public.save_event_with_entities(uuid, jsonb, boolean) to authenticated;
grant execute on function public.approve_event_submission(uuid, uuid[]) to authenticated;

revoke all on function public.public_flyer_entity(text, text) from public;
revoke all on function public.public_event_entities(uuid) from public;
grant execute on function public.public_flyer_entity(text, text) to anon, authenticated;
grant execute on function public.public_event_entities(uuid) to anon, authenticated;

comment on column public.events.entity_review is
  'Retained EntityReview decisions for the event (candidate email/phone stripped). Not exposed by public_events.';
comment on column public.event_submissions.moderator_entity_review is
  'Trigger-maintained copy of edited_data.entity_review written by a moderator/admin. The only entity review approve_event_submission trusts.';

notify pgrst, 'reload schema';

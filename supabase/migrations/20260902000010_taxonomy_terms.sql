-- Taxonomy terms table for dance styles and event attributes
-- Phase 14 — Taxonomy Consolidation

create table if not exists public.taxonomy_terms (
  id              uuid primary key default gen_random_uuid(),
  category        text not null check (category in ('dance_style', 'event_attribute')),
  name            text not null,
  slug            text not null,
  description     text,
  parent_id       uuid references public.taxonomy_terms(id),
  status          text not null default 'active' check (status in ('active', 'needs_review', 'archived')),
  display_order   integer not null default 0,
  usage_count     integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Comments
comment on table public.taxonomy_terms is 'Taxonomy terms for categorizing events (dance styles, event attributes, etc.)';
comment on column public.taxonomy_terms.category is 'Type of taxonomy: dance_style or event_attribute';
comment on column public.taxonomy_terms.name is 'Human-readable term name';
comment on column public.taxonomy_terms.slug is 'URL-friendly unique identifier';
comment on column public.taxonomy_terms.description is 'Optional detailed description';
comment on column public.taxonomy_terms.parent_id is 'Optional parent term for hierarchical taxonomies';
comment on column public.taxonomy_terms.status is 'Current status of the term';
comment on column public.taxonomy_terms.display_order is 'Order for display in lists and filters';
comment on column public.taxonomy_terms.usage_count is 'Number of events using this term (denormalized for performance)';

-- Constraints
alter table public.taxonomy_terms drop constraint if exists taxonomy_terms_name_category_key;
alter table public.taxonomy_terms add constraint taxonomy_terms_name_category_key unique (name, category);

alter table public.taxonomy_terms drop constraint if exists taxonomy_terms_slug_key;
alter table public.taxonomy_terms add constraint taxonomy_terms_slug_key unique (slug);

-- Indexes
create index if not exists taxonomy_terms_category_idx on public.taxonomy_terms(category);
create index if not exists taxonomy_terms_status_idx on public.taxonomy_terms(status);
create index if not exists taxonomy_terms_parent_id_idx on public.taxonomy_terms(parent_id);
create index if not exists taxonomy_terms_usage_count_idx on public.taxonomy_terms(usage_count desc);

-- Row Level Security
alter table public.taxonomy_terms enable row level security;

-- Policies: Public calendar reads terms anonymously (event dance-style/attribute
-- tags render for signed-out visitors); admins modify.
drop policy if exists "Taxonomy terms are viewable by authenticated users" on public.taxonomy_terms;
drop policy if exists "Taxonomy terms are publicly viewable" on public.taxonomy_terms;
create policy "Taxonomy terms are publicly viewable"
  on public.taxonomy_terms
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert taxonomy terms" on public.taxonomy_terms;
create policy "Admins can insert taxonomy terms"
  on public.taxonomy_terms
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update taxonomy terms" on public.taxonomy_terms;
create policy "Admins can update taxonomy terms"
  on public.taxonomy_terms
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete taxonomy terms" on public.taxonomy_terms;
create policy "Admins can delete taxonomy terms"
  on public.taxonomy_terms
  for delete
  to authenticated
  using (public.is_admin());

-- Grants
grant select on public.taxonomy_terms to anon, authenticated;
grant insert, update, delete on public.taxonomy_terms to authenticated;

-- Trigger to set updated_at
drop trigger if exists taxonomy_terms_set_updated_at on public.taxonomy_terms;
create trigger taxonomy_terms_set_updated_at
  before update on public.taxonomy_terms
  for each row
  execute function public.set_updated_at();

notify pgrst, 'reload schema';

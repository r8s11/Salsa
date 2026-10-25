-- Event-Taxonomy junction table for linking events to taxonomy terms
-- Phase 14 — Taxonomy Consolidation

create table if not exists public.event_taxonomy_terms (
  event_id         uuid not null references public.events(id) on delete cascade,
  taxonomy_term_id uuid not null references public.taxonomy_terms(id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (event_id, taxonomy_term_id)
);

-- Comments
comment on table public.event_taxonomy_terms is 'Junction table linking events to taxonomy terms';

-- Indexes
create index if not exists event_taxonomy_terms_event_id_idx on public.event_taxonomy_terms(event_id);
create index if not exists event_taxonomy_terms_taxonomy_term_id_idx on public.event_taxonomy_terms(taxonomy_term_id);

-- Row Level Security
alter table public.event_taxonomy_terms enable row level security;

-- Policies: Public calendar reads event↔term links anonymously (feeds the
-- events(*, event_taxonomy_terms(...)) embed on signed-out pages).
drop policy if exists "Event taxonomy terms are viewable by authenticated users" on public.event_taxonomy_terms;
drop policy if exists "Event taxonomy terms are publicly viewable" on public.event_taxonomy_terms;
create policy "Event taxonomy terms are publicly viewable"
  on public.event_taxonomy_terms
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert event taxonomy terms" on public.event_taxonomy_terms;
create policy "Admins can insert event taxonomy terms"
  on public.event_taxonomy_terms
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can delete event taxonomy terms" on public.event_taxonomy_terms;
create policy "Admins can delete event taxonomy terms"
  on public.event_taxonomy_terms
  for delete
  to authenticated
  using (public.is_admin());

-- Grants
grant select on public.event_taxonomy_terms to anon, authenticated;
grant insert, delete on public.event_taxonomy_terms to authenticated;

notify pgrst, 'reload schema';

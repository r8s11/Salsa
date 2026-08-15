-- Phase 10 — controlled taxonomy terms.
-- REQUIRED. Run manually after review; do not execute via an automated deploy.

-- normalize(..., NFKC) needs UTF8 and must be immutable for a generated column.
do $$
begin
  if current_setting('server_encoding') <> 'UTF8' then
    raise exception 'taxonomy_terms requires UTF8 server encoding';
  end if;
  if normalize('Ｓａｌｓａ', NFKC) <> 'Salsa' then
    raise exception 'NFKC normalization is unavailable';
  end if;
  if not exists (
    select 1 from pg_proc where proname = 'normalize' and provolatile = 'i'
  ) then
    raise exception 'normalize(text, NFKC) is not immutable';
  end if;
end;
$$;

create table if not exists public.taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('dance_style', 'event_attribute')),
  name text not null check (btrim(name) <> ''),
  normalized_name text generated always as (lower(btrim(normalize(name, NFKC)))) stored,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  parent_id uuid references public.taxonomy_terms(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'needs_review', 'archived')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taxonomy_terms_category_normalized_name_key unique (category, normalized_name),
  constraint taxonomy_terms_slug_key unique (slug),
  constraint taxonomy_terms_not_own_parent check (parent_id is null or parent_id <> id)
);

create index if not exists taxonomy_terms_directory_idx
  on public.taxonomy_terms (category, status, display_order, name);
create index if not exists taxonomy_terms_parent_idx
  on public.taxonomy_terms (parent_id) where parent_id is not null;

drop trigger if exists taxonomy_terms_set_updated_at on public.taxonomy_terms;
create trigger taxonomy_terms_set_updated_at
  before update on public.taxonomy_terms
  for each row execute function public.set_updated_at();

-- Consistent with the established events audit trail. This records direct
-- admin create/edit/archive/restore/delete mutations; the merge RPC records
-- its relationship reassignment separately in 002.
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
revoke execute on function public.log_taxonomy_term_change() from public, anon;

drop trigger if exists taxonomy_terms_audit_log on public.taxonomy_terms;
create trigger taxonomy_terms_audit_log
  after insert or update or delete on public.taxonomy_terms
  for each row execute function public.log_taxonomy_term_change();

alter table public.taxonomy_terms enable row level security;
grant select on public.taxonomy_terms to anon, authenticated;
grant insert, update, delete on public.taxonomy_terms to authenticated;

drop policy if exists "Public active taxonomy terms are readable" on public.taxonomy_terms;
create policy "Public active taxonomy terms are readable"
  on public.taxonomy_terms for select to anon, authenticated
  using (status = 'active');

drop policy if exists "Moderators read taxonomy terms" on public.taxonomy_terms;
create policy "Moderators read taxonomy terms"
  on public.taxonomy_terms for select to authenticated
  using (public.is_moderator());
drop policy if exists "Moderators manage taxonomy terms" on public.taxonomy_terms;
create policy "Moderators manage taxonomy terms"
  on public.taxonomy_terms for all to authenticated
  using (public.is_moderator()) with check (public.is_moderator());


notify pgrst, 'reload schema';

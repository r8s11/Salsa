-- Phase 10 — event taxonomy relationships and admin RPCs.
-- REQUIRED. Run manually after 001_create_taxonomy_terms.sql.

create table if not exists public.event_taxonomy_terms (
  event_id uuid not null references public.events(id) on delete cascade,
  taxonomy_term_id uuid not null references public.taxonomy_terms(id) on delete restrict,
  primary key (event_id, taxonomy_term_id)
);
create index if not exists event_taxonomy_terms_term_event_idx on public.event_taxonomy_terms (taxonomy_term_id, event_id);
alter table public.event_taxonomy_terms enable row level security;
grant select, insert, delete on public.event_taxonomy_terms to authenticated;
drop policy if exists "Moderators read event taxonomy terms" on public.event_taxonomy_terms;
create policy "Moderators read event taxonomy terms" on public.event_taxonomy_terms for select to authenticated using (public.is_moderator());
drop policy if exists "Moderators manage event taxonomy terms" on public.event_taxonomy_terms;
create policy "Moderators manage event taxonomy terms" on public.event_taxonomy_terms for all to authenticated using (public.is_moderator()) with check (public.is_moderator());

create or replace function public.require_taxonomy_moderator()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'Moderator role required'; end if;
end;
$$;
revoke all on function public.require_taxonomy_moderator() from public, anon;
grant execute on function public.require_taxonomy_moderator() to authenticated;

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

create or replace function public.admin_taxonomy_detail(p_id uuid)
returns table (id uuid, category text, name text, slug text, description text, parent_id uuid, status text, display_order integer, usage_count bigint, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_taxonomy_moderator();
  return query select t.id,t.category,t.name,t.slug,t.description,t.parent_id,t.status,t.display_order,count(ett.event_id)::bigint,t.created_at,t.updated_at from taxonomy_terms t left join event_taxonomy_terms ett on ett.taxonomy_term_id=t.id where t.id=p_id group by t.id;
end; $$;

create or replace function public.admin_taxonomy_search(p_category text, p_search text default '')
returns table (id uuid, category text, name text, slug text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_taxonomy_moderator();
  return query select t.id,t.category,t.name,t.slug,t.status from taxonomy_terms t where t.category=p_category and t.status='active' and (p_search='' or t.name ilike '%'||p_search||'%' or t.slug ilike '%'||p_search||'%') order by t.display_order,t.name;
end; $$;

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
  insert into events(title,description,event_type,event_date,event_time,location,address,price_type,price_amount,rsvp_link,city,status,source_type,submitter_name,submitter_email)
  values(d->>'title',nullif(d->>'description',''),d->>'event_type',(d->>'event_date')::timestamptz,nullif(d->>'event_time',''),nullif(d->>'location',''),nullif(d->>'address',''),nullif(d->>'price_type',''),nullif(d->>'price_amount','')::numeric,nullif(d->>'rsvp_link',''),d->>'city','approved','moderator',s.submitter_name,s.submitter_email) returning id into v_event_id;
  insert into event_taxonomy_terms(event_id,taxonomy_term_id) select v_event_id, term_id from unnest(ids) as selected(term_id) on conflict do nothing;
  update event_submissions set status='approved',approved_event_id=v_event_id,reviewed_by=auth.uid(),reviewed_at=now() where id=p_submission_id;
  return v_event_id;
end; $$;

revoke all on function public.admin_taxonomy_directory(text,text,text,text),public.admin_taxonomy_detail(uuid),public.admin_taxonomy_search(text,text),public.replace_event_taxonomy_terms(uuid,uuid[]),public.merge_taxonomy_terms(uuid,uuid),public.approve_event_submission(uuid,uuid[]) from public,anon;
grant execute on function public.admin_taxonomy_directory(text,text,text,text),public.admin_taxonomy_detail(uuid),public.admin_taxonomy_search(text,text),public.replace_event_taxonomy_terms(uuid,uuid[]),public.merge_taxonomy_terms(uuid,uuid),public.approve_event_submission(uuid,uuid[]) to authenticated;
notify pgrst,'reload schema';

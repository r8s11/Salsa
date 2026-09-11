-- Phase 10 — migrate legacy events.dance_styles values into event_taxonomy_terms.
-- REQUIRED. Run manually after 001–003. This script does not drop the source column.

begin;

-- Abort the transaction before inserting anything if an array value has no
-- reviewed canonical target.
do $$
begin
  if exists (
    select 1
    from (select distinct unnest(dance_styles) as legacy_style from public.events) legacy
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
cross join lateral unnest(event.dance_styles) as legacy_style
join public.taxonomy_terms term
  on term.category = 'dance_style' and term.slug = legacy_style
on conflict do nothing;

-- Duplicate legacy array values do not create extra join rows. The two counts
-- must agree before committing.
do $$
declare legacy_pairs bigint; migrated_pairs bigint;
begin
  select count(*) into legacy_pairs from (
    select distinct event.id, legacy_style
    from public.events event cross join lateral unnest(event.dance_styles) legacy_style
  ) pairs;
  select count(*) into migrated_pairs
  from public.event_taxonomy_terms ett
  join public.taxonomy_terms term on term.id = ett.taxonomy_term_id
  where term.category = 'dance_style';
  if legacy_pairs <> migrated_pairs then
    raise exception 'Taxonomy migration mismatch: legacy %, migrated %', legacy_pairs, migrated_pairs;
  end if;
end;
$$;

commit;

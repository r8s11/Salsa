-- Phase 10 — migrate legacy events.dance_styles values into event_taxonomy_terms.
-- REQUIRED. Run manually after 001–003. This script does not drop the source column.

-- Stop here if any legacy value has no reviewed canonical target.
select legacy_style
from (select distinct unnest(dance_styles) as legacy_style from public.events) legacy
left join public.taxonomy_terms term
  on term.category = 'dance_style' and term.slug = legacy.legacy_style
where term.id is null;

-- Only run the INSERT after the query above returns zero rows.
insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
select event.id, term.id
from public.events event
cross join lateral unnest(event.dance_styles) as legacy_style
join public.taxonomy_terms term
  on term.category = 'dance_style' and term.slug = legacy_style
on conflict do nothing;

-- Manual verification: legacy entries and normalized relationships must agree.
select
  (select count(*) from public.events cross join lateral unnest(dance_styles)) as legacy_relationships,
  (select count(*) from public.event_taxonomy_terms ett join public.taxonomy_terms t on t.id = ett.taxonomy_term_id where t.category = 'dance_style') as migrated_relationships;

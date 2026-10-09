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

-- The migration guarantees that every legacy-derived pair exists. It must
-- permit independently assigned dance-style terms that were already present
-- before this backfill; comparing the two total counts incorrectly rejects
-- those legitimate relationships.
do $$
declare missing_pairs bigint;
begin
  select count(*) into missing_pairs
  from (
    (
      select distinct event.id as event_id, term.id as taxonomy_term_id
      from public.events event
      cross join lateral unnest(coalesce(event.dance_styles, '{}')) as legacy_style
      join public.taxonomy_terms term
        on term.category = 'dance_style'
       and term.slug = legacy_style
    )
    except
    select ett.event_id, ett.taxonomy_term_id
    from public.event_taxonomy_terms ett
  ) pairs;

  if missing_pairs <> 0 then
    raise exception 'Taxonomy migration incomplete: % legacy-derived pairs are missing', missing_pairs;
  end if;
end;
$$;

commit;

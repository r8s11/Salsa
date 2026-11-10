-- Public listing event rows carry the linked venue's IANA zone.
--
-- Every public event row (public_entity_detail upcoming/past for event, series,
-- organizer, venue, school, instructor, DJ, city and style pages, and the
-- workspace overview's upcoming list) is built by entity_access_event_summary.
-- It exposed event_date and the metro slug (city) but no zone, so the client
-- had to assume America/New_York for every row.
--
-- The composer's rule is event > series > venue > metro. Only the venue zone is
-- stored anywhere (events and event_series have no time-zone column), and the
-- metro fallback is derived from the slug in shared/utils/timezone.ts because
-- metros has no zone column. Re-implementing that map in SQL would be a second
-- copy of the rule, so the summary ships just the one stored input,
-- `venue_time_zone`, and the client resolves it with the shared helper
-- (venue first, then the row's `city`).
--
-- Only a zone-name-shaped string is exposed (venues.timezone is unconstrained
-- free text, and pg_timezone_names is too slow to scan per row); the client
-- still validates it as a real IANA zone before use.
--
-- The function is patched in place from its live definition (exact single-
-- occurrence anchor, so production drift fails the migration loudly) and
-- CREATE OR REPLACE keeps its owner, grants and security attributes. A retried
-- deploy is a no-op once the key is present.

create or replace function pg_temp.patch_fn(p_src text, p_old text, p_new text)
returns text
language plpgsql
as $$
begin
  if p_old = '' or (length(p_src) - length(replace(p_src, p_old, ''))) / length(p_old) <> 1 then
    raise exception 'public listing time zone migration: expected exactly one occurrence of: %', p_old;
  end if;
  return replace(p_src, p_old, p_new);
end $$;

do $patch$
declare
  v text;
begin
  v := pg_get_functiondef('public.entity_access_event_summary(public.events)'::regprocedure);
  if position('venue_time_zone' in v) = 0 then
    v := pg_temp.patch_fn(
      v,
      $old$'city',e.city,$old$,
      $new$'city',e.city,'venue_time_zone',(select btrim(vn.timezone) from venues vn where vn.id=e.venue_id and btrim(vn.timezone) ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$'),$new$
    );
    execute v;
  end if;
end $patch$;

-- Read-only independent reference aggregates for a 30-day Eastern activity window.
-- Run after release using an authorized read-only connection. No private rows returned.
-- Record as_of and boundaries; compare the dashboard/RPC using these exact boundaries.
-- An aggregate-source check does not prove administrator HTTP authorization.
WITH bounds AS (
  SELECT now() AS as_of,
         (((now() AT TIME ZONE 'America/New_York')::date - 29)::timestamp
           AT TIME ZONE 'America/New_York') AS from_date,
         (((now() AT TIME ZONE 'America/New_York')::date + 1)::timestamp
           AT TIME ZONE 'America/New_York') AS to_date,
         ((now() AT TIME ZONE 'America/New_York')::date::timestamp
           AT TIME ZONE 'America/New_York') AS today_start
), upcoming AS (
  SELECT e.city, e.organizer_id
    FROM public.events e, bounds b
   WHERE e.status = 'approved' AND e.event_date >= b.today_start
), cities AS (
  SELECT nullif(btrim(u.city), '') AS slug,
         CASE WHEN nullif(btrim(u.city), '') IS NULL THEN 'Unknown city'
              ELSE coalesce(m.name, u.city) END AS city,
         count(*) AS count
    FROM upcoming u
    LEFT JOIN public.metros m ON m.slug = u.city
   GROUP BY 1, 2
)
SELECT b.as_of, b.from_date, b.to_date,
       (SELECT count(*) FROM public.events e
         WHERE e.created_at >= b.from_date AND e.created_at < b.to_date) AS total_events,
       (SELECT count(*) FROM auth.users u
         WHERE u.created_at >= b.from_date AND u.created_at < b.to_date) AS registered_users,
       (SELECT count(*) FROM public.event_submissions s
         WHERE s.status IN ('pending', 'in_review')
           AND s.submitted_at >= b.from_date AND s.submitted_at < b.to_date) AS pending_submissions,
       (SELECT count(*) FROM upcoming) AS upcoming_events,
       (SELECT count(DISTINCT organizer_id) FROM upcoming) AS active_organizers,
       (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY count DESC, city, slug NULLS LAST), '[]'::jsonb)
          FROM cities c) AS events_by_city
  FROM bounds b;

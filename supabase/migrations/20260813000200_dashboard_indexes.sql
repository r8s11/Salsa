-- events_event_date_idx already exists (baseline:31) — this adds the
-- composite index the dashboard's status-scoped date-range queries lean on.
create index if not exists events_status_idx
  on public.events (status);

create index if not exists events_status_event_date_idx
  on public.events (status, event_date);

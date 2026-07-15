-- Event module redesign: host, recurrence, gallery (all nullable; UI is
-- conditional on presence, so this is safe to apply before or after deploy).
alter table events
  add column if not exists host text,
  add column if not exists recurrence text,
  add column if not exists gallery text[];

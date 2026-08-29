-- Allows the original submitter to update their own event while it is still
-- pending or rejected (not yet approved/published). Approved events are owned
-- by the moderation workflow and cannot be edited by submitters — the status
-- gate in the RLS policy makes that invariant enforceable at the database layer.
--
-- The TypeScript layer (eventsRepo.updateEventForUser) also strips fields that
-- should never be set by a submitter (status, source_type, submitter_*, host,
-- image_url, venue_id, etc.) — defense in depth.

alter table public.events enable row level security;

-- UPDATE permission is already granted to authenticated on events by
-- 20260810000000_admin_moderation_policies.sql, so no GRANT is needed here.

drop policy if exists "Submitters update own pending or rejected events" on public.events;
create policy "Submitters update own pending or rejected events"
  on public.events
  for update
  to authenticated
  using (
    submitter_id = auth.uid()
    and status in ('pending', 'rejected')
  )
  with check (
    submitter_id = auth.uid()
    and status in ('pending', 'rejected')
  );

-- Recalled (soft-deleted) events for submitters: a submitter may delete (withdraw)
-- their own event while it is still pending. Approved events are protected.
drop policy if exists "Submitters can withdraw own pending events" on public.events;
create policy "Submitters can withdraw own pending events"
  on public.events
  for delete
  to authenticated
  using (
    submitter_id = auth.uid()
    and status = 'pending'
  );

notify pgrst, 'reload schema';

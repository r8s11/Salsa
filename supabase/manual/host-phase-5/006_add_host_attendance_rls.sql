-- =====================================================================
-- Host Phase 5 — 006 — RLS policies
--
-- Purpose:
--   Every policy for both attendance tables. All of them route their
--   authorization decision through public.can_manage_event_attendance()
--   from 001, which requires: approved event + owned by caller + caller is an
--   active Organizer, OR caller is an Admin.
--
-- Required or optional: REQUIRED. Without this file the tables have RLS
--   enabled and zero policies, meaning deny-all through the Data API.
--
-- Execution order: SIXTH (after 005, before 007).
--
-- Dependencies:
--   - public.can_manage_event_attendance(uuid) (001)
--   - public.event_attendees, public.event_check_ins (002, 003)
--
-- Policy design notes:
--   - Every policy names `to authenticated` explicitly. anon is never
--     granted a policy and never granted a privilege (007), so anonymous
--     access is denied twice over.
--   - `to authenticated` is never relied on ALONE — each policy also carries
--     the ownership/approval predicate.
--   - INSERT policies pin the actor column to (select auth.uid()). This is
--     the anti-spoofing control: a caller cannot insert a row attributed to
--     someone else. Combined with the 004 immutability triggers, the actor
--     can be neither forged at creation nor rewritten afterwards.
--   - UPDATE policies supply BOTH using and with check. Postgres requires
--     using for row visibility and with check for the resulting row; omitting
--     with check would let an authorized caller write a row they could not
--     then see.
--   - DELETE on event_attendees is permitted ONLY for entries with no
--     check-in history. Correcting a data-entry mistake is a real need;
--     erasing someone's arrival record is not. Once a check-in exists
--     (even a reversed one) the roster entry is permanent history.
--   - DELETE on event_check_ins has NO policy at all. Arrival history is
--     never destroyed through the API; reversal is the supported path.
--   - Reversal is expressed as UPDATE, guarded by the 004 trigger so only the
--     reversal columns can move, and one-way only.
--
-- Whether destructive: NO. Adds policies. The drop-if-exists statements
--   target only the uniquely-named policies this file creates.
--
-- Rollback considerations: see 900. Dropping these policies leaves RLS
--   enabled with no policies, i.e. deny-all — a safe failure mode, not an
--   open one.
-- =====================================================================

-- ---------------------------------------------------------------------
-- public.event_attendees
-- ---------------------------------------------------------------------

drop policy if exists "Hosts read own approved event attendees" on public.event_attendees;
create policy "Hosts read own approved event attendees"
  on public.event_attendees
  for select
  to authenticated
  using (public.can_manage_event_attendance(event_id));

drop policy if exists "Hosts add attendees to own approved events" on public.event_attendees;
create policy "Hosts add attendees to own approved events"
  on public.event_attendees
  for insert
  to authenticated
  with check (
    public.can_manage_event_attendance(event_id)
    and created_by = (select auth.uid())
  );

drop policy if exists "Hosts update own approved event attendees" on public.event_attendees;
create policy "Hosts update own approved event attendees"
  on public.event_attendees
  for update
  to authenticated
  using (public.can_manage_event_attendance(event_id))
  with check (public.can_manage_event_attendance(event_id));

-- Deletion is limited to entries that were never checked in. See notes above.
drop policy if exists "Hosts delete never-checked-in attendees" on public.event_attendees;
create policy "Hosts delete never-checked-in attendees"
  on public.event_attendees
  for delete
  to authenticated
  using (
    public.can_manage_event_attendance(event_id)
    and not exists (
      select 1
      from public.event_check_ins c
      where c.attendee_id = event_attendees.id
    )
  );

-- ---------------------------------------------------------------------
-- public.event_check_ins
-- ---------------------------------------------------------------------

drop policy if exists "Hosts read own approved event check-ins" on public.event_check_ins;
create policy "Hosts read own approved event check-ins"
  on public.event_check_ins
  for select
  to authenticated
  using (public.can_manage_event_attendance(event_id));

-- A new check-in must be recorded by the caller and must not arrive
-- pre-reversed.
drop policy if exists "Hosts record check-ins for own approved events" on public.event_check_ins;
create policy "Hosts record check-ins for own approved events"
  on public.event_check_ins
  for insert
  to authenticated
  with check (
    public.can_manage_event_attendance(event_id)
    and checked_in_by = (select auth.uid())
    and reversed_at is null
    and reversed_by is null
  );

-- Reversal path. The 004 trigger restricts which columns may actually change;
-- this policy restricts who may change them and forces the reversing actor to
-- be the caller.
drop policy if exists "Hosts reverse check-ins for own approved events" on public.event_check_ins;
create policy "Hosts reverse check-ins for own approved events"
  on public.event_check_ins
  for update
  to authenticated
  using (public.can_manage_event_attendance(event_id))
  with check (
    public.can_manage_event_attendance(event_id)
    and (reversed_at is null or reversed_by = (select auth.uid()))
  );

-- Intentionally NO delete policy on public.event_check_ins.

notify pgrst, 'reload schema';

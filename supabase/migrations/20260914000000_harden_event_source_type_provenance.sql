-- Phase 4B — make events.source_type moderator provenance trustworthy.
--
-- This migration changes only public.events policies and authenticated column
-- privileges. Existing source_type values are not rewritten. The privileged
-- approval RPC remains the sole path that writes source_type = 'moderator'.

alter table public.events enable row level security;

-- Legacy anonymous/authenticated submissions must always remain user
-- submissions. RLS policies are permissive and combine with OR, so replace
-- the existing policy rather than adding a second policy beside it.
drop policy if exists "Anon can submit pending events" on public.events;
create policy "Anon can submit pending events"
  on public.events
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and submitter_id is not distinct from auth.uid()
    and public.account_is_active(auth.uid())
    and source_type = 'user_submission'
  );

-- Manual admin creation and CSV import are direct table inserts. Neither is
-- an approval, so moderator provenance must be rejected at this boundary.
drop policy if exists "Admins can insert events" on public.events;
create policy "Admins can insert events"
  on public.events
  for insert
  to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'moderator')
    and source_type in ('admin', 'imported')
  );

-- Preserve existing updates to every event column except source_type. This
-- removes source_type from the ordinary PostgREST client write surface while
-- retaining the table-level UPDATE scope enforced by the policies below.
revoke update on public.events from authenticated;
grant update (
  id,
  title,
  description,
  event_type,
  event_date,
  event_time,
  location,
  address,
  price_type,
  price_amount,
  rsvp_link,
  image_url,
  status,
  submitter_name,
  submitter_email,
  created_at,
  city,
  host,
  recurrence,
  gallery,
  contact_email,
  contact_instagram,
  contact_website,
  submitter_id,
  updated_at,
  dance_styles,
  cancellation_reason,
  organizer_id,
  venue_id,
  poster_image_url
) on public.events to authenticated;

-- Submitter edits remain limited to legacy user-submission rows. The column
-- grant is the primary direct-client boundary; this policy also documents the
-- row-level invariant and remains safe if grants are later reissued.
drop policy if exists "Submitters update own pending or rejected events" on public.events;
create policy "Submitters update own pending or rejected events"
  on public.events
  for update
  to authenticated
  using (
    submitter_id = auth.uid()
    and status in ('pending', 'rejected')
    and source_type = 'user_submission'
  )
  with check (
    submitter_id = auth.uid()
    and status in ('pending', 'rejected')
    and source_type = 'user_submission'
  );

-- Keep the admin update policy's existing authorization boundary. The
-- column-level grant above makes source_type immutable to direct clients;
-- SECURITY DEFINER approval/organizer functions retain owner privileges.
drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
  on public.events
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

notify pgrst, 'reload schema';

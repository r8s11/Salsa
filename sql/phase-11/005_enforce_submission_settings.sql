-- Phase 11 — make the two submission controls authoritative at the database boundary.
-- REQUIRED after 001–003 and the Phase 7 event_submissions migration.
-- Run only with the matching application release: the release must hide/disable the
-- relevant submission entry points and present the configured closed-state message.
-- This also removes the legacy direct public insert path into public.events, which
-- otherwise bypasses event_submissions and every platform-settings control.

create or replace function public.public_event_suggestions_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select allow_public_event_suggestions
    from public.platform_settings
    where singleton
  ), false);
$$;
revoke all on function public.public_event_suggestions_enabled() from public;
grant execute on function public.public_event_suggestions_enabled() to anon, authenticated;

create or replace function public.registered_event_submissions_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select allow_registered_user_submissions
    from public.platform_settings
    where singleton
  ), false);
$$;
revoke all on function public.registered_event_submissions_enabled() from public, anon;
grant execute on function public.registered_event_submissions_enabled() to authenticated;

-- The Phase 7 hard cutover makes event_submissions the only visitor submission
-- destination. Authenticated administrators retain their direct event-creation
-- path through the existing "Admins can insert events" RLS policy.
drop policy if exists "Anon can submit pending events" on public.events;
revoke insert on public.events from anon;

drop policy if exists "Authenticated users can submit" on public.event_submissions;
create policy "Authenticated users can submit"
  on public.event_submissions
  for insert
  to authenticated
  with check (
    public.registered_event_submissions_enabled()
    and status = 'pending'
    and submitter_id = auth.uid()
    and public.account_is_active(auth.uid())
  );

drop policy if exists "Anon can submit" on public.event_submissions;
create policy "Anon can submit"
  on public.event_submissions
  for insert
  to anon
  with check (
    public.public_event_suggestions_enabled()
    and status = 'pending'
    and submitter_id is null
  );

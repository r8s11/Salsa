-- Lock raw application tables to authenticated users while keeping the
-- approved public projections available to anonymous visitors.
--
-- Public reads must use public_events/public_profiles. Authenticated raw-table
-- access remains unchanged for account, organizer, moderation, and admin flows.
-- The projections run with their owner's privileges so revoking anonymous
-- access to the raw tables does not make the public projections unusable.
alter view public.public_events set (security_invoker = false);
alter view public.public_profiles set (security_invoker = false);

revoke select on table public.events from anon;
revoke select on table public.profiles from anon;

grant select on table public.public_events to anon, authenticated;
grant select on table public.public_profiles to anon, authenticated;

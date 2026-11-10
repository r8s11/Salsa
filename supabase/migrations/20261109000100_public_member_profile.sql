-- Public member profile: the data behind /u/:username.
--
-- One read-only lookup by exact username. It is NOT a list, search or
-- directory: there is no way to call it without already knowing the username.
--
-- Visibility rules (all enforced here, never in the client):
--   * profiles.public_profile must be true. It takes precedence over every
--     other switch: a private profile discloses nothing, activity included.
--   * profiles.stats_public must be true for the `activity` key to exist.
--     When it is false the key is absent, not zero.
--   * The account must be in good standing: status = 'active' (flagged,
--     suspended and banned accounts are not shown) and onboarding finished.
--     Deleting an account cascades the profile row away
--     (profiles.id -> auth.users on delete cascade), so a deleted account is
--     simply a missing username.
--
-- A missing username, a private profile and an account out of good standing
-- all return SQL NULL, so a caller cannot tell them apart.
--
-- Usernames are unique case-insensitively (profiles_username_lower_idx on
-- lower(username)), so the lookup compares lower() on both sides.
--
-- The returned keys are a hand-written allowlist. Never returned: id, email,
-- role, status, status_reason, notification_prefs, onboarding_completed_at,
-- public_profile, stats_public, updated_at, the exact join timestamp, or
-- pending / rejected / total submission counts.

create or replace function public.public_member_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'username',      p.username,
           'display_name',  nullif(btrim(p.display_name), ''),
           'avatar_url',    p.avatar_url,
           'cover_url',     p.cover_url,
           'bio',           p.bio,
           'city',          p.city,
           'city_name',     m.name,
           'dance_styles',  p.dance_styles,
           'instagram',     p.instagram,
           'website',       p.website,
           'member_since',  to_char(p.created_at at time zone 'UTC', 'YYYY-MM')
         )
         || case
              when p.stats_public then jsonb_build_object(
                'activity',
                jsonb_build_object(
                  'events_hosted',
                  (select count(*)
                     from public.events e
                    where e.submitter_id = p.id
                      and e.status = 'approved')
                )
              )
              else '{}'::jsonb
            end
    from public.profiles p
    left join public.metros m on m.slug = p.city
   where p_username ~ '^[A-Za-z0-9_]{3,24}$'
     and lower(p.username) = lower(p_username)
     and p.public_profile
     and p.status = 'active'
     and p.onboarding_completed_at is not null;
$$;

comment on function public.public_member_profile(text) is
  'Allowlisted public view of one member by exact username (case-insensitive). NULL when missing, private (public_profile = false) or not in good standing (status <> active, onboarding unfinished). activity.events_hosted is present only when stats_public is true. Not a list or search.';

revoke all on function public.public_member_profile(text) from public;
grant execute on function public.public_member_profile(text) to anon, authenticated;

notify pgrst, 'reload schema';

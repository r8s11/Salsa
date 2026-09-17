-- Profile media foundation: one public bucket for user avatars and covers.
--
-- Object layout (stable filenames, overwrite on replace):
--   profile-media/{user_id}/avatar.webp
--   profile-media/{user_id}/cover.webp
--
-- Security:
--   - Public read (avatars/covers render on public profiles).
--   - Authenticated write scoped to the caller's own folder:
--     (storage.foldername(name))[1] = auth.uid().
--   - No admin client policy: support flows use service_role (bypasses RLS).
--   - event-flyers policies are untouched.
--
-- Missing-profile fix:
--   - handle_new_user normally provisions public.profiles, but a legitimate
--     authenticated user can exist without a row (pre-migration account,
--     partially provisioned signup). Previously avatar/cover saves then
--     failed with PostgREST PGRST116 (zero rows). This adds an owner-scoped
--     INSERT path so the client can self-provision exactly its own row.
--
-- Forward-only and idempotent: bucket upsert, drop-if-exists policies.

-- 1. Bucket -----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Avatars/covers appear on public profiles. The bucket itself is public,
-- but retain an explicit SELECT policy so older Storage policy sets
-- cannot return 403 for /storage/v1/object/public/profile-media/... URLs.
grant select on storage.objects to anon, authenticated;

drop policy if exists "Public can read profile media" on storage.objects;
create policy "Public can read profile media"
on storage.objects
for select
to public
using (bucket_id = 'profile-media');

drop policy if exists "Owners insert profile media" on storage.objects;
create policy "Owners insert profile media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-media'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners update profile media" on storage.objects;
create policy "Owners update profile media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-media'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-media'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners delete profile media" on storage.objects;
create policy "Owners delete profile media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-media'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Self-provision missing profile rows --------------------------------
-- Owner-only INSERT. USING is implied by WITH CHECK for inserts: the row
-- id must equal the caller, so User A can never create User B's row.
drop policy if exists "Users insert own profile row" on public.profiles;
create policy "Users insert own profile row"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- Column-level INSERT grant mirrors the owner-writable UPDATE set plus id.
-- role, status, status_reason, username, created_at stay unwritable.
grant insert (
  id,
  display_name,
  avatar_url,
  bio,
  city,
  dance_styles,
  instagram,
  website,
  cover_url,
  public_profile,
  stats_public,
  notification_prefs,
  onboarding_completed_at
) on public.profiles to authenticated;

notify pgrst, 'reload schema';

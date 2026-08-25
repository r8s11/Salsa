-- Manually run this file in the Supabase SQL Editor before enabling flyer uploads.
-- It creates Storage infrastructure only: public.events schema and event RLS policies are unchanged.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-flyers',
  'event-flyers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Flyers appear on public event pages and share posters. The bucket itself is
-- public, but retain an explicit SELECT policy so older Storage policy sets
-- cannot return 403 for /storage/v1/object/public/event-flyers/... URLs.
grant select on storage.objects to anon, authenticated;

drop policy if exists "Public can read event flyers" on storage.objects;
create policy "Public can read event flyers"
on storage.objects
for select
to public
using (bucket_id = 'event-flyers');

drop policy if exists "Owners insert event flyers" on storage.objects;
create policy "Owners insert event flyers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-flyers'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners update event flyers" on storage.objects;
create policy "Owners update event flyers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'event-flyers'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'event-flyers'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners delete event flyers" on storage.objects;
create policy "Owners delete event flyers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-flyers'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins manage event flyers" on storage.objects;
create policy "Admins manage event flyers"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'event-flyers'
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
)
with check (
  bucket_id = 'event-flyers'
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
);

notify pgrst, 'reload schema';

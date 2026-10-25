-- Public Event Submission flyer uploads.
--
-- Anonymous visitors may create and clean up only unpredictable objects under
-- event-flyers/anonymous/. Existing public-read, authenticated-owner, and
-- administrator policies remain unchanged.

drop policy if exists "Anonymous visitors insert event flyers" on storage.objects;
create policy "Anonymous visitors insert event flyers"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'event-flyers'
  and (storage.foldername(name))[1] = 'anonymous'
);

drop policy if exists "Anonymous visitors delete event flyers" on storage.objects;
create policy "Anonymous visitors delete event flyers"
on storage.objects
for delete
to anon
using (
  bucket_id = 'event-flyers'
  and (storage.foldername(name))[1] = 'anonymous'
);
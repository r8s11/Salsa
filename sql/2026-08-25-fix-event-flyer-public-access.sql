-- =====================================================================
-- Fix: event flyer URLs return HTTP 403; public page/poster show no image
--
-- Run in Supabase SQL Editor (production project).
--
-- Event flyers render on public event pages and in Story poster captures.
-- The app saves URLs under:
--   /storage/v1/object/public/event-flyers/<owner-id>/<event-id>/<file>
--
-- A 403 from that URL means production has an old/private `event-flyers`
-- bucket or no public SELECT policy. A browser cannot fetch those bytes, so
-- the poster must fall back to its gradient and the flyer disappears.
--
-- Safe to re-run. Flyers are public event media; this grants public READ
-- only. Upload/update/delete remain owner/admin restricted by
-- sql/2026-08-21_event_flyers_storage.sql.
-- =====================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-flyers',
  'event-flyers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket flag handles /object/public/ URLs. This explicit policy also
-- permits Storage's select path if production was created under an older
-- policy set.
grant select on storage.objects to anon, authenticated;

drop policy if exists "Public can read event flyers" on storage.objects;
create policy "Public can read event flyers"
  on storage.objects
  for select
  to public
  using (bucket_id = 'event-flyers');

commit;

notify pgrst, 'reload schema';

-- =====================================================================
-- Verification — run separately. Expect public = true.
-- =====================================================================
-- select id, public, file_size_limit, allowed_mime_types
-- from storage.buckets
-- where id = 'event-flyers';
--
-- Then hard-refresh the event page and open its flyer URL directly. It must
-- return 200, never 403.

alter table public.events
  add column if not exists contact_email text,
  add column if not exists contact_instagram text,
  add column if not exists contact_website text;

grant delete on public.events to authenticated;

create policy "Admins can delete events"
  on public.events
  for delete
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can insert events"
  on public.events
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

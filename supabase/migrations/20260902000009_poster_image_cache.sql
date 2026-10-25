alter table public.events
  add column if not exists poster_image_url text;

comment on column public.events.poster_image_url is
  'Platform-controlled normalized flyer asset used only by Story poster sharing.';

create or replace function public.clear_poster_image_url_on_source_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.image_url is distinct from old.image_url then
    new.poster_image_url := null;
  end if;
  return new;
end;
$$;

create trigger events_clear_poster_image_url_before_update
before update of image_url on public.events
for each row execute function public.clear_poster_image_url_on_source_change();

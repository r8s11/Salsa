-- The publication checklist (20261114235900) covers author flows only: organizer and
-- artist create/publish RPCs stamp it. Staff publishing through the admin composer
-- (save_event_with_entities) and JWT-less server maintenance never carry an author
-- acknowledgement, so the guard must not block them. Artist event validation still
-- applies to every approved artist event.

create or replace function public.artist_event_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.artist_event_rsvps where event_id=old.id) then
      raise exception 'Remove existing artist signups before deleting this event.' using errcode='23503';
    end if;
    return old;
  end if;
  if tg_op='UPDATE' and (new.artist_id is distinct from old.artist_id or
    (old.artist_id is not null and (new.organizer_id is not null or new.source_type<>'artist'))) then
    raise exception 'Artist ownership cannot be reassigned.' using errcode='22023';
  end if;
  if new.status='approved' and (tg_op='INSERT' or old.status='draft') and
    (new.artist_id is not null or new.organizer_id is not null) and
    auth.uid() is not null and not public.is_moderator() and
    (new.publication_ack_version is distinct from '2026-11-14' or new.publication_ack_by is distinct from auth.uid() or new.publication_ack_at is distinct from now()) then
    raise exception 'Complete the current responsibility checklist before publishing.' using errcode='22023';
  end if;
  if new.artist_id is not null and new.status='approved' then perform public.artist_event_validate(new); end if;
  return new;
end $$;

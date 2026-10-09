-- Phase 6 correction — close the null-display_name hole in the owner-update
-- path.
--
-- Observed on a local stack with a real Auth-issued JWT (two disposable
-- users, PostgREST):
--
--   PATCH /rest/v1/profiles?id=eq.<own-id>  {"display_name": null}
--     -> 200, and the stored display_name became null.
--
-- 20260830000000_profile_owner_update.sql added
--   check (display_name is null or length(btrim(display_name)) > 0)
-- which correctly rejects "" and "   ", but deliberately permits NULL so
-- that pre-existing legacy rows (created before display_name was populated)
-- stay valid and readable. The side effect is that an owner could blank an
-- existing name through the same client path, which the phase contract says
-- must be rejected.
--
-- A stricter CHECK (`display_name is not null`) cannot be used: it would be
-- validated against every existing row and would also block unrelated
-- column updates on legacy null rows forever.
--
-- Instead, forbid only the transition non-null -> null. Legacy rows keep a
-- null name, remain readable, and remain updatable in other columns; an
-- established name can no longer be erased. The existing CHECK still covers
-- "" and whitespace-only.
--
-- The trigger is BEFORE UPDATE and runs for every writer. Nulling out a
-- display name is not an operation any trusted flow performs
-- (admin_set_user_role / admin_set_user_status write role/status/reason;
-- handle_new_user only INSERTs), so no privileged path regresses.

create or replace function public.reject_display_name_blanking()
returns trigger
language plpgsql
as $$
begin
  if old.display_name is not null and new.display_name is null then
    raise exception
      'display_name cannot be cleared once set'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.reject_display_name_blanking() is
  'Phase 6: blocks the non-null -> null transition on profiles.display_name so an owner cannot blank an established name, while leaving legacy null rows valid.';

-- Trigger functions are not safe to call directly via RPC.
revoke execute on function public.reject_display_name_blanking() from public, anon, authenticated;

drop trigger if exists profiles_reject_display_name_blanking on public.profiles;
create trigger profiles_reject_display_name_blanking
  before update on public.profiles
  for each row
  execute function public.reject_display_name_blanking();

notify pgrst, 'reload schema';

-- First-touch attribution (docs/analytics/posthog-setup-proposal.md, option a).
-- The browser keeps the landing visit's UTM parameters, referring host and
-- landing path in memory only; they are stored here when the visitor submits
-- an event or signs up. Additive and nullable: existing rows and older
-- frontends are unaffected. No public projection exposes these columns.

-- Shape guard shared by both columns: a flat object of known keys whose
-- values are short strings. The client sends nothing else, so anything else
-- is rejected rather than stored.
create or replace function public.first_touch_is_valid(p_first_touch jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_first_touch is null or (
    jsonb_typeof(p_first_touch) = 'object'
    and not exists (
      select 1
        from jsonb_each(p_first_touch) as e(key, value)
       where e.key not in (
               'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
               'referrer_host', 'landing_path', 'captured_at'
             )
          or jsonb_typeof(e.value) <> 'string'
          or length(e.value #>> '{}') > 100
    )
  );
$$;

alter table public.event_submissions
  add column if not exists first_touch jsonb;
alter table public.event_submissions
  drop constraint if exists event_submissions_first_touch_valid;
alter table public.event_submissions
  add constraint event_submissions_first_touch_valid
  check (public.first_touch_is_valid(first_touch));

-- profiles has column-level update grants; first_touch is deliberately not
-- granted, so the only write path is the set-once RPC below.
alter table public.profiles
  add column if not exists first_touch jsonb;
alter table public.profiles
  drop constraint if exists profiles_first_touch_valid;
alter table public.profiles
  add constraint profiles_first_touch_valid
  check (public.first_touch_is_valid(first_touch));

-- Set-once, own row only, and only for accounts created in the last 7 days so
-- a later campaign visit by an existing member cannot rewrite how they joined.
create or replace function public.record_profile_first_touch(p_first_touch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if p_first_touch is null or not public.first_touch_is_valid(p_first_touch) then
    raise exception 'Invalid first-touch attribution.' using errcode = '22023';
  end if;

  update public.profiles
     set first_touch = p_first_touch
   where id = auth.uid()
     and first_touch is null
     and created_at > now() - interval '7 days';
end;
$$;

revoke all on function public.record_profile_first_touch(jsonb) from public, anon, authenticated;
grant execute on function public.record_profile_first_touch(jsonb) to authenticated;

-- Host Phase 2 — canonical organizer event creation.
-- Manual review only. Do not run against production without approval.
-- Requires Phase 6 organizer access helpers and events.organizer_id.
-- Venue compatibility prerequisite: this RPC also accepts venue_id and therefore
-- requires the existing production venues table + events.venue_id foreign key.
-- The current Phase 6 migration intentionally does not create those objects;
-- apply the separately reviewed venue prerequisite manually before this SQL when
-- the production schema exposes venue_id. The Host UI remains compatible with
-- legacy free-text location/address when no venue selector is available.
create or replace function public.organizer_create_event(
  p_organizer_id uuid,
  p_payload jsonb,
  p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_keys text[];
  v_bad text[];
  v_allowed constant text[] := array[
    'title','description','event_type','city','event_date','event_time',
    'location','address','price_type','price_amount','rsvp_link','recurrence',
    'contact_email','contact_instagram','contact_website','image_url','host',
    'dance_styles','venue_id'
  ];
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.account_is_active(auth.uid()) then
    raise exception 'account is not active' using errcode = '42501';
  end if;
  if p_organizer_id is null then
    raise exception 'organizer is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organizers
     where id = p_organizer_id
       and status = 'active'
  ) then
    raise exception 'organizer is not active' using errcode = '42501';
  end if;
  if not public.is_admin() and coalesce(public.organizer_member_role(p_organizer_id), '') not in ('owner', 'manager') then
    raise exception 'active owner or manager membership required' using errcode = '42501';
  end if;
  if p_payload is null or p_payload = '{}'::jsonb then
    raise exception 'event details are required' using errcode = '22023';
  end if;
  if nullif(btrim(p_payload ->> 'title'), '') is null then
    raise exception 'title must not be empty' using errcode = '22023';
  end if;

  select array_agg(k) into v_keys from jsonb_object_keys(p_payload) as k;
  select array_agg(k order by k) into v_bad
    from unnest(v_keys) as keys(k)
   where not (k = any(v_allowed));
  if v_bad is not null and cardinality(v_bad) > 0 then
    raise exception 'field not accepted for organizer creation: %', v_bad using errcode = '42501';
  end if;

  insert into public.events (
    title, description, event_type, city, event_date, event_time, location, address,
    price_type, price_amount, rsvp_link, recurrence, contact_email, contact_instagram,
    contact_website, image_url, host, dance_styles, venue_id, organizer_id,
    status, source_type, submitter_id, submitter_email, submitter_name
  ) values (
    p_payload ->> 'title', nullif(p_payload ->> 'description', ''),
    p_payload ->> 'event_type', p_payload ->> 'city',
    (p_payload ->> 'event_date')::timestamptz, nullif(p_payload ->> 'event_time', ''),
    nullif(p_payload ->> 'location', ''), nullif(p_payload ->> 'address', ''),
    nullif(p_payload ->> 'price_type', ''), nullif(p_payload ->> 'price_amount', '')::numeric,
    nullif(p_payload ->> 'rsvp_link', ''), nullif(p_payload ->> 'recurrence', ''),
    nullif(p_payload ->> 'contact_email', ''), nullif(p_payload ->> 'contact_instagram', ''),
    nullif(p_payload ->> 'contact_website', ''), nullif(p_payload ->> 'image_url', ''),
    nullif(p_payload ->> 'host', ''),
    coalesce(array(select value from jsonb_array_elements_text(coalesce(p_payload -> 'dance_styles', '[]'::jsonb))), '{}'),
    nullif(p_payload ->> 'venue_id', '')::uuid, p_organizer_id,
    case when p_publish then 'approved' else 'draft' end, 'organizer',
    auth.uid(), auth.jwt() ->> 'email', null
  ) returning id into v_event_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'event.organizer_created', 'event', v_event_id,
          jsonb_build_object('organizer_id', p_organizer_id, 'published', p_publish));
  return v_event_id;
end;
$$;

revoke execute on function public.organizer_create_event(uuid, jsonb, boolean) from public, anon;
grant execute on function public.organizer_create_event(uuid, jsonb, boolean) to authenticated;
notify pgrst, 'reload schema';

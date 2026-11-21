-- Artist-owned, single-date events and private guest RSVPs. No scheduler activation.
alter table public.events
  add column artist_id uuid references public.instructors(id),
  add column rsvp_enabled boolean not null default false,
  add column rsvp_closed boolean not null default false,
  add column rsvp_limit integer check (rsvp_limit > 0),
  add column rsvp_state_version bigint not null default 0,
  add column rsvp_schedule_version bigint not null default 0,
  add column publication_ack_by uuid references auth.users(id),
  add column publication_ack_version text,
  add column publication_ack_at timestamptz;
alter table public.events drop constraint events_source_type_check;
alter table public.events add constraint events_source_type_check
  check (source_type in ('admin','user_submission','organizer','moderator','imported','artist'));
alter table public.events add constraint events_artist_ownership_check check (
  (artist_id is null and source_type <> 'artist') or
  (artist_id is not null and source_type = 'artist' and organizer_id is null and series_id is null and recurrence is null)
);
create index events_artist_idx on public.events(artist_id,event_date) where artist_id is not null;

create table public.artist_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  name text not null check (name=btrim(name) and length(name) between 1 and 120),
  email text not null check (email=lower(btrim(email)) and length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  role text not null check (role in ('leader','follower','undecided')),
  placement text not null check (placement in ('main_list','waitlist')),
  contacted boolean not null default false,
  confirmed boolean not null default false check (not confirmed or placement='main_list'),
  version bigint not null default 1 check (version>0),
  contact_version bigint not null default 1,
  acceptance_version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,email)
);
create index artist_event_rsvps_placement_idx on public.artist_event_rsvps(event_id,placement,created_at);
create table public.artist_rsvp_notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  rsvp_id uuid references public.artist_event_rsvps(id) on delete set null,
  rsvp_identity uuid,
  artist_id uuid not null,
  kind text not null check (kind in ('main_receipt','waitlist_receipt','capacity_full','new_waitlist','acceptance','withdrawal','date_update')),
  action_version bigint not null default 0,
  contact_version bigint not null default 0,
  schedule_version bigint not null default 0,
  recipient_user_id uuid,
  recipient_email text not null,
  facts jsonb not null check (octet_length(facts::text)<=16384),
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','leased','sent','failed','suppressed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_id text,
  failure text check (failure is null or failure in ('transient','ambiguous','permanent','configuration','exhausted','superseded')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index artist_rsvp_notifications_due_idx on public.artist_rsvp_notifications(next_attempt_at)
  where status in ('pending','leased');
create index artist_rsvp_notifications_roster_idx on public.artist_rsvp_notifications(event_id,rsvp_identity,created_at desc);
create table public.artist_rsvp_abuse_counters (
  scope text not null check (scope in ('ip','email','event','site')),
  key text not null,
  window_start timestamptz not null,
  attempts integer not null check (attempts>0),
  expires_at timestamptz not null,
  primary key(scope,key,window_start)
);
create index artist_rsvp_abuse_expiry_idx on public.artist_rsvp_abuse_counters(expires_at);
alter table public.artist_event_rsvps enable row level security;
alter table public.artist_rsvp_notifications enable row level security;
alter table public.artist_rsvp_abuse_counters enable row level security;
revoke all on public.artist_event_rsvps,public.artist_rsvp_notifications,public.artist_rsvp_abuse_counters from public,anon,authenticated;
grant all on public.artist_event_rsvps,public.artist_rsvp_notifications,public.artist_rsvp_abuse_counters to service_role;

create function public.artist_event_require(p_artist_id uuid)
returns void language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.account_is_active(auth.uid()) or not exists (
    select 1 from public.entity_members m join public.instructors i on i.id=m.entity_id
    where m.entity_kind='instructor' and m.entity_id=p_artist_id and m.user_id=auth.uid()
      and m.status='active' and m.member_role in ('owner','manager') and i.status='active'
  ) then raise exception 'Artist owner or manager access required.' using errcode='42501'; end if;
end $$;
create function public.event_responsibility_require(p_ack jsonb)
returns void language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if jsonb_typeof(p_ack) is distinct from 'object' or
    p_ack is distinct from jsonb_build_object('admission_payments',true,'signup_counts',true,'guest_notices',true,'version','2026-11-14') then
    raise exception 'Complete all three current responsibility acknowledgements before publishing.' using errcode='22023';
  end if;
end $$;

-- Copy the composed canonical writer, not historical versions of its geography/flyer helpers.
create function pg_temp.artist_patch(p_src text,p_old text,p_new text)
returns text language plpgsql as $$
begin
  if p_old='' or (length(p_src)-length(replace(p_src,p_old,'')))/length(p_old)<>1 then
    raise exception 'Artist RSVP migration: canonical writer anchor drift: %',p_old;
  end if;
  return replace(p_src,p_old,p_new);
end $$;
do $copy$
declare v text; a integer; b integer;
begin
  v:=pg_get_functiondef('public.organizer_create_event(uuid,jsonb,boolean)'::regprocedure);
  v:=pg_temp.artist_patch(v,'public.organizer_create_event(', 'public.artist_event_create_canonical(');
  a:=strpos(v,'  if not exists ('); b:=strpos(v,'  insert into public.events (');
  if a=0 or b<=a then raise exception 'Artist canonical create authority anchor drift'; end if;
  v:=substring(v from 1 for a-1)||E'  perform public.artist_event_require(p_organizer_id);\n'||substring(v from b);
  v:=pg_temp.artist_patch(v,'submitter_id, organizer_id, entity_review','submitter_id, artist_id, entity_review');
  v:=replace(v,'''organizer''','''artist''');
  v:=replace(v,'''event.organizer_created''','''event.artist_created''');
  execute v;
  v:=pg_get_functiondef('public.organizer_update_event(uuid,jsonb)'::regprocedure);
  v:=pg_temp.artist_patch(v,'public.organizer_update_event(', 'public.artist_event_update_canonical(');
  -- Production's writer splits "update public.events e" and "set" across lines and
  -- already whitelists sublocation; accept either layout of the same composed writer.
  a:=strpos(v,'  if not public.is_admin() then'); b:=regexp_instr(v,' {2}update public\.events e\s+set');
  if a=0 or b<=a then raise exception 'Artist canonical update authority anchor drift'; end if;
  v:=substring(v from 1 for a-1)||E'  perform public.artist_event_require(v_event.artist_id);\n'||substring(v from b);
  if strpos(v,'any(v_allowed || array[''sublocation'',''neighborhood''])')>0 then
    v:=pg_temp.artist_patch(v,'any(v_allowed || array[''sublocation'',''neighborhood''])',
      'any(v_allowed || array[''sublocation'',''neighborhood'',''rsvp_enabled'',''rsvp_closed'',''rsvp_limit''])');
  else
    v:=pg_temp.artist_patch(v,'any(v_allowed || array[''neighborhood''])',
      'any(v_allowed || array[''neighborhood'',''rsvp_enabled'',''rsvp_closed'',''rsvp_limit''])');
  end if;
  if regexp_count(v,' {2}update public\.events e\s+set')<>1 then
    raise exception 'Artist RSVP migration: canonical writer anchor drift: update set';
  end if;
  v:=regexp_replace(v,' {2}update public\.events e\s+set',
    '  update public.events e set rsvp_enabled=case when p_payload?''rsvp_enabled'' then (p_payload->>''rsvp_enabled'')::boolean else e.rsvp_enabled end,'
    || ' rsvp_closed=case when p_payload?''rsvp_closed'' then (p_payload->>''rsvp_closed'')::boolean else e.rsvp_closed end,'
    || ' rsvp_limit=case when p_payload?''rsvp_limit'' then (p_payload->>''rsvp_limit'')::integer else e.rsvp_limit end,');
  v:=replace(v,'''event.organizer_updated''','''event.artist_updated''');
  execute v;
end $copy$;

create function public.artist_event_settings_validate(p_payload jsonb)
returns void language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if (p_payload?'rsvp_enabled' and jsonb_typeof(p_payload->'rsvp_enabled') is distinct from 'boolean')
    or (p_payload?'rsvp_closed' and jsonb_typeof(p_payload->'rsvp_closed') is distinct from 'boolean')
    or (p_payload?'rsvp_limit' and p_payload->'rsvp_limit'<>'null'::jsonb and
      (jsonb_typeof(p_payload->'rsvp_limit')<>'number' or (p_payload->>'rsvp_limit') !~ '^[1-9][0-9]{0,9}$')) then
    raise exception 'Use true/false settings and a positive whole signup limit.' using errcode='22023';
  end if;
  if p_payload?'rsvp_limit' and p_payload->'rsvp_limit'<>'null'::jsonb and (p_payload->>'rsvp_limit')::numeric>2147483647 then
    raise exception 'Signup limit is too large.' using errcode='22023';
  end if;
end $$;
create function public.artist_event_validate(p_event public.events)
returns void language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if p_event.artist_id is null or p_event.organizer_id is not null or p_event.series_id is not null or p_event.recurrence is not null then
    raise exception 'Artist events cover one date and cannot change ownership.' using errcode='22023';
  end if;
  if 'workshop'=any(p_event.event_types) and not p_event.rsvp_enabled then
    raise exception 'Workshop events require website RSVP collection.' using errcode='22023';
  end if;
  if p_event.rsvp_enabled and (p_event.price_type is null or p_event.price_type not in ('free','paid')) then
    raise exception 'Choose Free or Paid for website RSVPs.' using errcode='22023';
  end if;
  if p_event.rsvp_enabled and p_event.price_type='paid' and
    (p_event.rsvp_link is null or p_event.rsvp_link !~* '^https?://[^/@[:space:]:?#]+(:[0-9]+)?([/?#][^[:space:]]*)?$') then
    raise exception 'Paid RSVPs require an HTTP(S) artist URL without credentials.' using errcode='22023';
  end if;
  if p_event.rsvp_limit is not null and p_event.rsvp_limit < (select count(*) from public.artist_event_rsvps where event_id=p_event.id and placement='main_list') then
    raise exception 'Signup limit cannot be below the current main-list count.' using errcode='22023';
  end if;
  if not p_event.rsvp_enabled and exists(select 1 from public.artist_event_rsvps where event_id=p_event.id) then
    raise exception 'Close new signups instead of disabling collection after a signup.' using errcode='22023';
  end if;
end $$;
create function public.artist_event_get(p_artist_id uuid,p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare e public.events;
begin
  perform public.artist_event_require(p_artist_id);
  select * into e from public.events where id=p_event_id and artist_id=p_artist_id;
  if e.id is null then raise exception 'Artist event access denied.' using errcode='42501'; end if;
  return to_jsonb(e)||jsonb_build_object('venue_time_zone',(select timezone from public.venues where id=e.venue_id));
end $$;
create function public.artist_event_list(p_artist_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  perform public.artist_event_require(p_artist_id);
  return coalesce((select jsonb_agg(to_jsonb(e) order by e.event_date desc) from public.events e where e.artist_id=p_artist_id),'[]'::jsonb);
end $$;
create function public.artist_event_publish(p_event_id uuid,p_ack jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.events;
begin
  select * into e from public.events where id=p_event_id for update;
  perform public.artist_event_require(e.artist_id);
  if e.status is distinct from 'draft' then raise exception 'Only a draft can be published.' using errcode='55000'; end if;
  perform public.artist_event_validate(e);
  perform public.event_responsibility_require(p_ack);
  update public.events set status='approved',publication_ack_by=auth.uid(),publication_ack_version='2026-11-14',publication_ack_at=now() where id=e.id;
  insert into public.event_instructors(event_id,instructor_id,position) values(e.id,e.artist_id,0) on conflict do nothing;
end $$;
create function public.artist_event_update(p_event_id uuid,p_payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.events; canonical jsonb;
begin
  select * into e from public.events where id=p_event_id for update;
  perform public.artist_event_require(e.artist_id);
  if jsonb_typeof(p_payload) is distinct from 'object' or p_payload ?| array['artist_id','organizer_id','source_type','series_id','recurrence','status','publication_ack','publication_ack_by','publication_ack_at','publication_ack_version','submitter_id'] then
    raise exception 'These event fields cannot be changed.' using errcode='22023';
  end if;
  perform public.artist_event_settings_validate(p_payload);
  perform public.artist_event_update_canonical(e.id,p_payload);
  select * into e from public.events where id=e.id;
  perform public.artist_event_validate(e);
end $$;
create function public.artist_event_create(p_artist_id uuid,p_payload jsonb,p_publish boolean)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare eid uuid; canonical jsonb;
begin
  perform public.artist_event_require(p_artist_id);
  if jsonb_typeof(p_payload) is distinct from 'object' or p_payload ?| array['artist_id','organizer_id','source_type','series_id','recurrence','status','publication_ack_by','publication_ack_at','publication_ack_version','submitter_id'] then
    raise exception 'Artist ownership and publication identity are server-controlled.' using errcode='22023';
  end if;
  perform public.artist_event_settings_validate(p_payload);
  canonical:=p_payload-array['rsvp_enabled','rsvp_closed','rsvp_limit','publication_ack'];
  eid:=public.artist_event_create_canonical(p_artist_id,canonical,false);
  update public.events set rsvp_enabled=coalesce((p_payload->>'rsvp_enabled')::boolean,false),
    rsvp_closed=coalesce((p_payload->>'rsvp_closed')::boolean,false),
    rsvp_limit=(p_payload->>'rsvp_limit')::integer where id=eid;
  perform public.artist_event_validate((select e from public.events e where id=eid));
  if p_publish then perform public.artist_event_publish(eid,p_payload->'publication_ack'); end if;
  return eid;
end $$;

-- Organizer acknowledgement is a clean API cutover; retain the composed create implementation.
alter function public.organizer_create_event(uuid,jsonb,boolean) rename to organizer_create_event_canonical;
alter function public.organizer_publish_event(uuid) rename to organizer_publish_event_canonical;
create function public.organizer_publish_event(p_event_id uuid,p_ack jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.events;
begin
  select * into e from public.events where id=p_event_id for update;
  if auth.uid() is null or not public.account_is_active(auth.uid()) or e.organizer_id is null
    or not exists(select 1 from public.organizers where id=e.organizer_id and status='active')
    or not (public.is_admin() or coalesce(public.organizer_member_role(e.organizer_id) in ('owner','manager'),false)) then
    raise exception 'Organizer owner or manager access required.' using errcode='42501';
  end if;
  perform public.event_responsibility_require(p_ack);
  update public.events set publication_ack_by=auth.uid(),publication_ack_version='2026-11-14',publication_ack_at=now() where id=e.id;
  perform public.organizer_publish_event_canonical(e.id);
end $$;
create function public.organizer_create_event(p_organizer_id uuid,p_payload jsonb,p_publish boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare eid uuid;
begin
  if p_publish then perform public.event_responsibility_require(p_payload->'publication_ack'); end if;
  eid:=public.organizer_create_event_canonical(p_organizer_id,p_payload-'publication_ack',false);
  if p_publish then perform public.organizer_publish_event(eid,p_payload->'publication_ack'); end if;
  return eid;
end $$;

-- Server notice comparisons mirror shared/utils/timezone.ts; datetime conversion stays canonical.
create function public.artist_event_notice_zone(p_event public.events)
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(
    (select btrim(v.timezone) from public.venues v where v.id=p_event.venue_id
      and exists(select 1 from pg_timezone_names z where z.name=btrim(v.timezone))),
    case lower(btrim(p_event.city))
      when 'chicago' then 'America/Chicago' when 'texas' then 'America/Chicago'
      when 'los-angeles' then 'America/Los_Angeles' when 'san-francisco' then 'America/Los_Angeles'
      when 'london' then 'Europe/London' else 'America/New_York' end);
$$;
create function public.artist_rsvp_facts(p_event public.events)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('event_title',p_event.title,'event_date',p_event.event_date,
    'time_zone',public.artist_event_notice_zone(p_event),
    'artist_name',i.name,'artist_slug',i.slug,'event_slug',p_event.slug,
    'external_url',p_event.rsvp_link,'is_free',p_event.price_type='free','city',p_event.city)
  from public.instructors i where i.id=p_event.artist_id;
$$;
create function public.artist_rsvp_queue(p_event public.events,p_row public.artist_event_rsvps,p_kind text,p_action bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare recipient record; facts jsonb; k text;
begin
  facts:=public.artist_rsvp_facts(p_event)||jsonb_build_object('placement',p_row.placement);
  if p_kind in ('capacity_full','new_waitlist') then
    for recipient in select u.id,u.email from public.entity_members m join auth.users u on u.id=m.user_id
      where m.entity_kind='instructor' and m.entity_id=p_event.artist_id and m.member_role='owner'
        and m.status='active' and public.account_is_active(u.id) and u.email is not null
    loop
      k:=concat_ws(':','artist-rsvp',p_kind,p_event.id,coalesce(p_row.id::text,'event'),p_action,recipient.id);
      insert into public.artist_rsvp_notifications(event_id,rsvp_id,rsvp_identity,artist_id,kind,action_version,
        contact_version,schedule_version,recipient_user_id,recipient_email,facts,idempotency_key)
      values(p_event.id,p_row.id,p_row.id,p_event.artist_id,p_kind,p_action,coalesce(p_row.contact_version,0),
        p_event.rsvp_schedule_version,recipient.id,lower(btrim(recipient.email)),facts,k) on conflict(idempotency_key) do nothing;
    end loop;
  else
    k:=concat_ws(':','artist-rsvp',p_kind,p_event.id,p_row.id,p_action,p_row.contact_version);
    insert into public.artist_rsvp_notifications(event_id,rsvp_id,rsvp_identity,artist_id,kind,action_version,
      contact_version,schedule_version,recipient_email,facts,idempotency_key)
    values(p_event.id,p_row.id,p_row.id,p_event.artist_id,p_kind,p_action,p_row.contact_version,
      p_event.rsvp_schedule_version,p_row.email,facts,k) on conflict(idempotency_key) do nothing;
  end if;
end $$;
create function public.artist_rsvp_summary(p_event_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('event_id',e.id,'artist_id',i.id,'artist_name',i.name,'artist_slug',i.slug,
    'rsvp_enabled',e.rsvp_enabled,'rsvp_closed',e.rsvp_closed,'rsvp_limit',e.rsvp_limit,
    'main_list_count',(select count(*) from public.artist_event_rsvps where event_id=e.id and placement='main_list'),
    'available',e.rsvp_enabled and not e.rsvp_closed and e.event_date>now() and i.status='active',
    'waitlist',exists(select 1 from public.artist_event_rsvps where event_id=e.id and placement='waitlist')
      or e.rsvp_limit is not null and (select count(*) from public.artist_event_rsvps where event_id=e.id and placement='main_list')>=e.rsvp_limit)
  from public.events e join public.instructors i on i.id=e.artist_id
  where e.id=p_event_id and e.status='approved';
$$;
create function public.artist_rsvp_submit(p_event_id uuid,p_name text,p_email text,p_role text,p_ip_key text,p_email_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.events; r public.artist_event_rsvps; n bigint; w timestamptz; s text; k text; ceiling integer; used integer; limited boolean:=false;
begin
  if p_name is null or length(btrim(p_name)) not between 1 and 120 or p_email is null or length(btrim(p_email))>254
    or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_role is null or p_role not in ('leader','follower','undecided')
    or p_ip_key is null or p_ip_key !~ '^[0-9a-f]{64}$' or p_email_key is null or p_email_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Enter a valid name, email and dance role.' using errcode='22023';
  end if;
  w:=to_timestamp(floor(extract(epoch from now())/600)*600);
  delete from public.artist_rsvp_abuse_counters where expires_at<=now();
  -- Fixed order serializes shared counters without deadlocking different events.
  foreach s in array array['site','event','ip','email'] loop
    k:=case s when 'site' then 'site' when 'event' then p_event_id::text when 'ip' then p_ip_key else p_email_key end;
    ceiling:=case s when 'site' then 1000 when 'event' then 200 when 'ip' then 30 else 3 end;
    insert into public.artist_rsvp_abuse_counters(scope,key,window_start,attempts,expires_at)
      values(s,k,w,1,w+interval '24 hours')
      on conflict(scope,key,window_start) do update set attempts=least(public.artist_rsvp_abuse_counters.attempts+1,ceiling+1)
      returning attempts into used;
    limited:=limited or used>ceiling;
  end loop;
  if limited then return jsonb_build_object('status','rate_limited','retry_after',greatest(1,ceil(extract(epoch from w+interval '10 minutes'-now()))::integer)); end if;
  select * into e from public.events where id=p_event_id for update;
  if e.id is null or e.artist_id is null or e.status<>'approved' or not e.rsvp_enabled or e.rsvp_closed
    or e.event_date<=now() or not exists(select 1 from public.instructors where id=e.artist_id and status='active') then
    return jsonb_build_object('status','unavailable');
  end if;
  if exists(select 1 from public.artist_event_rsvps where event_id=e.id and email=lower(btrim(p_email))) then
    return jsonb_build_object('status','received','event_id',e.id,'external_url',e.rsvp_link);
  end if;
  select count(*) into n from public.artist_event_rsvps where event_id=e.id and placement='main_list';
  insert into public.artist_event_rsvps(event_id,name,email,role,placement)
  values(e.id,btrim(p_name),lower(btrim(p_email)),p_role,
    case when (e.rsvp_limit is null or n<e.rsvp_limit)
      and not exists(select 1 from public.artist_event_rsvps where event_id=e.id and placement='waitlist')
      then 'main_list' else 'waitlist' end) returning * into r;
  update public.events set rsvp_state_version=rsvp_state_version+1 where id=e.id returning * into e;
  perform public.artist_rsvp_queue(e,r,case r.placement when 'main_list' then 'main_receipt' else 'waitlist_receipt' end,1);
  if r.placement='waitlist' then perform public.artist_rsvp_queue(e,r,'new_waitlist',e.rsvp_state_version);
  elsif e.rsvp_limit is not null and n+1=e.rsvp_limit then
    perform public.artist_rsvp_queue(e,null::public.artist_event_rsvps,'capacity_full',e.rsvp_state_version);
  end if;
  return jsonb_build_object('status','received','event_id',e.id,'external_url',e.rsvp_link);
end $$;

create function public.artist_rsvp_list(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare e public.events; rows jsonb; totals jsonb;
begin
  select * into e from public.events where id=p_event_id;
  perform public.artist_event_require(e.artist_id);
  select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('delivery',
    (select jsonb_build_object('kind',n.kind,'status',n.status,'failure',n.failure) from public.artist_rsvp_notifications n
     where n.rsvp_identity=r.id order by n.created_at desc,n.id limit 1)) order by r.created_at,r.id),'[]'::jsonb)
    into rows from public.artist_event_rsvps r where r.event_id=e.id;
  select jsonb_build_object(
    'main_list',count(*) filter(where placement='main_list'),'waitlist',count(*) filter(where placement='waitlist'),
    'confirmed',count(*) filter(where confirmed),
    'roles',jsonb_build_object('leader',count(*) filter(where role='leader'),'follower',count(*) filter(where role='follower'),'undecided',count(*) filter(where role='undecided')),
    'confirmed_roles',jsonb_build_object('leader',count(*) filter(where role='leader' and confirmed),'follower',count(*) filter(where role='follower' and confirmed),'undecided',count(*) filter(where role='undecided' and confirmed)))
    into totals from public.artist_event_rsvps where event_id=e.id;
  return jsonb_build_object('event',to_jsonb(e),'rows',rows,'totals',totals);
end $$;
create function public.artist_rsvp_update(p_rsvp_id uuid,p_expected_version bigint,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.events; old_r public.artist_event_rsvps; r public.artist_event_rsvps; n bigint;
begin
  select * into e from public.events where id=(select event_id from public.artist_event_rsvps where id=p_rsvp_id) for update;
  perform public.artist_event_require(e.artist_id);
  select * into old_r from public.artist_event_rsvps where id=p_rsvp_id for update;
  if old_r.id is null then raise exception 'Artist roster access denied.' using errcode='42501'; end if;
  if p_expected_version is distinct from old_r.version then raise exception 'This signup changed. Refresh and review your edits.' using errcode='40001'; end if;
  if jsonb_typeof(p_changes) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_changes) k where k<>all(array['name','email','role','contacted','confirmed','promote'])) then
    raise exception 'Unsupported signup change.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(p_changes) item where
    (item.key in ('name','email','role') and jsonb_typeof(item.value)<>'string') or
    (item.key in ('contacted','confirmed') and jsonb_typeof(item.value)<>'boolean')) then
    raise exception 'Enter valid contact details and boolean marks.' using errcode='22023';
  end if;
  r:=jsonb_populate_record(old_r,p_changes-'promote');
  r.name:=btrim(r.name); r.email:=lower(btrim(r.email));
  if r.name is null or length(r.name) not between 1 and 120 or r.name ~ '[[:cntrl:]]'
    or r.email is null or length(r.email)>254 or r.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or r.role is null or r.role not in ('leader','follower','undecided') then
    raise exception 'Enter a valid name, email and dance role.' using errcode='22023';
  end if;
  if p_changes?'promote' and p_changes->'promote' is distinct from 'true'::jsonb then
    raise exception 'Promotion must be explicitly selected.' using errcode='22023';
  end if;
  if p_changes->'promote'='true'::jsonb then
    if old_r.placement<>'waitlist' then raise exception 'Only a waiting signup can be promoted.' using errcode='22023'; end if;
    select count(*) into n from public.artist_event_rsvps where event_id=e.id and placement='main_list';
    if e.rsvp_limit is not null and n>=e.rsvp_limit then raise exception 'No main-list space is available.' using errcode='55000'; end if;
    r.placement:='main_list';
  end if;
  if r.confirmed and (r.placement<>'main_list' or e.status in ('cancelled','archived')) then
    raise exception 'Only a current main-list guest can be confirmed.' using errcode='22023';
  end if;
  if exists(select 1 from public.artist_event_rsvps where event_id=e.id and email=r.email and id<>r.id) then
    raise exception 'Another signup already uses that email. Review the roster.' using errcode='23505';
  end if;
  r.contact_version:=old_r.contact_version+case when r.email is distinct from old_r.email then 1 else 0 end;
  r.acceptance_version:=old_r.acceptance_version+case when r.confirmed is distinct from old_r.confirmed then 1 else 0 end;
  update public.artist_event_rsvps set name=r.name,email=r.email,role=r.role,placement=r.placement,
    contacted=r.contacted,confirmed=r.confirmed,version=version+1,contact_version=r.contact_version,
    acceptance_version=r.acceptance_version,updated_at=now() where id=r.id returning * into r;
  if r.email is distinct from old_r.email then
    update public.artist_rsvp_notifications set status='suppressed',failure='superseded',completed_at=now(),lease_token=null,lease_expires_at=null
      where rsvp_identity=r.id and recipient_user_id is null and status in ('pending','leased');
  end if;
  if r.confirmed and (not old_r.confirmed or r.email is distinct from old_r.email) then
    perform public.artist_rsvp_queue(e,r,'acceptance',r.acceptance_version);
  elsif old_r.confirmed and not r.confirmed then
    perform public.artist_rsvp_queue(e,r,'withdrawal',r.acceptance_version);
  end if;
  update public.events set rsvp_state_version=rsvp_state_version+1 where id=e.id returning * into e;
  if old_r.placement='waitlist' and r.placement='main_list' and e.rsvp_limit is not null and n+1=e.rsvp_limit then
    perform public.artist_rsvp_queue(e,null::public.artist_event_rsvps,'capacity_full',e.rsvp_state_version);
  end if;
  return to_jsonb(r);
end $$;
create function public.artist_rsvp_remove(p_rsvp_id uuid,p_expected_version bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.events; r public.artist_event_rsvps;
begin
  select * into e from public.events where id=(select event_id from public.artist_event_rsvps where id=p_rsvp_id) for update;
  perform public.artist_event_require(e.artist_id);
  select * into r from public.artist_event_rsvps where id=p_rsvp_id for update;
  if r.id is null then raise exception 'Artist roster access denied.' using errcode='42501'; end if;
  if p_expected_version is distinct from r.version then raise exception 'This signup changed. Refresh and review your edits.' using errcode='40001'; end if;
  update public.artist_rsvp_notifications set status='suppressed',failure='superseded',completed_at=now(),lease_token=null,lease_expires_at=null
    where rsvp_identity=r.id and status in ('pending','leased');
  if r.confirmed then
    r.acceptance_version:=r.acceptance_version+1;
    perform public.artist_rsvp_queue(e,r,'withdrawal',r.acceptance_version);
  end if;
  delete from public.artist_event_rsvps where id=r.id;
  update public.events set rsvp_state_version=rsvp_state_version+1 where id=e.id;
end $$;

-- Canonical admin and artist date/cancellation writes share this transaction hook.
create function public.artist_event_notices()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.artist_event_rsvps; n bigint;
begin
  if new.artist_id is null then return new; end if;
  if new.event_date is distinct from old.event_date or
    public.artist_event_notice_zone(new) is distinct from public.artist_event_notice_zone(old) then
    update public.events set rsvp_schedule_version=rsvp_schedule_version+1 where id=new.id returning rsvp_schedule_version into new.rsvp_schedule_version;
    for r in select * from public.artist_event_rsvps where event_id=new.id order by id for update loop
      perform public.artist_rsvp_queue(new,r,'date_update',new.rsvp_schedule_version);
    end loop;
  end if;
  if new.status in ('cancelled','archived') and new.status is distinct from old.status then
    for r in update public.artist_event_rsvps set confirmed=false,acceptance_version=acceptance_version+1,version=version+1,updated_at=now()
      where event_id=new.id and confirmed returning * loop
      perform public.artist_rsvp_queue(new,r,'withdrawal',r.acceptance_version);
    end loop;
  end if;
  if new.rsvp_limit is distinct from old.rsvp_limit and new.rsvp_limit is not null then
    select count(*) into n from public.artist_event_rsvps where event_id=new.id and placement='main_list';
    if n=new.rsvp_limit and (old.rsvp_limit is null or n<old.rsvp_limit) then
      update public.events set rsvp_state_version=rsvp_state_version+1 where id=new.id returning rsvp_state_version into new.rsvp_state_version;
      perform public.artist_rsvp_queue(new,null::public.artist_event_rsvps,'capacity_full',new.rsvp_state_version);
    end if;
  end if;
  return new;
end $$;
create trigger artist_event_notices after update of event_date,venue_id,city,status,rsvp_limit on public.events
  for each row execute function public.artist_event_notices();

create function public.artist_event_guard()
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
    (new.publication_ack_version is distinct from '2026-11-14' or new.publication_ack_by is distinct from auth.uid() or new.publication_ack_at is distinct from now()) then
    raise exception 'Complete the current responsibility checklist before publishing.' using errcode='22023';
  end if;
  if new.artist_id is not null and new.status='approved' then perform public.artist_event_validate(new); end if;
  return new;
end $$;
create trigger artist_event_guard before insert or update or delete on public.events
  for each row execute function public.artist_event_guard();

create function public.artist_rsvp_notification_allowed(p_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare n public.artist_rsvp_notifications; r public.artist_event_rsvps; e public.events;
begin
  select * into n from public.artist_rsvp_notifications where id=p_id;
  if n.id is null then return false; end if;
  if n.recipient_user_id is not null then
    return public.account_is_active(n.recipient_user_id) and exists(
      select 1 from public.entity_members m join public.instructors i on i.id=m.entity_id
      join auth.users u on u.id=m.user_id
      where m.entity_kind='instructor' and m.entity_id=n.artist_id and m.user_id=n.recipient_user_id
        and m.member_role='owner' and m.status='active' and i.status='active' and lower(btrim(u.email))=n.recipient_email);
  end if;
  select * into r from public.artist_event_rsvps where id=n.rsvp_id;
  if r.id is null then return n.kind='withdrawal'; end if;
  if r.contact_version<>n.contact_version or r.email<>n.recipient_email then return false; end if;
  if n.kind in ('acceptance','withdrawal') then
    return r.acceptance_version=n.action_version and r.confirmed=(n.kind='acceptance');
  end if;
  if n.kind='date_update' then
    select * into e from public.events where id=n.event_id;
    return e.id is not null and e.rsvp_schedule_version=n.schedule_version;
  end if;
  return true;
end $$;
create function public.artist_rsvp_notifications_due(p_limit integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.artist_rsvp_notifications set status='failed',failure='exhausted',completed_at=now(),lease_token=null,lease_expires_at=null
    where status in ('pending','leased') and (status<>'leased' or lease_expires_at<=now())
      and (attempts>=5 or first_attempt_at+interval '23 hours'<=now());
  return coalesce((select jsonb_agg(id) from (
    select id from public.artist_rsvp_notifications where
      (status='pending' and next_attempt_at<=now() or status='leased' and lease_expires_at<=now())
      and attempts<5 and (first_attempt_at is null or first_attempt_at+interval '23 hours'>now())
      order by next_attempt_at,id limit least(greatest(coalesce(p_limit,20),0),20)) due),'[]'::jsonb);
end $$;
create function public.artist_rsvp_notification_claim(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n public.artist_rsvp_notifications;
begin
  select * into n from public.artist_rsvp_notifications where id=p_id for update skip locked;
  if n.id is null or not (n.status='pending' and n.next_attempt_at<=now() or n.status='leased' and n.lease_expires_at<=now())
    or n.attempts>=5 or n.first_attempt_at+interval '23 hours'<=now() then return null; end if;
  if not public.artist_rsvp_notification_allowed(n.id) then
    update public.artist_rsvp_notifications set status='suppressed',failure='superseded',completed_at=now(),lease_token=null,lease_expires_at=null where id=n.id;
    return null;
  end if;
  update public.artist_rsvp_notifications set status='leased',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),
    lease_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes' where id=n.id returning * into n;
  return jsonb_build_object('id',n.id,'token',n.lease_token,'kind',n.kind,'event_id',n.event_id,'rsvp_id',n.rsvp_id,
    'recipient_email',n.recipient_email,'recipient_user_id',n.recipient_user_id,'artist_id',n.artist_id,'facts',n.facts,'idempotency_key',n.idempotency_key);
end $$;
create function public.artist_rsvp_notification_finish(p_id uuid,p_token uuid,p_status text,p_provider_id text,p_failure text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n public.artist_rsvp_notifications; retry boolean;
begin
  if p_status is null or p_status not in ('sent','failed','suppressed') or
    (p_failure is not null and p_failure not in ('transient','ambiguous','permanent','configuration','exhausted','superseded')) then
    raise exception 'Unsupported delivery outcome.' using errcode='22023';
  end if;
  select * into n from public.artist_rsvp_notifications where id=p_id for update;
  if n.id is null or n.status<>'leased' or n.lease_token is distinct from p_token or n.lease_expires_at<=now() then return false; end if;
  if p_status='sent' and nullif(btrim(p_provider_id),'') is null then raise exception 'Provider message identity required.' using errcode='22023'; end if;
  retry:=p_status='failed' and p_failure in ('transient','ambiguous') and n.attempts<5 and now()+interval '15 minutes'<n.first_attempt_at+interval '23 hours';
  update public.artist_rsvp_notifications set status=case when retry then 'pending' else p_status end,
    failure=p_failure,provider_id=left(p_provider_id,200),next_attempt_at=case when retry then now()+interval '15 minutes' else next_attempt_at end,
    completed_at=case when retry then null else now() end,lease_token=null,lease_expires_at=null where id=n.id;
  return true;
end $$;

create or replace view public.public_events as
select
 event.id,event.title,event.description,event.event_type,event.event_date,event.event_time,event.location,event.address,
 event.price_type,event.price_amount,case when event.artist_id is not null and event.rsvp_enabled then null::text else event.rsvp_link end as rsvp_link,
 event.image_url,event.poster_image_url,event.status,event.source_type,
 event.city,event.host,event.recurrence,event.gallery,event.dance_styles,event.venue_id,event.organizer_id,
 event.created_at,event.updated_at,coalesce(taxonomy.terms,'[]'::jsonb) as event_taxonomy_terms,
 event.slug,event.series_id,public.public_event_entities(event.id) as public_entities,
 event.event_types,event.image_urls,event.sublocation,event.neighborhood,event.featured_at,
 event.artist_id,event.rsvp_enabled,event.rsvp_closed,event.rsvp_limit
from public.events event
left join lateral (
 select jsonb_agg(jsonb_build_object('taxonomy_term_id',term.id,'taxonomy_terms',jsonb_build_object(
  'id',term.id,'name',term.name,'slug',term.slug,'category',term.category,'status',term.status
 )) order by term.category,term.name) as terms
 from public.event_taxonomy_terms link join public.taxonomy_terms term on term.id=link.taxonomy_term_id
 where link.event_id=event.id and term.status='active'
) taxonomy on true where event.status='approved';
alter view public.public_events set (security_invoker=false);
revoke all on public.public_events from public;
grant select on public.public_events to anon,authenticated;

-- Supabase default EXECUTE grants must not expose internal canonical writers.
do $grants$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'artist_%' or p.proname in ('event_responsibility_require','organizer_create_event_canonical','organizer_publish_event_canonical','organizer_create_event','organizer_publish_event'))
  loop execute format('revoke all on function %s from public,anon,authenticated',f.signature); end loop;
end $grants$;
grant execute on function public.artist_event_list(uuid),public.artist_event_get(uuid,uuid),
  public.artist_event_create(uuid,jsonb,boolean),public.artist_event_update(uuid,jsonb),public.artist_event_publish(uuid,jsonb),
  public.artist_rsvp_list(uuid),public.artist_rsvp_update(uuid,bigint,jsonb),public.artist_rsvp_remove(uuid,bigint),
  public.organizer_create_event(uuid,jsonb,boolean),public.organizer_publish_event(uuid,jsonb) to authenticated;
grant execute on function public.artist_rsvp_summary(uuid) to anon,authenticated;
grant execute on function public.artist_rsvp_submit(uuid,text,text,text,text,text),
  public.artist_rsvp_notifications_due(integer),public.artist_rsvp_notification_claim(uuid),
  public.artist_rsvp_notification_allowed(uuid),public.artist_rsvp_notification_finish(uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';

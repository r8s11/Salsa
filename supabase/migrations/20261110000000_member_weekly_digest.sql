-- No scheduler activation or email sending occurs in this migration.
-- UTC ISO weeks; one fenced lease per member/week. Stored provider payloads
-- are immutable. Ambiguous sends can retry only inside Resend's 24h TTL.
begin;
create table public.member_email_tokens (
  token uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  used_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create unique index member_email_one_active_token on public.member_email_tokens(profile_id) where used_at is null;
create index member_email_tokens_profile on public.member_email_tokens(profile_id);
create table public.member_digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  status text not null check(status in ('claimed','sent','failed','suppressed')),
  claim_token uuid not null,
  lease_until timestamptz not null,
  unsubscribe_token uuid not null references public.member_email_tokens(token),
  message jsonb,
  send_started_at timestamptz,
  error text,
  created_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  unique(profile_id,week_start)
);
alter table public.member_email_tokens enable row level security;
alter table public.member_digest_deliveries enable row level security;
revoke all on public.member_email_tokens,public.member_digest_deliveries from public,anon,authenticated;

-- Private service view centralizes eligibility for due, claim and pre-send checks.
-- Exact JSON boolean consent (not the JSON string "true").
create view public.member_digest_recipients as
select p.id as profile_id,u.email,p.city,m.name as metro_name
from public.profiles p join auth.users u on u.id=p.id
join public.public_active_metros m on m.slug=p.city
where p.notification_prefs->'weekly_digest'='true'::jsonb
  and p.status='active' and p.onboarding_completed_at is not null
  and u.email_confirmed_at is not null and u.deleted_at is null
  and not coalesce(u.is_anonymous,false)
  and (u.banned_until is null or u.banned_until<=clock_timestamp())
  and u.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
revoke all on public.member_digest_recipients from public,anon,authenticated;
grant select on public.member_digest_recipients to service_role;

create function public.member_digest_due(p_now timestamptz, p_after uuid default null)
returns uuid[] language sql security definer set search_path=public as $$
  select coalesce(array_agg(profile_id order by profile_id),'{}'::uuid[]) from (
    select r.profile_id from member_digest_recipients r
    left join member_digest_deliveries d on d.profile_id=r.profile_id
      and d.week_start=date_trunc('week',p_now at time zone 'UTC')::date
    where (p_after is null or r.profile_id>p_after)
      and (d.id is null or d.status='failed' or (d.status='claimed' and d.lease_until<clock_timestamp()))
    order by r.profile_id limit 51
  ) candidates
$$;

create function public.member_digest_claim(p_profile_id uuid,p_week_start date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; d member_digest_deliveries; unsubscribe uuid; stamp timestamptz:=clock_timestamp();
begin
  if p_week_start is distinct from date_trunc('week',stamp at time zone 'UTC')::date then return null; end if;
  -- Serialize claims and unsubscribe for this profile; unique key also fences
  -- parallel callers, including a first-claim race with no ledger row yet.
  perform 1 from profiles where id=p_profile_id for update;
  select * into r from member_digest_recipients where profile_id=p_profile_id;
  if not found then return null; end if;
  select * into d from member_digest_deliveries where profile_id=p_profile_id and week_start=p_week_start for update;
  if found then
    if d.status in ('sent','suppressed') or (d.status='claimed' and d.lease_until>=stamp) then return null; end if;
    if (d.send_started_at is not null and stamp>=d.send_started_at+interval '23 hours')
       or exists(select 1 from member_email_tokens where token=d.unsubscribe_token and used_at is not null) then
      update member_digest_deliveries set status='suppressed',error='retry_window_or_consent_expired',finished_at=stamp where id=d.id;
      return null;
    end if;
    unsubscribe:=d.unsubscribe_token;
  else
    insert into member_email_tokens(profile_id) values(p_profile_id)
      on conflict(profile_id) where used_at is null do nothing;
    select token into unsubscribe from member_email_tokens where profile_id=p_profile_id and used_at is null;
  end if;
  insert into member_digest_deliveries(profile_id,week_start,status,claim_token,lease_until,unsubscribe_token)
    values(p_profile_id,p_week_start,'claimed',gen_random_uuid(),stamp+interval '5 minutes',unsubscribe)
  on conflict(profile_id,week_start) do update set status='claimed',claim_token=excluded.claim_token,
    lease_until=excluded.lease_until,error=null,finished_at=null
  returning * into d;
  return jsonb_build_object('token',d.claim_token,'email',r.email,'city',r.city,'metro_name',r.metro_name,
    'unsubscribe_token',unsubscribe,'from',d.created_at,'to',d.created_at+interval '7 days',
    'message',d.message,'idempotency_key','digest:'||p_profile_id||':'||p_week_start);
end $$;

create function public.member_digest_allowed(p_profile_id uuid,p_week_start date,p_token uuid)
returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from member_digest_deliveries d
    join member_digest_recipients r on r.profile_id=d.profile_id
    join member_email_tokens t on t.token=d.unsubscribe_token and t.used_at is null
    where d.profile_id=p_profile_id and d.week_start=p_week_start and d.claim_token=p_token
      and d.status='claimed' and d.lease_until>clock_timestamp()
      and (d.send_started_at is null or d.send_started_at>clock_timestamp()-interval '23 hours')
      and (d.message is null or d.message->>'to'=r.email))
$$;

create function public.member_digest_prepare(p_profile_id uuid,p_week_start date,p_token uuid,p_message jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not member_digest_allowed(p_profile_id,p_week_start,p_token) then return null; end if;
  if jsonb_typeof(p_message) is distinct from 'object' or not exists(
    select 1 from member_digest_recipients where profile_id=p_profile_id and email=p_message->>'to'
  ) then return null; end if;
  update member_digest_deliveries set message=coalesce(message,p_message),send_started_at=coalesce(send_started_at,clock_timestamp())
    where profile_id=p_profile_id and week_start=p_week_start and claim_token=p_token and status='claimed'
      and lease_until>clock_timestamp() returning message into result;
  return result;
end $$;

create function public.member_digest_finish(p_profile_id uuid,p_week_start date,p_token uuid,p_status text,p_error text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_status not in ('sent','failed','suppressed') or p_status is null then raise exception 'Invalid digest outcome' using errcode='22023'; end if;
  update member_digest_deliveries set status=p_status,error=left(p_error,100),finished_at=clock_timestamp()
    where profile_id=p_profile_id and week_start=p_week_start and claim_token=p_token
      and status='claimed' and lease_until>clock_timestamp();
  return found;
end $$;

-- Consumed tokens remain tombstones: scanner-safe repeated POST is successful
-- but never revokes a later opt-in. The next eligible weekly claim mints a new token.
create function public.member_email_unsubscribe(p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare target uuid; consumed timestamptz;
begin
  select profile_id,used_at into target,consumed from member_email_tokens where token=p_token;
  if not found then return false; end if;
  if consumed is not null then return true; end if;
  perform 1 from profiles where id=target for update;
  select used_at into consumed from member_email_tokens where token=p_token for update;
  if consumed is null then
    update profiles set notification_prefs=notification_prefs||'{"weekly_digest":false}'::jsonb where id=target;
    update member_email_tokens set used_at=clock_timestamp() where token=p_token;
  end if;
  return true;
end $$;

-- public_events does not carry timezone. Read only its approved public rows;
-- venue timezone is the sole persisted zone input. The worker reuses the UI's
-- timeZoneForDisplay helper (venue -> canonical metro -> Eastern fallback).
create function public.member_digest_events(p_city text,p_from timestamptz,p_to timestamptz)
returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(payload order by starts,id),'[]'::jsonb) from (
   select e.id,e.event_date as starts,jsonb_build_object('title',e.title,'startsAt',e.event_date,
     'venueTimeZone',v.timezone,'city',e.city,'venueName',coalesce(v.name,e.location),
     'path','/events/'||coalesce(nullif(e.slug,''),e.id::text)) as payload
   from public_events e left join venues v on v.id=e.venue_id
   where e.city=p_city and e.event_date>=p_from and e.event_date<p_to
   order by e.event_date,e.id limit 12
 ) events
$$;

revoke all on function public.member_digest_due(timestamptz,uuid),public.member_digest_claim(uuid,date),
  public.member_digest_allowed(uuid,date,uuid),public.member_digest_prepare(uuid,date,uuid,jsonb),
  public.member_digest_finish(uuid,date,uuid,text,text),public.member_digest_events(text,timestamptz,timestamptz),
  public.member_email_unsubscribe(uuid) from public,anon,authenticated;
grant execute on function public.member_digest_due(timestamptz,uuid),public.member_digest_claim(uuid,date),
  public.member_digest_allowed(uuid,date,uuid),public.member_digest_prepare(uuid,date,uuid,jsonb),
  public.member_digest_finish(uuid,date,uuid,text,text),public.member_digest_events(text,timestamptz,timestamptz),
  public.member_email_unsubscribe(uuid) to service_role;
grant execute on function public.member_email_unsubscribe(uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;

-- No scheduler activation or email sending occurs in this migration.
create table public.admin_analytics_preferences (
 admin_id uuid primary key references auth.users(id) on delete cascade,
 frequency text not null default 'disabled' check(frequency in ('disabled','daily','weekly')),
 email_enabled boolean not null default false,
 submission_backlog boolean not null default true, metro_inventory boolean not null default true,
 event_data_quality boolean not null default true, analytics_data_health boolean not null default true,
 enabled_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.admin_analytics_alerts (
 condition_key text primary key, category text not null check(category in ('submission_backlog','critical_metro_inventory','limited_metro_inventory','event_data_quality','analytics_data_health')),
 entity_id uuid, priority text not null check(priority in ('critical','warning','informational')),
 title text not null, destination text not null check(destination like '/admin/%'),
 state text not null check(state in ('active','resolved')), lifecycle integer not null default 1,
 detected_at timestamptz not null, last_seen_at timestamptz not null, resolved_at timestamptz,
 email_eligible boolean not null default false
);
create table public.admin_analytics_report_runs (
 id uuid primary key default gen_random_uuid(), frequency text not null check(frequency in ('daily','weekly')),
 period_from timestamptz not null, period_to timestamptz not null, due_at timestamptz not null,
 generated_at timestamptz not null, status text not null check(status in ('success','error')),
 summary jsonb, error_code text, unique(frequency,period_from,period_to), check(period_from<period_to)
);
create table public.admin_analytics_notification_deliveries (
 id uuid primary key default gen_random_uuid(), admin_id uuid not null references auth.users(id) on delete cascade,
 notification_key text not null, kind text not null check(kind in ('report','alert')),
 category text, payload jsonb not null, status text not null default 'pending' check(status in ('pending','sending','sent','failed','suppressed')),
 created_at timestamptz not null default now(), first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),
 lease_until timestamptz, token uuid, attempts integer not null default 0, error_code text,
 unique(admin_id,notification_key)
);
create index admin_analytics_delivery_due on public.admin_analytics_notification_deliveries(next_attempt_at) where status in ('pending','failed','sending');
create table public.admin_analytics_monitor_state (
 singleton boolean primary key default true check(singleton), evaluated_at timestamptz,
 sources jsonb not null default '{}'
);
insert into public.admin_analytics_monitor_state(singleton) values(true);
-- Raw tables remain inaccessible to clients; narrow RPCs provide bounded projections.
alter table public.admin_analytics_preferences enable row level security;
alter table public.admin_analytics_alerts enable row level security;
alter table public.admin_analytics_report_runs enable row level security;
alter table public.admin_analytics_notification_deliveries enable row level security;
alter table public.admin_analytics_monitor_state enable row level security;
revoke all on public.admin_analytics_preferences,public.admin_analytics_alerts,public.admin_analytics_report_runs,public.admin_analytics_notification_deliveries,public.admin_analytics_monitor_state from public,anon,authenticated;

create function public.admin_analytics_require_admin() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin'
  or not exists(select 1 from auth.users where id=auth.uid() and raw_app_meta_data->>'role'='admin' and deleted_at is null and (banned_until is null or banned_until<now())) then
  raise exception 'admin role required' using errcode='42501';
 end if;
end $$;
create function public.admin_analytics_require_worker() returns void language plpgsql stable set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'trusted scheduler required' using errcode='42501'; end if;
end $$;
create function public.admin_analytics_save_preferences(p_frequency text,p_email boolean,p_backlog boolean,p_metros boolean,p_quality boolean,p_health boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.admin_analytics_preferences;
begin
 perform public.admin_analytics_require_admin();
 if p_frequency is null or p_frequency not in ('disabled','daily','weekly') or p_email is null or p_backlog is null or p_metros is null or p_quality is null or p_health is null then
  raise exception 'invalid notification preferences' using errcode='22023';
 end if;
 insert into public.admin_analytics_preferences(admin_id,frequency,email_enabled,submission_backlog,metro_inventory,event_data_quality,analytics_data_health)
 values(auth.uid(),p_frequency,p_email,p_backlog,p_metros,p_quality,p_health)
 on conflict(admin_id) do update set frequency=excluded.frequency,email_enabled=excluded.email_enabled,
 submission_backlog=excluded.submission_backlog,metro_inventory=excluded.metro_inventory,event_data_quality=excluded.event_data_quality,analytics_data_health=excluded.analytics_data_health,
 enabled_at=case when admin_analytics_preferences.frequency<>excluded.frequency then now() else admin_analytics_preferences.enabled_at end, updated_at=now()
 returning * into r;
 return to_jsonb(r)-'admin_id';
end $$;
-- Calendar days, not 24-hour intervals. Returns the latest completed due window.
create function public.analytics_report_period(p_frequency text,p_now timestamptz)
returns jsonb language plpgsql immutable set search_path='' as $$
declare d date; due timestamptz; days integer; f timestamptz; t timestamptz; prev timestamptz;
begin
 if p_frequency not in ('daily','weekly') or p_frequency is null or p_now is null then raise exception 'invalid report schedule' using errcode='22023'; end if;
 d:=(p_now at time zone 'America/New_York')::date; days:=case p_frequency when 'daily' then 1 else 7 end;
 if p_frequency='weekly' then d:=d-(extract(isodow from d)::int-1); end if;
 due:=(d+time '09:00') at time zone 'America/New_York';
 if due>p_now then d:=d-days; due:=(d+time '09:00') at time zone 'America/New_York'; end if;
 t:=d::timestamp at time zone 'America/New_York'; f:=(d-days)::timestamp at time zone 'America/New_York'; prev:=(d-days*2)::timestamp at time zone 'America/New_York';
 return jsonb_build_object('from',f,'to',t,'previous_from',prev,'due',due);
end $$;
-- Called only inside the serialized worker transaction. One row per condition, lifecycle increments on reactivation.
create function public.admin_analytics_reconcile(p_key text,p_category text,p_entity uuid,p_priority text,p_title text,p_destination text,p_present boolean,p_now timestamptz,p_baseline boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_present then
  insert into public.admin_analytics_alerts(condition_key,category,entity_id,priority,title,destination,state,detected_at,last_seen_at,email_eligible)
  values(p_key,p_category,p_entity,p_priority,p_title,p_destination,'active',p_now,p_now,not p_baseline)
  on conflict(condition_key) do update set priority=excluded.priority,title=excluded.title,last_seen_at=p_now,state='active',resolved_at=null,
   lifecycle=admin_analytics_alerts.lifecycle+case when admin_analytics_alerts.state='resolved' then 1 else 0 end,
   detected_at=case when admin_analytics_alerts.state='resolved' then p_now else admin_analytics_alerts.detected_at end,
   email_eligible=admin_analytics_alerts.email_eligible or admin_analytics_alerts.state='resolved'
    or (not p_baseline and admin_analytics_alerts.priority<>'critical' and excluded.priority='critical');
 else
  update public.admin_analytics_alerts set state='resolved',resolved_at=p_now where condition_key=p_key and state='active';
 end if;
end $$;
-- A source is healthy only when its actual aggregation contract is valid. Zero is valid.
create function public.admin_analytics_source_health(p_source text,p_ok boolean,p_now timestamptz,p_baseline boolean)
returns void language plpgsql security definer set search_path='' as $$
declare failures int;
begin
 select case when p_ok then 0 else coalesce((sources#>>array[p_source,'failures'])::int,0)+1 end into failures from public.admin_analytics_monitor_state where singleton;
 update public.admin_analytics_monitor_state set sources=jsonb_set(sources,array[p_source],jsonb_build_object('status',case when p_ok then 'success' else 'error' end,'failures',failures,'checked_at',p_now)) where singleton;
 perform public.admin_analytics_reconcile('health:'||p_source,'analytics_data_health',null,'warning','Analytics source needs attention: '||p_source,'/admin/analytics',failures>=3,p_now,p_baseline);
end $$;
create function public.admin_analytics_valid_counts(p_source jsonb,p_keys text[]) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p_source)='object' and not exists(
  select 1 from unnest(p_keys) k where not coalesce(jsonb_typeof(p_source->k)='number'
   and case when p_source->>k ~ '^[0-9]+$' then (p_source->>k)::numeric<=9007199254740991 else false end,false)
 ),false);
$$;
create function public.admin_analytics_evaluate(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path='' as $$
declare claims text; admin uuid; o jsonb; metrics jsonb; prev jsonb; engagement jsonb; previous_engagement jsonb; period jsonb; snapshot jsonb;
 key text; row jsonb; v_frequency text; f timestamptz; t timestamptz; pf timestamptz; due timestamptz;
 baseline boolean; ok boolean; report_ok boolean; last_seen text[];
begin
 perform public.admin_analytics_require_worker();
 if p_now is null then raise exception 'invalid evaluation instant' using errcode='22023'; end if;
 if not pg_try_advisory_xact_lock(681606) then return jsonb_build_object('status','busy'); end if;
 select evaluated_at is null into baseline from public.admin_analytics_monitor_state where singleton for update;
 select id into admin from auth.users where raw_app_meta_data->>'role'='admin' and deleted_at is null and (banned_until is null or banned_until<now()) order by id limit 1;
 if admin is null then return jsonb_build_object('status','no_administrators'); end if;
 -- Reuse existing admin-only definitions without granting client execution of this worker.
 claims:=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'app_metadata',jsonb_build_object('role','admin'))::text,true);
 begin o:=public.admin_analytics_operations(null,null,0,0,0,0,10000); exception when others then o:='{}'; end;
 ok:=public.admin_analytics_valid_counts(o->'submissions',array['pending','over_48','over_7d']);
 perform public.admin_analytics_source_health('submissions',coalesce(ok,false),p_now,baseline);
 if ok then
  perform public.admin_analytics_reconcile('backlog:48h','submission_backlog',null,case when (o#>>'{submissions,over_7d}')::bigint>0 then 'critical' else 'warning' end,
   (o#>>'{submissions,over_48}')||' submissions waiting over 48 hours','/admin/submissions',(o#>>'{submissions,over_48}')::bigint>0,p_now,baseline);
 end if;
 begin
  ok:=public.admin_analytics_valid_counts(o->'metros',array['total','active','low_inventory']) and jsonb_typeof(o#>'{metros,rows}')='array'
   and (o#>>'{metros,total}')::bigint=jsonb_array_length(o#>'{metros,rows}') and public.admin_analytics_valid_counts(o->'thresholds',array['healthy_inventory'])
   and not exists(select 1 from jsonb_array_elements(o#>'{metros,rows}') m where not public.admin_analytics_valid_counts(m,array['upcoming_events'])
    or coalesce(m->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or coalesce(jsonb_typeof(m->'name'),'null')<>'string' or coalesce(m->>'activity','') not in ('previously_active','newly_emerging','currently_active'));
 exception when others then ok:=false; end;
 perform public.admin_analytics_source_health('metros',coalesce(ok,false),p_now,baseline);
 if ok then
  last_seen:=array[]::text[];
  for row in select value from jsonb_array_elements(o#>'{metros,rows}') loop
   key:='metro:empty:'||(row->>'id'); last_seen:=array_append(last_seen,key);
   perform public.admin_analytics_reconcile(key,'critical_metro_inventory',(row->>'id')::uuid,'critical',(row->>'name')||' has no upcoming approved events','/admin/events',row->>'activity'='previously_active' and (row->>'upcoming_events')::bigint=0,p_now,baseline);
   key:='metro:limited:'||(row->>'id'); last_seen:=array_append(last_seen,key);
   perform public.admin_analytics_reconcile(key,'limited_metro_inventory',(row->>'id')::uuid,'warning',(row->>'name')||' has '||(row->>'upcoming_events')||' upcoming approved events (minimum '||(o#>>'{thresholds,healthy_inventory}')||')','/admin/events',
    (row->>'upcoming_events')::bigint>0 and (row->>'upcoming_events')::bigint<(o#>>'{thresholds,healthy_inventory}')::bigint,p_now,baseline);
  end loop;
  update public.admin_analytics_alerts set state='resolved',resolved_at=p_now where category in ('critical_metro_inventory','limited_metro_inventory') and state='active' and not(condition_key=any(last_seen));
 end if;
 ok:=public.admin_analytics_valid_counts(o->'quality',array['critical_events','affected_events']);
 perform public.admin_analytics_source_health('quality',coalesce(ok,false),p_now,baseline);
 if ok then
  -- Aggregate condition avoids historical per-event floods; exact Phase5 critical definition.
  perform public.admin_analytics_reconcile('quality:required','event_data_quality',null,'critical',(o#>>'{quality,critical_events}')||' upcoming events have invalid required data','/admin/events',(o#>>'{quality,critical_events}')::bigint>0,p_now,baseline);
 end if;
 perform public.admin_analytics_source_health('activity',public.admin_analytics_valid_counts(o->'activity',array['events','accounts','submissions','organizers','venues']),p_now,baseline);
 begin metrics:=public.admin_analytics_metrics(null,null); exception when others then metrics:='{}'; end;
 perform public.admin_analytics_source_health('overview',public.admin_analytics_valid_counts(metrics,array['upcoming_events']),p_now,baseline);
 perform public.admin_analytics_source_health('email',not exists(select 1 from public.admin_analytics_notification_deliveries where status='failed' or (status='suppressed' and error_code='retry_window_exhausted')),p_now,baseline);
 report_ok:=true;
 foreach v_frequency in array array['daily','weekly'] loop
  period:=public.analytics_report_period(v_frequency,p_now); f:=(period->>'from')::timestamptz; t:=(period->>'to')::timestamptz; pf:=(period->>'previous_from')::timestamptz; due:=(period->>'due')::timestamptz;
  if not exists(select 1 from public.admin_analytics_preferences p join auth.users u on u.id=p.admin_id where p.frequency=v_frequency and p.enabled_at<=due and u.raw_app_meta_data->>'role'='admin' and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())) then continue; end if;
  if exists(select 1 from public.admin_analytics_report_runs rr where rr.frequency=v_frequency and rr.period_from=f and rr.period_to=t and rr.status='success') then continue; end if;
  begin
   o:=public.admin_analytics_operations(f,t,0,0,0,0,10000);
   prev:=public.admin_analytics_operations(pf,f,0,0,0,0,1);
   metrics:=public.admin_analytics_metrics(f,t);
   if not public.admin_analytics_valid_counts(o->'activity',array['events','accounts','submissions','organizers','venues'])
    or not public.admin_analytics_valid_counts(o->'submissions',array['pending','over_48'])
    or not public.admin_analytics_valid_counts(o->'metros',array['active','low_inventory'])
    or not public.admin_analytics_valid_counts(o->'quality',array['affected_events','critical_events'])
    or not public.admin_analytics_valid_counts(metrics,array['upcoming_events']) then raise exception 'required analytics unavailable'; end if;
   engagement:=null; previous_engagement:=null;
   if o->>'first_recorded_at' is not null and t>(o->>'first_recorded_at')::timestamptz then
    begin
     engagement:=public.admin_event_engagement(f,t,'detail_views');
     if not public.admin_analytics_valid_counts(engagement->'summary',array['detail_views','rsvp_clicks','ticket_clicks']) or coalesce(jsonb_typeof(engagement->'events'),'null')<>'array' then engagement:=null; end if;
    exception when others then engagement:=null; end;
   end if;
   if engagement is not null and pf>=(o->>'first_recorded_at')::timestamptz then
    begin
     previous_engagement:=public.admin_event_engagement(pf,f,'detail_views')->'summary';
     if not public.admin_analytics_valid_counts(previous_engagement,array['detail_views','rsvp_clicks','ticket_clicks']) then previous_engagement:=null; end if;
    exception when others then previous_engagement:=null; end;
   end if;
   snapshot:=jsonb_build_object('activity',o->'activity','previous_activity',prev->'activity','operational',jsonb_build_object('pending',o#>'{submissions,pending}','over_48',o#>'{submissions,over_48}',
    'upcoming_events',metrics->'upcoming_events','active_metros',o#>'{metros,active}','low_inventory',o#>'{metros,low_inventory}','quality_events',o#>'{quality,affected_events}','critical_quality',o#>'{quality,critical_events}'),
    'engagement',case when engagement is null then null else jsonb_build_object('summary',engagement->'summary','top_events',(select coalesce(jsonb_agg(x),'[]') from (select value as x from jsonb_array_elements(engagement->'events') limit 5) a),'first_recorded_at',o->'first_recorded_at') end,
    'previous_engagement',previous_engagement,'approval_activity',null,'timezone','America/New_York');
   insert into public.admin_analytics_report_runs(frequency,period_from,period_to,due_at,generated_at,status,summary)
   values(v_frequency,f,t,due,p_now,'success',snapshot)
   on conflict(frequency,period_from,period_to) do update set status='success',summary=excluded.summary,error_code=null,generated_at=excluded.generated_at;
  exception when others then
   report_ok:=false;
   insert into public.admin_analytics_report_runs(frequency,period_from,period_to,due_at,generated_at,status,error_code)
   values(v_frequency,f,t,due,p_now,'error','aggregation_unavailable')
   on conflict(frequency,period_from,period_to) do update set status='error',summary=null,error_code='aggregation_unavailable',generated_at=p_now;
  end;
 end loop;
 perform public.admin_analytics_source_health('reports',report_ok,p_now,baseline);
 update public.admin_analytics_monitor_state set evaluated_at=p_now where singleton;
 -- Retry generation and queue insertion use stable run/lifecycle identity. Opt-in defaults remain off.
 insert into public.admin_analytics_notification_deliveries(admin_id,notification_key,kind,payload)
 select p.admin_id,'report:'||rr.id,'report',jsonb_build_object('frequency',rr.frequency,'from',rr.period_from,'to',rr.period_to,'generated_at',rr.generated_at,'summary',rr.summary)
 from public.admin_analytics_report_runs rr join public.admin_analytics_preferences p on p.frequency=rr.frequency join auth.users u on u.id=p.admin_id
 where rr.status='success' and rr.due_at>=p.enabled_at and rr.due_at>p_now-interval '8 days' and p.email_enabled and u.raw_app_meta_data->>'role'='admin' and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())
 on conflict(admin_id,notification_key) do nothing;
 insert into public.admin_analytics_notification_deliveries(admin_id,notification_key,kind,category,payload)
 select p.admin_id,'alert:'||a.condition_key||':'||a.lifecycle,'alert',a.category,jsonb_build_object('title',a.title,'destination',a.destination,'detected_at',a.detected_at)
 from public.admin_analytics_alerts a cross join public.admin_analytics_preferences p join auth.users u on u.id=p.admin_id
 where a.state='active' and a.priority='critical' and a.email_eligible and a.last_seen_at=p_now and p.email_enabled and u.raw_app_meta_data->>'role'='admin' and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())
 and case a.category when 'submission_backlog' then p.submission_backlog when 'event_data_quality' then p.event_data_quality when 'analytics_data_health' then p.analytics_data_health else p.metro_inventory end
 on conflict(admin_id,notification_key) do nothing;
 perform set_config('request.jwt.claims',coalesce(claims,''),true);
 return jsonb_build_object('status',case when report_ok then 'success' else 'error' end,'evaluated_at',p_now);
end $$;

-- Bounded private read surface; stale state is derived independently of scheduler liveness.
create function public.admin_analytics_monitoring() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare preferences jsonb; alerts jsonb; reports jsonb; health jsonb;
begin
 perform public.admin_analytics_require_admin();
 select to_jsonb(p)-'admin_id' into preferences from public.admin_analytics_preferences p where admin_id=auth.uid();
 preferences:=coalesce(preferences,jsonb_build_object('frequency','disabled','email_enabled',false,'submission_backlog',true,'metro_inventory',true,'event_data_quality',true,'analytics_data_health',true));
 select coalesce(jsonb_agg(x order by x->>'state',case x->>'priority' when 'critical' then 0 when 'warning' then 1 else 2 end,x->>'detected_at' desc),'[]') into alerts from (
  select to_jsonb(a)-'email_eligible' as x from public.admin_analytics_alerts a
  where case a.category when 'submission_backlog' then (preferences->>'submission_backlog')::boolean when 'event_data_quality' then (preferences->>'event_data_quality')::boolean when 'analytics_data_health' then (preferences->>'analytics_data_health')::boolean else (preferences->>'metro_inventory')::boolean end
  order by state,case priority when 'critical' then 0 when 'warning' then 1 else 2 end,detected_at desc limit 100
 ) a;
 select coalesce(jsonb_agg(to_jsonb(r) order by generated_at desc),'[]') into reports from (select * from public.admin_analytics_report_runs order by generated_at desc limit 20) r;
 select jsonb_build_object('status',case when evaluated_at is null then 'unavailable' when evaluated_at<now()-interval '45 minutes' then 'stale'
  when exists(select 1 from jsonb_each(sources) s where s.value->>'status'='error') then 'error' else 'success' end,'evaluated_at',evaluated_at,'sources',sources) into health from public.admin_analytics_monitor_state where singleton;
 return jsonb_build_object('preferences',preferences,'alerts',alerts,'reports',reports,'health',health,'alert_limit',100,'report_limit',20);
end $$;
create function public.admin_analytics_delivery_allowed(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_analytics_notification_deliveries d join public.admin_analytics_preferences p on p.admin_id=d.admin_id join auth.users u on u.id=d.admin_id
 where d.id=p_id and p.email_enabled and u.raw_app_meta_data->>'role'='admin' and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())
 and case when d.kind='report' then p.frequency=d.payload->>'frequency' and p.enabled_at<=(select due_at from public.admin_analytics_report_runs where 'report:'||id=d.notification_key)
 else case d.category when 'submission_backlog' then p.submission_backlog when 'event_data_quality' then p.event_data_quality when 'analytics_data_health' then p.analytics_data_health else p.metro_inventory end
 and exists(select 1 from public.admin_analytics_alerts a where 'alert:'||a.condition_key||':'||a.lifecycle=d.notification_key and a.state='active') end);
$$;
create function public.admin_analytics_due_deliveries() returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 perform public.admin_analytics_require_worker();
 select coalesce(jsonb_agg(id),'[]') into r from (select id from public.admin_analytics_notification_deliveries where status in ('pending','failed','sending') and next_attempt_at<=now() and (lease_until is null or lease_until<now()) order by created_at limit 50) d;
 return r;
end $$;
create function public.admin_analytics_claim_delivery(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.admin_analytics_notification_deliveries;
begin
 perform public.admin_analytics_require_worker();
 select * into d from public.admin_analytics_notification_deliveries where id=p_id for update;
 if not found or d.status not in ('pending','failed','sending') or d.next_attempt_at>now() or d.lease_until>now() then return null; end if;
 -- Resend retains idempotency for 24h. Stop ambiguous retries at 23h, never mint a new key.
 if not public.admin_analytics_delivery_allowed(p_id) or d.attempts>=5 or d.first_attempt_at<now()-interval '23 hours' then
  update public.admin_analytics_notification_deliveries set status='suppressed',error_code=case when not public.admin_analytics_delivery_allowed(p_id) then 'authorization_changed' else 'retry_window_exhausted' end where id=p_id; return null;
 end if;
 update public.admin_analytics_notification_deliveries set status='sending',token=gen_random_uuid(),lease_until=now()+interval '5 minutes',first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where id=p_id returning * into d;
 return jsonb_build_object('admin_id',d.admin_id,'token',d.token,'payload',d.payload,'kind',d.kind,'idempotency_key',d.id);
end $$;
create function public.admin_analytics_finish_delivery(p_id uuid,p_token uuid,p_status text,p_error text) returns boolean language plpgsql security definer set search_path='' as $$
declare updated int;
begin
 perform public.admin_analytics_require_worker();
 if p_status not in ('sent','failed','suppressed') or p_status is null then raise exception 'invalid delivery status' using errcode='22023'; end if;
 update public.admin_analytics_notification_deliveries set status=p_status,error_code=case when p_status='failed' then case when p_error in ('network_error','provider_error','rate_limited','invalid_recipient','invalid_sender') then p_error else 'provider_error' end when p_status='suppressed' then 'authorization_changed' else null end,
 lease_until=null,next_attempt_at=now()+interval '15 minutes' where id=p_id and token=p_token and status='sending';
 get diagnostics updated=row_count;
 return updated>0;
end $$;
-- All helpers are private, including definer functions accepting condition values.
revoke all on function public.admin_analytics_require_admin(),public.admin_analytics_require_worker(),public.analytics_report_period(text,timestamptz),public.admin_analytics_reconcile(text,text,uuid,text,text,text,boolean,timestamptz,boolean),public.admin_analytics_source_health(text,boolean,timestamptz,boolean),public.admin_analytics_delivery_allowed(uuid) from public,anon,authenticated;
revoke all on function public.admin_analytics_valid_counts(jsonb,text[]) from public,anon,authenticated;
revoke all on function public.admin_analytics_save_preferences(text,boolean,boolean,boolean,boolean,boolean),public.admin_analytics_monitoring() from public,anon;
grant execute on function public.admin_analytics_save_preferences(text,boolean,boolean,boolean,boolean,boolean),public.admin_analytics_monitoring() to authenticated;
revoke all on function public.admin_analytics_evaluate(timestamptz),public.admin_analytics_due_deliveries(),public.admin_analytics_claim_delivery(uuid),public.admin_analytics_finish_delivery(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_analytics_evaluate(timestamptz),public.admin_analytics_due_deliveries(),public.admin_analytics_claim_delivery(uuid),public.admin_analytics_finish_delivery(uuid,uuid,text,text),public.admin_analytics_delivery_allowed(uuid) to service_role;
notify pgrst,'reload schema';

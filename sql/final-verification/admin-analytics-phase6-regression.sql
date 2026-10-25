-- Run only on a disposable local schema clone. All fixtures and changes roll back.
\set ON_ERROR_STOP on
begin;
select public.analytics_report_period('daily','2026-03-09 13:00:00+00');
set local session_replication_role=replica;
insert into auth.users(id,email,created_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000006001','phase6-admin@example.com','2026-03-08 05:00+00','{"role":"admin"}','{}'),
 ('00000000-0000-4000-8000-000000006002','phase6-other@example.com',now(),' {"role":"admin"}','{}');
insert into public.metros(slug,name,status) values ('p6-past','Past metro','active'),('p6-low','Limited metro','active'),('p6-never','Never metro','active');
insert into public.events(id,title,event_date,status,city,created_at) values
 ('00000000-0000-4000-8000-000000006101','Past',now()-interval '10 days','approved','p6-past','2026-03-08 05:00+00'),
 ('00000000-0000-4000-8000-000000006102','',now()+interval '10 days','approved','p6-low','2026-03-09 04:00+00');
insert into public.event_submissions(status,submitted_at,submitted_data) values ('pending',now()-interval '3 days','{}'),('needs_information',now()-interval '9 days','{}');
insert into public.event_touches(event_id,kind,touched_at) values
 ('00000000-0000-4000-8000-000000006101','view','2026-03-01 05:00+00'),
 ('00000000-0000-4000-8000-000000006101','view','2026-03-07 05:00+00'),
 ('00000000-0000-4000-8000-000000006101','view','2026-03-08 05:00+00'),
 ('00000000-0000-4000-8000-000000006101','view','2026-03-08 06:00+00'),
 ('00000000-0000-4000-8000-000000006101','rsvp_click','2026-03-09 04:00+00');
set local session_replication_role=origin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000006001","app_metadata":{"role":"admin"}}',true);
do $$
declare p jsonb; r jsonb; role_name text; token uuid; delivery uuid; old_lifecycle int; saved_definition text;
begin
 p:=public.analytics_report_period('daily','2026-03-09 13:00+00');
 assert p->>'from'='2026-03-08T05:00:00+00:00' and p->>'to'='2026-03-09T04:00:00+00:00', 'spring DST calendar day';
 p:=public.analytics_report_period('daily','2026-11-02 14:00+00');
 assert (p->>'to')::timestamptz-(p->>'from')::timestamptz=interval '25 hours','fall DST day';
 p:=public.analytics_report_period('weekly','2026-03-09 13:00+00');
 assert (p->>'from')::timestamptz='2026-03-02 05:00+00' and (p->>'to')::timestamptz='2026-03-09 04:00+00','Monday weekly boundaries';
 p:=public.analytics_report_period('daily','2026-03-09 12:59+00');
 assert (p->>'due')::timestamptz='2026-03-08 13:00+00','never generate before nine Eastern';
 r:=public.admin_analytics_monitoring();
 assert r#>>'{preferences,frequency}'='disabled' and r#>>'{preferences,email_enabled}'='false','explicit subscription required';
 perform public.admin_analytics_save_preferences('daily',true,true,true,true,true);
 assert (select count(*) from public.admin_analytics_preferences)=1,'self-only preference insert';
 foreach role_name in array array['user','host','organizer','moderator',''] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000006001','app_metadata',jsonb_build_object('role',role_name))::text,true);
  begin perform public.admin_analytics_monitoring(); raise exception 'unauthorized report access'; exception when insufficient_privilege then null; end;
  begin perform public.admin_analytics_save_preferences('weekly',true,true,true,true,true); raise exception 'unauthorized preference change'; exception when insufficient_privilege then null; end;
 end loop;
 perform set_config('request.jwt.claims','{}',true);
 begin perform public.admin_analytics_monitoring(); raise exception 'anonymous access'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000006002","app_metadata":{"role":"admin"}}',true);
 perform public.admin_analytics_save_preferences('weekly',false,true,true,true,true);
 assert (select frequency from public.admin_analytics_preferences where admin_id='00000000-0000-4000-8000-000000006001')='daily','other admin cannot overwrite preference';
 -- Enable before controlled report periods; production uses server timestamps only.
 update public.admin_analytics_preferences set enabled_at='2026-03-01';
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.admin_analytics_evaluate('2026-03-09 13:00+00');
 assert (select count(*) from public.admin_analytics_report_runs where status='success')=2,'daily and weekly reports';
 assert (select (summary#>>'{activity,events}')::int from public.admin_analytics_report_runs where frequency='daily')=1,'start inclusive end exclusive event creation';
 assert (select (summary#>>'{activity,accounts}')::int from public.admin_analytics_report_runs where frequency='daily')=1,'Auth registrations not profiles';
 assert (select (summary#>>'{engagement,summary,detail_views}')::int from public.admin_analytics_report_runs where frequency='daily')=2,'real recorded views inside exact DST period';
 assert (select (summary#>>'{engagement,summary,rsvp_clicks}')::int from public.admin_analytics_report_runs where frequency='daily')=0,'click at exclusive end excluded';
 assert (select (summary#>>'{previous_engagement,detail_views}')::int from public.admin_analytics_report_runs where frequency='daily')=1,'equivalent previous recorded period';
 assert (select count(*) from public.admin_analytics_alerts where state='active' and category='submission_backlog')=1,'overdue moderation only';
 assert (select count(*) from public.admin_analytics_alerts where state='active' and category='critical_metro_inventory')=1,'previously active empty metro only';
 assert (select count(*) from public.admin_analytics_alerts where state='active' and category='limited_metro_inventory')=1,'configured Phase5 minimum inventory';
 assert (select count(*) from public.admin_analytics_alerts where state='active' and category='event_data_quality')=1,'critical required data only';
 assert (select count(*) from public.admin_analytics_notification_deliveries where kind='alert')=0,'baseline avoids historical email flood';
 perform public.admin_analytics_evaluate('2026-03-09 13:15+00');
 assert (select count(*) from public.admin_analytics_report_runs)=2,'repeat report identity';
 assert (select count(*) from public.admin_analytics_alerts)=4,'repeat alert identity';
 assert (select count(*) from public.admin_analytics_notification_deliveries where kind='report')=1,'only opted-in daily administrator queued';
 select id into delivery from public.admin_analytics_notification_deliveries limit 1;
 r:=public.admin_analytics_claim_delivery(delivery);
 token:=(r->>'token')::uuid;
 assert token is not null and r->>'admin_id'='00000000-0000-4000-8000-000000006001','trusted recipient identity';
 assert public.admin_analytics_claim_delivery(delivery) is null,'exclusive claim lease';
 assert not public.admin_analytics_finish_delivery(delivery,gen_random_uuid(),'sent',null),'wrong lease token cannot complete another sender';
 perform public.admin_analytics_finish_delivery(delivery,token,'failed','network_error');
 assert public.admin_analytics_claim_delivery(delivery) is null,'retry backoff';
 update public.admin_analytics_notification_deliveries set next_attempt_at=now()-interval '1 minute';
 r:=public.admin_analytics_claim_delivery(delivery);
 assert r->>'idempotency_key'=delivery::text,'stable provider retry identity';
 perform public.admin_analytics_finish_delivery(delivery,(r->>'token')::uuid,'sent',null);
 assert public.admin_analytics_claim_delivery(delivery) is null,'sent never reclaims';
 -- Escalating an existing warning is a newly critical condition, even after baseline suppression.
 update public.event_submissions set submitted_at=now()-interval '8 days' where status='pending';
 perform public.admin_analytics_evaluate('2026-03-09 13:20+00');
 assert (select count(*) from public.admin_analytics_notification_deliveries where kind='alert')=1,'warning escalation notifies critical once';
 -- Resolve and reoccur without creating another condition row.
 update public.event_submissions set status='approved' where status='pending';
 update public.events set title='Fixed' where id='00000000-0000-4000-8000-000000006102';
 perform public.admin_analytics_evaluate('2026-03-09 13:30+00');
 assert (select state from public.admin_analytics_alerts where category='submission_backlog')='resolved','underlying condition resolution';
 select lifecycle into old_lifecycle from public.admin_analytics_alerts where category='submission_backlog';
 update public.event_submissions set status='pending' where status='approved';
 perform public.admin_analytics_evaluate('2026-03-09 13:45+00');
 assert (select lifecycle from public.admin_analytics_alerts where category='submission_backlog')=old_lifecycle+1,'reactivation lifecycle';
 assert (select count(*) from public.admin_analytics_notification_deliveries where kind='alert')=2,'critical reoccurrence notifies once';
 perform public.admin_analytics_evaluate('2026-03-09 14:00+00');
 assert (select count(*) from public.admin_analytics_notification_deliveries where kind='alert')=2,'unchanged condition cooldown is lifecycle-long';
 -- Source failure must preserve active alerts and invalidate incomplete reports.
 alter table public.event_submissions rename to p6_unavailable;
 perform public.admin_analytics_evaluate('2026-03-10 13:00+00');
 perform public.admin_analytics_evaluate('2026-03-10 13:15+00');
 perform public.admin_analytics_evaluate('2026-03-10 13:30+00');
 assert (select state from public.admin_analytics_alerts where category='submission_backlog')='active','failed query does not resolve';
 assert exists(select 1 from public.admin_analytics_alerts where category='analytics_data_health' and state='active'),'repeated failure alert';
 assert exists(select 1 from public.admin_analytics_report_runs where status='error'),'incomplete report never successful';
 alter table public.p6_unavailable rename to event_submissions;
 perform public.admin_analytics_evaluate('2026-03-10 13:45+00');
 assert not exists(select 1 from public.admin_analytics_alerts where category='analytics_data_health' and state='active'),'health recovery';
 perform public.admin_analytics_evaluate('2026-03-11 13:00+00');
 assert (select (summary#>>'{activity,events}')::int from public.admin_analytics_report_runs where frequency='daily' and period_to='2026-03-11 04:00+00')=0,'empty period is a real zero, not an outage';
 -- A malformed RPC payload must not be mistaken for successful empty sources.
 select pg_get_functiondef('public.admin_analytics_operations(timestamptz,timestamptz,integer,integer,integer,integer,integer,integer,numeric,integer,integer)'::regprocedure) into saved_definition;
 execute $definition$create or replace function public.admin_analytics_operations(from_date timestamptz default null,to_date timestamptz default null,metro_offset integer default 0,organizer_offset integer default 0,quality_offset integer default 0,engagement_offset integer default 0,page_size integer default 25,minimum_views integer default 25,maximum_ratio numeric default 5,healthy_inventory integer default 5,limited_inventory integer default 2) returns jsonb language sql as $body$ select '{}'::jsonb $body$ $definition$;
 perform public.admin_analytics_evaluate('2026-03-12 13:00+00');
 assert exists(select 1 from public.admin_analytics_report_runs where period_to='2026-03-12 04:00+00' and status='error'),'malformed required report never successful';
 assert (select sources#>>'{activity,status}' from public.admin_analytics_monitor_state)='error','malformed activity monitored without subscription dependence';
 execute saved_definition;
 -- Bound retries inside the provider idempotency window; opt-out wins at send time.
 select id into delivery from public.admin_analytics_notification_deliveries where kind='alert' and status='pending' and public.admin_analytics_delivery_allowed(id) limit 1;
 assert delivery is not null,'reoccurring condition has an eligible delivery';
 update public.admin_analytics_preferences set email_enabled=false where admin_id='00000000-0000-4000-8000-000000006001';
 assert not public.admin_analytics_delivery_allowed(delivery),'explicit opt-out immediately blocks queued delivery';
 update public.admin_analytics_preferences set email_enabled=true where admin_id='00000000-0000-4000-8000-000000006001';
 update public.admin_analytics_notification_deliveries set attempts=5 where id=delivery;
 assert public.admin_analytics_claim_delivery(delivery) is null,'maximum attempts never sends again';
 assert (select error_code from public.admin_analytics_notification_deliveries where id=delivery)='retry_window_exhausted','exhaustion stays diagnostic';
 update public.admin_analytics_notification_deliveries set status='failed',attempts=1,first_attempt_at=now()-interval '24 hours',next_attempt_at=now()-interval '1 minute' where id=delivery;
 assert public.admin_analytics_claim_delivery(delivery) is null,'expired provider idempotency window never sends again';
 -- Restore a pending fixture to exercise revoked authority independently of retry exhaustion.
 update public.admin_analytics_notification_deliveries set status='pending',attempts=0,first_attempt_at=null where id=delivery;
 -- Revoke authority even while JWT still claims administrator.
 update auth.users set raw_app_meta_data='{"role":"user"}' where id='00000000-0000-4000-8000-000000006001';
 select id into delivery from public.admin_analytics_notification_deliveries where status='pending' limit 1;
 if delivery is not null then assert public.admin_analytics_claim_delivery(delivery) is null,'revoked recipient never claims'; end if;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000006001","app_metadata":{"role":"admin"}}',true);
 begin perform public.admin_analytics_monitoring(); raise exception 'revoked JWT access'; exception when insufficient_privilege then null; end;
 assert not has_function_privilege('authenticated','public.admin_analytics_evaluate(timestamptz)','execute'),'scheduler unavailable to client';
 assert not has_table_privilege('anon','public.admin_analytics_report_runs','select'),'anonymous table denied';
 assert not has_table_privilege('authenticated','public.admin_analytics_notification_deliveries','select'),'private outbox denied';
end $$;
rollback;

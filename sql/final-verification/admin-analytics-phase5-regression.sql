-- ONLY on an empty disposable local schema clone. Fixtures roll back.
begin;
set local session_replication_role=replica;
insert into auth.users(id,email,created_at,raw_app_meta_data,raw_user_meta_data) values ('00000000-0000-4000-8000-000000005999','phase5-clone@example.com',now(),'{"role":"admin"}','{}');
insert into public.metros(slug,name,status) values ('p5-active','Same City','active'),('p5-past','Same City','active'),('p5-never','Never active','active');
insert into public.organizers(id,name,status) values ('00000000-0000-4000-8000-000000005001','Active','active'),('00000000-0000-4000-8000-000000005002','Past','active'),('00000000-0000-4000-8000-000000005003','Empty','active');
insert into public.events(id,title,event_date,status,city,organizer_id,dance_styles,image_url) values
 ('00000000-0000-4000-8000-000000005101','Upcoming',date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York','approved','p5-active','00000000-0000-4000-8000-000000005001',array['Salsa'],'https://example.com/flyer.jpg'),
 ('00000000-0000-4000-8000-000000005102','Past',now()-interval '10 days','approved','p5-past','00000000-0000-4000-8000-000000005002',array['Salsa'],null),
 ('00000000-0000-4000-8000-000000005103','Incomplete',now()+interval '3 days','approved',null,null,array[null,' '],'javascript:bad'),
 ('00000000-0000-4000-8000-000000005104','Draft',now()+interval '3 days','pending','p5-never',null,array[]::text[],null);
insert into public.event_submissions(status,submitted_at,submitted_data) values
 ('pending',statement_timestamp()-interval '12 hours','{}'),('in_review',statement_timestamp()-interval '36 hours','{}'),
 ('pending',statement_timestamp()-interval '72 hours','{}'),('pending',statement_timestamp()-interval '8 days','{}'),
 ('approved',now()-interval '10 days','{}'),('needs_information',now()-interval '10 days','{}'),('rejected',now()-interval '10 days','{}');
insert into public.event_touches(event_id,kind,touched_at) select '00000000-0000-4000-8000-000000005101','view',now() from generate_series(1,25);
insert into public.event_touches(event_id,kind,touched_at) values ('00000000-0000-4000-8000-000000005101','rsvp_click',now()),('00000000-0000-4000-8000-000000005101','share',now());
set local session_replication_role=origin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005999","app_metadata":{"role":"admin"}}',true);
do $$
declare r jsonb; x jsonb; role_name text; report text;
begin
 r:=public.admin_analytics_operations();
 assert (r#>>'{submissions,pending}')::int=4, 'pending and in_review only';
 assert (r#>>'{submissions,over_24}')::int=3 and (r#>>'{submissions,over_48}')::int=2 and (r#>>'{submissions,over_7d}')::int=1, 'cumulative backlogs';
 assert abs((r#>>'{submissions,average_hours}')::numeric-78)<0.1 and abs((r#>>'{submissions,oldest_hours}')::numeric-192)<0.1, 'real waiting time';
 assert (r#>>'{metros,total}')::int=2, 'never active metro excluded';
 assert exists(select 1 from jsonb_array_elements(r#>'{metros,rows}') m where m->>'slug'='p5-past' and m->>'activity'='previously_active' and m->>'health'='none'), 'past history not fabricated';
 assert exists(select 1 from jsonb_array_elements(r#>'{metros,rows}') m where m->>'slug'='p5-active' and m->>'health'='critical' and (m->>'events_7d')::int=1), 'today Eastern inventory';
 assert (r#>>'{organizers,active}')::int=1 and (r#>>'{organizers,no_upcoming}')::int=2 and (r#>>'{organizers,no_history}')::int=1 and (r#>>'{organizers,past_only}')::int=1, 'canonical organizer classifications';
 assert (r#>>'{quality,counts,missing_flyer}')::int=1 and (r#>>'{quality,counts,missing_metro}')::int=1 and (r#>>'{quality,counts,missing_taxonomy}')::int=1, 'usable flyers and taxonomy';
 assert (r#>>'{quality,counts,missing_venue}')::int=2, 'upcoming only quality';
 assert exists(select 1 from jsonb_array_elements(r#>'{quality,rows}') issue where issue->>'key'='missing_venue' and issue->>'severity'='informational'), 'optional association never critical';
 update public.events set title='',poster_image_url='https://example.com?flyer=1' where id='00000000-0000-4000-8000-000000005103';
 r:=public.admin_analytics_operations();
 assert (r#>>'{quality,critical_events}')::int=1 and (r#>>'{quality,counts,invalid_required}')::int=1, 'blank required title critical';
 assert (r#>>'{quality,counts,missing_flyer}')::int=0, 'valid root HTTP image endpoint is not missing';
 update public.events set title='Incomplete',poster_image_url=null where id='00000000-0000-4000-8000-000000005103';
 assert (r#>>'{opportunities,total}')::int=1 and (r#>>'{opportunities,rows,0,ratio}')::numeric=4, 'minimum views and raw click ratio';
 r:=public.admin_analytics_operations(null,null,0,0,0,0,25,26);
 assert (r#>>'{opportunities,total}')::int=0, 'configurable observation threshold';
 delete from public.event_touches where id in (select id from public.event_touches where kind='view' order by id limit 5);
 r:=public.admin_analytics_operations(null,null,0,0,0,0,25,20,5);
 assert (r#>>'{opportunities,total}')::int=0, 'ratio exactly five percent is not below screening threshold';
 insert into public.event_touches(event_id,kind,touched_at) select '00000000-0000-4000-8000-000000005101','view',now() from generate_series(1,5);
 insert into public.event_touches(event_id,kind,touched_at) select '00000000-0000-4000-8000-000000005101','ticket_click',now() from generate_series(1,30);
 x:=public.admin_analytics_report('events');
 assert (x#>>'{rows,0,8}')::numeric=124, 'RSVP plus ticket ratio is uncapped and not verified conversion';
 delete from public.event_touches where kind='ticket_click';
 r:=public.admin_analytics_operations(now()-interval '1 year',now()-interval '200 days');
 assert r->'opportunities'='null'::jsonb and (r#>>'{metros,total}')::int=2, 'history unavailable, current inventory independent';
 foreach report in array array['overview','events','organizers','venues','metros','quality','submissions'] loop
  x:=public.admin_analytics_report(report);
  assert jsonb_typeof(x->'rows')='array' and (x->>'total')::int>=jsonb_array_length(x->'rows'), 'authorized report with total';
 end loop;
 x:=public.admin_analytics_report('quality');
 assert x::text not like '%submitter_email%' and x::text not like '%submitted_data%' and x::text not like '%app_metadata%', 'private fields excluded';
 begin perform public.admin_analytics_operations(now(),null); raise exception 'invalid dates accepted'; exception when sqlstate '22023' then null; end;
 foreach role_name in array array['user','host','organizer','moderator',''] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000005999','app_metadata',jsonb_build_object('role',role_name))::text,true);
  begin perform public.admin_analytics_operations(); raise exception 'unauthorized operations'; exception when insufficient_privilege then null; end;
  begin perform public.admin_analytics_report('overview'); raise exception 'unauthorized export'; exception when insufficient_privilege then null; end;
 end loop;
 perform set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
 begin perform public.admin_analytics_operations(); raise exception 'anonymous subject'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000005999","app_metadata":{"role":"admin"}}',true);
 alter table public.event_touches rename to p5_unavailable;
 r:=public.admin_analytics_operations();
 assert r->'opportunities'='null'::jsonb and (r#>>'{submissions,pending}')::int=4, 'independent missing tracking';
 x:=public.admin_analytics_report('organizers');
 assert (x->>'total')::int=3 and x#>'{rows,0,7}'='null'::jsonb, 'inventory report survives missing engagement without false zero';
 alter table public.p5_unavailable rename to event_touches;
 alter table public.event_submissions rename to p5_unavailable;
 r:=public.admin_analytics_operations();
 assert r->'submissions'='null'::jsonb and (r#>>'{metros,total}')::int=2, 'failed query never zero';
 alter table public.p5_unavailable rename to event_submissions;
 -- Inclusive/exclusive boundaries use the same statement instant as the stable RPC.
 update public.event_submissions set submitted_at=statement_timestamp()-interval '24 hours' where status='in_review';
 r:=public.admin_analytics_operations();
 assert (r#>>'{submissions,over_24}')::int=2 and (r#>>'{submissions,under_24}')::int=2, 'exact 24h boundary';
 update public.event_submissions set submitted_at=statement_timestamp()-interval '48 hours' where status='in_review';
 r:=public.admin_analytics_operations();
 assert (r#>>'{submissions,over_48}')::int=2 and (r#>>'{submissions,hours_24_48}')::int=1, 'exact 48h boundary';
 update public.event_submissions set submitted_at=statement_timestamp()-interval '7 days' where status='in_review';
 r:=public.admin_analytics_operations();
 assert (r#>>'{submissions,over_7d}')::int=1, 'exact seven day boundary';
 x:=public.admin_analytics_report('overview',statement_timestamp()-interval '1 day',statement_timestamp());
 assert (select (row->>1)::int from jsonb_array_elements(x->'rows') row where row->>0='Activity: submissions')=1, 'submission cohort includes recent timestamp, excludes old backlog';
 update public.event_touches set touched_at='2026-03-08 05:00:00+00' where kind='view';
 update public.event_touches set touched_at='2026-03-09 04:00:00+00' where kind='rsvp_click';
 update public.event_touches set touched_at='2026-03-08 04:59:59+00' where kind='share';
 x:=public.admin_analytics_report('events','2026-03-08 05:00:00+00','2026-03-09 04:00:00+00','detail_views');
 assert (x#>>'{rows,0,4}')::int=25 and (x#>>'{rows,0,5}')::int=0 and (x#>>'{rows,0,7}')::int=0, 'spring DST 23-hour day includes start and excludes end';
 r:=public.admin_analytics_operations('2026-03-08 05:00:00+00','2026-03-09 04:00:00+00');
 assert (r#>>'{opportunities,rows,0,ratio}')::numeric=0, 'opportunities use interaction timestamps not event creation';
 insert into public.taxonomy_terms(id,slug,name,category,status) values ('00000000-0000-4000-8000-000000005701','p5-salsa','Salsa','dance_style','active'),('00000000-0000-4000-8000-000000005702','p5-bachata','Bachata','dance_style','active');
 insert into public.event_taxonomy_terms(event_id,taxonomy_term_id) values ('00000000-0000-4000-8000-000000005103','00000000-0000-4000-8000-000000005701'),('00000000-0000-4000-8000-000000005103','00000000-0000-4000-8000-000000005702');
 r:=public.admin_analytics_operations();
 assert (r#>>'{quality,counts,missing_taxonomy}')::int=0 and (r#>>'{quality,counts,missing_venue}')::int=2, 'canonical taxonomy prevents missing flag without multiplying quality counts';
 insert into public.metros(slug,name,status) values ('p5-healthy','Healthy','active'),('p5-limited','Limited','active');
 insert into public.events(title,event_date,status,city,dance_styles) select 'Healthy '||n,now()+interval '5 days','approved','p5-healthy',array['Salsa'] from generate_series(1,5) n;
 insert into public.events(title,event_date,status,city,dance_styles) select 'Limited '||n,now()+interval '5 days','approved','p5-limited',array['Salsa'] from generate_series(1,2) n;
 r:=public.admin_analytics_operations();
 assert exists(select 1 from jsonb_array_elements(r#>'{metros,rows}') m where m->>'slug'='p5-healthy' and m->>'health'='healthy'), 'five events healthy';
 assert exists(select 1 from jsonb_array_elements(r#>'{metros,rows}') m where m->>'slug'='p5-limited' and m->>'health'='limited'), 'two events limited';
 assert not has_function_privilege('anon','public.admin_analytics_operations(timestamptz,timestamptz,integer,integer,integer,integer,integer,integer,numeric,integer,integer)','execute'), 'anonymous operations execution revoked';
 assert not has_function_privilege('anon','public.admin_analytics_report(text,timestamptz,timestamptz,text)','execute'), 'anonymous report execution revoked';
 -- Unique canonical entities exceed both the UI page and the declared export cap.
 insert into public.organizers(name,status) select 'Large export '||lpad(n::text,5,'0'),'active' from generate_series(1,10001) n;
 x:=public.admin_analytics_report('organizers',null,null,'total_events');
 assert (x->>'total')::int=10004 and jsonb_array_length(x->'rows')=10000 and (x->>'limit')::int=10000, 'large report explicitly capped with full count';
 assert (select count(distinct row->>0) from jsonb_array_elements(x->'rows') row)=10000, 'canonical IDs never duplicated in exports';
 r:=public.admin_analytics_operations(null,null,0,25,0,0,25);
 assert jsonb_array_length(r#>'{organizers,rows}')=25 and (r#>>'{organizers,total}')::int=10004, 'server page beyond first retains total';
 set local session_replication_role=replica;
 delete from public.events; delete from public.organizers; delete from public.event_submissions;
 r:=public.admin_analytics_operations();
 assert (r#>>'{submissions,pending}')::int=0 and r#>'{submissions,average_hours}'='null'::jsonb and (r#>>'{metros,total}')::int=0, 'empty genuine state';
 raise notice 'Phase 5 operational assertions passed';
end $$;
rollback;

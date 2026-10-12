-- Run only on an empty disposable schema clone; all fixtures roll back.
begin;
set local session_replication_role = replica;
insert into public.metros(slug,name,status) values ('phase4-alpha','Same City','active'),('phase4-beta','Same City','active'),('phase4-empty','Empty Metro','active');
insert into public.organizers(id,name,status,created_at) values
 ('00000000-0000-4000-8000-000000004001','Cross-metro organizer','active',now()),
 ('00000000-0000-4000-8000-000000004002','Past and draft organizer','active',now()-interval '100 days'),
 ('00000000-0000-4000-8000-000000004003','No events organizer','active',now()),
 ('00000000-0000-4000-8000-000000004004','Archived organizer','archived',now()-interval '100 days');
insert into public.venues(id,name,city,address_line1,created_at) values
 ('00000000-0000-4000-8000-000000004101','Shared Venue','Local town','1 Main Street',now()),
 ('00000000-0000-4000-8000-000000004102','Second Venue','Other town',null,now()-interval '100 days'),
 ('00000000-0000-4000-8000-000000004103','No events venue',null,null,now());
insert into public.events(id,title,event_date,status,city,organizer_id,venue_id,created_at,dance_styles,image_url,poster_image_url) values
 ('00000000-0000-4000-8000-000000004201','Today event',date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York','approved','phase4-alpha','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000004101',now(),array['Mambo'],null,'https://example.com/poster.jpg'),
 ('00000000-0000-4000-8000-000000004202','Second metro',now()+interval '2 days','approved','phase4-beta','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000004101',now()-interval '100 days',array['Bachata',' bachata '],'https://example.com/flyer.jpg',null),
 ('00000000-0000-4000-8000-000000004203','Past event',now()-interval '45 days','approved','phase4-alpha','00000000-0000-4000-8000-000000004002','00000000-0000-4000-8000-000000004102',now(),array[]::text[],null,null),
 ('00000000-0000-4000-8000-000000004204','Pending event',now()+interval '2 days','pending','phase4-alpha','00000000-0000-4000-8000-000000004002','00000000-0000-4000-8000-000000004101',now(),array[]::text[],null,null),
 ('00000000-0000-4000-8000-000000004205','Unassociated event',now()+interval '2 days','approved',null,null,null,now(),array[null,' '],null,null),
 ('00000000-0000-4000-8000-000000004206','Undated creation',now()+interval '2 days','approved','phase4-alpha','00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000004102',null,array[]::text[],null,null),
 ('00000000-0000-4000-8000-000000004207','Archived event',now()-interval '50 days','archived','phase4-alpha','00000000-0000-4000-8000-000000004004','00000000-0000-4000-8000-000000004102',now()-interval '100 days',array[]::text[],null,null);
insert into public.taxonomy_terms(id,slug,name,category,status,display_order) values
 ('00000000-0000-4000-8000-000000004301','phase4-salsa','Salsa','dance_style','active',1),
 ('00000000-0000-4000-8000-000000004302','phase4-bachata','Bachata','dance_style','active',2);
insert into public.event_taxonomy_terms(event_id,taxonomy_term_id) values
 ('00000000-0000-4000-8000-000000004201','00000000-0000-4000-8000-000000004301'),
 ('00000000-0000-4000-8000-000000004201','00000000-0000-4000-8000-000000004302');
insert into public.event_touches(event_id,kind,touched_at) values
 ('00000000-0000-4000-8000-000000004201','view',now()),
 ('00000000-0000-4000-8000-000000004201','view',now()),
 ('00000000-0000-4000-8000-000000004201','rsvp_click',now()),
 ('00000000-0000-4000-8000-000000004201','share',now()),
 ('00000000-0000-4000-8000-000000004202','view',now()),
 ('00000000-0000-4000-8000-000000004202','ticket_click',now()),
 ('00000000-0000-4000-8000-000000004206','view',now()),
 ('00000000-0000-4000-8000-000000004203','view',now()-interval '50 days');
set local session_replication_role = origin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004999","app_metadata":{"role":"admin"}}',true);
do $$
declare r jsonb; a jsonb; b jsonb; q jsonb; role_name text; start_at timestamptz := now()-interval '7 days'; end_at timestamptz := now()+interval '1 day';
begin
 r:=public.admin_analytics_entity_performance(start_at,end_at);
 assert (r#>>'{organizers,total}')::int=4, 'canonical organizer total';
 assert (r#>>'{organizers,active}')::int=1, 'distinct active organizers including today';
 assert (r#>>'{organizers,created}')::int=2, 'organizer creation period';
 assert (r#>>'{venues,total}')::int=3 and (r#>>'{venues,active}')::int=2, 'venue totals and current activity';
 a:=r#>'{organizers,rows,0}'; b:=r#>'{venues,rows,0}';
 assert a->>'id'='00000000-0000-4000-8000-000000004001' and (a->>'upcoming_events')::int=3 and (a->>'total_events')::int=3, 'organizer canonical rankings, no duplicated joins';
 assert (a->>'created_events')::int=1 and a->>'last_published_at' is null, 'creation cohort is not publication history';
 assert (a->>'related_total')::int=2 and (a->>'metro_total')::int=2, 'cross-metro organizer and associated venues';
 assert (a#>>'{related,0,event_count}')::int=2, 'frequent organizer/venue pairing';
 assert (a#>>'{engagement,detail_views}')::int=4 and (a#>>'{engagement,rsvp_clicks}')::int=1 and (a#>>'{engagement,ticket_clicks}')::int=1, 'multi-event organizer engagement';
 assert b->>'id'='00000000-0000-4000-8000-000000004101' and (b->>'upcoming_events')::int=2, 'venue inventory';
 assert (b->>'related_total')::int=2 and (b#>>'{engagement,detail_views}')::int=3, 'multiple organizer venue without style multiplication';
 assert (b->>'style_total')::int=3, 'canonical authority plus distinct legacy styles';
 assert not exists(select 1 from jsonb_array_elements(b->'styles') s where s->>'name'='mambo'), 'canonical styles override legacy';
 assert (r#>>'{coverage,active_metros}')::int=2, 'canonical active metro count';
 assert exists(select 1 from jsonb_array_elements(r#>'{coverage,rows}') c where c->>'slug'='phase4-empty' and (c->>'upcoming_events')::int=0), 'empty metro coverage remains visible';
 assert exists(select 1 from jsonb_array_elements(r#>'{coverage,rows}') c where c->>'slug'='phase4-alpha' and (c->>'upcoming_events')::int=2 and (c->>'active_organizers')::int=1 and (c->>'active_venues')::int=2), 'coverage distinct IDs';
 q:=r->'quality';
 assert (select (x->>'count')::int from jsonb_array_elements(q) x where x->>'key'='missing_venue')=1, 'approved missing venue';
 assert (select (x->>'count')::int from jsonb_array_elements(q) x where x->>'key'='missing_organizer')=1, 'approved missing organizer';
 assert (select (x->>'count')::int from jsonb_array_elements(q) x where x->>'key'='missing_flyer')=2, 'poster or original flyer accepted';
 assert (select (x->>'count')::int from jsonb_array_elements(q) x where x->>'key'='missing_metro')=1, 'missing canonical metro';
 assert (select (x->>'count')::int from jsonb_array_elements(q) x where x->>'key'='missing_taxonomy')=2, 'null and blank styles treated absent';
 assert (select (x->>'count')::int from jsonb_array_elements(q) x where x->>'key'='missing_address')=2, 'canonical venue address fallback';
 assert (select (x->>'count')::int from jsonb_array_elements(q) x where x->>'key'='missing_location')=1, 'canonical venue name fallback';
 assert exists(select 1 from jsonb_array_elements(r#>'{organizers,rows}') x where x->>'id'='00000000-0000-4000-8000-000000004003' and (x->>'total_events')::int=0), 'entity without events preserved';
 assert r::text not like '%submitter_email%' and r::text not like '%invitation%' and r::text not like '%app_metadata%', 'no private fields';
 r:=public.admin_analytics_entity_performance(null,null,'total_events','total_events',1,1,1);
 assert jsonb_array_length(r#>'{organizers,rows}')=1 and (r#>>'{organizers,offset}')::int=1 and (r#>>'{organizers,total}')::int=4, 'server pagination retains total';
 r:=public.admin_analytics_entity_performance(now()-interval '1 year',now()-interval '200 days');
 assert (r#>>'{organizers,active}')::int=1 and (r#>>'{organizers,rows,0,upcoming_events}')::int=3, 'current activity independent of retrospective range';
 assert r#>'{organizers,rows,0,engagement}'='null'::jsonb, 'untracked historical engagement unavailable';
 begin perform public.admin_analytics_entity_performance(null,null,'invalid'); raise exception 'invalid sort accepted'; exception when sqlstate '22023' then null; end;
 begin perform public.admin_analytics_entity_performance(null,null,'upcoming_events','upcoming_events',-1); raise exception 'negative offset accepted'; exception when sqlstate '22023' then null; end;
 foreach role_name in array array['user','organizer','host','moderator',''] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000004999','app_metadata',jsonb_build_object('role',role_name))::text,true);
  begin perform public.admin_analytics_entity_performance(null,null); raise exception 'unauthorized access accepted'; exception when insufficient_privilege then null; end;
 end loop;
 perform set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
 begin perform public.admin_analytics_entity_performance(null,null); raise exception 'missing subject accepted'; exception when insufficient_privilege then null; end;
 assert not has_function_privilege('anon','public.admin_analytics_entity_performance(timestamptz,timestamptz,text,text,integer,integer,integer)','execute'), 'anonymous execute revoked';
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000004999","app_metadata":{"role":"admin"}}',true);
 alter table public.event_touches rename to phase4_unavailable_touches;
 r:=public.admin_analytics_entity_performance(null,null);
 assert r#>'{organizers,rows,0,engagement}'='null'::jsonb and (r#>>'{venues,total}')::int=3, 'missing tracking does not block inventory';
 alter table public.phase4_unavailable_touches rename to event_touches;
 alter function public.admin_event_engagement(timestamptz,timestamptz,text) rename to phase4_missing_engagement_contract;
 r:=public.admin_analytics_entity_performance(null,null);
 assert r#>'{organizers,rows,0,engagement}'='null'::jsonb and (r#>>'{organizers,total}')::int=4, 'unreleased Phase 3 contract unavailable despite telemetry table';
 alter function public.phase4_missing_engagement_contract(timestamptz,timestamptz,text) rename to admin_event_engagement;
 alter table public.venues rename to phase4_unavailable_venues;
 r:=public.admin_analytics_entity_performance(null,null);
 assert r->'venues'='null'::jsonb and (r#>>'{organizers,total}')::int=4, 'independent venue failure';
 alter table public.phase4_unavailable_venues rename to venues;
 alter table public.organizers rename to phase4_unavailable_organizers;
 r:=public.admin_analytics_entity_performance(null,null);
 assert r->'organizers'='null'::jsonb and (r#>>'{venues,total}')::int=3, 'independent organizer failure';
 alter table public.phase4_unavailable_organizers rename to organizers;
 alter table public.taxonomy_terms rename to phase4_unavailable_taxonomy;
 r:=public.admin_analytics_entity_performance(null,null);
 assert r->'quality'='null'::jsonb and (r#>>'{organizers,total}')::int=4, 'quality dependency failure independent';
 alter table public.phase4_unavailable_taxonomy rename to taxonomy_terms;
 set local session_replication_role = replica;
 update public.events set city='Unregistered Legacy City' where id='00000000-0000-4000-8000-000000004205';
 r:=public.admin_analytics_entity_performance(null,null);
 assert (select (x->>'count')::int from jsonb_array_elements(r->'quality') x where x->>'key'='inconsistent_city')=1, 'unregistered nonblank city reported, not normalized by analytics';
 update public.events set city=null where id='00000000-0000-4000-8000-000000004205';
 set local session_replication_role = origin;
 delete from public.event_touches;
 r:=public.admin_analytics_entity_performance(null,null);
 assert r#>'{organizers,rows,0,engagement}'='null'::jsonb, 'empty tracking history not fabricated zero';
 set local session_replication_role = replica;
 delete from public.events; delete from public.organizers; delete from public.venues;
 r:=public.admin_analytics_entity_performance(null,null);
 assert (r#>>'{organizers,total}')::int=0 and r#>'{organizers,rows}'='[]'::jsonb and (r#>>'{venues,active}')::int=0, 'empty entities and inventory';
 assert not exists(select 1 from jsonb_array_elements(r->'quality') issue where (issue->>'count')::int<>0), 'empty quality sources produce genuine zeros';
 raise notice 'All Phase 4 SQL assertions passed';
end;
$$;
rollback;

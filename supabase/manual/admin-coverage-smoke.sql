-- Run against local Salsa Postgres after applying admin_coverage_score.
-- Uses transaction-local claims and fixtures; every data change rolls back.
begin;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}';
create temporary table baseline as select public.admin_coverage_score() as value;
-- Event audit triggers may reference real users. Keep fixture actor null.
set local request.jwt.claims = '{}';
insert into public.events (id,title,event_type,event_date,event_time,location,address,price_type,status,city,source_type)
select gen_random_uuid(),x.title,'social',
  ((date_trunc('day',now() at time zone 'America/New_York')+make_interval(days=>x.days))+interval '22 hours') at time zone 'America/New_York',
  '22:00','Baseline smoke venue','1 Test Street','free',x.status,'boston','admin'
from (values
 ('[baseline-smoke] Listed night',-14,'approved'),
 ('[baseline-smoke] Listed night',-7,'approved'),
 ('[baseline-smoke] Listed night',7,'approved'),
 ('[baseline-smoke] Missing night',-14,'approved'),
 ('[baseline-smoke] Missing night',-7,'approved'),
 ('[baseline-smoke] Missing night',7,'pending'),
 ('[baseline-smoke] Missing night',14,'approved'),
 ('[baseline-smoke] Duplicate only',-7,'approved'),
 ('[baseline-smoke] Duplicate only',-7,'approved')
) as x(title,days,status);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}';
do $$
declare before jsonb; after jsonb; begin
 select value into before from baseline;
 after:=public.admin_coverage_score();
 assert (after->>'tracked')::integer-(before->>'tracked')::integer=2,'expected two recurring nights, excluding same-day duplicate';
 assert (after->>'listed')::integer-(before->>'listed')::integer=1,'expected one listed night, excluding pending and horizon boundary';
 assert jsonb_path_exists(after,'$.metros[*].gaps[*] ? (@.title == "[baseline-smoke] Missing night")'),'missing-night action gap absent';
 assert not has_function_privilege('anon','public.admin_coverage_score(integer,integer,integer,integer)','execute'),'anonymous RPC access must be denied';
 begin
  perform public.admin_coverage_score(28,14,1);
  raise exception 'invalid parameters were accepted';
 exception when invalid_parameter_value then null;
 end;
 raise notice 'PASS: recurring identity, same-day dedupe, approval filter, exclusive horizon, action gap, permissions and parameter boundary';
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"user"}}';
do $$ begin
 begin
  perform public.admin_coverage_score();
  raise exception 'non-admin RPC access was accepted';
 exception when insufficient_privilege then null;
 end;
 raise notice 'PASS: non-admin authorization guard';
end $$;
rollback;

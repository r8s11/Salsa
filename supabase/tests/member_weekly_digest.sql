-- Disposable migrated database only; all fixture changes roll back.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/member_weekly_digest.sql
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_digest(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',message; end if; end $$;
do $$
#variable_conflict use_variable
declare
  member uuid := gen_random_uuid(); other_member uuid := gen_random_uuid();
  city text := 'digest-'||gen_random_uuid(); week date := date_trunc('week',now() at time zone 'UTC')::date;
  claim jsonb; retry jsonb; old_token uuid; message jsonb; venue uuid:=gen_random_uuid(); selection jsonb;
begin
  insert into auth.users(id,email,email_confirmed_at) values(member,'digest@example.test',now()),(other_member,'other@example.test',now());
  insert into metros(slug,name) values(city,'Digest fixture');
  insert into events(title,city,event_date,status,event_type) values('Upcoming',city,now()+interval '1 day','approved','social');
  insert into venues(id,name,timezone) values(venue,'West Coast fixture','America/Los_Angeles');
  update events set venue_id=venue where events.city=city;
  insert into events(title,city,event_date,status,event_type) values
    ('Excluded draft',city,now()+interval '2 days','draft','social'),
    ('Excluded end boundary',city,now()+interval '7 days','approved','social');
  selection:=member_digest_events(city,now(),now()+interval '7 days');
  perform pg_temp.check_digest(jsonb_array_length(selection)=1,'event approval/window boundary broken');
  perform pg_temp.check_digest(selection->0->>'venueTimeZone'='America/Los_Angeles','venue timezone lost');
  insert into profiles(id,status,city,notification_prefs,onboarding_completed_at)
  values(member,'active',city,'{"weekly_digest":true,"legacy":true}',now()),(other_member,'active',city,'{}',now())
  on conflict(id) do update set status=excluded.status,city=excluded.city,notification_prefs=excluded.notification_prefs,onboarding_completed_at=excluded.onboarding_completed_at;
  perform pg_temp.check_digest(member=any(member_digest_due(now(),null)), 'eligible member absent');
  perform pg_temp.check_digest(not(other_member=any(member_digest_due(now(),null))), 'missing consent included');
  update profiles set notification_prefs='{"weekly_digest":"true"}' where id=other_member;
  perform pg_temp.check_digest(not(other_member=any(member_digest_due(now(),null))), 'string consent included');
  update profiles set notification_prefs='{"weekly_digest":false}' where id=other_member;
  perform pg_temp.check_digest(not(other_member=any(member_digest_due(now(),null))), 'false consent included');
  update profiles set city=null where id=member;
  perform pg_temp.check_digest(not(member=any(member_digest_due(now(),null))), 'no metro included');
  update profiles set city=city where id=member;
  update auth.users set banned_until=now()+interval '1 day' where id=member;
  perform pg_temp.check_digest(member_digest_claim(member,week) is null,'banned member claimed');
  update auth.users set banned_until=null,email_confirmed_at=null where id=member;
  perform pg_temp.check_digest(member_digest_claim(member,week) is null,'unconfirmed member claimed');
  update auth.users set email_confirmed_at=now(),deleted_at=now() where id=member;
  perform pg_temp.check_digest(member_digest_claim(member,week) is null,'deleted account claimed');
  update auth.users set deleted_at=null where id=member;
  update profiles set status='suspended' where id=member;
  perform pg_temp.check_digest(member_digest_claim(member,week) is null,'suspended member claimed');
  update profiles set status='active' where id=member;
  update metros set status='archived' where slug=city;
  perform pg_temp.check_digest(member_digest_claim(member,week) is null,'retired metro claimed');
  update metros set status='active' where slug=city;
  claim:=member_digest_claim(member,week);
  perform pg_temp.check_digest(claim->>'email'='digest@example.test','claim recipient incorrect');
  perform pg_temp.check_digest(member_digest_claim(member,week) is null,'active claim stolen');
  perform pg_temp.check_digest(member_digest_finish(member,week,gen_random_uuid(),'sent',null)=false,'stale completion accepted');
  message:=jsonb_build_object('to','digest@example.test','from','Salsa <hello@example.test>','subject','Weekly','html','<p>Weekly</p>','text','Weekly','headers','{}'::jsonb);
  perform pg_temp.check_digest(member_digest_prepare(member,week,(claim->>'token')::uuid,message)=message,'message not stored');
  update member_digest_deliveries set lease_until=now()-interval '1 second' where profile_id=member;
  retry:=member_digest_claim(member,week);
  perform pg_temp.check_digest(retry->>'token'<>claim->>'token','expired claim not fenced');
  perform pg_temp.check_digest(member_digest_prepare(member,week,(retry->>'token')::uuid,message||'{"subject":"changed"}')=message,'retry payload changed');
  perform pg_temp.check_digest(not member_digest_finish(member,week,(claim->>'token')::uuid,'sent',null),'old lease finished');
  old_token:=(retry->>'unsubscribe_token')::uuid;
  perform pg_temp.check_digest(member_digest_allowed(member,week,(retry->>'token')::uuid),'valid delivery blocked before opt-out');
  perform pg_temp.check_digest(member_email_unsubscribe(old_token),'unsubscribe failed');
  perform pg_temp.check_digest(not member_digest_allowed(member,week,(retry->>'token')::uuid),'opt-out ignored before send');
  perform pg_temp.check_digest(member_email_unsubscribe(old_token),'repeat unsubscribe failed');
  perform pg_temp.check_digest((select notification_prefs->'weekly_digest'='false'::jsonb and notification_prefs->'legacy'='true'::jsonb from profiles where id=member),'unsubscribe lost unrelated prefs');
  update profiles set notification_prefs=notification_prefs||'{"weekly_digest":true}' where id=member;
  perform member_email_unsubscribe(old_token);
  perform pg_temp.check_digest((select notification_prefs->'weekly_digest'='true'::jsonb from profiles where id=member),'old consumed token unsubscribed fresh consent');
  perform pg_temp.check_digest(member_digest_finish(member,week,(retry->>'token')::uuid,'failed','provider_error'),'completion failed');
  perform pg_temp.check_digest(member_digest_claim(member,week) is null,'revoked token reused after re-opt-in');
  perform pg_temp.check_digest(not(member=any(member_digest_due(now(),null))),'suppressed member due');
  update profiles set notification_prefs='{"weekly_digest":true}' where id=other_member;
  claim:=member_digest_claim(other_member,week);
  perform pg_temp.check_digest(member_digest_finish(other_member,week,(claim->>'token')::uuid,'sent',null),'sent completion failed');
  perform pg_temp.check_digest(member_digest_claim(other_member,week) is null,'already-sent week reclaimed');
  perform pg_temp.check_digest(not(other_member=any(member_digest_due(now(),null))),'sent member due');
  -- Never retry ambiguous provider acceptance after its 24h dedup TTL.
  update member_digest_deliveries set status='failed',send_started_at=clock_timestamp()-interval '23 hours',message=message
    where profile_id=other_member;
  perform pg_temp.check_digest(member_digest_claim(other_member,week) is null,'provider dedup expiry ignored');
  perform pg_temp.check_digest((select status='suppressed' from member_digest_deliveries where profile_id=other_member),'expired delivery not suppressed');
  perform pg_temp.check_digest(not member_email_unsubscribe(gen_random_uuid()),'unknown token accepted');
  perform pg_temp.check_digest(not has_function_privilege('anon','public.member_digest_due(timestamptz,uuid)','execute'),'anon due grant');
  perform pg_temp.check_digest(not has_function_privilege('authenticated','public.member_digest_claim(uuid,date)','execute'),'client claim grant');
  perform pg_temp.check_digest(not has_table_privilege('anon','public.member_email_tokens','select'),'tokens exposed');
  perform pg_temp.check_digest(has_function_privilege('anon','public.member_email_unsubscribe(uuid)','execute'),'anonymous opt-out missing');
  begin
    execute 'set local role anon';
    perform member_digest_due(now(),null);
    raise exception 'anonymous due RPC succeeded';
  exception when insufficient_privilege then execute 'reset role';
  end;
end $$;
rollback;
\echo 'PASS digest eligibility, lease fencing, immutable retry, opt-out and grant contracts'

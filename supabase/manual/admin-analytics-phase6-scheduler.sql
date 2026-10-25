-- OPERATOR-ONLY. Not a migration. Default invocation does not activate anything.
-- After separate deployment authorization and verified dependencies:
-- psql ... -v activate=true -f supabase/manual/admin-analytics-phase6-scheduler.sql
-- Vault must contain analytics_monitor_url (full HTTPS Edge endpoint) and
-- analytics_scheduler_secret (same >=32-character secret as the Edge environment).
\set ON_ERROR_STOP on
\if :{?activate}
\else
 \set activate false
\endif
\if :activate
 begin;
 create extension if not exists pg_cron;
 create extension if not exists pg_net with schema extensions;
 do $$
 begin
  if not exists(select 1 from vault.decrypted_secrets where name='analytics_monitor_url' and decrypted_secret ~ '^https://[^[:space:]]+/functions/v1/admin-analytics-monitor$')
   or not exists(select 1 from vault.decrypted_secrets where name='analytics_scheduler_secret' and length(decrypted_secret)>=32) then
   raise exception 'analytics scheduler secrets unavailable';
  end if;
  if to_regprocedure('public.admin_analytics_evaluate(timestamptz)') is null then raise exception 'analytics migration unavailable'; end if;
 end $$;
 select cron.schedule('admin-analytics-monitor','*/15 * * * *',$job$
  select net.http_post(
   url:=(select decrypted_secret from vault.decrypted_secrets where name='analytics_monitor_url'),
   headers:=jsonb_build_object('Content-Type','application/json','x-analytics-scheduler-secret',(select decrypted_secret from vault.decrypted_secrets where name='analytics_scheduler_secret')),
   body:='{}'::jsonb,timeout_milliseconds:=10000
  );
 $job$);
 commit;
\else
 \echo 'Scheduler unchanged. Explicit activation and deployment verification required.'
\endif
-- Authorized rollback: SELECT cron.unschedule('admin-analytics-monitor');
-- Keep private report/alert/delivery records; never rotate idempotency keys to retry mail.

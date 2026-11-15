-- OPERATOR-ONLY. Not a migration. Default invocation changes nothing.
-- After separate deployment authorization, live ingress proof and verified sender/quota:
-- psql ... -v activate=true -f supabase/manual/artist-rsvp-scheduler.sql
-- Vault: artist_rsvp_worker_url (full HTTPS endpoint), artist_rsvp_scheduler_secret
-- (same >=32-character secret as RSVP_SCHEDULER_SECRET in the worker environment).
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
  if not exists(select 1 from vault.decrypted_secrets where name='artist_rsvp_worker_url' and decrypted_secret ~ '^https://[^[:space:]]+/functions/v1/artist-rsvp-notifications$')
   or not exists(select 1 from vault.decrypted_secrets where name='artist_rsvp_scheduler_secret' and length(decrypted_secret)>=32) then
   raise exception 'RSVP scheduler secrets unavailable';
  end if;
  if to_regprocedure('public.artist_rsvp_notifications_due(integer)') is null then raise exception 'RSVP migration unavailable'; end if;
 end $$;
 select cron.schedule('artist-rsvp-notifications','* * * * *',$job$
  select net.http_post(
   url:=(select decrypted_secret from vault.decrypted_secrets where name='artist_rsvp_worker_url'),
   headers:=jsonb_build_object('Content-Type','application/json','x-rsvp-scheduler-secret',(select decrypted_secret from vault.decrypted_secrets where name='artist_rsvp_scheduler_secret')),
   body:='{}'::jsonb,timeout_milliseconds:=60000
  );
 $job$);
 commit;
\else
 \echo 'RSVP scheduler unchanged. Separate authorization, ingress and delivery verification required.'
\endif
-- Authorized rollback: SELECT cron.unschedule('artist-rsvp-notifications');
-- Keep RSVP rows, delivery instructions, acknowledgement stamps and idempotency keys.

-- Rollback-only structural security assertions complement HTTP/JWT and race cases.
begin;
do $$
declare t text; f text;
begin
  foreach t in array array['artist_event_rsvps','artist_rsvp_notifications','artist_rsvp_abuse_counters'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then
      raise exception 'RLS missing: %',t;
    end if;
    if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE')
       or has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Direct private table grant: %',t;
    end if;
  end loop;
  foreach f in array array[
    'artist_rsvp_submit(uuid,text,text,text,text,text)',
    'artist_rsvp_notifications_due(integer)',
    'artist_rsvp_notification_claim(uuid)',
    'artist_rsvp_notification_finish(uuid,uuid,text,text,text)'
  ] loop
    if has_function_privilege('anon','public.'||f,'EXECUTE')
       or has_function_privilege('authenticated','public.'||f,'EXECUTE')
       or not has_function_privilege('service_role','public.'||f,'EXECUTE') then
      raise exception 'Service RPC grant mismatch: %',f;
    end if;
  end loop;
  if to_regprocedure('public.organizer_publish_event(uuid)') is not null then
    raise exception 'Acknowledgement-free publish remains';
  end if;
end $$;
rollback;

begin;

-- Phase 10 closes the invitation-delivery crash window. A credential and its
-- delivery claim now commit in one transaction before Resend is contacted.
alter table public.founder_invitation_delivery_attempts
  add column if not exists idempotency_key uuid;

alter table public.founder_invitation_delivery_attempts
  drop constraint if exists founder_invitation_delivery_attempts_status_check,
  drop constraint if exists founder_invitation_delivery_attempts_check,
  drop constraint if exists founder_invitation_delivery_attempts_check1;

alter table public.founder_invitation_delivery_attempts
  add constraint founder_invitation_delivery_attempts_status_check
    check (status in ('attempting', 'sent', 'failed')),
  add constraint founder_invitation_delivery_attempts_terminal_shape_check
    check (
      (status = 'attempting' and provider_message_id is null and error_code is null and completed_at is null)
      or (status = 'sent' and provider_message_id is not null and error_code is null and completed_at is not null)
      or (status = 'failed' and provider_message_id is null and error_code is not null and completed_at is not null)
    );

create unique index if not exists founder_invitation_delivery_attempts_live_idempotency_uniq
  on public.founder_invitation_delivery_attempts (idempotency_key)
  where idempotency_key is not null and status in ('attempting', 'sent');

comment on column public.founder_invitation_delivery_attempts.idempotency_key is
  'Admin-dialog request key. Repeated claims deduplicate while attempting/sent; a failed claim may retry with the same key and receives a fresh invitation.';

alter table public.founder_invitations
  add column if not exists revoke_reason text;

alter table public.founder_invitations
  drop constraint if exists founder_invitations_revoke_reason_check;

alter table public.founder_invitations
  add constraint founder_invitations_revoke_reason_check
    check (revoke_reason is null or revoke_reason in ('admin_revoked', 'superseded', 'delivery_failed'));

comment on column public.founder_invitations.revoke_reason is
  'Normalized reason for revocation. delivery_failed is the only state that bypasses the reissue cooldown.';

create or replace function public.admin_revoke_founder_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.founder_invitations%rowtype;
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  select * into v_invitation
    from public.founder_invitations
   where id = p_invitation_id
   for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if v_invitation.status = 'accepted' then
    raise exception 'an accepted invitation cannot be revoked' using errcode = '22023';
  end if;
  if v_invitation.status = 'revoked' then
    raise exception 'invitation is already revoked' using errcode = '22023';
  end if;

  update public.founder_invitations
     set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'admin_revoked'
   where id = p_invitation_id;

  return jsonb_build_object('success', true, 'status', 'revoked');
end;
$$;

revoke execute on function public.admin_revoke_founder_invitation(uuid) from public, anon;
grant execute on function public.admin_revoke_founder_invitation(uuid) to authenticated;

-- Atomically issue a credential and create an attempting delivery record.
create or replace function public.admin_claim_founder_invitation_delivery(
  p_founder_request_id uuid,
  p_operation text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.founder_access_requests%rowtype;
  v_issued jsonb;
  v_invitation_id uuid;
  v_attempt_id uuid;
  v_attempt_number integer;
  v_existing_status text;
  v_existing_invitation_id uuid;
  v_existing_email text;
  v_existing_expires_at timestamptz;
  v_cooldown_seconds constant integer := 60;
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency key is required' using errcode = '22023';
  end if;
  if p_operation not in ('create', 'reissue') then
    raise exception 'invalid delivery operation' using errcode = '22023';
  end if;

  select * into v_request
    from public.founder_access_requests
   where id = p_founder_request_id
   for update;

  if not found then
    raise exception 'founder request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'approved' then
    raise exception 'founder request must be approved before issuing an invitation' using errcode = '22023';
  end if;

  select da.status, da.invitation_id, i.email, i.expires_at
    into v_existing_status, v_existing_invitation_id, v_existing_email, v_existing_expires_at
    from public.founder_invitation_delivery_attempts da
    join public.founder_invitations i on i.id = da.invitation_id
   where da.idempotency_key = p_idempotency_key
     and da.status in ('attempting', 'sent')
     and i.founder_request_id = p_founder_request_id
   order by da.attempted_at desc
   limit 1;

  if found then
    return jsonb_build_object(
      'claimed', false,
      'deduplicated', true,
      'status', v_existing_status,
      'invitationId', v_existing_invitation_id,
      'email', v_existing_email,
      'expiresAt', v_existing_expires_at
    );
  end if;

  if p_operation = 'reissue' then
    if exists (
      select 1
        from public.founder_invitations
       where founder_request_id = p_founder_request_id
         and status = 'accepted'
    ) then
      raise exception 'an invitation for this request has already been accepted and cannot be reissued' using errcode = '22023';
    end if;

    if exists (
      select 1
        from public.founder_invitations
       where founder_request_id = p_founder_request_id
         and created_at > now() - make_interval(secs => v_cooldown_seconds)
         and not (status = 'revoked' and revoke_reason = 'delivery_failed')
    ) then
      raise exception 'please wait before reissuing this invitation' using errcode = '55000';
    end if;


    v_issued := public.admin_reissue_founder_invitation(p_founder_request_id);
  else
    v_issued := public.admin_create_founder_invitation(p_founder_request_id);
  end if;

  v_invitation_id := (v_issued->>'id')::uuid;

  select coalesce(max(attempt_number), 0) + 1
    into v_attempt_number
    from public.founder_invitation_delivery_attempts
   where invitation_id = v_invitation_id;

  insert into public.founder_invitation_delivery_attempts (
    invitation_id, attempt_number, provider, status, attempted_by, idempotency_key
  ) values (
    v_invitation_id, v_attempt_number, 'resend', 'attempting', auth.uid(), p_idempotency_key
  )
  returning id into v_attempt_id;

  return v_issued || jsonb_build_object(
    'claimed', true,
    'deduplicated', false,
    'attemptId', v_attempt_id
  );
end;
$$;

revoke execute on function public.admin_claim_founder_invitation_delivery(uuid, text, uuid) from public, anon;
grant execute on function public.admin_claim_founder_invitation_delivery(uuid, text, uuid) to authenticated;

create or replace function public.admin_complete_founder_invitation_delivery(
  p_attempt_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.founder_invitation_delivery_attempts%rowtype;
  v_invitation public.founder_invitations%rowtype;
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_status not in ('sent', 'failed') then
    raise exception 'completion status must be sent or failed' using errcode = '22023';
  end if;
  if p_status = 'sent' and nullif(btrim(p_provider_message_id), '') is null then
    raise exception 'provider message id is required for a sent attempt' using errcode = '22023';
  end if;
  if p_status = 'failed' and nullif(btrim(p_error_code), '') is null then
    raise exception 'error code is required for a failed attempt' using errcode = '22023';
  end if;

  select * into v_attempt
    from public.founder_invitation_delivery_attempts
   where id = p_attempt_id
   for update;

  if not found then
    raise exception 'delivery attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'attempting' then
    if v_attempt.status = p_status then
      return jsonb_build_object('success', true, 'deduplicated', true, 'status', v_attempt.status);
    end if;
    raise exception 'delivery attempt is already complete' using errcode = '22023';
  end if;

  update public.founder_invitation_delivery_attempts
     set status = p_status,
         provider_message_id = case when p_status = 'sent' then p_provider_message_id else null end,
         error_code = case when p_status = 'failed' then p_error_code else null end,
         completed_at = now()
   where id = p_attempt_id;

  if p_status = 'failed' then
    select * into v_invitation
      from public.founder_invitations
     where id = v_attempt.invitation_id
     for update;

    if found and v_invitation.status = 'pending' then
      update public.founder_invitations
         set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'delivery_failed'
       where id = v_invitation.id
         and status = 'pending';
    end if;
  end if;

  return jsonb_build_object('success', true, 'deduplicated', false, 'status', p_status);
end;
$$;

revoke execute on function public.admin_complete_founder_invitation_delivery(uuid, text, text, text) from public, anon;
grant execute on function public.admin_complete_founder_invitation_delivery(uuid, text, text, text) to authenticated;

drop function if exists public.admin_record_founder_invitation_delivery_attempt(uuid, text, text, text, text);

create or replace function public.log_founder_invitation_delivery_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    new.attempted_by,
    case new.status
      when 'attempting' then 'founder_invitation.email_attempting'
      when 'sent' then 'founder_invitation.email_sent'
      else 'founder_invitation.email_failed'
    end,
    'founder_invitation_delivery_attempt',
    new.id,
    jsonb_build_object(
      'invitation_id', new.invitation_id,
      'attempt_number', new.attempt_number,
      'provider', new.provider,
      'provider_message_id', new.provider_message_id,
      'error_code', new.error_code
    )
  );
  return new;
end;
$$;

revoke execute on function public.log_founder_invitation_delivery_attempt() from public, anon, authenticated;

drop trigger if exists founder_invitation_delivery_attempts_audit_log on public.founder_invitation_delivery_attempts;
create trigger founder_invitation_delivery_attempts_audit_log
  after insert or update of status on public.founder_invitation_delivery_attempts
  for each row execute function public.log_founder_invitation_delivery_attempt();

create or replace function public.admin_founder_host_state(p_founder_request_id uuid)
returns table (organizer_id uuid, host_active boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'admin or moderator role required' using errcode = '42501';
  end if;

  return query
  select far.organizer_id,
         far.organizer_id is not null
         and exists (
           select 1
             from public.organizer_members om
            where om.organizer_id = far.organizer_id
              and om.member_role = 'owner'
              and om.status = 'active'
         )
    from public.founder_access_requests far
   where far.id = p_founder_request_id;
end;
$$;

revoke execute on function public.admin_founder_host_state(uuid) from public, anon;
grant execute on function public.admin_founder_host_state(uuid) to authenticated;

-- Replace the legacy review RPC so the reviewer identity is always derived
-- from the authenticated caller rather than accepted from the client.
drop function if exists public.admin_review_founder_request(uuid, text, uuid, text, text);

create function public.admin_review_founder_request(
  p_request_id uuid,
  p_decision text,
  p_reason_code text default null,
  p_reason_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_new_status text;
  v_updated_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid decision: must be "approve" or "reject"' using errcode = '22023';
  end if;

  if p_decision = 'reject' then
    if p_reason_code is null then
      raise exception 'rejection reason code is required when rejecting' using errcode = '22023';
    end if;
    if p_reason_code not in (
      'insufficient_information',
      'unable_to_verify_organizer',
      'account_activity_concerns',
      'duplicate_organizer_brand',
      'not_currently_eligible',
      'other'
    ) then
      raise exception 'invalid rejection reason code' using errcode = '22023';
    end if;
  else
    p_reason_code := null;
    p_reason_message := null;
  end if;

  v_new_status := case p_decision when 'approve' then 'approved' else 'rejected' end;

  update public.founder_access_requests
     set status = v_new_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason_code = case when p_decision = 'reject' then p_reason_code else null end,
         rejection_message = case when p_decision = 'reject' then p_reason_message else null end,
         updated_at = now()
   where id = p_request_id
     and status = 'pending';

  get diagnostics v_updated_count = row_count;
  if v_updated_count = 0 then
    select status into v_current_status
      from public.founder_access_requests
     where id = p_request_id;

    if v_current_status is null then
      raise exception 'founder request not found' using errcode = 'P0002';
    end if;
    raise exception 'this request was already reviewed (current status: %)', v_current_status using errcode = '55000';
  end if;

  return jsonb_build_object('success', true, 'status', v_new_status);
end;
$$;

revoke execute on function public.admin_review_founder_request(uuid, text, text, text) from public, anon;
grant execute on function public.admin_review_founder_request(uuid, text, text, text) to authenticated;

-- Close the Host first-event gap: the frontend already called this RPC, but
-- no migration had ever created it.
create or replace function public.organizer_create_event(
  p_organizer_id uuid,
  p_payload jsonb,
  p_publish boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_role text;
  v_keys text[];
  v_bad text[];
  v_allowed constant text[] := array[
    'title','description','event_type','city','event_date','event_time',
    'location','address','price_type','price_amount','rsvp_link','recurrence',
    'contact_email','contact_instagram','contact_website','image_url','host',
    'dance_styles','venue_id'
  ];
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.account_is_active(auth.uid()) then
    raise exception 'account is not active' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'event payload must be an object' using errcode = '22023';
  end if;
  if nullif(btrim(p_payload ->> 'title'), '') is null then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_payload ->> 'event_date'), '') is null then
    raise exception 'event date is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_payload ->> 'event_type'), '') is null then
    raise exception 'event type is required' using errcode = '22023';
  end if;

  select array_agg(k) into v_keys from jsonb_object_keys(p_payload) as k;
  select array_agg(k order by k)
    into v_bad
    from unnest(v_keys) as keys(k)
   where not (k = any(v_allowed));
  if v_bad is not null and cardinality(v_bad) > 0 then
    raise exception 'field not creatable by organizers: %', v_bad using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organizers
     where id = p_organizer_id and status = 'active'
  ) then
    raise exception 'organizer is not active' using errcode = '42501';
  end if;

  if public.is_admin() then
    v_role := 'platform';
  else
    v_role := public.organizer_member_role(p_organizer_id);
    if v_role is null or v_role not in ('owner', 'manager') then
      raise exception 'active owner or manager membership required' using errcode = '42501';
    end if;
  end if;

  insert into public.events (
    title, description, event_type, city, event_date, event_time, location,
    address, price_type, price_amount, rsvp_link, recurrence, contact_email,
    contact_instagram, contact_website, image_url, host, dance_styles,
    venue_id, status, source_type, submitter_id, organizer_id
  ) values (
    btrim(p_payload ->> 'title'),
    nullif(btrim(p_payload ->> 'description'), ''),
    p_payload ->> 'event_type',
    coalesce(nullif(p_payload ->> 'city', ''), 'boston'),
    (p_payload ->> 'event_date')::timestamptz,
    nullif(p_payload ->> 'event_time', ''),
    nullif(btrim(p_payload ->> 'location'), ''),
    nullif(btrim(p_payload ->> 'address'), ''),
    nullif(p_payload ->> 'price_type', ''),
    case when nullif(p_payload ->> 'price_amount', '') is null then null else (p_payload ->> 'price_amount')::numeric end,
    nullif(btrim(p_payload ->> 'rsvp_link'), ''),
    nullif(p_payload ->> 'recurrence', ''),
    nullif(btrim(p_payload ->> 'contact_email'), ''),
    nullif(btrim(p_payload ->> 'contact_instagram'), ''),
    nullif(btrim(p_payload ->> 'contact_website'), ''),
    nullif(btrim(p_payload ->> 'image_url'), ''),
    nullif(btrim(p_payload ->> 'host'), ''),
    case
      when p_payload ? 'dance_styles' then
        (select coalesce(array_agg(style), '{}') from jsonb_array_elements_text(p_payload -> 'dance_styles') as style)
      else '{}'::text[]
    end,
    case when nullif(p_payload ->> 'venue_id', '') is null then null else (p_payload ->> 'venue_id')::uuid end,
    case when coalesce(p_publish, false) then 'approved' else 'draft' end,
    'organizer',
    auth.uid(),
    p_organizer_id
  )
  returning id into v_event_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'event.organizer_created',
    'event',
    v_event_id,
    jsonb_build_object('organizer_id', p_organizer_id, 'member_role', v_role, 'published', coalesce(p_publish, false))
  );

  return v_event_id;
end;
$$;

revoke execute on function public.organizer_create_event(uuid, jsonb, boolean) from public, anon;
grant execute on function public.organizer_create_event(uuid, jsonb, boolean) to authenticated;

create or replace function public.organizer_delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.account_is_active(auth.uid()) then
    raise exception 'account is not active' using errcode = '42501';
  end if;

  select * into v_event
    from public.events
   where id = p_event_id
   for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if v_event.organizer_id is null then
    raise exception 'event is not organizer-owned' using errcode = '42501';
  end if;

  if not public.is_admin() then
    if not exists (
      select 1 from public.organizers
       where id = v_event.organizer_id and status = 'active'
    ) then
      raise exception 'organizer is not active' using errcode = '42501';
    end if;
    v_role := public.organizer_member_role(v_event.organizer_id);
    if v_role is null or v_role not in ('owner', 'manager') then
      raise exception 'active owner or manager membership required' using errcode = '42501';
    end if;
  end if;

  delete from public.events where id = p_event_id;
end;
$$;

revoke execute on function public.organizer_delete_event(uuid) from public, anon;
grant execute on function public.organizer_delete_event(uuid) to authenticated;

-- Founder tables are RPC-only for browser roles. The public intake Edge
-- function is the sole direct table client and needs only SELECT + INSERT.
revoke all privileges on table public.founder_access_requests from anon, authenticated, service_role;
revoke all privileges on table public.founder_invitations from anon, authenticated, service_role;
revoke all privileges on table public.founder_invitation_delivery_attempts from anon, authenticated, service_role;
grant select, insert on table public.founder_access_requests to service_role;

notify pgrst, 'reload schema';
commit;

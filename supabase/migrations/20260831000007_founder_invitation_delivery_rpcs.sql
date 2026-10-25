-- =====================================================================
-- Founder Invitation Delivery RPCs — Phase 5
-- =====================================================================
-- Purpose:
--   - admin_record_founder_invitation_delivery_attempt: records the
--     outcome of one email-send attempt (called by the
--     send-founder-invitation Edge Function after it calls Resend).
--   - admin_founder_invitation_for_request: extended (dropped and
--     recreated) to also surface the latest delivery attempt, so the
--     admin detail page can show invitation state and email state from
--     a single read, without conflating the two (spec §20: "Do not
--     conflate invitation lifecycle with email lifecycle" — the two
--     remain separate columns in the response, not a merged status).
--
-- Required: REQUIRED before deploying Phase 5 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: depends on public.founder_invitation_delivery_attempts
--   (20260831000006_founder_invitation_delivery.sql) and
--   public.founder_invitations (20260831000004_founder_invitations.sql).
--
-- Data impact: no existing row is changed by applying this file.
--
-- Rollback considerations: drop
--   admin_record_founder_invitation_delivery_attempt(...), then restore
--   admin_founder_invitation_for_request(uuid) to its Phase 4 shape from
--   20260831000005_founder_invitation_rpcs.sql.
-- =====================================================================

-- ------------------------------------------------------------
-- 1. admin_record_founder_invitation_delivery_attempt
-- ------------------------------------------------------------

drop function if exists public.admin_record_founder_invitation_delivery_attempt(uuid, text, text, text, text);
create function public.admin_record_founder_invitation_delivery_attempt(
  p_invitation_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error_code text default null,
  p_provider text default 'resend'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_number integer;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  if p_status not in ('sent', 'failed') then
    raise exception 'invalid delivery status: must be "sent" or "failed"' using errcode = '22023';
  end if;
  if p_status = 'sent' and p_provider_message_id is null then
    raise exception 'provider_message_id is required when status is "sent"' using errcode = '22023';
  end if;
  if p_status = 'failed' and p_error_code is null then
    raise exception 'error_code is required when status is "failed"' using errcode = '22023';
  end if;

  -- Lock the invitation row so two concurrent recordings for the same
  -- invitation cannot compute the same next attempt_number.
  perform 1 from public.founder_invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_attempt_number
    from public.founder_invitation_delivery_attempts
   where invitation_id = p_invitation_id;

  insert into public.founder_invitation_delivery_attempts (
    invitation_id, attempt_number, provider, provider_message_id, status, error_code, attempted_by, completed_at
  ) values (
    p_invitation_id, v_attempt_number, p_provider, p_provider_message_id, p_status, p_error_code, auth.uid(), now()
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'attemptNumber', v_attempt_number, 'status', p_status);
end;
$$;

revoke execute on function public.admin_record_founder_invitation_delivery_attempt(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_record_founder_invitation_delivery_attempt(uuid, text, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 2. admin_founder_invitation_for_request — extended with delivery state
-- ------------------------------------------------------------

drop function if exists public.admin_founder_invitation_for_request(uuid);
create function public.admin_founder_invitation_for_request(p_founder_request_id uuid)
returns table (
  id                              uuid,
  founder_request_id              uuid,
  email                           text,
  status                          text,
  expires_at                      timestamptz,
  created_at                      timestamptz,
  created_by                      uuid,
  revoked_at                      timestamptz,
  revoked_by                      uuid,
  accepted_at                     timestamptz,
  accepted_by                     uuid,
  latest_delivery_status          text,
  latest_delivery_provider_message_id text,
  latest_delivery_attempted_at    timestamptz,
  latest_delivery_error_code      text,
  delivery_attempt_count          integer
)
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
  select i.id, i.founder_request_id, i.email, i.status, i.expires_at, i.created_at,
         i.created_by, i.revoked_at, i.revoked_by, i.accepted_at, i.accepted_by,
         d.status, d.provider_message_id, d.attempted_at, d.error_code,
         coalesce(cnt.attempt_count, 0)::integer
    from public.founder_invitations i
    left join lateral (
      select da.status, da.provider_message_id, da.attempted_at, da.error_code
        from public.founder_invitation_delivery_attempts da
       where da.invitation_id = i.id
       order by da.attempt_number desc
       limit 1
    ) d on true
    left join lateral (
      select count(*)::integer as attempt_count
        from public.founder_invitation_delivery_attempts da2
       where da2.invitation_id = i.id
    ) cnt on true
   where i.founder_request_id = p_founder_request_id
   order by i.created_at desc
   limit 1;
end;
$$;

revoke execute on function public.admin_founder_invitation_for_request(uuid) from public, anon;
grant execute on function public.admin_founder_invitation_for_request(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Notify PostgREST to reload schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

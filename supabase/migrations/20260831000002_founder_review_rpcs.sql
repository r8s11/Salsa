-- =====================================================================
-- Founder Request Review RPCs — Phase 3
-- =====================================================================
-- Purpose:
--   Provide a secure, server-side boundary for admins to approve/reject
--   Founder access requests. The RPC enforces:
--     - Caller is admin (via is_admin())
--     - Request is in 'pending' status
--     - Decision is valid ('approve' or 'reject')
--     - Rejection reason code is valid (for reject)
--     - Concurrency safety: UPDATE ... WHERE status = 'pending'
--     - reviewed_by = authenticated user, reviewed_at = now()
--     - Clears rejection fields on approve
--     - Updates status, reviewed_by, reviewed_at, rejection fields
--
-- Required: REQUIRED before deploying Phase 3 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: standalone. Depends on public.is_admin() (20260830000000_phase6_host_organizer_access.sql).
--
-- Data impact: no existing row is changed.
--
-- Rollback considerations:
--   Drop the RPC. No data changes.
-- =====================================================================

-- ------------------------------------------------------------
-- 1. Review Decision Enum (for documentation; enforced in RPC)
-- ------------------------------------------------------------
-- Valid decisions: 'approve' | 'reject'
-- Valid rejection reason codes (for 'reject'):
--   'insufficient_information'
--   'unable_to_verify_organizer'
--   'account_activity_concerns'
--   'duplicate_organizer_brand'
--   'not_currently_eligible'
--   'other'

-- ------------------------------------------------------------
-- 2. admin_review_founder_request RPC
-- ------------------------------------------------------------

create or replace function public.admin_review_founder_request(
  p_request_id uuid,
  p_decision text,
  p_reviewer_id uuid,
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
  -- 1. Authorization: caller must be admin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  -- 2. Validate decision
  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid decision: must be "approve" or "reject"' using errcode = '22023';
  end if;

  -- 3. Validate rejection reason code if rejecting
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
    -- Approve: ignore any provided reason fields
    p_reason_code := null;
    p_reason_message := null;
  end if;

  v_new_status := case p_decision when 'approve' then 'approved' else 'rejected' end;

  -- 4. Perform the update with concurrency safety
  -- Only update if status is still 'pending' (optimistic locking pattern)
  update public.founder_access_requests
  set
    status = v_new_status,
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    rejection_reason_code = case when p_decision = 'reject' then p_reason_code else null end,
    rejection_message = case when p_decision = 'reject' then p_reason_message else null end,
    updated_at = now()
  where id = p_request_id
    and status = 'pending';

  get diagnostics v_updated_count = row_count;

  -- 5. Concurrency check
  if v_updated_count = 0 then
    -- Check if request exists but is no longer pending
    select status into v_current_status
    from public.founder_access_requests
    where id = p_request_id;

    if v_current_status is null then
      raise exception 'founder request not found' using errcode = 'P0002';
    else
      raise exception 'this request was already reviewed (current status: %)', v_current_status using errcode = '55000';
    end if;
  end if;

  -- 6. Return success
  return jsonb_build_object(
    'success', true,
    'status', v_new_status
  );
end;
$$;

-- ------------------------------------------------------------
-- 3. Grant execute to authenticated (admin check happens inside)
-- ------------------------------------------------------------
revoke execute on function public.admin_review_founder_request(uuid, text, uuid, text, text) from public, anon;
grant execute on function public.admin_review_founder_request(uuid, text, uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- 4. Notify PostgREST to reload schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
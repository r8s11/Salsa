-- =====================================================================
-- Founder Organization Provisioning & Welcome Handoff — Phase 8
-- =====================================================================
-- Purpose:
--   Closes a gap discovered while auditing for Phase 8: Phase 6
--   (20260831000008_founder_invitation_acceptance.sql) intentionally
--   stops at `founder_invitations.status = 'accepted'` — its own header
--   comment states "no organization creation, no organizer membership,
--   no role grant; those are Phase 7." No prior migration implements
--   that step. This file is that primitive, plus the read-model resolver
--   and welcome-email idempotency Phase 8 needs on top of it.
--
--   Three durable-state additions:
--     1. founder_access_requests.organizer_id — the trusted link from a
--        Founder request to the organizer it provisioned. This is the
--        `provisioned_organizer_id` the Phase 8 spec asks for (§6):
--        never re-derived from organization name matching, never passed
--        by the client.
--     2. founder_access_requests.welcome_email_* — one-shot delivery
--        state for the (optional) welcome email, using the same claim-
--        before-send idempotency principle as
--        20260901_event_submission email work, expressed as three
--        columns rather than a table: unlike invitation-email delivery
--        (founder_invitation_delivery_attempts, which intentionally
--        allows many attempts because Phase 9 adds admin resend) or
--        event-submission email (four distinct event types), a welcome
--        email is fired at most once per provisioning event by an
--        automatic trigger, not an admin action — there is no multi-
--        attempt history to model.
--     3. Two SECURITY DEFINER RPCs (provision_founder_organization,
--        founder_onboarding_state) plus a claim/complete pair for the
--        welcome email, all self-scoped to auth.uid() with ZERO
--        parameters — nothing here is client-suppliable, so there is no
--        organizer id, request id, or user id for a caller to substitute
--        (Phase 8 spec §6/§34: "client cannot substitute another
--        organizer ID").
--
--   Deliberately NOT touched: accept_founder_invitation (Phase 6) is
--   left byte-for-byte as shipped — its own already-verified test suite
--   asserts the "no organization creation" boundary, and this file does
--   not change that boundary, it fills the step immediately after it.
--
-- Required: REQUIRED before deploying Phase 8 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: depends on public.founder_access_requests
--   (20260831000001), public.founder_invitations (20260831000004),
--   public.organizers / organizer_members (20260830000001), and
--   public.profiles (20260813000000).
--
-- Data impact: no existing row is changed. New columns default to NULL
--   / not-yet-provisioned for every existing founder_access_requests row.
--
-- Safety notes:
--   - provision_founder_organization() mirrors the ALREADY-SHIPPED
--     admin_approve_organizer_request() pattern (organizer_requests,
--     reconcile-prod-schema.sql) exactly for the organizer/membership
--     creation and role-sync steps, rather than inventing a second
--     convention for "how does a person become recognized as an
--     organizer" alongside the one that already exists. It only ever
--     lifts profiles.role/app_metadata.role from 'user' to 'organizer'
--     (`where role = 'user'`) — an existing admin or moderator is never
--     downgraded or reassigned.
--   - The row-level authorization boundary (RequireOrganizer, RLS on
--     organizer_members/organizers) was already membership-authoritative
--     before this file: `organizers.length > 0` alone already grants
--     nested Host routes. The role sync here exists only to keep
--     already-role-gated PRESENTATION surfaces (Header.tsx Host
--     Dashboard nav link, AccountPage's "Host Events" capability card,
--     SubmitEventPage's organizer copy) consistent for a Founder-
--     provisioned owner — exactly as they already are for an
--     organizer-request-approved owner. No new authorization dependency
--     on the role is introduced.
--   - provision_founder_organization() takes the request row `for
--     update`, so two concurrent calls from the same user (e.g. two
--     tabs) serialize: the second sees organizer_id already set and
--     takes the idempotent re-affirm branch instead of creating a
--     second organizer.
--   - Every RPC here is authenticated-only and self-scoped via
--     auth.uid() inside the function body; none accept a target id.
--
-- Rollback considerations:
--   Drop the four functions, then the welcome-email columns, then the
--   organizer_id column and its index. No data other than these new
--   columns/rows is affected; existing organizers/organizer_members
--   rows created via this path remain (dropping the migration does not
--   undo provisioning that already happened).
-- =====================================================================

begin;

-- ------------------------------------------------------------
-- 1. founder_access_requests: provisioning + welcome-email columns
-- ------------------------------------------------------------

alter table public.founder_access_requests
  add column if not exists organizer_id uuid references public.organizers(id) on delete set null;

comment on column public.founder_access_requests.organizer_id is
  'Set once, by provision_founder_organization(), the moment the organizer + owner membership are created from this request. The trusted "is this Founder provisioned" signal — never re-derived from organization-name matching.';

create index if not exists founder_access_requests_organizer_id_idx
  on public.founder_access_requests (organizer_id)
  where organizer_id is not null;

alter table public.founder_access_requests
  add column if not exists welcome_email_status text
    check (welcome_email_status is null or welcome_email_status in ('pending', 'sent', 'failed')),
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists welcome_email_error_code text;

comment on column public.founder_access_requests.welcome_email_status is
  'One-shot claim state for the optional Founder-welcome email. NULL = never claimed; pending = claimed, Resend call in flight; sent/failed = terminal. A failed attempt is NOT retried automatically (unlike founder_invitation_delivery_attempts, this has no attempt-history concept) — Phase 9 owns retry/resend tooling.';

-- ------------------------------------------------------------
-- 2. provision_founder_organization()
-- ------------------------------------------------------------
-- Self-service, zero-parameter. Takes the caller's own most recently
-- accepted Founder invitation and provisions (or idempotently re-
-- affirms) the resulting organizer + owner membership.

create or replace function public.provision_founder_organization()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_request        public.founder_access_requests%rowtype;
  v_organizer_id   uuid;
  v_organizer_name text;
  v_member_role    text;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- The ONLY founder_request this call can ever touch: the one this
  -- exact caller accepted an invitation for. No id parameter exists to
  -- substitute a different request/organizer.
  select far.*
    into v_request
    from public.founder_access_requests far
    join public.founder_invitations fi on fi.founder_request_id = far.id
   where fi.accepted_by = v_uid
     and fi.status = 'accepted'
   order by fi.accepted_at desc
   limit 1
     for update of far;

  if not found then
    raise exception 'no accepted Founder invitation found for this account' using errcode = '42501';
  end if;

  if v_request.status <> 'approved' then
    -- Defense in depth: accept_founder_invitation already required this
    -- at acceptance time; re-checking costs nothing and matches this
    -- codebase's established paranoia level for founder_* RPCs.
    raise exception 'founder request is not approved' using errcode = '22023';
  end if;

  if v_request.organizer_id is not null then
    -- Idempotent path. Re-affirms the owner membership (self-heals a row
    -- a retried client call might have raced) rather than creating a
    -- second organizer for the same request.
    v_organizer_id := v_request.organizer_id;

    insert into public.organizer_members (organizer_id, user_id, member_role, status)
    values (v_organizer_id, v_uid, 'owner', 'active')
    on conflict (organizer_id, user_id) do update
      set member_role = 'owner', status = 'active', updated_at = now();
  else
    -- First provisioning for this request. Mirrors
    -- admin_approve_organizer_request()'s organizer INSERT exactly
    -- (same column set, same 'active' status, no slug — slug is nullable
    -- and left for the owner to set later via HostOrganizationPage).
    insert into public.organizers (name, description, website, instagram, primary_city, status)
    values (
      v_request.organization_name,
      v_request.description,
      v_request.website,
      v_request.instagram,
      v_request.city,
      'active'
    )
    returning id into v_organizer_id;

    insert into public.organizer_members (organizer_id, user_id, member_role, status)
    values (v_organizer_id, v_uid, 'owner', 'active')
    on conflict (organizer_id, user_id) do update
      set member_role = 'owner', status = 'active', updated_at = now();

    update public.founder_access_requests
       set organizer_id = v_organizer_id
     where id = v_request.id;

    -- Role sync — see SAFETY NOTES above. A SINGLE authoritative check
    -- (auth.users.raw_app_meta_data.role — what JWTs, RLS, and
    -- roleFromUser() actually read) gates BOTH the profiles and
    -- auth.users updates, deliberately NOT `profiles.role` as its own
    -- guard: profiles.role and auth.users.app_metadata.role are two
    -- independently-writable columns that can drift (verified live —
    -- an admin created via the Admin API can have app_metadata.role
    -- ='admin' while profiles.role is still the handle_new_user()
    -- default 'user'). Guarding the profiles update on profiles' OWN
    -- stale value, as admin_approve_organizer_request() does, would
    -- have downgraded that admin's profiles.role to 'organizer' even
    -- though they are a real admin. One authoritative check avoids the
    -- drift entirely. Only ever lifts a genuine plain user; never
    -- touches an existing admin/moderator's role in either column. Not
    -- a new 'founder' role — reuses the SAME 'organizer' value the rest
    -- of the app already keys presentation off of.
    if coalesce((select u.raw_app_meta_data ->> 'role' from auth.users u where u.id = v_uid), 'user') = 'user' then
      update public.profiles set role = 'organizer' where id = v_uid;
      update auth.users
         set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'organizer')
       where id = v_uid;
    end if;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      v_uid,
      'founder_request.organization_provisioned',
      'founder_access_request',
      v_request.id,
      jsonb_build_object('organizer_id', v_organizer_id, 'organization_name', v_request.organization_name)
    );
  end if;

  select o.name into v_organizer_name from public.organizers o where o.id = v_organizer_id;
  select om.member_role into v_member_role
    from public.organizer_members om
   where om.organizer_id = v_organizer_id and om.user_id = v_uid;

  return jsonb_build_object(
    'organizerId', v_organizer_id,
    'organizationName', v_organizer_name,
    'role', coalesce(v_member_role, 'owner')
  );
end;
$$;

comment on function public.provision_founder_organization() is
  'Self-service, zero-parameter. Provisions (or idempotently re-affirms) the organizer + owner membership for the caller''s own accepted Founder invitation. Mirrors admin_approve_organizer_request()''s organizer-creation and role-sync conventions exactly.';

-- ------------------------------------------------------------
-- 3. founder_onboarding_state() — read-model resolver
-- ------------------------------------------------------------
-- Single source of truth for what the /founders/welcome route should
-- render. Never exposes reviewer identity, token hash, internal notes,
-- or any other admin-only field — only the four fields the Phase 8 spec
-- names (state, organizerId, organizationName, role) plus the request id
-- needed to retry provisioning.

create or replace function public.founder_onboarding_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid                 uuid := auth.uid();
  v_founder_request_id  uuid;
  v_request_org_name    text;
  v_organizer_id        uuid;
  v_organizer_name      text;
  v_organizer_status    text;
  v_member_role         text;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select fi.founder_request_id
    into v_founder_request_id
    from public.founder_invitations fi
   where fi.accepted_by = v_uid
     and fi.status = 'accepted'
   order by fi.accepted_at desc
   limit 1;

  if v_founder_request_id is null then
    return jsonb_build_object('state', 'not_founder');
  end if;

  select far.organizer_id, far.organization_name
    into v_organizer_id, v_request_org_name
    from public.founder_access_requests far
   where far.id = v_founder_request_id;

  if not found then
    -- Data-integrity edge case (an accepted invitation whose request row
    -- is gone) — surfaced as needing a human, never as fake success.
    return jsonb_build_object('state', 'manual_resolution_required', 'founderRequestId', v_founder_request_id);
  end if;

  if v_organizer_id is null then
    return jsonb_build_object(
      'state', 'accepted_not_provisioned',
      'founderRequestId', v_founder_request_id,
      'organizationName', v_request_org_name
    );
  end if;

  select o.name, o.status into v_organizer_name, v_organizer_status
    from public.organizers o
   where o.id = v_organizer_id;

  select om.member_role into v_member_role
    from public.organizer_members om
   where om.organizer_id = v_organizer_id
     and om.user_id = v_uid
     and om.status = 'active';

  -- Provisioned in name only if the organizer still exists, is active,
  -- and the caller still holds an active membership on it. Any of those
  -- being false (e.g. an admin later removed the membership, or
  -- suspended the organizer) means the "provisioned" state would be
  -- lying — route to manual_resolution_required instead of a welcome
  -- screen for access the user no longer actually has (spec §30).
  if v_organizer_name is null or v_organizer_status <> 'active' or v_member_role is null then
    return jsonb_build_object('state', 'manual_resolution_required', 'founderRequestId', v_founder_request_id);
  end if;

  return jsonb_build_object(
    'state', 'provisioned',
    'organizerId', v_organizer_id,
    'organizationName', v_organizer_name,
    'role', v_member_role
  );
end;
$$;

comment on function public.founder_onboarding_state() is
  'Read-model resolver for /founders/welcome. Returns exactly one of: not_founder, accepted_not_provisioned, manual_resolution_required, provisioned. Never exposes reviewer identity, token hash, or other admin-only fields.';

-- ------------------------------------------------------------
-- 4. Welcome-email claim / complete
-- ------------------------------------------------------------
-- Same claim-before-send principle as the event-submission email work:
-- the claim is a single atomic UPDATE that only one caller can win,
-- taken BEFORE the provider is contacted. A refresh, a second tab, or a
-- client retry all collide on the same guarded UPDATE and send nothing.

create or replace function public.claim_founder_welcome_email()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_request_id     uuid;
  v_organizer_id   uuid;
  v_organizer_name text;
  v_recipient      text;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Only provisioned requests are eligible — structurally enforces
  -- "never before Phase 7 completes" (spec §15/§19): there is no path
  -- to a successful claim while organizer_id is still null.
  update public.founder_access_requests far
     set welcome_email_status = 'pending'
   where far.id = (
     select far2.id
       from public.founder_access_requests far2
       join public.founder_invitations fi on fi.founder_request_id = far2.id
      where fi.accepted_by = v_uid
        and fi.status = 'accepted'
        and far2.organizer_id is not null
        and far2.welcome_email_status is null
      order by fi.accepted_at desc
      limit 1
   )
  returning far.id, far.organizer_id into v_request_id, v_organizer_id;

  if v_request_id is null then
    -- Already claimed/sent, or not yet provisioned, or not a founder at
    -- all — caller must not send in any of those cases.
    return jsonb_build_object('claimed', false);
  end if;

  select o.name into v_organizer_name from public.organizers o where o.id = v_organizer_id;
  select lower(u.email) into v_recipient from auth.users u where u.id = v_uid;

  return jsonb_build_object(
    'claimed', true,
    'organizerId', v_organizer_id,
    'organizationName', v_organizer_name,
    'recipientEmail', v_recipient
  );
end;
$$;

comment on function public.claim_founder_welcome_email() is
  'Atomically claims the right to send the one-shot Founder welcome email for the caller''s own provisioned request. Returns claimed:false when already sent, in flight, or not yet provisioned. Service-facing only (called with the founder''s own JWT, never the service role).';

create or replace function public.complete_founder_welcome_email(
  p_status     text,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_updated integer;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_status not in ('sent', 'failed') then
    raise exception 'status must be sent or failed' using errcode = '22023';
  end if;
  if p_status = 'failed' and coalesce(p_error_code, '') = '' then
    raise exception 'error_code is required when status is failed' using errcode = '22023';
  end if;

  -- Only transitions the caller's OWN pending claim, and only from
  -- pending — a late/duplicate completion can never rewrite a settled
  -- attempt.
  update public.founder_access_requests far
     set welcome_email_status = p_status,
         welcome_email_sent_at = now(),
         welcome_email_error_code = nullif(p_error_code, '')
   where far.id = (
     select far2.id
       from public.founder_access_requests far2
       join public.founder_invitations fi on fi.founder_request_id = far2.id
      where fi.accepted_by = v_uid
        and fi.status = 'accepted'
        and far2.welcome_email_status = 'pending'
      order by fi.accepted_at desc
      limit 1
   );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

comment on function public.complete_founder_welcome_email(text, text) is
  'Closes the caller''s own claimed welcome-email attempt as sent or failed. Only transitions from pending, so a settled attempt is never rewritten.';

-- ------------------------------------------------------------
-- 5. Grants
-- ------------------------------------------------------------
-- Every function here is self-scoped to auth.uid() with zero parameters
-- naming a target — authenticated-only, nothing for anon.

revoke all on function public.provision_founder_organization() from public, anon;
grant  execute on function public.provision_founder_organization() to authenticated;

revoke all on function public.founder_onboarding_state() from public, anon;
grant  execute on function public.founder_onboarding_state() to authenticated;

revoke all on function public.claim_founder_welcome_email() from public, anon;
grant  execute on function public.claim_founder_welcome_email() to authenticated;

revoke all on function public.complete_founder_welcome_email(text, text) from public, anon;
grant  execute on function public.complete_founder_welcome_email(text, text) to authenticated;

commit;

-- ------------------------------------------------------------
-- 6. Notify PostgREST to reload schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

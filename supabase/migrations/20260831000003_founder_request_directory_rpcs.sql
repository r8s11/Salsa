-- =====================================================================
-- Founder Request Directory RPCs — Phase 3
-- =====================================================================
-- Purpose:
--   Read-side RPCs for the admin/moderator Founder Request review queue:
--   the full directory listing, a single-request lookup (review page),
--   and the pending count (sidebar badge). Mirrors the analogous
--   admin_organizer_requests() / admin_organizer_request_detail() /
--   admin_organizer_request_counts() RPCs (supabase/reconcile-prod-schema.sql).
--
--   The write-side RPC (admin_review_founder_request) already exists in
--   20260831000002_founder_review_rpcs.sql. This file only adds reads.
--
-- Authorization:
--   founder_access_requests RLS already grants admins full access and
--   moderators read-only access (20260831000001_founder_access_requests.sql).
--   Because these RPCs are `security definer` (required to run as the
--   function owner and bypass RLS for a stable, single-shape response),
--   they must re-check authorization themselves: public.is_moderator()
--   returns true for both 'admin' and 'moderator' JWT roles, matching the
--   RLS read boundary exactly. No table privileges are granted to
--   anon/public — only `authenticated` gets EXECUTE.
--
-- Required: REQUIRED before deploying Phase 3 application code.
--   Production SQL is manually reviewed and run by the project owner;
--   this file must be applied to production manually. Local dev picks it
--   up through `supabase start` / `supabase db reset`.
--
-- Execution order: standalone. Depends on public.founder_access_requests
--   (20260831000001_founder_access_requests.sql) and public.is_moderator()
--   (20260817000000_event_submissions.sql).
--
-- Data impact: no existing row is changed.
--
-- Rollback considerations:
--   Drop the three functions. No data changes.
-- =====================================================================

-- ------------------------------------------------------------
-- 1. admin_founder_requests — full directory (review queue)
-- ------------------------------------------------------------

drop function if exists public.admin_founder_requests();
create function public.admin_founder_requests()
returns table (
  id                     uuid,
  applicant_name         text,
  email                  text,
  normalized_email       text,
  organization_name      text,
  normalized_org_name    text,
  instagram              text,
  normalized_instagram   text,
  website                text,
  city                   text,
  region                 text,
  description            text,
  message                text,
  status                 text,
  reviewed_by            uuid,
  reviewed_at            timestamptz,
  rejection_reason_code  text,
  rejection_message      text,
  created_at             timestamptz,
  updated_at             timestamptz
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
  select r.id,
         r.applicant_name,
         r.email,
         r.normalized_email,
         r.organization_name,
         r.normalized_org_name,
         r.instagram,
         r.normalized_instagram,
         r.website,
         r.city,
         r.region,
         r.description,
         r.message,
         r.status,
         r.reviewed_by,
         r.reviewed_at,
         r.rejection_reason_code,
         r.rejection_message,
         r.created_at,
         r.updated_at
    from public.founder_access_requests r
   order by r.created_at desc;
end;
$$;

-- ------------------------------------------------------------
-- 2. admin_founder_request_detail — single-request lookup
-- ------------------------------------------------------------

drop function if exists public.admin_founder_request_detail(uuid);
create function public.admin_founder_request_detail(p_id uuid)
returns table (
  id                     uuid,
  applicant_name         text,
  email                  text,
  normalized_email       text,
  organization_name      text,
  normalized_org_name    text,
  instagram              text,
  normalized_instagram   text,
  website                text,
  city                   text,
  region                 text,
  description            text,
  message                text,
  status                 text,
  reviewed_by            uuid,
  reviewed_at            timestamptz,
  rejection_reason_code  text,
  rejection_message      text,
  created_at             timestamptz,
  updated_at             timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.admin_founder_requests() where id = p_id;
$$;

-- ------------------------------------------------------------
-- 3. admin_founder_request_counts — pending count (sidebar badge)
-- ------------------------------------------------------------

drop function if exists public.admin_founder_request_counts();
create function public.admin_founder_request_counts()
returns table (id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'admin or moderator role required' using errcode = '42501';
  end if;
  return query select r.id from public.founder_access_requests r where r.status = 'pending';
end;
$$;

-- ------------------------------------------------------------
-- 4. Grants — authenticated only; admin/moderator check happens inside
-- ------------------------------------------------------------

revoke execute on function public.admin_founder_requests() from public, anon;
grant  execute on function public.admin_founder_requests() to authenticated;

revoke execute on function public.admin_founder_request_detail(uuid) from public, anon;
grant  execute on function public.admin_founder_request_detail(uuid) to authenticated;

revoke execute on function public.admin_founder_request_counts() from public, anon;
grant  execute on function public.admin_founder_request_counts() to authenticated;

-- ------------------------------------------------------------
-- 5. Notify PostgREST to reload schema
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

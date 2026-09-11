-- =====================================================================
-- Host Phase 5 — 001 — attendance authorization helpers
--
-- Purpose:
--   Creates the two authorization predicates every Host attendance policy
--   depends on:
--     - public.is_organizer()                    role check (JWT app_metadata)
--     - public.can_manage_event_attendance(uuid) the single authorization seam
--
--   can_manage_event_attendance() is deliberately the ONLY place the
--   "who may manage attendance for this event" rule is expressed. Every RLS
--   policy in 006 calls it. Widening access later (see "Future" below) is a
--   one-function change, not an N-policy rewrite.
--
-- Required or optional: REQUIRED. Files 002-007 all depend on this file.
--
-- Execution order: FIRST (before 002).
--
-- Dependencies (all verified present on a live database before authoring):
--   - public.events
--   - public.is_admin()
--   - public.account_is_active(uuid)
--
-- Safety notes:
--   - Both functions are STABLE SECURITY DEFINER with a pinned search_path,
--     mirroring the EXISTING repo helpers public.is_admin() / is_moderator() /
--     account_is_active() exactly (verified via pg_get_functiondef).
--   - SECURITY DEFINER here is NOT a permission workaround. It is the
--     documented Supabase pattern for RLS predicates
--     (supabase.com/docs/guides/database/postgres/row-level-security —
--     "use security definer functions" to avoid RLS recursion and per-row
--     policy cost). These functions:
--       * return only a boolean, never row data;
--       * are hard-scoped to (select auth.uid()), so a caller can only ever
--         learn about their own permissions;
--       * grant no mutation rights of any kind;
--       * are revoked from public/anon and granted only to authenticated.
--   - auth.uid() is wrapped in a scalar subquery per current Supabase RLS
--     performance guidance (statement-level caching of the auth function).
--   - Fails closed: no JWT, no role, unowned event, or unapproved event
--     all evaluate to false.
--
-- Whether destructive: NO. Creates two new functions. Touches no data and no
--   existing object. The create-or-replace targets only these two new
--   function signatures; it cannot affect any pre-existing function.
--
-- Rollback considerations: see 900_optional_rollback_host_attendance.sql.
--   These functions cannot be dropped until the 006 policies that reference
--   them are dropped first.
--
-- Future (documented, NOT implemented here):
--   public.events currently has NO organizer_id column — event ownership is
--   events.submitter_id only (verified against information_schema). A separate
--   public.organizers + public.organizer_members model DOES already exist
--   (member_role owner/manager/editor, status active/removed) but is
--   Admin-managed and not linked to events.
--
--   When "multiple authorized door workers" is built, the intended change is
--   confined to can_manage_event_attendance(): add a branch accepting an
--   active organizer_members row for the event's organizer, once events gains
--   an organizer_id. No attendance table, index, or policy needs to change.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. public.is_organizer()
-- ---------------------------------------------------------------------
-- Mirrors public.is_moderator(). Organizer authorization lives in the JWT
-- app_metadata.role claim, which is admin-controlled and NOT user-editable
-- (unlike user_metadata, which must never be used for authorization).
create or replace function public.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'organizer';
$$;

revoke execute on function public.is_organizer() from public, anon;
grant  execute on function public.is_organizer() to authenticated;

comment on function public.is_organizer() is
  'True when the caller JWT app_metadata.role is exactly organizer. Mirrors is_admin()/is_moderator().';

-- ---------------------------------------------------------------------
-- 2. public.can_manage_event_attendance(uuid)
-- ---------------------------------------------------------------------
-- The single authorization seam for all Host attendance data.
--
-- Grants management of an event's attendance when EITHER:
--   (a) the caller is an Organizer, owns the event, the event is approved,
--       and the caller's account is active; or
--   (b) the caller is an Admin (existing repo convention: is_admin() is the
--       operational override used by every other admin policy).
--
-- Moderators are deliberately NOT included: no current product permission
-- gives moderators event-night operational access.
--
-- A plain registered user who merely submitted an event does NOT qualify,
-- because is_organizer() is required in branch (a). This is what keeps Host
-- operational data out of normal users' hands even when they own the row.
create or replace function public.can_manage_event_attendance(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (
        (
          e.status = 'approved'
          and e.submitter_id = (select auth.uid())
          and public.is_organizer()
          and public.account_is_active((select auth.uid()))
        )
        or public.is_admin()
      )
  );
$$;

revoke execute on function public.can_manage_event_attendance(uuid) from public, anon;
grant  execute on function public.can_manage_event_attendance(uuid) to authenticated;

comment on function public.can_manage_event_attendance(uuid) is
  'Single authorization seam for Host attendance data: approved event owned by an active Organizer, or Admin. Extend here (not in policies) for future organizer_members door workers.';

notify pgrst, 'reload schema';

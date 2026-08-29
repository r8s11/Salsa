-- =====================================================================
-- Flyer Automation — Phase 1 — Approval image carry-through (REQUIRED)
-- PURPOSE
--   When a submission is approved, copy the submitter's persisted flyer URL
--   (stored in event_submissions.submitted_data ->> 'image_url' by the public
--   submit flow) into the canonical events.image_url column.
--
-- REQUIRED / OPTIONAL
--   REQUIRED production dependency for the public flyer → event image
--   carry-through. Without this the flyer survives in storage + submitted_data
--   but never reaches the published event.
--
-- MANUAL EXECUTION REQUIRED — DO NOT RUN AUTOMATICALLY
--   This file must be applied by a human in the production database, in order,
--   after confirming 001_preflight.sql passes:
--     1. 001_preflight.sql        (read-only verification)
--     2. 002_update_submission_approval_image.sql  (THIS FILE)
--     3. 004_postcheck.sql        (read-only verification)
--   NO storage-policy SQL is required (see audit note below).
--
-- OBJECTS AFFECTED
--   function public.approve_event_submission (replaced)
--
-- DATA IMPACT
--   None destructive. Only adds image_url to the approval INSERT. Submissions
--   without a flyer keep working: nullif(d->>'image_url','') yields NULL, the
--   existing behavior.
--
-- SECURITY IMPACT
--   Function remains security definer, gated by require_taxonomy_moderator().
--   No new roles or grants touched.
--
-- ROLLBACK CONSIDERATIONS
--   Re-apply the prior function definition (baseline exists in the phase-10
--   taxonomy migration sql/phase-10/002_create_event_taxonomy_terms.sql).
-- =====================================================================

begin;

create or replace function public.approve_event_submission(p_submission_id uuid, p_taxonomy_term_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare s event_submissions%rowtype; d jsonb; v_event_id uuid; ids uuid[]:=coalesce(p_taxonomy_term_ids,'{}'::uuid[]);
begin
  perform public.require_taxonomy_moderator();
  select * into s from event_submissions where id=p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  if s.status not in ('pending','in_review','needs_information') then raise exception 'Submission is not approvable'; end if;
  d:=s.submitted_data||coalesce(s.edited_data,'{}'::jsonb);
  if coalesce(btrim(d->>'title'),'')='' or coalesce(d->>'event_type','')='' or coalesce(d->>'city','')='' or coalesce(d->>'event_date','')='' then raise exception 'Effective submission is missing title, event type, city, or event date'; end if;
  if (select count(*) from taxonomy_terms where id=any(ids) and status='active')<>cardinality(ids) then raise exception 'Approval requires known active taxonomy terms'; end if;
  insert into events(title,description,event_type,event_date,event_time,location,address,price_type,price_amount,rsvp_link,city,status,source_type,submitter_name,submitter_email,image_url)
  values(d->>'title',nullif(d->>'description',''),d->>'event_type',(d->>'event_date')::timestamptz,nullif(d->>'event_time',''),nullif(d->>'location',''),nullif(d->>'address',''),nullif(d->>'price_type',''),nullif(d->>'price_amount','')::numeric,nullif(d->>'rsvp_link',''),d->>'city','approved','moderator',s.submitter_name,s.submitter_email,nullif(d->>'image_url',''))
  returning id into v_event_id;
  insert into event_taxonomy_terms(event_id,taxonomy_term_id) select v_event_id, term_id from unnest(ids) as selected(term_id) on conflict do nothing;
  update event_submissions set status='approved',approved_event_id=v_event_id,reviewed_by=auth.uid(),reviewed_at=now() where id=p_submission_id;
  return v_event_id;
end; $$;

notify pgrst, 'reload schema';
commit;

-- =====================================================================
-- STORAGE POLICY AUDIT — why NO 003_storage_policy_changes.sql exists
-- =====================================================================
-- Production storage.objects RLS for the event-flyers bucket (verified via
-- pg_policies) already provides every permission the submit flow needs:
--
--   "Admins manage event flyers"    ALL   -> to public, bucket_id = 'event-flyers'
--                                            (role app_metadata = 'admin')
--   "Owners insert event flyers"    INSERT-> authenticated, owner-scoped with check
--   "Owners update event flyers"    UPDATE-> authenticated, foldername(name)[1] = auth.uid()
--   "Owners delete event flyers"    DELETE-> authenticated, owner_id + foldername[1] = auth.uid()
--   "Public can read event flyers"  SELECT-> to public, bucket_id = 'event-flyers'
--
-- Per-operation matrix (authenticated = logged-in owner, admin = moderator):
--   SELECT : public (bucket is public AND explicit public SELECT policy exists).
--            Public URL rendering (/object/public/...) does NOT depend on RLS SELECT.
--   INSERT : owner only (with-check gates owner_id + first path segment).
--   UPDATE : owner only.   DELETE : owner only via owner-scoped policies.
--   ALL    : admins only (app_metadata.role = 'admin').
-- Unauthenticated (anon) users: read-only via the public SELECT policy; no write.
--
-- Therefore NO additional storage-policy SQL is required. Creating
-- redundant owner-select/delete policies would duplicate permissions that
-- already exist and is intentionally NOT part of this script.
-- =====================================================================
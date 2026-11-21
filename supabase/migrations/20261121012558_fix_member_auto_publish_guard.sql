-- Fix authenticated member auto-publishing blocked by the legacy submission update guard.
-- Internal transaction-scoped authorization gate; direct member UPDATE remains restricted.
-- This is the migration applied to production as 20261121012558_fix_member_auto_publish_guard.
CREATE TABLE private.member_publish_approval_gate (
  submission_id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  member_id uuid NOT NULL,
  transaction_id xid8 NOT NULL
);
ALTER TABLE private.member_publish_approval_gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.member_publish_approval_gate FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_submitter_submission_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.is_moderator() then
    return new;
  end if;

  -- A trusted materializer may approve exactly this member's one pending submission.
  -- The gate row is internal, bound to this transaction and deleted immediately.
  IF old.status = 'pending'
     AND new.status = 'approved'
     AND old.submitter_id IS NOT NULL
     AND old.submitter_id = auth.uid()
     AND new.submitter_id = old.submitter_id
     AND new.reviewed_by = old.submitter_id
     AND new.reviewed_at IS NOT NULL
     AND new.approved_event_id IS NOT NULL
     AND (to_jsonb(new) - ARRAY['status','reviewed_by','reviewed_at','approved_event_id','updated_at'])
         = (to_jsonb(old) - ARRAY['status','reviewed_by','reviewed_at','approved_event_id','updated_at'])
     AND EXISTS (
       SELECT 1 FROM private.member_publish_approval_gate g
       WHERE g.submission_id = old.id
         AND g.event_id = new.approved_event_id
         AND g.member_id = old.submitter_id
         AND g.transaction_id = pg_current_xact_id()
     )
  THEN
    RETURN new;
  END IF;

  if old.submitter_id is distinct from auth.uid() then
    raise exception 'submission owner required' using errcode = '42501';
  end if;

  if old.status not in ('pending', 'rejected') then
    raise exception 'only pending or rejected submissions may be changed by submitter'
      using errcode = '42501';
  end if;

  -- Owner may retain status while saving edits, or withdraw a pending record.
  if not (
    new.status = old.status
    or (old.status = 'pending' and new.status = 'withdrawn')
  ) then
    raise exception 'submitter may only withdraw a pending submission'
      using errcode = '42501';
  end if;

  -- Canonical source, identity, reviewer workflow, and duplicate handling
  -- remain moderator-owned. An owner may only alter edited_data and the
  -- narrow status transition above; updated_at is maintained separately.
  if new.submitted_data is distinct from old.submitted_data
     or new.submitter_id is distinct from old.submitter_id
     or new.submitter_email is distinct from old.submitter_email
     or new.submitter_name is distinct from old.submitter_name
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.rejection_reason is distinct from old.rejection_reason
     or new.rejection_message is distinct from old.rejection_message
     or new.internal_note is distinct from old.internal_note
     or new.duplicate_of_event_id is distinct from old.duplicate_of_event_id
     or new.dismissed_duplicate_ids is distinct from old.dismissed_duplicate_ids
     or new.approved_event_id is distinct from old.approved_event_id
     or new.submitted_at is distinct from old.submitted_at
     or new.created_at is distinct from old.created_at then
    raise exception 'submitter may only save edited event data or withdraw'
      using errcode = '42501';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.materialize_event_submission(p_submission_id uuid, p_taxonomy_term_ids uuid[], p_source_type text, p_reviewer uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s public.event_submissions%rowtype;
  d jsonb;
  v_event_id uuid;
  ids uuid[] := coalesce(p_taxonomy_term_ids, '{}'::uuid[]);
  v_review jsonb;
  v_result jsonb;
  v_ctx jsonb;
  v_types text[];
begin
  if p_source_type not in ('moderator', 'user_submission') then
    raise exception 'invalid source_type' using errcode = '22023';
  end if;
  select * into s from public.event_submissions where id = p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  -- Replay (or a concurrent second approval that waited on the row lock).
  if s.status = 'approved' and s.approved_event_id is not null then
    return s.approved_event_id;
  end if;
  if s.status not in ('pending', 'in_review', 'needs_information') then
    raise exception 'Submission is not approvable';
  end if;
  -- edited_data is only an overlay when something with write provenance
  -- (a signed-in user's update or a trusted server writer) put it there; a
  -- value that arrived via a public INSERT, or predates provenance tracking
  -- without an audited edit, is ignored.
  d := s.submitted_data || case when s.edited_data_by is not null then coalesce(s.edited_data, '{}'::jsonb) else '{}'::jsonb end;
  v_types := case
    when s.edited_data_by is not null
     and (jsonb_exists(coalesce(s.edited_data, '{}'::jsonb), 'event_types') or jsonb_exists(coalesce(s.edited_data, '{}'::jsonb), 'event_type'))
      then public.event_types_from_payload(s.edited_data, false)
    else public.event_types_from_payload(s.submitted_data, false)
  end;
  if coalesce(btrim(d ->> 'title'), '') = '' or v_types is null
     or coalesce(d ->> 'city', '') = '' or coalesce(d ->> 'event_date', '') = '' then
    raise exception 'Effective submission is missing title, event type, city, or event date';
  end if;
  if (select count(*) from public.taxonomy_terms where id = any(ids) and status = 'active') <> cardinality(ids) then
    raise exception 'Approval requires known active taxonomy terms';
  end if;

  insert into public.events (
    title, description, event_type, event_types, event_date, event_time, location, address, price_type, price_amount,
    rsvp_link, city, sublocation, neighborhood, status, source_type, submitter_name, submitter_email, image_url, image_urls)
  values (
    d ->> 'title', nullif(d ->> 'description', ''), v_types[1], v_types, (d ->> 'event_date')::timestamptz,
    nullif(d ->> 'event_time', ''), nullif(d ->> 'location', ''), nullif(d ->> 'address', ''),
    nullif(d ->> 'price_type', ''), nullif(d ->> 'price_amount', '')::numeric, nullif(d ->> 'rsvp_link', ''),
    d ->> 'city',
    public.event_sublocation_resolve(d ->> 'city', d ->> 'sublocation', s.edited_data_by is not null and jsonb_exists(coalesce(s.edited_data, '{}'::jsonb), 'city') and not jsonb_exists(coalesce(s.edited_data, '{}'::jsonb), 'sublocation') and (s.edited_data ->> 'city') is distinct from (s.submitted_data ->> 'city')),
    public.event_neighborhood_resolve(d ->> 'city', d ->> 'sublocation', case when s.edited_data_by is not null and not jsonb_exists(coalesce(s.edited_data, '{}'::jsonb), 'neighborhood') and ((d ->> 'city') is distinct from (s.submitted_data ->> 'city') or (d ->> 'sublocation') is distinct from (s.submitted_data ->> 'sublocation')) then null else d ->> 'neighborhood' end, false),
    'approved', p_source_type, s.submitter_name, s.submitter_email,
    (public.event_flyers_from_payload(d))[1], public.event_flyers_from_payload(d))
  returning id into v_event_id;

  insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
  select v_event_id, term_id from unnest(ids) as selected(term_id)
  on conflict do nothing;

  -- Only the moderator-confirmed snapshot is trusted; the submitter's own
  -- entity_review (submitted_data) never creates or links anything.
  v_review := public.flyer_moderated_review(s.moderator_entity_review, s.submitted_data -> 'entity_review');
  if v_review is not null then
    v_ctx := jsonb_build_object('source_type', 'submission_approval', 'event_id', v_event_id,
                                'submission_id', s.id, 'flyer_url', nullif(d ->> 'image_url', ''));
    v_result := public.flyer_apply_entity_review(v_review, v_ctx, null, null);
    update public.events ev set
      venue_id = (v_result ->> 'venue_id')::uuid,
      organizer_id = (v_result ->> 'organizer_id')::uuid,
      entity_review = v_result -> 'review'
    where ev.id = v_event_id;
    perform public.flyer_sync_event_links(v_event_id, v_result);
  end if;

  IF p_source_type = 'user_submission' THEN
    IF auth.uid() IS NULL
       OR s.submitter_id IS DISTINCT FROM auth.uid()
       OR p_reviewer IS DISTINCT FROM s.submitter_id
    THEN
      RAISE EXCEPTION 'Self-publication must be by the submission owner' USING ERRCODE='42501';
    END IF;
    INSERT INTO private.member_publish_approval_gate(submission_id,event_id,member_id,transaction_id)
    VALUES (s.id,v_event_id,s.submitter_id,pg_current_xact_id());
  END IF;

  update public.event_submissions
     set status = 'approved', approved_event_id = v_event_id, reviewed_by = p_reviewer, reviewed_at = now()
   where id = p_submission_id;
  IF p_source_type = 'user_submission' THEN
    DELETE FROM private.member_publish_approval_gate
    WHERE submission_id=s.id AND event_id=v_event_id AND transaction_id=pg_current_xact_id();
  END IF;
  return v_event_id;
end;
$function$
;

NOTIFY pgrst, 'reload schema';

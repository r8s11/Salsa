-- Signed-in members publish their own event submissions without waiting for
-- moderator approval. Plan: docs/plans/registered-event-auto-publish.md.
--
-- 1. platform_settings gains a kill switch, off by default. Turning it off
--    stops new auto-publishes; it never hides events already published.
-- 2. The body of approve_event_submission() moves into the internal
--    materialize_event_submission(), shared by moderator approval and member
--    self-publishing. approve_event_submission() keeps its signature, grants
--    and moderator guard. Later patches to the submission -> event mapping
--    must target materialize_event_submission().
-- 3. auto_publish_block_reason() decides account eligibility: switch on,
--    member submissions open, active account, confirmed email, fewer than 3
--    self-publishes in the preceding 24 hours. Takedowns do not restore quota.
-- 4. publish_own_event_submission() lets the submitter publish their own
--    pending single event. Ineligible, repeating or invalid submissions stay
--    pending for normal review; the function returns why instead of raising.
-- 5. admin_take_down_event() lets an admin archive an auto-published event
--    with a recorded reason.
--
-- One event per submission: both publish paths lock the submission row and
-- return the existing event when it is already approved, so a moderator
-- approval racing a self-publish creates at most one event.
--
-- Auto-published events use source_type 'user_submission' (moderator approval
-- keeps 'moderator'). The submitter's own entity_review is never trusted: like
-- an approval with no moderator snapshot, self-publishing links no venue,
-- organizer, school or instructor.

-- ── 1. Settings ──────────────────────────────────────────────────────────────

alter table public.platform_settings
  add column if not exists registered_auto_publish_enabled boolean not null default false;

comment on column public.platform_settings.registered_auto_publish_enabled is
  'Whether eligible signed-in members publish their own single-event submissions without moderator review';

-- ── 2. Shared materializer ───────────────────────────────────────────────────

create or replace function public.materialize_event_submission(
  p_submission_id uuid,
  p_taxonomy_term_ids uuid[],
  p_source_type text,
  p_reviewer uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  update public.event_submissions
     set status = 'approved', approved_event_id = v_event_id, reviewed_by = p_reviewer, reviewed_at = now()
   where id = p_submission_id;
  return v_event_id;
end;
$$;

-- Internal only: callers are the two guarded RPCs below.
revoke all on function public.materialize_event_submission(uuid, uuid[], text, uuid) from public, anon, authenticated;

comment on function public.materialize_event_submission(uuid, uuid[], text, uuid) is
  'Internal. Turns a submission into an approved event. Called by approve_event_submission (moderators) and publish_own_event_submission (eligible submitters); never granted to clients.';

create or replace function public.approve_event_submission(p_submission_id uuid, p_taxonomy_term_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_moderator() or not public.account_is_active(auth.uid()) then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;
  return public.materialize_event_submission(p_submission_id, p_taxonomy_term_ids, 'moderator', auth.uid());
end;
$$;

-- ── 3. Eligibility ───────────────────────────────────────────────────────────

-- NULL when p_user may self-publish now; otherwise the first reason they may
-- not: disabled, inactive, email_unverified or daily_limit. Every successful
-- self-publish counts toward the limit, including ones later taken down.
create or replace function public.auto_publish_block_reason(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not coalesce((select ps.registered_auto_publish_enabled and ps.allow_registered_user_submissions
                       from public.platform_settings ps where ps.singleton), false)
      then 'disabled'
    when p_user is null or not public.account_is_active(p_user)
      then 'inactive'
    when not exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null)
      then 'email_unverified'
    when (select count(*) from public.event_submissions es
           where es.submitter_id = p_user
             and es.status = 'approved'
             and es.reviewed_by = p_user
             and es.reviewed_at > now() - interval '24 hours') >= 3
      then 'daily_limit'
  end;
$$;

revoke all on function public.auto_publish_block_reason(uuid) from public, anon, authenticated;

-- The caller's own eligibility, so /submit can describe what will happen
-- before anything is sent. A hint only: publishing re-checks.
create or replace function public.my_auto_publish_block_reason()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.auto_publish_block_reason(auth.uid());
$$;

revoke all on function public.my_auto_publish_block_reason() from public, anon;
grant execute on function public.my_auto_publish_block_reason() to authenticated;

-- ── 4. Self-publish ──────────────────────────────────────────────────────────

-- Returns {published: true, event_id, event_status} or
-- {published: false, reason[, event_id, event_status]}. Reasons: the block
-- reasons above, recurring, needs_review (incomplete or unsafe to publish
-- unreviewed) or not_pending (already decided). A retry returns the existing
-- event and its current status; an archived event is never republished.
create or replace function public.publish_own_event_submission(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  s public.event_submissions%rowtype;
  d jsonb;
  v_reason text;
  v_ids uuid[];
  v_event_id uuid;
  v_event_status text;
  v_valid boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- Serialize one member's publishes so concurrent calls cannot both pass the
  -- daily limit.
  perform pg_advisory_xact_lock(hashtextextended('publish_own_event_submission:' || v_uid::text, 0));

  select * into s from public.event_submissions where id = p_submission_id for update;
  -- Someone else's id reads exactly like a missing one.
  if not found or s.submitter_id is distinct from v_uid then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if s.status = 'approved' and s.approved_event_id is not null then
    select ev.status into v_event_status from public.events ev where ev.id = s.approved_event_id;
    return case when v_event_status = 'approved'
      then jsonb_build_object('published', true, 'event_id', s.approved_event_id, 'event_status', v_event_status)
      else jsonb_build_object('published', false, 'reason', 'not_pending', 'event_id', s.approved_event_id, 'event_status', v_event_status)
    end;
  end if;
  if s.status <> 'pending' then
    return jsonb_build_object('published', false, 'reason', 'not_pending');
  end if;

  v_reason := public.auto_publish_block_reason(v_uid);
  if v_reason is not null then
    return jsonb_build_object('published', false, 'reason', v_reason);
  end if;

  -- The same effective payload the materializer publishes.
  d := s.submitted_data || case when s.edited_data_by is not null then coalesce(s.edited_data, '{}'::jsonb) else '{}'::jsonb end;

  if coalesce(btrim(d ->> 'recurrence'), '') <> '' then
    return jsonb_build_object('published', false, 'reason', 'recurring');
  end if;

  -- Public listing checks a moderator would otherwise make: a real, current
  -- date and only http(s) links that a dancer will be sent to.
  begin
    v_valid := (d ->> 'event_date')::timestamptz >= now() - interval '1 day'
      and (coalesce(d ->> 'rsvp_link', '') = ''
           or (char_length(d ->> 'rsvp_link') <= 2048 and (d ->> 'rsvp_link') ~* '^https?://[^[:space:]]+$'))
      and not exists (select 1 from unnest(public.event_flyers_from_payload(d)) as flyer(url)
                       where flyer.url !~* '^https://[^[:space:]]+$');
  exception when others then
    v_valid := false;
  end;
  if v_valid is not true then
    return jsonb_build_object('published', false, 'reason', 'needs_review');
  end if;

  -- Moderators choose taxonomy terms by hand; here the submitted dance styles
  -- map to active dance-style terms. Unknown styles are dropped, never created.
  select coalesce(array_agg(t.id), '{}') into v_ids
    from public.taxonomy_terms t
   where t.category = 'dance_style'
     and t.status = 'active'
     and t.slug in (
       select lower(btrim(style))
         from jsonb_array_elements_text(
                case when jsonb_typeof(d -> 'dance_styles') = 'array'
                     then d -> 'dance_styles' else '[]'::jsonb end) as style);

  begin
    v_event_id := public.materialize_event_submission(p_submission_id, v_ids, 'user_submission', v_uid);
  exception when others then
    -- Anything the materializer rejects stays pending for a moderator; the
    -- subtransaction leaves no partial event, approval or quota charge.
    raise log 'publish_own_event_submission %: % (%)', p_submission_id, sqlerrm, sqlstate;
    return jsonb_build_object('published', false, 'reason', 'needs_review');
  end;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, target_type, target_id, target_name)
  values (v_uid, 'event.auto_published', 'event', v_event_id,
          jsonb_build_object('submission_id', s.id, 'title', d ->> 'title'),
          'event_submission', s.id, d ->> 'title');

  return jsonb_build_object('published', true, 'event_id', v_event_id, 'event_status', 'approved');
end;
$$;

revoke all on function public.publish_own_event_submission(uuid) from public, anon;
grant execute on function public.publish_own_event_submission(uuid) to authenticated;

-- ── 5. Admin takedown ────────────────────────────────────────────────────────

-- Archives an auto-published event (hidden from the public by RLS) and records
-- who took it down, when, why and from which submission. Returns the event's
-- resulting status. Repeating it on an archived event changes nothing.
create or replace function public.admin_take_down_event(p_event_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  e public.events%rowtype;
  v_submission_id uuid;
begin
  if v_uid is null or not public.is_platform_admin() or not public.account_is_active(v_uid) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 3 and 500 then
    raise exception 'A reason of 3 to 500 characters is required' using errcode = '22023';
  end if;
  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if e.source_type <> 'user_submission' then
    raise exception 'Only member-published events can be taken down here' using errcode = '22023';
  end if;
  if e.status = 'archived' then
    return e.status;
  end if;

  update public.events set status = 'archived' where id = p_event_id;
  select es.id into v_submission_id from public.event_submissions es where es.approved_event_id = p_event_id limit 1;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, reason, metadata, target_type, target_id, target_name)
  values (v_uid, 'event.taken_down', 'event', p_event_id, v_reason,
          jsonb_build_object('title', e.title, 'from_status', e.status, 'submission_id', v_submission_id),
          'event', p_event_id, e.title);
  return 'archived';
end;
$$;

revoke all on function public.admin_take_down_event(uuid, text) from public, anon;
grant execute on function public.admin_take_down_event(uuid, text) to authenticated;

notify pgrst, 'reload schema';

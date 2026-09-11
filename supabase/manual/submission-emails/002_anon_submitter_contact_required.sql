-- ============================================================================
-- Event Submission Email Notifications — 002: anonymous submitter contact
-- ============================================================================
--
-- PURPOSE
--   Makes submitter name + email a genuine requirement for NEW anonymous
--   event submissions, at the database layer.
--
--   AUDIT FINDING THIS FIXES
--   The intended public experience is "Name + Email + Event Details", but
--   before this file none of the three enforcement layers actually required
--   either field:
--     * HTML:  src/features/events/components/EventForm/EventForm.tsx had no
--              `required` on either input (fixed in the same change as this
--              file).
--     * Pure validation: validateSubmitForm() only capped their LENGTH, it
--              never checked presence or email shape (also fixed).
--     * Database: event_submissions.submitter_email / submitter_name are
--              `text null`, and the "Anon can submit" policy checked only
--              public_event_suggestions_enabled() / status / submitter_id.
--              THIS FILE.
--
--   Without a database rule, an anonymous row with no contact address can
--   still be created by any direct REST insert with the publishable key —
--   bypassing the browser entirely. Such a row can never receive a
--   confirmation, approval, or rejection email: the workflow is silently
--   incomplete for it.
--
-- REQUIRED vs OPTIONAL
--   RECOMMENDED, not required. The Edge Function handles a missing address
--   gracefully (it records a `no_recipient` attempt and returns
--   `skipped: "no_recipient"` rather than failing), so email works without
--   this file. Apply it to close the bypass and guarantee every future
--   anonymous submission is reachable.
--
--   Deliberately scoped to ANONYMOUS inserts only. Authenticated submissions
--   carry identity through submitter_id -> auth.users.email, and the CSV
--   importer (src/features/admin/api/csvImportRepo.ts) inserts as an
--   authenticated moderator with submitter_name 'Salsa Segura'. Neither is
--   affected.
--
-- EXECUTION ORDER
--   1. 001_email_delivery_attempts.sql                      — required
--   2. THIS FILE (002_anon_submitter_contact_required.sql)   — recommended
--   3. 003_postcheck.sql                                    — verification
--
-- SAFETY NOTES
--   (a) INSERT-ONLY, and that choice is load-bearing.
--
--   A CHECK constraint was the obvious implementation and is the WRONG one
--   here, including when added NOT VALID. `NOT VALID` only skips the initial
--   full-table scan; PostgreSQL still enforces the constraint on every
--   subsequent UPDATE of an existing row. Legacy anonymous submissions with a
--   null email would therefore become unmoderatable — approving or rejecting
--   one only changes `status`, but the UPDATE would be re-checked against the
--   constraint and fail. That would break the review queue for exactly the
--   rows most likely to still be sitting in it.
--
--   The rule is enforced instead by:
--     1. the anon INSERT RLS policy (governs the `anon` role), and
--     2. a BEFORE INSERT trigger (governs every writer, including the service
--        role and any future SECURITY DEFINER path).
--
--   A BEFORE INSERT trigger fires on INSERT only. Historical rows stay
--   readable, reviewable, editable, approvable, and rejectable, verifiably —
--   see 003_postcheck.sql query 8.
--
--   (b) THE SUBMISSION GATE IS PRESERVED VERBATIM.
--
--   The replacement policy below keeps all three original clauses from the
--   audited production policy, in their original order:
--       public.public_event_suggestions_enabled()
--       and status = 'pending'
--       and submitter_id is null
--   The contact requirement is ADDED as a fourth clause. Dropping the
--   public_event_suggestions_enabled() gate would re-open anonymous inserts
--   whenever the owner turns public suggestions off in
--   /admin/settings — the exact opposite of the intended behaviour. Query 6
--   in 003_postcheck.sql asserts all four clauses are present.
--
--   Run the pre-flight count below first. A non-zero result is expected and
--   harmless: it is the size of the historical population that keeps working
--   but can never be emailed.
--
-- ROLLBACK CONSIDERATIONS
--   Fully reversible, no data loss:
--
--     drop trigger if exists event_submissions_require_anon_contact
--       on public.event_submissions;
--     drop function if exists public.require_anon_submitter_contact();
--
--     drop policy if exists "Anon can submit" on public.event_submissions;
--     create policy "Anon can submit"
--       on public.event_submissions for insert to anon
--       with check (
--         public.public_event_suggestions_enabled()
--         and status = 'pending'
--         and submitter_id is null
--       );
--
--     drop function if exists public.anon_submitter_contact_is_valid(text, text);
--     notify pgrst, 'reload schema';
--
--   That restores the production policy exactly as audited, gate included.
--   The frontend `required` attributes and validateSubmitForm() presence
--   checks are independent of this file — reverting the SQL does not re-open
--   the browser path.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. PRE-FLIGHT — run this first, on its own, and read the result
-- ----------------------------------------------------------------------------
-- Counts existing anonymous submissions that would not satisfy the new rule.
-- These rows are NOT modified, deleted, or constrained by this file.
--
--   select
--     count(*) as anon_rows_without_contact,
--     count(*) filter (where status = 'pending') as still_pending
--   from public.event_submissions
--   where submitter_id is null
--     and (
--       coalesce(btrim(submitter_email), '') = ''
--       or coalesce(btrim(submitter_name), '') = ''
--     );

begin;

-- ----------------------------------------------------------------------------
-- 1. Shared predicate
-- ----------------------------------------------------------------------------
-- One definition used by both the RLS policy and the trigger, so the two
-- enforcement points cannot drift apart.
--
-- The email pattern matches the shape used by
-- supabase/functions/_shared/invitation.ts normalizeEmail()
-- (/^[^\s@]+@[^\s@]+\.[^\s@]+$/) so the database and the Edge Functions agree
-- on what an address looks like. It is a plausibility check, not a delivery
-- guarantee — no regex is.

create or replace function public.anon_submitter_contact_is_valid(
  p_submitter_name  text,
  p_submitter_email text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select btrim(coalesce(p_submitter_name, '')) <> ''
     and char_length(btrim(p_submitter_name)) <= 300
     and btrim(coalesce(p_submitter_email, '')) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     and char_length(btrim(p_submitter_email)) <= 300;
$$;

comment on function public.anon_submitter_contact_is_valid(text, text) is
  'True when an anonymous submission carries a usable name and a plausible email. Shared by the "Anon can submit" RLS policy and the require_anon_submitter_contact() trigger so both enforce one definition.';

revoke all on function public.anon_submitter_contact_is_valid(text, text) from public;
grant execute on function public.anon_submitter_contact_is_valid(text, text)
  to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. RLS: anonymous inserts must carry a name and a plausible email
-- ----------------------------------------------------------------------------
-- Replaces the audited production policy. Its three original clauses are
-- reproduced verbatim and in order; the contact requirement is the fourth.
--
-- public_event_suggestions_enabled() MUST stay first: it is the owner's
-- master switch for anonymous submission, and losing it here would silently
-- re-enable anonymous inserts after the owner disabled them.

drop policy if exists "Anon can submit" on public.event_submissions;

create policy "Anon can submit"
  on public.event_submissions
  for insert
  to anon
  with check (
    public.public_event_suggestions_enabled()
    and status = 'pending'
    and submitter_id is null
    -- Contact requirement (Event Submission Email Notifications).
    -- An anonymous submitter has no account, so these two fields are the
    -- ONLY way to reach them about their own submission.
    and public.anon_submitter_contact_is_valid(submitter_name, submitter_email)
  );

-- ----------------------------------------------------------------------------
-- 3. Defence in depth: BEFORE INSERT trigger
-- ----------------------------------------------------------------------------
-- The RLS policy governs the `anon` role only. This trigger governs every
-- writer — service role included — so the invariant cannot be sidestepped by
-- changing which role performs the insert.
--
-- INSERT-only. Never fires on UPDATE, so moderating a legacy null-contact row
-- works unchanged. This is the specific reason a CHECK constraint was
-- rejected; see SAFETY NOTES (a) above.
--
-- The trigger deliberately does NOT re-check public_event_suggestions_enabled().
-- That gate is an access-policy decision belonging to the anon RLS policy;
-- re-applying it here would block the authenticated CSV importer and
-- moderator-created submissions whenever public suggestions are off.

create or replace function public.require_anon_submitter_contact()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Authenticated submissions are reachable through submitter_id.
  if new.submitter_id is not null then
    return new;
  end if;

  if not public.anon_submitter_contact_is_valid(new.submitter_name, new.submitter_email) then
    raise exception
      'An anonymous event submission requires a submitter name and a valid submitter email.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.require_anon_submitter_contact() is
  'BEFORE INSERT guard: an anonymous event submission must carry a name and a plausible email. INSERT-only by design so historical null-contact rows stay moderatable.';

drop trigger if exists event_submissions_require_anon_contact on public.event_submissions;
create trigger event_submissions_require_anon_contact
  before insert on public.event_submissions
  for each row execute function public.require_anon_submitter_contact();

commit;

-- ----------------------------------------------------------------------------
-- 4. Notify PostgREST to reload schema
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';

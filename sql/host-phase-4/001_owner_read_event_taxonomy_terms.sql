-- =====================================================================
-- Host Phase 4 — owner-read policy for event_taxonomy_terms
--
-- Purpose:
--   `public.event_taxonomy_terms` currently has only two SELECT policies:
--     - "Moderators read event taxonomy terms" (is_moderator())
--     - "Public approved event taxonomy is readable" (event.status = 'approved'
--       AND term.status = 'active')
--   There is NO policy letting an event's own submitter (Organizer/Host)
--   read the taxonomy_term rows for their OWN pending or rejected event.
--
--   Verified against a live local Supabase instance (2026-08-25, this repo's
--   own migrations applied): `\d public.event_taxonomy_terms` in psql shows
--   exactly those two SELECT policies, nothing owner-scoped.
--
--   Effect today: `eventsRepo.fetchMySubmissions()` / `fetchMyApprovedEvents()`
--   both select the nested relation
--     event_taxonomy_terms(taxonomy_term_id, taxonomy_terms(id, name, slug, category, status))
--   For a Host's own PENDING or REJECTED event this nested relation
--   silently returns an empty array — RLS blocks the row, PostgREST does not
--   error, it just omits it. `taxonomy_term_ids` / `taxonomy_terms` are then
--   empty on `DatabaseEvent`. This already affects the shipped Host
--   Dashboard, My Events, and this phase's new Host Event Detail page
--   (dance styles silently show as "not set" for pending/rejected events).
--   It does NOT affect approved events (already publicly readable) or
--   Admin/Moderator views (already covered by is_moderator()).
--
-- Category: Now
--   (pre-existing production gap affecting already-shipped Host UI, not
--   newly introduced by Phase 4 — flagging it "Now" rather than "Later"
--   because the truthful-data requirement across every Host phase depends
--   on it.)
--
-- Required / Optional: Recommended — UI already degrades gracefully
--   (renders no dance-style chips rather than erroring or crashing), so
--   this is not a hard blocker for Phase 4, but the displayed data is
--   currently incomplete for pending/rejected Host events.
--
-- Execution order: standalone, no dependency on other Phase 4 files
--   (there are no other Phase 4 SQL files).
--
-- Tables affected: public.event_taxonomy_terms (RLS policy only; no
--   schema, column, or data change).
--
-- Data impact: none. Adds a read-only SELECT policy. No rows are
--   inserted, updated, or deleted. No existing policy is dropped or
--   narrowed.
--
-- Safety notes:
--   - Idempotent: `drop policy if exists` before `create policy`.
--   - Ownership check mirrors the existing pattern already proven safe on
--     public.events itself ("Users can view own submissions": submitter_id
--     = auth.uid()) — same predicate shape, applied here via an EXISTS
--     join back to public.events so event_taxonomy_terms rows are scoped
--     by the owning event's submitter_id, not by any user-editable value.
--   - Does not grant INSERT/UPDATE/DELETE — those remain moderator-only via
--     the existing "Moderators manage event taxonomy terms" policy.
--   - Does not touch public.taxonomy_terms or public.events policies.
--
-- Rollback:
--   drop policy if exists "Owners read own event taxonomy terms" on public.event_taxonomy_terms;
--
-- IMPORTANT: This script is NOT executed by the agent. Review and run
-- manually against the target Supabase project's SQL editor / migration
-- pipeline.
-- =====================================================================

drop policy if exists "Owners read own event taxonomy terms" on public.event_taxonomy_terms;

create policy "Owners read own event taxonomy terms"
on public.event_taxonomy_terms
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_taxonomy_terms.event_id
      and e.submitter_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

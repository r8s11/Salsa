# Recovery Phase 4A-2: Flyer Venue Reconciliation UI

## Goal
Integrate the merged `reconcile-flyer` Supabase function into the Event Submission flyer flow as enrichment-only. Reconcile extracted venue data, prefill canonical venue fields for exact/strong matches, preserve raw extraction display, and never persist `venue_id`.

## Contract
Request: `{ venue: { name: string | null; address: string | null; city: string | null } }`.
Response: `{ venue: { status: "exact" | "strong" | "ambiguous" | "none"; match: { id: string; name: string; address: string | null; city: string | null } | null } }`.
Invoke Supabase function `reconcile-flyer`.

## Tasks

### Task 1: Add reconciliation types and client
Create `src/features/entity-matching/types.ts` with runtime validation for the response contract and `src/features/entity-matching/reconcileClient.ts` using the existing flyer extraction Supabase invocation pattern. Send only venue name/address/city. Convert invocation, malformed response, and parse failures to safe user-facing errors. Add focused client/parser tests matching repository conventions.

### Task 2: Integrate reconciliation into extraction hook
Update `src/features/submit-event/hooks/useSubmitEventForm.ts` only. Add reconciliation state exposed from the hook. Reuse the existing `extractionGeneration` and latest `formRef`; clear reconciliation state whenever the flyer is replaced, removed, or reset after submit. Keep `isExtracting` true through reconciliation and prefill. After extraction, guard generation, reconcile, guard again, then for exact/strong matches build a copied `ExtractedEvent` with canonical `venue_name`, `address`, and `city` and pass it to unchanged `applyExtractionToDraft`; for ambiguous/none retain raw values. Keep extraction panel raw. Reconciliation errors are enrichment-only: preserve normal extraction/prefill and expose a non-blocking state. Add tests for exact/strong enrichment, ambiguous/none behavior, errors, latest-form preservation, stale extraction/reconciliation races, duplicate guard, and reset clearing.

### Task 3: Add reconciliation indicator to submit page
Update `src/pages/SubmitEventPage.tsx` and minimal adjacent styles only if required. Render a concise accessible status/notice for reconciliation loading/result/error near the existing flyer extraction feedback. Do not expose organizer matching, do not display or persist `venue_id`, and do not replace raw extraction values in `FlyerExtractionPanel`. Add a page-level test for the user-visible indicator and enrichment-only failure behavior.

### Validation and delivery
Deploy the already-merged backend with `supabase functions deploy reconcile-flyer --use-api` before hosted production use. Run authenticated hosted smoke tests for known exact/strong and unknown none cases and verify no DB mutation if credentials are available; document a blocker if unavailable. Run focused tests, `npm run build`, `npm run lint`, and `npm test`, comparing clean-main baseline failures. Commit as `feat: integrate venue reconciliation into flyer prefill`, push `feat/flyer-venue-reconciliation-ui`, and open a PR against `main` without auto-merging.

## Global constraints
- Frontend-only. Do not modify `supabase/functions/reconcile-flyer/*`, backend, DB, migrations, RLS, or schema.
- No organizer matching.
- No `venue_id` persistence or submission payload changes.
- Enrichment-only: extraction and form submission remain functional if reconciliation fails.
- User-entered form values win through the existing prefill rules.
- Use the fresh clone `/tmp/salsa-4a2`; leave the contaminated primary checkout untouched.
- Follow subagent-driven development: fresh implementer and task reviewer per task, scoped fix loops, final whole-branch review.

## Definition of Done
All three implementation tasks are reviewed cleanly; exact/strong canonical enrichment, ambiguous/none preservation, stale-request and duplicate guards, reset behavior, accessible UI status, and failure degradation are verified; no prohibited backend/DB/organizer/venue persistence changes exist; validation results and any hosted deployment limitation are reported; branch is committed and PR opened.

## Completion report
Report: implementation summary, files changed, tests and commands with results, hosted deployment/smoke-test status, prohibited-scope audit, review outcomes, rulings made with cost if wrong, commit and PR URLs, and any remaining blocker.

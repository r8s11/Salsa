# Admin Analytics Phase 1.5 — Test Failure Classification

## Evidence boundary

Phase 1 commit: `6689ce1`. Exact parent/preimplementation baseline: `e741f55`. A detached disposable baseline checkout used identical installed dependencies and copied local-only environment files. All eight named files were run individually in both trees, `--maxWorkers=1`, unchanged default test timeout. No tests, expectations, application implementation, or timeout configuration were modified. Two independent investigation groups ran concurrently; this controls dependency differences, not all shared-host load.

Both comparisons used Node `v24.21.0`, matching the project's `.nvmrc` major `24`, and npm `12.2.0`. The manifest declares npm `11.6.2`; this difference is recorded, not established as a failure cause. The shared host has four CPUs and 7.6GiB RAM. The disposable baseline worktree was removed after all individual comparisons completed; JSON evidence remains outside the repository.

The original 1,800.36-second full-suite run emitted names and durations but never its final error stacks. Exact **original** errors are unavailable. The errors below are exact first-line messages from the new individual-run JSON reports, with repetitive Testing Library guidance/DOM omitted. `Error: STACK_TRACE_ERROR` is a Vitest timeout stack placeholder, not an application exception: `node_modules/@vitest/runner/dist/chunk-artifact.js:2404-2409` builds the actual timeout message, then replaces its stack with the test-definition stack. Separate default-reporter diagnostics confirmed `Error: Test timed out in 5000ms.` for CalendarListView bounded pages and CalendarSubmissionDialog in-flight locking. The full-suite gate keeps the default reporter as well as JSON to retain actual timeout messages.

## Classification of the original 30 failures

- 24 original named tests fail in both current and preimplementation trees. A 25th fails only in the baseline and currently passes. These prove failures existed before Phase 1, not that every observed error has an identical cause.
- Three original editor tests pass baseline but time out currently. They remain unresolved current-only outcomes, not proven analytics regressions or proven machine-resource failures.
- Two original tests pass in both individual runs; their historical causes remain unverified.
- No defect introduced by Phase 1 is established. No unrelated fix was attempted.
- Time-budget failures are confirmed; CPU/memory contention as their underlying cause is not. The original run overlapped lint, builds, and Chromium. The original full-suite timeout cause also remains unverified.

| File | Tests | Current failures | Baseline failures |
| --- | ---: | ---: | ---: |
| AdminEventEditor.extraction.test.tsx | 33 | 25 | 21 |
| SubmitEventPage.extraction.test.tsx | 23 | 1 | 1 |
| BulkFlyerImportPage.test.tsx | 14 | 2 | 3 |
| Calendar.test.tsx | 26 | 3 | 7 |
| ProfileEditPage.test.tsx | 25 | 2 | 2 |
| PublicWorkspaceSurfaces.test.tsx | 11 | 1 | 1 |
| CalendarListView.test.tsx | 6 | 1 | 1 |
| CalendarSubmissionDialog.test.tsx | 3 | 3 | 3 |
| **Total** | **141** | **38** | **39** |

## Every originally reported failure

“Pre-existing failure” means the same test fails before Phase 1; it does not establish the underlying application/environment root cause. Current-only outcomes remain unresolved.

| File / test title | Current | Baseline | Current error | Baseline error | Classification |
| --- | --- | --- | --- | --- | --- |
| AdminEventEditor.extraction.test.tsx — uploads the flyer under the admin's own id so analysis can read it | failed | passed | `Error: STACK_TRACE_ERROR` | — | current-only; unresolved |
| AdminEventEditor.extraction.test.tsx — keeps the applied fields editable by hand | failed | passed | `Error: STACK_TRACE_ERROR` | — | current-only; unresolved |
| AdminEventEditor.extraction.test.tsx — fills location and address from the venue the admin explicitly chose | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — keeps the flyer's raw venue text while the match is still undecided | failed | passed | `Error: STACK_TRACE_ERROR` | — | current-only; unresolved |
| AdminEventEditor.extraction.test.tsx — keeps the flyer's raw venue text when the admin confirms the venue as new | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — hands the reviewed entities and the admin's decisions to onSubmit | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — does not submit an entity review when the flyer produced none | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — keeps decided and edited candidates and never re-adds the original | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — clears a review the admin never touched | failed | failed | `Error: Unable to find an element with the text: /Flyer analyzed/i` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — keeps what the admin decided and drops the rest | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — falls back to unresolved candidates and says so | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — keeps an automatic link on an empty form | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — leaves an automatic link undecided when the form already names a different venue | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — keeps a link the admin clicked when they edit the event's venue text | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — requires a creation signal before an organizer can be added as new | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| AdminEventEditor.extraction.test.tsx — does not overwrite a city the admin chose, from the flyer or a chosen venue | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| SubmitEventPage.extraction.test.tsx — keeps the person's decision and edits when the flyer is analysed again | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| BulkFlyerImportPage.test.tsx — publishes only flyers explicitly confirmed after review | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| BulkFlyerImportPage.test.tsx — allows correcting extracted fields before saving admin drafts | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| BulkFlyerImportPage.test.tsx — keeps a flyer with no event type from blocking the rest of the batch | passed | passed | — | — | not reproduced |
| BulkFlyerImportPage.test.tsx — retries only a failed save without repeating a successful event | passed | failed | — | `Error: STACK_TRACE_ERROR` | baseline-only failure; current passing |
| Calendar.test.tsx — keeps an expanded event reachable and restores its focus after closing details | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| Calendar.test.tsx — resets expanded pages when the dance-style filter or city changes | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| ProfileEditPage.test.tsx — saves the bio, city, dance styles, and links the redesign added | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| ProfileEditPage.test.tsx — never sends username, role, or status to the update hook | passed | passed | — | — | not reproduced |
| PublicWorkspaceSurfaces.test.tsx — groups classes by weekday with prices and instructor links | failed | failed | `Error: Unable to find role="heading" and name "Weekly classes"` | `Error: Unable to find role="heading" and name "Weekly classes"` | pre-existing failure |
| CalendarListView.test.tsx — keeps a large chronological collection reachable through bounded pages | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| CalendarSubmissionDialog.test.tsx — locks the event form fields while a submission is in flight, before the network call resolves | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` | pre-existing failure |
| CalendarSubmissionDialog.test.tsx — offers an in-place retry after a failed submission-access lookup, without a page reload | failed | failed | `TestingLibraryElementError: Unable to find an element with the text: Submissions Unavailable` | `TestingLibraryElementError: Unable to find an element with the text: Submissions Unavailable` | pre-existing failure |
| CalendarSubmissionDialog.test.tsx — shows no entity review until a flyer has been analysed | failed | failed | `TestingLibraryElementError: Unable to find a label with the text of: Event Title *` | `TestingLibraryElementError: Unable to find a label with the text of: Event Title *` | pre-existing failure |

## Additional failures discovered

These are not substitutions for the original 30. Every additional test failing in either individual-run tree is listed below.

| File / full test name | Current | Baseline | Current error | Baseline error |
| --- | --- | --- | --- | --- |
| AdminEventEditor.extraction.test.tsx — Admin direct-create flyer analysis analyzes the uploaded flyer and applies the extracted details on request | failed | passed | `Error: STACK_TRACE_ERROR` | — |
| AdminEventEditor.extraction.test.tsx — Admin flyer entity review reconciles the extracted entities and shows all four groups for review | failed | passed | `Error: STACK_TRACE_ERROR` | — |
| AdminEventEditor.extraction.test.tsx — Admin flyer entity review when the flyer changes during analysis discards a late extraction when the flyer is replaced | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` |
| AdminEventEditor.extraction.test.tsx — Admin flyer entity review when the flyer changes during analysis discards a late extraction when the flyer is removed | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` |
| AdminEventEditor.extraction.test.tsx — Admin flyer entity review when the flyer changes during analysis discards a late reconciliation when the flyer is replaced | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` |
| AdminEventEditor.extraction.test.tsx — Admin flyer entity review when the flyer changes during analysis discards a late failed reconciliation when the flyer is removed | failed | passed | `Error: Unable to find an element with the text: Checking the venue, organizer, instructors and school against existing records…` | — |
| AdminEventEditor.extraction.test.tsx — Admin flyer entity review when reconciliation fails lets the admin re-check a fallback candidate once the service is back | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` |
| AdminEventEditor.extraction.test.tsx — Admin flyer entity review automatic venue links detaches an automatic link when the admin edits the event's venue text | passed | failed | — | `Error: STACK_TRACE_ERROR` |
| AdminEventEditor.extraction.test.tsx — Admin flyer entity review event city replaces the untouched default city with the flyer's city | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` |
| AdminEventEditor.extraction.test.tsx — Admin flyer entity review event city keeps a city chosen after a first extraction when a retry reads a different one | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` |
| AdminEventEditor.extraction.test.tsx — keeps linked entity review visible and intact while editing without a flyer | passed | failed | — | `Error: STACK_TRACE_ERROR` |
| Calendar.test.tsx — Calendar keeps the expanded row focused during and after an unchanged background refresh | failed | failed | `Error: STACK_TRACE_ERROR` | `Error: STACK_TRACE_ERROR` |
| Calendar.test.tsx — Calendar keeps the List feed unbounded instead of offering ineffective date navigation | passed | failed | — | `Error: STACK_TRACE_ERROR` |
| Calendar.test.tsx — Calendar keeps the Cards feed unbounded instead of offering ineffective date navigation | passed | failed | — | `Error: STACK_TRACE_ERROR` |
| Calendar.test.tsx — Calendar controls date, city, view, and type filtering | passed | failed | — | `Error: STACK_TRACE_ERROR` |
| Calendar.test.tsx — Calendar preserves the filtered collection while switching List and Cards | passed | failed | — | `Error: STACK_TRACE_ERROR` |
| ProfileEditPage.test.tsx — ProfileEditPage saves the notification and privacy toggles the owner flipped | failed | failed | `AssertionError: expected "vi.fn()" to be called at least once` | `AssertionError: expected {} to match object { weekly_digest: true }` |

## Path-level findings

- Editor/extraction failures exercise flyer upload, extraction, entity reconciliation, pending/removal races, editable fields, and saving. Most time out. The clear-review test already failed baseline with a timeout and currently misses `/Flyer analyzed/i`; a separate late-failed-reconciliation/removal test passes baseline and currently misses `Checking the venue, organizer, instructors and school against existing records…`. Current-only assertion changes remain unresolved; they are not automatically Phase 1 defects.
- Calendar focus/filter/background-refresh and 120-row bounded-page tests exceed the unchanged test budget. The bounded-page diagnostic includes three Show-more loops, role queries, focus assertions, and selection. Source establishes the exercised path, not the exact resource bottleneck.
- Profile bio save exceeds the budget in both trees. Notification/privacy save fails in both with different assertions: an uncalled update mock currently versus a missing `weekly_digest` baseline patch.
- School offerings remain rendered as a loading skeleton rather than `Weekly classes` in both trees; the query/fixture cause is not established.
- SubmissionDialog first exceeds 5 seconds while attempting the in-flight field-lock path; subsequent tests cannot find portal/form content and show an empty `<div />`. Their ordering suggests possible contamination, but this was not proven and no unrelated portal/test changes were made.

## Reproducible commands and raw evidence

From either checkout:

```sh
npx vitest run <file> --maxWorkers=1 --reporter=json --outputFile=/tmp/<unique-report>.json
```

Main paths are under `src/` as named in the Phase 1 audit. Raw JSON reports were retained outside the repository at:
- AdminEventEditor.extraction.test.tsx: `/tmp/failure-extraction-current-editor.json`, `/tmp/failure-extraction-baseline-editor.json`
- SubmitEventPage.extraction.test.tsx: `/tmp/failure-extraction-current-submit.json`, `/tmp/failure-extraction-baseline-submit.json`
- BulkFlyerImportPage.test.tsx: `/tmp/failure-extraction-current-bulk.json`, `/tmp/failure-extraction-baseline-bulk.json`
- Calendar.test.tsx: `/tmp/FailureSurfaces-main-Calendar.test.json`, `/tmp/FailureSurfaces-baseline-Calendar.test.json`
- ProfileEditPage.test.tsx: `/tmp/FailureSurfaces-main-ProfileEditPage.test.json`, `/tmp/FailureSurfaces-baseline-ProfileEditPage.test.json`
- PublicWorkspaceSurfaces.test.tsx: `/tmp/FailureSurfaces-main-PublicWorkspaceSurfaces.test.json`, `/tmp/FailureSurfaces-baseline-PublicWorkspaceSurfaces.test.json`
- CalendarListView.test.tsx: `/tmp/FailureSurfaces-main-CalendarListView.test.json`, `/tmp/FailureSurfaces-baseline-CalendarListView.test.json`
- CalendarSubmissionDialog.test.tsx: `/tmp/FailureSurfaces-main-CalendarSubmissionDialog.test.json`, `/tmp/FailureSurfaces-baseline-CalendarSubmissionDialog.test.json`

Reports are investigation artifacts, not new permanent test infrastructure. This document preserves every classification even after the disposable baseline checkout is removed.

## Subsequent single-worker full-suite observation

Before any Phase 2 source changes, `npx vitest run --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/salsa-phase15-full-suite.json` reached the 1,800-second process deadline (1,800.24 seconds). Its progress output reported 20 failures across six files: AdminEventEditor.extraction (9), SubmitEventPage.extraction (1), BulkFlyerImportPage (3), CalendarListView (1), CalendarSubmissionDialog (3), Calendar (3). There was no completed suite summary or final JSON report.

This later run does not replace the original 30-name classification or the isolated current/baseline matrix. The three original current-only editor timeout cases passed in this later run; variability is observed, but an environment/resource root cause remains unproven. The full-suite release gate remains unresolved.

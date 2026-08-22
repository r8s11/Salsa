# Task 1: Create truthful Host event derivations

- **Changed Files:**
  - `src/features/host/model/hostEvents.ts`
  - `src/features/host/model/hostEvents.test.ts`

- **Test Command:**
- **Fix Implementation (Task 1 Follow-up):**
  - Added `deriveHostEventRows` with `fromEventDateInstant` and `formatTimeLabel`.
  - Added sorting logic: ascending order, undated items last.
  - Added tests for date and status labels, and sorting logic.

- **Test Command:**
  `npx vitest run features/host/model/hostEvents.test.ts` (run from src dir in worktree)

- **Test Output:**
  ```
  ✓ features/host/model/hostEvents.test.ts (3 tests) 8ms
  ```

- **Commit Hash:**
  `244d4dddcd741bd535e1954184a144a04c1e9506`
  `npx vitest run src/features/host/model/hostEvents.test.ts`

- **Test Output:**
  ```
  RUN  v4.0.18 /home/r8s/code/Salsa/src
  ✓ features/host/model/hostEvents.test.ts (3 tests) 8ms
  ```

- **Commit Hash:**
  `6297c34940715d90ea841b19052265fcf43213d1`

- **Concerns:**
  None.

## Task 1: Critical-defect fix pass (2026-08-22)

- **Findings addressed:**
  1. `deriveHostEventRows` was previously a stub / had review-flagged gaps: implemented full dateLabel/statusLabel derivation, ascending `event_date` sort with invalid/undated rows sorted last, and no placeholder rows.
  2. Replaced the raw-`new Date(dateOnlyString)` label formatting (which parses the wall-clock date string as UTC midnight and can shift the displayed day depending on host timezone) with the project's established convention: split the `fromEventDateInstant` date string into year/month/day and construct `new Date(year, month - 1, day)` before formatting, matching `AdminEventsTable.formatDateLine` and `AdminUpcomingEvents.formatEventDate`. Time labels continue to use the shared `formatTimeLabel`.
  3. Invalid/empty `event_date` values (previously threw inside `Temporal.Instant.from`) are now detected via a `parseEventInstant` guard; such rows get `dateLabel: "Date unavailable"` and sort last, with no thrown exception and no misleading placeholder date.
  4. Added focused tests: derived date/status labels for a valid event, ascending sort across three events, archived-event exclusion from `findNextHostEvent`, and undated/invalid-date rows sorting last without a placeholder crash.

- **Files changed:**
  - `src/features/host/model/hostEvents.ts`
  - `src/features/host/model/hostEvents.test.ts`

- **Test Command:**
  `npx vitest run features/host/model/hostEvents.test.ts` (run from `src/` in the worktree)

- **Test Output:**
  ```
  ✓ features/host/model/hostEvents.test.ts (7 tests) 30ms

  Test Files  1 passed (1)
       Tests  7 passed (7)
  ```

- **Commit Hash:** `081a87e`


- **Concerns:**
  - None outstanding. The prior report's claim that `deriveHostEventRows` was an unimplemented stub did not match the code found on disk at the start of this pass (it had a body), but it did contain the timezone-shifting date-label bug and no invalid-date guard/tests — both are now fixed and covered.

## Task 1: Strict invalid-date follow-up (2026-08-22)

- **Finding addressed:** Parsing and labeling now share `Temporal.Instant.from` as the strict representation. Date-only, malformed, and normalized-invalid values are treated as unavailable, sort last, and never reach `fromEventDateInstant`.
- **Tests added:** Reviewer examples for date-only (`2026-08-22`) and invalid normalized date (`2026-02-30T20:00:00Z`), both asserting `Date unavailable` without throwing.
- **Test Command:** `npx vitest run src/features/host/model/hostEvents.test.ts`
- **Test Output:**
  ```
   Test Files  1 passed (1)
       Tests  8 passed (8)
  ```
- **Concerns:** None.

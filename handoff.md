# Salsa Core UI Refresh — Handoff

**Status: COMPLETE.** Merged to `main` locally at `0edbe82` ("Merge feature/core-ui-refresh: Rhythm Console UI refresh"). Feature branch `feature/core-ui-refresh` and its task worktrees are deleted; the merge is the permanent record.

## Current checkout

- Repository: `/home/r8s/code/Salsa`
- Branch: `main`
- HEAD: `0edbe82` (merge commit; parents `4bc...` main tip and `d4cd542` feature tip)
- `main` is 22 commits ahead of `origin/main` (not pushed — local merge only, per the chosen integration option).
- Working tree: clean except this `handoff.md`.

## Delivered implementation

Five reviewed workstreams plus three integration/root-cause fixes, all merged into `main`:

1. **Header** — `PRIMARY_LINKS` (Calendar, Lessons, Instructors, About, Contact); no Events link; guest/member/admin account states; native `<details>` Account disclosure; responsive mobile drawer wired to `site-navigation`/`aria-expanded`; Escape-to-close via `useEscapeKey`; awaited `signOut()`.
2. **Sign-in** — branded two-column `.auth-shell` split shell with exact copy; password show/hide toggle (`Show password` ⇄ `Hide password`); clean OAuth cutover (`signInWithOAuth` removed from `AuthContextValue`/`AuthContext`, `/auth/callback` route and `AuthCallback.tsx` deleted, zero source literal matches for `signInWithOAuth|auth/callback|Coming soon`).
3. **Admin** — `Awaiting review`/`Boston`/`NYC` metrics; rich moderation cards with metadata grid, RSVP link, and two-step reject/confirm/cancel flow; `decidingStatus`/`decision` mutation-state contracts; approval vs. rejection failure copy correctly attributed to the mutation that actually ran (fixed in review).
4. **Profile** — account header with derived avatar initial; `SubmissionFilter` counts via `useMemo`; `aria-pressed` filter group; city-qualified approved deep links (`/calendar?event=<id>&city=<city>`).
5. **Calendar** — mobile list-first view via `matchMedia("(max-width: 768px)")`; `CalendarStatus` exact prop/copy/precedence contract; Schedule-X sync split from structured-data generation; one-shot `?city=` deep-link honoring; `refetch` plumbed through `useEventsQuery`/`useEvents`.
6. **Lint integration fix** (`ecca36c`) — type-only React imports in two new tests; stable `ProfilePage` submissions fallback array.
7. **Design-token remediation** (`418f860`) — all mandated Impeccable detector findings (off-ramp font sizes, undocumented colors) resolved against `DESIGN.md`/`global.css` tokens.
8. **Event-time root-cause fix** (`1a32ff1`/`d4cd542`) — event submission date/time is interpreted as `America/New_York` civil time via Temporal and persisted as an ISO instant, replacing the prior timezone-less serialization that silently stored local time as UTC (a 4-hour display shift in August). TDD red/green evidence in commit history; DST-safe (no hard-coded offset).

## Final verification evidence (fresh, on the merged `main` HEAD)

- `npx tsc -b` → exit 0, no errors.
- `npm run build` → `tsc -b && vite build` succeeded; only the pre-existing informational >500 kB chunk-size warning.
- Impeccable detector, exact plan command over all 14 refresh files → `[]`, exit 0.
- `npm run lint` (`set -o pipefail`, confirmed exit 0) → zero warnings/errors.
- `npm test -- --run` (`set -o pipefail`, confirmed exit 0) → **19 files / 93 tests passed**.
- Final whole-branch review (independent reviewer subagent, full base→head diff `9018b71..d4cd542`, cross-workstream focus) → `overall_correctness: "correct"`, no findings, confidence 0.96.

Known non-failing test output (pre-existing, unrelated to this work): jsdom's unimplemented `window.scrollTo()` notice and React `act(...)` warnings during App/SubmitEventPage tests.

## Live authenticated E2E proof (this session, real headless browser, not a DB round-trip)

Server: hub-managed `salsa-e2e-vite` (a stale, hub-untracked orphan process from an earlier session was found holding port 5173 and was killed before starting a clean instance).

- **Desktop 1440×1000, guest:** Header shows Calendar/Lessons/Instructors/About/Contact + Sign In, no Home/Events text; `/signin` renders the two-column Rhythm Console shell with no OAuth/Coming-soon content; password toggle flips `type="password"`→`"text"` and `Show password`→`Hide password`; `/calendar` opens in Month view with Month/Week/List controls present; no horizontal overflow anywhere.
- **Mobile 390×844, guest:** header collapses to logo + hamburger only, no overflow; drawer opens (`aria-expanded="true"`) with city + guest actions, no overflow; Escape closes it; `/signin` collapses to one column, story above form, no overflow; `/calendar` opens in List view with no Month/Week controls, month/city/type navigation reachable.
- **Full authenticated flow:** created `ui-refresh-verify@salsasegura.test` via real Sign Up; submitted `UI Refresh Verification Social`, Boston social, `2026-08-18` (7 days out) at 20:00, venue `Verification Hall`, address `1 Test Way`, free, description `End-to-end UI refresh verification event.`; `/profile` showed All=1/Pending=1/Approved=0/Rejected=0 with no public deep link while pending; granted admin via the plan's exact SQL, signed out/in, confirmed Account disclosure now contains Admin; `/admin` showed Awaiting review=1/Boston=1/NYC=0 and, critically, **`When: Tuesday, August 18, 2026 at 8:00 PM`** — confirming the event-time fix live (not the pre-fix 4-hour-shifted 4:00 PM); exercised Reject event → Confirm rejection stage → Cancel → restored to Approve/Reject; Approved the event, confirmed it left the queue and the empty state (`No events waiting for review.` + `View Calendar`) rendered; `/profile` showed Approved=1 with exact link `/calendar?event=<id>&city=boston`; switched header city to NYC, opened that Boston-qualified link, confirmed the city switched back to BOS and EventModal opened showing the correct event and time.
- **Screenshots + objective checks** for `/signin`, `/admin`, `/profile`, `/calendar` at both 1440×1000 and 390×844: `document.documentElement.scrollWidth <= window.innerWidth` true in all 8 cases; visible `outline` focus rings confirmed via keyboard Tab on interactive elements; no clipped or overlapping controls/calendar surfaces observed; mobile header always kept logo + hamburger reachable.

## Cleanup performed

```bash
docker exec supabase_db_Salsa psql -U postgres -d postgres \
  -c "DELETE FROM public.events WHERE submitter_email = 'ui-refresh-verify@salsasegura.test';" \
  -c "DELETE FROM auth.users WHERE email = 'ui-refresh-verify@salsasegura.test';"
```

Both deletes returned exactly one row. Post-delete count check confirmed zero remaining rows in both tables for that email. The `salsa-e2e-vite` process (the only Vite instance started for this check) was stopped; both browser tabs were closed.

## Integration

User selected **Option 1: merge to `main` locally**. Executed:

```bash
git checkout main
git pull                      # already up to date
git merge --no-ff feature/core-ui-refresh -m "Merge feature/core-ui-refresh: Rhythm Console UI refresh"
# re-verified lint + full test suite on the merged result, both exit 0
git branch -d feature/core-ui-refresh   # merged branch deleted
```

`main` is now 22 commits ahead of `origin/main` and has not been pushed — push/PR was not requested. No worktrees remain (all `.worktrees/task*` and `.worktrees/fix-*` directories created during this effort were removed as each task/fix merged).

## Nothing outstanding

Every phase of the execution plan (`local://salsa-core-ui-refresh-plan.md`) is done: all five workstreams implemented, tested, and reviewed; both integration bugs (lint, event-time) found and fixed with evidence; the full repository gate (lint/test/build/tsc/Impeccable) green on the merged result; the complete authenticated end-to-end browser proof from the plan's Verification section executed and passed; verification records cleaned up; final whole-branch review clean; branch merged and deleted.

## Round 1: Host Venue Rendering Fix

- **Fix** (`f114311`) — In `HostMyEventsPage.tsx`, updated the venue rendering logic from `venue_id || "N/A"` to `location || "Venue not set"`, replacing the database ID display with the human-readable event location field, ensuring consistent UX with appropriate fallback text.
- **Verified** — Added a focused test case in `HostMyEventsPage.test.tsx` ensuring that events with `location` render the location and events with `null` `location` render the fallback string "Venue not set". Confirmed all `HostMyEventsPage.test.tsx` tests pass.

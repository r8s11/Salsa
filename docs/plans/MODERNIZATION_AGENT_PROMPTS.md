# Modernization Blueprint — Per-Step Agent Prompts

> Generated from `Docs/plans/MODERNIZATION_BLUEPRINT.md` (audit dated 2026-07-06).
> Each prompt below is self-contained — copy one at a time into a fresh agent (subagent, Claude Code session, or `Agent`/`Workflow` tool call). Run steps **in order**; each depends on the previous one landing cleanly. Do not skip ahead.

**Shared global rules (already folded into every prompt below, repeated here for reference):**
- Never modify more files than the step's "Target files" list.
- After every step, `npm run build` must exit 0 (`tsc -b` is the primary regression gate).
- Never change CSS class names — visual regression risk.
- No new dependencies unless the step explicitly authorizes one.
- Commit after each validated step, using the step title as the commit message.

---

## Step 1: Sanitize dependencies & standardize package manager

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase, root at repo root). This is Step 1 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md) — read that file's "Phase 3: Execution Agent Roadmap" section first for full context, but this prompt is self-contained for execution.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files: package.json, bun.lock (delete), package-lock.json, .nvmrc (new)

Objective: Remove an untrusted dependency and eliminate a dual-lockfile split. `@google/design.md@^0.3.0` is an unrecognized package in `dependencies` — not a real Google-scoped tool, currently not installed locally but resolved in package-lock.json, so it gets fetched on every clean CI install. This is a supply-chain risk and must be removed before any other work in this roadmap. Separately, the repo has both `bun.lock` and `package-lock.json` — local installs look bun-managed while Azure Oryx (CI) builds with npm, so local and CI can resolve different dependency trees.

Instructions:
1. Delete the `@google/design.md` entry from `dependencies` in package.json.
2. Delete `bun.lock`.
3. Add a `"packageManager"` field to package.json pinning npm (e.g. match the npm version in your environment).
4. Add a `.nvmrc` file containing the current Node LTS major version.
5. Run a clean `npm install` to regenerate package-lock.json.
6. Do NOT bump any other dependency versions in this step — that's handled in a later step.

Validation (all must pass before you commit):
- `npm install` exits 0
- `grep design.md package.json` returns nothing
- `npm run build` passes
- `npx vitest run` passes
- `git status` shows `bun.lock` as deleted, not present

Commit message: "Step 1: Sanitize dependencies & standardize package manager"
```

---

## Step 2: Add CI quality gate

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 2 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Step 1 (dependency/lockfile cleanup) should already be merged — verify `git log` shows it before proceeding; if not, stop and say so.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files: the Azure Static Web Apps GitHub Actions workflow file under `.github/workflows/` (filename looks like `azure-static-web-apps-<random>.yml` — find it with `ls .github/workflows/`)

Objective: The workflow currently deploys `main` straight to production with zero lint/test gate — a broken commit ships live. It also uses the deprecated `actions/checkout@v3` (Node 16 runner).

Instructions:
1. Add a new `quality` job to the workflow: checkout → `actions/setup-node` (with npm caching) → `npm ci` → `npm run lint` → `npx vitest run`.
2. Make the existing `build_and_deploy_job` depend on it via `needs: quality`.
3. Upgrade `actions/checkout` to v5 in every job that uses it (including `close_pull_request_job` if present).
4. Do not alter the deploy step's inputs, secrets, or any other job's existing behavior.

Validation:
- The YAML parses (use a YAML linter, or push to a throwaway branch and confirm the Actions run starts correctly)
- Both `quality` and `build_and_deploy_job` appear in the workflow
- `build_and_deploy_job` shows `needs: quality`

Commit message: "Step 2: Add CI quality gate"
```

---

## Step 3: Delete dead code

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 3 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Steps 1-2 should already be merged.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files: src/contexts/AuthContext.tsx (delete), src/pages/Schools.tsx + src/pages/Schools/ (route or delete — see instructions), src/types/events.ts

Objective: Remove unreachable/empty modules that mislead future agents working on this codebase.

Instructions:
1. Delete `src/contexts/AuthContext.tsx` — it's a 0-byte placeholder file with no real content.
2. Grep the codebase for imports of `Schools` (`grep -rn "Schools" src/App.tsx src/`). There is currently no route registered for it in `src/App.tsx`, so `src/pages/Schools.tsx` and the 5 files under `src/pages/Schools/` are dead code. Ask the maintainer whether these school pages are launch-pending before deleting them. If no answer is available, the safe default is to KEEP the files but add a `schools` route (lazy-loaded, following the same pattern as the other lazy routes already in App.tsx) so they become reachable rather than silently dead.
3. In `src/types/events.ts`, grep for `bostonDateTime` (`grep -rn "bostonDateTime" src/`). If it truly has zero call sites outside its own definition, remove the unused export.

Validation:
- `npm run build` passes
- `grep -rn "AuthContext\|bostonDateTime" src/` returns nothing
- If you added the `/schools` route, confirm it renders via `npm run dev`

Commit message: "Step 3: Delete dead code"
```

---

## Step 4: Create the events feature skeleton (move, don't rewrite)

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 4 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Steps 1-3 should already be merged.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files (new): src/features/events/model/types.ts, src/features/events/model/convert.ts, src/features/events/model/calendarsConfig.ts
Target files (modified): src/types/events.ts (becomes a re-export shim)

Objective: `src/types/events.ts` currently mixes three concerns — type definitions, UI color config, and conversion logic. Split it into three single-responsibility modules WITHOUT breaking any existing import site anywhere in the codebase. This is a pure move, not a rewrite — no logic changes.

Instructions:
1. Move all interfaces/type aliases (DatabaseEvent, ScheduleXEvent, EventType, City, etc.) currently in `src/types/events.ts` to the new `src/features/events/model/types.ts`.
2. Move the `databaseEventToScheduleX` function and any private helper it uses to the new `src/features/events/model/convert.ts`.
3. Move `CALENDARS_CONFIG` to the new `src/features/events/model/calendarsConfig.ts`.
4. Convert `src/types/events.ts` into pure re-exports of all three new modules (e.g. `export * from "../features/events/model/types"`, etc.) so every existing `import { X } from "../types/events"` across the codebase keeps compiling with zero edits at the call sites.
5. Do not change any logic while moving — this step is structural only.

Validation:
- `npm run build` passes with ZERO edits to any import site outside `src/types/events.ts` itself
- `npx vitest run` passes

Commit message: "Step 4: Create the events feature skeleton (move, don't rewrite)"
```

---

## Step 5: Make timezone handling explicit in convert.ts

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 5 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Step 4 (which created src/features/events/model/convert.ts) must already be merged — verify before proceeding.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files: src/features/events/model/convert.ts (read-only reference: Docs/sql queries/events.sql)

Objective: This is a correctness bug fix, not just cleanup. `convert.ts`'s conversion currently round-trips through `new Date(event.event_date)` plus local getters. If `events.event_date` in Supabase is a `timestamptz` column, Supabase returns offset-qualified strings and ALL displayed event times shift by the visitor's own timezone offset — wrong for every visitor outside Eastern time. The project already depends on `temporal-polyfill` for exactly this reason, but it's unused in this code path. There's also a stale comment bug: it says "Assume 2 hours duration" while the code actually adds 4 hours.

Instructions:
1. First, open `Docs/sql queries/events.sql` and determine whether the `event_date` column is `timestamp` (naive, no offset) or `timestamptz` (offset-aware). Record your finding in a comment at the top of `convert.ts`.
2. Reimplement the conversion using Temporal (the global polyfill is already available):
   - If `timestamptz`: parse as `Temporal.Instant`, then `.toZonedDateTimeISO('America/New_York')`.
   - If naive `timestamp`: parse directly as `Temporal.PlainDateTime` (no timezone conversion needed, it's already wall-clock).
3. Output format must stay exactly `"YYYY-MM-DD HH:mm"` (what Schedule-X expects) — don't change the consuming contract.
4. Define `const DEFAULT_DURATION_HOURS = 4` as a named constant and fix the stale "2 hours" comment to match reality.
5. After this change, the string `new Date(` must not appear anywhere in this file — grep to confirm.

Validation:
- `npm run build` passes
- IMPORTANT: do not consider this step "done" or commit yet — Step 6 (below) adds the tests that are the real correctness gate for this change. Implement Step 5, then immediately proceed to Step 6 before committing either.

Commit message: (deferred — see Step 6, which commits both together)
```

---

## Step 6: Unit-test the conversion domain

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 6 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). This step must be done in the SAME session as Step 5 (timezone fix to convert.ts) — if convert.ts hasn't been updated yet, do Step 5 first, then this step, then commit both together.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files (new): src/features/events/model/convert.test.ts

Objective: Lock the timezone contract from Step 5 with an executable specification. This test coverage is the actual regression gate for the timezone fix — if these tests fail, fix `convert.ts`, never the test expectations.

Instructions: Write Vitest test cases (this repo has `globals: true` configured, so no need to import `describe`/`it`/`expect`). Cover:
1. A known summer timestamp renders the expected EDT wall-clock time.
2. A known winter timestamp renders the expected EST wall-clock time.
3. The computed `end` time equals `start + 4 hours` (DEFAULT_DURATION_HOURS from Step 5).
4. An event whose start falls right at/around the DST fall-back boundary still produces a monotonically valid `start < end` (no wraparound bugs).
5. Null/undefined optional fields on the input map to `undefined` in the output (not `null`, not empty string).

Use fixed literal timestamp strings in every test — never `Date.now()` or dynamic dates, since the tests must be deterministic and reviewable.

Validation:
- `npx vitest run src/features/events/model/convert.test.ts` → all green
- If any case fails, the bug is in `convert.ts` — fix it there, do not weaken the test

Commit message: "Step 5+6: Make timezone handling explicit in convert.ts, with tests"
```

---

## Step 7: Introduce the events repository

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 7 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Steps 1-6 should already be merged.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files (new): src/features/events/api/eventsRepo.ts
Target files (modified): src/hooks/useSupabaseEvents.ts, src/pages/SubmitEventPage.tsx

Objective: Centralize ALL Supabase I/O for events behind two functions (Repository pattern), so no component or hook touches the Supabase client directly for event data. This is also where a real bug gets fixed: `useSupabaseEvents` currently fetches every approved event since the beginning of time with no date floor — the homepage then filters client-side to 6 future events, but the query payload only grows forever.

Instructions:
1. Create `fetchApprovedEvents(city: City): Promise<DatabaseEvent[]>` in the new `eventsRepo.ts` — move the existing query logic out of `useSupabaseEvents.ts`, and add `.gte('event_date', <today minus 1 day, as ISO string>)` as a server-side date floor.
2. Create `submitEvent(payload: NewEventSubmission): Promise<void>` in the same file — move the insert object construction out of `SubmitEventPage.tsx`. Define the `NewEventSubmission` type in this repo file (not in the page component).
3. Rewire `useSupabaseEvents.ts` to call `fetchApprovedEvents` instead of querying Supabase directly.
4. Rewire `SubmitEventPage.tsx` to call `submitEvent` instead of constructing the Supabase insert itself.
5. After this step, the string `from("events")` (the Supabase table accessor) should appear in exactly one file: `eventsRepo.ts`.

Validation:
- `grep -rn 'from("events")' src/` → exactly 1 match, in eventsRepo.ts
- `npm run build` passes
- Manual check: run `npm run dev`, confirm the homepage still shows events, and confirm the submit form still works (submit a test event, verify a `pending` row appears in Supabase, then delete that test row)

Commit message: "Step 7: Introduce the events repository"
```

---

## Step 8: Adopt TanStack Query

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 8 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Step 7 (the events repository) must already be merged — this step builds directly on `eventsRepo.ts`.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; commit when validation passes, using the step title as the commit message. EXCEPTION for this step only: you ARE authorized to add exactly one new dependency, `@tanstack/react-query` v5 (no devtools package) — no other new dependencies.

Target files (new): src/app/providers.tsx, src/features/events/hooks/useEventsQuery.ts
Target files (modified): package.json, src/main.tsx, src/hooks/useEvent.ts
Target files (deleted): src/hooks/useSupabaseEvents.ts

Objective: Replace the bespoke fetch-in-useEffect plumbing with TanStack Query's cached server state. This eliminates the double-fetch that currently happens between the homepage and the calendar page, and removes the hand-rolled `mounted`-flag/loading/error pattern.

Instructions:
1. Install `@tanstack/react-query@^5` (only this package, no devtools).
2. Create `src/app/providers.tsx` composing: `StrictMode` → `QueryClientProvider` (configure `staleTime` of 5 minutes, `retry: 1`) → `CityProvider`.
3. Reduce `src/main.tsx` to simply render `<Providers><App /></Providers>` (the composition now lives in providers.tsx).
4. Implement `useEventsQuery(city)` in the new hooks file: query key `['events', city]`, fetching via `eventsRepo.fetchApprovedEvents(city)` and mapping the result through `convert.ts`.
5. In `src/hooks/useEvent.ts`, keep the existing public return shape EXACTLY as `{ events, loading, error }` — map TanStack's `isPending` to `loading`, and map any error object to a plain error message string. This means zero component call sites need to change.
6. Delete `src/hooks/useSupabaseEvents.ts` — it's now fully superseded by the repo + query hook.

Validation:
- `npm run build` passes and `npx vitest run` passes
- Manual: run `npm run dev`, open browser devtools Network tab, navigate Home → Calendar, confirm the events request fires exactly ONCE (not twice, since it's now cached)
- Manual: switch the Boston/NYC city toggle and confirm exactly one new network request fires per city switch

Commit message: "Step 8: Adopt TanStack Query"
```

---

## Step 9: Extract submit-event validation

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 9 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Steps 1-8 should already be merged.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files (new): src/features/submit-event/validation.ts, src/features/submit-event/validation.test.ts
Target files (modified): src/pages/SubmitEventPage.tsx

Objective: Make the event-submission form rules pure, testable, and add cheap spam friction — since `SubmitEventPage` allows anonymous public inserts into the moderation queue with no length caps or rate limiting today.

Instructions:
1. Move the existing `validateForm` logic out of `SubmitEventPage.tsx` into a new exported pure function `validateSubmitForm(form): string | null` in `validation.ts` (returns the first validation error message, or `null` if valid).
2. Also move the `SubmitForm` interface and any `buildInitialForm` helper into `validation.ts`.
3. Extend the validation with max-length caps as spam friction: title 120 chars, description 2000 chars, all other text fields 300 chars.
4. Write tests in `validation.test.ts` covering: paid event submitted without an amount, negative amount, malformed URL, non-http(s) URL protocol, over-length title, and a fully valid form (expect `null`).
5. Rewire `SubmitEventPage.tsx` to import and call `validateSubmitForm` instead of its inline logic.

Validation:
- `npx vitest run src/features/submit-event/validation.test.ts` → all green
- `npm run build` passes
- Manual: in `npm run dev`, submit a paid event without an amount and confirm the error banner still appears exactly as before

Commit message: "Step 9: Extract submit-event validation"
```

---

## Step 10: Decompose SubmitEventPage

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 10 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Step 9 (validation extraction) must already be merged — this step builds on `validation.ts`.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files (new): src/features/submit-event/useSubmitEventForm.ts, src/features/submit-event/components/ (one component per existing <fieldset>, plus a SuccessCard component)
Target files (modified): src/pages/SubmitEventPage.tsx

Objective: `SubmitEventPage.tsx` is currently a 349-line monolith mixing form state, validation, Supabase persistence, the success view, and full form markup in one file. Reduce it to a composition shell under 100 lines.

Instructions:
1. Create `useSubmitEventForm.ts` — this hook owns: form state, an `update` function, `handleSubmit` (validate via `validateSubmitForm` → call `eventsRepo.submitEvent` → set submitted flag), and `isSubmitting` / `isSubmitted` / `error` state.
2. Look at the current `SubmitEventPage.tsx` and identify its existing fieldsets (Event Details, Location, Pricing & Link, Your Info) — extract each one VERBATIM into its own component under `src/features/submit-event/components/`, each receiving `{ form, update }` as props. Preserve every `id`, `label`, `placeholder`, and CSS class name byte-for-byte — no visual changes.
3. Extract the success view into a `SuccessCard` component.
4. `SubmitEventPage.tsx` becomes a thin composition: it uses the hook and renders the extracted components. The `SubmitEventPage.css` import stays in the page shell, not in the sub-components.

Validation:
- `npm run build` passes
- Manual full pass in `npm run dev`: fill out the entire form including the paid-price toggle, submit it, confirm the success card appears, click "Submit Another Event" and confirm the form resets
- Every new page-shell/component file is ≤150 lines (`wc -l` each)

Commit message: "Step 10: Decompose SubmitEventPage"
```

---

## Step 11: Decompose Calendar page & fix stale H1

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 11 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Steps 1-10 should already be merged.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files (new): src/features/calendar/hooks/useEventDeepLink.ts, src/features/calendar/hooks/useEscapeKey.ts, src/features/calendar/components/CalendarLegend.tsx, src/features/calendar/components/CalendarStatus.tsx, src/shared/seo/useDocumentMeta.ts
Target files (modified): src/components/Calendar/Calendar.tsx

Objective: `Calendar.tsx` (175 lines) currently has 5 mixed responsibilities: calendar config, data loading, SEO injection, URL-param deep-linking (via a `setTimeout` hack), ESC-key handling, and modal orchestration. Split each concern into its own single-responsibility module. Also fix a stale UX bug: the page has a hardcoded "Boston Dance Calendar" H1 even though a working Boston/NYC city switcher already exists in the Header.

Instructions:
1. `useEscapeKey(handler)` — wraps the existing keydown effect for closing the modal on Escape.
2. `useEventDeepLink(events, onOpen)` — owns the `?event=` query-param logic, including the existing one-shot ref guard that prevents re-opening. Replace the current `setTimeout(…, 0)` hack with a proper `useEffect` that fires once events have actually arrived (not on an arbitrary timer).
3. `useDocumentMeta({ title, description })` in `src/shared/seo/useDocumentMeta.ts` — wraps the two existing imperative SEO utility calls (`updatePageTitle`, `updateMetaDescription`), with cleanup on unmount that restores the previous title.
4. `CalendarLegend` and `CalendarStatus` — move the corresponding markup blocks out of `Calendar.tsx` verbatim into these new components.
5. Make the H1 city-aware using the existing `useCity()` hook: render "Boston Dance Calendar" or "NYC Dance Calendar" depending on the active city (subtitle text stays unchanged).
6. Leave the Schema.org structured-data injection where it currently is — that's out of scope for this step.

Validation:
- `npm run build` passes
- Manual: navigating to `/calendar?event=<a real event id>` opens that event's modal on load
- Manual: pressing ESC closes the modal AND strips the `?event=` param from the URL
- Manual: switching the city toggle flips the H1 text
- Manual: the document title updates on entering the calendar page and reverts when navigating back to Home

Commit message: "Step 11: Decompose Calendar page & fix stale H1"
```

---

## Step 12: Hosting config hardening

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 12 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Steps 1-11 should already be merged.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files: staticwebapp.config.json

Objective: Add missing security headers and remove dead routing config. There is currently no `globalHeaders` block at all (no CSP, no X-Content-Type-Options, no Referrer-Policy), and a no-op route entry (`/calendar` → `/calendar`, which does nothing).

Instructions:
1. Delete the `/calendar` → `/calendar` route entry. Do NOT touch `navigationFallback` — leave it exactly as-is.
2. Add a `globalHeaders` block with:
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy` disabling camera, microphone, and geolocation
   - A Content-Security-Policy in **Report-Only** mode ONLY (i.e. `Content-Security-Policy-Report-Only`, not the enforcing header) with: `default-src 'self'`; `connect-src` allowing this project's Supabase project URL and the Web3Forms endpoint (check `src/lib/supabase.ts` and the contact form code for the exact URLs in use); `img-src 'self' data: https:`; `style-src 'self' 'unsafe-inline'`; plus whatever Google Fonts hosts are actually referenced in `index.html` (check the `<link>` tags there).
3. Do NOT set an enforcing (non-report-only) CSP in this step — that's a follow-up only after confirming zero violations.

Validation:
- The JSON file parses correctly
- After the next deploy, confirm the new response headers are present via `curl -I` against the live Azure Static Web Apps URL
- Manual: click through every route in the deployed/preview site and confirm the browser console shows zero CSP report violations — only after that's clean should CSP ever be promoted to enforcing (out of scope for this step)

Commit message: "Step 12: Hosting config hardening"
```

---

## Step 13: CSS ownership cleanup

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase, "Ritmo Vivo" design system — plain component-scoped CSS, no Tailwind/CSS modules). This is Step 13 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Steps 1-12 should already be merged.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies unless explicitly authorized; commit when validation passes, using the step title as the commit message.

Target files: src/styles/global.css, src/components/Contact/Contact.css, and whichever other page-level CSS files own the relocated selectors (determined during the step — see instructions)

Objective: `global.css` (505 lines) should contain ONLY design tokens, resets, and shared primitives (`.btn-*`, `.style-chip`, `.section-title`, focus states). It currently also contains page-scoped rules like `.contact-form*`, `.dance-styles`, and `.styles-grid` that belong in the CSS file of the component that actually renders them.

Instructions:
1. Grep each of `.contact-form`, `.dance-styles`, `.styles-grid`, `.contact-info` (and any closely related selectors) to find which component renders that markup.
2. Relocate each rule block VERBATIM (cut and paste — zero property value changes) from `global.css` into the CSS file owned by the component that uses it.
3. `global.css` has a mobile media query block — update it to drop the selectors you relocated, and duplicate that same media query (with only the relocated rules) in the destination file(s) where needed so responsive behavior is unchanged.
4. This is strictly cut/paste. Do not "clean up" or restyle anything while moving it.

Validation:
- `npm run build` passes
- Take a screenshot (or visual diff) of the Home and Contact pages at both 1280px and 375px viewport widths, in `npm run dev`, before and after this change — they must be pixel-identical

Commit message: "Step 13: CSS ownership cleanup"
```

---

## Step 14: Dependency modernization pass

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 14 of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Steps 1-13 should already be merged.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; commit when validation passes, using the step title as the commit message. This step authorizes routine version bumps only — no net-new packages beyond what's already in package.json.

Target files: package.json, package-lock.json

Objective: Close remaining version-skew and stale-major items. The four `@schedule-x/*` packages are currently on mismatched minor versions (a known source of breakage in that library), and `@supabase/supabase-js` and `temporal-polyfill` have newer versions available.

Instructions — do these ONE AT A TIME, each as its own validated commit, not a single batch commit:
1. Align all four `@schedule-x/*` packages (`@schedule-x/calendar`, `@schedule-x/calendar-controls`, `@schedule-x/events-service`, `@schedule-x/react`, `@schedule-x/theme-default`) to the same latest 4.x minor version. Validate, then commit.
2. Bump `@supabase/supabase-js` within the 2.x line to latest. Validate, then commit.
3. In an ISOLATED commit attempt, try bumping `temporal-polyfill` from 0.x to 1.x. Read its changelog first — this is a breaking major version. The blast radius is the global-import path (`temporal-polyfill/global`) and every `Temporal.*` call site, primarily in `convert.ts` and `Calendar.tsx`. If you hit any API mismatch you can't resolve cleanly, REVERT just the temporal-polyfill bump (keep the other two bumps) and record the blocker as a note in `Docs/plans/MODERNIZATION_BLUEPRINT.md` or a TODO file — do not force it through.

Validation (run after EACH individual bump, before committing that bump):
- `npm run build` passes
- `npm run lint` passes
- `npx vitest run` passes
- Manual calendar smoke test in `npm run dev`: week view renders events at the correct times, month view navigation works

Commit messages: "Step 14a: Align @schedule-x/* versions", "Step 14b: Bump @supabase/supabase-js", "Step 14c: Bump temporal-polyfill to 1.x" (or a note-only commit if reverted)
```

---

## Step 15: Final regression & documentation sync

```
You're working in the Salsa Segura repo (React 19 + TypeScript + Vite + Supabase). This is Step 15 — the FINAL step of a 15-step modernization blueprint (Docs/plans/MODERNIZATION_BLUEPRINT.md). Steps 1-14 should already be merged. This step verifies the whole system end-to-end and leaves accurate documentation for whoever works on this repo next.

Global rules for every step in this roadmap: never touch files outside the target list below; `npm run build` must exit 0 after your change; never rename CSS classes; add no new dependencies; commit when validation passes, using the step title as the commit message.

Target files: CLAUDE.md, Docs/STATUS_SUMMARY.md

Objective: Run the complete quality gate across the whole app, manually click through every route, and update the two docs that describe current architecture/status so they reflect the post-modernization state (not the pre-modernization one).

Instructions:
1. Run, in order, and confirm each exits 0: `npm run lint`, `npx vitest run`, `npm run build`.
2. Run `npm run preview` and manually click through every route: `/`, `/about`, `/contact`, `/calendar`, `/submit`, `/lessons`, `/instructors`, an unmatched path (404 page), and a calendar deep-link (`/calendar?event=<real id>`). Confirm each renders correctly with no console errors.
3. Update `CLAUDE.md`'s Architecture section to describe the NEW data-flow chain: `eventsRepo → useEventsQuery → convert.ts` (replacing the old `useSupabaseEvents → useEvents → databaseEventToScheduleX` description). Document the `src/features/` directory convention introduced across Steps 4-11, note that TanStack Query is now the server-state layer, restate the explicit timezone policy from Step 5, and correct the event duration description to 4 hours (not 2).
4. Update `Docs/STATUS_SUMMARY.md` to reflect that the modernization blueprint has been executed, listing what changed.
5. Grep to confirm CLAUDE.md contains no leftover references to files deleted during this roadmap (`useSupabaseEvents`, `AuthContext`).

Validation:
- `npm run lint`, `npx vitest run`, and `npm run build` all exit 0
- Every route renders correctly during the manual click-through
- `grep -n "useSupabaseEvents\|AuthContext" CLAUDE.md` returns nothing

Commit message: "Step 15: Final regression & documentation sync"
```

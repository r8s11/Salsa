# Salsa Segura — Architecture Audit & Modernization Blueprint

**Document type:** Execution specification for junior coding agents
**Repo state at audit:** `main` @ `cd72d08`, working tree clean
**Audit date:** 2026-07-06

### 1. Project Context & State

| Field | Value |
|---|---|
| **Project Goal** | Community hub for salsa/bachata dance events in Boston & NYC: public event calendar, community event submission with moderation, school/instructor content pages. |
| **Current Tech Stack** | React 19, TypeScript 5.9, Vite 7, React Router v7, Supabase JS v2, @schedule-x v4, temporal-polyfill 0.3, Vitest 4 + Testing Library. Plain component-scoped CSS ("Ritmo Vivo" token system in `global.css`). |
| **Infrastructure** | Azure Static Web Apps via GitHub Actions (`Azure/static-web-apps-deploy@v1`, Oryx build). Supabase hosted Postgres. No API layer — client talks to Supabase directly. |
| **Primary Pain Points** | Bespoke fetch hooks with no caching (double-fetch between home + calendar); 349-line form monolith; implicit/fragile timezone handling; near-zero test coverage (2 smoke tests); CI deploys with no quality gate; dead/unrouted code; dual lockfiles; one suspicious dependency. |
| **Target State** | Feature-modular React SPA with repository-pattern data access, TanStack Query server-state caching, pure & tested domain logic (event conversion, validation), CI quality gates, and files sized for small-context execution agents (<150 lines/file target). |

---

## Phase 1: Architecture Review & Blind Spot Pass

### Critical Vulnerabilities

| # | Severity | Finding | Location | Detail |
|---|---|---|---|---|
| V1 | **HIGH** | Unknown package `@google/design.md@^0.3.0` in `dependencies` | `package.json` | Not a Google-scoped design tool anyone recognizes; currently *not installed* (`npm ls` → empty) but will be fetched on next clean install. Supply-chain risk. Remove before any other work. |
| V2 | **HIGH** | Dual lockfiles: `bun.lock` + `package-lock.json` | repo root | Local installs appear bun-managed; Azure Oryx builds with npm. Non-deterministic builds — CI and dev can resolve different dependency trees. Pick one manager (npm, since CI uses it) and delete the other lockfile. |
| V3 | **HIGH** | CI deploys `main` with zero quality gate | `.github/workflows/azure-static-web-apps-*.yml` | No lint/test job precedes deploy. A broken commit ships to production. Also `actions/checkout@v3` is deprecated (Node 16 runner). |
| V4 | **MED-HIGH** | Timezone handling is implicit and fragile | `src/types/events.ts` (`databaseEventToScheduleX`), `src/components/Events/Events.tsx` | Conversion round-trips through `new Date(event.event_date)` + local getters. If `events.event_date` is Postgres `timestamptz`, Supabase returns offset-qualified strings and **all displayed times shift by the visitor's timezone offset** (wrong everywhere outside Eastern). If it is naive `timestamp`, behavior relies on legacy `Date`-parsing quirks. Must be made explicit via Temporal + `America/New_York` (the polyfill is already a dependency but unused in this path). Bonus defect: comment says "Assume 2 hours duration"; code adds 4. |
| V5 | **MED** | Publicly writable `events` insert with no abuse controls | `SubmitEventPage.tsx`, Supabase RLS | Anonymous insert is by design (moderation queue), but there is no honeypot field, no length caps enforced client-side, no rate limiting. Spam floods the moderation queue. `Docs/sql queries/fix_insert_rls.sql` exists — verify applied. |
| V6 | **MED** | No React ErrorBoundary | `src/main.tsx`, `App.tsx` | Any render exception = permanent white screen. Supabase env-var throw in `lib/supabase.ts` happens at module scope — an import-time crash with no user-facing message. |
| V7 | **MED** | Unbounded events query | `useSupabaseEvents.ts` | Fetches *every* approved event since the beginning of time, forever-growing payload. Homepage then filters client-side to 6 future events. Needs a server-side date floor. |
| V8 | **LOW** | Missing security headers | `staticwebapp.config.json` | No `globalHeaders` (CSP, X-Content-Type-Options, Referrer-Policy). Also contains a no-op route (`/calendar` → `/calendar`). |
| V9 | **LOW** | Test coverage ≈ 0 | `src/App.test.tsx` only | 2 smoke tests. Zero coverage on: event conversion (timezone/DST), form validation, hooks, city persistence. |

### Dependency Audit

| Package | Current | Action |
|---|---|---|
| `@google/design.md` | ^0.3.0 (dependencies) | **REMOVE** (V1) |
| `@schedule-x/react` | ^4.1.0 | Align all four `@schedule-x/*` to same minor (4.6.0 available); version skew across the suite is a known breakage source |
| `temporal-polyfill` | ^0.3.0 | v1.0.1 exists. Defer to final step (breaking); pin exact version meanwhile |
| `@supabase/supabase-js` | ^2.95.3 | Routine bump to latest 2.x |
| `actions/checkout` | v3 | Bump to v5 |
| `react`, `react-dom`, `react-router-dom`, TS, Vite, Vitest | current | Healthy; routine patch bumps only |
| **ADD:** `@tanstack/react-query` | — | v5. Replaces bespoke fetch-in-useEffect; provides cache/dedup/retry between HomePage and CalendarPage |
| Lockfiles | bun.lock + package-lock.json | Keep `package-lock.json`, delete `bun.lock`, add `"packageManager"` field + `.nvmrc` |

### Structural Anti-Patterns

| # | File | Violation |
|---|---|---|
| A1 | `src/pages/SubmitEventPage.tsx` (349 ln) | Monolith: form state + validation + Supabase persistence + success view + full form markup in one file. Exceeds junior-agent context comfort; validation is untestable in isolation. |
| A2 | `src/components/Calendar/Calendar.tsx` (175 ln) | 5 responsibilities: calendar config, data loading, SEO injection, URL-param deep-linking (with a `setTimeout` state hack), ESC-key handling, modal orchestration. |
| A3 | `src/types/events.ts` | Mixed concerns: types + UI color config + conversion logic + **unused export** `bostonDateTime` (zero call sites). |
| A4 | `src/contexts/AuthContext.tsx` | 0-byte file committed. Delete. |
| A5 | `src/pages/Schools.tsx` + `src/pages/Schools/` (6 files) | Built but **unreachable** — no route in `App.tsx`. Dead code shipping ambiguity: route it or delete it. |
| A6 | `src/styles/global.css` (505 ln) | Contains page-scoped rules (`.contact-form`, `.dance-styles`, `.styles-grid`) that belong in component CSS files. |
| A7 | `CALENDARS_CONFIG` in `types/events.ts` | Hardcoded hexes duplicating `global.css` design tokens — two sources of truth for brand colors. |
| A8 | `Calendar.tsx` H1 | Hardcoded "Boston Dance Calendar" while a functioning BOS/NYC city switcher exists in Header. Stale UX. |
| A9 | `src/utils/seo.ts` | Imperative DOM mutation called ad-hoc from components; no cleanup on route change; should be a route-level hook. |

---

## Phase 2: The Modernization Blueprint

### Proposed File Tree

```
src/
├── app/
│   ├── App.tsx                      # routes only
│   ├── providers.tsx                # StrictMode + QueryClient + CityProvider composition
│   └── ErrorBoundary.tsx
├── features/
│   ├── events/
│   │   ├── api/eventsRepo.ts        # ALL Supabase event I/O (fetch + insert)
│   │   ├── model/types.ts           # DatabaseEvent, ScheduleXEvent, EventType, City
│   │   ├── model/convert.ts         # databaseEventToScheduleX (Temporal-based)
│   │   ├── model/convert.test.ts
│   │   ├── model/calendarsConfig.ts
│   │   ├── hooks/useEventsQuery.ts  # TanStack Query wrapper, keyed ['events', city]
│   │   └── components/              # EventCard, Events (home section), EventModal
│   ├── calendar/
│   │   ├── CalendarPage.tsx         # composition only (<100 ln)
│   │   ├── hooks/useEventDeepLink.ts
│   │   ├── hooks/useEscapeKey.ts
│   │   └── components/              # CalendarLegend, CalendarStatus
│   ├── submit-event/
│   │   ├── SubmitEventPage.tsx      # composition only
│   │   ├── validation.ts            # pure functions
│   │   ├── validation.test.ts
│   │   ├── useSubmitEventForm.ts    # state + submit orchestration
│   │   └── components/              # fieldset sub-components, SuccessCard
│   └── city/
│       └── CityContext.tsx          # unchanged (already clean)
├── shared/
│   ├── lib/supabase.ts
│   └── seo/useDocumentMeta.ts       # hook replacing imperative utils/seo.ts calls
├── pages/                           # thin route shells only (Home, About, …)
└── styles/                          # global.css (tokens/base only)
```

Migration is **move-and-rewire**, not rewrite. Existing components keep their names and CSS files.

### Design Patterns

| Pattern | Application |
|---|---|
| **Repository** | `eventsRepo.ts` is the *only* module importing `supabase` for event data. Components/hooks never touch the client directly. Enables mocking in tests without network. |
| **Server-state via TanStack Query** | `useEventsQuery(city)` with `staleTime` ≥ 5 min. Kills the home↔calendar double-fetch and the hand-rolled `mounted` flag/loading/error triad. |
| **Pure domain core** | `convert.ts` and `validation.ts` are side-effect-free functions → unit-testable by a junior agent with zero mocking. |
| **Custom hooks per concern** | `useEventDeepLink`, `useEscapeKey`, `useDocumentMeta`, `useSubmitEventForm` — each < 60 lines, single responsibility. |
| **Composition-root providers** | One `providers.tsx` so `main.tsx` stays 10 lines and future providers (auth) have an obvious home. |
| **Explicit timezone policy** | Single documented rule in `convert.ts`: DB timestamps are interpreted as instants, rendered as `America/New_York` wall-clock via Temporal. No `new Date()` string parsing anywhere in domain code. |

### Data Flow & State

```
READ:  Supabase(events, status=approved, city=X, date≥floor)
         → eventsRepo.fetchApprovedEvents(city)
         → useEventsQuery(city)  [TanStack cache, key: ['events', city]]
         → convert.ts (pure)
         → Events section / Schedule-X calendar / EventModal

WRITE: SubmitEventPage form
         → validation.ts (pure, returns first error | null)
         → eventsRepo.submitEvent(payload)  [status: 'pending']
         → moderation in Supabase → status flip → appears in READ path

CLIENT STATE: CityContext (localStorage-persisted UI selection) — the ONLY
              client-owned global state. City changes invalidate nothing;
              they simply address a different query cache key.
```

---

## Phase 3: Execution Agent Roadmap

**Global rules for the execution agent (apply to every step):**
- Never modify more files than listed in "Target File(s)".
- After every step: `npm run build` must exit 0. It runs `tsc -b` and is the primary regression gate.
- Never change CSS class names — visual regression risk.
- No new dependencies unless the step explicitly authorizes one.
- Commit after each validated step with the step title as the message.

---

* **Step 1: Sanitize dependencies & standardize package manager**
  * **Target File(s):** `package.json`, `bun.lock` (delete), `package-lock.json`, `.nvmrc` (new)
  * **Objective:** Remove the untrusted `@google/design.md` dependency and eliminate the dual-lockfile split (V1, V2).
  * **Instructions for Agent:** Delete the `@google/design.md` entry from `dependencies`. Delete `bun.lock`. Add a `packageManager` field pinning npm, and a `.nvmrc` containing the current LTS major. Run a clean `npm install` to regenerate `package-lock.json`. Do not bump any other versions in this step.
  * **Testing/Validation:** `npm install` exits 0; `grep design.md package.json` returns nothing; `npm run build` and `npx vitest run` pass; `bun.lock` absent from `git status`.

* **Step 2: Add CI quality gate**
  * **Target File(s):** `.github/workflows/azure-static-web-apps-lemon-stone-01afe980f.yml`
  * **Objective:** Block deploys on lint/test failure; retire deprecated action version (V3).
  * **Instructions for Agent:** Add a `quality` job (checkout → setup-node with npm cache → `npm ci` → `npm run lint` → `npx vitest run`) and make `build_and_deploy_job` depend on it via `needs`. Upgrade `actions/checkout` to v5 in both jobs. Do not alter the deploy step's inputs, secrets, or the `close_pull_request_job`.
  * **Testing/Validation:** YAML parses (`npx yaml-lint` or push to a branch and observe Actions run); both jobs appear; deploy job shows `needs: quality`.

* **Step 3: Delete dead code**
  * **Target File(s):** `src/contexts/AuthContext.tsx` (delete), `src/pages/Schools.tsx` + `src/pages/Schools/` (route or delete — see instruction), `src/types/events.ts`
  * **Objective:** Remove unreachable/empty modules that mislead future agents (A3-unused-export, A4, A5).
  * **Instructions for Agent:** Delete the empty `AuthContext.tsx`. Grep for imports of `Schools` — there are none in `App.tsx`; **ask the maintainer** whether Schools pages are launch-pending; if no answer available, keep files but add a route `schools` (lazy, matching existing route pattern) so they're reachable. Remove the unused `bostonDateTime` export from `types/events.ts` after confirming zero call sites via grep.
  * **Testing/Validation:** `npm run build` passes; `grep -rn "AuthContext\|bostonDateTime" src/` returns nothing; if routed, `/schools` renders in `npm run dev`.

* **Step 4: Create the events feature skeleton (move, don't rewrite)**
  * **Target File(s):** New: `src/features/events/model/types.ts`, `model/convert.ts`, `model/calendarsConfig.ts`. Modified: `src/types/events.ts` (becomes re-export shim).
  * **Objective:** Split the mixed-concern types file into three single-responsibility modules without breaking any import site (A3).
  * **Instructions for Agent:** Move interfaces/type aliases to `model/types.ts`; move `databaseEventToScheduleX` + its private formatter to `model/convert.ts`; move `CALENDARS_CONFIG` to `model/calendarsConfig.ts`. Convert `src/types/events.ts` into pure re-exports of all three so existing imports keep compiling. No logic changes in this step.
  * **Testing/Validation:** `npm run build` passes with zero import-site edits; `npx vitest run` passes.

* **Step 5: Make timezone handling explicit in convert.ts**
  * **Target File(s):** `src/features/events/model/convert.ts`; read-only reference: `Docs/sql queries/events.sql`
  * **Objective:** Eliminate visitor-timezone-dependent rendering (V4) and fix the 2h-comment/4h-code mismatch.
  * **Instructions for Agent:** First inspect `Docs/sql queries/events.sql` to determine whether `event_date` is `timestamp` or `timestamptz`; record the answer in a comment at the top of `convert.ts`. Reimplement conversion using Temporal (already a global polyfill): if `timestamptz`, parse as `Temporal.Instant` → `toZonedDateTimeISO('America/New_York')`; if naive `timestamp`, parse as `Temporal.PlainDateTime` directly. Output format stays `"YYYY-MM-DD HH:mm"`. Define `const DEFAULT_DURATION_HOURS = 4` and correct the stale comment. `new Date(` must not appear in this file.
  * **Testing/Validation:** `npm run build` passes; Step 6's tests are the real gate — proceed immediately to Step 6 before committing this as done.

* **Step 6: Unit-test the conversion domain**
  * **Target File(s):** `src/features/events/model/convert.test.ts` (new)
  * **Objective:** Lock the timezone contract with executable specification (V9).
  * **Instructions for Agent:** Write Vitest cases (globals enabled, no imports of describe/it needed): (1) known summer timestamp renders expected EDT wall-clock; (2) known winter timestamp renders expected EST wall-clock; (3) end = start + 4h; (4) an event spanning the DST fall-back boundary produces monotonically valid start<end; (5) null optional fields map to `undefined`. Use fixed literal timestamps, never `Date.now()`.
  * **Testing/Validation:** `npx vitest run src/features/events/model/convert.test.ts` → all green. If any case fails, fix `convert.ts`, not the test expectations.

* **Step 7: Introduce the events repository**
  * **Target File(s):** `src/features/events/api/eventsRepo.ts` (new), `src/hooks/useSupabaseEvents.ts`, `src/pages/SubmitEventPage.tsx`
  * **Objective:** Centralize all Supabase event I/O behind two functions (Repository pattern).
  * **Instructions for Agent:** Create `fetchApprovedEvents(city: City): Promise<DatabaseEvent[]>` (moves the query from `useSupabaseEvents`, adding `.gte('event_date', <today minus 1 day, ISO>)` as the date floor — V7) and `submitEvent(payload: NewEventSubmission): Promise<void>` (moves the insert object from `SubmitEventPage`; define the `NewEventSubmission` type in the repo file). Rewire both call sites to the repo. After this step, `from("events")` appears only in `eventsRepo.ts`.
  * **Testing/Validation:** `grep -rn 'from("events")' src/` → 1 file; `npm run build` passes; manual: `npm run dev`, homepage shows events, submit form still submits (verify a `pending` row appears, then delete it).

* **Step 8: Adopt TanStack Query**
  * **Target File(s):** `package.json` (+`@tanstack/react-query@^5`), `src/app/providers.tsx` (new), `src/main.tsx`, `src/features/events/hooks/useEventsQuery.ts` (new), `src/hooks/useEvent.ts`, `src/hooks/useSupabaseEvents.ts` (delete)
  * **Objective:** Replace bespoke fetch-state plumbing with cached server state; dedupe home/calendar fetches.
  * **Instructions for Agent:** Dependency authorized: `@tanstack/react-query` v5 only (no devtools). Create `providers.tsx` composing StrictMode → QueryClientProvider (staleTime 5 min, retry 1) → CityProvider; reduce `main.tsx` to render `<Providers><App/></Providers>`. Implement `useEventsQuery(city)` with query key `['events', city]`, fetching via `eventsRepo` and mapping through `convert.ts`. Keep `useEvents()`'s public return shape `{ events, loading, error }` exactly (map `isPending`→`loading`, error→message string) so zero component edits are needed. Delete `useSupabaseEvents.ts`.
  * **Testing/Validation:** `npm run build` + `npx vitest run` pass; manual: navigate Home → Calendar and confirm via devtools Network tab that the events request fires **once**, not twice; switching BOS↔NYC triggers exactly one new request per city.

* **Step 9: Extract submit-event validation**
  * **Target File(s):** `src/features/submit-event/validation.ts` (new), `validation.test.ts` (new), `src/pages/SubmitEventPage.tsx`
  * **Objective:** Make form rules pure and tested (A1 part 1/2, V9).
  * **Instructions for Agent:** Move `validateForm` logic into exported pure function `validateSubmitForm(form): string | null` plus the `SubmitForm` interface and `buildInitialForm`. Extend validation with max-length caps (title 120, description 2000, others 300) as cheap spam friction (V5). Tests: paid-without-amount, negative amount, malformed URL, non-http protocol, over-length title, valid form → null.
  * **Testing/Validation:** `npx vitest run src/features/submit-event/validation.test.ts` green; `npm run build` passes; manual: submitting a paid event without amount still shows the error banner.

* **Step 10: Decompose SubmitEventPage**
  * **Target File(s):** `src/features/submit-event/useSubmitEventForm.ts` (new), `src/features/submit-event/components/` (new: one component per `<fieldset>` + `SuccessCard`), `src/pages/SubmitEventPage.tsx`
  * **Objective:** Reduce the 349-line monolith to a <100-line composition (A1 part 2/2).
  * **Instructions for Agent:** Hook owns: form state, `update`, `handleSubmit` (validate → `eventsRepo.submitEvent` → submitted flag), `isSubmitting/isSubmitted/error`. Extract each existing fieldset (Event Details, Location, Pricing & Link, Your Info) verbatim into its own component receiving `{ form, update }` props. Preserve every id, label, placeholder, and class name byte-for-byte. `SubmitEventPage.css` import stays in the page shell.
  * **Testing/Validation:** `npm run build` passes; manual full pass in dev: fill form incl. paid price toggle, submit, see success card, "Submit Another Event" resets; each page-shell/component file ≤ 150 lines (`wc -l`).

* **Step 11: Decompose Calendar page & fix stale H1**
  * **Target File(s):** `src/features/calendar/hooks/useEventDeepLink.ts` (new), `hooks/useEscapeKey.ts` (new), `components/CalendarLegend.tsx` (new), `components/CalendarStatus.tsx` (new), `src/components/Calendar/Calendar.tsx`, `src/shared/seo/useDocumentMeta.ts` (new)
  * **Objective:** Single-responsibility split of the 5-concern component (A2, A8, A9).
  * **Instructions for Agent:** `useEscapeKey(handler)` wraps the keydown effect. `useEventDeepLink(events, onOpen)` owns the `?event=` param logic including the existing one-shot ref guard; replace the `setTimeout(…, 0)` hack with a `useEffect` that fires when events arrive. `useDocumentMeta({ title, description })` wraps the two imperative SEO calls with cleanup restoring previous title on unmount. Legend and status blocks move verbatim to their components. Make the H1 city-aware using `useCity()`: "Boston Dance Calendar" / "NYC Dance Calendar" (subtitle unchanged). Structured-data injection stays where it is for now.
  * **Testing/Validation:** `npm run build` passes; manual: `/calendar?event=<real id>` opens the modal on load; ESC closes it and strips the param; city switch flips the H1; document title updates on calendar entry and reverts when navigating Home.

* **Step 12: Hosting config hardening**
  * **Target File(s):** `staticwebapp.config.json`
  * **Objective:** Add security headers, remove the no-op route (V8).
  * **Instructions for Agent:** Delete the `/calendar`→`/calendar` route entry (keep `navigationFallback` untouched). Add `globalHeaders`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera/microphone/geolocation, and a CSP in **Report-Only** mode first — `default-src 'self'` with `connect-src` allowing the Supabase project URL and Web3Forms endpoint, `img-src 'self' data: https:`, `style-src 'self' 'unsafe-inline'`, plus the Google Fonts hosts actually referenced in `index.html`. Do not set an enforcing CSP in this step.
  * **Testing/Validation:** JSON parses; after next deploy, response headers visible via `curl -I` on the SWA URL; browser console shows zero CSP report violations during a full manual click-through — only then may a later change promote CSP to enforcing.

* **Step 13: CSS ownership cleanup**
  * **Target File(s):** `src/styles/global.css`, `src/components/Contact/Contact.css`, relevant page CSS files
  * **Objective:** `global.css` = tokens, resets, shared primitives (`.btn-*`, `.style-chip`, `.section-title`, focus states) only (A6).
  * **Instructions for Agent:** Relocate `.contact-form*`, `.dance-styles`, `.styles-grid`, `.contact-info` rule blocks verbatim into the CSS file of the component that renders those classes (grep each class to find the owner). Zero property changes — cut/paste only. Update the mobile media query in `global.css` to drop relocated selectors, duplicating the query in destination files where needed.
  * **Testing/Validation:** `npm run build` passes; visual diff in dev of Home + Contact at 1280px and 375px against pre-change screenshots — pixel-identical expected.

* **Step 14: Dependency modernization pass**
  * **Target File(s):** `package.json`, `package-lock.json`
  * **Objective:** Close the version-skew and stale-major items from the Dependency Audit.
  * **Instructions for Agent:** Align all `@schedule-x/*` to the same latest 4.x minor; bump `@supabase/supabase-js` within 2.x. Then, in an isolated commit, attempt `temporal-polyfill` → 1.x: read its changelog first; the global-import path (`temporal-polyfill/global`) and `Temporal.*` call sites in `convert.ts`, `Calendar.tsx` are the blast radius. If any API mismatch surfaces, revert the temporal bump only and record the blocker in `Docs/plans/TODO.md`.
  * **Testing/Validation:** `npm run build`, `npm run lint`, `npx vitest run` all green after each individual bump (bump → validate → commit, one package family at a time); manual calendar smoke: week view renders events at correct times, month view navigates.

* **Step 15: Final regression & documentation sync**
  * **Target File(s):** `CLAUDE.md`, `Docs/plans/STATUS_SUMMARY.md`
  * **Objective:** Verify the whole system and leave accurate docs for the next agent.
  * **Instructions for Agent:** Run the full gate: `npm run lint`, `npx vitest run`, `npm run build`, `npm run preview` + manual click-through of every route (/, /about, /contact, /calendar, /submit, /lessons, /instructors, 404, deep-link `?event=`). Update CLAUDE.md's Architecture section: new data-flow chain (`eventsRepo → useEventsQuery → convert`), features/ directory convention, TanStack Query usage, timezone policy, and the corrected 4-hour default duration.
  * **Testing/Validation:** All commands exit 0; every route renders; CLAUDE.md contains no references to deleted files (`useSupabaseEvents`, `AuthContext`).

---

**Sequencing rationale:** Steps 1–3 de-risk the substrate (deps, CI, dead code) so every later step is gated. Steps 4–6 isolate and *test* the domain core before anything depends on it. Steps 7–8 change data access only after conversion is locked by tests. Steps 9–11 are pure decomposition with stable observable behavior. Steps 12–14 are config/dependency work safest done on a clean, tested base. No step requires the agent to hold more than ~2 files of context.

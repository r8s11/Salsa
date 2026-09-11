# Salsa Segura — Combined Plan: Modernization Blueprint + "Ritmo Vivo" Redesign

## Execution scope of this approval — DOCUMENTATION ONLY

**Do not implement Phases A–E.** This approval persists the combined plan into the repo and corrects documentation claims that were verified false against the working tree. Phases A–E below are the *content being saved* and the record for a later approval — not work to perform now.

Permitted writes: files under `Docs/` only.
**Forbidden in this pass:** any file under `src/`, `package.json`, `package-lock.json`, `bun.lock`, `.github/`, `staticwebapp.config.json`, `index.html`; any `npm install` / dependency change; any git commit unless the user asks.

Tasks S1–S6 are the entire job. Each is a statement that is true of the repo *today* — none of them asserts that redesign or modernization work has shipped.

**S1 — Save the combined plan.** Create `Docs/plans/REDESIGN_AND_MODERNIZATION_PLAN.md` containing this document from the `## Context` heading onward (everything except this "Execution scope" section, which describes the save operation rather than the plan). Add a header block at the top of the new file:
```markdown
# Salsa Segura — Combined Plan: Modernization Blueprint + "Ritmo Vivo" Redesign

**Document type:** Execution specification (supersedes the standalone sequencing in `MODERNIZATION_BLUEPRINT.md`)
**Status:** Approved, not yet executed — no phase has been implemented
**Repo state verified:** 2026-08-03
```

**S2 — `Docs/plans/MODERNIZATION_BLUEPRINT.md`.** Add a dated banner under the title pointing to `REDESIGN_AND_MODERNIZATION_PLAN.md` as the sequencing source of truth, and annotate step status inline from the verified table below: Step 1 **partial** (only `bun.lock` outstanding), Steps 2 and 3 **done**, Steps 4–15 not started. Rewrite Step 5's instruction to state the settled answer (`event_date` is `timestamptz` per `Docs/sql queries/events.sql:7` → Instant branch only) instead of asking the agent to inspect. Strike Step 4's `calendarsConfig.ts` deliverable. Mark Step 11 "superseded by the combined plan's Phase C (Calendar becomes a week view; only `useDocumentMeta` survives (see C2))." Amend Step 14 to drop the Schedule-X alignment item. Update the findings table status column: V1, V3, A5 resolved; V2 outstanding only as `bun.lock`; V4 confirmed live with evidence. Do **not** delete any step text — annotate, so the audit trail survives.

**S3 — `Docs/plans/MODERNIZATION_AGENT_PROMPTS.md`.** Every prompt opens with "This is Step N of a 15-step modernization blueprint … Steps 1-(N-1) should already be merged", which is now wrong. Replace the document's header note with the combined phase order (A → B → C → D → E) and a pointer to `REDESIGN_AND_MODERNIZATION_PLAN.md`. Fix each surviving prompt's preamble to name its real predecessor phase. Mark the Step 1 prompt "partially applied — only `bun.lock` remains", and the Step 2 and Step 3 prompts "already applied — skip". Mark the Step 11 prompt superseded and the Step 14 prompt's Schedule-X paragraph void. **Do not author new Phase C prompts** — point readers at the combined plan's Phase C section instead; duplicating step detail across two files is what produced the current drift.

**S4 — `Docs/STATUS_SUMMARY.md`.** Correct only what is verifiably false today: drop `@google/design.md` from Key Risks #1 and from the blueprint findings list (removed from `package.json`); drop V3 (the CI quality gate exists); fix the Authentication row (`src/contexts/AuthContext.tsx` no longer exists — the feature is still unbuilt, but the "empty file committed" detail is stale); delete the "Dead/unrouted code: Schools" note (`App.tsx:31` routes it); change "38 passing across 11 files" to **23 tests across 6 files** (App 2, EventModal 8, events 2, filterEvents 3, ics 5, series 3). Re-run `npm ci` before touching the "Local dev broken / `lucide-react` not installed" risk — if it installs cleanly, delete that risk; if it still fails, keep it with an updated cause. Re-point "Active Plan" at `plans/REDESIGN_AND_MODERNIZATION_PLAN.md`. Do **not** add the redesign to "What's Built" — it has not shipped.

**S5 — `Docs/ROADMAP.md`.** Add `REDESIGN_AND_MODERNIZATION_PLAN.md` to Quick Links and update the "Current focus" line to name it. Annotate — but do **not** flip — the three roadmap rows the plan targets: **W11** Enhanced event pages `/events/[id]` (stays 🔄 Partial; note "full route planned in combined plan Phase C5"), **W21** Photo gallery (stays 🔄 Partial; note "gallery UI planned in C5"), **W49** Event homepage redesign 📅 Planned → ✅ Done (C4). Add an inline note on **W31** Mobile app (PWA) that the plan's `/mobile-app` page is a concept showcase, not a PWA, so a later reader does not mistake it for delivery. Flipping any of these to ✅ before Phase C ships would reintroduce exactly the kind of false claim S4 is correcting.

**S6 — `Docs/DASHBOARD.md`.** Update Current Date and the Phase line to reference the combined plan; change the "In Progress" bullet to point at `plans/REDESIGN_AND_MODERNIZATION_PLAN.md`; add it to Quick Links. Leave the Completed list untouched. Leave `Docs/TODO.md` entirely alone — its single open item ("Make the Contact page fit all in a single view") is unrelated to this work.

*Verification for this pass:* `glob Docs/plans/REDESIGN_AND_MODERNIZATION_PLAN.md` returns the file; `grep -rn "@google/design.md\|38 passing\|11 files\|unrouted\|AuthContext" Docs/` returns nothing; `grep -rln "REDESIGN_AND_MODERNIZATION_PLAN" Docs/` lists BLUEPRINT, AGENT_PROMPTS, STATUS_SUMMARY, ROADMAP, and DASHBOARD; `git status --short` shows changes under `Docs/` only, and no `src/` or `package.json` entry; `grep -n "✅ Done" Docs/ROADMAP.md` shows no new entries for W11/W21/W49.

## Context

Two plans now exist for this repo and they collide. `Docs/plans/MODERNIZATION_BLUEPRINT.md` (15 steps, audited 2026-07-06) refactors the data layer, decomposes monoliths, and hardens CI/hosting. The Claude Design prototype `Salsa Segura - Redesign.dc.html` (fully extracted: logic class + markup for Home / Event Detail / Calendar / Mobile App / Submit) replaces the event-discovery UI. Executing them independently would waste work — the blueprint's Step 11 decomposes a `Calendar.tsx` the redesign deletes, and the redesign multiplies `useEvents()` call sites the blueprint's Step 8 is designed to cache.

This plan merges them into one ordered sequence, amends the blueprint steps the redesign obsoletes, and updates the repo's plan/status docs to match. It also corrects stale doc claims verified false this session.

End state: the redesigned discovery flow (new Home, dedicated `/events/:id` page replacing `EventModal`, week-view Calendar replacing Schedule-X, new `/mobile-app` showcase, restyled Submit) running on the blueprint's target architecture (repository + TanStack Query + Temporal-explicit timezone + tested domain core), with `Docs/` reflecting reality.

### Verified repo state (checked this session — supersedes doc claims)

| Blueprint step | Doc claim | Actual | Evidence |
|---|---|---|---|
| 1 — deps/lockfile | "not yet executed" | **PARTIAL** — `@google/design.md` gone, `.nvmrc` + `packageManager: npm@11.6.2` present, **`bun.lock` still at root** | `package.json`, `glob bun.lock` |
| 2 — CI quality gate | "still open (V3)" | **DONE** — `quality` job (lint + vitest), `build_and_deploy_job` has `needs: quality`, `actions/checkout@v5` | `.github/workflows/azure-static-web-apps-lemon-stone-01afe980f.yml` |
| 3 — dead code | "AuthContext empty file; Schools unrouted" | **DONE** — `AuthContext.tsx` absent, `<Route path="schools">` exists in `App.tsx:31`, `bostonDateTime` absent | `glob`, `App.tsx`, `grep` |
| 4–11 | pending | **NOT STARTED** — no `src/features/`, no `src/app/` | `glob` |
| 12 — hosting | pending | **NOT STARTED** — no `globalHeaders`; no-op `/calendar`→`/calendar` route still present | `staticwebapp.config.json` |
| 14 — deps | pending | **NOT STARTED** — no `@tanstack/react-query` | `package.json` |
| Tests | "38 passing across 11 files" | **23 tests across 6 files** (App 2, EventModal 8, events 2, filterEvents 3, ics 5, series 3) | `grep '^\s*it\('` |
| V4 timezone | "open" | **OPEN and confirmed live** — `events.sql:7` declares `event_date timestamp with time zone`; `formatDateTimeForScheduleX` (`types/events.ts:102-110`) reads `getFullYear/getMonth/getDate/getHours` off a `new Date(...)` → renders in the **visitor's** timezone | `Docs/sql queries/events.sql`, `src/types/events.ts` |

`event_date` being `timestamptz` **settles the open question in blueprint Step 5** ("inspect events.sql to determine whether…"): the answer is timestamptz; Step 5's instruction collapses to the Instant branch only.

### Why the redesign must not go first

Two hard dependencies, both amplified by the redesign:

1. **Fetch fan-out.** Today two components call `useEvents()`. The redesign adds Hero, Ticker's parent, Events, `EventDetailPage`, the new Calendar, and `MobileAppPage` — ~6 independent `useSupabaseEvents` calls, each an uncached Supabase round-trip (3 on the Home route alone). Blueprint Step 8 (TanStack Query, key `['events', city]`) turns that into one request. Landing the redesign first ships a measurable performance regression that Step 8 then silently fixes.
2. **Timezone correctness surface.** V4 currently mis-renders times in 2 places. The redesign renders event times in ~8 (hero stats, ticker, featured, feed cards, detail bar, week-grid **day bucketing**, agenda grouping, related rows). The week grid is the sharp edge: it buckets by `dateKey(localDate)`, so a non-Eastern visitor sees events land in the **wrong day column** — a visible correctness bug, not just a shifted label. Fix V4 before multiplying its blast radius.

Phases run in order; steps inside a phase are sequential unless marked independent.

## Approach

### Phase A — Finish Step 1 (blocking, ~5 min)

**A1.** Delete `bun.lock` from the repo root. `package-lock.json` is authoritative (CI runs `npm ci`; `packageManager` pins `npm@11.6.2`). No other file changes; do not bump versions here.
*Done when:* `glob bun.lock` returns nothing; `npm ci && npm run build` exits 0.

### Phase B — Data layer prerequisites (blueprint Steps 4–8, amended)

**B1 — Events feature skeleton (blueprint Step 4, unchanged).** Create `src/features/events/model/types.ts` (interfaces + type aliases from `src/types/events.ts`) and `model/convert.ts` (`databaseEventToScheduleX` + its private formatter). **Do not create `model/calendarsConfig.ts`** — blueprint Step 4 says to move `CALENDARS_CONFIG` there, but Phase C deletes that export entirely (it is Schedule-X-only config, and finding A7 flags its hardcoded hexes as a second source of truth for brand colour). Leave `CALENDARS_CONFIG` in place in `src/types/events.ts` until C1 deletes it. Convert `src/types/events.ts` into pure re-exports so no import site changes.
*Done when:* `npm run build` and `npx vitest run` pass with zero edits to any importing file.

**B2 — Explicit timezone in `convert.ts` (blueprint Step 5, question pre-answered).** `event_date` is `timestamptz` — implement the Instant branch only: `Temporal.Instant.from(event.event_date).toZonedDateTimeISO("America/New_York")`, then format to the existing `"YYYY-MM-DD HH:mm"` wire shape from the zoned fields. Add `const DEFAULT_DURATION_HOURS = 4;` and fix the stale "Assume 2 hours" comment (code has always added 4). Record the column type in a top-of-file comment. `new Date(` must not appear in this file.
*Done when:* B3's tests pass — do not mark B2 done alone.

**B3 — Conversion tests (blueprint Step 6, unchanged).** `src/features/events/model/convert.test.ts` with fixed literal timestamps (never `Date.now()`): summer instant → expected EDT wall-clock; winter instant → expected EST wall-clock; `end === start + 4h`; a DST fall-back-spanning event yields `start < end`; null optional fields → `undefined`. If a case fails, fix `convert.ts`, never the expectation.
*Done when:* `npx vitest run src/features/events/model/convert.test.ts` green.

**B4 — Events repository (blueprint Step 7, unchanged).** `src/features/events/api/eventsRepo.ts` exporting `fetchApprovedEvents(city: City): Promise<DatabaseEvent[]>` (the query moved out of `useSupabaseEvents`, **plus** `.gte('event_date', <today − 1 day, ISO>)` — V7's date floor, now load-bearing because Phase C removes the homepage's `slice(0, 6)` cap and renders the full upcoming list) and `submitEvent(payload: NewEventSubmission): Promise<void>` (the insert object moved out of `SubmitEventPage`; declare `NewEventSubmission` in this file). Rewire both call sites.
*Done when:* `grep -rn 'from("events")' src/` returns exactly one file; homepage still lists events in `npm run dev`; a test submit still writes a `pending` row.

**B5 — TanStack Query (blueprint Step 8, unchanged).** Authorized dependency: `@tanstack/react-query@^5` (no devtools). Create `src/app/providers.tsx` composing StrictMode → QueryClientProvider (`staleTime` 5 min, `retry` 1) → CityProvider; reduce `main.tsx` to rendering `<Providers><App /></Providers>`. Implement `src/features/events/hooks/useEventsQuery.ts`, key `['events', city]`, fetching via `eventsRepo` and mapping through `convert.ts`. **Keep `useEvents()`'s public return shape `{ events, loading, error }` byte-identical** (map `isPending`→`loading`, error→message string) so Phase C components — and today's components — need no edits. Delete `src/hooks/useSupabaseEvents.ts`.
*Done when:* Home→Calendar navigation fires the events request **once** (devtools Network); BOS↔NYC switch fires exactly one new request per city.

### Phase C — The redesign

Placement rule, applied throughout: **event-domain** components live in `src/features/events/components/`; **route shells and site chrome** (Header, Footer, Hero, Contact, WIP, Scroll, Instructor) stay in `src/components/` and `src/pages/`. New files go straight to their final path — no later move step.

Canonical design source: `Comprehensive redesign scope/Salsa Segura - Redesign.dc.html` (re-read the relevant `sc-if` block when spacing or copy is ambiguous; prefer it over the 646 KB standalone bundle). Its inline `style="…"` attributes are a Claude Design authoring artifact — every one becomes a real class in a component `.css` file, matching the existing convention (`Header.css`, `Events.css`). The prototype's `rv-flip`, `rv-pulse`, `rv-scrolldot` keyframes are dead code in the source (defined, never applied) — do not port them. Its `rv-in`/`rv-fade` duplicate the existing `fadeIn`/`fadeInUp` in `global.css` — reuse those.

**C1 — Event-type colour tokens + presentation util (do first; everything below imports it).**

Finding A7 flags `CALENDARS_CONFIG`'s hardcoded hexes as a second source of truth for brand colour. Copying the prototype's `typeColors()` hexes into a new TS module would recreate that exact anti-pattern, so the colours land in CSS and the util only names them.

Add to `src/styles/global.css` §1 tokens (event-type families; values verbatim from the prototype's `typeColors()`):
```css
  /* Event types — social/class/workshop */
  --event-social-bg:     rgba(225, 29, 72, 0.16);
  --event-social-fg:     #ffb3c0;
  --event-social-accent: #ff5874;
  --event-social-chip:   rgba(225, 29, 72, 0.18);
  --event-social-border: rgba(225, 29, 72, 0.40);
  --event-social-thumb:  linear-gradient(135deg, #7a0a26, #c2153c);
  --event-class-bg:      rgba(124, 147, 233, 0.16);
  --event-class-fg:      #c8d2ff;
  --event-class-accent:  #7c93e9;
  --event-class-chip:    rgba(124, 147, 233, 0.18);
  --event-class-border:  rgba(124, 147, 233, 0.40);
  --event-class-thumb:   linear-gradient(135deg, #2a3566, #4756a8);
  --event-workshop-bg:      rgba(233, 195, 73, 0.15);
  --event-workshop-fg:      #ffe9a8;
  --event-workshop-accent:  #e9c349;
  --event-workshop-chip:    rgba(233, 195, 73, 0.16);
  --event-workshop-border:  rgba(233, 195, 73, 0.40);
  --event-workshop-thumb:   linear-gradient(135deg, #574500, #a8871a);
```
Also add one keyframe to §8: `@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`.

Create `src/features/events/model/eventPresentation.ts` — returns token *references*, never literals:
```ts
import type { EventType } from "./types";

export interface EventTypeStyle {
  bg: string; fg: string; accent: string; chip: string; border: string; thumb: string;
}

export function eventTypeStyle(type: EventType): EventTypeStyle {
  return {
    bg:     `var(--event-${type}-bg)`,
    fg:     `var(--event-${type}-fg)`,
    accent: `var(--event-${type}-accent)`,
    chip:   `var(--event-${type}-chip)`,
    border: `var(--event-${type}-border)`,
    thumb:  `var(--event-${type}-thumb)`,
  };
}

const LABELS: Record<EventType, string> = { social: "Social", class: "Class", workshop: "Workshop" };
export function eventTypeLabel(type: EventType): string { return LABELS[type]; }
```
Delete `CALENDARS_CONFIG` from `src/types/events.ts` (and its re-export from B1's shim). Verified this session: its only consumer is `Calendar.tsx`'s Schedule-X `calendars:` option, which C5 removes. `grep -rn "CALENDARS_CONFIG" src` must return zero after C5.

**C2 — Shared SEO hook (salvaged from blueprint Step 11).** Create `src/shared/seo/useDocumentMeta.ts`: `useDocumentMeta({ title, description, canonical? }: { title: string; description: string; canonical?: string }): void` — wraps the existing imperative `updatePageTitle` / `updateMetaDescription` / `updateCanonicalUrl` from `src/utils/seo.ts`, restoring the previous title on unmount (finding A9: no cleanup on route change). Both the new Calendar (C5) and `EventDetailPage` (C4) consume it instead of calling the imperative helpers inline — this is the piece of blueprint Step 11 that survives the redesign.

**C3 — Header & Footer pill redesign (independent of C4–C7; all pages depend on it).**

`src/components/Header/Header.tsx` + `Header.css`:
- Keep every existing `NavLink` destination (`/`, `/about`, `/calendar`, `/lessons`, `/instructors`, `/contact`) — those pages are outside the redesign and stay reachable.
- Drop the bare `to="/#events"` "Events" link (currently `Header.tsx:63-67`): the feed section becomes `id="feed"` and Home already covers it.
- Add `NavLink to="/mobile-app"` labeled "Mobile App" after Calendar (prototype nav order: Home, Calendar, Mobile App, …).
- Nav items become pills: `padding:9px 15px; border-radius:9999px`; active `background:rgba(225,29,72,.16)` + `#fff`; inactive `var(--text-muted)`; hover `background:rgba(255,255,255,.06)` + `#fff`. Replaces the underline-reveal treatment at `Header.css:56-98`.
- City switch restyle only (handlers unchanged): track `background:rgba(255,255,255,.05)`, `border:1px solid var(--border)`, `padding:3px`; active button `background:var(--red)` `#fff`; inactive `var(--text-dim)`.
- Add a rightmost CTA `<Link to="/submit">+ Add Event</Link>`: `background:linear-gradient(120deg,var(--red),#c2153c)`, `box-shadow:0 6px 18px rgba(225,29,72,.32)`. Additive — does not replace the Contact link.
- Header shell: `position:sticky; top:0; z-index:60; backdrop-filter:blur(14px); background:rgba(11,19,38,.72); border-bottom:1px solid var(--border)`.
- Hamburger behavior (`mobileOpen` state, `.active` toggling, `@media (max-width: 990px)` at `Header.css:178-223`) unchanged — restyle pills inside the open list only.

`src/components/Footer/Footer.tsx` + `Footer.css`: prototype footer shape — `border-top:1px solid var(--border)`, `background:rgba(255,255,255,.02)`, flex row of logo block / link row / full-width copyright with its own top border. Add the tagline `Passion for dance · Greater Boston & NYC` under the logo and shorten the copyright to `© {year} Salsa Segura. All rights reserved.` **Keep the Buy Me a Coffee link** — place the existing `<a>`+`<img>` badge in the restyled link row beside Instagram/Email/Call, badge markup unchanged.

**C4 — Home: Hero, Ticker, Featured, Feed.**

`src/components/Hero/Hero.tsx` + `Hero.css` — full rewrite. No props; reads `useCity()` for `cityLabel` (`city === "boston" ? "Greater Boston" : "New York City"`) and `useEvents()` for stats. Structure: eyebrow `{cityLabel} · Live Dance Guide`; `<h1>` "Find your / rhythm." (rose-bright "rhythm", gold "."); subtitle naming `{cityLabel}`; primary CTA "Tonight on the floor" scrolling to `#feed` (`getElementById("feed")` → `window.scrollTo({ top: rect.top + scrollY - 70, behavior: "smooth" })`, matching the prototype's `scrollFeed` offset); secondary `Link to="/calendar"` "Full calendar". Stats row: `[{num: String(upcoming.length), label: "Events this week"}, {num: String(new Set(upcoming.map(e => e.location)).size), label: "Venues"}, {num: city === "boston" ? "BOS" : "NYC", label: "On the floor"}]`. While `loading`, render `—` for the numeric stats (never a flash of `0`). Background radial-gradient + grid overlay are static CSS. The prototype's empty `<span style="perspective:600px">` in the H1 is a dead decorative node — omit it.

`src/features/events/components/Ticker.tsx` + `Ticker.css` (new) — props `{ events: ScheduleXEvent[] }` (pre-filtered upcoming). Builds `events.slice(0, 6).map(e => ({ text: e.title.toUpperCase(), color: eventTypeStyle(e.calendarId).fg }))`, concatenated with itself for a seamless loop, inner row animated `animation: marquee 34s linear infinite`. Returns `null` when `events.length === 0` — no empty bar.

`src/features/events/components/Featured.tsx` (new, shares `Events.css` — same precedent as `EventCard.tsx`) — props `{ event: ScheduleXEvent }`. Two-column card: image left (`event.imageUrl`, else a `eventTypeStyle(...).thumb` gradient div — no bare placeholder in production), date badge (weekday / day / month) over it, then type chip, title, time + location row, description truncated at 130 chars + `…` (prototype's `slice(0, 130)`), and a "View details & gallery →" affordance. Whole `<article>` is `role="button" tabIndex={0}` with click + Enter/Space keydown → `/events/${event.id}`, copying the accessible pattern already in `EventCard.tsx:25-36`.

`src/features/events/components/Events.tsx` (rewrite of `src/components/Events/Events.tsx`, moved) — section `id` changes `events` → `feed`. Drop the `slice(0, 6)` cap. Compute `upcoming` (future, city-scoped, already sorted ascending by the query), then `featured = upcoming[0]` and `rest = upcoming.slice(1)`. Local `const [filter, setFilter] = useState<TypeFilter>("all")`; filter `rest` through the existing `filterEventsByType` (`src/utils/filterEvents.ts` — reuse, it has its own passing tests). Render heading "This week's floor" + four pill chips (All / Socials / Classes / Workshops; active `background:var(--red)` `#fff`, inactive transparent + `border:1px solid var(--border-md)` + `var(--text-muted)`), then the `EventCard` grid. Preserve today's loading-skeleton and error-banner blocks (`Events.tsx:17-44`) behaviorally. Empty filtered result → dashed-border box: `No {activeFilterLabel} events this week in {cityLabel}. Try another filter.`

`src/features/events/components/EventCard.tsx` (moved + restyled) — navigation target changes from `/calendar?event=${id}` to `/events/${id}`. Layout changes from the left date-strip (`Events.css:71-118`) to the prototype's top-thumbnail card: 150 px header with `background: eventTypeStyle(...).thumb` + dot-pattern overlay, type chip top-left, day / month / weekday in white bottom-left; body below carries title + time + location. Remove the card-footer "View Details" / "RSVP" buttons — the whole card is the target and RSVP now lives on the detail page. Keep `role="button"`, `tabIndex`, `aria-label`, keydown handling. Update `Events.css` accordingly (structural rewrite of the card rules, not additive).

`src/pages/HomePage.tsx`:
```tsx
import Hero from "../components/Hero/Hero";
import Ticker from "../features/events/components/Ticker";
import Events from "../features/events/components/Events";
import Contact from "../components/Contact/Contact";
import { useEvents } from "../hooks/useEvent";

function HomePage() {
  const { events } = useEvents();
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.end.replace(" ", "T")) >= now);
  return (
    <>
      <Hero />
      <Ticker events={upcoming} />
      <Events />
      <Contact />
    </>
  );
}
export default HomePage;
```
`Contact` stays exactly as-is — the redesign does not model it and does not change it. The three `useEvents()` calls on this route collapse to one network request via B5's cache.

**C5 — Event Detail page, replacing `EventModal`.**

Create `src/features/events/EventDetailPage.tsx` + `EventDetailPage.css`; route param `:id`; resolve via `useEvents()` → `events.find(e => String(e.id) === id)`. Not-found (bad id, or a shared link for an event in the *other* city, since `useEvents()` is city-scoped) renders a not-found panel with a link back to `/` — never a crash, never a silent redirect.

Port the prototype's layout, but carry over every real capability `EventModal` has today (the prototype's mock detail view is thinner than the shipped modal — these gaps are filled from `EventModal.tsx`, not dropped):
- **Hero:** full-bleed `event.imageUrl` (gradient-by-type fallback), scrim, "← Back to floor" pill (`Link to="/"`, matching the prototype's `goBack`), type chip + title overlaid at the bottom.
- **Sticky meta/RSVP bar** under the hero: date, time range, price. Price logic ported verbatim from `EventModal.tsx:106-108` — `isFree = event.priceType === "free" || event.priceAmount == null`; label `"Free"` or `` `$${event.priceAmount}` ``; RSVP link text `"RSVP · Free"` when free, `"Get Tickets"` when paid. Render the RSVP anchor **only** when `event.rsvpLink` is set.
- **Body left:** "About the night" (`event.description`, omitted when null) and "The lineup". The prototype's multi-person `lineup` array is mock data with no schema backing; the real field is the single `event.host` string — render one entry (avatar initial `event.host.charAt(0)`) when set, omit the whole block otherwise. Do not fabricate a lineup.
- **Body right (aside):** venue card with `event.location` / `event.address` and the prototype's static map-preview placeholder (📍 over a grid pattern — no maps integration exists; do not add one), plus "Get directions →" → `https://maps.google.com/?q=${encodeURIComponent(event.address)}`. Below it, replace the prototype's three non-functional share buttons (Copy link / Instagram / Text — no handlers in the source) with the modal's real controls: an "Add to calendar" button calling `downloadIcs(event)` (`src/utils/ics.ts`), and, when `event.recurrence === "weekly"`, a "More dates in this series" block from `getUpcomingSeriesDates(event.start)` (`src/utils/series.ts`) rendering three dated rows each with a "Reserve" link, plus the "Repeats weekly" pill — matching `EventModal.tsx:218-238`.
- **Gallery** ("Photos from the floor"): only when `event.gallery?.length`; up to 5 images in the prototype's 4-column grid with the first spanning 2×2; a `+{N}` overflow tag on the last cell when `gallery.length > 5`. Omit the section entirely when absent.
- **Related** ("More this week in {cityLabel}"): up to 3 other upcoming city events as the prototype's compact horizontal rows (day/month block + title + time) linking to `/events/:id`. Build inline — this shape differs from `EventCard`; do not force reuse.
- **SEO:** `useDocumentMeta({ title: event.title, description: event.description?.slice(0, 155) ?? "Salsa, bachata, and Latin dance in Greater Boston & NYC.", canonical: \`https://salsasegura.com/events/${event.id}\` })` plus `injectStructuredData(generateEventStructuredData(event), "event-data")`. `generateEventStructuredData` (schema.org `DanceEvent`) and `updateCanonicalUrl` already exist in `src/utils/seo.ts` with **zero** current consumers — this page is their intended one. Write no new SEO code.

`src/pages/EventDetailPage.tsx` is a thin shell re-exporting the feature component (blueprint convention: `pages/` holds route shells).

**Re-home the modal's tests — do not just delete them.** `EventModal.test.tsx` holds 8 real behavioral contracts (paid price + "Get Tickets" href, free price + "RSVP · Free", RSVP hidden when `rsvpLink` missing, host row conditional, weekly-series block with exactly 3 "Reserve" links + "Repeats weekly", gallery strip with `+N` tile, dialog semantics, null-event no-render). Create `src/features/events/EventDetailPage.test.tsx` porting contracts 2–7 against the new page (the null-event and `role="dialog"` cases are modal-specific: replace them with a not-found-state test and a "renders the event title as an `<h1>`" test). Render through a `MemoryRouter` at `/events/1` with `useEvents` mocked (`vi.mock("../../hooks/useEvent")`) returning the fixture — reuse `EventModal.test.tsx`'s `baseEvent` fixture verbatim. Adjust the gallery assertion to the 5-cell cap (6 images → 5 rendered + `+1`).

Then delete `src/components/EventModal/` entirely (`EventModal.tsx`, `EventModal.css`, `EventModal.test.tsx`). `grep -rn "EventModal" src` must return zero.

Also remove `lucide-react` from `package.json` dependencies in this step. Verified this session: `EventModal.tsx` is its **only** importer in the whole tree, and the redesign uses the prototype's emoji glyphs (📅 🕐 💵 📍) rather than icon components, so nothing in Phase C reintroduces it. Deleting the component without the dependency would leave a dead package. Confirm with `grep -rn "lucide-react" src` → zero before removing; if some other file has picked it up since, keep the dependency and note it.

**C6 — Calendar: week view replacing Schedule-X.**

Rewrite as `src/features/calendar/CalendarPage.tsx` + `CalendarPage.css` (blueprint's target path), deleting `src/components/Calendar/`. Read the current `Calendar.tsx` in full first — it carries behavior the prototype does not model.

New implementation:
- State `calAnchor: number` (epoch ms, `Date.now()` initial).
- Monday-start week helper, ported exactly: `const x = new Date(d); x.setHours(0,0,0,0); const dow = (x.getDay()+6)%7; x.setDate(x.getDate()-dow); return x;`
- Header: range label — `"{Month} {startDay} – {endDay}, {year}"` same-month, else `"{startMon} {startDay} – {endMon} {endDay}, {year}"`; "Today" button (`calAnchor = Date.now()`); circular ‹ / › buttons (±7 days).
- 7-column grid, one card per day: day name + number (today → number `var(--red-bright)`, cell `background:rgba(225,29,72,0.06)`, `border-color:var(--red-dim)`); that day's events sorted by start, each a pill with `border-left:3px solid` `eventTypeStyle(...).accent`, click → `/events/${id}`; empty day → em-dash.
- Bucket by `dateKey(d) = d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate()` against `useEvents()` (city-scoped; no server-side week windowing).

**Preserve (verified present today, unmodelled by the prototype):**
- SEO — via `useDocumentMeta` (C2), same copy: title `"Dance Calendar - Salsa, Bachata & Latin Dance Events"`, description `"Find salsa, bachata, and Latin dance events across Greater Boston and NYC. Browse the community calendar of classes, socials, and workshops."`
- Structured data — `injectStructuredData(generateEventsListStructuredData(eventList), "events-list-data")`, keyed on the event list. It reflects the **full** list, never a visual filter (trivially true now).
- Loading and error states — keep `.calendar-status` / `.calendar-error` behavior including the "Retry" `window.location.reload()` button, restyled.
- The bottom "Know about an event that's missing? → Submit an Event" CTA. The header's "+ Add Event" pill does not replace an in-context CTA at the end of the calendar.
- Make the H1 city-aware, satisfying finding A8 in the new design's own voice: H1 `"The Calendar"` with the subtitle `"Salsa, bachata & social dance across {cityLabel}"` (the prototype's copy — it is already city-aware, so the hardcoded "Boston Dance Calendar" defect disappears).

**Remove (each superseded, not merely dropped):** the in-page city pills (`CITY_OPTIONS` — the header switch is the single city control); the view switcher (`VIEW_OPTIONS`/`activeView`) and type filter (`TYPE_OPTIONS`/`typeFilter`) — inapplicable to one week view (`filterEventsByType` itself stays; C4's feed now consumes it); the type legend (the per-pill accent + chips carry it); modal state, the ESC-key effect, the `?event=` one-shot auto-open, and the `EventModal` import; and all Schedule-X wiring (`useCalendarApp`, `createView*`, both plugins, `<ScheduleXCalendar>`, the `@schedule-x/theme-default` CSS import, and the Temporal `toZonedDateTime` marshalling effect — the grid reads `"YYYY-MM-DD HH:mm"` directly via `new Date(s.replace(" ", "T"))`).

This **supersedes blueprint Step 11**: `useEventDeepLink` and `useEscapeKey` are no longer needed (no modal, no `?event=` state), `CalendarLegend`/`CalendarStatus` collapse into the rewritten page, the stale-H1 fix (A8) lands via the new copy, and `useDocumentMeta` is salvaged as C2.

`src/pages/CalendarPage.tsx` becomes a shell that also preserves the legacy deep link, so previously shared `/calendar?event=<id>` URLs keep working:
```tsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CalendarPage from "../features/calendar/CalendarPage";

export default function CalendarRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const legacyEventId = params.get("event");
  useEffect(() => {
    if (legacyEventId) navigate(`/events/${legacyEventId}`, { replace: true });
  }, [legacyEventId, navigate]);
  if (legacyEventId) return null;
  return <CalendarPage />;
}
```

Remove the five `@schedule-x/*` entries from `package.json` dependencies (`calendar`, `calendar-controls`, `events-service`, `react`, `theme-default`) — verified this session that `Calendar.tsx` is their only consumer. `grep -rn "@schedule-x" src package.json` must return zero.

**C7 — Mobile App showcase (new route, independent of C4–C6).** Create `src/pages/MobileAppPage.tsx` + `MobileAppPage.css`. Static marketing page; the phone mockups carry no click handlers (neither does the prototype). Three CSS-drawn phone shells (rounded frame + notch, no device image): **Feed** = first 4 upcoming events as mini rows; **Detail** = the next upcoming event (title, date, time, description, first 3 gallery images, `imageUrl` hero with gradient fallback); **Agenda** = next 6 upcoming events grouped by `toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })`. Page chrome is static copy: eyebrow "◆ Native app concept", H1 "Salsa Segura in your pocket", subtitle. With zero upcoming events for the city, render the frames with a "No events yet" line inside each — never crash on undefined.

**C8 — Submit page restyle (independent of C4–C7).** Restyle `src/pages/SubmitEventPage.tsx` + `SubmitEventPage.css` into the prototype's visual language: inputs `background:var(--surface-high)`, `border:1px solid var(--border-md)`, `border-radius:11px`; uppercase letter-spaced labels; rose-gradient submit button; success state with 🎉 and "On the calendar!" copy plus an "Add another" reset. **Keep every existing field.** The prototype mocks only six (title/type/date/venue/time/description); the real form's `price_type`, `price_amount`, `rsvp_link`, `submitter_name`, `submitter_email` feed the moderation workflow documented in `Docs/ADMIN_MODERATION_GUIDE.md`. Retain the four fieldsets (Event Details / Location / Pricing & Link / Your Info) under the new styling. `handleSubmit` / `validateForm` / state logic are unchanged in this step (Phase D refactors them).

**C9 — Routing.** In `src/App.tsx`, inside the `MainLayout` route add `<Route path="events/:id" element={<EventDetailPage />} />` and `<Route path="mobile-app" element={<MobileAppPage />} />`, both `lazy`-imported like the existing pages. No other route changes — `/`, `/about`, `/contact`, `/calendar`, `/submit`, `/lessons`, `/instructors`, `/schools`, `*` all stay.

### Phase D — Remaining blueprint steps, amended

**D1 — Submit validation extraction (blueprint Step 9, unchanged in substance).** `src/features/submit-event/validation.ts` + `validation.test.ts`: export pure `validateSubmitForm(form): string | null`, the `SubmitForm` interface, and `buildInitialForm`. Add max-length caps (title 120, description 2000, others 300) as cheap spam friction (V5). Tests: paid-without-amount, negative amount, malformed URL, non-http protocol, over-length title, valid → `null`. Operates on C8's restyled page — the markup differs from the blueprint's snapshot, the logic does not.

**D2 — Decompose SubmitEventPage (blueprint Step 10, amended).** Move to `src/features/submit-event/SubmitEventPage.tsx` with `useSubmitEventForm.ts` (state, `update`, `handleSubmit` → validate → `eventsRepo.submitEvent`) and one component per fieldset + `SuccessCard` under `components/`. `src/pages/SubmitEventPage.tsx` becomes a thin shell. **Amendment:** preserve every id, label, placeholder, and class name from **C8's restyled markup** (the blueprint's "byte-for-byte" instruction refers to the pre-redesign markup, which no longer exists). Each file ≤ 150 lines.

**D3 — Hosting hardening (blueprint Step 12, amended).** Delete the no-op `/calendar` → `/calendar` route (verified still present); keep `navigationFallback`. Add `globalHeaders`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` disabling camera/microphone/geolocation, and a **Report-Only** CSP — `default-src 'self'`; `connect-src` allowing the Supabase project URL and `https://api.web3forms.com`; `img-src 'self' data: https:`; `style-src 'self' 'unsafe-inline'`; the Google Fonts hosts from `index.html`. **Amendment:** also allow `https://cloud.umami.is` in `script-src` (the analytics tag in `index.html:7-11`, which the blueprint's CSP list omits) and `https://img.buymeacoffee.com` in `img-src` (already covered by `https:`). Do not enforce the CSP in this step.

**D4 — CSS ownership cleanup (blueprint Step 13, amended).** Relocate `.contact-form*`, `.dance-styles`, `.styles-grid`, `.contact-info` from `global.css` into the CSS file of the component that renders them (grep each class for its owner); cut/paste with zero property changes; update the mobile media query accordingly. **Amendment:** the event-type tokens and the `marquee` keyframe added in C1 are global by design (tokens + shared primitives) and stay in `global.css`. Scope the audit to `global.css` as it stands after Phase C.

**D5 — Dependency pass (blueprint Step 14, amended).** The "align all `@schedule-x/*` to one minor" instruction is **void** — C6 removed the suite. Remaining: bump `@supabase/supabase-js` within 2.x; then, in an isolated commit, attempt `temporal-polyfill` → 1.x after reading its changelog. **Amendment:** the blast radius is now `src/features/events/model/convert.ts` only (`Calendar.tsx`'s Temporal usage is gone, `series.ts` uses `Temporal.PlainDateTime`) — check `series.ts` too. Revert the temporal bump alone if any API mismatch surfaces, and record the blocker in `Docs/TODO.md`. Validate build + lint + tests after each package family.

**D6 — Final regression (blueprint Step 15, verification only).** Full gate: `npm run lint`, `npx vitest run`, `npm run build`, `npm run preview` + manual click-through of every route including the two new ones and the legacy `?event=` redirect. Doc updates move to Phase E.

### Phase E — Doc sync after the code phases land

The factual corrections and cross-references (the parts true regardless of implementation) are applied when this plan is first saved. Phase E covers only the updates that become true **once Phases A–D actually ship** — writing them earlier would restate the false-claim problem this plan exists to fix.

**E1 — Flip the roadmap rows in `Docs/ROADMAP.md`.** After Phase C ships: **W11** Enhanced event pages `/events/[id]` 🔄 Partial → ✅ Done (C5 ships the real route, replacing the modal deep-link); **W21** Photo gallery 🔄 Partial (DB columns only) → ✅ Done (C5's gallery section is the missing UI); **W49** Event homepage redesign 📅 Planned → ✅ Done (C4). **W31** Mobile app (PWA) stays 📅 Planned — C7 is a concept showcase, not a PWA. Move the redesign into the Completed list.

**E2 — `Docs/STATUS_SUMMARY.md` "What's Built".** After Phase C ships, add the redesign section (new Home, `/events/:id`, week-view Calendar, `/mobile-app`, restyled Submit) and record the Schedule-X removal in the Tech Stack table — its "Calendar: Schedule-X 4 (month/week/day/agenda)" row becomes inaccurate the moment C6 lands.

**E3 — `Docs/DASHBOARD.md` Completed list.** Add the redesign and the modernization phases as they land, one line each.

**E4 — Blueprint step closure in `Docs/plans/MODERNIZATION_BLUEPRINT.md`.** As each phase lands, mark the corresponding blueprint steps done in the findings table: A1 closes V2; B2 closes V4; B4 closes V7; B5 + Phase C close A2; C1 closes A7; C6 closes A8; D1/D2 close A1; D3 closes V8; D4 closes A6; D1's length caps partially close V5. V6 (no ErrorBoundary) and V9 (coverage) remain open — neither this plan nor the blueprint addresses V6, so leave it listed as an open finding rather than silently dropping it.

**E5 — `Docs/TODO.md`.** Append any dependency blocker recorded during D5 (e.g. a reverted `temporal-polyfill` 1.x bump). Its existing item ("Make the Contact page fit all in a single view") is unrelated — leave it.

## Critical files & anchors

- `Docs/plans/MODERNIZATION_BLUEPRINT.md` — Phase 3 step list; the source of truth this plan amends. Read before task S2 and before Phase B; its findings table (V1–V9, A1–A9) is what S2 annotates and E4 later closes out.
- `src/types/events.ts` — `databaseEventToScheduleX` (line 70) + `formatDateTimeForScheduleX` (102-110) is the V4 defect; `CALENDARS_CONFIG` (51-67) is deleted in C1. B1 turns this file into a re-export shim.
- `src/components/Calendar/Calendar.tsx` — read in full before C6. Verified contents: SEO effects 114-120, structured data 137-138, `?event=` auto-open 140-149, ESC handler 152-159, city/view/type pill groups 188-229, legend 230-243, loading/error 247-258, submit CTA 265-271. C6 enumerates which survive.
- `src/components/EventModal/EventModal.tsx` + `EventModal.test.tsx` — the functional contract (price/free, conditional RSVP, host, weekly series, gallery overflow) that C5 must carry into `EventDetailPage` and its ported test file. Read both fully before writing C5.
- `Comprehensive redesign scope/Salsa Segura - Redesign.dc.html` — canonical markup and logic for every redesigned view; the `<script type="text/x-dc">` class at the end holds the exact date/label/colour derivations Phase C ports.

## Verification

These are the gates for the code phases, which are **not** part of the documentation-only pass described at the top of this file. That pass has its own verification line under task S6. Each gate below must pass before the next phase starts:

- **A:** `glob bun.lock` empty; `npm ci && npm run build` exit 0.
- **B:** `npx vitest run src/features/events/model/convert.test.ts` green — including the explicit assertion that a known summer instant renders its Eastern wall-clock time **regardless of the machine timezone**; run it twice, once with `TZ=America/Los_Angeles npx vitest run`, and confirm identical results. That is the direct proof V4 is dead. Then `grep -rn 'from("events")' src/` → exactly 1 file, and in `npm run dev` confirm via devtools Network that navigating Home → Calendar issues the events request **once**.
- **C:** `npm run build` (zero TS errors) and `npx vitest run` green with the ported `EventDetailPage.test.tsx` (6 carried contracts + not-found + `<h1>` title). Then in `npm run dev`, against a city with upcoming events:
  - `/` — hero stats populate (not `—`, not `0`), ticker scrolls, Featured shows the soonest event, each filter chip narrows the grid, and both a feed card and the Featured card land on `/events/<id>` with matching data.
  - `/events/<id>` — "Add to calendar" downloads a `.ics`; a `recurrence: "weekly"` event shows exactly 3 series dates; a 6-image `gallery` shows 5 cells with a `+1` tag; `/events/nope` shows the not-found panel; `document.querySelector('#event-data')` contains a `DanceEvent` payload with that event's title.
  - `/calendar` — ‹ / › / Today move the week, including across a month boundary (two-month range label renders); an event pill opens its detail page; `/calendar?event=<id>` redirects to `/events/<id>`.
  - `/mobile-app` — all three phones show real data; switch to a city with no upcoming events and confirm the "No events yet" path, not a crash.
  - `/submit` — submit a paid event with an RSVP link; confirm a `pending` row lands in Supabase with `price_amount` and `rsvp_link` populated (proves C8 dropped no fields), then delete it.
  - Every non-redesigned route (`/about`, `/lessons`, `/instructors`, `/contact`, `/schools`) renders with the new pill nav and correct active highlight; hamburger opens/closes below 990px.
  - `grep -rn "@schedule-x\|EventModal\|CALENDARS_CONFIG\|lucide-react" src package.json` → zero hits.
- **D:** `npx vitest run src/features/submit-event/validation.test.ts` green; `curl -I` on the deployed SWA URL shows the new headers; a full manual click-through logs **zero** CSP report violations in the console before anyone considers enforcing it; visual diff of Home + Contact at 1280 px and 375 px before/after D4 is pixel-identical.
- **E:** `grep -rn "@google/design.md\|38 passing\|11 files\|unrouted\|AuthContext" Docs/` returns nothing; every step marked done in `MODERNIZATION_BLUEPRINT.md` matches a real artifact in the tree.

## Assumptions & contingencies

- **Blueprint before redesign.** Phases A–B run first because the redesign would otherwise ship ~6 uncached fetches per page view and spread the live V4 timezone bug into the week grid's day bucketing. If visible redesign progress is needed sooner, the fallback is: run C3 (Header/Footer) and C8 (Submit restyle) immediately — neither reads event data — then complete A–B, then C4–C7. Do **not** ship C4/C5/C6/C7 before B2 and B5.
- **Calendar loses month/agenda/list views, the type filter, the in-page city switch, and the legend**, replaced by the prototype's week strip. This is a genuine functionality reduction, and it is what the design specifies. Contingency if unwanted: skip C6 entirely (keep `Calendar.tsx`, `CALENDARS_CONFIG`, and the five `@schedule-x/*` deps), change only the Schedule-X `onEventClick` callback to `navigate('/events/' + id)`, still delete the modal per C5, and keep blueprint Step 11 alive in E1 instead of marking it superseded. Every other step is unaffected.
- **Event-type colours live in `global.css` as tokens**, with `eventTypeStyle()` returning `var(--…)` strings. Copying the prototype's hexes into TypeScript would recreate finding A7 (two sources of truth for brand colour) under a new name.
- **Submit keeps all real fields** despite the prototype mocking six. Trimming the form is a moderation-workflow/schema decision, not a styling one — raise it separately.
- **Buy Me a Coffee stays** in the footer; the prototype omits it because the design tool never modelled that revenue link.
- **Lineup uses `event.host`** (single string, the only backing field) rather than the prototype's fictional multi-person array.
- **`?event=` redirect is kept** as cheap insurance for previously shared links; drop it only if it is known that none exist.
- **Nav reconciliation:** the redesign's 4-item nav is treated as a restyle, not a deletion of About/Lessons/Instructors/Contact — those pills stay, "Mobile App" is added, Submit becomes the "+ Add Event" CTA, and the redundant `/#events` link goes. If the intent really was to cut those pages from the nav, delete those four `NavLink`s in C3; the routes stay reachable regardless.
- **Header density:** 7 pills + city switch + CTA is wider than today's 7 text links. The existing 990 px hamburger breakpoint already collapses the list; if pills overflow between ~990 px and ~1200 px, raise the breakpoint rather than shrinking pill padding below the prototype's `9px 15px`.
- **`STATUS_SUMMARY.md`'s "local dev broken / `lucide-react` missing" risk is stale** — it predates the `@google/design.md` removal that caused it. Re-run `npm ci` before editing that section in task S4; if it installs cleanly, delete the risk rather than carrying it forward. (The dependency itself is removed in C5, since `EventModal.tsx` is its only importer.)

# Ritmo Vivo Redesign — Home + Submit + Calendar (on a `features/` foundation)

**Date:** 2026-07-23
**Status:** Approved design, ready for implementation plan
**Source design:** Claude Design project `5e670f28-848c-4fd2-8419-3f91a3693aa8` → `Salsa Segura - Redesign.dc.html`
**Related:** `Docs/plans/MODERNIZATION_BLUEPRINT.md` (steps 4–10 are folded in here, scoped)

## 1. Goal & Scope

Bring the "Salsa Segura – Redesign" concept into the real React + Supabase app for **three screens — Home, Submit, and Calendar (restyle)** — and land the new code on the modernization blueprint's `features/` architecture (repository pattern + TanStack Query + pure/tested domain logic), scoped to the events and submit-event features only.

### In scope
- New **Home** screen: hero + stat row, marquee ticker, "Featured Tonight" card, filterable event feed.
- **Submit** restyle: mockup's visual language, **all existing fields kept**, validation + submit extracted to pure/repo modules.
- **Calendar** restyle: re-skin page chrome + theme `@schedule-x` to the redesign palette. **Keep the schedule-x engine and the modal.**
- **EventModal** restyle to the new palette (it is the click target from Home + Calendar).
- **Data layer**: `features/events/` (model split, Temporal timezone fix + tests, repository, TanStack Query) and `features/submit-event/` (validation + form decomposition).
- Extend `src/styles/global.css` `:root` with the redesign's additional tokens.

### Explicitly out of scope (deferred)
- Full-page event **detail route** (redesign shows one; we keep the modal).
- Custom **week-grid calendar engine** (redesign replaces schedule-x; we keep schedule-x).
- The **gallery UI** ("Photos from the floor") — deferred with the detail page. DB columns already exist.
- The **phone-mockup marketing page** (`mobile` view is concept-only).
- Blueprint **steps 11–15** (further Calendar decomposition, hosting headers, CSS ownership, dependency bumps, docs sync) — separate track.

### Decisions locked
- **Submit fields:** keep the full current set (`title, description, event_type, city, event_date, event_time, location, address, price_type, price_amount, rsvp_link, submitter_name, submitter_email`); restyle only. Rationale: `city` decides which calendar an event appears on; address/price/rsvp/submitter feed the calendar, modal, and moderation.
- **Home event interaction:** cards + featured card navigate to `/calendar?event=<id>`, opening the restyled modal (consistent with keeping the modal). No new route.
- **Contact section:** keep the existing `<Contact />` on the Home page (live Web3Forms feature the mockup omits).
- **Migration breadth:** events + submit-event features only. `useEvents()` keeps its `{ events, loading, error }` contract so no consumer changes.

## 2. Design tokens (foundation)

Extend `src/styles/global.css` `:root` — **add, never rename** — with the tokens the mockup relies on and the current file lacks:

```
--surface, --surface-high,
--red-bright, --red-dim,
--gold-light,
--text-muted, --text-dim,
--border, --border-md,
--fdisp (Epilogue), --fbody (Be Vietnam Pro), --flogo (Great Vibes)
```

Values come verbatim from the mockup's inline `:root`. Existing tokens (`--bg`, `--red`, `--gold`, `--tertiary`, spacing scale) are reused as-is. No existing class name changes anywhere (visual-regression rule from the blueprint).

## 3. Data layer — `features/events/` (blueprint steps 4–8, scoped)

**Approach:** move-and-rewire, not rewrite. Preserve behavior; only `convert.ts` changes logic (the timezone fix).

- `src/features/events/model/types.ts` — `DatabaseEvent`, `ScheduleXEvent`, `EventType`, `City` (moved from `src/types/events.ts`).
- `src/features/events/model/calendarsConfig.ts` — `CALENDARS_CONFIG` (moved).
- `src/features/events/model/convert.ts` — `databaseEventToScheduleX`, reimplemented with Temporal:
  - Determine whether `events.event_date` is `timestamp` vs `timestamptz` (check `Docs/sql queries/events.sql`); record the finding in a top-of-file comment.
  - `timestamptz` → `Temporal.Instant` → `.toZonedDateTimeISO('America/New_York')`; naive `timestamp` → `Temporal.PlainDateTime`.
  - Output stays `"YYYY-MM-DD HH:mm"`. `const DEFAULT_DURATION_HOURS = 4` replaces the "2 hours" comment. `new Date(` must not appear in the file.
- `src/features/events/model/convert.test.ts` — summer/EDT, winter/EST, `end = start + 4h`, DST fall-back monotonicity (`start < end`), null optionals → `undefined`. Fixed literal timestamps only.
- `src/types/events.ts` — becomes pure re-exports of the three model modules (zero import-site edits elsewhere).
- `src/features/events/api/eventsRepo.ts` — the **only** module importing `supabase` for event data:
  - `fetchApprovedEvents(city: City): Promise<DatabaseEvent[]>` with `.gte('event_date', <today − 1 day, ISO>)` server-side floor.
  - `submitEvent(payload: NewEventSubmission): Promise<void>` (insert with `status: "pending"`); `NewEventSubmission` type defined here.
- `@tanstack/react-query` (v5, no devtools) added.
- `src/app/providers.tsx` — `StrictMode` → `QueryClientProvider` (`staleTime` 5 min, `retry: 1`) → `CityProvider`. `main.tsx` reduces to `<Providers><App/></Providers>`.
- `src/features/events/hooks/useEventsQuery.ts` — key `['events', city]`, fetches via `eventsRepo`, maps through `convert.ts`.
- `src/hooks/useEvent.ts` — rewired to `useEventsQuery`, same public shape (`isPending`→`loading`, error→message string).
- `src/hooks/useSupabaseEvents.ts` — deleted (superseded).

Outcome: single fetch shared between Home and Calendar; `from("events")` appears only in `eventsRepo.ts`.

## 4. Home — `src/features/home/`

Replace `Hero` + `Events` inside `HomePage` (keep `<Contact />` after the feed). All data from `useEvents()` for the active city; "upcoming" = `endDate >= now`, sorted ascending.

Components (each its own file + scoped CSS, following component-scoped-CSS convention):
- `HomeHero` — eyebrow (`{cityLabel} · Live Dance Guide`), headline, two CTAs (smooth-scroll to feed; `/calendar`), stat row: upcoming count, distinct-venue count, city badge.
- `HomeTicker` — marquee (CSS `rv-marquee`) of upcoming titles doubled for seamless loop, colored by type via `calendarsConfig`.
- `FeaturedEvent` — next upcoming event as a large card: date badge, type chip, title/time/location, truncated description, image from `imageUrl` with gradient fallback. Click/Enter → `/calendar?event=<id>`.
- `EventFeed` — `filterEventsByType`-driven chips (All/Socials/Classes/Workshops) + responsive grid (`minmax(288px,1fr)`); cards with gradient-by-type thumb, date block, type chip; empty state per active filter. Click target `/calendar?event=<id>`.

Loading/error states preserve today's behavior (skeleton grid, retry).

## 5. Calendar restyle — `src/components/Calendar/`

Keep `Calendar.tsx` structure and `@schedule-x`. Changes:
- `Calendar.css` re-skinned to Ritmo Vivo (chips, gold range/label, `--surface`/`--border` chrome, red-dim "today" accent) matching the mockup's calendar screen.
- Theme schedule-x event colors to the redesign palette by aligning `CALENDARS_CONFIG` dark colors and any `--sx-*` CSS variables; no logic change.
- Minor `Calendar.tsx` tweaks only if needed for class hooks. Modal, deep-link, ESC, structured data unchanged.

## 6. Submit restyle — `src/features/submit-event/`

Adopt the mockup's visual language; **keep all fields**. Blueprint steps 9–10 folded in:
- `validation.ts` — `validateSubmitForm(form): string | null`, `SubmitForm` interface, `buildInitialForm`; add spam-friction max-lengths (title 120, description 2000, other text 300).
- `validation.test.ts` — paid-without-amount, negative amount, malformed URL, non-http protocol, over-length title, valid → `null`.
- `useSubmitEventForm.ts` — form state, `update`, `handleSubmit` (validate → `eventsRepo.submitEvent` → submitted flag), `isSubmitting/isSubmitted/error`.
- `components/` — one component per existing fieldset (Event Details, Location, Pricing & Link, Your Info) + `SuccessCard`, each `{ form, update }`. Preserve every `id`/`label`/`placeholder`; apply new styles.
- `src/pages/SubmitEventPage.tsx` — thin shell (<100 lines) that keeps the `SubmitEventPage.css` import and composes the above.

## 7. EventModal restyle — `src/components/EventModal/`

Re-skin `EventModal.css` to the new palette. Behavior (focus trap, ICS export, series dates, ESC) unchanged.

## 8. Testing & validation gates

- `npx vitest run src/features/events/model/convert.test.ts` green (timezone contract).
- `npx vitest run src/features/submit-event/validation.test.ts` green.
- `npm run build` (tsc + Vite) exits 0 after each step; `npx vitest run` green.
- Manual smoke: Home shows real upcoming events + filters; a Home card opens the restyled modal on `/calendar`; Home→Calendar fires the events request once; city toggle triggers one new request per switch; Submit still writes a `pending` row with all fields; Calendar renders themed events.

## 9. Build sequence (high level; detailed plan follows)

1. Tokens in `global.css`.
2. `features/events/model/*` split + `types.ts` shim (step 4).
3. `convert.ts` Temporal rewrite + `convert.test.ts` (steps 5–6).
4. `eventsRepo.ts` + rewire submit/fetch (step 7).
5. TanStack Query: providers, `useEventsQuery`, `useEvent` rewire, delete `useSupabaseEvents` (step 8).
6. Home feature (hero, ticker, featured, feed) + wire into `HomePage`.
7. EventModal restyle.
8. Calendar restyle + schedule-x theming.
9. Submit: validation + tests, form hook, fieldset components, page shell (steps 9–10).
10. Full regression (build + tests + manual smoke).

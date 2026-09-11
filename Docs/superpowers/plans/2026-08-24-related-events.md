# Related Events Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reference-style related-events strip to each public event detail page without schema changes.

**Architecture:** Keep selection pure in `src/features/events/model/relatedEvents.ts`; it consumes existing approved city events and produces a capped, deterministic selection plus strict-window metadata. `EventDetailPage` runs one enabled, city-scoped TanStack query before its loading guard, while `RelatedEventsStrip` owns accessible links and compact date-card rendering. Later event-detail shell work can relocate the strip without changing selection logic.

**Tech Stack:** React 19, TypeScript strict mode, React Router v7, TanStack Query v5, Vitest, Testing Library, existing CSS custom properties.

## Global Constraints

- Use only existing `events` fields and `fetchApprovedEvents(city)`; no migration, RLS, Storage, or new backend API.
- Candidates must be `approved`, same-city, later than displayed event, validly dated, and never the displayed event.
- Strict window: seven calendar days after displayed event. Backfill chronological same-city future candidates; cap output at three.
- No related candidates means no section; related-query loading/error must not replace event-detail content.
- Cards link to `/events/:id`; no EventModal dependency, fake lineup, host-profile, RSVP, or album UI.
- Reuse public semantic tokens and current display/body fonts. No hardcoded colors.
- Preserve existing event-detail behavior, title/hero accessibility, calendar download, maps, taxonomy, gallery, contact, and Google Calendar links.

---

### Task 1: Select related approved events

**Files:**
- Create: `src/features/events/model/relatedEvents.ts`
- Test: `src/features/events/model/relatedEvents.test.ts`

**Interfaces:**
- Consumes: `DatabaseEvent` and `City` from `src/features/events/model/types.ts`.
- Produces:

```ts
export interface RelatedEventsSelection {
  events: DatabaseEvent[];
  hasStrictWindowEvents: boolean;
}

export function selectRelatedEvents(
  current: Pick<DatabaseEvent, "id" | "city" | "event_date">,
  candidates: readonly DatabaseEvent[]
): RelatedEventsSelection;
```

- [ ] **Step 1: Write failing selection tests**

```ts
it("selects up to three later same-city events inside seven days", () => {
  const selection = selectRelatedEvents(current, [current, sameDay, withinWeek, beyondWeek, otherCity]);

  expect(selection.events.map((event) => event.id)).toEqual([sameDay.id, withinWeek.id]);
  expect(selection.hasStrictWindowEvents).toBe(true);
});

it("backfills chronological later events after strict-window results", () => {
  const selection = selectRelatedEvents(current, [strict, lateThird, lateSecond, invalidDate, cancelled]);

  expect(selection.events.map((event) => event.id)).toEqual([strict.id, lateSecond.id, lateThird.id]);
  expect(selection.hasStrictWindowEvents).toBe(true);
});

it("returns empty selection when no other approved future same-city event exists", () => {
  expect(selectRelatedEvents(current, [current, past, otherCity, cancelled]).events).toEqual([]);
});
```

Use one complete `DatabaseEvent` fixture factory. Give valid events UTC ISO `event_date` values and make each test override only `id`, `city`, `status`, and `event_date`.

- [ ] **Step 2: Run selection tests to verify RED**

Run:

```bash
npm test -- src/features/events/model/relatedEvents.test.ts --run
```

Expected: FAIL because `relatedEvents.ts` does not exist.

- [ ] **Step 3: Implement deterministic selection**

```ts
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function eventTime(value: string): number | null {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function selectRelatedEvents(current, candidates) {
  const currentTime = eventTime(current.event_date);
  if (currentTime === null) return { events: [], hasStrictWindowEvents: false };

  const future = candidates
    .filter((event) => {
      const time = eventTime(event.event_date);
      return event.id !== current.id && event.status === "approved" && event.city === current.city && time !== null && time > currentTime;
    })
    .sort((left, right) => Date.parse(left.event_date) - Date.parse(right.event_date));

  const strict = future.filter((event) => Date.parse(event.event_date) <= currentTime + SEVEN_DAYS_MS);
  const strictIds = new Set(strict.map((event) => event.id));
  const backfill = future.filter((event) => !strictIds.has(event.id));

  return {
    events: [...strict, ...backfill].slice(0, 3),
    hasStrictWindowEvents: strict.length > 0,
  };
}
```

Keep `Set` only for runtime membership deduplication. Do not alter `eventsRepo`.

- [ ] **Step 4: Run selection tests to verify GREEN**

Run:

```bash
npm test -- src/features/events/model/relatedEvents.test.ts --run
```

Expected: PASS; strict-window, backfill, invalid/past/current/city/status exclusions all verified.

- [ ] **Step 5: Commit**

```bash
git add src/features/events/model/relatedEvents.ts src/features/events/model/relatedEvents.test.ts
git commit -m "feat: select related approved events"
```

### Task 2: Render compact related-event links

**Files:**
- Create: `src/components/Events/RelatedEventsStrip.tsx`
- Create: `src/components/Events/RelatedEventsStrip.css`
- Test: `src/components/Events/RelatedEventsStrip.test.tsx`

**Interfaces:**
- Consumes: `DatabaseEvent[]`, `City`, and `hasStrictWindowEvents: boolean`.
- Produces: a section with zero output for `events.length === 0`, otherwise a heading and direct event-detail links.

```ts
interface RelatedEventsStripProps {
  events: readonly DatabaseEvent[];
  city: City;
  hasStrictWindowEvents: boolean;
}
```

- [ ] **Step 1: Write failing presentation tests**

```tsx
it("renders up to three compact direct links with strict-window heading", () => {
  render(<RelatedEventsStrip events={[first, second, third]} city="boston" hasStrictWindowEvents />);

  expect(screen.getByRole("heading", { name: "More this week in Greater Boston" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /first event/i })).toHaveAttribute("href", `/events/${first.id}`);
  expect(screen.getAllByRole("link")).toHaveLength(3);
});

it("uses fallback heading and renders nothing when selection is empty", () => {
  const { rerender } = render(<RelatedEventsStrip events={[fallback]} city="new-york-city" hasStrictWindowEvents={false} />);
  expect(screen.getByRole("heading", { name: "More in New York City" })).toBeInTheDocument();

  rerender(<RelatedEventsStrip events={[]} city="boston" hasStrictWindowEvents={false} />);
  expect(screen.queryByRole("region", { name: /more/i })).not.toBeInTheDocument();
});
```

Wrap component in `MemoryRouter`.

- [ ] **Step 2: Run presentation tests to verify RED**

Run:

```bash
npm test -- src/components/Events/RelatedEventsStrip.test.tsx --run
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement semantic compact cards**

- Add `RelatedEventsStrip` with `section aria-labelledby`.
- Use a local public label map: `boston: "Greater Boston"`, `new-york-city: "New York City"`.
- Format weekday/day/month and start time with `Intl.DateTimeFormat`; use `event.event_date` as source of truth.
- Every card is one `<Link to={`/events/${event.id}`}>`; no nested interactive control.
- Add one event-type modifier (`--social`, `--class`, `--workshop`) to the date badge. Use existing public semantic variables (`--red`, `--gold`, `--surface-high`, `--border`, `--text`, `--text-muted`).
- Desktop: `repeat(3, minmax(0, 1fr))` grid. Mobile: horizontally scrollable snap row with a non-shrinking compact card; preserve 44px minimum link target.

- [ ] **Step 4: Run component tests to verify GREEN**

Run:

```bash
npm test -- src/components/Events/RelatedEventsStrip.test.tsx --run
```

Expected: PASS for headings, empty behavior, direct links, and three-card cap.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/RelatedEventsStrip.tsx src/components/Events/RelatedEventsStrip.css src/components/Events/RelatedEventsStrip.test.tsx
git commit -m "feat: add related events strip"
```

### Task 3: Query and integrate related events

**Files:**
- Modify: `src/pages/EventDetailPage.tsx:1-256`
- Modify: `src/pages/EventDetailPage.test.tsx`

**Interfaces:**
- Consumes: `fetchApprovedEvents(city)`, `selectRelatedEvents`, `RelatedEventsStrip`.
- Produces: related events placed after existing detail body only when candidate query succeeds and selection is non-empty.

- [ ] **Step 1: Extend event-detail test with a city query mock**

Update the existing `eventsRepo` mock to include `fetchApprovedEvents`. Add tests for:

```tsx
it("renders selected same-city related event links after event detail content", async () => {
  vi.mocked(fetchApprovedEvents).mockResolvedValue([event, withinWeek, fallback]);
  renderPage();

  expect(await screen.findByRole("heading", { name: "More this week in Greater Boston" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /within week/i })).toHaveAttribute("href", `/events/${withinWeek.id}`);
});

it("omits related-events strip when city query fails or selects no events", async () => {
  vi.mocked(fetchApprovedEvents).mockRejectedValue(new Error("offline"));
  renderPage();

  await screen.findByRole("heading", { name: "Havana Nights" });
  expect(screen.queryByRole("region", { name: /more/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run event-detail test to verify RED**

Run:

```bash
npm test -- src/pages/EventDetailPage.test.tsx --run
```

Expected: FAIL because no related-events query/strip exists.

- [ ] **Step 3: Add enabled city query before early returns**

```tsx
const relatedEventsQuery = useQuery({
  queryKey: ["events", "approved", event?.city],
  queryFn: () => fetchApprovedEvents(event!.city),
  enabled: Boolean(event?.city),
});
```

After `if (!event) return <NotFoundPage />;`, derive:

```tsx
const relatedSelection = relatedEventsQuery.data
  ? selectRelatedEvents(event, relatedEventsQuery.data)
  : { events: [], hasStrictWindowEvents: false };
```

Append `RelatedEventsStrip` after existing `.event-page__body` content. Do not render loading/error treatment for this auxiliary query.

- [ ] **Step 4: Run event-detail test to verify GREEN**

Run:

```bash
npm test -- src/pages/EventDetailPage.test.tsx --run
```

Expected: PASS; main event still renders if related query errors, and related links use stable public URLs.

- [ ] **Step 5: Browser verification**

Use temporary Vite harness importing actual `EventDetailPage` CSS/components and fixture events. At 390px and 1440px, assert:

```js
{
  cardCount: document.querySelectorAll('.related-events-strip__card').length,
  mobileScroll: getComputedStyle(document.querySelector('.related-events-strip__cards')).overflowX,
  desktopColumns: getComputedStyle(document.querySelector('.related-events-strip__cards')).gridTemplateColumns
}
```

Expected: max three cards; mobile scrolls without clipping fixed navigation; desktop uses three cards in one row. Delete all harness files afterward.

- [ ] **Step 6: Commit**

```bash
git add src/pages/EventDetailPage.tsx src/pages/EventDetailPage.test.tsx
git commit -m "feat: show related events on event detail"
```

## Plan self-review

- Spec coverage: Tasks 1–3 implement strict seven-day selection, chronological fallback, same-city filter, three-card cap, direct links, heading change, zero/error omission, responsive cards, and no-schema boundary.
- Placeholder scan: no `TODO`, `TBD`, or undefined interface name remains.
- Type consistency: helper returns `RelatedEventsSelection`; component consumes its `events` and `hasStrictWindowEvents`; event page owns query and passes city.

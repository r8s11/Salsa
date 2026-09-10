# Event Browsing and Host Dashboard Handoff Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the handoff’s event and Host visual hierarchy to truthful existing data: a refined shared event modal plus an owner-scoped Host dashboard and My Events view for the existing `organizer` role.

**Architecture:** `AdminOverviewPage` becomes a role router: platform administration stays in an extracted Admin view, while the existing `organizer` role renders a Host view that consumes only `useMySubmissions(user.id)`. A small host-event model derives display rows and actions from `DatabaseEvent`; `/admin/host/events` renders those rows in Cards/Table views. The shared `EventModal` remains the only event detail overlay and is restructured around the handoff’s quick-look hierarchy without a false public-detail route.

**Tech Stack:** React 19, TypeScript strict mode, React Router v7 classic routes, TanStack Query v5, Supabase/RLS through existing repositories, Vitest, React Testing Library, Lucide React, Ritmo Vivo CSS tokens.

## Global Constraints

- **Host is the existing `organizer` role.** Do not add a role, table, JWT claim, or authorization rule.
- **Admin is the website-administrator role.** Preserve platform-wide Admin behavior, labels, and permissions.
- Host queries must use only the signed-in owner’s existing `useMySubmissions(user.id)` data; never reuse `useAdminEvents()` in Host UI.
- Preserve pending/rejected-only owner editing. Approved events use the existing Calendar deep link.
- Keep the current `EventModal` focus trap, backdrop close, Escape behavior, map, RSVP, calendar, contact, recurrence, and gallery integrations.
- Do not create `/events/:id`, `/events/:slug`, `/host/*`, `DashboardShell`, demo constants, registrations, capacity, attendee, task, DJ, lineup, or analytics features.
- Use stored facts only. Do not display teacher, level, class length, capacity, registered counts, or door status because current event data does not provide them.
- Use semantic Ritmo Vivo tokens and Lucide icons; no handoff `--ss-*` tokens or emoji controls.
- At 640px, Host event table rows become labelled cards with every displayed field readable.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/features/host/model/hostEvents.ts` | Pure owner-event sorting, status/action derivation, and next-event selection. |
| `src/features/host/model/hostEvents.test.ts` | Tests status precedence, terminal-event exclusion, and action URLs. |
| `src/components/Host/HostDashboard.tsx` | Existing-organizer-role Host overview using only owner events. |
| `src/components/Host/HostDashboard.css` | Next-event card and owner-metric layout using admin/Ritmo Vivo tokens. |
| `src/pages/AdminOverviewPage.tsx` | Role router: Host view versus existing platform-admin/moderator view. |
| `src/pages/HostMyEventsPage.tsx` | `/admin/host/events`, Cards/Table toggle, owner states and actions. |
| `src/pages/HostMyEventsPage.css` | Host list/table and mobile labelled-card styles. |
| `src/App.tsx` | Adds the protected Host My Events child route. |
| `src/components/Admin/AdminSidebar.tsx` | Labels organizer navigation as Host and exposes Host My Events. |
| `src/components/EventModal/EventModal.tsx` | Reorders existing facts into the handoff’s quick-look header. |
| `src/components/EventModal/EventModal.css` | Adds date block/quick-fact layout while preserving the current responsive modal. |

### Task 1: Create truthful Host event derivations

**Files:**
- Create: `src/features/host/model/hostEvents.ts`
- Create: `src/features/host/model/hostEvents.test.ts`

**Interfaces:**
- Consumes: `DatabaseEvent` from `src/features/events/model/types.ts`.
- Produces:
  - `HostEventRow { event: DatabaseEvent; dateLabel: string; statusLabel: string; action: { label: string; to: string } }`
  - `deriveHostEventRows(events: DatabaseEvent[], now: Date): HostEventRow[]`
  - `findNextHostEvent(events: DatabaseEvent[], now: Date): DatabaseEvent | null`
  - `hostEventAction(event: DatabaseEvent): { label: string; to: string }`

- [ ] **Step 1: Write failing derivation tests**

```ts
it("routes a pending Host event to the existing owner editor", () => {
  expect(hostEventAction({ ...baseEvent, id: "pending-1", status: "pending" })).toEqual({
    label: "Edit event",
    to: "/profile/edit/pending-1",
  });
});

it("routes an approved Host event to its existing Calendar detail", () => {
  expect(hostEventAction({ ...baseEvent, id: "approved-1", city: "boston", status: "approved" })).toEqual({
    label: "View event",
    to: "/calendar?event=approved-1&city=boston",
  });
});

it("selects the nearest non-terminal future event as next", () => {
  expect(findNextHostEvent([pastApproved, cancelledFuture, nextApproved], now)?.id).toBe("next-approved");
});
```

- [ ] **Step 2: Run the derivation test to verify failure**

Run: `npx vitest run src/features/host/model/hostEvents.test.ts`

Expected: FAIL because the Host model module does not exist.

- [ ] **Step 3: Implement pure Host derivations**

- Treat `cancelled` and `archived` as terminal; do not select either as next event.
- Sort rows by `event_date` ascending, with undated/invalid dates last.
- Use `fromEventDateInstant` and the project’s America/New_York display conventions for date labels.
- Return `Edit event` only for `pending` or `rejected`; return `View event` for approved and all other non-editable statuses.
- Derive user-facing statuses from existing `DatabaseEvent.status` values; do not map to “Live”, “On sale”, “Wrapped”, or capacity data.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/features/host/model/hostEvents.test.ts`

Expected: PASS with owner-editor, Calendar, terminal, and date-order behavior covered.

- [ ] **Step 5: Commit**

```bash
git add src/features/host/model/hostEvents.ts src/features/host/model/hostEvents.test.ts
git commit -m "feat: derive host event actions"
```

### Task 2: Replace the organizer overview with the owner-scoped Host dashboard

**Files:**
- Create: `src/components/Host/HostDashboard.tsx`
- Create: `src/components/Host/HostDashboard.css`
- Modify: `src/pages/AdminOverviewPage.tsx:1-405`
- Modify: `src/pages/AdminOverviewPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `useMySubmissions(user.id)`, and Task 1 derivations.
- Produces: `HostDashboard`, rendered only for `role === "organizer"`.
- Preserves: platform-admin and moderator overview logic in a separately rendered component; those components continue using their current Admin hooks.

- [ ] **Step 1: Add failing Host dashboard tests**

```tsx
it("renders the organizer role as Host and excludes platform events", async () => {
  vi.mocked(useAuth).mockReturnValue(authState("organizer", { id: "host-1", email: "host@salsa.test" }));
  vi.mocked(useMySubmissions).mockReturnValue({
    submissions: [ownerPending],
    approvedEvents: [ownerApproved],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });

  renderOverview();

  expect(await screen.findByRole("heading", { name: "Host dashboard" })).toBeInTheDocument();
  expect(screen.getByText(ownerApproved.title)).toBeInTheDocument();
  expect(screen.queryByText(platformOnlyEvent.title)).not.toBeInTheDocument();
});

it("renders a useful no-next-event state", async () => {
  vi.mocked(useMySubmissions).mockReturnValue(emptyOwnerEventsState);
  renderOverview();
  expect(await screen.findByText(/no upcoming events yet/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run src/pages/AdminOverviewPage.test.tsx`

Expected: FAIL because organizer render still receives platform-wide Admin data and uses Organizer copy.

- [ ] **Step 3: Make `AdminOverviewPage` a role router**

- Keep only `useAuth()` in the outer component, then render `<HostDashboard />` for `organizer`, `<ModeratorOverview />` for `moderator`, or `<PlatformAdminOverview />` for `admin`.
- Move the current unconditional admin hooks and existing admin/moderator rendering into the latter two child components so Host never initiates platform-wide event/user/venue queries.
- `HostDashboard` derives its rows from `submissions` plus `approvedEvents`, shows Host-specific loading/retry/error/empty states, an owner-only next-event card, and truthful upcoming/review/total metrics.
- Next-event actions use Task 1 action URLs. Do not expose fake registered, capacity, door, task, DJ, or revenue values.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/pages/AdminOverviewPage.test.tsx src/features/host/model/hostEvents.test.ts`

Expected: PASS. Existing admin/moderator tests remain green; organizer tests prove owner-only data.

- [ ] **Step 5: Commit**

```bash
git add src/components/Host/HostDashboard.tsx src/components/Host/HostDashboard.css src/pages/AdminOverviewPage.tsx src/pages/AdminOverviewPage.test.tsx
git commit -m "feat: add owner-scoped host dashboard"
```

### Task 3: Add Host My Events under the existing admin shell

**Files:**
- Create: `src/pages/HostMyEventsPage.tsx`
- Create: `src/pages/HostMyEventsPage.css`
- Create: `src/pages/HostMyEventsPage.test.tsx`
- Modify: `src/App.tsx:18-119`
- Modify: `src/components/Admin/AdminSidebar.tsx:46-120`
- Modify: `src/components/Admin/AdminSidebar.test.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `useMySubmissions(user.id)`, and `deriveHostEventRows`.
- Produces: `/admin/host/events` child route rendered inside `AdminLayout`.
- Preserves: current `/profile/edit/:eventId` ownership/status guard and Calendar query deep link.

- [ ] **Step 1: Write failing Host My Events tests**

```tsx
it("switches between Cards and Table without changing the owner event set", async () => {
  renderHostEvents(ownerEventState);
  expect(await screen.findByText("Host · My Events")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Table" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Table" }));
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(within(screen.getByRole("table")).getByText(ownerPending.title)).toBeInTheDocument();
});

it("uses a labelled mobile card for every event field", async () => {
  renderHostEvents(ownerEventState);
  expect(await screen.findByText("Status")).toBeInTheDocument();
  expect(screen.getByText("Venue")).toBeInTheDocument();
});

it("links editable and published events to their existing destinations", async () => {
  renderHostEvents(ownerEventState);
  expect(await screen.findByRole("link", { name: "Edit event" })).toHaveAttribute("href", "/profile/edit/pending-1");
  expect(screen.getByRole("link", { name: "View event" })).toHaveAttribute("href", "/calendar?event=approved-1&city=boston");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/pages/HostMyEventsPage.test.tsx`

Expected: FAIL because the page and route do not exist.

- [ ] **Step 3: Implement route, page, and responsive views**

- Add `path="host/events"` as an `AdminLayout` child route accessible through the existing reviewer guard; `HostMyEventsPage` redirects/denies non-organizer roles using the existing role context.
- Render Cards/Table as an accessible `role="group"` with `aria-pressed` view controls.
- Cards and table display title, formatted date, venue, status, and the Task 1 action only.
- At `max-width: 640px`, hide table headers and render each table row as a labelled card using `data-label` on cells; do not duplicate content into a second markup tree.
- Add Host-only sidebar navigation item `/admin/host/events` labelled “My Events”; rename the organizer role’s dashboard/bulk-upload labels to Host while leaving admin and moderator labels unchanged.

- [ ] **Step 4: Run focused route and sidebar tests**

Run: `npx vitest run src/pages/HostMyEventsPage.test.tsx src/components/Admin/AdminSidebar.test.tsx`

Expected: PASS with role labels, Cards/Table, mobile labels, and action URLs covered.

- [ ] **Step 5: Commit**

```bash
git add src/pages/HostMyEventsPage.tsx src/pages/HostMyEventsPage.css src/pages/HostMyEventsPage.test.tsx src/App.tsx src/components/Admin/AdminSidebar.tsx src/components/Admin/AdminSidebar.test.tsx
git commit -m "feat: add host my events view"
```

### Task 4: Restyle the shared event modal as truthful quick look

**Files:**
- Modify: `src/components/EventModal/EventModal.tsx:114-296`
- Modify: `src/components/EventModal/EventModal.css:31-372`
- Modify: `src/components/EventModal/EventModal.test.tsx`

**Interfaces:**
- Consumes: existing `ScheduleXEvent` fields only.
- Preserves: `EventModalProps`, focus management, Calendar deep link behavior, and all existing outbound links.

- [ ] **Step 1: Write failing modal hierarchy tests**

```tsx
it("shows date, type, title, time, venue, and price in the quick-look region", () => {
  render(<EventModal event={classEvent} onClose={vi.fn()} />);
  expect(screen.getByText(/Monday, August 24, 2026/i)).toBeInTheDocument();
  expect(screen.getByText("class")).toBeInTheDocument();
  expect(screen.getByText("Beginner Salsa Class")).toBeInTheDocument();
  expect(screen.getByText(/7:00 PM - 11:00 PM/i)).toBeInTheDocument();
  expect(screen.getByText("Free")).toBeInTheDocument();
});

it("does not invent class metadata that is absent from the event", () => {
  render(<EventModal event={{ ...classEvent, host: undefined, danceStyles: undefined }} onClose={vi.fn()} />);
  expect(screen.queryByText(/Expected level|Teacher|Class length/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the modal test to verify failure**

Run: `npx vitest run src/components/EventModal/EventModal.test.tsx`

Expected: FAIL only where the test names the new quick-look structure.

- [ ] **Step 3: Implement the quick-look composition**

- Move the existing formatted date into a visual date block beside the type/title heading.
- Keep one factual quick-facts row for time, venue/address link, and price; keep description clamped visually only when necessary, never by deleting its accessible text.
- Reuse existing `danceStyles` chips and `host` text for classes/workshops without introducing new labels whose data is absent.
- Retain existing RSVP/Calendar actions and secondary contact/gallery/series content below the quick-look region.
- Use Lucide icons already imported by the modal; do not add emoji icons from handoff code.
- Ensure desktop centered modal and mobile single-column/bottom-sheet behavior remain free of overflow.

- [ ] **Step 4: Run focused modal and browsing tests**

Run: `npx vitest run src/components/EventModal/EventModal.test.tsx src/components/Events/Events.test.tsx src/components/Calendar/Calendar.test.tsx`

Expected: PASS. Homepage remains route-stable; Calendar remains deep-link capable.

- [ ] **Step 5: Commit**

```bash
git add src/components/EventModal/EventModal.tsx src/components/EventModal/EventModal.css src/components/EventModal/EventModal.test.tsx
git commit -m "feat: refine event quick look"
```

### Task 5: Format and verify the integrated surfaces

**Files:**
- Modify only files proven defective by verification.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified event browsing and Host dashboard surfaces.

- [ ] **Step 1: Format changed files**

Run:

```bash
npx prettier --write \
  src/features/host/model/hostEvents.ts \
  src/features/host/model/hostEvents.test.ts \
  src/components/Host/HostDashboard.tsx \
  src/components/Host/HostDashboard.css \
  src/pages/AdminOverviewPage.tsx \
  src/pages/HostMyEventsPage.tsx \
  src/pages/HostMyEventsPage.css \
  src/components/Admin/AdminSidebar.tsx \
  src/components/EventModal/EventModal.tsx \
  src/components/EventModal/EventModal.css
```

- [ ] **Step 2: Run all changed-contract tests**

Run:

```bash
npx vitest run \
  src/features/host/model/hostEvents.test.ts \
  src/pages/AdminOverviewPage.test.tsx \
  src/pages/HostMyEventsPage.test.tsx \
  src/components/Admin/AdminSidebar.test.tsx \
  src/components/EventModal/EventModal.test.tsx \
  src/components/Events/Events.test.tsx \
  src/components/Calendar/Calendar.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Browser-drive public event browsing**

Launch the app; on desktop and at 390px, open a homepage event, assert it retains `/`, inspect the quick-look layout, close it, then open the Calendar with `?event=` and assert the Calendar path remains authoritative. Verify no horizontal overflow.

- [ ] **Step 4: Browser-drive authenticated Host flows when local auth is available**

Sign in as an existing organizer-role test user. Assert `/admin` says Host, includes only owner events, opens `/admin/host/events`, toggles Cards/Table, routes pending/rejected actions to the owner editor, and routes approved actions to Calendar. At 390px, confirm every Host table field has a visible label.

- [ ] **Step 5: Run quality gates**

Run:

```bash
npm test -- --run
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 6: Commit verification-only defects when needed**

Commit only source fixes proven by these checks. Do not modify tests or commands merely to pass verification.

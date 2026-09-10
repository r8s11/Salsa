# Phase 3 — Events Management (`/admin/events`)

## Context

Rebuild `/admin/events` into the admin's highest-traffic working screen: find an event, read its status at a glance, spot incomplete listings, and act (edit / duplicate / publish / unpublish / cancel / archive / delete) without leaving the row. Today the page is a flat list of every event sorted newest-first, with four always-visible action buttons per row and three statuses. This phase delivers preset views, a compact filter bar, sortable columns, a 6-state status vocabulary, event source, inline quality signals, an overflow action menu, and a fast duplicate-for-next-week dialog — plus the four schema additions those features actually require.

Phase 4 owns the Create/Edit form. This phase does not touch `AdminEventForm.tsx` except to keep its existing call sites working.

## Step 0 — Unblock production (do this first)

**Production is currently degraded.** `.github/workflows/azure-static-web-apps-lemon-stone-01afe980f.yml:3-6` deploys on every push to `main`, so the Phase 2 admin UI is live, but the three Phase 2 migrations were only applied locally. `public.profiles` does not exist in prod, so the Overview's Total Users card renders `—` + Retry.

```bash
cd /home/r8s/code/Salsa
npx supabase link --project-ref <prod-ref>   # if not already linked
npx supabase db push
```

Expect `20260813000000_profiles`, `20260813000100_audit_logs`, `20260813000200_dashboard_indexes` to apply. Then reload `/admin` in prod and confirm Total Users shows a real integer.

**If `create trigger on_auth_user_created on auth.users` fails** (hosted Supabase restricts `auth` schema ownership), do not leave the migration half-applied. Split it: keep the table, indexes, backfill, RLS, and `profiles_set_updated_at`; drop the `auth.users` trigger; then add an idempotent upsert into `profiles` inside the `onAuthStateChange` handler at `src/contexts/AuthContext.tsx:25-29` so self-registered users still get a row.

**Deploy ordering rule for this entire phase:** migrations are manual, deploys are automatic on push. Every Phase 3 column is additive and nullable-or-defaulted, so old code keeps working after the migration — but new code breaks before it. Always `npx supabase db push` **before** `git push`.

## Data reality — verified this session

`public.events` columns: `id, title, description, event_type, event_date, event_time, location, address, price_type, price_amount, rsvp_link, image_url, status, submitter_name, submitter_email, created_at, city, host, recurrence, gallery, submitter_id, contact_email, contact_instagram, contact_website`.

Indexes: `events_event_date_idx`, `events_city_idx` (baseline:31-32), `events_status_idx`, `events_status_event_date_idx` (Phase 2).

| Field the brief asks about | Reality |
|---|---|
| `status` | `text default 'approved'`, **no CHECK constraint**. Only `approved`/`pending`/`rejected` in use |
| `source_type` | Absent |
| `updated_at`, `published_at` | Absent |
| `venue_id`, `organizer_id` | Absent — venue is `location text`, organizer is `host text` |
| `start_at`/`end_at` | Absent. `event_date timestamptz` is the instant; `event_time text` is a display-only label |
| Dance style | **No field of any kind.** `event_type` is format (`social`/`workshop`/`class`), not style |
| `submitter_id` | Present, `uuid references auth.users(id)`, nullable |
| `cancelled_at`, `archived_at`, `quality_status`, `last_reviewed_at` | Absent |

Three facts that constrain every decision below:

- **`status = 'approved'` is the public-visibility contract**, enforced in two places: the RLS policy `"Public events are viewable by everyone" using (status = 'approved')` (baseline:43) and `fetchApprovedEvents` (`eventsRepo.ts:50`). Renaming that value breaks the public calendar.
- **Phase 2's `audit_logs` already records who changed a status and when**, via the `events_audit_log` trigger. Any `*_at` timestamp column duplicating that is redundant.
- **Phase 2's Overview deep-links into this page** with `?status=pending`, `?flag=upcoming`, `?flag=incomplete`, `?edit=<uuid>`, `?new=1`. All five must keep working — they are the Overview's proof-of-life.

## Decisions — settled, do not re-open

### Status: add three values, rename none

DB keeps `approved`/`pending`/`rejected` and gains `draft`/`cancelled`/`archived`. The UI relabels two of them:

| DB value | UI label | Tone |
|---|---|---|
| `draft` | Draft | quiet |
| `pending` | Pending Approval | loud |
| `approved` | **Published** | quiet |
| `rejected` | Rejected | loud |
| `cancelled` | Cancelled | loud |
| `archived` | Archived | quiet |

Renaming `approved`→`published` was rejected. It buys no user-visible improvement, and it would touch the public RLS policy plus `fetchApprovedEvents` — meaning that between `supabase db push` (rows become `published`) and the SWA deploy finishing (code starts filtering `published`), the live public calendar would return zero events. `AdminStatusBadge` already maps DB value → label via a `Record`, so the mapping is the existing pattern, not a new one. Add the missing CHECK constraint with all six values.

### Source: add `source_type`, render it as context not alert

`text not null default 'user_submission'` with `check (source_type in ('admin','user_submission','organizer','moderator','imported'))`. All five values go in the CHECK now — `organizer` and `moderator` have no writer yet, but enumerating them costs nothing and avoids a second migration when those roles ship.

Rendered as 12px `--admin-text-muted` text with a 12px icon — never a filled badge, so it cannot compete with Status.

### Dance style: add `dance_styles text[]`

The brief requires a Dance Style filter and no field exists. `text[]` + GIN index, backfilled by keyword match so the filter is useful on day one. Phase 4 adds the editor input; until then admin-created events get `{}` and simply do not match style filters. The duplicate dialog preserves the array.

### `updated_at`: add it

Required by the brief's "sort by Updated Date". Reuses the `public.set_updated_at()` trigger function Phase 2 already created for `profiles` — no new function needed.

### `cancellation_reason`: add it

`text null`. Captured in the Cancel dialog, surfaced in the row's quality popover. Concrete workflow: a weekly social is cancelled for weather; the next admin reading the row learns why without opening the audit log.

### Recommended against — with reasons

- **`published_at`, `cancelled_at`, `archived_at`** — `audit_logs` already stores the actor and timestamp of every status transition, and `updated_at` covers recency sorting. These columns would be a second, drift-prone copy.
- **`quality_status`** — quality is derived from field emptiness. Storing it means recomputing on every write and risking staleness against the row it describes. Compute at render.
- **`last_reviewed_at`** — no workflow on this screen reads it. The brief's own instruction is to skip fields that are only hypothetically useful.
- **`venue_id` / `organizer_id`** — normalising venues and organizers into tables is exactly the infrastructure redesign the brief excludes. The Venue and Organizer filters need distinct *values*, which `SELECT DISTINCT location` / `DISTINCT host` over the loaded set already provides.
- **`start_at` / `end_at`** — Phase 2 deferred this with a documented 22-file blast radius. Adding `end_at` alone would create an asymmetric `event_date` + `end_at` pair, which is more confusing than either endpoint. Consequence: the duplicate dialog offers Date + Start Time, not End Time.

### Bulk actions: **add later**

Not in this phase. With 13 events and a single admin, selection checkboxes add a column, a select-all a11y surface, and a floating action bar to a screen whose per-row menu already does the job in one click. Build them when either trigger fires: a single preset view routinely returns more than 25 rows, or a second moderator account exists.

### Preset views: horizontally scrollable tabs with counts

Chosen over a segmented control (seven segments will not fit beside a 260px sidebar) and over a dropdown selector (hides the counts, which are the reason to look). Below 768px the tab bar becomes a single `<select>`.

## UX rationale and page hierarchy

The screen answers four questions in descending frequency, and the layout is ordered to match:

| Band | Question | Element |
|---|---|---|
| Header | "Where am I, and how do I add one?" | Title + description + `+ Create Event` |
| View tabs | "Which slice am I working?" | 7 preset tabs with counts |
| Toolbar | "Narrow to the ones I mean" | Search, Date, Status, More Filters |
| Active chips | "Why am I seeing these rows?" | Removable filter chips + Clear all |
| Table | "Read and act" | 7 columns, one overflow menu per row |
| Pagination | "Where am I in the set?" | Range, page size, page links |

The chip row is load-bearing, not decoration: with a preset view *and* ad-hoc filters both narrowing the set, an admin who cannot see why 3 of 200 rows are showing will assume the data is broken.

Search sits left and always visible on desktop, per the brief. Date and Status get dedicated controls because they are the two filters used on almost every visit; the remaining five live behind **More Filters** so the toolbar stays one row.

## Approach

### 1. Migration — status vocabulary, source, styles, timestamps

New file `Salsa/supabase/migrations/20260814000000_events_management_fields.sql`.

```sql
alter table public.events
  add column if not exists source_type text not null default 'user_submission',
  add column if not exists dance_styles text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancellation_reason text;

alter table public.events
  add constraint events_source_type_check
  check (source_type in ('admin','user_submission','organizer','moderator','imported'));

alter table public.events
  add constraint events_status_check
  check (status in ('draft','pending','approved','rejected','cancelled','archived'));
```

Backfill `source_type` from the writers that exist today — `createEventAsAdmin` stamps `submitter_name = 'Salsa Segura'` (`eventsRepo.ts:133`), `import-ics.mjs:102-103` stamps `submitter_name = 'ICS import (golatindance.com)'` and `submitter_email = '<city>@import.local'`, and `seed.sql` uses `'Seed Data'`:

```sql
update public.events set source_type = case
  when submitter_email like '%@import.local' then 'imported'
  when submitter_name in ('Salsa Segura', 'Seed Data') then 'admin'
  else 'user_submission'
end;
```

Backfill `dance_styles` by case-insensitive regex over `title || ' ' || coalesce(description,'')`. Exact vocabulary and patterns — these are the literals the filter reads, so they are fixed here:

| Style value | Pattern (`~*`) |
|---|---|
| `salsa` | `salsa\|casino\|rueda\|on1\|on2\|mambo\|timba` |
| `bachata` | `bachata` |
| `kizomba` | `kizomba\|urban kiz` |
| `merengue` | `merengue` |
| `cha-cha` | `cha[ -]?cha` |
| `zouk` | `zouk` |
| `afro-cuban` | `afro[ -]?cuban\|rumba` |

Add `create index if not exists events_dance_styles_idx on public.events using gin (dance_styles);` and the updated-at trigger reusing Phase 2's function:

```sql
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
```

Finally extend Phase 2's audit trigger so the two new terminal states get their own action literals. In `public.log_event_change()`, the status-change `case` gains `when 'cancelled' then 'event.cancelled'` and `when 'archived' then 'event.archived'`. `draft` intentionally keeps falling through to `event.status_changed`, because it is reachable from both Unpublish and Restore and a single literal would misdescribe one of them.

Independent of every frontend step. Must be applied to prod before any Phase 3 code is pushed.

### 2. Type + write-site updates for the new columns

`Salsa/src/features/events/model/types.ts` — extend `DatabaseEvent`:

```ts
status: "draft" | "pending" | "approved" | "rejected" | "cancelled" | "archived";
source_type: "admin" | "user_submission" | "organizer" | "moderator" | "imported";
dance_styles: string[] | null;
updated_at: string;
cancellation_reason: string | null;
```

Widening `status` will surface every exhaustive-mapping site at typecheck — that is the point. Expect errors in `AdminStatusBadge.tsx:3-7` (fix in step 6) and nowhere else, because `overviewMetrics.ts` compares against `"approved"`/`"pending"` rather than switching.

Write sites:
- `eventsRepo.ts` `createEventAsAdmin` (line 128) — add `source_type: "admin"`.
- `eventsRepo.ts` `submitEvent` (line 77) — add `source_type: "user_submission"`.
- `scripts/import-ics.mjs` — add `source_type: "imported"` to the row builder (~line 101) and to the `COLUMNS` allow-list array at lines 145-149, or the field is silently stripped.
- `supabase/seed.sql` — no change needed; the migration backfill covers seeded rows, and `db reset` runs migrations after the seed.

Depends on step 1.

### 3. Derivation module — the query pipeline

New file `Salsa/src/features/admin/model/eventsQuery.ts`. All pure, all take `now` explicitly.

```ts
export type EventView = "all" | "upcoming" | "drafts" | "pending" | "published" | "cancelled" | "archived";
export type SortKey = "event_date" | "created_at" | "updated_at" | "title";
export type SortDir = "asc" | "desc";

export interface EventFilters {
  q: string;
  from: string | null;          // yyyy-mm-dd inclusive
  to: string | null;            // yyyy-mm-dd inclusive
  status: DatabaseEvent["status"][];
  organizer: string | null;
  venue: string | null;
  city: City | null;
  style: string | null;
  source: DatabaseEvent["source_type"] | null;
  incompleteOnly: boolean;
}

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export function applyView(events: DatabaseEvent[], view: EventView, now: Date): DatabaseEvent[];
export function applyFilters(events: DatabaseEvent[], filters: EventFilters, now: Date): DatabaseEvent[];
export function applySort(events: DatabaseEvent[], key: SortKey, dir: SortDir): DatabaseEvent[];
export function defaultSortFor(view: EventView): { key: SortKey; dir: SortDir };
export function viewCounts(events: DatabaseEvent[], now: Date): Record<EventView, number>;
```

View predicates, fixed:

| View | Predicate |
|---|---|
| `all` | `status !== "archived"` |
| `upcoming` | `event_date >= startOfToday` and `status in ("draft","pending","approved","cancelled")` |
| `drafts` | `status === "draft"` |
| `pending` | `status === "pending"` |
| `published` | `status === "approved"` |
| `cancelled` | `status === "cancelled"` |
| `archived` | `status === "archived"` |

`all` excludes archived deliberately — archiving must actually remove a row from the working set or it is just a label. The Archived tab is the only place archived events appear.

`upcoming` includes `cancelled` so a cancelled event still on the horizon stays visible to whoever gets asked about it; it excludes `rejected` and `archived`, which are decisions already made.

`defaultSortFor`: `upcoming` → `{ event_date, asc }`; every other view → `{ event_date, desc }`. One rule, no per-view table to memorise.

`applyFilters` rules:
- `q` — case-insensitive substring across `title`, `location`, `host`, `submitter_name`, and the city's display label ("Boston" / "New York City"). Empty/whitespace `q` matches everything.
- `from`/`to` — compared against the event's **New York calendar date** via `fromEventDateInstant(event.event_date).date`, string-compared against the `yyyy-mm-dd` bounds. Using the raw instant would put a 9pm event on the wrong side of a boundary.
- `status` — empty array matches everything; otherwise membership.
- `organizer`/`venue` — exact match against `host`/`location`.
- `style` — `dance_styles?.includes(style)`.
- `incompleteOnly` — `qualityIssues(event).length > 0` (step 4).

`applySort` — `title` uses `localeCompare` with `{ sensitivity: "base" }`; date keys use `Date.parse`. Sort must be stable for equal keys: sort a shallow copy with an index tiebreaker so pagination cannot reshuffle rows between renders.

Depends on step 2. Do before steps 5–10.

### 4. Quality signals — extend the Phase 2 module without changing its output

Edit `Salsa/src/features/admin/model/overviewMetrics.ts`. **Do not modify `missingFields()` or `deriveIncompleteEvents()`** — the shipped Overview's "Incomplete Events" card and its unit tests depend on exactly the current venue/time/image rule. Add alongside:

```ts
export type QualityIssue = "venue" | "time" | "image" | "organizer" | "description" | "pricing" | "duplicate";

export const QUALITY_ISSUE_LABEL: Record<QualityIssue, string> = {
  venue: "Missing venue",
  time: "Missing start time",
  image: "Missing flyer",
  organizer: "Missing organizer",
  description: "No description",
  pricing: "Missing pricing",
  duplicate: "Potential duplicate",
};

export function qualityIssues(event: DatabaseEvent, duplicateIds?: ReadonlySet<string>): QualityIssue[];
export function findPotentialDuplicates(events: DatabaseEvent[]): Set<string>;
```

`qualityIssues` returns issues in `QUALITY_ISSUE_LABEL` key order: `venue` when `!location?.trim()`, `time` when `!event_time?.trim()`, `image` when `!image_url?.trim()`, `organizer` when `!host?.trim()`, `description` when `!description?.trim()`, `pricing` when `price_type === null` (a `free` event is priced, not unpriced), and `duplicate` when `duplicateIds?.has(event.id)`.

`findPotentialDuplicates` flags both members of any pair sharing a case-insensitive trimmed `title` **and** a case-insensitive trimmed `location` **and** whose `event_date` values are within ±24h. The ±24h window is what makes this safe for this product: a weekly event duplicated to next week is 7 days out and correctly not flagged, while the same event entered twice for one night is.

Depends on step 2.

### 5. `AdminActionMenu` — the overflow menu primitive

New files `Salsa/src/components/Admin/AdminActionMenu.tsx` and `AdminActionMenu.css`. Grepping `menu|dropdown|popover|aria-haspopup` across `src/styles/admin.css` and `src/components/Admin` returns nothing — no primitive exists.

```tsx
export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: ComponentType<{ size?: number }>;
  onSelect: () => void;
  tone?: "default" | "danger";
  separatorBefore?: boolean;
}

interface AdminActionMenuProps {
  label: string;              // "Actions for Salsa at the Anchor"
  items: ActionMenuItem[];
  disabled?: boolean;
}
```

Trigger is an `.admin-icon-btn` rendering `MoreHorizontal` from `lucide-react`, with `aria-haspopup="menu"`, `aria-expanded`, and `aria-label={label}`. Panel is `role="menu"`, items are `role="menuitem"` buttons.

Behaviour: opening focuses the first item; `ArrowDown`/`ArrowUp` roam with wraparound; `Home`/`End` jump; `Escape` closes and returns focus to the trigger; a `pointerdown` listener on `document` closes on outside click; selecting an item closes first, then invokes `onSelect`. Reuse `useEscapeKey` from `src/features/calendar/hooks/useEscapeKey.ts` for the Escape handling.

`separatorBefore` renders an `<li role="separator">` above the item. `tone: "danger"` colours the label `var(--admin-danger)`.

Positioning: `position: absolute; right: 0;` inside a `position: relative` wrapper, opening downward by default and flipping to `bottom: 100%` when `getBoundingClientRect().bottom + panelHeight > window.innerHeight` — measured in a `useLayoutEffect` after open. The last row of a 25-row table is near the viewport bottom; without the flip its menu is unreachable.

Independent of steps 3–4.

### 6. `AdminStatusBadge` — six states, loud vs quiet

Edit `Salsa/src/components/Admin/AdminStatusBadge.tsx` and the badge rules in `src/styles/admin.css` (currently `.admin-status` at ~332-379, three modifiers).

```tsx
const STATUS_LABEL: Record<DatabaseEvent["status"], string> = {
  draft: "Draft",
  pending: "Pending Approval",
  approved: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  archived: "Archived",
};
```

Three redundant signals per badge, so colour is never the only carrier:

| Status | Text | Glyph | Tint / ink |
|---|---|---|---|
| Published | Published | `::before` dot | `#ECFDF5` / `#047857` |
| Draft | Draft | `::before` hollow ring (dot with `background: transparent; border: 1.5px solid`) | `--admin-surface-high` / `--admin-text-muted` |
| Archived | Archived | `::before` hollow ring | `--admin-surface-high` / `--admin-text-muted` |
| Pending Approval | Pending Approval | `Clock` icon 12px | `--admin-attention-tint` / `--admin-attention-ink` |
| Rejected | Rejected | `CircleX` icon 12px | `#FEF2F2` / `#B91C1C` |
| Cancelled | Cancelled | `Ban` icon 12px | `#FEF2F2` / `#B91C1C` |

Quiet states keep the existing CSS `::before` dot mechanism. Loud states swap it for a real icon element — the shape change is what separates "normal" from "needs a human" at a glance, and it survives greyscale. Rejected and Cancelled share a palette but never a glyph or label.

Archived rows additionally render at `opacity: 0.72` (a `tr.admin-events-table__row--archived` class), reinforcing that they are out of the working set.

Confirm every icon exists in the installed `lucide-react` before use: `MoreHorizontal`, `Clock`, `CircleX`, `Ban`, `Copy`, `Pencil`, `Send`, `EyeOff`, `Archive`, `ArchiveRestore`, `Trash2`, `TriangleAlert`, `ArrowUpDown`, `ArrowUp`, `ArrowDown`, `SlidersHorizontal`, `Search`, `X`, `Shield`, `ShieldCheck`, `UserRound`, `Building2`, `Download`.

Independent of steps 3–5.

### 7. `AdminViewTabs` — preset views with counts

New files `Salsa/src/components/Admin/AdminViewTabs.tsx` and `AdminViewTabs.css`.

```tsx
interface AdminViewTabsProps {
  active: EventView;
  counts: Record<EventView, number>;
  onChange: (view: EventView) => void;
}
```

Order and labels, fixed: `All Events`, `Upcoming`, `Drafts`, `Pending Review`, `Published`, `Cancelled`, `Archived`. Each tab shows its label then its count in a muted pill. A zero count renders the tab greyed but still clickable — hiding it would make the admin wonder where it went.

Markup is `role="tablist"` with `role="tab"` + `aria-selected` buttons; the table container below carries `role="tabpanel"` and `aria-labelledby` pointing at the active tab. Arrow keys move between tabs (standard tab-list keyboard behaviour), and only the active tab is in the sequential tab order (`tabIndex={-1}` on the rest).

Overflow: `display: flex; overflow-x: auto;` with `scrollbar-width: thin` and a right-edge fade mask. Below 768px the whole bar is replaced by a single labelled `<select>` — the counts ride in the option text (`Pending Review (2)`).

Depends on step 3.

### 8. `AdminEventsToolbar` + `AdminEventsFilterDrawer`

New files `AdminEventsToolbar.tsx`/`.css` and `AdminEventsFilterDrawer.tsx`/`.css` in `src/components/Admin/`.

Toolbar row, left to right: search input (flex-grow, `Search` icon inside, `type="search"`), a Date control, a Status control, and a `More Filters` button carrying a count badge when any drawer filter is set.

- **Search** — controlled input, value mirrored to `?q=` debounced 200ms. Filtering itself is immediate on the debounced value; the input never lags. `aria-label="Search events"` plus visible placeholder `Search events, venues, organizers…`.
- **Date** — a `<select>` of presets (`Any date`, `Today`, `Next 7 days`, `Next 30 days`, `Past events`, `Custom…`). `Custom…` reveals two `<input type="date">` fields bound to `?from=`/`?to=`. Presets resolve to the same `from`/`to` pair, so there is one filtering mechanism, not two.
- **Status** — a multi-select popover (checkbox list of the six labels) reusing `AdminActionMenu`'s panel positioning/dismiss logic but with checkboxes; writes `?status=` as a comma-joined list. This is independent of the view tabs: the view sets the working slice, status narrows within it.
- **More Filters** — opens the drawer.

Drawer contains Organizer, Venue, Dance Style, City, Source. Organizer and Venue are `<select>`s populated from `Array.from(new Set(events.map(e => e.host).filter(Boolean))).sort()` and the same over `location`. Dance Style options are the seven fixed style values. City is the two known cities. Source is the five `source_type` values with their display labels.

Drawer presentation: right-side sheet, `role="dialog"` `aria-modal="true"` `aria-label="More filters"`, Escape closes via `useEscapeKey`, focus trapped, footer holds `Clear all` and `Apply`. Filters apply live as they change; `Apply` merely closes — the button exists because a sheet without a dismiss affordance reads as stuck.

Active-filter chips render below the toolbar, one per set filter, each labelled with its value (`Published ×`, `Boston ×`, `Salsa ×`, `Missing info ×`, `Aug 1 – Aug 31 ×`), plus a `Clear all` text button when two or more are active. Chips reuse the existing `.admin-chip` primitive and the dismiss-button pattern already in `AdminEventsPage.css:13-31` (`.admin-events-page__flag-chip-dismiss`) — generalise those two rules to `.admin-filter-chip` / `.admin-filter-chip-dismiss` and update the Phase 2 flag chip to use them, so there is one chip mechanism rather than two.

Depends on steps 3 and 5.

### 9. `AdminEventsTable` — rewrite

Rewrite `Salsa/src/components/Admin/AdminEventsTable.tsx` and `AdminEventsTable.css`. Current columns are `Event | Date & Time | Venue | Submitted by | Status | Actions`; the target is `Event | Date & Time | Venue | Organizer | Source | Status | Actions`.

```tsx
interface AdminEventsTableProps {
  events: DatabaseEvent[];
  duplicateIds: ReadonlySet<string>;
  sort: { key: SortKey; dir: SortDir };
  onSortChange: (key: SortKey) => void;
  onAction: (action: RowAction, event: DatabaseEvent) => void;
  busy: { id: string; action: RowAction } | null;
  errorId: string | null;
  error: string | null;
}

export type RowAction =
  | "edit" | "duplicate" | "publish" | "unpublish"
  | "reject" | "cancel" | "archive" | "restore" | "delete";
```

Collapsing eight callbacks into one `onAction` keeps the row menu declarative; the page owns which actions confirm.

Cells:
- **Event** — 48px thumbnail (existing pattern, `image_url || picsum` fallback), then the title as a `<Link to={`/admin/events?edit=${id}`}>`, then the existing type/city chips, then the quality indicator (step 10) on its own line when issues exist. The title is the only clickable text in the row.
- **Date & Time** — `Mon, Aug 17` over a muted `6:00 PM` line, from `fromEventDateInstant` (already imported here). When `event_time` is null the second line reads `Time not set` in `--admin-text-muted`.
- **Venue** — `location` or `Venue not set` muted.
- **Organizer** — `host` or `No organizer` muted. **Never** falls back to submitter.
- **Source** — icon + label in muted 12px: `admin`→"Admin" `Shield`, `user_submission`→"User Submission" `UserRound`, `organizer`→"Organizer" `Building2`, `moderator`→"Moderator" `ShieldCheck`, `imported`→"Imported" `Download`. `title` attribute gives the submitter attribution: `Submitted by Guest Submitter` (see below).
- **Status** — `AdminStatusBadge`.
- **Actions** — `AdminActionMenu`.

**Submitter display, privacy-conscious.** Submitter is no longer a column — it moves into the Source cell's tooltip and the row's detail affordance, because organizer is the operationally useful name. Resolution order: `submitter_name` when set and not an internal marker; otherwise `Guest Submitter`. Never render `submitter_email` in the table. The internal markers `Salsa Segura`, `Seed Data`, and `ICS import (golatindance.com)` resolve to the Source label instead of a person's name. `submitter_id === null` (anonymous insert, permitted by the `"Anon can submit pending events"` policy) also yields `Guest Submitter`.

**Sortable headers.** Event, Date & Time, and two non-column keys need to be reachable. Event Name and Event Date sort from their own `<th>`; Created and Updated are not columns, so they live in a small `Sort:` `<select>` at the right end of the toolbar carrying all four keys. Header cells that sort render `<th aria-sort="ascending|descending|none">` wrapping a `<button>` with `ArrowUpDown` (inactive) or `ArrowUp`/`ArrowDown` (active). Clicking an inactive header adopts that key with the direction from `defaultSortFor`; clicking the active header flips direction.

**Row action menu contents**, by status — this matrix is the contract:

| Status | Menu items (in order, `───` = separator) |
|---|---|
| `draft` | Edit, Duplicate ─── Publish, Archive ─── Delete |
| `pending` | Edit, Duplicate ─── Publish, Reject, Archive ─── Delete |
| `approved` | Edit, Duplicate ─── Unpublish, Cancel, Archive ─── Delete |
| `rejected` | Edit, Duplicate ─── Publish, Archive ─── Delete |
| `cancelled` | Edit, Duplicate ─── Publish, Archive ─── Delete |
| `archived` | Edit, Duplicate ─── Restore ─── Delete |

Target statuses: Publish→`approved`, Unpublish→`draft`, Reject→`rejected`, Cancel→`cancelled`, Archive→`archived`, Restore→`draft`.

**There is deliberately no "View" item.** A per-event public route does not exist: `EventModal` is opened only from Schedule-X's `onEventClick` with `selectedEvent` held in local component state (`src/components/Calendar/Calendar.tsx:95-98, 234`), and `CalendarPage` reads no search params. Adding one would mean building a public deep-link route, which is outside this screen. The title link → edit is the detail path, exactly as the brief specifies ("the event title should be clickable and open the event detail/edit experience").

Responsive, reusing the mechanism already proven in this file (`.admin-events-table__scroll` `display:none`→`block` at 768px; `.admin-events-cards` `flex`→`none` at 768px):
- **≥1024px** — all seven columns.
- **768–1023px** — Venue, Organizer, and Source columns hidden; venue and organizer collapse into one muted secondary line under the title (`The Anchor · Sabor Latino Boston`), source moves into that line's `title`. Four visible columns: Event, Date & Time, Status, Actions. Drop `min-width: 900px` to `min-width: 0` at this breakpoint so nothing scrolls horizontally.
- **<768px** — card stack (step 12).

Depends on steps 3, 4, 5, 6.

### 10. Quality indicator

New file `Salsa/src/components/Admin/AdminQualityBadge.tsx` (styles go in `AdminEventsTable.css` — it renders only inside rows).

```tsx
interface AdminQualityBadgeProps {
  issues: QualityIssue[];
  eventTitle: string;
}
```

Renders nothing when `issues` is empty. Otherwise a small inline `<button>`: `TriangleAlert` 12px + the first issue's label, plus `+N` when there is more than one — e.g. `⚠ Missing flyer +2`. Colour `--admin-attention-ink`, no fill, so it reads as a note under the title rather than a second badge.

Clicking toggles a popover listing every issue as a bullet, with `cancellation_reason` appended as a plain line when the event is cancelled and has one. The popover is `role="dialog"` `aria-label={`Quality issues for ${eventTitle}`}`, closes on Escape and outside pointerdown. Trigger carries `aria-expanded` and `aria-label={`${issues.length} quality issues`}`.

Depends on steps 4 and 9.

### 11. Duplicate dialog

New files `Salsa/src/components/Admin/AdminDuplicateEventDialog.tsx` and `.css`.

```tsx
interface AdminDuplicateEventDialogProps {
  event: DatabaseEvent;
  isBusy: boolean;
  error: string | null;
  onConfirm: (input: { date: string; time: string; publish: boolean }) => void;
  onCancel: () => void;
}
```

Title `Duplicate "<event title>"`. Body, in order:

1. **Date** — `<input type="date">`, prefilled to the original's New York date **+7 days** (weekly recurrence is the dominant case for this product).
2. **Start time** — `<input type="time">`, prefilled from `fromEventDateInstant(event.event_date).time`.
3. Quick-set buttons `+1 week` `+2 weeks` `+1 month`, each recomputing the date field from the *original* event date, not from the current field value — so clicking twice does not compound.
4. A muted "Copied unchanged" line naming what carries over: title, venue, address, organizer, description, pricing, dance styles, contact details, flyer.
5. A `Publish immediately` checkbox, **default off**.

No End Time field — no `end_at` column exists, per the decision above.

The title is copied **verbatim**, not prefixed with "Copy of". A weekly event's next occurrence has the same name; a "Copy of" prefix would have to be manually deleted every single time.

On confirm the new row is built from the source event with: `event_date = toEventDateInstant(date, time)` (reusing `src/features/events/model/eventDateTime.ts`), `event_time` = the same time re-formatted to the `h:mm AM/PM` label style already produced by `formatDateLine`, `status = publish ? "approved" : "draft"`, `source_type = "admin"`, `cancellation_reason = null`, and a fresh `id`/`created_at` from the database. `submitter_id`/`submitter_name` are set to the acting admin exactly as `createEventAsAdmin` does.

Depends on steps 2 and 5.

### 12. `AdminEventsPage` — rewrite around URL state

Rewrite `Salsa/src/pages/AdminEventsPage.tsx`. The page owns URL state, assembles the pipeline, and decides which actions confirm.

**URL parameter contract** (all optional; absent = default):

| Param | Values | Default |
|---|---|---|
| `view` | `all\|upcoming\|drafts\|pending\|published\|cancelled\|archived` | `upcoming` |
| `q` | free text | `""` |
| `from`, `to` | `yyyy-mm-dd` | none |
| `status` | comma-joined status values | none |
| `organizer`, `venue`, `style` | exact value | none |
| `city` | `boston\|new-york-city` | none |
| `source` | a `source_type` value | none |
| `sort` | `event_date\|created_at\|updated_at\|title` | `defaultSortFor(view)` |
| `dir` | `asc\|desc` | `defaultSortFor(view)` |
| `page` | 1-based integer | `1` |
| `size` | `25\|50\|100` | `25` |
| `flag` | `upcoming\|incomplete` | none — **Phase 2 compatibility, see below** |
| `edit` | uuid | none |
| `new` | `1` | none |

**Phase 2 back-compatibility is mandatory.** The shipped Overview links to `?status=pending`, `?flag=upcoming`, `?flag=incomplete`, `?edit=<uuid>`, `?new=1`. Normalise on read: `flag=upcoming` → `view=upcoming`; `flag=incomplete` → `incompleteOnly=true` (and the chip label stays `Missing info`); `status=pending` continues to set the status filter. Keep `flag` as the canonical param name for the quality filter rather than renaming it, so no shipped link breaks. Unknown or malformed values for any param are ignored and treated as absent.

Unlike Phase 2's read-once-at-mount approach, filter state here is **derived from `searchParams` on every render** rather than mirrored into `useState` — the tabs, chips, and Back button all mutate the URL, so a second source of truth would desynchronise. Keep `?edit=` resolution exactly as it is today: the adjust-state-during-render guard with `resolvedEditId` (`AdminEventsPage.tsx:82-88`). It exists because `react-hooks/set-state-in-effect` rejects the effect form, and re-introducing an effect will fail lint.

Any filter or view change resets `page` to 1. Changing `size` recomputes `page` so the first visible row stays visible: `page = Math.floor(firstVisibleIndex / newSize) + 1`.

Pipeline per render, all inside one `useMemo` keyed on `[events, searchParams]` with `const now = new Date()` **inside** the callback (`react-hooks/purity` already fired on this codebase for a render-body `new Date()`):

```
applyView → applyFilters → applySort → slice(page)
```

`viewCounts` runs on the unfiltered set so tab counts are stable while filters change — a tab reading `Pending Review (2)` must not become `(0)` because the search box narrows the table.

Action handling. Direct (no confirmation): Publish, Unpublish, Duplicate (its dialog *is* the confirmation), Restore, Edit, View. Confirmed via `AdminConfirmDialog`: Reject, Cancel, Archive, Delete.

- **Reject** keeps its existing confirmation. It is technically reversible, but it is a decision communicated about someone else's submission, and the safeguard is already shipped — removing it is a regression, not a simplification.
- **Archive** confirms because it removes the row from every view except Archived. Body: `"<title>" will be moved to Archived and hidden from the main event list. You can restore it later.` Confirm label `Archive event`.
- **Cancel** confirms and captures a reason. Body: `"<title>" will be marked cancelled. It stays visible in the admin list and is removed from the public calendar.` Confirm label `Cancel event`.
- **Delete** keeps today's copy: `"<title>" will be permanently deleted. This cannot be undone.` Confirm label `Delete event`.

`AdminConfirmDialog` (`src/components/Admin/AdminConfirmDialog.tsx`) currently takes `title/body/confirmLabel/isBusy/onConfirm/onCancel` and always renders a danger-styled confirm button. Extend it rather than fork it — it already owns overlay dismissal, Escape, focus-on-open, and `aria-labelledby`:

```tsx
tone?: "danger" | "neutral";                                  // default "danger"
reasonField?: { label: string; placeholder?: string; required?: boolean };
onConfirm: (reason?: string) => void;
```

When `reasonField` is set, render a labelled `<textarea class="admin-textarea">` and pass its trimmed value (or `undefined` when empty) to `onConfirm`. Cancel uses `reasonField` with `required: false`; Archive uses `tone: "neutral"`. All existing call sites keep working because both new props are optional and `onConfirm`'s new parameter is ignorable — verify with `lsp references` on `AdminConfirmDialog` before editing, then update the Phase 2 Overview call sites only if the signature change surfaces there.

**Pagination** — extract today's inline block (`AdminEventsPage.tsx:~340-360`) into `Salsa/src/components/Admin/AdminPagination.tsx`:

```tsx
interface AdminPaginationProps {
  page: number; pageCount: number; total: number;
  from: number; to: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
}
```

Renders `Showing 1–25 of 218` on the left; `Rows per page: [25 ▾]` and `← Previous  1 2 3 … 9  Next →` on the right. Page-number windowing: always show first and last; show the active page with one neighbour either side; replace each remaining gap with a single non-interactive `…`. Never render more than 7 page buttons. `<nav aria-label="Pagination">`, active page carries `aria-current="page"`.

**Loading** — no page-level spinner. The table renders 8 skeleton rows matching final geometry (thumbnail block, two text bars, badge pill), each `aria-hidden`, inside a container with `aria-busy="true"`, plus one `role="status"` reading `Loading events…`. Reuse `.admin-skeleton` from `src/styles/admin.css` (added in Phase 2).

**Error** — a full query failure renders the header, tabs, and toolbar as normal and replaces only the table body region with an `.admin-banner--error` reading `We couldn't load events.` plus a `Try Again` button calling `refetch()`. A failed *row action* renders inline in that row only (today's `errorId`/`error` mechanism, already in `AdminEventsTable`), leaving the rest of the page interactive.

**Empty states**, all rendered in the table body region, each with a distinct message:

| Condition | Copy | Action |
|---|---|---|
| Zero events in the database | `No events yet` / `Create the first SalsaSegura event.` | `+ Create Event` |
| Filters or search active, no matches | `No events match your filters.` / `Try adjusting your filters or clearing them.` | `Clear Filters` |
| `upcoming` view, no rows, no filters | `No upcoming events` / `Nothing is scheduled from today onward.` | `+ Create Event` |
| `pending` view, no rows, no filters | `Nothing waiting for review` / `Every submission has been handled.` | none |
| Any other view empty, no filters | `No <view label> events` | none |

Depends on every prior step.

### 13. Repo + hook mutations

`Salsa/src/features/events/api/eventsRepo.ts` — `setEventStatus` currently types its parameter as `"approved" | "rejected"` (line 100). Widen to the full status union and rename to reflect that it is no longer approve/reject only:

```ts
export async function setEventStatus(
  id: string,
  status: DatabaseEvent["status"],
  extra?: { cancellation_reason?: string | null },
): Promise<void>;

export async function duplicateEvent(
  source: DatabaseEvent,
  input: { date: string; time: string; publish: boolean },
  actor: { id: string; email: string | null },
): Promise<void>;
```

`duplicateEvent` inserts the field set listed in step 11. When cancelling, pass `cancellation_reason`; when moving to any non-cancelled status, pass `cancellation_reason: null` so a republished event does not keep a stale reason.

`Salsa/src/hooks/useAdminEvents.ts` — the existing `decide` mutation is approve/reject-shaped (`decidingStatus === "approved" ? "approve" : "reject"` drives the busy label at `AdminEventsPage.tsx:99-103`). Replace `decide` with a `changeStatus` mutation taking `{ id, status, reason? }`, and add a `duplicate` mutation. Keep the existing `isPending`/`isError`-gated exposure pattern for busy and error ids — the comment at lines 56-60 explains why `variables` is read differently for each, and that reasoning still holds. Invalidate `["events"]` on success, as the existing mutations do.

Depends on steps 2 and 11.

## Accessibility requirements

Binding across every step:

- **Contrast** — `--admin-text-subtle` (`#94A3B8`) measures 2.56:1 on white and fails AA; it is permitted only for decorative icons. All muted text uses `--admin-text-muted` (`#64748B`, 4.76:1). The new source labels and "not set" placeholders are text a user must read, so they use `--admin-text-muted`.
- **Status is never colour-alone** — every badge carries a text label plus a shape (dot, ring, or one of three distinct icons).
- **Sortable headers** — `<th aria-sort>` on the active column, `none` elsewhere; the interactive element inside is a real `<button>`.
- **Menus** — `aria-haspopup="menu"` / `aria-expanded` on triggers, `role="menu"`/`menuitem` on panels, arrow-key roving with wraparound, Escape returns focus to the trigger.
- **Tabs** — `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, arrow-key movement, single tab stop.
- **Result count is announced** — one `role="status"` element reading `<N> events` updates when the filtered count changes, debounced with the search input so typing does not spam the queue.
- **Row actions are named** — the trigger's accessible name is `Actions for <event title>`, never a bare "Actions", so a screen-reader user tabbing a 25-row table can tell rows apart.
- **Dialogs** — `role="dialog"` + `aria-modal` + `aria-labelledby`, focus moved in on open and restored to the invoking element on close, Escape dismisses. `AdminConfirmDialog` already does the first three; the duplicate dialog and filter drawer must match it.
- **Touch targets** — every menu item and pagination control is ≥44px tall on touch viewports.
- **Focus ring** — inherited from `.admin-shell button:focus-visible` / `a:focus-visible` in `src/styles/admin.css`; do not add per-component rings.

## Final wireframe

**Desktop, ≥1024px**

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Events                                                              [ + Create Event ]│
│ Manage events appearing on the SalsaSegura calendar.                                  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ All Events 24 │ Upcoming 11 │ Drafts 3 │ Pending Review 2 │ Published 11 │ Cancelled 1│
│ ──────────────  ▔▔▔▔▔▔▔▔▔▔▔                                                  Archived 6│
├──────────────────────────────────────────────────────────────────────────────────────┤
│ [ 🔍 Search events, venues, organizers… ] [ Next 30 days ▾ ] [ Status ▾ ] [ ⚙ More 2 ]│
│                                                                    Sort: [ Date ↑  ▾ ]│
│ Published ×   Boston ×   Salsa ×   Missing info ×            Clear all                │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ EVENT ⇅            DATE & TIME ⇅     VENUE        ORGANIZER      SOURCE   STATUS      │
│ ──────────────────────────────────────────────────────────────────────────────────── │
│ ▢ Salsa at the     Mon, Aug 17       The Anchor   Sabor Latino   ⛨ Admin  ● Published │
│   Anchor           6:00 PM                        Boston                          ••• │
│   SOCIAL BOSTON                                                                       │
│                                                                                       │
│ ▢ Salsa Sundays    Sun, Aug 23       Dance Union  No organizer   ⛨ Admin  ● Published │
│   SOCIAL BOSTON    7:00 PM                                                         ••• │
│   ⚠ Missing flyer +2                                                                  │
│                                                                                       │
│ ▢ Bachata Night    Fri, Aug 28       Havana Club  Havana Club    ◷ User    ⏱ Pending  │
│   SOCIAL NYC       9:00 PM                                       Submission  Approval │
│                                                                                    ••• │
│ ──────────────────────────────────────────────────────────────────────────────────── │
│ Showing 1–25 of 218          Rows per page: [ 25 ▾ ]   ← Previous  1 2 3 … 9  Next →  │
└──────────────────────────────────────────────────────────────────────────────────────┘

Row menu (•••) for a Published event:
        ┌─────────────────────┐
        │ ✎  Edit             │
        │ ⧉  Duplicate        │
        ├─────────────────────┤
        │ ⊘  Unpublish        │
        │ ⃠  Cancel Event     │
        │ 🗄  Archive          │
        ├─────────────────────┤
        │ 🗑  Delete          │  ← danger tone
        └─────────────────────┘
```

**Tablet, 768–1023px** — venue and organizer fold under the title, Source column drops out:

```text
┌────────────────────────────────────────────────────────────────┐
│ [ 🔍 Search… ] [ Date ▾ ] [ Status ▾ ] [ ⚙ More ]              │
├────────────────────────────────────────────────────────────────┤
│ EVENT ⇅                        DATE & TIME ⇅    STATUS         │
│ ────────────────────────────────────────────────────────────── │
│ Salsa at the Anchor            Mon, Aug 17      ● Published    │
│ The Anchor · Sabor Latino      6:00 PM                     ••• │
│ SOCIAL BOSTON                                                  │
└────────────────────────────────────────────────────────────────┘
```

**Mobile, <768px** — card stack, filters behind the drawer:

```text
┌──────────────────────────────┐
│ Events                       │
│ Manage events appearing…     │
│ [    + Create Event      ]   │
├──────────────────────────────┤
│ [ Upcoming (11)         ▾ ]  │
│ [ 🔍 Search events…       ]  │
│ [ Date ▾ ] [ Status ▾ ] [⚙] │
│ Published ×  Boston ×        │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ Salsa at the Anchor      │ │
│ │              ● Published │ │
│ │ Mon, Aug 17 · 6:00 PM    │ │
│ │ The Anchor               │ │
│ │ Sabor Latino Boston      │ │
│ │ ⛨ Admin              ••• │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Salsa Sundays            │ │
│ │              ● Published │ │
│ │ ⚠ Missing flyer +2       │ │
│ │ Sun, Aug 23 · 7:00 PM    │ │
│ │ Dance Union              │ │
│ │ ⛨ Admin              ••• │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ Showing 1–25 of 218          │
│ ← Previous      Next →       │
└──────────────────────────────┘
```

## Critical files & anchors

| File | Anchor | Why |
|---|---|---|
| `src/pages/AdminEventsPage.tsx` | `resolvedEditId` render-guard at 82-88; `filteredEvents` memo at 90-115 | The `?edit=` guard must survive the rewrite verbatim — the effect form fails `react-hooks/set-state-in-effect`, and `new Date()` outside a memo fails `react-hooks/purity` |
| `src/components/Admin/AdminEventsTable.tsx` | `formatDateLine` 34-49; table 144-231; card stack 233-283 | The date helper and the dual table/card render are reused wholesale; only columns and actions change |
| `src/components/Admin/AdminEventsTable.css` | 1-4 and 185-193 | The `display:none`→`block` / `flex`→`none` breakpoint pair that all responsive behaviour hangs on |
| `src/features/events/api/eventsRepo.ts` | `fetchApprovedEvents` 42-60 | Hard-codes `.eq("status","approved")` — the public-visibility contract that forbids renaming the value |
| `src/components/Admin/AdminConfirmDialog.tsx` | whole file (59 lines) | Extended with `tone` + `reasonField`; already owns overlay/Escape/focus/aria so forking it would duplicate all four |

## Verification

Run from `/home/r8s/code/Salsa`.

**1. Migration applies and backfills correctly.** `npm run db:reset`, then:

```bash
docker exec supabase_db_Salsa psql -U postgres -d postgres -c \
  "select source_type, count(*) from public.events group by source_type;
   select title, dance_styles from public.events where dance_styles <> '{}' limit 5;
   select count(*) from public.events where updated_at is null;"
```

Expect every seeded row `source_type='admin'` (seed uses `submitter_name='Seed Data'`), at least one row per style keyword present in the seed (`Bachata Sensual Social`→`{bachata}`, `Salsa On2 Workshop`→`{salsa}`, `Rumba y Timbal Workshop`→`{salsa,afro-cuban}`), and zero null `updated_at`.

Then prove the new status values and the audit literals:

```bash
docker exec supabase_db_Salsa psql -U postgres -d postgres -c \
  "update public.events set status='cancelled' where status='approved' and event_date > now();
   select action, count(*) from public.audit_logs where action like 'event.%' group by action;
   update public.events set status='bogus' where id = (select id from public.events limit 1);"
```

Expect `event.cancelled` rows present, and the final statement to **fail** with a check-constraint violation — that failure is the pass condition for `events_status_check`. Re-run `npm run db:reset` afterward.

**2. Public calendar is unaffected.** The whole point of not renaming `approved`:

```bash
docker exec supabase_db_Salsa psql -U postgres -d postgres -c \
  "select count(*) from public.events where status='approved';"
```

Then load `/calendar` in the browser and confirm the same number of events renders. If this count and the calendar disagree, stop — the status decision has been violated somewhere.

**3. Unit tests.** New `src/features/admin/model/eventsQuery.test.ts` with a frozen `now`, asserting the boundaries a plausible bug breaks: `all` excludes archived but includes cancelled; `upcoming` includes a cancelled future event and excludes a rejected one; an event exactly at `startOfToday` counts as upcoming and one a minute earlier does not; `from`/`to` bound by New York calendar date, proven with a 9pm event whose UTC date is the next day; `q` matches the city display label "New York City" and not the raw `new-york-city`; `applySort` on `title` is case-insensitive; sorting is stable for equal keys.

Extend `src/features/admin/model/overviewMetrics.test.ts`: `qualityIssues` flags `pricing` when `price_type` is null but **not** when it is `"free"`; `findPotentialDuplicates` flags same-title-same-venue events 2 hours apart and does **not** flag them 7 days apart; and — the regression guard — the existing `missingFields`/`deriveIncompleteEvents` assertions still pass unchanged.

Then `npx vitest run src/features/admin/model/`.

**4. Component tests.** Extend `src/pages/AdminEventsPage.test.tsx` using the `vi.hoisted` mock pattern already at lines 8-14 and the `renderAt(path)` helper at 87-91:
- Phase 2 links still work: rendering at `?status=pending`, `?flag=upcoming`, `?flag=incomplete`, `?new=1`, `?edit=<id>` each produces the same result it does today. **This is the highest-value test in the phase** — these five links are the shipped Overview's only path into this screen.
- `?view=archived` shows archived rows and the default view does not.
- Sorting by clicking the Event header toggles `aria-sort` and reorders rows.
- The row menu for a published event contains Unpublish/Cancel/Archive and not Publish; for an archived event it contains Restore and not Archive.
- Cancel opens a dialog with a reason field and passes the typed reason to the mutation.
- Duplicate opens the dialog prefilled 7 days out and submits `status: "draft"` unless `Publish immediately` is checked.

New `src/components/Admin/AdminActionMenu.test.tsx`: Escape closes and restores focus to the trigger; ArrowDown wraps from last to first; selecting an item closes the menu and fires `onSelect` exactly once.

**5. Full gate.** `npm run lint && npm test -- --run && npm run build`. Lint must stay at zero warnings (`--max-warnings 0`). Baseline entering this phase is 140 passing tests.

**6. End-to-end proof with real data.** `npm run build && npm run preview -- --host 127.0.0.1 --port 4173`, sign in as the admin, open `/admin/events`:

- Default lands on **Upcoming**, sorted soonest-first, with archived rows absent.
- Typing `anchor` narrows to matching rows and the URL gains `?q=anchor`; the result count announcement updates.
- Set Status → Pending Approval; a `Pending Approval ×` chip appears; dismissing it restores the rows and drops the param.
- Open **More Filters**, pick a Dance Style; the drawer closes on Escape with focus returned; the chip appears.
- On a published event: `•••` → Cancel → dialog names the event, accept with reason `Venue flooded` → the row's badge becomes Cancelled and the quality popover shows the reason.
- On that same event: `•••` → Duplicate → the date field is exactly 7 days out → confirm without publishing → a new Draft row appears with the identical title.
- Archive an event → it leaves All Events and appears under Archived → Restore returns it as a Draft.
- Delete names the event and removes it.
- Reload after each URL-mutating action and confirm the view reconstructs from the URL alone.

**7. Responsive and failure states** at 390×844, 820×1180, 1440×900: seven columns at 1440, four at 820 with venue/organizer folded under the title, cards below 768, and `document.documentElement.scrollWidth <= clientWidth` at every width. Then force the row-action failure path by blocking only the PATCH and confirming the error renders inside that row while the rest of the table stays interactive:

```js
page.on("request", r => r.method() === "PATCH" && r.url().includes("/rest/v1/events") ? r.abort() : r.continue());
```

Set up interception and assert **inside a single browser `run` call** — interception is run-scoped and resets between calls.

**8. Design detector**, once, on the finished UI:

```bash
node /home/r8s/.claude/plugins/cache/decksmith/impeccable/4.0.4/.claude/skills/impeccable/scripts/detect.mjs --json \
  src/pages/AdminEventsPage.tsx src/pages/AdminEventsPage.css \
  src/components/Admin/AdminEventsTable.tsx src/components/Admin/AdminEventsTable.css \
  src/components/Admin/AdminActionMenu.tsx src/components/Admin/AdminActionMenu.css \
  src/components/Admin/AdminViewTabs.tsx src/components/Admin/AdminViewTabs.css \
  src/components/Admin/AdminEventsToolbar.tsx src/components/Admin/AdminEventsToolbar.css \
  src/components/Admin/AdminEventsFilterDrawer.tsx src/components/Admin/AdminEventsFilterDrawer.css \
  src/components/Admin/AdminDuplicateEventDialog.tsx src/components/Admin/AdminDuplicateEventDialog.css \
  src/components/Admin/AdminPagination.tsx src/components/Admin/AdminPagination.css
```

Resolve any non-advisory finding. Font sizes off the public site's DESIGN.md ramp are advisory and expected — `.admin-shell` is a deliberately separate type system.

## Assumptions & contingencies

- **The status decision is a recommendation the user may reverse.** If they want the DB values renamed to match the UI labels (`approved`→`published`, `pending`→`pending_approval`), the change is: rename in one migration that also rewrites the RLS policy at `baseline:43` and `fetchApprovedEvents:50`, update the ~8 comparison sites in `overviewMetrics.ts`/`AdminEventsPage.tsx`/`AdminEventsTable.tsx`/tests/`seed.sql`/`import-ics.mjs`/`reconcile-prod-schema.sql` and the `event.approved` literal in the Phase 2 audit trigger — and critically, deploy the code **before** running the migration in prod, then run it immediately, accepting a brief window where newly-published events do not appear publicly. The default plan avoids that window entirely.
- **No View row action, by verification.** `src/components/Calendar/Calendar.tsx:95-98` opens `EventModal` from Schedule-X's `onEventClick` into local `selectedEvent` state, and `CalendarPage` parses no search params, so no `/calendar?event=<id>` deep link exists to link to. If the user later wants a public per-event URL, that is its own change (route + param-driven modal open) and View can be added to the menu then.
- **Dance Style has no writer until Phase 4.** The backfill makes the filter useful on existing data, but admin-created events will carry `{}` until Phase 4 adds the input. If the user wants styles editable now, add a multi-select to `AdminEventForm` and `AdminEventPayload` — a ~20-line change, but it crosses into Phase 4's scope, so it is excluded by default.
- **Filtering stays client-side.** `fetchAllEvents` loads every row and react-query caches it; at 13 events, and at a few hundred, in-memory filtering is faster and simpler than round-tripping. When `select count(*) from events` exceeds ~500, move view/filter/sort/paginate into `fetchAllEvents` as PostgREST query params — the pure functions in `eventsQuery.ts` become the server-side contract, and `events_status_event_date_idx` plus `events_dance_styles_idx` already cover the predicates.
- **`updated_at` starts flat.** Every existing row gets `now()` at migration time, so "sort by Updated Date" is meaningless until edits accumulate. This is expected, not a bug; do not backfill from `created_at`, which would fabricate history.
- **If the `events_status_check` constraint fails to apply in prod**, a row holds a status outside the six. Find it with `select distinct status from public.events;` and reconcile that value before retrying — never widen the constraint to accommodate unexpected data.

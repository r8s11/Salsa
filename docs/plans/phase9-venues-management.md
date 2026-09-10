# Phase 9 — Venues Management UX/UI

> **Design spec for the SalsaSegura Admin Dashboard** — the canonical reusable venue records feature.
> This document is the spec only; no implementation follows until approved.

## 1. Overview

Venues act as **canonical reusable locations** for SalsaSegura events. Today every event stores a free-text `location` string + `address` in its own row (see `AdminEventForm` "Location" fieldset). Phase 9 introduces a first-class `venues` table so the same place never appears as "Havana Club", "Havana Club Salsa", "Havana Club Cambridge", "Havana club" across events.

The infrastructure, authentication, backend, database, and permissions already exist. Focus is on UX/UI and the minimal schema that makes venue normalization possible without a cascade.

Routes:

- `/admin/venues` — list / search / filter / views
- `/admin/venues/new` — create
- `/admin/venues/:id` — detail (overview, events, organizers, history, admin actions)

Venues does **not** move into Tags or Settings yet.

---

## 2. Verified Against the Codebase

The following existing code was read before writing this spec and grounds every reuse decision:

| Existing pattern | File | How Phase 9 reuses it |
|---|---|---|
| `AdminConfirmDialog` with `tone: "danger" \| "neutral"` + `reasonField` | `src/components/Admin/AdminConfirmDialog.tsx` | Archive and Delete confirmation dialogs |
| `AdminUserDetailPage.tsx` 9-section review + sticky action panel | `src/pages/AdminUserDetailPage.tsx` | Review page layout (overview card → sections → footer actions) |
| `AdminEventForm.tsx` "Location" fieldset (free-text `location` + `address`) | `src/components/Admin/AdminEventForm.tsx` | Create/Edit Venue form fieldset pattern; location fields upgrade target |
| `AdminActionMenu` row-actions with `ActionMenuItem` type | `src/components/Admin/AdminActionMenu.tsx` | Venue table "•••" menu actions |
| `displayNameFor` / `identityLineFor` identity helpers | `src/features/admin/model/usersQuery.ts` | Organizer relationship display |
| `eventsQuery.ts` `applyFilters` / `FilterValue` URL-state pattern | `src/features/admin/model/eventsQuery.ts` | Venue list URL-state (search, filter, sort, page) |
| `overviewMetrics.ts` `deriveOverviewMetrics` + `AdminOverviewPage` metric cards | `src/features/admin/model/overviewMetrics.ts` | Future overview card for venue quality |
| `auditLogLabelFor` / `actorLabelFor` timeline vocabulary | `src/features/admin/model/auditLog.ts` | Venue history timeline (extend `auditLogLabelFor` with `venue.*` actions) |
| Sidebar `NAV_ITEMS` with `built` flag | `src/components/Admin/AdminSidebar.tsx` | Flip Venues to `built: true`, add `/admin/venues` route |
| `AdminLayout.tsx` `SECTION_LABEL` + `sectionLabelFor` | `src/layouts/AdminLayout.tsx` | Add `"/admin/venues"` → `"Venues"` + breadcrumb for `/admin/venues/:id` |
| `AdminStatusBadge` for event status | `src/components/Admin/AdminStatusBadge.tsx` | Template for the new venue-status badge |
| `AdminRoleChangeDialog` consequence copy | `src/components/Admin/AdminRoleChangeDialog.tsx` | Merge-dialog consequence copy ("N events will be reassigned") |
| `AdminUserAvatar` | `src/components/Admin/AdminUserAvatar.tsx` | Organizer avatar in relationships |
| Event `DatabaseEvent` type with `location: string \| null` + `address: string \| null` | `src/features/events/model/types.ts` | Current free-text venue storage — the thing Phase 9 replaces |
| `AdminEventPayload` (create/update event) | `src/features/events/api/eventsRepo.ts` | Future: add `venue_id` to payload; today events write location/address as free text |
| `AdminUsersPage` URL-state + `useAdminUsers` hook pattern | `src/pages/AdminUsersPage.tsx` | Queue page template for `/admin/venues` |
| `AdminUserDetailPage` single-record review + `useAdminUsers` + `useAdminEvents` + `useUserAuditLog` | `src/pages/AdminUserDetailPage.tsx` | Detail page template for `/admin/venues/:id` |
| `AdminEventsTable` dual-layout (table desktop + card list mobile) | `src/components/Admin/AdminEventsTable.tsx` | Venue list dual-layout |
| `AdminUsersToolbar` debounced search + sort dropdown + More Filters | `src/components/Admin/AdminUsersToolbar.tsx` | Venue list toolbar pattern |
| `AdminUsersFilterDrawer` tab-trap + Apply/Clear | `src/components/Admin/AdminUsersFilterDrawer.tsx` | Venue filter drawer pattern |
| `useEscapeKey` for dialog/drawer dismissal | `src/features/calendar/hooks/useEscapeKey.ts` | All dialogs/drawer ESC-close |
| `AdminEventForm`'s `AdminPayload` → `AdminEventPayload` mapping | `src/features/admin/model/adminEventForm.ts` | Future venue form validation pattern |
| `eventsRepo.ts` is the **sole** module calling `supabase.from('events')` | `src/features/events/api/eventsRepo.ts` | `eventsRepo.ts` is the **sole** module calling `supabase.from('events')` — venues get their own `venuesRepo.ts` as the sole `supabase.from('venues')` caller |
| `formatDate` helper in `AdminUserDetailPage` | `src/pages/AdminUserDetailPage.tsx` | Venue timeline date formatting |

### Key architectural constraint

`eventsRepo.ts` is the **only** module permitted to call `supabase.from('events')`. By the same rule, Phase 9 introduces `venuesRepo.ts` as the **only** module calling `supabase.from('venues')` (and `venuesAuditRepo.ts` for `audit_logs` filtered to `entity_type = 'venue'`). No component or hook queries Supabase directly.

### Current venue field state

`DatabaseEvent` has:
```ts
location: string | null;   // free-text, e.g. "Havana Club"
address: string | null;    // free-text, e.g. "288 Green St, Cambridge, MA"
```

Phase 9 proposes adding `venue_id: string | null` alongside (not replacing) `location`/`address`. Historical event display stays stable — events keep their stored location string; the venue_id is a normalization pointer.

---

## 3. Venues List UX — `/admin/venues`

Follows the `AdminUsersPage` pattern exactly: URL-state for search/filter/views/sort/page/size, skeleton loading, filter chips, dual-layout table.

### Columns (table)

| Column | Source field | Behavior |
|---|---|---|
| **Venue** | `venues.name` | Links to `/admin/venues/:id`. Sortable. |
| **City** | `venues.city` | Text. Sortable. |
| **Address** | `venues.address_line1` + `address_line2` + `postal_code` | Single-line summary. |
| **Upcoming Events** | `COUNT(events.*)` where `status=approved AND event_date >= now()` | Numbered badge. |
| **Status** | `venues.status` | `AdminVenueStatusBadge` (Active / Needs Review / Archived — color-never-only) |
| **Updated** | `venues.updated_at` | Relative ("Aug 12") |
| **Actions** | `venue.status` | `AdminActionMenu` — only "Edit" / "Archive" / "Merge" / "Delete" (see §3.5) |

### Example row

| Venue | City | Address | Upcoming | Status | Updated | Actions |
|---|---|---|---|---|---|---|
| Havana Club | Cambridge, MA | 288 Green St | 4 | Active | Aug 12 | ••• |
| The Anchor | Boston, MA | 123 Seaport Blvd | 2 | Active | Aug 12 | ••• |
| Salsa Studio | Somerville, MA | 503 Highland Ave | 0 | Needs Review | Jul 28 | ••• |

### Search & Filters

**Search** supports: venue name, address, city, ZIP (single text input, debounced, URL-state `q=`).

**Filters** (URL-state keys, matching `AdminUsersFilterDrawer` convention):

| Filter | URL key | Source |
|---|---|---|
| City | `city` | distinct `venues.city` |
| State | `state` | distinct `venues.state_region` |
| Status | `status` | `active` / `needs_review` / `archived` |
| Has Upcoming Events | `has_upcoming` | boolean toggle |

### Useful views (tabs, URL-state `view=`)

| View | Filter preset | Label |
|---|---|---|
| All | — | All |
| Active | `status=active` | Active |
| With Upcoming Events | `has_upcoming=true` | With Upcoming Events |
| Needs Review | `status=needs_review` | Needs Review |
| Archived | `status=archived` | Archived |

Default view: `all`. Tabs use `AdminViewTabs` (same as Organizer Requests queue).

### Filter Chips

Each active filter renders as a removable chip (same pattern as Organizer Requests toolbar). Clear all button on the right.

### Mobile

List rows become cards (same `AdminEventsTable` dual-layout pattern):

```
Havana Club
Cambridge, MA • 288 Green St
4 upcoming events · Active
•••
```

---

## 4. Venue Status Lifecycle

Simple — three statuses only (matches the brief's "Do not create many venue statuses unless real operational need"):

| Status | Value | When |
|---|---|---|
| Active | `active` | Venue is usable for event creation |
| Needs Review | `needs_review` | Auto-flagged for quality issues (missing address, missing coordinates, possible duplicate, no timezone, invalid website) |
| Archived | `archived` | No longer used for normal event creation, but historical events still reference it |

Status is displayed via `AdminVenueStatusBadge` (color-never-only — icon + label + shape). The `AdminStatusBadge` component is the template. No numeric "venue quality score" — the brief explicitly forbids it.

---

## 5. Create / Edit Venue UX (`/admin/venues/new` and `/admin/venues/:id/edit`)

Follows `AdminEventForm`'s fieldset pattern. Structured address fields, not one free-text blob.

### Form Fields

| Field | Required | Notes |
|---|---|---|
| Venue Name | ✅ | `venues.name` |
| Address Line 1 | ✅ | `venues.address_line1` |
| Address Line 2 | — | `venues.address_line2` |
| City | ✅ | `venues.city` |
| State / Region | ✅ | `venues.state_region` |
| ZIP / Postal Code | — | `venues.postal_code` |
| Country | ✅ | `venues.country` — default `US`, but allow global since dance events happen internationally |
| Timezone | — | **Inferred** from lat/lng (Geonames/Nominatim). Display as read-only `America/New_York` with an "Override" link if the inference is wrong. Do not make this a prominent text input. |
| Website | — | `venues.website` |
| Instagram | — | `venues.instagram` |
| Phone | — | `venues.phone` |
| Latitude | — | Auto-populated. Visible only in an "Advanced" expander. |
| Longitude | — | Auto-populated. Visible only in an "Advanced" expander. |

### Address Normalization UX

This is the critical piece — the brief says "prefer structured address fields" and "show a concise confirmation after entry."

**Flow:**

1. Admin types venue name + structured address fields.
2. On blur of ZIP (or after a debounce), a normalization step fires:
   - Calls the geocoding API (Nominatim or Google Geocoding) to resolve the structured address into a normalized string + lat/lng + timezone.
   - Shows a confirmation card:

```
Havana Club
288 Green St
Cambridge, MA 02139
[ Map Preview ]  ← small static map image (OpenStreetMap static map URL)
✎ Edit (corrects the normalized result)
```

3. The "Edit" link opens inline corrections for the normalized name + address — the admin can fix typos or override the geocoding result.
4. Latitude/longitude/timezone are shown in the "Advanced" expander (collapsed by default, as the brief says "do not make lat/long prominent").

### Duplicate Detection (create flow)

**During creation:** after the admin fills in name + address + city, show likely matches above the form:

```
Possible Existing Venue
Havana Club — 288 Green St, Cambridge, MA
[ Use Existing Venue ]   ← navigates to that venue's detail page

Havana Club Salsa — 290 Green St, Cambridge, MA
[ Use Existing Venue ]
```

**Matching signals** (client-side query against the venues table):

- Similar name (fuzzy match via `fuzzy_match` extension or `levenshtein`, threshold ~0.8)
- Same address (normalized `address_line1` + `city` + `postal_code` matches exactly)
- Nearby coordinates (`ST_DWithin(geography(ll), geography(normalized_ll), 100)` — within 100 meters)
- Same website URL

The brief: "Do not automatically merge records based only on name similarity." Matches are **suggested** — the admin must click "Use Existing Venue" to adopt them.

### Form Actions

- **Save** (primary): validate, normalize, run duplicate check, then create/update.
- **Cancel** (secondary): discard changes with confirmation if the form is dirty (`AdminConfirmDialog` with neutral tone, same as event edit cancel).
- **View public page** (if public venue pages are active — currently they are not, so this button is hidden).

---

## 6. Duplicate Detection & Merge Workflow

### When duplicates are found

The brief says duplicates should be a "major part of the UX." Duplicate detection runs:

1. **During venue creation** (§5 above) — suggested matches shown inline.
2. **On the venue detail page** — "Possible Duplicate" quality indicator (§9).
3. **Via a manual merge action** from the venue table "•••" menu.

### Merge workflow

Uses `AdminConfirmDialog` with **danger** tone (same pattern as `AdminUserDetailPage`'s suspend/ban). NOT a separate complex UI — the merge is a single destructive action.

```
Merge Venue Records
────────────────────────────────
Keep:
  Havana Club (288 Green St, Cambridge, MA)

Merge:
  Havana Club Cambridge (290 Green St, Cambridge, MA)

14 events will be reassigned to Havana Club.
The duplicate record (Havana Club Cambridge) will be archived.

[ Cancel ]  [ Merge Venues ]
```

**Flow:**
1. Clicking "Merge" in the table's action menu opens `AdminConfirmDialog` (danger tone).
2. The dialog body shows which venue is kept vs. merged, and the count of affected events.
3. On confirm: a server RPC `merge_venues(keep_id, merge_id)` does:
   - Reassigns all `events.venue_id = merge_id` → `keep_id` (only for events that currently point to the duplicate).
   - Copies over any non-blank fields from the merge record that are blank on the keep record (website, instagram, phone, etc.).
   - Archives the merge record (`status = 'archived'`).
   - Writes an `audit_logs` row: `venue.merged`.
4. The dialog shows `isBusy` state during the RPC, then closes on success.

The merge **preserves event relationships** (brief: "The merge should preserve event relationships"). It does **not** delete the duplicate record first (brief: "Do not simply delete the duplicate record first").

---

## 7. Venue Detail Page — `/admin/venues/:id`

Follows the `AdminUserDetailPage` layout exactly: back-link → header card → two-column body (sections left, admin actions right on desktop; stacked + sticky footer on mobile).

### Venue Header

```
Havana Club                          [ Active ]
Cambridge, MA
4 Upcoming Events
[ (hidden, not built yet) View Public Page ]  [ Edit Venue ]
```

"View Public Page" is hidden when public venue pages are not active (brief: "If public venue pages are not active yet, hide View Public Page").

### Sections (in brief-specified order)

1. **Venue Overview** — name, full address, timezone, website, instagram, phone, coordinates, status, created/updated at. Reuses `admin-user-detail-page__field` / `admin-field` / `admin-card` patterns.
2. **Location** — structured address breakdown (address_line1, address_line2, city, state_region, postal_code, country) + a `MapPreview` component showing an embedded OpenStreetMap static map.
3. **Contact & Social** — website, instagram, phone. External links identified with the same ↗ pattern used in `AdminEventForm`'s contact section.
4. **Upcoming Events** — list of approved events with `event_date >= now()`, sorted by date. Event names link to `/admin/events?edit=<id>` (same pattern as `AdminUserDetailPage`'s event links). "View all events →" link goes to `/admin/events?venue=<id>`.
5. **Past Events** — same list but secondary styling, sorted newest-first. Answers: "Is this still an active dance venue?" "Who typically organizes events here?" "Is this a duplicate venue?" (brief §Past Events).
6. **Organizer Relationships** — organizers (by `organizers.name`) that most frequently host events at this venue, with event counts. Derived from the events query (`SELECT organizers.name, COUNT(*) FROM events JOIN ... GROUP BY organizers.name ORDER BY count DESC`), not manually maintained. Reuses `AdminUserAvatar` + `displayNameFor` for organizer display.
7. **Venue History** — audit log timeline (same `audit_logs` pattern as `AdminUserDetailPage`'s Activity section). Extends `auditLogLabelFor` with `venue.created`, `venue.updated`, `venue.archived`, `venue.merged`, `venue.status_changed`. Uses `actorLabelFor` for the actor resolution.
8. **Administrative Actions** — archive button (neutral `AdminConfirmDialog`), delete button (danger `AdminConfirmDialog`), merge button (opens search + select flow).

### Sticky Footer (mobile)

On narrow viewports, the "Edit Venue" / "Archive" / "Delete" buttons collapse into a sticky footer bar — same pattern as organizer request's decision panel (brief §1 mobile order: identity first, then decision footer).

---

## 8. Archive / Delete Safeguards

Uses `AdminConfirmDialog` (same component, same patterns as `AdminUserDetailPage`).

### Archive Venue

```
Archive Havana Club?
This venue will no longer appear as a normal venue option when creating events.
Existing event history will remain intact.
[ Cancel ]  [ Archive Venue ]   ← tone: neutral
```

Archive is the **preferred** action (brief: "Archiving should be preferred over deletion when a venue has event history").

### Delete Venue

Only available when **safe** — no events reference the venue:

```
Delete Havana Club?
This action cannot be undone.
[ Cancel ]  [ Delete Venue ]   ← tone: danger
```

If events reference the venue:

```
This venue cannot be deleted because 18 events reference it.
Archive the venue or merge it with another venue instead.
[ Cancel ]   ← no delete button enabled
```

The brief says: "Avoid destructive cascade deletion." The check is a simple COUNT on `events WHERE venue_id = ?`. Deletion is a hard `DELETE FROM venues WHERE id = ?` — no cascade.

---

## 9. Venue Quality Indicators

Compact warnings, same pattern as `eventsQuery.ts`'s `qualityIssues`:

| Issue | Signal |
|---|---|
| Missing address | `address_line1` is null/empty |
| Missing coordinates | `latitude` or `longitude` is null |
| Possible duplicate | matched by `normalized_name` + address similarity (reuses `findPotentialDuplicates` pattern from `overviewMetrics.ts` but scoped to venues) |
| No timezone | `timezone` is null |
| Invalid website | `website` is non-null but fails URL validation |

When any issue is present, the venue status auto-sets to `needs_review` and the detail page shows a `AdminQualityBadge` warning (same pattern as `AdminEventForm`'s existing `AdminQualityBadge` component). The brief: "Do not introduce an overly complicated venue quality score" — these are binary indicators, not a score.

---

## 10. Consistency with Phase 4 & Phase 7 (Event Workflows)

The brief says: "Ensure the Venue Management UX remains consistent with those workflows" and "A Moderator reviewing a submitted event should not need to leave the review page just to normalize a venue."

Phase 4 (event submission) and Phase 7 (event editing) currently have a free-text "Location" fieldset in `AdminEventForm.tsx`:

```tsx
<fieldset className="admin-form__fieldset">
  <legend>Location</legend>
  <input id="location" type="text" placeholder="e.g. Havana Club" />
  <input id="address" type="text" placeholder="e.g. 288 Green St, Cambridge, MA" />
</fieldset>
```

**Phase 9 upgrade to the event form's Location fieldset:**

The free-text location field becomes a **venue combobox** — the admin types a name, and:

1. It searches `venues.name` with fuzzy matching (live as-you-type).
2. Matching venues appear in a dropdown (name + city + address preview).
3. If no match, a "Create new venue: 'Havana Club'" option appears at the bottom — clicking it opens the `AdminVenueForm` modal inline (same `AdminEventForm` modal pattern, but for venues).
4. When a venue is selected, the `address` field auto-fills from the venue record and becomes read-only (the admin can still click "Edit address on venue" to jump to the venue detail page).
5. If the admin clears the venue selection, the free-text `location` + `address` fields reappear (backward-compatibility fallback for events whose venue has no canonical record).

This keeps the moderator in the event review flow — no navigation away to normalize a venue.

The `DatabaseEvent.location` and `DatabaseEvent.address` fields are retained in the schema for historical stability (brief: "Keep historical event display stable even if venue information later changes"). Events store `venue_id` as a pointer, but the display always uses the stored `location` string, not a live join — so if a venue name changes, past events still show what they were entered with at submission time.

---

## 11. Mobile / Tablet Behavior

- **Venue list**: same dual-layout pattern as `AdminEventsTable` — table on `md+`, card list on mobile.
- **Venue detail**: on `< 768px`, the right-column admin actions collapse to a sticky footer bar (brief §1 mobile order: identity header first, decision panel last). Sections stack vertically.
- **Map previews**: hidden on mobile to avoid layout thrashing; the address text remains the source of truth.
- **Create/edit form**: stacked form fields (no two-column grids on mobile).
- **Merge confirm dialog**: full-width buttons on mobile, side-by-side on desktop (same `AdminConfirmDialog.css` responsive pattern).

---

## 12. Theme & Accessibility

Inherit the same theme system as every other admin page:

- **Light / Dark / System** — `useTheme()` from `useTheme` context; the venue pages call no theme logic themselves, they just inherit CSS variables.
- **Color is never the only signal** — `AdminVenueStatusBadge` uses icon + shape + text (same as `AdminStatusBadge` / `AdminAccountStatusBadge`).
- **Focus management** — all dialogs (`AdminConfirmDialog`, `AdminRejectOrganizerDialog`) manage focus with `useEscapeKey` for ESC-close and return-focus-on-unmount (same pattern proven in Phase 8).
- **External links** — website / instagram / website links use the ↗ external indicator (matching `AdminEventForm`'s contact section).
- **Reduced motion** — map preview fade-in respects `@media (prefers-reduced-motion)`.
- **Keyboard accessible** — search is a native text input, filter drawer is tab-trapped (same `useEscapeKey` + `keydown` trap as `AdminUsersFilterDrawer`), action menus use native `<button>` elements.

---

## 13. Database Recommendations

Categorized as Now / Later / Avoid — same structure as Phase 8's organizer_requests schema recommendations.

### Recommended Now (`venues` table)

```sql
CREATE TABLE venues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,          -- URL-safe, auto-generated
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  state_region    TEXT,
  postal_code     TEXT,
  country         TEXT NOT NULL DEFAULT 'US',
  latitude        NUMERIC(10, 8),
  longitude       NUMERIC(11, 8),
  timezone        TEXT,                           -- e.g. 'America/New_York'
  website         TEXT,
  instagram       TEXT,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','needs_review','archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Normalized lookup fields for duplicate detection (NOT exposed in UI)
  normalized_name       TEXT,
  normalized_address    TEXT,
);

-- Index for fuzzy name searching
CREATE INDEX venues_normalized_name_idx ON venues(normalized_name);
CREATE INDEX venues_city_idx            ON venues(city);
CREATE INDEX venues_status_idx          ON venues(status);
CREATE INDEX venues_postal_code_idx     ON venues(postal_code);
```

**Events gain a `venue_id` foreign key** (nullable, non-cascading):

```sql
ALTER TABLE events ADD COLUMN venue_id UUID REFERENCES venues(id);
CREATE INDEX events_venue_id_idx ON events(venue_id);
```

This mirrors how `organizer_requests` was the schema enabler for Phase 8's feature — `venues` is the schema enabler for Phase 9.

**Two admin RPCs** (following the `admin_user_directory` / `admin_organizer_requests` convention):

```sql
-- Fetches all venues with upcoming-event counts, for the queue page
CREATE FUNCTION admin_venue_directory(
  p_search TEXT,
  p_status TEXT[],
  p_city TEXT[],
  p_state TEXT[],
  p_has_upcoming BOOLEAN,
  p_sort TEXT,
  p_limit INT,
  p_offset INT
) RETURNS TABLE (
  id UUID, name TEXT, slug TEXT, city TEXT, state_region TEXT,
  address_line1 TEXT, address_line2 TEXT, postal_code TEXT, country TEXT,
  latitude NUMERIC, longitude NUMERIC, timezone TEXT,
  website TEXT, instagram TEXT, phone TEXT,
  status TEXT, upcoming_count BIGINT,
  updated_at TIMESTAMPTZ
) AS $$ ... $$ LANGUAGE SQL;

-- Fetches a single venue + its event/organizer stats, for the detail page
CREATE FUNCTION admin_venue_detail(p_id UUID)
RETURNS TABLE ( ... ) AS $$ ... $$ LANGUAGE SQL;
```

### Recommended Later

- **`venue_aliases`** — known alternate names (e.g. "Havana Club Salsa" → Havana Club). Improves imports, search, and duplicate prevention. Same pattern as Phase 8's "later" recommendation for `organizer_aliases`.
- **`venue_redirects`** — `old_venue_id → canonical_venue_id` so merged/deleted venue IDs can still resolve. Valuable if venue IDs are referenced externally or by imports.
- **Manual `venue_organizers` table** — for manually curated organizer-venue relationships. The brief currently says "derived from actual event relationships rather than manually maintained unless necessary," so we start derived-only.

### Avoid

- **Deleting venues with event history** — use archive instead (see §8).
- **Using only free-form venue text** — the whole point of Phase 9 is to move off free-text `location`/`address`.
- **Automatically merging based on name alone** — name is only one signal; address + coordinates + website are weighted in.
- **Creating a separate venue for every spelling variation** — the duplicate detection + merge workflow exists to prevent this.
- **Cascade deletion** — the brief says "Avoid destructive cascade deletion."

### SEO Considerations

Because public venue pages may eventually become SEO landing pages (same note as Phase 8), the schema maintains: clean canonical name, stable slug, structured address, coordinates, and upcoming events. But SEO requirements do **not** complicate the admin workflow — the slug is auto-generated and editable inline, not a separate step.

---

## 14. Venue Form Reusability (Future)

The `AdminVenueForm` (venue name + structured address fields) is extracted as a standalone component from Phase 4/7's event form Location fieldset. This allows:

- The "Create new venue" combobox option in `AdminEventForm` to open a modal with `AdminVenueForm` (brief §10).
- The standalone `/admin/venues/new` and `/admin/venues/:id/edit` pages to reuse the same component.

This follows the "reuse, don't rebuild" contract from Phase 8's design doc.

---

## 15. Final Wireframe

### Venues list — desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ Venues                                          + Add Venue         │
│ Manage reusable event locations.                                    │
├────────────────────────────────────────────────────────────────────┤
│ [ Search venues... ] [ City ] [ Status ] [ More Filters ]         │
│ All  Active  Upcoming  Needs Review  Archived                       │
│ ────────────────────────────────────────────────────────────────   │
│ [ Havana Club ]  [ Cambridge, MA ]  [ 4 upcoming ]  [ Active ]  ••• │
│ [ The Anchor ]   [ Boston, MA ]     [ 2 upcoming ]  [ Active ]  ••• │
│ [ Salsa Studio ] [ Somerville, MA ] [ 0 upcoming ]  [ Review  ]  ••• │
└────────────────────────────────────────────────────────────────────┘
```

### Venue detail — desktop

```
Havana Club                              [ Active ]
Cambridge, MA
4 Upcoming Events
[ Edit Venue ]

LOCATION
288 Green St
Cambridge, MA 02139
Timezone: America/New_York

CONTACT & SOCIAL
Website ↗  Instagram ↗

UPCOMING EVENTS
Bachata Mondays   Aug 17   View →
Salsa Fridays     Aug 21   View →
[ View all events → ]

PAST EVENTS
Salsa Social      Jul 12   View →
...

ORGANIZER RELATIONSHIPS
Havana Club Boston — 12 events
Mambo Nights — 3 events

VENUE HISTORY
Aug 8   Archived by @admin — merged into Havana Club
Jul 15  Updated by @moderator
Jun 1  Created by @admin

ADMIN
[ Archive Venue ]   [ Delete Venue ]
```

### Venues list — mobile

```
Havana Club
Cambridge, MA • 288 Green St
4 upcoming events · Active
•••

The Anchor
Boston, MA • 123 Seaport Blvd
2 upcoming events · Active
•••
```

### Merge confirmation dialog

```
Merge Venue Records                     [ ✕ ]
─────────────────────────────────────────────
Keep:
  Havana Club (288 Green St, Cambridge, MA)

Merge:
  Havana Club Cambridge (290 Green St, Cambridge, MA)

14 events will be reassigned to Havana Club.
The duplicate record will be archived.

[ Cancel ]  [ Merge Venues ]
```

---

## 16. Critical Files & Anchors for Implementation

| What | File |
|---|---|
| Sidebar nav item flip + route | `src/components/Admin/AdminSidebar.tsx` (line 40: `{ group: "Platform", label: "Venues", icon: MapPin, built: false }`) → `built: true`, `to: "/admin/venues"` |
| Breadcrumb label | `src/layouts/AdminLayout.tsx` (add to `SECTION_LABEL` + `sectionLabelFor`) |
| Model (types + helpers) | `src/features/admin/model/venuesQuery.ts` (new — pattern: `organizerRequestsQuery.ts`) |
| API (sole `supabase.from('venues')` caller) | `src/features/admin/api/venuesRepo.ts` (new — pattern: `organizerRequestsRepo.ts`) |
| Hook (queries + mutations) | `src/features/admin/api/venuesRepo.ts` or `src/hooks/useAdminVenues.ts` (new — pattern: `useOrganizerRequests`) |
| Status badge | `src/components/Admin/AdminVenueStatusBadge.tsx` (new — pattern: `AdminRequestStatusBadge`) |
| Form | `src/components/Admin/AdminVenueForm.tsx` (new — pattern: `AdminEventForm.tsx` Location fieldset) |
| Queue table (dual-layout) | `src/components/Admin/AdminVenuesTable.tsx` (new — pattern: `AdminOrganizerRequestsTable`) |
| Queue toolbar | `src/components/Admin/AdminVenuesToolbar.tsx` (new — pattern: `AdminOrganizerRequestsToolbar`) |
| Filter drawer | `src/components/Admin/AdminVenuesFilterDrawer.tsx` (new — pattern: `AdminOrganizerRequestsFilterDrawer`) |
| Queue page | `src/pages/AdminVenuesPage.tsx` (new — pattern: `AdminOrganizerRequestsPage`) |
| Detail page | `src/pages/AdminVenueDetailPage.tsx` (new — pattern: `AdminOrganizerRequestDetailPage`) |
| Merge dialog | reuses `AdminConfirmDialog` (no new component) |
| Archive/Delete dialogs | reuses `AdminConfirmDialog` (no new component) |
| Event form Location fieldset upgrade | `src/components/Admin/AdminEventForm.tsx` (line 218-244: Location fieldset → venue combobox) |
| Audit log labels | `src/features/admin/model/auditLog.ts` (add `venue.*` cases to `auditLogLabelFor`) |
| Event type | `src/features/events/model/types.ts` (`DatabaseEvent` — add `venue_id` field) |
| Event repo payload | `src/features/events/api/eventsRepo.ts` (`AdminEventPayload` — add `venue_id`) |
| AdminEventForm mapping | `src/features/admin/model/adminEventForm.ts` (`adminFormToPayload` — map `venue_id`) |

**This spec stops here. No implementation until approved.** The brief said "Complete Phase 9 only and wait for my approval before continuing."
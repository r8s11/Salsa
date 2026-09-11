# SalsaSegura Admin Dashboard — Event Create & Edit Design Specification

## Phase 4: Create & Edit Event UX/UI

**Status:** Complete (design spec)
**Scope:** `/admin/events/new` and `/admin/events/:id`
**Audience:** SalsaSegura admin operators (event curators, program managers)

---

## 1. UX Rationale

### Current State Assessment

The existing `AdminEventForm.tsx` is a single-page vertical form with five fieldsets:
- Event details (title, type, city, date, time, recurrence checkbox, dance styles, description)
- Location (venue name, address)
- Pricing & link (price type, amount, RSVP link)
- Presentation (host, image URL with preview)
- Contact (email, Instagram, website)

The form is submitted via a single "Create event" or "Save changes" button at the bottom, with a "Cancel" button alongside. It is embedded inside `AdminEventsPage.tsx` which switches between `{ mode: "list" }`, `{ mode: "create" }`, and `{ mode: "edit", event }`.

### Key Pain Points Identified

1. **All-or-nothing form**: The entire form is one continuous scroll. Admins cannot quickly jump to a specific section when editing a live event to fix a date or venue.
2. **Recurrence is binary**: Only supports "weekly" or not. No "every 2 weeks", "monthly", or end conditions.
3. **Venue is free-text**: Admins must re-type venue name + address for every event, even when the same venue is reused weekly.
4. **Pricing is rigid**: Only "free" or "paid" with a single flat amount. Cannot express lesson+social pricing, student discounts, or tier pricing.
5. **No draft autosave**: A browser tab close or accidental navigation loses all unsaved work.
6. **Image is URL-only**: No drag-and-drop upload or file picker. Must find and paste a URL.
7. **No preview**: Admin cannot see how the event will look on the public calendar before publishing.
8. **No edit context for published events**: Editing a live event does not communicate that changes are immediate and public.
9. **Recurring edit ambiguity**: There is no recurrence-series editing UX at all.
10. **Mobile form is a wall**: The full form renders on mobile without any collapse or adaptive layout.

### Design Goals

- **Fast entry**: Create a simple event in under 10 seconds if all fields are known.
- **Minimal repetition**: Venues, organizers, and pricing templates should be reusable.
- **Progressive disclosure**: Advanced fields (schedule details, multiple prices, gallery) are hidden by default and revealed on demand.
- **Safe editing**: Published event edits surface the right mental model. Unsaved changes are protected.
- **Mobile-first**: The form must work on a phone for emergency corrections.

---

## 2. Form Architecture — Section-Based with Sticky Nav

### Recommendation: Vertical sections with sticky side navigation (desktop) / top-down sections with sticky header (mobile)

**Why not tabs?** Tabs hide sections from view, forcing the admin to open each tab to read/review. Event forms have interdependencies (date affects recurrence summary, venue populates address), so visibility of multiple sections at once aids comprehension.

**Why not a wizard?** Wizards enforce a linear flow. Admin event entry requires frequent back-and-forth (e.g., "I need to change the event type, which affects pricing"). A wizard would triple the click cost.

**Why not a plain accordion?** Accordions collapse content, but admins frequently need to compare fields across sections (e.g., "Is this venue's address consistent with the event city?"). Sections should be expandable simultaneously.

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Events  Create Event                                              │
│ Add a new event to the SalsaSegura calendar.                        │
├──────────────────┬──────────────────────────────────────────────────┤
│ BASIC INFO       │ Event Name *                                     │
│ SCHEDULE         │ [ Salsa at the Anchor__________ ]                 │
│ LOCATION         │                                                    │
│ PRICING          │ Dance Styles                                     │
│ ORGANIZER        │ [ Salsa × ] [ Bachata × ]  + Add                 │
│ MEDIA            │                                                    │
│ PUBLISHING       │ Event Type                                        │
│                  │ [ Social ▼ ]                                       │
│                  │                                                    │
│                  │ Short Description                                │
│                  │ [ ____________________________ ]                  │
│                  │                                                    │
│                  │ Full Description                                 │
│                  │ [ Multi-line textarea                   ]         │
│                  │                                                    │
│                  │ ─────────────────────────────────────────         │
│                  │ Schedule                                         │
│                  │                                                    │
│                  │ Date *           Start *    End                    │
│                  │ [ Aug 17 ]      [ 6:00 PM ]  [ 9:00 PM ]            │
│                  │                                                    │
│                  │ Repeats                                            │
│                  │ [ No ▼ ]                                            │
│                  │                                                    │
│                  │ ─────────────────────────────────────────         │
│                  │ Location                                         │
│                  │                                                    │
│                  │ [ Search venues...         ]  OR + Add new         │
│                  │                                                    │
│                  │ ─────────────────────────────────────────         │
│                  │ ...                                              │
├──────────────────────────────────────────────────────────────────────┤
│              ┌─────────────────────────────────────────────────────┐ │
│              │ Saved  ·  Save Draft  ·  Preview  ·  Publish        │ │
│              └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

The left rail is 240px wide, shows section names with anchor links. Clicking a section name scrolls to it smoothly. The right pane is the form content.

### Mobile/Tap Layout

On screens < 768px:
- The side navigation collapses to a sticky top bar with a "Sections" dropdown.
- Each section becomes a full-width card.
- The sticky action bar moves to the bottom of the viewport (see section 10).

### Section Structure

Each section is a `<section>` with a sticky `<legend>`-like header. Sections can be expanded/collapsed independently. The "Basic Information" and "Publishing" sections are always visible; others can be collapsed.

The form currently has 5 fieldsets. I propose 7 sections:
1. **Basic Information**
2. **Schedule**
3. **Location**
4. **Pricing**
5. **Organizer & Contact**
6. **Media**
7. **Publishing**

---

## 3. Basic Information

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Event Name | Text input (60px tall) | Required | Largest visual element in the section. Placeholder: "e.g. Friday Night Salsa Social" |
| Short Description | Text (single line, 120 char limit) | Recommended | Appears on search results / card hover. Placeholder: "A high-energy salsa social with live music..." |
| Full Description | Rich text / textarea (2000 char limit) | Recommended | Full event detail page. Supports line breaks. Placeholder: "Tell people what to expect..." |
| Dance Styles | Multi-select chip group | Required (at least 1) | See below |
| Event Type | Select dropdown | Required | See below |

### Visual Hierarchy

```
BASIC INFORMATION

Event Name *
┌───────────────────────────────────────────────────────────────────┐
│ Friday Night Salsa Social at The Anchor                           │
└───────────────────────────────────────────────────────────────────┘

Short Description
┌───────────────────────────────────────────────────────────────────┐
│ Weekly salsa social with live band. All levels welcome.           │
└───────────────────────────────────────────────────────────────────┘

Description
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│ Join us every Friday for a high-energy salsa social featuring    │
│ live music from the Mambo Kings. Beginner lesson at 7, social    │
│ dancing 8-11pm.                                                  │
│                                                                   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

Dance Styles
─────────────────────────────────────────────────────────────────────

[ Salsa × ] [ Bachata × ] [ Kizomba × ]   + Add

Event Type
┌────────────────────────────┐
│ Social Dance        ▼     │
└────────────────────────────┘
```

### Dance Styles Multi-Select

**Current:** A checkbox grid of 7 fixed styles. No "Other" option.

**Proposed design:**

```
Dance Styles (required)
─────────────────────────────────────────────────────────────────────
Salsa ×  Bachata ×  Merengue ×  Cha-Cha ×  Kizomba ×  Zouk ×  Afro-Cuban ×
+ Add style

[ Other: ______________________ ]  [ Add ]
```

- Clicking a chip toggles selection (selected = filled red, unselected = outline).
- "+ Add style" opens a small popover with a searchable list of all known styles plus an "Other" text field.
- Selecting "Other" from the popover adds a free-text chip that can be typed and confirmed with Enter.
- Maximum 10 styles enforced (existing validation already does this).

### Event Type Taxonomy — Simplification Recommended

**Current:** `EventType = "social" | "class" | "workshop"`

**Proposed:** Expand to a richer set that better matches the domain, stored as a free-text string with a controlled vocabulary:

```
Social Dance       (regular social)
Class / Lesson     (instructional)
Social + Class     (lesson then social)
Workshop           (intensive)
Festival           (multi-day event)
Performance        (show)
Outdoor Event      (location-specific modifier)
Other              (free text)
```

**Database recommendation:** Replace the `event_type` CHECK constraint with a `text` column + an index on the common values. This avoids a migration whenever a new type is needed. Store the selected label directly.

---

## 4. Schedule

### Required Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Date | Date picker | Required | Native HTML date picker on mobile, calendar widget on desktop |
| Start Time | Time picker | Required | 24h or AM/PM based on user locale, stored as HH:MM |
| End Time | Time picker | Recommended | Defaults to +4h from start (existing `DEFAULT_DURATION_HOURS = 4`) |

### Secondary Schedule Details (Collapsible)

A "+ Add schedule details" toggle reveals:

```
Schedule Details
─────────────────────────────────────────────────────────────────────

Doors Open
[ 6:00 PM ]   (30 min before start — auto-calculated)

Lesson Start
[ 7:00 PM ]   (only for Social + Class / Class events)

Social Start
[ 8:00 PM ]   (auto from start time)
```

These are optional. When empty, they are simply not shown in the event modal. The form stores them as separate DB columns or a JSON object.

### Timezone

Since all SalsaSegura events are in one of two cities (Boston / NYC), and both are in `America/New_York`, timezone is implicit. **Recommendation: do not surface timezone selection in the admin UI.** The backend already converts via `Temporal.ZonedDateTime` with hardcoded `"America/New_York"` in `convert.ts`. If the platform ever expands to a third timezone, add a city-level timezone field instead of a form-level select.

### Recurring Events

**Current:** A single checkbox "This is a weekly recurring event" → stores `"weekly"` in `recurrence` column.

**Proposed design:**

```
Repeats
─────────────────────────────────────────────────────────────────────

○ Does not repeat

● Repeats

  Frequency         Every      [ 1 ] [ week  ▼ ]
  ┌───────────────────────────────────────────┐
  │ Repeats:                                │
  │ Every Monday at 7:00 PM                 │
  │ starting August 17, 2026                 │
  └───────────────────────────────────────────┘

  On these days:
  [● Mon] [● Wed] [● Fri]   (for weekly)

  End:
  ○ Never
  ● After [ 10 ] occurrences
  ○ On [ Aug 30, 2026 ]

  [ Stop repeating ]
```

- Frequency options: Weekly, Every 2 weeks, Every 3 weeks, Monthly.
- For weekly, show day-of-week checkboxes (Mon/Tue/Wed/Thu/Fri/Sat/Sun). Default to the start date's day.
- For monthly, show "on day" (e.g., "3rd Monday") or "on date" (e.g., "on the 17th").
- Human-readable summary always visible below the form: "Every Monday and Wednesday at 7:00 PM, starting August 17, 2026, ending after 10 occurrences."
- A "Stop repeating" link resets to "Does not repeat."

### Editing Recurring Events

When the admin clicks "Edit" on a recurring event from the AdminEventsTable, a modal appears:

```
This event is part of a recurring series.
Edit:

○ This event only
   Change just this occurrence (e.g., a one-off venue swap).

● This and future events
   Change this event and all upcoming occurrences.
   Past events are not affected.

○ Entire series
   Change every occurrence, past and future.

[ Cancel ] [ Continue → ]
```

**Design note:** This is not a confirmation dialog — it is the first step of the edit flow. The admin selects the scope, and then the form opens with that scope pre-selected in a subtle badge. Changes to the date/time/venue affect the selected scope. Changes to the metadata (title, description, pricing) also affect the selected scope. If "Entire series" is selected, all occurrences inherit the new values.

**Data model recommendation:** See Database section below.

---

## 5. Location

### Current State

Free-text "Venue Name" and "Address" fields. No venue lookup or reuse.

### Proposed Design

```
Venue
─────────────────────────────────────────────────────────────────────

[ Search venues or enter a new one...             ]

Recent venues:
The Anchor           Charlestown Naval Shipyard
Havana Club          288 Green St, Cambridge, MA
Salsa con Todo       100 Market St, Somerville, MA

+ Add new venue: "Salsa on the Harbor"

[ Use this venue ]  [ Cancel ]
```

- Search dropdown with typeahead.
- Selecting an existing venue auto-fills the address field (read-only by default, editable for event-specific adjustments).
- "+ Add new venue" creates a new venue record that is saved to a `venues` table for future reuse.
- Display a small static map thumbnail (320×180) with a pin when an address is provided. Not a full interactive map — just visual confirmation. Use a static maps API or a simple inline SVG if no API key is available.
- Store `venue_id` (FK) on the event. The `location` and `address` columns on the event can be denormalized from the venue for search/filter, but the canonical source is the venues table.

### Database Recommendation

Create a `venues` table:

```sql
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  state text,
  zip_code text,
  country text default 'US',
  latitude numeric,
  longitude numeric,
  created_at timestamp with time zone default now(),
  created_by uuid references auth.users,
  unique(name, city)
);
```

---

## 6. Pricing

### Current State

A single toggle: "free" or "paid". If paid, one `price_amount` field. No tier support.

### Proposed Design — Flexible Price Options

```
Pricing
─────────────────────────────────────────────────────────────────────

○ Free event

● Paid event

  Price options:

  General Admission       $15.00
  Lesson + Social         $20.00
  Social Only             $10.00
  Student Price           $8.00

  + Add price option

  [ Label ] [  Amount  ] [ Remove ]
  [ ________ ] [ $____ ] [  ✕  ]
```

- Start with "Free" selected by default (most SalsaSegura events are free).
- When "Paid" is selected, reveal a table of price options.
- Pre-populate with the common set: General Admission, Lesson + Social, Social Only, Student Price. Admin can remove any.
- "+ Add price option" adds a blank row: `[ Label ______ ] [ $ Amount ] [ Remove ]`
- Each row has a delete button (✕).
- Currency is always USD (enforced by business rule).

### RSVP / Event Link

Remains at the bottom of the Pricing section:

```
RSVP / Event Link
[ https://... ]
```

### Database Recommendation

Replace the two columns `price_type` and `price_amount` with a child table:

```sql
create table public.event_price_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events not null,
  label text not null,           -- e.g., "General Admission", "Student"
  amount numeric(10,2) not null,
  display_order int default 0,
  created_at timestamp with time zone default now(),
  unique(event_id, label)
);
create index on public.event_price_options (event_id);
```

**Rationale:** This supports arbitrary pricing tiers without schema migrations. The `price_type` column ("free" / "paid") can be derived: if there are price options and the total is $0, it's "free"; otherwise "paid." This is a **Recommended Now** change because the current single-price model is too restrictive for the "Lesson + Social" / "Student" use case that is common in dance events.

---

## 7. Organizer & Contact

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Organizer | Searchable select | Recommended | Links to a `organizers` table |
| Host | Text input | Recommended | Free-text backup for events without a registered organizer |
| Contact Email | Email input | Recommended (for paid events) | |
| Instagram | Text input | Optional | @handle format |
| Website | URL input | Optional | |

### Organizer Search

```
Organizer
─────────────────────────────────────────────────────────────────────

[ Search organizers...              ]

Sabor Latino Boston     saborlatino@example.com
Boston Salsa Society   bostonsalsa@example.com
DJ Mambo                dj@mambo.com

+ Create organizer: "New Organizers LLC"

[ Use "Sabor Latino Boston" ]  [ Create new ]  [ Cancel ]
```

### Magic-Link Submitter Consideration (Section 22)

For user-submitted events, the admin form should show:

```
Submitted by
─────────────────────────────────────────────────────────────────────

Guest Submitter
Verified email ✓  ui-refresh-verify@salsasegura.test
(user has no SalsaSegura profile)
```

This information is shown only in the admin view and is not editable from the event form. The submitter can only be changed via a dedicated user-management flow (Phase 5).

**Recommendation:** Keep `submitter_id` (FK to `auth.users`) and `submitter_name` (for guest submissions) as separate columns. The admin form reads `submitter_id` to determine if the user has a profile and displays accordingly.

### Database Recommendation

Create an `organizers` table:

```sql
create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  instagram text,
  website text,
  is_user boolean default false,  -- true if linked to auth.users
  user_id uuid references auth.users,
  created_at timestamp with time zone default now(),
  unique(name)
);
create table public.event_organizers (
  event_id uuid references events not null,
  organizer_id uuid references organizers not null,
  role text default 'organizer',  -- organizer, co-host, promoter
  primary key (event_id, organizer_id)
);
```

This supports multiple organizers per event (e.g., a studio co-hosting with a promoter).

---

## 8. Media

### Current State

A single `image_url` text field with live preview. No gallery support (the `gallery` column exists but is not used in the form).

### Proposed Design — Drag, Drop, Preview, Reorder

```
Media
─────────────────────────────────────────────────────────────────────

Primary Image
This image appears on event cards, search results, and the event detail page.
Recommended: 1200×630px (1.91:1 ratio)

┌────────────────────────────────────────────────────┐
│  [ Drag & drop image, or click to browse ]          │
│  ✓ Current: https://example.com/image.jpg           │
│  [ Preview thumbnail with ✕ Remove ]                 │
└────────────────────────────────────────────────────┘

Flyer (PDF)
[ Drag & drop flyer, or click to browse ]
✓ Current: flyer.pdf  [ Download ] [ Remove ]

Gallery
Drag and drop to reorder. Click ✕ to remove.

┌─────┐ ┌─────┐ ┌─────┐ ┌───┐
│ Img │ │ Img │ │ Img │ │+  │
│     │ │     │ │     │ │   │
└─────┘ └─────┘ └─────┘ └───┘
```

### Image Requirements

- **Primary Image**: 1200×630px recommended (1.91:1, standard for Facebook/Twitter social preview). Auto-crop if a different ratio is uploaded. Show aspect-ratio guidance visually (a faint overlay on the preview).
- **Flyer**: Accept PDF or image. Display as a "download" link rather than an in-form preview.
- **Gallery**: 1920×1080 or 4:3 recommended. Drag-to-reorder. Maximum 12 images.

### Upload UX

- Use native `<input type="file" multiple>` with drag-and-drop wrapper.
- Images are uploaded to Supabase Storage with a deterministic path: `events/<event_id>/<filename>`.
- Show upload progress as a percentage bar.
- No manual resizing — the backend should auto-generate thumbnails via a Supabase edge function or a resize-on-request CDN URL.
- If no image is provided, fall back to a placeholder with the event title on the default venue background color.

### Database Recommendation

Create an `event_media` table:

```sql
create table public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events not null,
  type text check (type in ('primary_image', 'flyer', 'gallery')) not null,
  storage_path text not null,
  sort_order int default 0,
  alt_text text,
  created_at timestamp with time zone default now(),
  unique(event_id, type, sort_order)
);
create index on public.event_media (event_id);
create index on public.event_media (event_id, type);
```

This replaces the single `image_url` (text) and `gallery` (text[]?) columns with a proper relational structure that supports alt text, ordering, and multiple media types. This is a **Recommended Now** change because the current `image_url` column cannot support a gallery, and the `gallery` column type is ambiguous.

---

## 9. Publishing

### Current State

No publishing controls in the admin event form. `AdminEventsPage` has row-level status actions (Publish, Unpublish, Archive, etc.) but the form itself just creates/updates the event row.

### Proposed Design

The "Publishing" section is the last section in the form:

```
Publishing
─────────────────────────────────────────────────────────────────────

Status
This event is currently: Draft
──────────────────────────────────

○ Draft
● Pending Approval
○ Published
○ Rejected
○ Cancelled
○ Archived

Visibility
○ Public
● Unlisted  (temporarily hidden from public calendar)

Featured Event
[ ] Give this event additional prominence on SalsaSegura.
    Featured events appear in the homepage carousel and
    are highlighted with a gold badge.

Scheduled Publish
○ Publish immediately
● Publish on [ Aug 20, 2026 at 10:00 AM ]

Published at
August 17, 2026 at 8:00 PM  [ Change ]
```

### Status Model

The existing 6 statuses are correct: `draft | pending | approved | rejected | cancelled | archived`.

For admin-created events, the workflow is simplified:
- **New event**: Starts as `draft`. Admin can click "Publish" or "Publish on date."
- **Existing event**: Shows current status. The admin can change it to any other status.

Key UI rules:
- `draft` → `approved` = "Publish" (the primary action)
- `pending` → `approved` = "Approve" 
- `approved` → `draft` = "Unpublish"
- `approved` → `cancelled` = "Cancel Event" (opens a confirmation dialog with a reason field)
- `approved` → `archived` = "Archive" (soft-hide, removes from active calendar but keeps URL)
- `cancelled` → `approved` = "Restore"

### Visibility

**Recommendation: implement only two states — Public and Unlisted.** The current codebase has no visibility concept. Adding it as a simple boolean `is_unlisted` on the events table is a **Recommended Later** change. For now, all approved events are public.

### Featured

A simple toggle. Stored as `boolean featured` (or a nullable timestamp `featured_at` to track when it was set, useful for "recently featured" sorting).

**Database recommendation:** Add `featured_at timestamp with time zone` to the events table. If non-null, the event is featured. This is better than a boolean because it enables time-based sorting of featured events (e.g., "most recently featured first").

### Scheduled Publishing

When the admin sets a future publish date, the event is stored with `status = 'draft'` and `publish_at = '<future time>'`. A background job (cron) checks for events where `publish_at <= now()` and promotes them to `approved`. This is a **Recommended Later** feature.

---

## 10. Sticky Action Bar

### Current State

The form has a single action bar at the bottom:

```
[ Create event ] [ Cancel ]
```

### Proposed Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  Auto-saved draft                                                    │
├─────────────────────────────────────────────────────────────────────┤
│  [ Save Draft ]  [ Preview ]  [ Publish ]                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Desktop

- Fixed to the bottom of the viewport.
- Contains: **Save Draft**, **Preview**, **Publish** (primary, red-filled).
- Shows a status indicator on the left: "Saved" / "Saving..." / "Unsaved changes" / "Save failed".
- Secondary actions (Cancel Event, Archive, Delete) are in a dropdown menu triggered by a "⋯" (kebab) icon on the right side.

### Mobile (bottom bar)

```
┌──────────────────────────────────────────────────────────┐
│ Preview                    Save    Publish                │
└──────────────────────────────────────────────────────────┘
```

- Buttons are larger (48px touch targets).
- "Preview" is a text link (ghost button).
- "Save" is the secondary action.
- "Publish" is the primary action, full-width or right-aligned.

### Auto-save Behavior

**Recommendation: Autosave drafts as the admin types, but publishing requires an explicit click.**

- Every 1.5 seconds after the last keystroke, save the current form state as a local storage snapshot.
- Every 10 seconds, if there are unsaved changes, attempt a background mutation to save as `status = 'draft'`.
- If a background save fails, show "Save failed — Retry" in the status indicator.
- Show "Unsaved changes" only between the last keystroke and the first successful autosave.
- "Publish" is always an explicit button — never triggered by autosave.

This eliminates the "I filled out a form for 10 minutes and lost it" scenario while keeping publishing safe and intentional.

---

## 11. Preview

### Recommended Approach: New browser tab (same-origin, no auth exposure)

When the admin clicks "Preview":

1. The current form state is serialized to Base64 and appended as a query parameter: `/calendar/event/preview?data=BASE64_ENCODED_JSON`.
2. The CalendarPage component checks for the `preview` query param. If present, it renders the event data from the param instead of fetching from the API.
3. The preview tab opens in a new browser tab via `window.open()`.

**Why not a modal or side panel?** The event detail page is complex (calendar widget, RSVP flow, image gallery, structured data). A modal would be cramped. A side panel would require duplicating the full detail layout at reduced size. A new tab gives the admin a realistic preview of exactly what users see.

**Why not a dedicated route?** A dedicated `/preview/events/:id` route would require the event to exist in the database first. For a new event that hasn't been saved, this doesn't work. The query-param approach handles both new and existing events.

**Unsaved changes protection:** Since the preview opens in a new tab and the form state is passed via query param, the original tab is unaffected. The admin can close the preview tab and return to the form.

---

## 12. Validation

### Strategy: Inline + Summary

**Inline validation** fires on blur (not on keystroke) for each field:

```
Event Name *
┌────────────────────────────────────────────┐
│                                        ✕  │
│ This field is required.                    │
│ (or "Must be 120 characters or fewer.")    │
└────────────────────────────────────────────┘
```

Inline errors appear below the field in the brand's error red (`#e11d48`), with an icon (✕ or ⚠).

**Summary validation** fires on Publish:

```
This event isn't ready to publish.
3 items need attention:

• Event Name is required         [ Fix ]
• Date is required               [ Fix ]
• At least one Dance Style must be selected  [ Fix ]

[ Cancel ] [ Fix all ]
```

Clicking "Fix" scrolls to the relevant field and focuses it. Clicking "Fix all" cycles through each error in order.

### Required Fields to Publish

| Field | Rule |
|-------|------|
| Event Name | Non-empty, ≤120 chars |
| Event Type | Must be selected |
| Date | Must be selected |
| Start Time | Must be selected |
| Dance Styles | At least 1 selected |
| Price Type | Must be "free" or "paid" |
| Venue | Non-empty |

Optional fields (recommended but not blocking): Short Description, Full Description, Host, Image, Contact Email, RSVP Link.

---

## 13. Required vs. Recommended Field Strategy

### Visual Treatment

Use a subtle completeness indicator at the top of the form:

```
Event quality  ██████████░░ 80%
2 recommended details missing: Flyer, Student Price
```

- The progress bar uses the gold accent color.
- "Recommended" field labels are not marked with `*` (required fields use `*`).
- The completeness score counts: required fields present (40%) + recommended fields present (40%) + media present (20%).

### Color Coding

- **Required fields**: Label ends with `*` (asterisk), always visible.
- **Recommended fields**: Label ends with `⋆` (small star), visible on hover or always subtle.
- **Optional fields**: No marker.

### On Publish

If required fields are missing → block publish, show summary (Section 12).
If recommended fields are missing → show a confirmation: "This event is missing a flyer and student pricing. Publish anyway?"

---

## 14. Published Event Editing

### Current State

The `AdminEventsTable` has a row action "Edit" that pushes `?edit=<id>` into the URL. `AdminEventsPage` resolves this and switches to edit mode, pre-filling the form via `buildAdminFormFromEvent`. There is no visual indication that the event is already published.

### Proposed Design

When editing a published event, the page header shows a status bar above the form:

```
← Events   Edit Event
─────────────────────────────────────────────────────────────────────
Published  Currently visible on SalsaSegura
─────────────────────────────────────────────────────────────────────
```

- "Published" is shown in the gold accent with a checkmark icon.
- "Currently visible on SalsaSegura" is in muted text.
- If the event was published X time ago, add: "Published 3 days ago".

### Edit Impact Communication

Below the status bar:

```
Editing a published event
─────────────────────────────────────────────────────────────────────
Changes to date, time, venue, or cancellation will be immediately
visible to attendees on the calendar. Typo corrections to title and
description are safe to save freely.

[ I understand ]  (checkbox, required before saving)
```

- This checkbox appears only for admin-created events that are already in `approved` status.
- Checking it once per session dismisses it for subsequent saves in the same editing session.
- The "Cancel Event" action is in the secondary actions menu (kebab), not the primary save bar.

### Cancellation Flow

From the kebab menu: "Cancel Event" → opens `AdminConfirmDialog` with:

```
Cancel "Friday Night Salsa Social"
────────────────────────────────────────────────
This will mark the event as CANCELLED. Attendees who have RSVP'd
will need to be notified separately.

Cancellation reason
[ Event cancelled by organizer         ]
(placeholder: "Weather closure", "Venue issue", etc.)

☐ Show cancellation notice publicly

[ Cancel ] [ Cancel Event ]
```

A cancelled event retains its full detail page at the original URL, with a prominent "CANCELLED" banner in red.

---

## 15. Recurring-Series Editing (Detail)

### When Editing a Recurring Event

The edit page header shows:

```
← Events   Edit Event
─────────────────────────────────────────────────────────────────────
Recurring series  24 occurrences
─────────────────────────────────────────────────────────────────────
```

Clicking "24 occurrences" opens a read-only panel showing the full recurrence pattern and a mini-calendar of upcoming dates.

### Scope Selection

Immediately below the header, a banner:

```
This event is part of a recurring series.
You are editing:  ○ This event  ● This and future  ○ Entire series
[ Change scope ]
```

- "This and future" is the default (most common use case: fixing the rest of the season).
- "This event only" is for one-off exceptions.
- "Entire series" requires an explicit confirmation click because it affects past data.

### Data Model Recommendation

**Recommended Now:** Replace the single `recurrence` text column with a structured approach:

```sql
-- A recurring series record (one row per pattern, not per occurrence)
create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  title text not null,        -- "Friday Night Salsa Social"
  event_template uuid references events,  -- template event with shared fields
  frequency text check (frequency in ('weekly', 'every_2_weeks', 'every_3_weeks', 'monthly')),
  interval_weeks int default 1,
  by_day int[],               -- array of ISO weekday numbers (1=Mon, 7=Sun)
  by_month_day int,           -- for monthly: day of month (1-31)
  by_month_weekday int,       -- for monthly: Nth weekday (1-4, 5=last)
  end_type text check (end_type in ('never', 'after', 'on_date')),
  end_after_count int,        -- end_type = 'after'
  end_date date,              -- end_type = 'on_date'
  created_at timestamp with time zone default now(),
  created_by uuid references auth.users
);

-- Occurrences (one row per date in the series)
-- The existing events table gains a series_id FK
alter table public.events add column series_id uuid references event_series;
alter table public.events add column is_exception boolean default false;
```

Each occurrence is a real row in the `events` table. When the admin edits "This and future", a new `event_series` entry is created (or the existing one updated), and all future occurrences are regenerated. When they edit "This event only", the occurrence row is updated and `is_exception = true` is set.

This approach:
- Keeps the existing events table as the source of truth for rendering (Schedule-X calendar reads individual occurrence rows).
- Makes recurring queries simple (just filter by `series_id`).
- Supports exceptions (a single changed occurrence doesn't break the pattern).
- Allows the existing `duplicateEvent` function to copy the `series_id`.

**Migration note:** The current `recurrence = "weekly"` column can be migrated to `frequency = 'weekly', interval_weeks = 1, end_type = 'never'` with a one-time script.

---

## 16. Tablet UX

Tablet (768px–1024px) behavior:

- The side navigation becomes a **horizontal tab bar** at the top of the form (instead of a vertical rail).
- Sections remain vertically stacked below the tab bar.
- Tapping a tab label scrolls smoothly to that section.
- The sticky action bar remains at the bottom.
- Date/time pickers use native pickers (large touch targets).
- Image upload uses the native file picker (iOS/Android photo library or camera).

At 1024px+, the layout switches from the 2-column tab+content to the full 2-column side-nav + content layout (as shown in the wireframe above).

---

## 17. Mobile UX (Phone < 768px)

### Layout

- No side navigation. Instead, a sticky header bar with the form title and a "Sections" dropdown (replaces the nav rail).
- Each section is a full-width card with a header that can be tapped to collapse.
- The action bar is a sticky bottom bar:

```
┌──────────────────────────────────────────────────────────┐
│ Preview                    Save    Publish                │
└──────────────────────────────────────────────────────────┘
```

### Field Adaptations

- Date picker → native `type="date"` (browser calendar widget).
- Time picker → native `type="time"`.
- Select dropdowns → native mobile `<select>` (full-screen picker on iOS).
- Dance styles → full-width chips, tap to toggle.
- Image upload → native file picker with `accept="image/*"` and `capture="environment"` for phone camera.
- Venue search → native search input with typeahead (filtered list).

### Emergency Corrections

For a phone user who needs to quickly fix a typo on a live event:
1. Open `/admin/events?edit=<id>` — the form loads pre-filled.
2. Scroll to the relevant section (sections are collapsible, so the page is short).
3. Make the edit.
4. The bottom bar "Save" button is always visible.

---

## 18. Accessibility

### Established Patterns in Codebase

The existing codebase already implements several good accessibility patterns:
- `useEscapeKey` for closing modals (used in `AdminActionMenu` and `EventModal`).
- Focus management with `ref` in `AdminConfirmDialog` (focuses the confirm button on open, returns focus to the trigger on close).
- `aria-pressed`, `aria-haspopup`, `aria-expanded` in the action menu and filter buttons.
- Focus-visible styles in `global.css`.

### Recommendations for the Form

- Every input has a persistent `<label>` (not a placeholder as label).
- All form sections use `<fieldset>` + `<legend>` for semantic grouping.
- Errors are associated with fields via `aria-describedby`.
- The dance-style chips are real `<button type="button">` elements with `aria-pressed` (not custom divs).
- Required fields use `aria-required="true"` in addition to the visual `*` marker.
- Native date/time inputs are used for mobile accessibility.
- The recurrence editor supports full keyboard navigation (arrow keys to toggle days, Enter to select frequency).
- The venue search has `role="combobox"` + `aria-autocomplete="list"` + `aria-expanded`.
- Color is never the only indicator: validation errors use both red text and an icon (⚠).
- Focus is not trapped in collapsible sections — the admin can Tab through the entire form.
- The sticky action bar is not in the tab order when collapsed (uses `aria-hidden`).

---

## 19. Database Adjustments — Categorized

### Recommended Now (implement in Phase 4 / Phase 5 migration)

| Change | Table / Column | Rationale |
|--------|----------------|-----------|
| `event_series` table | new | Enables proper recurring event UX (scope-limited edits, exceptions) |
| `venues` table | new | Eliminates repeated venue entry; auto-fills address |
| `event_price_options` table | new | Supports flexible pricing tiers (lesson+social, student, etc.) |
| `event_media` table | new | Replaces single `image_url` with gallery + flyer + alt text support |
| `series_id` + `is_exception` columns | `events` | Links occurrences to their series |
| `featured_at` column | `events` | Tracks when an event was featured (for time-based sorting) |
| `published_at` column | `events` | Tracks when an event was published (for "published 3 days ago" display) |

### Recommended Later (Phase 5+)

| Change | Table / Column | Rationale |
|--------|----------------|-----------|
| `visibility` column | `events` | Supports "Unlisted" events; only needed if feature is actually used |
| `publish_at` column | `events` | Supports scheduled publishing; needs a cron job to process |
| `organizers` table | new | Supports organizer profiles/reuse; can be added incrementally |
| `event_organizers` junction | new | Supports multiple organizers per event |
| `event_schedule_details` JSON column | `events` | Stores doors_open, lesson_start, social_start; low priority |
| `tags` table + `event_tags` junction | new | For categorizing events beyond dance styles |

### Unnecessary

| Change | Reason |
|--------|--------|
| Per-event timezone field | Both cities are in `America/New_York`; timezone is implicit at the city level |
| Separate `flyer_url` column | Can be inferred from the first `event_media` row of type `flyer` |
| Per-user draft autosave table | Local storage suffices for autosave; no DB needed for draft snapshots |

---

## 20. Final Desktop Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Events                                                            [Saved] │
│                                                                             │
│ Create Event                                                                │
│ Add a new event to the SalsaSegura calendar.                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ BASIC INFO  SCHEDULE  LOCATION  PRICING  ORGANIZER  MEDIA  PUBLISHING       │
│ ────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ Event Name *                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Friday Night Salsa Social                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Short Description                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Weekly salsa social with live band                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Description                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Join us every Friday for salsa dancing...                               │ │
│ │                                                                         │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Dance Styles (required)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [ Salsa × ] [ Bachata × ] [ Kizomba × ]  + Add                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Event Type                                                                  │
│ ┌──────────────────────┐                                                    │
│ │ Social Dance    ▼   │                                                    │
│ └──────────────────────┘                                                    │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ SCHEDULE                                                                    │
│                                                                             │
│ Date *       Start *       End                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                                      │
│ │ Aug 17   │ │ 6:00 PM  │ │ 9:00 PM  │                                      │
│ └──────────┘ └──────────┘ └──────────┘                                      │
│                                                                             │
│ Repeats                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ○ Does not repeat                                                       │ │
│ │ ● Repeats                                                               │ │
│ │                                                                         │ │
│ │   Frequency: [ Every 1 week ]                                          │ │
│ │   On: [● Mon] [● Wed] [● Fri]                                          │ │
│ │   Ends: [ Never ]                                                     │ │
│ │                                                                         │ │
│ │   Every Mon, Wed, Fri at 7:00 PM                                        │ │
│ │   starting Aug 17, 2026, ending never                                │ │
│ │   [ Stop repeating ]                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ LOCATION                                                                    │
│                                                                             │
│ Venue                                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [ Search venues...          ]                                          │ │
│ │                                                                         │ │
│ │ Havana Club        288 Green St, Cambridge, MA                        │ │
│ │ Salsa con Todo     100 Market St, Somerville, MA                     │ │
│ │                                                                         │ │
│ │ + Add new: "Salsa on the Harbor"                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Address (auto-filled from venue)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 288 Green St, Cambridge, MA                                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ PRICING                                                                     │
│                                                                             │
│ ○ Free event                                                                │
│ ● Paid event                                                                │
│                                                                             │
│   General Admission       $15.00  [✕]                                      │
│   Lesson + Social         $20.00  [✕]                                      │
│   Social Only             $10.00  [✕]                                      │
│   Student Price            $8.00  [✕]                                      │
│                                                                             │
│   [ Label ] [  Amount  ] [ Remove ]                                         │
│                                                                             │
│   + Add price option                                                       │
│                                                                             │
│   RSVP / Event Link                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────┐ │
│   │ https://example.com/rsvp                                              │ │
│   └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ ORGANIZER & CONTACT                                                         │
│                                                                             │
│ Organizer                                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [ Search organizers... ]                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Host                                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Sabor Latino Boston                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Contact Email     Instagram      Website                                    │
│ ┌────────────┐   ┌──────────┐   ┌────────────────────┐                    │
│ │ host@ex... │   │ @saborb  │   │ https://saborb.com │                    │
│ └────────────┘   └──────────┘   └────────────────────┘                    │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ MEDIA                                                                       │
│                                                                             │
│ Primary Image                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [ Drag & drop image or click to browse ]                                │ │
│ │ ✓ https://example.com/salsa-anchor.jpg                                  │ │
│ │ [ Preview: 1200×630 thumbnail ] [ Remove ]                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Gallery                                                                     │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌───┐                                              │
│ │ Img │ │ Img │ │ Img │ │+  │                                              │
│ └─────┘ └─────┘ └─────┘ └───┘                                              │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ PUBLISHING                                                                  │
│                                                                             │
│ Status                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Published    ▼                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Visibility                                                                    │
│ ○ Public  ● Unlisted                                                          │
│                                                                             │
│ Featured Event                                                              │
│ [ ] Give this event prominent placement                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
Saved  ·  Save Draft  ·  Preview  ·  Publish                               [⋯]
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 21. Edit Event (Published Event) Wireframe

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Events                                                            [Saved] │
│                                                                             │
│ Edit Event                                                                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Published  Currently visible on SalsaSegura                                │
│ Published 3 days ago                                                        │
│                                                                             │
│ Editing a published event                                                   │
│ Changes to date, time, venue, or cancellation will be immediately           │
│ visible to attendees. Typo corrections to title and description             │
│ are safe to save freely.                                                    │
│ [✓] I understand                                                           │
│                                                                             │
│ Recurring series  24 occurrences                                            │
│ You are editing: [ This and future events ▼ ]                              │
│                                                                             │
│ (same section layout as Create)                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
[ Save Draft ]  [ Preview ]  [ Publish ]                                        [⋯]
  (kebab: Cancel Event, Archive, Delete)
```

---

## Summary of Key Design Decisions

1. **Section-based form with sticky side nav** — not tabs (need field visibility), not wizard (need non-linear flow), not plain scroll (need section navigation).
2. **Flexible pricing table** — replaces the single free/paid toggle; supports common dance-event pricing tiers.
3. **Venue reuse via searchable dropdown** — eliminates repeated address entry; venues table added.
4. **Autosave drafts in background** — but Publishing is always an explicit action.
5. **Recurring events use occurrence rows** — each date is a real event row; edits can target this event, this-and-future, or entire series.
6. **Published event editing** — communicates the editing context and requires acknowledgment before saving changes to live event details.
7. **Preview in a new tab** — passes form state via URL param; never loses work in the original tab.
8. **Mobile-first** — bottom action bar, native date/time pickers, full-width cards.
9. **Accessibility-first** — all existing codebase patterns (ESLint, FocusVisible, ARIA) extended to the new form components.

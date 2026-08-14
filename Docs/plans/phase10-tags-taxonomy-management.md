# Phase 10 — Tags & Taxonomy Management UX/UI

> **Design spec for the SalsaSegura Admin Dashboard** — the controlled event-classification feature.
> This document is the spec only; no application or production SQL changes follow until approved.

## 1. Context

SalsaSegura must classify events with controlled, canonical values rather than free-form strings. The admin must manage dance styles and event attributes; understand each value's usage; safely archive, delete, or merge values; and prevent capitalization-only or synonym duplicates. This phase implements only `/admin/tags`, `/admin/tags/new`, and `/admin/tags/:id`; it does not move into Settings, public landing pages, organizer taxonomy, or other later phases.

## 2. Grounded state of the codebase

| Existing state or pattern | File | Phase 10 decision |
|---|---|---|
| `events.dance_styles` is an unconstrained `text[]` | `supabase/migrations/20260814000000_events_management_fields.sql` | Replace it during this phase with normalized term relationships. No dual storage contract remains. |
| The event editor hard-codes seven dance-style checkboxes | `src/components/Admin/AdminEventForm.tsx` | Replace with active terms loaded from taxonomy data. |
| `event_type` is a required `social` / `class` / `workshop` select | `src/components/Admin/AdminEventForm.tsx`, `src/features/events/model/types.ts` | Retain it as a direct controlled field; it remains mutually exclusive and drives Calendar scheduling. |
| `eventsRepo.ts` owns event-table access | `src/features/events/api/eventsRepo.ts` | Taxonomy gets a feature-local repository; components and hooks never query Supabase directly. |
| Event tables have a desktop-table/mobile-card pattern | `src/components/Admin/AdminEventsTable.tsx` | Use the same dual-layout strategy for taxonomy terms. |
| Toolbar, URL state, filter chips, and filter drawer are established | `src/pages/AdminUsersPage.tsx`, `src/components/Admin/AdminUsersToolbar.tsx`, `src/components/Admin/AdminUsersFilterDrawer.tsx` | Reuse this interaction model for search, filters, views, sort, and pagination. |
| Row actions are centralized | `src/components/Admin/AdminActionMenu.tsx` | Use the established menu for edit, archive, restore, merge, and eligible delete actions. |
| Existing confirmation dialog supports danger/neutral intent | `src/components/Admin/AdminConfirmDialog.tsx` | Use it for archive/delete; create a focused merge dialog using the same consequence-copy conventions. |
| Admin shell has isolated theme tokens and responsive navigation | `src/styles/admin.css`, `src/layouts/AdminLayout.tsx` | All new UI stays inside `.admin-shell`, supports system/light/dark, and updates the Tags navigation route and breadcrumb label. |
| `AdminSidebar` exposes Tags as deliberately unbuilt | `src/components/Admin/AdminSidebar.tsx` | Flip it to a real route only with the Phase 10 pages. |
| The admin event form provides validated fieldsets and error banner patterns | `src/components/Admin/AdminEventForm.tsx` | Reuse for create/edit term forms. |

### Core architecture decision

Use one typed `taxonomy_terms` table plus `event_taxonomy_terms` relationships. `taxonomy_terms.category` differentiates concepts with shared lifecycle behavior; the UI applies category-specific wording and selection rules. The application does not use a generic free-form tag bucket.

| Option | Cost | Ripple | Decision |
|---|---|---|---|
| Flat `tags` table | Small initial UI | Category behavior, ordering, hierarchy, and SEO policy become weak conventions | Reject |
| Typed terms plus generic event join | One reusable data path and category-aware UI | Migrates `dance_styles` once, then supports attributes cleanly | **Adopt** |
| Separate tables per concept | Repeats schema, repositories, UI, moderation, and filtering paths | More rigidity than current product needs | Reject |

**Event type stays direct.** It is required, exclusive, and used by Calendar behavior. It is not a taxonomy category.

## 3. Taxonomy strategy

### Categories in Phase 10

| Category | Machine value | Event cardinality | Initial values |
|---|---|---:|---|
| Dance Styles | `dance_style` | Many per event | Salsa, Bachata, Merengue, Cha-Cha, Kizomba, Zouk, Afro-Cuban |
| Event Attributes | `event_attribute` | Many per event | Beginner Friendly, Outdoor, Live Music, DJ, Free, Lesson Included, Social Dancing |

The category is selected when a term is created and cannot be changed after the term receives usage. Changing it could alter editor semantics and public meaning. Unused terms may change category only through an explicit confirmation.

### Canonicalization

- Name is human-facing canonical text.
- `normalized_name` derives from a Unicode-normalized, trimmed, case-folded name; it is database-unique within each category.
- Slug is generated from the initial name but may be edited before first save. After save, label edits never auto-change it.
- Slug is globally unique, which preserves a future public URL namespace without ambiguous routing.
- Similarity matching may suggest duplicate candidates but never merges or changes data automatically.

## 4. Management page — `/admin/tags`

### Default table

The default is an ungrouped, compact table sorted by category then `display_order`. This makes cross-category cleanup and search reliable; category tabs supply the focused workflow without hiding other values.

| Column | Behavior |
|---|---|
| Name | Canonical name; opens detail page |
| Category | Text label and icon; never color-only |
| Slug | Stable identifier; monospace or secondary treatment |
| Usage | Direct event count, announced as “Used by N events” |
| Status | Active, Needs Review, or Archived badge with text |
| Updated | Short formatted timestamp |
| Actions | Accessible `AdminActionMenu` |

Header: **Tags & Taxonomy**, helper text “Manage how SalsaSegura classifies events,” and **Add term** as the primary action.

### Search, filters, views, and URL state

- Debounced search (`q`) covers canonical name and slug.
- Category filter (`category`) and status filter (`status`) use controlled options.
- View tabs (`view`): All, Active, Dance Styles, Attributes, Unused, Needs Review, Archived.
- `Unused` means zero direct event relationships. It is a cleanup view, not the default.
- Active filters render removable chips and Clear all, following the existing admin-list convention.

### Mobile and tablet

At narrow widths, table rows become cards:

```text
Salsa                                      •••
Dance Style · Used by 42 events
Active · Updated Aug 13
```

Search, category filtering, and Add term remain directly reachable. Forms stack fields. Action menus retain touch-sized targets.

## 5. Create and edit term flows

### `/admin/tags/new`

Fields:

| Field | Required | Rule |
|---|---:|---|
| Name | Yes | Validated against normalized-name uniqueness within the selected category |
| Category | Yes | Dance Style or Event Attribute |
| Slug | Yes | Generated from name, editable before first save, globally unique |
| Description | No | Context for admins and possible future public pages |
| Display order | Yes | Numeric ordering; sensible category-local default |
| Status | Yes | Defaults to Active |

The form presents no parent selector in the MVP. The schema accepts a parent later, but inventing hierarchy controls before inventory requires them would add unneeded complexity.

### `/admin/tags/:id`

The edit page shows metadata, relationship context, and guarded administration:

```text
Salsa                                           Active
Dance Style

Slug: salsa
Description: Optional administrative description
Usage: Used by 42 events  [View events]
Created: …   Updated: …

Administration: Archive | Merge | Delete (only when unused)
```

Related-event navigation carries a term filter to the existing events list. The edit surface provides clear save/cancel and inline field errors. It does not silently repair values.

## 6. Usage, duplicate, merge, archive, and delete behavior

### Usage context

Before an admin can archive, merge, or delete, the detail page loads and states usage. Phase 10 reports direct event relationships. It will display organizer-profile or public-page references only after those relationships exist; zero-value placeholders are avoided.

### Duplicate detection

The app surfaces a candidate when terms share a category and have a similar normalized name, slug, or overlapping event use. Candidates show the reason and link to a comparison state. Text similarity is advisory—not an automatic merge rule.

### Merge workflow

1. Admin chooses the term to keep and the source term to merge.
2. The dialog displays exact category and count of source relationships moving to the survivor.
3. Confirmation performs one transaction: insert non-duplicate survivor relationships, remove source relationships, archive the source, and record an audit action.
4. Any transaction failure leaves both terms and all original relationships intact.

The source is never deleted as part of merge. The survivor's slug is preserved; source-slug redirects are deferred until public taxonomy pages exist.

### Lifecycle

| Action | Eligibility | Result |
|---|---|---|
| Archive | Any term after usage context loads | Remains on historical events; excluded from normal event entry; restorable by admins |
| Restore | Archived term | Returns to active event selection |
| Delete | Exactly zero references | Permanent removal after danger confirmation |
| Merge | Two distinct terms in the same category | Reassign relationships transactionally; archive source |

Numeric `display_order` is the Phase 10 ordering model. Accessible Move up/Move down controls may be provided within a category. Drag-and-drop is deferred because it adds a keyboard and touch interaction burden without operational necessity.

## 7. Event editor and submission moderation integration

### Event editor

`AdminEventForm` removes its hard-coded dance-style constant and string-array state. It renders active terms supplied by a taxonomy query:

- Dance styles: searchable, keyboard-operable multi-select.
- Event attributes: equivalent multi-select, shown as a distinct controlled group.
- Existing event relationships are loaded into selected term IDs.
- Save creates the event relationship set in the event mutation flow; no free-text dance-style or attribute value reaches the database.
- A missing-value escape hatch is admin-only and opens the Create Term workflow. It does not create a draft term silently.

### Submission moderation

Submission text remains historical source data. During moderation, the reviewer maps phrases such as “salsa on 2” to the canonical term `Salsa On2`; the original submitted string is never rewritten. Alias storage and automatic suggestions are later work, not hidden Phase 10 behavior.

## 8. SEO, hierarchy, accessibility, and theme

### SEO

Terms maintain stable slugs, canonical display names, optional descriptions, and lifecycle state so meaningful public taxonomy pages can be added later. Phase 10 creates no public taxonomy routes and never makes every term indexable. Public eligibility, canonical URLs, and redirect management remain later SEO work.

### Parent/child taxonomy

`parent_id` is nullable and self-referential at the data layer now. Phase 10 provides no hierarchy-management UI. This prepares a later Salsa → On1 / On2 / Cuban Casino taxonomy without forcing a workflow the current inventory does not need.

### Accessibility and theme

- New styling uses existing admin semantic tokens in Light, Dark, and System modes.
- Category and status always include textual labels, not just color.
- Search and multi-select controls are fully keyboard-operable.
- Merge and destructive dialogs trap focus, name their consequence, close on Escape, and return focus to the invoking control.
- Usage counts have meaningful accessible names.
- Desktop ordering controls have non-drag alternatives; drag-and-drop is not a Phase 10 requirement.

## 9. Database recommendation

### Recommended now

```text
taxonomy_terms
  id uuid primary key
  category text constrained to dance_style | event_attribute
  name text not null
  normalized_name text not null
  slug text not null
  description text null
  parent_id uuid null references taxonomy_terms(id)
  status text constrained to active | needs_review | archived
  display_order integer not null
  created_at timestamptz not null
  updated_at timestamptz not null

event_taxonomy_terms
  event_id uuid references events(id)
  taxonomy_term_id uuid references taxonomy_terms(id)
  primary key (event_id, taxonomy_term_id)
```

Constraints and indexes:

- Unique `(category, normalized_name)` prevents capitalization-only/canonical duplicates.
- Unique `slug` reserves a future stable public namespace.
- Composite primary key prevents duplicate event-term relationships.
- Indexes serve term usage counts and event filtering.
- `parent_id <> id` prevents a direct self-parent relation.
- `events.dance_styles` is migrated then removed only after deploy and manual validation.

### Recommended later

- Term aliases for moderator suggestions.
- Redirects when a public term URL can change.
- Organizer taxonomy relationships.
- Localized names/descriptions.
- Explicit SEO eligibility and public taxonomy pages.

### Avoid

- Free-form dance-style strings.
- A parallel legacy text-array path after the migration.
- Deleting referenced terms.
- Automatic merges based on strings alone.
- A meaningless catch-all tag category.

## 10. SQL deliverables and manual execution

The user manually reviews and runs SQL in production. SQL is therefore a reviewed deliverable, never an automatic deployment step. Phase 10 creates the following distinct files under `sql/phase-10/`:

| Order | File | Required | Expected result and safety |
|---:|---|---|---|
| 1 | `001_create_taxonomy_terms.sql` | Yes | Creates term schema, constraints, indexes, RLS/policies, and established audit integration where applicable. Additive, commented, and non-destructive. |
| 2 | `002_create_event_taxonomy_terms.sql` | Yes | Creates normalized event relationships with FK and duplicate protection. Additive and non-destructive. |
| 3 | `003_seed_taxonomy_terms.sql` | Yes | Inserts canonical Phase 10 dance styles and attributes idempotently. |
| 4 | `004_migrate_event_dance_styles.sql` | Yes | Maps known legacy array values to seeded terms, preserving every event relationship. Includes pre/post count queries. Does not drop the source column. |
| 5 | `005_remove_events_dance_styles.sql` | Optional, post-deploy | Removes the old array only after the deployed application and manual count validation confirm the clean cutover. Clearly destructive and never bundled with migration. |

Recommended execution order: **001 → 002 → 003 → 004 → application deployment → manual relationship-count and admin/event-editor validation → optional 005**.

Rollback boundary: before optional cleanup, application rollback can continue reading the existing source array only if the code deployment has not adopted the new contract. After the application cutover, rollback is by restoring a reviewed database backup or an explicit reverse migration that reconstructs the array; such a reverse migration must be reviewed separately rather than assumed safe.

**No Phase 10 SQL will be executed against production by this work.**

## 11. Verification strategy

- Model tests cover normalization, category constraints, slug behavior, archive/delete eligibility, and merge planning.
- Repository/query tests cover term fetching, usage counts, relationship persistence, and migration mapping assumptions.
- RTL tests cover list filters/views, form errors, loading/empty/error states, merge confirmation and focus behavior, and mobile-card semantics.
- Verification gates: affected Vitest suites, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and an actual browser smoke test of tags list/create/edit plus event term selection.

## 12. Final compact text wireframe

```text
┌────────────────────────────────────────────────────────────────┐
│ Tags & Taxonomy                                  + Add term    │
│ Manage how SalsaSegura classifies events.                       │
├────────────────────────────────────────────────────────────────┤
│ [ Search taxonomy… ] [ Category ▾ ] [ Status ▾ ]              │
│                                                                │
│ All  Active  Dance Styles  Attributes  Unused  Needs Review   │
│                                                                │
│ Name              Category       Usage       Status       ••• │
│ ────────────────────────────────────────────────────────────── │
│ Salsa             Dance Style   42 events   Active       ••• │
│ Bachata           Dance Style   31 events   Active       ••• │
│ Beginner Friendly Attribute     18 events   Active       ••• │
│ Outdoor           Attribute     10 events   Active       ••• │
└────────────────────────────────────────────────────────────────┘

Salsa                                                       Active
Dance Style

Slug: salsa
Description: …
Usage: Used by 42 events                              [View events]

ADMINISTRATION
[Archive]  [Merge]  [Delete disabled: 42 event references]
```

## 13. What this phase does not decide

- Settings IA or any other later admin phase.
- Public dance-style URLs, sitemap inclusion, redirects, or indexability policy.
- Alias suggestions or automatic submitted-text classification.
- Organizer-term relationships.
- A visual hierarchy editor or drag-and-drop ordering.
- New event types beyond the existing direct controlled field.

**This spec stops here. No implementation or production SQL execution occurs until the user approves it.**

# Moderator CSV Event Import — Design

**Status:** Approved (moderator write-access approach and partial-import policy confirmed by user)
**Related:** `scripts/import-ics.mjs` (existing, unrelated CLI-only importer — not touched), `Docs/superpowers/specs/2026-08-17-logo-integration-design.md` (prior spec in this series, same doc convention)

## Context

SalsaSegura has no CSV import today. Moderators currently create events one at a time via `AdminEventForm` (`/admin/events?new=1`), or approve public submissions one at a time via the review queue. Bulk historical import exists only as a CLI script (`scripts/import-ics.mjs`, run manually by a developer against an ICS feed, `--insert`/`--sql` flags) — not moderator-facing, not CSV, out of scope here.

## Grounded state of the codebase

| Fact | Evidence |
| --- | --- |
| Moderators have **zero** direct event-write access today | `supabase/migrations/20260812000000_admin_manage_events.sql`: `"Admins can insert events"` policy checks `role = 'admin'` only |
| ...but the UI already shows moderators a "Create Event" button that would fail | `AdminEventsPage.tsx` — no `isAdmin` gate around the button; nav item `roles: ["admin","moderator"]` |
| Event creation is a **direct RLS-gated table insert**, not an RPC | `eventsRepo.ts`: `createEventAsAdmin`/`updateEvent`/`deleteEvent`/`duplicateEvent` all call `supabase.from("events").insert/update/delete()` directly — unlike the admin_* read/aggregate RPCs (`admin_audit_log`, `admin_user_directory`, etc.), event writes never went through an RPC layer |
| `source_type: "imported"` already exists as a valid enum value, unused by any current UI path | `events_source_type_check` constraint (`20260814000000_events_management_fields.sql`); migration comment documents `import-ics.mjs` already uses this exact semantic via an `@import.local` email convention |
| Timezone-correct date/time conversion already exists and must be reused verbatim | `eventDateTime.ts`: `toEventDateInstant(date, time)` (`"YYYY-MM-DD"` + `"HH:MM"` → `America/New_York` wall-clock → UTC instant), `formatTimeLabel(time)` |
| Field length limits are enforced in application code, not DB constraints | `validation.ts` (`TITLE_MAX_LENGTH=120`, `DESCRIPTION_MAX_LENGTH=2000`, `OTHER_TEXT_MAX_LENGTH=300`, `DANCE_STYLES_MAX_COUNT=10`), `adminEventForm.ts` (`HOST_MAX_LENGTH=300`, `INSTAGRAM_MAX_LENGTH=100`), `AdminEventForm.tsx` (`IMAGE_URL_MAX_LENGTH=2000`) — CSV validation reuses these constants, doesn't invent new ones |
| DB enum CHECK constraints (final authority, unaffected by this feature) | `event_type in ('social','workshop','class')`, `price_type in ('free','paid')`, `city in ('boston','new-york-city')`, `status in (...)`, `source_type in (...)` |
| No `end_time` column exists anywhere in the schema | `DatabaseEvent`/`AdminEventPayload` — only `event_time` (start). Event duration is a fixed app-level constant elsewhere, not per-event. **Deviation from the brief's assumed schema** (which described start/end time validation) — the CSV template has no end-time column because the app has no end-time field to import into. |
| Venue linkage is a resolved FK (`venue_id`), with `location`/`address` free-text kept for backward compat | `AdminEventForm.tsx` (`useVenueCombobox`), `venuesRepo.ts` (`searchVenues` — fuzzy RPC-backed name search already built for the event form's venue combobox) |
| A duplicate-detection algorithm already exists (title/date/venue/host signal scoring), coupled to the submission-review shape | `src/features/admin/model/duplicates.ts` — reused as a *pattern*, not directly called (its `detectDuplicates` takes an `EventSubmission`, not a CSV row; forking ~30 lines of pure comparison logic is lower-risk than refactoring shared code out from under an already-shipped, tested feature) |
| No XSS surface via event fields | `grep dangerouslySetInnerHTML` → zero matches anywhere in `src/` — all event field rendering is plain JSX text interpolation (auto-escaped) |
| Text length limits are app-level, not DB CHECK constraints; DB enum CHECKs remain the final backstop | confirms brief's own instruction ("do not weaken existing database constraints") — nothing to weaken, nothing new to add there |

## Core decisions (confirmed)

1. **Moderator write access**: widen the existing `"Admins can insert events"` RLS policy to `role in ('admin','moderator')`. One SQL file, reuses the exact insert path CSV import uses, and fixes the pre-existing silently-broken "Create Event" button for moderators as a side effect (documented, not hidden).
2. **Partial import**: "Import Valid Events" imports only rows currently valid *and not flagged as a duplicate the moderator chose to skip*. Invalid rows are never attempted; they stay listed as errors for the moderator to fix and re-upload. Matches this app's existing per-item moderation workflow (nothing else here is all-or-nothing) and the brief's own results example (25 created / 2 skipped / 1 failed out of 28 — already assumes partial success).
3. **Insert mechanism**: reuse the direct-insert pattern (`supabase.from("events").insert([...])`, batched), not a new RPC — matches decision 1 and "do not create a parallel event model." A new RPC would be architecturally inconsistent with how every other event write in this app already works.
4. **Auditability**: reuse the existing per-row `audit_logs` trigger (already fires on every `events` insert, already captures `actor_id` from the real caller's JWT — SECURITY DEFINER isn't in play here since this is a direct insert, so `auth.uid()` is trivially correct) for per-event attribution. Add one small new table, `event_import_batches`, for *batch-level* summary metadata (filename, row counts, importer, timestamp) that per-row audit logs can't reconstruct on their own (a failed/skipped row never becomes an event, so it never gets an audit_logs entry). This matches the brief's own suggested `event_import_audit.sql` filename.

## CSV column specification

Reuses `AdminEventPayload` (the exact shape `createEventAsAdmin` already accepts) — no parallel schema.

| Column | Required | Type | Notes |
| --- | --- | --- | --- |
| `title` | **Required** | text, ≤120 chars | |
| `event_type` | **Required** | enum | `social` \| `class` \| `workshop` |
| `event_date` | **Required** | date | `YYYY-MM-DD` |
| `city` | **Required** | enum | `boston` \| `new-york-city` |
| `event_time` | optional | time | `HH:MM`, 24-hour. Blank → matches existing app default (midnight) |
| `description` | optional | text, ≤2000 chars | |
| `venue_name` | optional | text | Matched against existing venues via the same fuzzy search the event form's combobox uses (`searchVenues`). Unmatched → **warning**, not invalid; event still imports using `location`/`address` below. Never auto-creates a venue. |
| `location` | optional | text, ≤300 chars | Free-text venue name, kept regardless of `venue_name` match (backward-compat column, same as manual entry) |
| `address` | optional | text, ≤300 chars | |
| `price_type` | optional | enum | `free` \| `paid` \| blank |
| `price_amount` | required if `price_type=paid` | decimal | |
| `rsvp_link` | optional | URL, ≤300 chars | must be `http(s)://` |
| `host` | optional | text, ≤300 chars | |
| `image_url` | optional | URL, ≤2000 chars | |
| `recurrence` | optional | enum | `weekly` \| blank (only value the schema supports) |
| `contact_email` | optional | email | |
| `contact_instagram` | optional | text, ≤100 chars | |
| `contact_website` | optional | URL | |
| `dance_styles` | optional | array | `;`-separated **names** (e.g. `Salsa; Bachata On1`), ≤10 values, matched against active `dance_style` taxonomy terms |
| `event_attributes` | optional | array | `;`-separated names, matched against active `event_attribute` taxonomy terms |
| `gallery` | optional | array | `;`-separated image URLs |

**Not in the template** (system-managed, matches the brief's own instruction not to expose these): `id`, `created_at`, `updated_at`, `status` (always `approved` on import, matching `createEventAsAdmin`), `source_type` (always `imported`), `submitter_id`/`submitter_email`/`submitter_name` (set from the importing moderator, matching `createEventAsAdmin`'s pattern), `reviewed_by`/`reviewed_at`, `cancellation_reason`, `venue_id` (derived, never a raw UUID column moderators type).

Array separator is `;` (semicolon) rather than `,` — commas are the CSV field delimiter itself; asking a non-technical moderator to correctly quote comma-containing lists by hand is exactly the kind of footgun the brief's parsing requirements (quoted commas, escaped quotes) exist to protect *reading* CSVs from, not something to require moderators to produce by hand.

**Max rows per upload: 200.** Enough for a real batch of curated events, small enough to keep client-side validation/preview responsive and a human review tractable. Enforced client-side (reject before parsing further) and server-side (the insert batch is capped defensively even though the client already enforces it).

## Template

`GET`-style client-side generation (no backend round-trip needed — it's static). One header row + one example row, generated via the same CSV-writer used for the error-rows download (see Security below for formula-injection escaping shared by both).

Example row: `Salsa Social Night,social,2026-09-15,boston,20:00,A weekly social with live DJ.,The Dance Loft,,,free,,,Maria's Dance Studio,,weekly,,,,Salsa; Bachata,,`

## Component / file architecture

```
src/pages/AdminImportEventsPage.tsx + .css   — new page, route /admin/events/import
src/components/Admin/AdminImportDropzone.tsx + .css
                                              — drag-and-drop + file-picker, no new dependency
                                                (native HTML5 drag events)
src/features/admin/model/csvImportTemplate.ts
                                              — column spec (single source of truth), template
                                                generator, CSV-injection-safe cell escaping
src/features/admin/model/csvImportParse.ts   — Papa.parse wrapper: header check, row shaping,
                                                unexpected/missing-column detection
src/features/admin/model/csvImportValidation.ts
                                              — per-row, per-field validation; reuses the exact
                                                constants from validation.ts/adminEventForm.ts
src/features/admin/model/csvImportDuplicates.ts
                                              — same signal-scoring pattern as duplicates.ts,
                                                adapted to a CSV row against fetchAllEvents()
src/features/admin/api/csvImportRepo.ts      — batched supabase.from("events").insert([...]),
                                                taxonomy term linking (reuses
                                                replaceEventTaxonomyTerms), writes the
                                                event_import_batches summary row
src/hooks/useCsvEventImport.ts               — orchestrates parse → validate → duplicate-check
                                                → preview state → import mutation
sql/moderator_csv_import_permissions.sql     — widens the events-insert RLS policy
sql/event_import_audit.sql                   — new event_import_batches table + RLS
```

**New dependency:** `papaparse` (+ `@types/papaparse`). Handles quoted commas, escaped quotes, UTF-8, and header parsing correctly out of the box — exactly what the brief asks for ("prefer a mature CSV parser... small, well-maintained dependency rather than fragile manual parsing"). No CSV parser currently exists in this project.

**Placement in nav:** a secondary button on `AdminEventsPage`'s toolbar, next to "Create Event" (both admin and moderator see it, matching the existing `roles: ["admin","moderator"]` nav entry for Events) — not a new top-level sidebar item. This is an occasional bulk tool, not a daily nav destination; keeps "existing navigation behavior unchanged" per this session's established restraint.

## Workflow (matches the brief's own steps)

1. **Download Template** — instant client-side blob download, no auth round-trip needed beyond page access.
2. **Upload** — drag-and-drop or file picker, `.csv` only (MIME + extension check), max 5 MB (defensive cap alongside the 200-row cap — catches a pathological single-column 200-row file with megabytes of junk in one cell).
3. **Parse** — Papa.parse with `header: true, skipEmptyLines: true`; missing required columns or unexpected columns reported before any row-level validation runs.
4. **Validate** — every row gets a full field-by-field error list (not "first error wins"), plus a separate `warnings` list (e.g. unmatched `venue_name`). Row status: `valid` | `warning` | `invalid`.
5. **Duplicate check** — valid+warning rows are compared against `fetchAllEvents()` (already fetched for the Events page; reused, not a new query pattern) using the ported signal-scoring algorithm. A match sets status to `warning` with a "possible duplicate" reason and a link to the existing event, but does **not** downgrade to `invalid` — the moderator decides per-row via a checkbox (default: unchecked = excluded from the import batch) whether to import anyway.
6. **Preview** — table: Row / Title / Date / Status / Errors-or-warnings / (checkbox for warning-status rows). Summary counts: total / valid / warning / invalid.
7. **Import Valid Events** — button disabled while a mutation is in flight (double-click guard) and disabled entirely once a result is shown (must re-upload to import again — no re-arming without a fresh file, which also means a refresh mid-import can't accidentally "resume" and double-insert; the in-flight request either already committed server-side or didn't, and either way the next attempt is a fresh upload the moderator explicitly reviews again).
8. **Results** — "N processed / N created / N skipped as duplicate / N failed", failed/skipped rows stay visible with reasons, **Download error rows as CSV** button (same column spec + an appended `_errors` column, so the moderator can fix and re-upload the same file shape).

## Security

- **AuthZ, both layers**: page route wrapped in the existing `RequireReviewer` (moderator+admin) guard component — reused, not reinvented. Backend: the widened RLS insert policy is the final boundary; a non-moderator/non-admin calling the insert directly (bypassing the UI entirely) is rejected by Postgres regardless of what the client sends.
- **File validation**: MIME type + `.csv` extension check before parse; 5 MB size cap; 200-row cap (both client pre-check and a defensive server-side cap in the batch insert).
- **CSV injection (the "unexpected HTML"/formula concern)**: any CSV *we generate* (template, error-rows download) prefixes cell values that start with `=`, `+`, `-`, or `@` with a leading `'` — the standard mitigation against a moderator's own event data (which came from elsewhere and could contain a leading `=`) triggering formula execution when the downloaded file is later opened in Excel/Sheets.
- **XSS**: no new risk introduced — confirmed zero `dangerouslySetInnerHTML` usage anywhere in the app; every event field already renders through auto-escaping JSX.
- **DB constraints unweakened**: existing enum CHECK constraints (`event_type`, `price_type`, `city`, `status`, `source_type`) are untouched and remain the final backstop even if client validation has a gap.

## Database changes

Two files, both requiring **manual review and execution against production** (this repo's established convention — nothing auto-applies):

1. **`sql/moderator_csv_import_permissions.sql`** — `alter policy "Admins can insert events" on public.events with check (role in ('admin','moderator'))`. Low risk, additive to an existing policy, no data change. Rollback: revert the `with check` clause to `role = 'admin'`.
2. **`sql/event_import_audit.sql`** — `create table event_import_batches (id, imported_by, filename, total_rows, created_count, duplicate_skipped_count, failed_count, created_at)` + RLS (admin/moderator select own + admin select all, matching the `audit_logs` access pattern) + grants. Rollback: `drop table`.

Both applied to **local** Supabase for development/testing in this session; **not** applied to production — flagged for manual review per established convention.

## What this doesn't decide

- Does not touch `scripts/import-ics.mjs` (separate, unrelated CLI tool).
- Does not add editing/re-import of a previously-imported batch — a corrected CSV is a fresh upload, reviewed like any other.
- Does not persist the raw uploaded CSV file anywhere (per the brief's own instruction not to store it "unless there is an actual product requirement") — only the summary row in `event_import_batches`.
- Does not attempt automatic venue creation from an unmatched `venue_name` — always a warning, never a silent new venue.
- Does not change the existing submission-review duplicate detection (`duplicates.ts`) — the CSV path is a sibling implementation of the same pattern, not a refactor of shared code.

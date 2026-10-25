# Event Composer — Phase 1

## Audit

- Admin route `/admin/events?new=1` and `?edit=<id>` compose `AdminEventEditor` from `AdminEventsPage`. Current save closes the editor; creation publishes by default.
- Shared `EventForm` already covers the event fields, taxonomy, artwork, venue override, and inline field errors. Keep its public/organizer consumers unchanged.
- Live local PostgreSQL inspected 2026-10-17: `save_event_with_entities(uuid,jsonb,boolean) returns uuid` is the canonical transactional write. It requires active moderator/admin authority, synchronizes venue/organizer and instructor/school relationships plus taxonomy, and supports draft/approved through `p_publish`. No migration required.
- New records require title, type, city, date. Incomplete edits must be recoverable locally; valid unpublished drafts can autosave through the same RPC. Never autosave edits to a published event onto the public surface.
- Public detail and calendar use approved-only `public_events`; publication must verify that view and canonical relationships, not just a success banner.
- `entity_review` carries canonical entity decisions; instructor is the existing artist/person kind. Do not create another person table or status system.
- `saveAdminEntity` handles organizer/instructor/school/series; `createVenue` handles venues. Existing matcher/search supports duplicate suggestions. Inline creation must return a persisted entity, select it and leave the event form mounted.
- Flyer extraction already supports stored flyers, entity matching, stale-response guards, and fill-empty-only prepopulation. Reuse it; preserve manually cleared fields as well as nonempty edits.
- Series provides name, description, artwork, city, default venue/organizer. Existing occurrence data can provide event-specific defaults. Each occurrence requires a date explicitly entered by the administrator. No bulk occurrence generation in Phase 1.

## Phase 1 implementation

One task-focused Operate surface within the existing `.admin-shell` design system. A compact entry strip offers Upload Flyer, Create from Series, Start Blank. Keep a single editable form with a persistent action bar: save status, Preview, Save draft / Save changes, Publish. Preview and entity dialogs never navigate away.

Incomplete drafts are user-scoped local recovery records, explicitly labelled as saved on this device. Complete drafts autosave remotely without publishing. Explicit publication calls the canonical transaction with `p_publish=true` and retains the returned ID. Published edits require an explicit save. Errors retain all input and offer retry.

Searchable selectors for venue, organizer, instructor(s), school and series offer missing-entity creation in a protected-focus dialog. Show duplicate suggestions before create; exact duplicates must be selected rather than recreated, possible matches require explicit acknowledgment. Fail closed when duplicate search fails. Newly created canonical records are selected immediately. Use `entity_review` existing decisions for organizer/instructor/school and venue; series uses `series_id`.

## Component contracts and ownership

- Parent owns `AdminEventEditor.tsx/.css`, its integration in `AdminEventsPage`, draft/series helpers, and editor behavior tests.
- Selector implementation owns new `ComposerEntitySelect.tsx/.css/.test.tsx` beside the editor. Export `ComposerEntityKind = 'venue'|'organizer'|'instructor'|'school'|'series'`, `ComposerEntity = {id:string;name:string;address?:string|null;city?:string|null;image_url?:string|null;description?:string|null;venue_id?:string|null;organizer_id?:string|null}`, and default component props `{kind,value:ComposerEntity|null,onSelect:(entity:ComposerEntity|null)=>void,city:string,disabled?:boolean,label?:string}`. Search non-series through existing matcher, series through admin directory. Series selected result must include details (fetch detail if needed). Use existing repositories/form builders/validation for actual creation. No edits to parent-owned files.
- Persistence implementation owns new `src/features/admin/api/eventComposerRepo.ts` and tests/SQL verification script. Export `saveComposerEvent(id:string|null,payload:AdminEventPayload,publish:boolean|null):Promise<string>`. Call only canonical RPC; require returned UUID/nonempty ID, propagate denial/error. Export `verifyComposerPublication(id:string):Promise<{id:string;slug:string|null}>` reading approved-only `public_events`; fail if absent. Existing repo wrappers remain unchanged. Add real-local integration script covering denied ordinary user publication, drafts invisible publicly, successful atomic publication with all relationships, public detail lookup and calendar query. Tests must exercise behavior, not merely forwarding.

## Verification and exclusions

Add behavior tests for inline creation, duplicate choice/acknowledgment, preserving form values/drafts, safe prefill and explicit occurrence dates. Verify admin permissions against real local Supabase. Smoke desktop/mobile and publish through real UI; check DB links, detail route, and calendar visibility. Run checks centrally after implementation; subagents skip builds/tests/lint/formatters mid-flight. No unrelated design-system rewrite, no automatic recurrence scheduler, no new AI pipeline.

## Delivered and verified

Phase 1 is implemented in the existing `/admin/events` editor, including the `?new=1` and `?edit=<id>` entry paths. It introduces no schema migration or alternative event lifecycle. The global `DESIGN.md` and `.impeccable/design.json` intentionally remain unchanged.

- Real local browser verification at 1440px desktop and 390px mobile created and selected all five entity kinds inline without losing the event title or description. No horizontal overflow was observed.
- A complete new occurrence autosaved to the account after its administrator entered a date. An incomplete occurrence recovered from device storage. Series selection did not copy an occurrence date.
- Save draft, preview, publication and subsequent live edits all remained inside the editor. The same saved UUID was retained.
- Anonymous `public_events` reads returned the published venue, organizer, instructor, school and series relationships. The real public detail route rendered them; the real Boston calendar displayed the event in its November 12 slot and opened its event modal.
- `node scripts/event-composer-verify.mjs` passed against local Supabase: anonymous/ordinary-user publication denied, draft invisible publicly, admin transactional relationships retained, anonymous detail/slug/calendar queries successful. The script refuses non-local API URLs and cleans up its fixtures.
- Six focused regression files passed 91 cases. After adding the final creation-dialog cancellation regression, the final selector suite passed all eight cases. Scoped ESLint and the final `npm run build` passed.
- Reviewed edge cases were reproduced and fixed: retaining a returned event ID after editor unmount, preserving canonical/free-text venues and deliberately cleared addresses during asynchronous series prefill, and ignoring stale series-detail choices in both search and creation dialogs.
- Fresh design review scored its two finish fixes resolved and returned `SHIP`; the repository reviewer substituted for the unavailable specialized Impeccable reviewer. Documentation comparison supported preserving the incumbent design files.

Review captures are under `.impeccable/review/event-composer-{desktop,mobile}.webp`; a published-state mobile viewport is retained as `event-composer-mobile-viewport.webp`. All isolated browser accounts, events, entities and related audit fixtures were removed; cleanup queries returned zero remaining records. No production data was touched.

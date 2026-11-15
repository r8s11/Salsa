# Venue Profile Editing Implementation Plan

> **Execution:** Implement inline, task by task; do not start subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Execution status — November 11, 2026:** Implemented locally with all recommended defaults. SQL acceptance first failed on the old venue allowlist, then passed twice including migration reapplication on disposable PostgreSQL with Supabase platform stubs. Verified public/private key sets, Owner/Manager writes, Editor/non-member/archived refusal, length/protocol boundaries, blank clearing, constraints and merge preservation. Public characterization and broken-image RED→GREEN verified. TypeScript and full ESLint pass; 163 affected workspace/entity/help tests pass. Browser exercised the actual form components with isolated local auth/RPC fixtures at 1280px and 390px: HTTP refusal, save, public plain text, private-field exclusion and failed-image removal. No production SQL, deployment or push.

**Execution rulings:** Stayed inline because the task tool disallows selecting the user's permitted model; no subagent ran. Added required fields to two existing venue fixtures beyond the original file list. Client also rejects whitespace and overlong image URLs, matching the database boundary. Kept existing function search paths and ACLs unchanged, including merge_venues's existing search path, rather than broadening this patch. Browser fixtures test rendering/interaction, not live authentication; SQL roles separately prove database authorization.

**Goal:** Let a venue's Owner and Manager add a description and an image link to the venue's public page from the Host workspace Profile form, and make it explicit which saved contact fields visitors can and cannot see.

**Architecture:** `venues` gains `description` and `image_url`. The existing `entity_profile_save` / `entity_workspace` / `entity_access_public_ref` / `merge_venues` functions are patched in place (live definition via `pg_get_functiondef`, exact single-occurrence anchors) so production drift is inherited, not overwritten. The public venue page already renders `entity.description` and `entity.image_url` generically, so the public change is the projection only. The Profile form gains the two fields, a venue-specific image-rights hint and "not shown publicly" hints on the private contact fields.

**Tech Stack:** React 19 + TypeScript + Vite, TanStack Query, Vitest + Testing Library, Supabase Postgres (`security definer` RPCs, RLS), psql-run SQL contract scripts under `supabase/tests/`.

**Spec:** No approved spec exists. This plan argues from the backlog item `docs/user-guides/improvements.md` § "11. P3 — Broaden venue self-service profile editing" (lines 110-117) and the defaults chosen under "Decisions to confirm".

## Decisions to confirm

The tasks below are written against the **bold default**. Each line says what changes if the owner picks otherwise.

1. **Image: link or upload?** **Link** (same as school/instructor/DJ; no storage). If upload: Task 2 also creates a public `venue-media` bucket with insert/update/delete policies scoped by `entity_workspace_role('venue', folder_uuid) in ('owner','manager','admin')`; Task 3 swaps the URL input for a file picker reusing the validation shape of `validateEventFlyer` (JPEG/PNG/WebP, 5 MB, `src/features/events/api/eventFlyers.ts`) and removes the replaced object; roughly two more tasks.
2. **Which saved contact fields are public?** **Unchanged: website, Instagram and street address (`address_line1`) stay public; phone, address line 2 and postal code stay private** (admin-visible only, now labelled so in the form). If the owner wants phone public: add `'phone', v.phone` to the venue branch of `entity_access_public_ref`, add `phone?: string | null` to `PublicEntityRef` (`src/features/entities/model.ts`) and render a `tel:` link in `PublicEntityPage.tsx`. If address line 2 / postal code should be public: append them to the `address` string in the projection instead of adding keys.
3. **Description limit.** **Plain text, 1,200 characters.** Any other limit is one constant in Task 2 (SQL) and Task 3 (`maxLength`).
4. **Image protocol.** **`https://` only** (stricter than Website, which allows `http://`) because an `http://` image on an `https://` page is blocked as mixed content. If `http://` must be allowed: relax the regex in Task 2 and drop `secureOnly` in Task 3.
5. **Image-rights assurance.** **Guidance copy only** (hint text under the field, no checkbox). If the owner wants a recorded attestation: add a required "I have permission to publish this photo" checkbox, a `venues.image_rights_confirmed_at timestamptz` column and payload key; if the owner wants moderation: route `image_url` through admin review (new queue UI; out of this plan).
6. **Publication timing.** **Edits go live immediately**, as for schools, instructors and DJs. If review is required, the form must save to a pending slot instead of `venues.description` / `venues.image_url`.
7. **Admin editing of the two new fields.** **Out of scope**; admins keep using the existing `admin_venue_*` screens, which do not show them. Merging two venues keeps the surviving venue's values and fills gaps from the merged one (Task 2). If admins must edit them, a follow-up extends `admin_venue_directory`/`admin_venue_detail` and the admin venue form.
8. **Directory search on venue description.** **Not included** (`public_entity_directory` keeps `null::text` for venue description in its search candidates). Venue cards still show the description and photo because they come from `entity_access_public_ref`.

## Global Constraints

- Only **Owner** and **Manager** members (and admins) may change the venue profile: `entity_profile_save` keeps `public.entity_workspace_require(p_kind, p_id, array['owner', 'manager'])`. Editors see the existing note "Editors keep the timetable, privates and prices up to date; only owners and managers change the public profile." and no form.
- `name`, `slug`, `city`, `state_region`, `country` and `status` stay admin-only. They are not in the `entity_profile_save` allowlist and must not be added.
- The only new publicly exposed venue fields are `description` and `image_url`. No other venue column may be added to `entity_access_public_ref`, `public_entity_detail`, `public_entity_directory` or `flyer_public_entity_json`.
- Image-rights guidance appears in the UI: the "Image link" hint must say the photo is one the manager took or has written permission to publish.
- Venue image links are `https://` only, at most 2,048 characters, no whitespace. Venue description is at most 1,200 characters, plain text.
- Migrations are **new files only**. Never edit an existing migration. Never apply SQL to production or any shared database. Name: `supabase/migrations/20261109120000_venue_profile_description_image.sql`.
- Existing large functions are changed with the `pg_get_functiondef` + `pg_temp.patch_fn` pattern from `supabase/migrations/20261025120000_nyc_event_sublocations.sql` lines 178-298, never a full rewrite. `security definer`, `set search_path = public, pg_temp` and existing `revoke`/`grant` ACLs must be inherited unchanged (`create or replace` keeps ACLs). `venues` RLS stays admin-only; `anon` keeps no access to `public.venues`.
- Meaningful SQLSTATEs: `22023` invalid input, `42501` not permitted, `23514` check-constraint backstop.
- UI reuses `WorkspaceField` (`src/features/workspaces/components/WorkspaceField.tsx`), `admin-input` / `admin-textarea` classes and `desk__action` buttons. No new dependencies, no new design tokens, every control keeps an accessible name.
- Tests: Vitest + Testing Library colocated with the code; no snapshot tests. SQL behaviour is tested by a psql script in `supabase/tests/` that runs only against a **local** migrated database.
- Run only `npx vitest run <your test files>` per task. Run `npx tsc -b` and `npm run lint` once after Task 4.
- Exact copy (use verbatim):
  - Description hint: `Shown on your public page. Plain text, up to 1,200 characters.`
  - Image link hint: `A full https:// link to a photo of your venue that you took or have written permission to publish. Don't use another site's photo or a flyer, or a photo that identifies people who haven't agreed. Shown at the top of your public page.`
  - Street address hint: `Shown on your public page.`
  - Phone / Address line 2 / Postal code hint: `Not shown on your public page. Salsa Segura staff can see it.`
  - Server errors: `Description must be 1,200 characters or fewer.` and `Image link must be a full https:// link.` (both SQLSTATE `22023`).

## Review Focus

Failure modes the spec implies but a happy-path test would miss, most likely first. Each has a test in the owning task.

- Image link that is `http:`, `javascript:`, `data:` or contains whitespace is rejected inline before the RPC call and again by the database (Task 3 client test, Task 2 SQL script).
- Description of exactly 1,200 characters saves; 1,201 is refused; whitespace-only text clears the field to null instead of storing blanks (Task 2 SQL script; Task 3 `maxLength` test).
- A saved image link that later 404s must not leave a broken-image box or collapsed layout on the public venue page (Task 4).
- Editor, non-member and archived-venue callers are refused with the server's words and the form never renders for an Editor (Task 2 SQL script; Task 3 test).
- An admin merging a duplicate venue must not silently drop the description/photo a manager wrote on the surviving or the merged listing (Task 2 SQL script).

---

### Task 1: Audit which saved venue fields visitors see (characterization)

**Files:**
- Test: `src/features/entities/EntityPages.test.tsx` (add one test inside `describe("PublicEntityPage", …)`, near the existing venue test at line 56)

**Interfaces:**
- Consumes: `PublicEntityPage` (`src/pages/PublicEntityPage.tsx`), `entityLocation` (`src/features/entities/format.ts`), `entityExternalLinks` (`src/features/entities/externalLinks.ts`), the file's existing `detail`, `renderRoute`, `rpc` fixtures.
- Produces: the audit table below, pinned by a test, that Tasks 2 and 5 reference. No production code changes.

Audit result (verified against the repo; re-verify in Step 1). The venue branch of `public.entity_access_public_ref` (`supabase/migrations/20261017000000_dj_profiles.sql:111`) is the only source for the public venue page (`public_entity_detail`, line 123), directory cards (`public_entity_directory`, `20261028120100_public_entity_directory_use_safe_views.sql`) and "Related" lists. Event pages use `flyer_public_entity_json` (`20260929000000_flyer_entity_foundation.sql:1836-1841`).

| Saved column (editor label) | On public venue page | Source / render |
| --- | --- | --- |
| `website` (Website) | Yes, link, only when `http(s)://` | `'website', v.website`; `entityExternalLinks` |
| `instagram` (Instagram) | Yes, link normalised to `https://www.instagram.com/<handle>/` | `'instagram', v.instagram`; `entityExternalLinks` |
| `address_line1` (Street address) | Yes, first part of the location line | `'address', v.address_line1`; `entityLocation` |
| `address_line2` (Address line 2) | **No** | not in any public projection |
| `postal_code` (Postal code) | **No** | not in any public projection |
| `phone` (Phone) | **No** | not in any public projection |
| `city`, `state_region`, `country` (admin-only) | Yes, location line | `entityLocation` |
| `description`, `image_url` | **Not stored for venues today** (projection hard-codes `null`) | `'description',null,'image_url',null` |

Admins see phone, line 2 and postal code through `admin_venue_detail` (`20260902000018_venue_and_settings_rpcs.sql:105-149`); no one else does.

- [ ] **Step 1: Re-verify the audit**

Run: `grep -n "'phone'\|postal_code\|address_line2" supabase/migrations/20261017000000_dj_profiles.sql supabase/migrations/20260929000000_flyer_entity_foundation.sql supabase/migrations/20261028120100_public_entity_directory_use_safe_views.sql`
Expected: for venues, `phone`, `postal_code`, `address_line2` appear only in the `entity_workspace` venue branch (line ~522-523) and `entity_profile_save` (lines ~569-597); other hits (e.g. the school `phone` in `admin_entity_directory`, school branches) are not venue exposure. None may appear inside the venue branch of `entity_access_public_ref`, `public_entity_detail`, `public_entity_directory` or `flyer_public_entity_json`. If a venue hit appears elsewhere, add the row to the table above and to Task 2's SQL key-set assertion before continuing.

- [ ] **Step 2: Add test `"shows a venue's description, photo and only its public contact fields"`**

Render `<PublicEntityPage kind="venue" />` at `/v/havana-club` with the rpc resolving `{ entity: { kind: "venue", id: "venue-1", name: "Havana Club", slug: "havana-club", description: "Latin nights since 1998", image_url: "https://img.example/club.jpg", city: "boston", state_region: "MA", country: "US", address: "5 Main St", website: "https://havana.example", instagram: "@havanaclub", phone: "617-555-0100", postal_code: "02110", address_line2: "Suite 2" }, upcoming: [], past: [], related: [] }` (the three private keys are deliberately present to prove the page ignores them). Assertions:
- `screen.getByText("Latin nights since 1998")` is present.
- the hero `img.public-entity-page__hero` has `src` `https://img.example/club.jpg`.
- `screen.getByText("5 Main St, boston, MA, US")` is present.
- `getByRole("link", { name: "Website" })` has `href` `https://havana.example`; `getByRole("link", { name: "Instagram" })` has `href` `https://www.instagram.com/havanaclub/`.
- `screen.queryByText(/617-555-0100|02110|Suite 2/)` is `null`.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/features/entities/EntityPages.test.tsx -t "public contact fields"`
Expected: PASS immediately (characterization of existing behaviour; the page already renders `description`/`image_url` generically).

- [ ] **Step 4: Commit**

```bash
git add src/features/entities/EntityPages.test.tsx
git commit -m "test: pin which venue fields the public page shows"
```

---

### Task 2: Venue description/image columns, RPC patches and SQL contract script

**Files:**
- Create: `supabase/migrations/20261109120000_venue_profile_description_image.sql`
- Create: `supabase/tests/venue_profile_editing.sql`

**Interfaces:**
- Consumes: `public.entity_profile_save(p_kind text, p_id uuid, p_payload jsonb) returns void`, `public.entity_workspace(p_kind text, p_id uuid) returns jsonb`, `public.entity_access_public_ref(p_kind text, p_id uuid) returns jsonb` (latest definitions: `20261017000000_dj_profiles.sql:104`, `:483`, `:557`), `public.merge_venues(p_keep_id uuid, p_merge_id uuid) returns void` (`20260902000018_venue_and_settings_rpcs.sql:192`), `public.entity_workspace_require`, `public.public_entity_detail(text, text)`, `public.flyer_public_entity_json(text, uuid)`.
- Produces for Tasks 3 and 4:
  - `public.venues.description text`, `public.venues.image_url text`, checks `venues_description_length_check` (`description is null or char_length(description) <= 1200`) and `venues_image_url_https_check` (`image_url is null or (char_length(image_url) <= 2048 and image_url ~* '^https://[^[:space:]]+$')`).
  - `entity_workspace('venue', id)->'entity'` additionally contains `description` and `image_url`.
  - `entity_profile_save('venue', …)` additionally accepts `description` and `image_url`; blank string clears to null; invalid values raise `22023` with the exact messages in Global Constraints.
  - `entity_access_public_ref('venue', id)` returns real `description` and `image_url` (still no phone/postal/line 2).
  - `merge_venues` keeps the surviving venue's `description`/`image_url` and fills nulls from the merged venue.

- [ ] **Step 1: Write `supabase/tests/venue_profile_editing.sql`**

Follow `supabase/tests/weekly_itineraries.sql`: header comment with the run line `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/venue_profile_editing.sql` and "local migrated database only", one `begin; … rollback;`, `pg_temp.expect_sqlstate(statement, expected)` helper copied from lines 7-18 there, fixtures (auth users, a venue, `entity_members` rows for owner/manager/editor, a non-member, an archived venue) created inside the transaction with role/claim impersonation like that script. Assertions, each naming the failure:
  1. Manager and Owner save `{"description":"Latin nights since 1998","image_url":"https://img.example/club.jpg"}`; `venues` row holds both.
  2. Editor and non-member get `42501`; manager of an **archived** venue gets `42501`.
  3. `{"name":"Other"}` still raises `22023` (`Field name cannot be edited here`).
  4. `image_url` of `http://img.example/a.jpg`, `javascript:alert(1)`, `data:image/png;base64,AAAA`, `https://img.example/a b.jpg` and a 2,049-character `https://` link each raise `22023` with `Image link must be a full https:// link.`
  5. Description of 1,200 characters saves; 1,201 raises `22023` with `Description must be 1,200 characters or fewer.`
  6. `{"description":"   ","image_url":""}` stores `null` for both.
  7. As `postgres`, `update public.venues set image_url = 'http://x.example/a.jpg'` raises `23514` (constraint backstop).
  8. `entity_workspace('venue', id)->'entity'` for the manager contains `description` and `image_url`.
  9. As `anon`, `public_entity_detail('venue', slug)->'entity'` has exactly the keys `kind,id,name,slug,description,image_url,city,state_region,country,address,website,instagram,origin,category` (sorted compare), `description`/`image_url` equal the saved values, and contains none of `phone`, `postal_code`, `address_line2`.
  10. `flyer_public_entity_json('venue', id)` keys are exactly `id,name,slug,address,city,state_region,country,website,instagram,status,origin` (unchanged), and `has_table_privilege('anon', 'public.venues', 'SELECT')` is false.
  11. `merge_venues(keep, merged)` as admin: keep with null `description`/`image_url` receives the merged venue's; keep with its own values keeps them.

- [ ] **Step 2: Run it to verify it fails**

Run (local database only, migrations through `20261103120000` applied): `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/venue_profile_editing.sql`
Expected: FAIL (column `description` of relation `venues` does not exist). If no local database is available, record that and have the controller run Steps 2 and 4 against a throwaway local Supabase; never run against production.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261109120000_venue_profile_description_image.sql`, idempotent, sections in order:
  1. Header comment: purpose, "venues.description/image_url are public; phone, address_line2, postal_code stay private (audit in the Task 1 table)".
  2. `alter table public.venues add column if not exists description text, add column if not exists image_url text;` then `drop constraint if exists` + `add constraint` for the two checks defined in Interfaces.
  3. `pg_temp.patch_fn(p_src text, p_old text, p_new text) returns text` copied from `20261025120000_nyc_event_sublocations.sql:188-197` with the error prefix `venue profile migration:`.
  4. One `do $patch$ … $patch$` block that, for each function, does `v := pg_get_functiondef('<signature>'::regprocedure)`, skips with no change if the new text is already present (idempotent re-run), applies the anchors below, then `execute v`:
     - `public.entity_profile_save(text,uuid,jsonb)`:
       - anchor `when 'venue' then array['website', 'instagram', 'phone', 'address_line1', 'address_line2', 'postal_code']` → same list with `'description', 'image_url'` prepended.
       - anchor `update public.venues set` → a validation block followed by `update public.venues set` and two new assignment lines in the style of the sibling lines (`description = case when p_payload ? 'description' then nullif(btrim(p_payload->>'description'), '') else description end,` and the same for `image_url`). Validation raises `22023` with the two exact messages: description (after `btrim`) longer than 1,200 characters; image (after `btrim`) non-empty and not matching `^https://[^[:space:]]+$` or longer than 2,048.
     - `public.entity_workspace(text,uuid)`: anchor `'postal_code', v.postal_code, 'website', v.website, 'instagram', v.instagram, 'phone', v.phone)` → append `, 'description', v.description, 'image_url', v.image_url` before the closing parenthesis.
     - `public.entity_access_public_ref(text,uuid)`: anchor `'description',null,'image_url',null,'city',v.city` → `'description',v.description,'image_url',v.image_url,'city',v.city`.
     - `public.merge_venues(uuid,uuid)`: anchor `phone = coalesce(keep.phone, merge.phone)` → same plus `, description = coalesce(keep.description, merge.description), image_url = coalesce(keep.image_url, merge.image_url)`.
  5. `notify pgrst, 'reload schema';`

  Each anchor must occur exactly once in the live definition; `patch_fn` raises otherwise, which is the intended stop signal for production drift (report it, do not loosen the anchor).

- [ ] **Step 4: Run the script to verify it passes**

Run: `supabase db reset` against the **local** stack, then `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/venue_profile_editing.sql`
Expected: exits 0 with no raised exception. Re-run the migration file a second time (`psql -f`) to confirm idempotence: exits 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261109120000_venue_profile_description_image.sql supabase/tests/venue_profile_editing.sql
git commit -m "feat(venues): description and image link for venue profiles"
```

---

### Task 3: Venue Profile form fields, hints and validation

**Files:**
- Modify: `src/features/workspaces/model.ts:104-118` (`VenueProfile`) and `:152` (`ProfilePatch.venue`)
- Modify: `src/features/workspaces/pages/EntityWorkspaceProfilePage.tsx:18-61` (`FieldSpec`, `IMAGE`, `PROFILE_FIELDS.venue`), `:70-77` (`isWebLink`), `:110-124` (submit validation), `:161-191` (textarea `maxLength`)
- Modify: `src/features/workspaces/pages/workspaceTestKit.tsx` (add `venueWorkspace`)
- Test: `src/features/workspaces/pages/EntityWorkspaceProfilePage.test.tsx` (replace the test `"offers a venue its own field set"` at lines ~126-155)

**Interfaces:**
- Consumes: Task 2's `entity_workspace` venue entity keys `description`/`image_url` and `entity_profile_save` venue allowlist; `saveEntityProfile` / `useSaveProfile` (`src/features/workspaces/api/workspacesRepo.ts:45`, `hooks/useEntityWorkspace.ts`) unchanged.
- Produces:
  - `VenueProfile` gains `description: string | null; image_url: string | null`; `ProfilePatch["venue"]` picks `"description" | "image_url" | "website" | "instagram" | "phone" | "address_line1" | "address_line2" | "postal_code"`.
  - `FieldSpec` gains `secureOnly?: boolean` and `maxLength?: number`; `isWebLink(value: string, secureOnly?: boolean): boolean`.
  - `venueWorkspace(overrides?: Partial<Omit<Extract<EntityWorkspace, { kind: "venue" }>, "kind" | "offerings">>): Extract<EntityWorkspace, { kind: "venue" }>` in `workspaceTestKit.tsx` (defaults: role `"owner"`, entity id `venue-1`, name `Havana Club`, slug `havana-club`, status `active`, city `boston`, `address_line1` `5 Main St`, other fields `null`, `offerings: null`, `members: [member("owner")]`, `upcoming: []`).

- [ ] **Step 1: Write the failing tests**

In `EntityWorkspaceProfilePage.test.tsx`, delete the inline-venue test and add (using `venueWorkspace`, `serve`, `renderProfile("venue")`):
  - `"offers a venue its description, image link and contact fields"`: `getByLabelText` finds `Description`, `Image link`, `Website`, `Instagram`, `Phone`, `Street address`, `Address line 2`, `Postal code`; `Street address` has value `5 Main St`; `queryByLabelText("Name")` is null.
  - `"tells the venue which fields are public and gives image-rights guidance"`: `Street address` and `Description` have accessible descriptions matching `/Shown on your public page/`; `Phone`, `Address line 2`, `Postal code` match `/Not shown on your public page/`; `Image link` matches `/written permission to publish/`.
  - `"sends the description and image link in the venue patch"`: type `Salsa on Fridays.` and `https://img.example/club.jpg`, click `Save profile`; `rpc` call `entity_profile_save` has `p_kind: "venue"`, `p_id: "venue-1"` and `p_payload` matching `{ description: "Salsa on Fridays.", image_url: "https://img.example/club.jpg" }`; `Saved.` appears.
  - `"refuses an http image link for a venue before calling the database"`: type `http://img.example/a.jpg`, save → text matches `/Image link must be a full link starting with https:\/\//`, field focused, `rpc` never called with `entity_profile_save`.
  - `"limits the venue description to 1,200 characters"`: `Description` has attribute `maxlength` `1200`; `fireEvent.change` with `"x".repeat(1200)` then save sends a 1,200-character `description`.
  - `"clears the image link when emptied"`: workspace with `image_url: "https://img.example/club.jpg"`; clear the field, save → payload `image_url: ""`.
  - `"shows the server's refusal for a venue image link"`: `entity_profile_save` returns `{ message: "Image link must be a full https:// link.", code: "22023" }` → `role="alert"` has that text.
  - `"keeps an editor out of the venue form"`: `venueWorkspace({ role: "editor" })` → the owners-and-managers note shows and `queryByRole("form", { name: "Public profile" })` is null.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/workspaces/pages/EntityWorkspaceProfilePage.test.tsx`
Expected: FAIL (`Unable to find a label with the text of: Description` for the venue, and `venueWorkspace` not exported).

- [ ] **Step 3: Implement**

  - `workspaceTestKit.tsx`: add `venueWorkspace` per Interfaces, mirroring `schoolWorkspace`.
  - `model.ts`: extend `VenueProfile` and `ProfilePatch["venue"]` per Interfaces; update the comment above `ProfilePatch` only if it becomes inaccurate.
  - `EntityWorkspaceProfilePage.tsx`:
    - Add `secureOnly` and `maxLength` to `FieldSpec`; `isWebLink(value, secureOnly)` additionally requires `url.protocol === "https:"` when `secureOnly`; the submit validation passes `secureOnly` and keeps the existing message `${label} must be a full link starting with https://`.
    - Replace `PROFILE_FIELDS.venue` with, in order: `Description` (textarea, `maxLength: 1200`, hint from Global Constraints), a venue image field `{ key: "image_url", label: "Image link", kind: "url", secureOnly: true, hint: <Image link hint from Global Constraints> }`, `WEBSITE`, `INSTAGRAM`, `Phone` (tel, private hint), `Street address` (public hint), `Address line 2` (private hint), `Postal code` (private hint). Leave the other kinds' fields and the shared `IMAGE` constant untouched.
    - Pass `maxLength={maxLength}` to the textarea and inputs; update the comment above `PROFILE_FIELDS` ("Exactly the fields entity_profile_save accepts for each kind") only if still true (it is).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/workspaces/pages/EntityWorkspaceProfilePage.test.tsx`
Expected: PASS (all tests, including the pre-existing school tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/workspaces/model.ts src/features/workspaces/pages/EntityWorkspaceProfilePage.tsx src/features/workspaces/pages/workspaceTestKit.tsx src/features/workspaces/pages/EntityWorkspaceProfilePage.test.tsx
git commit -m "feat(workspaces): venue description and image link in profile editor"
```

---

### Task 4: Public venue page copes with a broken image link

**Files:**
- Modify: `src/pages/PublicEntityPage.tsx:70-84` (state next to the other hooks, before the early returns) and `:118-120` (hero `<img>`)
- Test: `src/features/entities/EntityPages.test.tsx` (new test next to the Task 1 test)

**Interfaces:**
- Consumes: `entity.image_url` from the public detail RPC (Task 2 makes it non-null for venues).
- Produces: hero rendering rule: the hero `<img>` renders only when `entity.image_url` is set and differs from the URL that last failed to load (state `failedHero: string | null`, set from the `<img onError>`).

- [ ] **Step 1: Write the failing test `"drops a hero photo that fails to load"`**

Render the venue page as in Task 1 with `image_url: "https://img.example/gone.jpg"`; `fireEvent.error(img)` on `img.public-entity-page__hero`; assert `document.querySelector("img.public-entity-page__hero")` is `null` and the heading `Havana Club` and the description are still present.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/entities/EntityPages.test.tsx -t "fails to load"`
Expected: FAIL (the hero element is still in the document).

- [ ] **Step 3: Implement** in `PublicEntityPage.tsx`: `const [failedHero, setFailedHero] = useState<string | null>(null)` placed with the component's other hooks (before the `isPending` / `error` returns, to keep hook order stable); hero condition `entity.image_url && entity.image_url !== failedHero`; `onError={() => setFailedHero(entity.image_url)}`. Import `useState` from `react`.

- [ ] **Step 4: Run tests, then the one-time project checks**

Run: `npx vitest run src/features/entities/EntityPages.test.tsx src/features/workspaces/pages/EntityWorkspaceProfilePage.test.tsx`
Expected: PASS. Then once: `npx tsc -b` (no errors) and `npm run lint` (no warnings).

- [ ] **Step 5: Commit**

```bash
git add src/pages/PublicEntityPage.tsx src/features/entities/EntityPages.test.tsx
git commit -m "fix(entities): hide a public hero image that fails to load"
```

---

### Task 5: Update the venue guide and backlog item

**Files:**
- Modify: `docs/user-guides/venues.md:17-27` and the troubleshooting row at line 67
- Modify: `docs/user-guides/improvements.md:110-117`

**Interfaces:**
- Consumes: the final labels from Task 3 and the audit table from Task 1.
- Produces: user-facing documentation only (no code).

- [ ] **Step 1: Edit `venues.md`**
  - In "Keep venue details current", list the fields with the exact labels: **Description**, **Image link**, **Website**, **Instagram**, **Phone**, **Street address**, **Address line 2**, **Postal code**.
  - State which are shown publicly (Description, Image link, Website, Instagram, Street address, plus the read-only city) and that **Phone**, **Address line 2** and **Postal code** are not shown on the public page but Salsa Segura staff can see them.
  - Replace the sentence "The current venue editor does not include a photo-upload or description field…" with image-rights guidance matching the form hint: use a photo you took or have written permission to publish, not another site's photo or a flyer, nothing identifying people who have not agreed; the link must start with `https://`; there is no file upload.
  - Update the troubleshooting row "A photo, name, city, or description is wrong": managers fix **Description** and **Image link** themselves; name and city still go through Salsa Segura.
  - Keep "Last checked" as the date of the verification, not the plan date.
- [ ] **Step 2: Edit `improvements.md` item 11**: replace `**Proposed.**` with `**Implemented.**` plus one sentence naming what shipped (description and `https://` image link for Owner/Manager; phone, address line 2 and postal code remain private) and what did not (photo upload, admin editing of the two fields, directory search on description).
- [ ] **Step 3: Verify links and labels**

Run: `grep -n "Image link\|Description\|Address line 2" docs/user-guides/venues.md`
Expected: every label in the guide matches `PROFILE_FIELDS.venue` in `EntityWorkspaceProfilePage.tsx` exactly.

- [ ] **Step 4: Commit**

```bash
git add docs/user-guides/venues.md docs/user-guides/improvements.md
git commit -m "docs: venue profile description and image link"
```

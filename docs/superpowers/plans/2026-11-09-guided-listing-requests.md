# Guided Listing Requests Implementation Plan

> **Execution:** Implement inline, task by task; do not start subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in people ask, in-product, for a missing listing, for an Artist/DJ ↔ event association, or for an identity change on a listing they manage, with the context attached, a visible status, and an admin decision before anything becomes public.

**Architecture:** One new RPC-only table `public.listing_requests` with typed submit RPCs, a withdraw RPC and an admin review RPC (same conventions as `entity_claims` in `20261008000000_entity_workspaces.sql`). A new `src/features/listingRequests/` feature holds the model, repo and hooks; user surfaces are a `/request-listing` page and a per-listing `Requests` workspace section; the admin decides on a new `/admin/requests` page. Approving an event link writes only `event_djs` / `event_instructors`; no request path touches `events`, `organizer_members` or `entity_members`.

**Tech Stack:** React + TypeScript + Vite, TanStack Query, Supabase RPCs (Postgres, RLS), vitest + Testing Library.

**Spec:** `docs/user-guides/improvements.md`, item 9 "Guided requests for missing listings and event associations" (status: Proposed; no approved spec, so the defaults in *Decisions to confirm* stand in for one).

## Decisions to confirm

Tasks below are written against the **bold default**. Each line says what changes otherwise.

1. **Request types: missing listing, Artist/DJ event link, identity change (name, city, page address).** Default all three. Dropping identity change removes the `profile_change` type from Task 1, its form from Task 5, and keeps the existing "Contact Salsa Segura" link on the profile page.
2. **Event links are requestable for Artists (`instructor`) and DJs (`dj`) only.** Venue/school links are excluded because `events.venue_id` and `event_schools` describe an organizer's event; a venue claim must not reach other promoters' events. Adding venues/schools needs the organizer sign-off in decision 4 first.
3. **Only an active owner or manager of the Artist/DJ may submit an event link; editors may not** (mirrors `canEditProfile`). Allowing editors changes one `array['owner','manager']` in Task 1 and the Requests-section visibility rule in Task 5.
4. **Platform admins alone decide (same queue model as claims); the event's organizer is shown to the reviewer as context, not asked.** Requiring organizer sign-off adds a second decision column, a Host inbox and a two-party approval state: a separate plan.
5. **Approving a missing-listing request does not create the listing or grant ownership.** The admin creates the listing on the existing `/admin/<kind>s/new` page and records it with `p_resulting_entity_id`; the requester is told to claim it with the normal claim flow. Auto-creating a claim on approval would add an `entity_claims` insert in `admin_review_listing_request`.
6. **Missing-listing kinds: School, Venue, Artist, DJ.** Organizers keep their own `organizer_requests` flow.
7. **Event links are add-only; no "remove this association" request.** Supporting removal adds an `action text check (action in ('link','unlink'))` column and an `unlink` branch in the review RPC.
8. **At most 10 pending requests per person; a pending request can be withdrawn.** Another cap changes the constant `10` in Task 1 and `MAX_PENDING_LISTING_REQUESTS` in Task 2.
9. **Status is shown in-app only; no email or push.** Decision notifications need a verified delivery path (see backlog item 10) and are out of scope.
10. **Event search for a link request covers approved events, past and upcoming.** Restricting to upcoming changes one `where` clause in `listing_request_event_candidates`.

## Global Constraints

- Authority is unchanged: claiming or managing a venue/school never grants edit access to other promoters' events; `listing_requests` code must not reference `organizer_members` and must not `update public.events`.
- Requests never publish: nothing becomes public until `admin_review_listing_request` approves it, and only an administrator (`public.is_admin()` and `public.account_is_active(auth.uid())`) can call it.
- Show request status: every request surface lists the requester's own requests with the status words defined in Task 2.
- Ask users to check for an existing listing first: the missing-listing form searches the public directory before it can submit, shows matches, and requires the checkbox labelled `I searched and this listing is not here`; the RPC also refuses a case/space-insensitive name match within the same kind and city.
- Migrations are new files only: `supabase/migrations/20261110000000_listing_requests.sql`. Never edit an existing migration; never apply SQL to production or any database as part of execution.
- RPC conventions (copy from `20261008000000_entity_workspaces.sql`): `language plpgsql security definer set search_path = public, pg_temp`; table gets `enable row level security` and `revoke all on table ... from public, anon, authenticated` (RPC-only); every function `revoke all ... from public, anon, authenticated` then `grant execute ... to authenticated`; SQLSTATEs: `42501` not allowed, `22023` bad input, `P0002` not found, `23505` duplicate, `23514` wrong state.
- Audit rows go to `public.audit_logs (actor_id, action, entity_type, entity_id, metadata, reason, target_type, target_id)` with `entity_type = 'listing_request'`; `target_type` is the listing kind or null (allowed kinds already include `school`, `venue`, `instructor`, `dj`).
- Copy: kind names come from `MANAGED_KIND_LABELS` in `src/features/workspaces/model.ts` (instructor is "Artist"). Status words: `Waiting for review`, `Not approved`, `Withdrawn`, and for approved: `Listing added` (missing listing), `Event linked` (event link), `Change made` (identity change).
- UI reuses existing classes (`ui-button`, `desk__action`, `admin-input`, `admin-textarea`, `ws-*` from `src/features/workspaces/components/workspace.css`, `admin-*` from `src/styles/admin.css`) and `useAccessibleDialog` for dialogs. No new dependencies, no new design tokens, accessible names on every control. All user text renders as text (no HTML).
- Tests: vitest + Testing Library, colocated, `vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }))` with a hoisted `rpc` mock as in `src/features/admin/pages/AdminEntityClaimsPage.test.tsx`. Allowed check while implementing: `npx vitest run <own test files>`.
- Already being fixed separately and present when this plan runs: `organizer_publish_event` RPC (`20261109000000_organizer_publish_event.sql`), the attendee edit page, the public member page at `/u/:username` (`20261109000100_public_member_profile.sql`), and the artist selector on school offerings (`src/features/workspaces/hooks/useArtistSearch.ts`). Do not modify them. This plan's migration must sort after `20261109000100`.
- Merge points with the claims-inbox work (backlog item 10) and the venue-profile work (item 11): both may touch `src/app/App.tsx`, `AdminSidebar.tsx`, `workspaceSections.ts` and `workspacesRepo.ts`. Make only the additions listed here and rebase over theirs; never reshape `my_entity_claims`.

## Review Focus

1. **A venue or school manager (or anyone who is not an owner/manager of that Artist/DJ) submitting an event link, directly via RPC or by editing the form** → refused with `42501`, no row written. Pinned in Task 1 (`listing_requests.test.ts`) and Task 5.
2. **Approving a link for an event run by an unrelated organizer** → only `event_djs`/`event_instructors` changes; `events`, `organizer_members`, `entity_members` untouched; reviewer sees the organizer's name. Pinned in Task 1 and Task 6.
3. **Double-submit, repeat of an already-linked event, or more than 10 pending** → refused (`23505` / `23514`) with a plain message; the form keeps the user's text. Pinned in Task 1 and Task 4/5.
4. **Event archived/cancelled, or listing archived, between submit and review** → approval fails with `23514` and the request stays pending; the admin UI shows the server's message, never a success state. Pinned in Task 1 and Task 6.
5. **Missing listing whose name matches an existing one with different case, spacing or trailing punctuation; very long or markup-laden text** → refused as duplicate / length-limited at the database, rendered as plain text. Pinned in Task 1 and Task 4.

---

### Task 1: Database — `listing_requests` table and RPCs

**Files:**
- Create: `supabase/migrations/20261110000000_listing_requests.sql`
- Create: `supabase/tests/listing_requests.sql` (behavioral assertions against disposable Postgres with the migration chain applied).

**Interfaces:**
- Consumes: `public.entity_workspace_require(p_kind text, p_id uuid, p_allowed text[]) returns text`, `public.entity_workspace_ref(p_kind text, p_id uuid) returns table (name, slug, status, city, image_url)`, `public.account_is_active(uuid)`, `public.is_admin()`, tables `public.events`, `public.event_djs (event_id, dj_id, position)`, `public.event_instructors (event_id, instructor_id, position)`, `public.organizers`, `public.audit_logs`.
- Produces (all `authenticated` only):
  - table `public.listing_requests (id uuid pk, request_type text in ('missing_listing','event_link','profile_change'), requester_id uuid, entity_kind text in ('school','venue','instructor','dj') null, entity_id uuid null, event_id uuid null → events on delete cascade, proposed_name text ≤200, proposed_city text ≤120, website text ≤500, instagram text ≤200, details text ≤2000, status text default 'pending' in ('pending','approved','rejected','withdrawn'), reviewer_id, reviewed_at, review_note text ≤2000, resulting_entity_id uuid null, created_at)`. A shape `check` ties each type to its columns (missing_listing: kind + name, no entity/event; event_link: kind in ('instructor','dj'), entity and event; profile_change: kind and entity, no event). Partial unique indexes on pending rows prevent a second identical pending request.
  - `listing_request_submit_missing(p_kind text, p_name text, p_city text, p_website text, p_instagram text, p_details text, p_checked_existing boolean) returns uuid`
  - `listing_request_submit_event_link(p_kind text, p_entity_id uuid, p_event_id uuid, p_note text) returns uuid` (requires `entity_workspace_require(p_kind, p_entity_id, array['owner','manager'])`)
  - `listing_request_submit_profile_change(p_kind text, p_entity_id uuid, p_requested_name text, p_requested_city text, p_note text) returns uuid` (same authorization; needs at least one of name/city/note)
  - `listing_request_event_candidates(p_kind text, p_entity_id uuid, p_query text) returns jsonb` → `[{id, title, event_date, location}]`, max 20, approved events not yet linked to that Artist/DJ, same authorization as event-link submit
  - `my_listing_requests() returns jsonb` → array of the caller's requests, newest first, keys listed in Task 2's `ListingRequest`
  - `listing_request_withdraw(p_request_id uuid) returns void` (own pending request only)
  - `admin_listing_requests(p_status text default 'pending', p_entity_kind text default null, p_entity_id uuid default null) returns jsonb` → keys of `AdminListingRequest` in Task 2
  - `admin_pending_listing_request_count() returns integer`
  - `admin_review_listing_request(p_request_id uuid, p_approve boolean, p_note text default null, p_resulting_entity_id uuid default null) returns jsonb` → `{request_id, approved, request_type}`
  - internal (revoked from everyone): `listing_request_assert_can_submit()` (signed in, active account, fewer than 10 pending)

- [ ] **Step 1: Write `supabase/tests/listing_requests.sql`.** Use a transaction with rollback, fixture users and `SET LOCAL ROLE authenticated` with JWT claims. Assert a venue manager and an Editor cannot request artist links (`42501`); an Artist Manager can submit; repeated pending requests conflict (`23505`); one caller never sees or withdraws another caller's requests; anonymous calls and direct table writes are denied. Assert the pending-request limit, duplicate-name handling, and malformed request shape boundaries.
- [ ] **Step 2: Run it on disposable Postgres before the feature migration.** `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/listing_requests.sql`. Expected: missing feature RPC/table. Confirm the target is local and disposable first. Docker is optional: Homebrew Postgres plus minimal Supabase auth/storage stubs can run this repository's migration chain.

- [ ] **Step 3: Write `supabase/migrations/20261110000000_listing_requests.sql`**

Sections (as in `20261008000000_entity_workspaces.sql`): 1 Table, 2 Submit, 3 Reads (candidates, mine, withdraw), 4 Admin (list, count, review), 5 Grants. Choices the signatures leave open:
- `listing_request_assert_can_submit` raises `42501` when signed out or inactive, and `23514` ("You have 10 requests waiting for review. Withdraw one or wait for a decision.") at 10 pending.
- Missing-listing duplicate check: `lower(regexp_replace(btrim(name), '[[:space:][:punct:]]+', ' ', 'g'))` equal to the same expression on an `active` or `needs_review` row of the same kind in `public.schools|venues|instructors|djs` (and same `city` when `p_city` is not blank) → `23505` "A listing with that name already exists. Search for it and claim it instead."; `p_checked_existing = false` → `22023`. Kind not in the four → `22023`. Trim blanks to null; length limits come from the table checks.
- Event-link submit: event must be `status = 'approved'` (`P0002` otherwise); already linked → `23505` "This event is already on that profile."; the pending unique index raises `23505` for repeats, which the function pre-checks to give "You already asked for this link. It is waiting for review."
- `admin_listing_requests` joins the requester (`auth.users.email`, `profiles.display_name`), the listing (`entity_workspace_ref`), the requester's `entity_members.member_role` on that listing, and for event links the event (`title`, `event_date`, `location`, `status`) with `organizers.name` as `event_organizer_name` and `already_linked`.
- `admin_review_listing_request`: lock the row `for update`; not pending → `23514` "This request was already decided."; on approve — event_link: listing must be non-archived (`entity_workspace_ref`) and event `approved`, else `23514`; insert into `event_djs`/`event_instructors` with `position = coalesce(max(position) + 1, 0)` and `on conflict (event_id, ...) do nothing` (copy `admin_dj_set_event`); missing_listing: `p_resulting_entity_id` required and must be an `active` listing of `entity_kind` per `entity_workspace_ref`, else `22023`, stored in `resulting_entity_id`; profile_change: no data change. Set status/reviewer/review_note, write the audit row, return the jsonb.

- [ ] **Step 4: Add decision scenarios to the SQL script.** Non-admin approval fails (`42501`); admin approval creates exactly one association and leaves event ownership and membership unchanged; approval after cancellation/archive fails (`23514`) and preserves pending state. Missing-listing approval records an existing active result without creating memberships. A withdrawal releases the pending slot without erasing history.
- [ ] **Step 5: Apply the feature migration to disposable Postgres and run the SQL script.** Expected: every assertion passes. Reapply the migration and rerun to check idempotence. Never apply to production from this plan.
- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261110000000_listing_requests.sql supabase/tests/listing_requests.sql
git commit -m "feat(db): add guided listing requests table and RPCs"
```

---

### Task 2: Client model, repo and hooks

**Files:**
- Create: `src/features/listingRequests/model.ts`
- Create: `src/features/listingRequests/api/listingRequestsRepo.ts`
- Create: `src/features/listingRequests/hooks/useListingRequests.ts`
- Create: `src/features/admin/hooks/useAdminListingRequests.ts`
- Test: `src/features/listingRequests/api/listingRequestsRepo.test.ts`, `src/features/listingRequests/model.test.ts`

**Interfaces:**
- Consumes: `ManagedKind`, `MANAGED_KIND_LABELS`, `EntityMemberRole` from `src/features/workspaces/model.ts`; `supabase` from `src/lib/supabase.ts`; `WorkspaceAccessError` and the private `call<T>` convention in `src/features/workspaces/api/workspacesRepo.ts:21-35` (re-use `WorkspaceAccessError` for `42501`; export a `call`-equivalent in the new repo that maps RPC errors to `Error(message)` exactly as that file does); `errorMessage` from `src/features/workspaces/hooks/useEntityWorkspace.ts`.
- Produces:
  - `model.ts`: `type ListingRequestType = "missing_listing" | "event_link" | "profile_change"`; `type ListingRequestStatus = "pending" | "approved" | "rejected" | "withdrawn"`; `type EventLinkKind = "instructor" | "dj"`; `const EVENT_LINK_KINDS: readonly EventLinkKind[]`; `const MAX_PENDING_LISTING_REQUESTS = 10`; `type ListingRequest = { id; request_type; status; entity_kind: ManagedKind | null; entity_id: string | null; entity_name: string | null; entity_slug: string | null; event_id: string | null; event_title: string | null; event_date: string | null; proposed_name: string | null; proposed_city: string | null; website: string | null; instagram: string | null; details: string | null; review_note: string | null; resulting_entity_id: string | null; resulting_entity_slug: string | null; created_at: string; reviewed_at: string | null }`; `type AdminListingRequest = ListingRequest & { requester_id; email; display_name: string | null; member_role: EntityMemberRole | null; event_status: string | null; event_location: string | null; event_organizer_name: string | null; already_linked: boolean }`; `type EventLinkCandidate = { id; title; event_date; location: string | null }`; `function requestStatusWord(request: Pick<ListingRequest, "request_type" | "status">): string`; `function requestHeadline(request: ListingRequest): string` (e.g. `Add "Casa Cuba" as a Venue`, `Link "Friday Social" to DJ Ana`, `Change details for Ritmo Vivo`).
  - `listingRequestsRepo.ts`: `submitMissingListing(input: MissingListingInput): Promise<string>`, `submitEventLinkRequest(kind: EventLinkKind, entityId: string, eventId: string, note: string): Promise<string>`, `submitProfileChangeRequest(kind: ManagedKind, entityId: string, input: { requestedName: string; requestedCity: string; note: string }): Promise<string>`, `fetchEventLinkCandidates(kind: EventLinkKind, entityId: string, query: string): Promise<EventLinkCandidate[]>`, `fetchMyListingRequests(): Promise<ListingRequest[]>`, `withdrawListingRequest(id: string): Promise<void>`, `fetchAdminListingRequests(status: ListingRequestStatus | null, scope?: { kind: ManagedKind; id: string }): Promise<AdminListingRequest[]>`, `fetchPendingListingRequestCount(): Promise<number>`, `reviewListingRequest(id: string, approve: boolean, note: string | null, resultingEntityId: string | null): Promise<void>`; `MissingListingInput = { kind: ManagedKind; name: string; city: string; website: string; instagram: string; details: string; checkedExisting: boolean }`. Each maps 1:1 to the RPC of the same meaning in Task 1.
  - `useListingRequests.ts`: `MY_LISTING_REQUESTS_KEY = "my-listing-requests"`, `useMyListingRequests()`, `useSubmitMissingListing()`, `useSubmitEventLinkRequest()`, `useSubmitProfileChangeRequest()`, `useWithdrawListingRequest()` (all submit/withdraw mutations invalidate `[MY_LISTING_REQUESTS_KEY]`), `useEventLinkCandidates(kind, entityId, query)` (enabled at `query.trim().length >= 2`, `retry: false`).
  - `useAdminListingRequests.ts` (model of `useAdminEntityClaims.ts`): `ADMIN_LISTING_REQUESTS_KEY = "admin-listing-requests"`, `ADMIN_PENDING_LISTING_REQUESTS_KEY = "admin-pending-listing-requests"`, `type ListingRequestView = "pending" | "approved" | "rejected" | "all"`, `useAdminListingRequests(view: ListingRequestView)` → `{ requests, counts, isLoading, error, refetch, review({ requestId, approve, note, resultingEntityId }), isReviewing, reviewingRequestId, reviewError, resetReviewError }`, `usePendingListingRequestCount(enabled?: boolean): number`, `usePendingRequestsForListing(kind: ManagedKind, id: string)` → `{ count: number }` (reads the pending-scoped `fetchAdminListingRequests("pending", { kind, id })`).

- [ ] **Step 1: Write failing tests**

`model.test.ts`: `requestStatusWord({request_type:"event_link",status:"approved"})` → `"Event linked"`; `missing_listing` approved → `"Listing added"`; `profile_change` approved → `"Change made"`; any pending → `"Waiting for review"`; rejected → `"Not approved"`; withdrawn → `"Withdrawn"`. `requestHeadline` for an `instructor` event link names the kind as `Artist`.
`listingRequestsRepo.test.ts` (hoisted `rpc` mock): `submitMissingListing` calls `listing_request_submit_missing` with `{p_kind, p_name, p_city, p_website, p_instagram, p_details, p_checked_existing}`; `submitEventLinkRequest` calls `listing_request_submit_event_link` with `{p_kind, p_entity_id, p_event_id, p_note}`; `fetchAdminListingRequests("pending", {kind:"dj", id:"d1"})` passes `{p_status:"pending", p_entity_kind:"dj", p_entity_id:"d1"}` and `fetchAdminListingRequests(null)` passes `p_status: null`; an RPC error `{message:"You already asked for this link. It is waiting for review.", code:"23505"}` rejects with that exact message; code `42501` rejects with `WorkspaceAccessError`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/listingRequests`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the four files** with the signatures above. Status-word table and kind labels live in `model.ts`; hooks follow `useEntityWorkspace.ts` / `useAdminEntityClaims.ts` (all admin requests loaded once, tab filters the cache).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/features/listingRequests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/listingRequests src/features/admin/hooks/useAdminListingRequests.ts
git commit -m "feat: listing request model, repo and hooks"
```

---

### Task 3: Request status list component

**Files:**
- Create: `src/features/listingRequests/components/ListingRequestStatusList.tsx`
- Create: `src/features/listingRequests/components/ListingRequestStatusList.css`
- Test: `src/features/listingRequests/components/ListingRequestStatusList.test.tsx`

**Interfaces:**
- Consumes: `useMyListingRequests`, `useWithdrawListingRequest`, `requestHeadline`, `requestStatusWord`, `ListingRequest` (Task 2); `entityHref`-style public paths via `PUBLIC_PATH_PREFIX` in `src/features/workspaces/offeringForm.ts`.
- Produces: `export default function ListingRequestStatusList(props: { filter?: (request: ListingRequest) => boolean; heading?: string; emptyText: string })` — renders the caller's requests as a labelled list (`<section aria-labelledby>`), each row: headline, status word, submitted date, reviewer note when rejected (`Note: …`), a `Withdraw` button (accessible name `Withdraw request: <headline>`) on pending rows, and for an approved missing-listing request a link `Claim it` to the resulting listing's public page (`resulting_entity_slug`).

- [ ] **Step 1: Write failing tests** (hoisted `rpc` mock, `MemoryRouter`, `QueryClientProvider` like `PublicWorkspaceSurfaces.test.tsx`):
  - `it("shows each request with its status word")` — rows read `Waiting for review`, `Event linked`, `Not approved`.
  - `it("shows the reviewer's note on a rejected request and no note otherwise")`.
  - `it("offers Withdraw only on pending requests and calls listing_request_withdraw")` — click `Withdraw request: …` → `rpc` called with `("listing_request_withdraw", { p_request_id: "r1" })`.
  - `it("shows the server message when withdraw fails")` (`role="alert"`).
  - `it("links an approved missing listing to its new page so the person can claim it")`.
  - `it("renders request text as plain text")` — `details` containing `<b>x</b>` appears literally.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/features/listingRequests/components/ListingRequestStatusList.test.tsx` → FAIL.
- [ ] **Step 3: Implement the component** with `filter` applied client-side over `useMyListingRequests().data`; loading and error states use existing text patterns (`role="status"` / `role="alert"`).
- [ ] **Step 4: Run to verify pass** — same command → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/listingRequests/components
git commit -m "feat: show listing request status with withdraw"
```

---

### Task 4: "Request a listing" page with existing-listing check

**Files:**
- Create: `src/features/listingRequests/pages/RequestListingPage.tsx`
- Create: `src/features/listingRequests/pages/RequestListingPage.css`
- Create: `src/features/listingRequests/hooks/useExistingListingSearch.ts`
- Modify: `src/features/entities/components/EntityDirectoryPage.tsx` (add a link in the intro/footer area: `Not listed? Request a listing` → `/request-listing?kind=<kind>` for `school`, `venue`, `instructor`, `dj` directories; the hub page links to `/request-listing`)
- Modify: `src/app/App.tsx` (inside `<Route path="/" element={<MainLayout />}>`, next to `submit`: `<Route path="request-listing" element={<RequireAuth><RequestListingPage /></RequireAuth>} />` with a `lazy` import in the block at lines 86-92)
- Test: `src/features/listingRequests/pages/RequestListingPage.test.tsx`

**Interfaces:**
- Consumes: `fetchEntityDirectory({ kind, query, limit })` and `PublicEntityRef` from `src/features/entities/entitiesRepo.ts` (kind accepts `school`, `venue`, `instructor`, `dj`); `useSubmitMissingListing`, `MissingListingInput` (Task 2); `ListingRequestStatusList` (Task 3, `filter={(r) => r.request_type === "missing_listing"}`); `MANAGED_KINDS`, `MANAGED_KIND_LABELS`; `RequireAuth` (`src/features/auth/components/RequireAuth.tsx`).
- Produces: `export default function RequestListingPage()` at `/request-listing` (query `?kind=` preselects the kind); `useExistingListingSearch(kind: ManagedKind, term: string)` → `useQuery` of `PublicEntityRef[]`, enabled at length ≥ 2, limit 8, key `"listing-request-existing"`.

Flow and exact labels: heading `Request a listing`; intro "Check that it is not already in the directory. Requests are reviewed by Salsa Segura before anything is published." Fields: `Type of listing` (select of the four kind labels), `Name`, `City`, `Website` (full `https://` link, same validation message as the profile editor: "Website must be a full link starting with https://"), `Instagram`, `Anything that helps us verify it` (textarea, 2000 max). As the person types a name (≥ 2 chars) a region `Possible matches` lists directory hits as links to their public page with the text "Is it one of these? Open it and use Claim this …". Submit button `Send request` stays disabled until the checkbox `I searched and this listing is not here` is ticked and name is non-empty. After success: a `role="status"` message "Request sent. We will review it; you can follow it below." and the form resets. Below the form: `ListingRequestStatusList` headed `Your listing requests`. Server errors show verbatim in `role="alert"` and keep the typed values.

- [ ] **Step 1: Write failing tests** (mock `rpc` for `public_entity_directory`, `listing_request_submit_missing`, `my_listing_requests`; mock `useAuth` as in `PublicWorkspaceSurfaces.test.tsx`):
  - `it("lists directory matches while the name is typed")` — typing `Casa` calls `public_entity_directory` with `p_kind: "venue"`, `p_query: "Casa"`; `Casa Cuba` appears as a link to `/v/casa-cuba`.
  - `it("will not send until the existing-listing box is ticked")` — button disabled → tick → enabled.
  - `it("sends the typed fields with checked_existing true")` — `rpc` called with `p_name: "Casa Habana"`, `p_checked_existing: true`.
  - `it("keeps the typed values and shows the server's message on a duplicate")` — `{ message: "A listing with that name already exists. Search for it and claim it instead.", code: "23505" }` in `role="alert"`, input still holds `Casa Habana`.
  - `it("rejects a non-https website before calling the server")`.
  - `it("preselects the kind from ?kind=dj")`.
  - `it("shows the new request as Waiting for review")` after success.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/features/listingRequests/pages/RequestListingPage.test.tsx` → FAIL.
- [ ] **Step 3: Implement page, `useExistingListingSearch`, the directory link, and the route.** Debounce the name with `useDebouncedSearch` from `src/shared/hooks/useDebouncedSearch` (used in `AdminDjGigsSection.tsx`).
- [ ] **Step 4: Run to verify pass** — `npx vitest run src/features/listingRequests/pages src/features/entities` → PASS (the entities suite must still pass).
- [ ] **Step 5: Commit**

```bash
git add src/features/listingRequests src/features/entities/components/EntityDirectoryPage.tsx src/app/App.tsx
git commit -m "feat: guided request for a missing listing"
```

---

### Task 5: Workspace "Requests" section (event link and identity change)

**Files:**
- Create: `src/features/workspaces/pages/EntityWorkspaceRequestsPage.tsx`
- Create: `src/features/listingRequests/components/EventLinkRequestForm.tsx`
- Create: `src/features/listingRequests/components/ProfileChangeRequestForm.tsx`
- Modify: `src/features/workspaces/model.ts:37` (extend `WorkspaceSection` with `"requests"`)
- Modify: `src/features/workspaces/workspaceSections.ts` (after the `profile` entry, inside the same `canEditProfile(role)` branch: `{ key: "requests", label: "Requests", to: workspacePath(kind, id, "requests") }`)
- Modify: `src/features/workspaces/pages/EntityWorkspaceProfilePage.tsx:148-151` (replace "Contact Salsa Segura" link with `<Link to={workspacePath(kind, entity.id, "requests")}>Request a change</Link>`; copy: "The name, city and page address are set by Salsa Segura. Request a change if one is wrong.")
- Modify: `src/app/App.tsx:283-289` (add `<Route path="requests" element={<EntityWorkspaceRequestsPage kind={kind} />} />` inside the `MANAGED_KINDS.map` block and the `lazy` import)
- Modify: `src/features/admin/components/shell/AdminSidebar.test.tsx` and `src/features/workspaces/pages/EntityWorkspaceProfilePage.test.tsx` only where they assert the section list or the Contact link
- Test: `src/features/workspaces/pages/EntityWorkspaceRequestsPage.test.tsx`, `src/features/listingRequests/components/EventLinkRequestForm.test.tsx`

**Interfaces:**
- Consumes: `WorkspaceFrame` (`children: (workspace: EntityWorkspace) => ReactNode`), `canEditProfile`, `EVENT_LINK_KINDS`, `useEventLinkCandidates`, `useSubmitEventLinkRequest`, `useSubmitProfileChangeRequest`, `ListingRequestStatusList` (`filter` by `entity_id === workspace.entity.id`), `workspaceTestKit.tsx` (`renderWorkspacePage`, `member`).
- Produces: `export default function EntityWorkspaceRequestsPage({ kind }: { kind: ManagedKind })`; `EventLinkRequestForm(props: { kind: EventLinkKind; entityId: string; entityName: string })`; `ProfileChangeRequestForm(props: { kind: ManagedKind; entityId: string })`.

Behavior and labels: page masthead section `Requests`. Editors (who cannot reach it via the sidebar) opening the URL see the note "Only owners and managers can send requests for this listing." and no forms. For `instructor`/`dj`: form `Ask for an event to be added to <name>` with `Find an event` (search by title, results show title, date, location; a selected event shows its organizer-agnostic summary), optional `Note for the reviewer`, button `Send request`; a helper line "Salsa Segura checks every request. The event's organizer keeps control of the event." For all kinds: form `Ask for a change to name, city or page address` with `New name`, `New city`, `What should change and why` and button `Send request`; needs at least one field. Below, `ListingRequestStatusList` headed `Requests for <name>`. Venue and school pages show only the change form plus a note "Events at your venue are managed by their organizers. Ask the organizer, or contact them from the event page." Messages come from the server verbatim.

- [ ] **Step 1: Write failing tests**
  - `it("offers the event-link form to an Artist manager and sends it")` — selecting a candidate then `Send request` calls `listing_request_submit_event_link` with `{ p_kind: "instructor", p_entity_id, p_event_id, p_note }`; status list then shows `Waiting for review`.
  - `it("offers no event-link form on a venue workspace")` — `kind="venue"` shows only the change form and the organizer note.
  - `it("shows editors a refusal instead of the forms")` (role `editor`).
  - `it("shows the server message and keeps the selection when the request is refused")` — `23505` "You already asked for this link. It is waiting for review.".
  - `it("requires at least one field for an identity change")`.
  - `it("lists only this listing's requests")`.
  - In `workspaceSections` coverage (existing `AdminSidebar.test.tsx` plus a new case in `EntityWorkspaceRequestsPage.test.tsx`): `it("lists Requests for owners and managers but not editors")`.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/features/workspaces/pages/EntityWorkspaceRequestsPage.test.tsx src/features/listingRequests/components` → FAIL.
- [ ] **Step 3: Implement the page, two forms, section registration, route and the profile-page link.** Use `ws-form`, `ws-form__actions`, `WorkspaceField`, `admin-input` as in `EntityWorkspaceProfilePage.tsx`.
- [ ] **Step 4: Run to verify pass** — `npx vitest run src/features/workspaces src/features/listingRequests src/features/admin/components/shell/AdminSidebar.test.tsx` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/workspaces src/features/listingRequests src/app/App.tsx src/features/admin/components/shell/AdminSidebar.test.tsx
git commit -m "feat: request event links and identity changes from a workspace"
```

---

### Task 6: Admin review page and entry points

**Files:**
- Create: `src/features/admin/pages/AdminListingRequestsPage.tsx`
- Create: `src/features/admin/pages/AdminListingRequestsPage.css`
- Create: `src/features/admin/components/entities/AdminPendingListingRequestsNote.tsx`
- Modify: `src/features/admin/components/shell/AdminSidebar.tsx` (Desk section after `Listing Claims`, admin only: label `Listing Requests`, `to: "/admin/requests"`, with the pending count badge exactly as `Listing Claims` shows `usePendingEntityClaimCount`)
- Modify: `src/features/admin/entities/pages/AdminEntityDetailPage.tsx:195-203` (render `<AdminPendingListingRequestsNote kind={kind} id={current.id} />` for `instructor` and `dj` next to the gigs/linked-events block)
- Modify: `src/app/App.tsx` (add `<Route path="requests" element={<RequireAdmin><AdminListingRequestsPage /></RequireAdmin>} />` beside `claims`, lines 256-263, plus `lazy` import)
- Test: `src/features/admin/pages/AdminListingRequestsPage.test.tsx`, add cases to `src/features/admin/components/shell/AdminSidebar.test.tsx`

**Interfaces:**
- Consumes: `useAdminListingRequests`, `usePendingListingRequestCount`, `usePendingRequestsForListing`, `AdminListingRequest`, `requestStatusWord`, `requestHeadline` (Task 2); the page skeleton and components of `AdminEntityClaimsPage.tsx` (`Desk`, `DeskEmpty`, `DeskError`, `DeskSkeleton`, `MarginMark`, `AdminPageHeader`, `AdminViewTabs`, `AdminConfirmDialog`, tabs `Pending / Approved / Rejected / All`); admin entity pages at `/admin/<venues|schools|instructors|djs>/:id` (as `ADMIN_SEGMENT` in that file) and `/admin/<kind>s/new`.
- Produces: `export default function AdminListingRequestsPage()`; `export function AdminPendingListingRequestsNote(props: { kind: ManagedKind; id: string })` → renders nothing at zero, else a link `N pending requests` to `/admin/requests?kind=<kind>&entity=<id>` (page reads these query params and filters).

Each row shows: requester (display name or email) with their role on the listing ("Owner" / "Manager"), the request headline, requester's note, and by type — event link: event title as a link to `/admin/events?edit=<event_id>`, date, location, status, `Organizer: <name>` (or "No organizer"), and `Already on this profile` when `already_linked`; missing listing: proposed city/website/Instagram and a link `Create the listing` to `/admin/<kind>s/new`; identity change: requested name/city and a link `Open the listing` to its admin page. Actions: `Approve` and `Reject` (accessible names include the headline) opening `AdminConfirmDialog` with a note field; missing-listing approve also requires choosing the created listing (select over `useAdminEntityDirectory(kind, "", "active")` from `src/features/admin/entities/hooks/useAdminEntities.ts`) passed as `resultingEntityId`. Dialog body for event links states "This adds the event to the profile. It does not change the event or its organizer's access." Server refusals show verbatim and the row stays pending.

- [ ] **Step 1: Write failing tests**
  - `it("shows requester, role on the listing and the event's organizer for an event link")`.
  - `it("approves an event link and calls admin_review_listing_request with the note")` — `rpc` called with `{ p_request_id, p_approve: true, p_note, p_resulting_entity_id: null }`.
  - `it("keeps the request pending and shows the message when approval is refused")` — `{ message: "That event can no longer be linked.", code: "23514" }` in `role="alert"`; row still under Pending.
  - `it("requires choosing the created listing to approve a missing listing")`.
  - `it("filters to one listing from ?kind=dj&entity=…")`.
  - `it("rejects with a note and moves the row to Rejected")`.
  - Sidebar: `it("shows Listing Requests with the pending count to admins and hides it from moderators")`.
  - `AdminPendingListingRequestsNote`: renders nothing at 0 and `2 pending requests` linking to the filtered page at 2.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/features/admin/pages/AdminListingRequestsPage.test.tsx` → FAIL.
- [ ] **Step 3: Implement page, note, sidebar item, detail-page hook-up and route.** Copy tab/empty-state structure from `AdminEntityClaimsPage.tsx`; empty copy: `No requests are waiting on a decision.`
- [ ] **Step 4: Run to verify pass** — `npx vitest run src/features/admin` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/admin src/app/App.tsx
git commit -m "feat(admin): review listing requests"
```

---

### Task 7: Documentation

**Files:**
- Modify: `docs/user-guides/listing-access.md`, `docs/user-guides/artists.md`, `docs/user-guides/djs.md`, `docs/user-guides/venues.md`, `docs/user-guides/schools.md` (replace "contact the team" steps for missing listings, artist/DJ event associations and identity changes with the new `/request-listing` and workspace `Requests` flows and the status words)

**Interfaces:** Consumes the exact labels from Tasks 4-6. Produces nothing code depends on.

- [ ] **Step 1: Re-read each guide's current "contact the team" wording** (`grep -n "contact" docs/user-guides/*.md`) and list the sentences to replace.
- [ ] **Step 2: Update the guides** using only the labels above; state that venue claims do not give access to other organizers' events and that nothing publishes before review. Do not add screenshots.
- [ ] **Step 3: Commit**

```bash
git add docs/user-guides
git commit -m "docs: describe guided listing requests"
```

(`docs/` is gitignored except `docs/user-guides/*.md`; use `git add -f` for any path git refuses.)

---

## Self-review notes

- **Spec coverage:** requests with listing/event context → Tasks 1, 5; missing listings → Tasks 1, 4; identity changes → Tasks 1, 5; organizer authority → Task 1 live SQL checks; request status → Tasks 3–6; existing-listing check → Task 4 and server validation.
- **Type consistency:** RPC names/params in Task 1 match repo calls in Task 2; `ListingRequest` / `AdminListingRequest` keys are the RPC output keys; `EventLinkKind`, `requestStatusWord`, `requestHeadline`, `ListingRequestStatusList` props are used identically in Tasks 3-6.
- **Verification:** Task 1 executes real RPC/RLS scenarios against disposable Postgres. SQL source-text assertions are not behavioral proof.

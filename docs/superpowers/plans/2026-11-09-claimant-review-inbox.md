# Claimant Review Inbox Implementation Plan

> **Execution:** Implement inline, task by task; do not start subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Execution status — November 11, 2026:** Tasks 1–5 and 8 implemented and committed locally. Tasks 6–7 remain gated and unimplemented; no deployment, production migration, or email delivery performed. Verified with disposable Postgres role/access assertions (including migration reapplication), 268 affected tests, TypeScript, targeted ESLint, and desktop/mobile browser rendering with isolated local fixtures. Membership refresh failures block workspace actions and support retry. Browser review also added the shared button stylesheet explicitly. Reviewer copy uses a standalone claimant-visibility sentence; no wording-only tests were added. Archive acceptance respects the existing active-team guard. Review performed inline without subagents. Production rollout still requires comparing the live RPC definition/grants and separately applying the migration.

**Goal:** A signed-in claimant can open one page that lists every listing claim they made, with its state, the reviewer's note when there is one, and the one next action that state permits (open the workspace after approval, claim again after rejection).

**Architecture:** `my_entity_claims()` (already scoped to `auth.uid()`) gains two derived keys, `listing_status` and `workspace_role`, so the client never guesses access. A pure function `buildClaimInbox` turns claims into display items; a new page at `/account/claims` renders them, and the Account page and the listing claim control link to it. Decision email is a separate, gated task that only ships after the delivery path is verified with a real address.

**Tech Stack:** React 19 + TypeScript + Vite, TanStack Query, react-router, Supabase RPC (Postgres `security definer`), Deno Edge Functions + Resend (Task 6 only), vitest + Testing Library.

**Spec:** No approved spec exists. The requirement is item 10, "P3 — Give claimants a clear review inbox", in `docs/user-guides/improvements.md` (lines 101-108). Decisions the item leaves open are listed below and the tasks are written against the recommended defaults.

## Decisions to confirm

- **D1 Location.** Recommend a standalone page at `/account/claims`. Reason: `/host/*` is behind `RequireOrganizer`, which redirects anyone without an organizer role or an active membership to `/` (`src/features/auth/components/RequireOrganizer.tsx`), so a claimant with only pending claims cannot see anything there. If the owner prefers a Host-dashboard section, Task 4 moves into `HostDashboard.tsx` and `RequireOrganizer` must also admit users who have a pending claim.
- **D2 Entry points.** Recommend a card on the Account page (only when the user has at least one claim) plus a link from the listing's claim control. If the owner also wants a top-nav or header entry, add a Task 5 step in the header component; nothing else changes.
- **D3 History.** Recommend listing every claim, newest first, in two sections ("Waiting for review", "Decided"), with an action only on the newest claim per listing. If the owner wants only the latest claim per listing, `buildClaimInbox` drops older ones instead of suppressing their action.
- **D4 Decision notes.** Recommend showing `review_note` to the claimant verbatim on rejected and approved claims (the listing page already does this for rejections) and changing the admin reject dialog to say so (Task 3). If the owner wants notes to stay internal, the inbox and `EntityClaimControl` stop showing them and Task 3 is dropped; if they want a separate claimant-facing message, a new column plus an `admin_review_entity_claim` change is required.
- **D5 Withdraw a pending claim.** Recommend not included: no RPC sets `withdrawn` today (the check constraint allows it). If included, add `entity_claim_withdraw(p_claim_id uuid)` and a "Withdraw claim" button on pending items; the inbox already renders a `withdrawn` state.
- **D6 Decision email.** Recommend one transactional email per decision to the claimant's account address, no preference toggle (they asked for the review, like the existing submission-decision emails), with no review note in the body. Task 6-7 are gated on this decision AND on a verified Resend path. If the owner wants no email, delete Tasks 6-7; if they want opt-in, the preference storage does not exist for this and a new column and UI are required.
- **D7 Claim again.** Recommend a link to the public listing page, where the existing claim dialog lives. If the owner wants it inline, render `EntityClaimDialog` from the inbox item instead of a link (it already invalidates `MY_ENTITY_CLAIMS_KEY`).

## Global Constraints

- Each inbox item shows: listing name, current state, decision note "when appropriate" (D4), and the next permitted action.
- Approvals link to the actual workspace: `workspacePath(kind, entity_id)` from `src/features/workspaces/model.ts` (`/host/schools/:id` etc.), never a generic page.
- Do not promise a review deadline or an email until the delivery path exists and is verified. Until Task 7 step 6 ships, no inbox, card, or control text may mention email, days, hours, or "within".
- Any notification work is Task 6-7 only, behind an explicit gate; Tasks 1-5 and 8 must ship without it.
- A claimant sees only their own claims: `my_entity_claims()` filters `c.user_id = auth.uid()`; `entity_claims` has RLS enabled and no table grants, so RPCs are the only path. Do not add a table policy, a new read path, or an RPC parameter that selects another user.
- Migrations: new file only, never edit an existing one; `security definer`, `set search_path = public, pg_temp`, `revoke all ... from public, anon, authenticated` then explicit `grant execute ... to authenticated`; idempotent.
- UI: reuse `ui-button`, existing design tokens (`--border`, `--gold`, `--surface-high`, `--text-dim`), and the Account/Host card patterns; accessible names on every control; no new dependencies or tokens.
- Tests: vitest + Testing Library, colocated; behaviour only, no snapshots.
- Clean cutover: remove code a task makes obsolete (the admin page's local `PUBLIC_SEGMENT`).

## Review Focus

Failure modes the spec implies but the tasks' main flows do not exercise; each has a named test in the owning task.

1. **Stale membership cache after approval** (Task 4): `useMyEntityMemberships` has `staleTime: 30_000`, so "Open workspace" can hit `RequireOrganizer` with an empty cached list and bounce the user to `/`. Expect the link to work the first time.
2. **Access removed after approval** (Tasks 1, 2): an approved claim whose member was later removed must not offer "Open workspace".
3. **Newer claim supersedes an older rejection** (Task 2): a rejected claim must not say "claim again" when a pending or approved claim exists for the same listing.
4. **Archived listing** (Tasks 1, 2): state is shown, no action leads to a dead workspace or a claim form.
5. **Free-text note** (Task 4): a 2000-character note with markup-like text must render as plain text, and a `withdrawn` claim must render without a note or crash.

---

### Task 1: Expose listing state and workspace access on `my_entity_claims`

**Files:**
- Create: `supabase/migrations/20261109130000_my_entity_claims_inbox.sql`
- Create: `supabase/tests/claim_inbox.sql`

**Interfaces:**
- Consumes: `public.entity_claims`, `public.entity_workspace_ref(text, uuid)` and `public.entity_workspace_role(text, uuid)` (both defined in `20261008000000_entity_workspaces.sql`, extended for `dj` in `20261017000000_dj_profiles.sql`; both revoked from clients but callable from this `security definer` function).
- Produces: `public.my_entity_claims() returns jsonb`, same signature, same grants, rows still ordered `created_at desc`, every existing key kept (`id, kind, entity_id, name, slug, relationship, status, review_note, created_at, reviewed_at`) plus `listing_status text` (`r.status`, e.g. `active | archived | needs_review`) and `workspace_role text | null` (`entity_workspace_role(c.entity_kind, c.entity_id)`: `owner | manager | editor | admin | null`; null when the member was removed, the account is inactive, or the listing is archived).

- [ ] **Step 1: Write `supabase/tests/claim_inbox.sql`.** Within a rollback transaction, create two claimants with distinct claims and impersonate each through `SET LOCAL ROLE authenticated` plus JWT claims. Assert each sees only their own claims, preserves review notes, and gets the correct listing status and effective workspace role. Anonymous execution must fail with insufficient privilege.
- [ ] **Step 2: Run on disposable local Postgres before the feature migration.** `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/claim_inbox.sql`. Expected: missing new response fields. Confirm the target is local/disposable. Docker is optional; the repository migration chain can run on Homebrew Postgres with Supabase platform stubs.

- [ ] **Step 3: Write the migration.** `create or replace function public.my_entity_claims()` (the function is 11 lines, so a full replacement is acceptable here; keep it `language sql stable security definer set search_path = public, pg_temp`), then restate the revoke/grant lines. Header comment must say the change is additive and that the live definition must be compared first (see Step 6).
- [ ] **Step 4: Add access-transition assertions.** Approval plus active membership yields `workspace_role = 'owner'`; removing membership yields null; archiving the listing yields `listing_status = 'archived'` and no workspace role. Changing account status must not disclose another claimant's rows. Preserve all previous response fields.
- [ ] **Step 5: Apply the migration locally and execute the SQL script.** Expected: all assertions pass. Run as actual anon/authenticated roles, not solely a superuser. Reapply to verify idempotence.
- [ ] **Step 6: Record deployment prerequisites.** Before a separately authorized production rollout, compare the live function definition and grants. Never use production for acceptance fixtures or apply migrations there from this plan.
- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261109130000_my_entity_claims_inbox.sql supabase/tests/claim_inbox.sql
git commit -m "feat(claims): expose listing state and workspace access on my_entity_claims"
```

### Task 2: Claim inbox model

**Files:**
- Modify: `src/features/workspaces/model.ts` (`EntityClaim` at line 266; add helper near `workspacePath` at line 42)
- Create: `src/features/workspaces/claimInbox.ts`
- Test: `src/features/workspaces/claimInbox.test.ts`
- Modify: `src/features/admin/pages/AdminEntityClaimsPage.tsx` (remove `PUBLIC_SEGMENT` at line 48; use the helper at line 177)
- Modify: `src/features/workspaces/components/public/PublicWorkspaceSurfaces.test.tsx` (the two `EntityClaim` fixtures at lines 152 and 162 gain the new required fields)

**Interfaces:**
- Consumes: Task 1 keys; `workspacePath`, `MANAGED_KIND_LABELS`, `CLAIM_RELATIONSHIP_LABELS`, `MEMBER_ROLE_LABELS` from `model.ts`.
- Produces in `model.ts`:
  - `EntityClaim` gains `listing_status: string` and `workspace_role: WorkspaceRole | null`.
  - `publicEntityPath(kind: ManagedKind, slug: string): string` returning `/s/:slug`, `/v/:slug`, `/i/:slug`, `/dj/:slug` (matches the public routes in `src/app/App.tsx`).
- Produces in `claimInbox.ts`:
  - `type ClaimInboxAction = { kind: "open_workspace" | "view_listing"; label: string; to: string }`
  - `type ClaimInboxItem = { claim: EntityClaim; section: "open" | "decided"; stateLabel: "Waiting for review" | "Approved" | "Not approved" | "Withdrawn" | "Listing archived"; summary: string; note: string | null; action: ClaimInboxAction | null }`
  - `buildClaimInbox(claims: EntityClaim[]): ClaimInboxItem[]` — input is newest-first as the RPC returns it; output keeps that order.

- [ ] **Step 1: Write failing tests** in `claimInbox.test.ts` (`describe("buildClaimInbox")`), each with a `claim()` fixture factory:
  - `pending claim: section open, label "Waiting for review", no action, no note, summary has no email/deadline wording` (assert `summary` does not match `/email|day|hour|within/i`).
  - `approved with workspace access: label "Approved", action {kind:"open_workspace", label:"Open workspace", to:"/host/schools/school-1"}`.
  - `approved after access was removed (workspace_role null, listing active): label "Approved", action view_listing "View listing to claim again", summary says access has changed` (Review Focus 2).
  - `rejected: label "Not approved", note is trimmed review_note, action view_listing "View listing to claim again" to "/s/ritmo-vivo"`.
  - `rejected with blank review_note: note is null`.
  - `rejected but a newer pending claim exists for the same listing: action null` (Review Focus 3); same for a newer approved claim with access.
  - `archived listing: label "Listing archived", action null, for pending, approved and rejected claims` (Review Focus 4).
  - `withdrawn: label "Withdrawn", note null even if review_note is set`.
  - `pending and rejected claims for different listings do not suppress each other`.
  - `publicEntityPath maps instructor to /i/ and dj to /dj/`.
- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/workspaces/claimInbox.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `EntityClaim` additions and `publicEntityPath` in `model.ts`, then `buildClaimInbox` in `claimInbox.ts`. Rules: `section` is `"open"` only for `pending`; a note is returned only for `approved` and `rejected`, trimmed, `null` when empty; "newer" means earlier in the input array for the same `(kind, entity_id)`; an action is suppressed on a claim when any newer claim for the listing is `pending`, or `approved` with `workspace_role !== null`; `listing_status === "archived"` overrides everything with the "Listing archived" label and no action. Summary copy (exact): pending `"Our team is reviewing this claim. You don't need to do anything yet."`; approved with access `"You can now manage {name}."`; approved without access `"Your access to {name} has changed since this was approved."`; rejected `"This claim wasn't approved."`; withdrawn `"This claim was withdrawn."`; archived `"{name} is no longer listed."`.
- [ ] **Step 4: Cut over the admin page.** In `AdminEntityClaimsPage.tsx` delete the `PUBLIC_SEGMENT` constant and use `publicEntityPath(claim.kind, claim.entity_slug)` for the listing link. Update the two fixtures in `PublicWorkspaceSurfaces.test.tsx` with `listing_status: "active"` and `workspace_role: null`.
- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/features/workspaces/claimInbox.test.ts src/features/admin/pages/AdminEntityClaimsPage.test.tsx src/features/workspaces/components/public/PublicWorkspaceSurfaces.test.tsx`
Expected: PASS (existing admin test asserting the listing link `/s/ritmo-vivo` still passes).
- [ ] **Step 6: Commit**

```bash
git add src/features/workspaces/model.ts src/features/workspaces/claimInbox.ts src/features/workspaces/claimInbox.test.ts src/features/admin/pages/AdminEntityClaimsPage.tsx src/features/workspaces/components/public/PublicWorkspaceSurfaces.test.tsx
git commit -m "feat(claims): derive claim inbox items and share the public listing path"
```

### Task 3: Tell reviewers the note reaches the claimant

**Files:**
- Modify: `src/features/admin/pages/AdminEntityClaimsPage.tsx:296` (reject dialog `body`)
- Test: `src/features/admin/pages/AdminEntityClaimsPage.test.tsx` (existing test `rejects through a dialog and passes the optional note`, line 127)

**Interfaces:**
- Consumes: `AdminConfirmDialog` `body` and `reasonField` props (already used at lines 293-304).
- Produces: nothing for other tasks. Only applies if D4 is confirmed.

- [ ] **Step 1: Write the failing assertion** in a new test `reject dialog says the note is shown to the claimant`: open Reject for the first claim; expect the dialog to contain the text `The claimant will see this note.` and the field label `Note (optional)` to be unchanged.
- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/admin/pages/AdminEntityClaimsPage.test.tsx -t "shown to the claimant"`
Expected: FAIL.

- [ ] **Step 3: Replace the body copy** with `They will not be able to manage {name}. The claimant will see this note on their claims page and on the listing; keep it factual.` Keep the sentence `The claimant will see this note.` verbatim inside it so the assertion holds.
- [ ] **Step 4: Run the full file**

Run: `npx vitest run src/features/admin/pages/AdminEntityClaimsPage.test.tsx`
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/admin/pages/AdminEntityClaimsPage.tsx src/features/admin/pages/AdminEntityClaimsPage.test.tsx
git commit -m "feat(claims): tell reviewers the rejection note is shown to the claimant"
```

### Task 4: Claims inbox page at `/account/claims`

**Files:**
- Create: `src/features/workspaces/hooks/useClaimInbox.ts`
- Create: `src/features/workspaces/pages/MyClaimsPage.tsx`
- Create: `src/features/workspaces/pages/MyClaimsPage.css`
- Test: `src/features/workspaces/pages/MyClaimsPage.test.tsx`
- Modify: `src/app/App.tsx` (add one route beside `account`, lines 350-359; lazy import beside line 73)

**Interfaces:**
- Consumes: `useMyEntityClaims`, `useMyEntityMemberships`, `MY_ENTITY_CLAIMS_KEY`, `MY_ENTITY_MEMBERSHIPS_KEY` (`src/features/workspaces/hooks/useMyEntityMemberships.ts`); `buildClaimInbox`, `ClaimInboxItem` (Task 2); `MANAGED_KIND_LABELS`, `CLAIM_RELATIONSHIP_LABELS`, `publicEntityPath` (`model.ts`).
- Produces:
  - `useClaimInbox(): { items: ClaimInboxItem[]; isLoading: boolean; isError: boolean; refetch: () => void }`. On mount it refetches both the claims and the memberships queries and keeps `isLoading` true until both settle, so "Open workspace" is never shown before `RequireOrganizer`'s cached memberships include the listing.
  - `export default function MyClaimsPage()` (default export, lazy-loaded like its neighbours), route path `account/claims`, wrapped in `RequireAuth` + `RequireOnboarding` exactly like `account`.

- [ ] **Step 1: Write failing tests** in `MyClaimsPage.test.tsx`, mocking `../../../lib/supabase` (`{ supabase: { rpc } }`) and `../../../contexts/useAuth` like `PublicWorkspaceSurfaces.test.tsx`, rendering inside `QueryClientProvider` + `MemoryRouter`:
  - `shows loading, then claims in "Waiting for review" and "Decided" sections` (headings `Waiting for review` and `Decided`; each listing name is a link to its `publicEntityPath`).
  - `approved item links to the workspace: link "Open workspace" has href "/host/schools/school-1"`.
  - `does not show Open workspace until memberships have been refetched` (Review Focus 1): make `my_entity_memberships` resolve late; assert no `Open workspace` link while pending, then present with the membership list fetched after the claims.
  - `rejected item shows the reviewer's note and "View listing to claim again"`.
  - `renders a 2000-character note containing "<b>x</b>" as literal text` and a `withdrawn` claim without a note (Review Focus 5).
  - `empty state: "You haven't claimed any listings yet." with a link "Browse listings" to /discover`.
  - `error state: role alert "We couldn't load your claims." and a "Try again" button that refetches`.
  - `shows no email or deadline wording` (the whole page text does not match `/email|within|business day|hours/i`) with one pending, one approved and one rejected claim.
  - `only the claims the RPC returns are rendered` (two claims returned, exactly two list items; asserts the page never calls any RPC other than `my_entity_claims` and `my_entity_memberships`).
- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/workspaces/pages/MyClaimsPage.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `useClaimInbox`** in `useClaimInbox.ts`: `useMyEntityClaims()` plus an effect that runs `queryClient.refetchQueries({ queryKey: [MY_ENTITY_CLAIMS_KEY] })` and the same for `MY_ENTITY_MEMBERSHIPS_KEY` once on mount, flipping a local `refreshed` state when both settle (success or failure); `items = buildClaimInbox(data ?? [])` memoised.
- [ ] **Step 4: Implement `MyClaimsPage`.** `<h1>Listing claims</h1>` with a one-line intro `Claims you've made to manage a school, venue, artist or DJ listing.` Two `<section aria-labelledby>` blocks. Each item is an `<li>` with: listing link, kind label, relationship label (`CLAIM_RELATIONSHIP_LABELS`), submitted date (`Intl.DateTimeFormat("en-US", { dateStyle: "medium" })`), state label, summary, a note paragraph labelled `Reviewer's note:` when `note` is set (rendered as text with `white-space: pre-wrap; overflow-wrap: anywhere` in the CSS), and the action as a `Link` with class `ui-button ui-button--secondary` (`ui-button--primary` for `open_workspace`). Skeleton text `Loading your claims…` with `role="status"`. Empty and error states as the tests specify. CSS file uses the tokens already used in `EntityClaimControl.css`.
- [ ] **Step 5: Register the route** in `src/app/App.tsx`: `const MyClaimsPage = lazy(() => import("../features/workspaces/pages/MyClaimsPage"));` and `<Route path="account/claims" element={<RequireAuth><RequireOnboarding><MyClaimsPage /></RequireOnboarding></RequireAuth>} />` directly after the `account` route.
- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/features/workspaces/pages/MyClaimsPage.test.tsx`
Expected: PASS.
- [ ] **Step 7: Commit**

```bash
git add src/features/workspaces/hooks/useClaimInbox.ts src/features/workspaces/pages/MyClaimsPage.tsx src/features/workspaces/pages/MyClaimsPage.css src/features/workspaces/pages/MyClaimsPage.test.tsx src/app/App.tsx
git commit -m "feat(claims): add the claimant review inbox at /account/claims"
```

### Task 5: Entry points from the Account page and the claim control

**Files:**
- Create: `src/pages/account/AccountClaimsCard.tsx`
- Test: `src/pages/account/AccountClaimsCard.test.tsx`
- Modify: `src/pages/account/AccountPage.tsx` (render the card after `capabilityCards.map`, inside `.account-page__capability-grid`, line 504-525)
- Modify: `src/pages/account/AccountPage.test.tsx` (mock the card module; the page test has no `QueryClientProvider`)
- Modify: `src/features/workspaces/components/public/EntityClaimControl.tsx` (pending block lines 75-83; rejected block lines 90-107)
- Modify: `src/features/workspaces/components/public/PublicWorkspaceSurfaces.test.tsx` (tests at lines 150 and 160)

**Interfaces:**
- Consumes: `useMyEntityClaims` (hook), `EntityClaim`, the route `/account/claims` (Task 4); Account card classes `account-page__card`, `account-page__capability-card`, `account-page__capability-title-row`, `account-page__capability-actions`, `account-page__capability-link`, `account-page__capability-link--primary` from `AccountPage.css`.
- Produces: `export default function AccountClaimsCard(): JSX.Element | null`. Returns `null` while loading, on error, or when the user has no claims. Otherwise an `<article>` with heading `Listing claims`, text `{n} waiting for review` (when `n > 0`) or `Check the status of your listing claims.`, and a primary link `Open your claims` to `/account/claims`.

- [ ] **Step 1: Write failing tests.** `AccountClaimsCard.test.tsx`: `renders nothing when the user has no claims`; `renders nothing when the claims request fails`; `counts only pending claims and links to /account/claims` (two pending, one rejected → `2 waiting for review`); `says "Check the status of your listing claims." when nothing is pending`. In `PublicWorkspaceSurfaces.test.tsx`: extend `shows the waiting state for a pending claim` and `shows a rejection note and allows a new claim` to also expect a link `See all your claims` with href `/account/claims`.
- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/account/AccountClaimsCard.test.tsx src/features/workspaces/components/public/PublicWorkspaceSurfaces.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the card, mount it in `AccountPage.tsx`, add `vi.mock("./AccountClaimsCard", () => ({ default: () => null }))` to `AccountPage.test.tsx`, and add a `Link` `See all your claims` (class `entity-claim-control__link`) to the pending and rejected states of `EntityClaimControl`. Do not change the `Your claim is waiting for review.` text; existing tests and `EntityClaimDialog` rely on it.
- [ ] **Step 4: Run the affected tests**

Run: `npx vitest run src/pages/account src/features/workspaces/components/public`
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/pages/account src/features/workspaces/components/public
git commit -m "feat(claims): link the claims inbox from the Account page and the claim control"
```

### Task 6: GATED — decision-email function (do not start until the gate is met)

**Gate (both required, recorded in the commit message of this task):** (a) the owner confirmed D6; (b) an operator confirms that the Resend sending domain used by `send-submission-email` (`contact.salsasegura.com` per `docs/operations/event-submission-email-notifications.md`) and the `RESEND_API_KEY` secret exist on the target Supabase project. This plan has not verified either. If the gate is not met, stop here; Tasks 1-5 and 8 are complete without it.

**Files:**
- Create: `supabase/migrations/20261109130100_entity_claim_decision_email.sql`
- Create: `supabase/functions/_shared/claimDecisionEmail.ts`
- Test: `supabase/functions/_shared/claimDecisionEmail.test.ts`
- Create: `supabase/functions/send-claim-decision-email/index.ts`
- Test: `supabase/functions/send-claim-decision-email/index.test.ts`
- Modify: `supabase/config.toml` (new `[functions.send-claim-decision-email]` block, `verify_jwt = false` with the same "internal admin check is the sole enforcement point" comment as `send-founder-welcome-email`, line 464)

**Interfaces:**
- Consumes: the claim/complete pattern of `claim_founder_welcome_email()` / `complete_founder_welcome_email(p_status, p_error_code)` in `20260901000000_founder_organization_provisioning.sql` (lines 349-440); `layout`, `plainText`, `EmailContent`, `classifyResendFailure` from `supabase/functions/_shared/emailLayout.ts`; `createSendFounderWelcomeEmailHandler` as the handler-factory shape; `platform_settings` columns `platform_name`, `public_site_url`.
- Produces:
  - Columns on `public.entity_claims`: `decision_email_status text check (decision_email_status in ('pending','sent','failed'))`, `decision_email_error text`. Not exposed: `entity_claims` has no client grants and `my_entity_claims` whitelists its keys.
  - `public.claim_entity_claim_decision_email(p_claim_id uuid) returns jsonb` — admin-only (`is_admin()` and `account_is_active`, errcode `42501`), atomically sets `decision_email_status = 'pending'` where it is null and `status in ('approved','rejected')`, returns `{claimed: false}` otherwise; on success `{claimed: true, status, recipient_email (auth.users.email), entity_name, kind, entity_id, platform_name, public_site_url}`. Raises `P0002` for an unknown claim.
  - `public.complete_entity_claim_decision_email(p_claim_id uuid, p_status text, p_error_code text default null) returns boolean` — admin-only, only moves `pending` to `sent|failed`.
  - `claimDecisionEmail(input: { status: "approved" | "rejected"; entityName: string; platformName: string; publicSiteUrl: string; workspaceUrl: string; claimsUrl: string }): EmailContent`. Approved: CTA label `Open your workspace` to `workspaceUrl`. Rejected: CTA label `View your claims` to `claimsUrl`; the body never includes the review note.
  - `createSendClaimDecisionEmailHandler(deps)`; request body `{ claimId: string }` (UUID-validated, body size capped like `send-submission-email`); the recipient is never read from the request.

- [ ] **Step 1: Write failing tests.** `claimDecisionEmail.test.ts` (`deno test`, assertions from `@std/assert` as in `authEmail.test.ts`): approved subject contains the entity name and html contains `workspaceUrl`; rejected html contains `claimsUrl` and does not contain the word `note`; an entity name containing `<script>` is escaped in html. `index.test.ts` (model on `send-founder-welcome-email/index.test.ts`): `401 without a Bearer token`; `a non-admin caller gets 403 and nothing is sent` (claim RPC raises `42501`); `a second call for the same claim sends nothing and returns deduplicated: true`; `recipient comes from the claim RPC, never the request body` (body carries `to: "attacker@example.com"`, sent message `to` is the RPC address); `a Resend failure records failed and returns 502`; `a thrown send records failed`.
- [ ] **Step 2: Run to verify failure**

Run: `deno test --allow-env --allow-net --allow-read supabase/functions/_shared/claimDecisionEmail.test.ts supabase/functions/send-claim-decision-email/index.test.ts`
Expected: FAIL (modules not found). If Deno is not installed locally, say so in the report; the repo's other function tests were also run in a separate environment (`docs/operations/phase5-founder-invitation-email.md`, line 289).

- [ ] **Step 3: Implement** the migration (with the same revoke/grant convention as the entity_workspaces migration, lines 683-714), the template, the handler and the `config.toml` block. Handler flow: validate Bearer, validate body, call `claim_entity_claim_decision_email` with the caller's JWT, return `{ success: true, deduplicated: true }` when `claimed` is false, build URLs as `${public_site_url}${workspacePath(kind, entity_id)}` and `${public_site_url}/account/claims` (Edge Functions cannot import from `src/`, so copy the four-entry segment map into the function with a comment pointing at `WORKSPACE_SEGMENTS` in `src/features/workspaces/model.ts`), send via Resend with `idempotencyKey = "entity-claim-decision:" + claimId`, then call `complete_entity_claim_decision_email`.
- [ ] **Step 4: Run the Deno tests**

Run: the Step 2 command.
Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261109130100_entity_claim_decision_email.sql supabase/functions/_shared/claimDecisionEmail.ts supabase/functions/_shared/claimDecisionEmail.test.ts supabase/functions/send-claim-decision-email supabase/config.toml
git commit -m "feat(claims): add the send-claim-decision-email function (gated)"
```

### Task 7: GATED — send on review, verify delivery, then announce it

**Gate:** Task 6 merged, migration applied, `npx supabase functions deploy send-claim-decision-email` run by the operator. Steps 1-3 are code and can be built before deployment; Step 4 is a human verification; Step 5 ships user-visible email wording only after Step 4 passes.

**Files:**
- Modify: `src/features/workspaces/api/workspacesRepo.ts` (add after `reviewEntityClaim`, line 111)
- Modify: `src/features/admin/hooks/useAdminEntityClaims.ts` (`reviewMutation.onSuccess`, line 69)
- Test: `src/features/admin/pages/AdminEntityClaimsPage.test.tsx`
- Modify: `src/features/workspaces/pages/MyClaimsPage.tsx` and its test (Step 5 only)

**Interfaces:**
- Consumes: `supabase.functions.invoke` pattern in `src/features/admin/api/profilesRepo.ts:114`; function contract from Task 6.
- Produces: `sendClaimDecisionEmail(claimId: string): Promise<void>` in `workspacesRepo.ts`; catches every failure internally and resolves, so a failed email can never fail or roll back the review (the decision is already committed).

- [ ] **Step 1: Write failing tests** in `AdminEntityClaimsPage.test.tsx`, extending the `rpc` mock with a `functions: { invoke }` mock on `../../../lib/supabase`: `approving sends the decision email request with the claim id` (`invoke` called with `"send-claim-decision-email", { body: { claimId: "claim-1" } }`); `rejecting sends it too`; `a failing email request does not block or error the decision` (invoke rejects; the row still leaves the pending galley and no alert is shown).
- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/admin/pages/AdminEntityClaimsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** `sendClaimDecisionEmail` (catch every error inside and resolve) and call it fire-and-forget from `onSuccess` with the reviewed `claimId` (`onSuccess: (_result, variables) => ...`).
- [ ] **Step 4: Verify delivery (human, blocks Step 5).** With a real mailbox as the claimant: approve one claim and reject another through `/admin/claims`; confirm both emails arrive, the approved link opens the workspace, the rejected link opens `/account/claims`, a second click on a decided row sends nothing, and `select id, status, decision_email_status, decision_email_error from public.entity_claims where id in (...)` shows `sent`. Record the result and date in `docs/operations/entity-claim-decision-email.md` (docs/ is gitignored here, so `git add -f` it, as the other ops docs were). If delivery fails, stop; Step 5 must not ship.
- [ ] **Step 5: Announce the email.** Add the sentence `We'll also email you when a decision is made.` under the page intro in `MyClaimsPage.tsx`; update the test `shows no email or deadline wording` to assert this sentence is present and that `within`, `day`, `hour` still do not appear.
- [ ] **Step 6: Run and commit**

Run: `npx vitest run src/features/admin/pages/AdminEntityClaimsPage.test.tsx src/features/workspaces/pages/MyClaimsPage.test.tsx`
Expected: PASS.

```bash
git add src/features/workspaces/api/workspacesRepo.ts src/features/admin/hooks/useAdminEntityClaims.ts src/features/admin/pages/AdminEntityClaimsPage.test.tsx
git commit -m "feat(claims): email claimants when their claim is decided"
git add src/features/workspaces/pages/MyClaimsPage.tsx src/features/workspaces/pages/MyClaimsPage.test.tsx
git commit -m "feat(claims): tell claimants about decision emails after verified delivery"
```

### Task 8: Update the user guides

**Files:**
- Modify: `docs/user-guides/listing-access.md` (lines 31, 36, 79, 82: they say to "revisit the same listing" and "do not assume an email will arrive")
- Modify: `docs/user-guides/improvements.md` (item 10, lines 101-108: mark what shipped and what remains gated)

**Interfaces:**
- Consumes: shipped behaviour of Tasks 1-5, and Tasks 6-7 only if they shipped.
- Produces: guides that describe the shipped behaviour only.

- [ ] **Step 1: Edit `listing-access.md`:** point claim-status checks at **Account → Listing claims** (`/account/claims`), describe the four states and their actions exactly as `buildClaimInbox` words them, keep "do not assume an email will arrive" unless Task 7 Step 4 passed, in which case replace it with the verified behaviour.
- [ ] **Step 2: Edit `improvements.md` item 10:** state what shipped, keep the email part marked as not shipped when Tasks 6-7 were not done, and note D5 (withdraw) as not implemented.
- [ ] **Step 3: Commit** (these files are gitignored/tracked per the repo's existing arrangement; use `git add -f` only for files already tracked or explicitly requested)

```bash
git add -f docs/user-guides/listing-access.md docs/user-guides/improvements.md
git commit -m "docs(claims): document the claims inbox"
```

---

## Self-review (run against the spec)

- **Spec coverage:** listing name, state, note, next action → Tasks 2 and 4; central list → Tasks 4-5; approvals link to the workspace → Task 2 (`workspacePath`) and Task 4 test; no deadline/email promise until verified → Global Constraints, Task 4 test, Task 7 gate; "opt-in or appropriate transactional notification" → D6, Tasks 6-7; claimant sees only own claims → Global Constraints, Task 1 guard test and smoke SQL, Task 4 test.
- **Type consistency:** `EntityClaim.listing_status` / `workspace_role` (Task 2) match the RPC keys (Task 1); `ClaimInboxItem` and `buildClaimInbox` (Task 2) are the names consumed in Task 4; `/account/claims` is the same path in Tasks 4, 5 and 6; `MY_ENTITY_CLAIMS_KEY` and `MY_ENTITY_MEMBERSHIPS_KEY` exist in `useMyEntityMemberships.ts`.
- **Review Focus coverage:** items 1 → Task 4; 2 → Tasks 1-2; 3 → Task 2; 4 → Tasks 1-2; 5 → Task 4.
- **Unverified here:** every SQL step (no database), Deno tests (not run), and the whole delivery path (Resend domain, secret, deployment). Task 1 Step 6 and Task 7 Step 4 carry those checks.

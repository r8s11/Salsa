# Phase 3 — Founder Request Admin Review Implementation Plan

## Overview
Build the admin workflow for reviewing Founder access requests: `Pending → Approved` or `Pending → Rejected`.

## Architecture Decisions

### 1. Route & Access Control
- **Route**: `/admin/founder-requests` (follows existing `/admin/organizer-requests` pattern)
- **Guard**: `RequireReviewer` (requires `isModerator` — includes both admin & moderator)
- **Mutation permissions**: Only admins can approve/reject (checked via `is_admin()` in RPC)

### 2. Backend: Server-side Review API
**Edge Function**: `review-founder-request` (new)
- POST `/functions/v1/review-founder-request`
- Payload: `{ requestId, decision: "approve" | "reject", reasonCode?, message? }`
- Server-side authorization: checks `is_admin()` via `auth.jwt() -> 'app_metadata' ->> 'role'`
- Returns: `{ success: true, status: "approved" | "rejected" }` or `{ error, code }`

**Alternative: SECURITY DEFINER RPC** - Following the organizer_requests pattern, use a Postgres RPC:
- `admin_review_founder_request(p_request_id uuid, p_decision text, p_reviewer_id uuid, p_reason_code text, p_reason_message text)`
- Checks `is_admin()` internally
- Updates status, reviewed_by, reviewed_at, rejection fields
- Returns `{ success: boolean }` or raises error

**Decision**: Use SECURITY DEFINER RPC — matches the organizer_requests pattern, simpler for TanStack Query mutations, leverages existing `is_admin()` function, avoids JWT verification complexity in edge function.

### 3. Database RPCs to Create
1. `admin_review_founder_request(p_request_id uuid, p_decision text, p_reviewer_id uuid, p_reason_code text, p_reason_message text)`
   - Validates: status is 'pending', decision in ('approve','reject'), reason_code valid if rejecting
   - Updates: status, reviewed_by, reviewed_at, rejection_reason_code, rejection_message
   - Clears rejection fields on approve
   - Returns `{ success: true }` or raises error

### 4. Frontend Architecture

#### Route
- `/admin/founder-requests` (lazy-loaded)
- Protected by `RequireReviewer` wrapper

#### Components (following existing patterns)
1. **AdminFounderRequestsPage** — main queue page (mirrors `AdminSubmissionsPage`)
   - Uses `AdminFounderRequestsTable` + `AdminFounderRequestsFilterDrawer`
   - Default filter: `status: pending`
   - Status tabs: Pending / Approved / Rejected / All
   - Pending count badge on sidebar nav

3. **AdminFounderRequestsTable** (mirrors `AdminSubmissionsTable`)
   - Columns: Applicant, Organization, Email, City/Region, Submitted, Status, Actions
   - Actions: View, Approve (admin only), Reject (admin only)
   - Status badge using existing `AdminStatusBadge` pattern

4. **AdminFounderRequestsFilterDrawer** (mirrors `AdminSubmissionsFilterDrawer`)
   - Status filter (pending/approved/rejected/all)
   - Search by name, email, organization

5. **AdminFounderRequestDetailPage** (or modal)
   - Shows all applicant + organization fields
   - Shows rejection details if rejected
   - Action buttons: Approve / Reject (admin only, hidden for moderator)

5. **AdminApproveDialog** / **AdminRejectDialog**
   - Confirm dialogs (mirror `AdminRejectSubmissionDialog`)
   - Reject: reason dropdown (from `RejectionReasonCode` enum) + optional message
   - Approve: simple confirmation with boundary note

### 3. API Layer

**New RPCs to create in migration:**
```sql
-- admin_review_founder_request
-- Updates status, reviewed_by, reviewed_at, rejection fields
-- Validates: status='pending', decision in ('approve','reject'), reason_code valid if reject
-- Returns {success: true} or raises error
```

**Frontend API (features/admin/api/founderRequestsRepo.ts):**
- `fetchFounderRequests()` → RPC `admin_founder_requests`
- `fetchFounderRequest(id)` → RPC `admin_founder_request_detail` (create)
- `reviewFounderRequest(id, decision, reasonCode?, message?)` → RPC `admin_review_founder_request`

### 4. Hooks
`useFounderRequests()` — mirrors `useOrganizerRequests`
- Directory query (all requests)
- Pending count (for sidebar badge)
- Approve/reject mutations with invalidate
- Single-request query for detail page

### 5. UI Components to Build

1. `src/pages/Admin/AdminFounderRequestsPage.tsx`
2. `src/components/Admin/AdminFounderRequestsTable.tsx`
3. `src/components/Admin/AdminFounderRequestsFilterDrawer.tsx`
4. `src/components/Admin/AdminFounderRequestDetailPage.tsx`
5. `src/components/Admin/AdminFounderRequestDetailPage.css`
6. `src/components/Admin/AdminApproveDialog.tsx`
6. `src/components/Admin/AdminRejectFounderDialog.tsx`
7. `src/components/Admin/AdminFounderRequestsTable.css`
8. `src/components/Admin/AdminFounderRequestsFilterDrawer.css`
7. `src/pages/Admin/AdminFounderRequestDetailPage.css`
8. `src/components/Admin/AdminApproveDialog.css`
8. `src/components/Admin/AdminRejectFounderDialog.css`

### 4. Hooks & API
- `src/hooks/useFounderRequests.ts`
- `src/features/admin/api/founderRequestsRepo.ts`
- `src/features/admin/model/founderRequestsQuery.ts` (types, status labels, enums, filters, sorts)

### 5. Migration
`supabase/migrations/20260831000002_founder_review_rpcs.sql` — creates `admin_review_founder_request` RPC

### 6. Navigation
- Add "Founder Requests" to AdminSidebar under "Review" section (alongside Event Submissions, Organizer Requests)
- Badge: pending count (fetch via `fetchPendingFounderRequestCount`)

### 7. Routing
```tsx
<Route
  path="/admin/founder-requests"
  element={<RequireReviewer><AdminFounderRequestsPage /></RequireReviewer>}
>
  <Route index element={<AdminFounderRequestsPage />} />
  <Route path=":id" element={<AdminFounderRequestDetailPage />} />
</Route>
```

### 7. Tests
- Unit: filter/sort/view logic, enum labels
- Component: table renders, filters, action menu
- Integration: approve/reject mutations, error states, concurrency
- Test files: mirror organizer requests test patterns

---

## File Creation Order

1. Migration: `supabase/migrations/20260831000002_founder_review_rpcs.sql`
2. Types/Model: `src/features/admin/model/founderRequestsQuery.ts`
3. API: `src/features/admin/api/founderRequestsRepo.ts`
3. Hook: `src/hooks/useFounderRequests.ts`
4. Components: FilterDrawer, FilterDrawer.css, Table, Table.css
5. Detail Page + CSS
6. Dialogs: ApproveDialog, RejectDialog + CSS
6. Page: AdminFounderRequestsPage
6. Routing update in App.tsx
7. AdminSidebar update (nav item + badge)
9. Tests (unit + integration)
10. Migration run & verification

---

## Phase 3 Deliverables (from spec)

1. Existing Admin Architecture Audit (in final report)
2. Final Review Flow document
3. Permission Matrix
4. Files Created/Modified list
5. Database Changes (SQL files)
6. Security Review
6. Test Results
7. Manual QA results
8. Manual Owner Actions
9. Phase 3 Completion Verdict

---

Let me start implementing.Now I have a complete understanding. Let me create the implementation plan and start building.
<tool_call>
<function=write>
<parameter=content>
# Phase 3 — Founder Request Admin Review Implementation Plan

## 1. Architecture Audit Summary

### Existing Admin Patterns to Reuse
- **Route guards**: `RequireReviewer` (moderator+), `RequireAdmin` (admin only)
- **List page pattern**: `AdminSubmissionsPage` → `AdminFounderRequestsPage`
- **Table component**: `AdminSubmissionsTable` → `AdminFounderRequestsTable`
- **Filter drawer**: `AdminSubmissionsFilterDrawer` → `AdminFounderRequestsFilterDrawer`
- **Action menu**: `AdminActionMenu` for row actions
- **Status badge**: `AdminStatusBadge`
- **Reject dialog**: `AdminRejectSubmissionDialog` pattern
- **Hooks**: `useOrganizerRequests` → `useFounderRequests` with TanStack Query
- **API layer**: RPC calls via `supabase.rpc()` following `organizerRequestsRepo`
- **Sidebar nav**: `AdminSidebar` with `NavItem` + `NavSection` structure, badge counts
- **Route guards**: `RequireReviewer` (moderator+ for view), `RequireAdmin` for mutations

### Rejection Reasons (from Phase 2 migration)
```sql
rejection_reason_code in (
  'insufficient_information',
  'unable_to_verify_organizer',
  'account_activity_concerns',
  'duplicate_organizer_brand',
  'not_currently_eligible',
  'other'
)
```

### Database Schema (Phase 2)
- `founder_access_requests` with `status` (pending|approved|rejected)
- Partial unique index on `normalized_email` where status='pending'
- RLS: admin full access, moderator read-only
- Audit trigger logs status changes

### Audit Trigger (Phase 2)
Logs `founder_request.approved` and `founder_request.rejected` with reviewer, timestamps, rejection reason.

---

## 2. Implementation Plan

### Files to Create

#### 1. Migration
- `supabase/migrations/20260831000002_founder_review_rpcs.sql` — `admin_review_founder_request` RPC

#### 2. Types/Model
- `src/features/admin/model/founderRequestsQuery.ts` — types, enums, labels, filters, sorts, action items

#### 3. API Layer
- `src/features/admin/api/founderRequestsRepo.ts` — RPC calls

#### 3. Hook
- `src/hooks/useFounderRequests.ts` — TanStack Query directory, mutations, pending count

#### 4. Components
- `src/components/Admin/AdminFounderRequestsTable.tsx` + `.css`
- `src/components/Admin/AdminFounderRequestsFilterDrawer.tsx` + `.css`
- `src/components/Admin/AdminApproveDialog.tsx` + `.css`
- `src/components/Admin/AdminRejectFounderDialog.tsx` + `.css`
- `src/components/Admin/AdminFounderRequestsTable.tsx`
- `src/components/Admin/AdminFounderRequestsFilterDrawer.tsx`

#### 5. Pages
- `src/pages/Admin/AdminFounderRequestsPage.tsx`
- `src/pages/Admin/AdminFounderRequestDetailPage.tsx` + `.css`

#### 5. Routing & Navigation
- `src/App.tsx` — add routes
- `src/components/Admin/AdminSidebar.tsx` — add nav item with badge

#### 5. Hook
- `src/hooks/useFounderRequests.ts`

#### Tests
- Component tests for table, filter, dialogs
- Integration tests for mutations

### Migration
- `supabase/migrations/20260831000002_founder_review_rpcs.sql`
  - Creates `admin_review_founder_request` RPC
  - Validates: status='pending', decision in ('approve','reject'), reason_code valid for reject
  - Updates: status, reviewed_by, reviewed_at, rejection fields
  - Clears rejection fields on approve
  - Returns `{ success: true }` or raises error

### Routing
```tsx
<Route
  path="/admin/founder-requests"
  element={<RequireReviewer><AdminFounderRequestsPage /></RequireReviewer>}
>
  <Route index element={<AdminFounderRequestsPage />} />
  <Route path=":id" element={<AdminFounderRequestDetailPage />} />
</Route>
```

### Nav Item
Add to AdminSidebar "Review" section:
```ts
{ label: "Founder Requests", icon: ClipboardCheck, to: "/admin/founder-requests", roles: ["admin", "moderator"] }
```
Badge: pending count via `fetchPendingFounderRequestCount` RPC.

---

## 4. Implementation Order

1. **Migration** — `20260831000002_founder_review_rpcs.sql`
2. **Types/Model** — `founderRequestsQuery.ts`
3. **API Repo** — `founderRequestsRepo.ts`
3. **Hook** — `useFounderRequests.ts`
4. **Components**: Table, FilterDrawer, Dialogs + CSS
4. **Pages** — List + Detail
5. **Routing** — App.tsx + AdminSidebar
9. **Tests** (unit + integration)
10. **Migration run & verification**
11. **Lint + TypeScript + Build + Tests**

---

## 5. Permission Matrix

| Role | View Queue | View Detail | Approve | Reject |
|---|:---:|:---:|:---:|:---:|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Moderator | ✅ | ✅ | ❌ | ❌ |
| Organizer | ❌ | ❌ | ❌ | ❌ |
| User | ❌ | ❌ | ❌ | ❌ |
| Anonymous | ❌ | ❌ | ❌ | ❌ |

---

## 6. Security Review Checklist

- [ ] Admin-only mutations enforced by `is_admin()` in RPC
- [ ] Moderator read-only enforced by RLS + route guard
- [ ] `reviewed_by` forced from `auth.uid()` in RPC
- [ ] `reviewed_at` set server-side (`now()`)
- [ ] Status transition enforced: only `pending` → `approved`/`rejected`
- [ ] Concurrency: `UPDATE ... WHERE status = 'pending'` with row count check
- [ ] Rejection reason validated against enum
- [ ] Applicant fields immutable during review
- [ ] Concurrency conflict returned if already reviewed
- [ ] Audit trigger fires (Phase 2 trigger covers it)

---

Let me start implementation.
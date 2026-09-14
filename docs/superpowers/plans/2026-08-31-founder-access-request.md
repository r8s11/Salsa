# Phase 2 — Public Founder Access Request

## Goal

Create a public `/founders` page with a Founder access request form that allows prospective organizers to request Host/Founder access without requiring a SalsaSegura account.

## Constraints & Non-Goals

- **Do not** implement admin approval/rejection (Phase 3)
- **Do not** implement invitation tokens/emails (Phase 5)
- **Do not** implement organization creation (Phase 7)
- **Do not** implement Founder authentication/accounts
- **Do not** send confirmation emails (Phase 5)
- Use existing `founder_access_requests` table (new, dedicated)
- Requests must NOT require auth
- Requests must NOT create users/organizations
- Server-side validation is authoritative

## Architecture Decisions

### Database
- New table: `founder_access_requests`
- Separate from existing `organizer_requests` (which requires auth and user_id)
- Status: `pending` (default), `approved`, `rejected`
- No user_id, no auth.uid() requirements
- RLS: public INSERT only (controlled), no SELECT/UPDATE/DELETE for anon

### Backend
- Supabase Edge Function: `request-founder-access`
- Validates, normalizes, checks duplicates, inserts `pending`
- Returns safe success response (no PII echo)
- Forces `status = 'pending'`

### Frontend
- Public route: `/founders` (no auth required)
- Form with validation (client + server)
- Loading states, double-submit prevention
- Success state with "Thanks" message

### Duplicate Handling
- If same normalized email has pending request → silent success (no new row)
- Response identical to fresh submission (privacy)

## Files to Create/Modify

### New Files
1. `supabase/migrations/20260831000001_founder_access_requests.sql` — table + RLS + indexes
2. `supabase/functions/request-founder-access/index.ts` — Edge Function
3. `supabase/functions/_shared/founder-request.ts` — shared normalization/validation
4. `src/pages/FoundersPage.tsx` — public page component
5. `src/components/Founder/FounderRequestForm.tsx` — form component
6. `src/components/Founder/FounderRequestForm.test.tsx` — tests
7. `src/components/Founder/FounderRequestForm.css` — styles
8. `src/lib/founderRequest.ts` — client-side validation/normalization helpers
9. `src/lib/founderRequest.test.ts` — tests

### Modified Files
10. `src/App.tsx` — add `/founders` route
11. `src/components/Footer/Footer.tsx` or similar — add link to `/founders`

## Implementation Order

1. Database migration (table, RLS, indexes, constraints)
2. Shared validation/normalization utilities
3. Edge Function
4. Client-side validation helpers
5. Form component + tests
6. Page component + route
7. Navigation link
8. Tests (unit + integration)
9. Manual verification

## SQL Migration Plan

```sql
-- Table with constraints, indexes, RLS
-- Status enum: pending, approved, rejected
-- RLS: public INSERT with controlled function, no SELECT/UPDATE/DELETE for anon
-- SECURITY DEFINER RPC for controlled insert
```

## Testing Requirements

- Form validation (required fields, email format, URL format)
- Duplicate submission handling
- Double-submit prevention
- Loading states
- Mobile responsive (375px)
- Accessibility (labels, errors, keyboard)
- Backend validation
- Server-side duplicate suppression
- RLS enforcement
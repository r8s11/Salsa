# Admin Moderation Dashboard

**Date:** 2026-08-10
**Source:** `Docs/ADMIN_MODERATION_GUIDE.md` (roadmap Week 6, overdue) — this spec supersedes the guide's file layout and auth wiring where they predate work that has since shipped; the guide's SQL/RLS design and moderation UX remain the reference.
**Decision:** Build the pending-events queue (approve/reject) as a thin extension of the existing repository-pattern data layer and the `AuthContext`/`RequireAuth` that shipped 2026-08-10, rather than the guide's originally-specified standalone `/admin/login` + hand-rolled fetch hook — those predate both.

## Scope

**In scope:**

1. RLS policies granting the admin role SELECT (all statuses) and UPDATE on `public.events`.
2. One-time SQL to mark the operator's Supabase user `app_metadata.role = 'admin'`.
3. `eventsRepo.ts`: `fetchPendingEvents()`, `setEventStatus(id, status)`.
4. `usePendingEvents.ts`: TanStack Query list + mutation, shared cache invalidation with the public `['events']` key.
5. `RequireAdmin.tsx`: route guard combining the existing sign-in check with the admin role check.
6. `AdminPage.tsx` + `PendingEventCard.tsx`: pending queue, Approve/Reject per card.
7. `/admin` route (lazy, no nav link).
8. `RequireAdmin.test.tsx`.

**Out of scope (explicit, per design discussion):**

- Editing event fields before approval — Supabase dashboard remains the fallback for bad submissions.
- Approved/rejected history view or un-rejecting.
- A dedicated `/admin/login` — `/admin` reuses the existing `/signin` flow via `RequireAuth`.
- A nav link to `/admin` — reachable only by URL.
- Multiple admin roles/permission levels — single boolean `role === 'admin'` claim.

## Section 1 — Data flow & authorization

**Database.** One-time (not a migration): `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb WHERE id = '<operator-uuid>'`, run by hand in the Supabase SQL editor (or local `db reset` won't reapply it — document this in the migration file's header comment).

New migration `supabase/migrations/<timestamp>_admin_moderation_policies.sql`:

```sql
CREATE POLICY "Admins can view all events"
  ON public.events FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

Additive only — existing public/anon SELECT and INSERT policies are untouched. RLS combines same-command policies with OR, so this doesn't narrow anyone else's access.

**`src/features/events/api/eventsRepo.ts`** (the only file allowed to call `.from("events")` — Modernization Blueprint Step 7 invariant, verified by `grep -rln 'from("events")' src/` returning exactly this file):

```ts
export async function fetchPendingEvents(): Promise<DatabaseEvent[]> {
  const { data, error } = await supabase.from("events").select("*").eq("status", "pending");
  if (error) throw error;
  return data;
}

export async function setEventStatus(id: string, status: "approved" | "rejected"): Promise<void> {
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) throw error;
}
```

**`src/hooks/usePendingEvents.ts`** (alongside the existing `useEvent.ts`):

```ts
export function usePendingEvents() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["events", "pending"], queryFn: fetchPendingEvents });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      setEventStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] }); // covers both "pending" and the public per-city keys
    },
  });
  return { pending: query.data, isLoading: query.isPending, error: query.error, refetch: query.refetch, decide: mutation.mutate, isDeciding: mutation.isPending };
}
```

One shared mutation handles both approve and reject (status is a parameter) — no need for two mutation objects. Invalidating the whole `["events"]` key (rather than just `["events", "pending"]`) is deliberate: it also refreshes the public per-city query, so an approval shows up on the calendar without a manual refetch.

**Authorization (client).** `AuthContext`'s session already carries `user.app_metadata`. Add a derived `isAdmin` check — read from the session in `AuthContext` and expose alongside the existing `user`/`session` fields from `useAuth()`, rather than a separate hook (it's a one-line derivation of state `AuthContext` already owns).

**`src/components/RequireAdmin.tsx`** (sits next to `src/components/Auth/RequireAuth.tsx`):

- Not authenticated → redirect `/signin` (reuses `RequireAuth`'s existing target — either compose `RequireAdmin` as `RequireAuth` + an extra check, or duplicate the two-line redirect; decide during implementation based on which reads cleaner).
- Authenticated, `isAdmin` false → redirect `/` (silent — no message, per design discussion).
- Authenticated, `isAdmin` true → render children.

## Section 2 — UI components & routes

- **`src/pages/AdminPage.tsx`** — composition only. `usePendingEvents()` for data; maps `pending` to `PendingEventCard`. States, following the `CalendarStatus`/`Calendar.tsx` convention (inline conditional blocks, not a shared component — there is no generic `Loading` component in this codebase): loading (`"Loading pending events..."`), error (message + retry button calling `refetch`), empty (`"No events waiting for review."`), populated (card list).
- **`src/components/Admin/PendingEventCard.tsx` + `.css`** — one card per pending event: title, formatted date/time, submitter name/email, description, price. `PendingEventCard` operates on `DatabaseEvent` (the raw repo shape: `event_date`, `price_amount`, etc. — pending events are never routed through `convert.ts`'s `databaseEventToScheduleX`, since that's Temporal-based and scoped to approved/scheduled display). Date/time and price formatting are inlined the same way `EventModal.tsx` and `EventCard.tsx` already do it (`toLocaleDateString`/`toLocaleTimeString`, `isFree ? "Free" : `$${priceAmount}``) — there is no shared `formatMoney`/date-formatting utility in this codebase to import. Approve/Reject buttons; each disabled + spinner while `isDeciding` for *that card's* mutation is in flight — per-card, not a full-page lock (mirrors that the guide's queue can hold several pending events at once). A failed decide surfaces an inline `"Couldn't update — try again"` on that card and re-enables its buttons; other cards are unaffected.
- **Routing (`App.tsx`)** — one new lazy route: `<Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />`. No `/admin/login`. No `Header`/`TabBar`-equivalent nav entry.

## Section 3 — Testing

Following the Blueprint's established split (pure logic gets unit tests; thin Supabase passthroughs don't — matches `eventsRepo.ts`'s existing zero direct coverage):

- **`src/components/RequireAdmin.test.tsx`** — the one pure decision surface here (three branches: unauthenticated → redirect `/signin`; authenticated non-admin → redirect `/`; admin → render children), tested with Testing Library, mocking `../contexts/useAuth` per case via `vi.mock` (no test currently mocks auth state — `SubmitEventPage.test.tsx`'s `vi.mock("../features/events/api/eventsRepo", …)` is the closest existing precedent for mocking a single module boundary rather than the whole `<Providers>` tree, and `RequireAdmin.test.tsx` follows the same shape: mock `useAuth`'s return value directly instead of standing up a real Supabase session).
- **No new tests** for `usePendingEvents.ts`, `fetchPendingEvents`, or `setEventStatus` — thin `select`/`update` wrappers, consistent with `fetchApprovedEvents`/`submitEvent` having no direct tests today.
- **Manual verification** (the real gate for anything touching live Supabase, per the Blueprint's own convention): run the SQL to mark the operator admin; sign in; confirm `/admin` lists the pending queue; approve one event and confirm it appears on the public calendar; reject one and confirm it leaves the queue; confirm a second, non-admin authenticated session hitting `/admin` bounces to `/`.

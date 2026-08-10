# Admin Moderation Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the signed-in admin review, approve, and reject community-submitted events at `/admin`, replacing manual Supabase-dashboard approval.

**Architecture:** Two new RLS policies grant the `app_metadata.role = 'admin'` claim SELECT-all/UPDATE on `public.events`. `eventsRepo.ts` gains `fetchPendingEvents`/`setEventStatus` (the only file allowed to touch `.from("events")`, per the Modernization Blueprint's repository-pattern invariant). A TanStack Query hook (`usePendingEvents`) wraps them with cache invalidation shared with the public events query. `RequireAdmin` extends the existing `RequireAuth`/`AuthContext` sign-in with a role check — no separate `/admin/login`.

**Tech Stack:** React 19, TypeScript 5.9, React Router 7, `@tanstack/react-query` 5, Supabase JS 2, `temporal-polyfill` 0.3 (`America/New_York` wall-clock display), Vitest 4 + Testing Library.

## Global Constraints

- Every task ends with `npm run build` exiting 0 (matches the Modernization Blueprint's regression gate — `tsc -b` catches type errors immediately).
- `.from("events")` may only appear in `src/features/events/api/eventsRepo.ts` — verify with `grep -rln 'from("events")' src/` after any task touching that file; it must return exactly one path.
- No new dependencies — everything needed (`@tanstack/react-query`, `temporal-polyfill`, Testing Library) is already installed.
- No nav link to `/admin`, no `/admin/login`, no event-editing UI, no approved/rejected history view (explicit out-of-scope, `Docs/superpowers/specs/2026-08-10-moderation-dashboard-design.md`).
- Never change existing CSS class names on files this plan modifies (visual regression risk, per the Blueprint's standing rule).
- Commit after each task with the task title as the message (`feat: ...` / `docs: ...` per this repo's existing convention).

---

### Task 1: Admin RLS policies migration

**Files:**

- Create: `supabase/migrations/20260810000000_admin_moderation_policies.sql`

**Interfaces:**

- Produces: two Postgres policies (`"Admins can view all events"`, `"Admins can update events"`) and an `UPDATE` grant to `authenticated` — consumed implicitly by every later task that queries/mutates `public.events` as an admin.

- [ ] **Step 1: Write the migration file**

```sql
-- Admin moderation policies for public.events.
-- Grants sit below policies — without grant update, the UPDATE policy is
-- never evaluated. SELECT is already granted to `authenticated` by the
-- baseline migration; this only adds a second SELECT policy (RLS combines
-- same-command policies with OR) so admins see pending/rejected rows too.
grant update on public.events to authenticated;

create policy "Admins can view all events"
  on public.events
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can update events"
  on public.events
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

- [ ] **Step 2: Apply it to the local dev stack**

Run: `npx supabase db reset`
Expected: output lists all four migrations applying in order (`20260101000000`, `20260714000000`, `20260809000000`, `20260810000000`), then seeding, with no errors.

- [ ] **Step 3: Verify the policies exist**

Run: `docker exec -i supabase_db_Salsa psql -U postgres -tAc "select policyname from pg_policies where tablename = 'events' order by 1"`
Expected: four rows — `Admins can update events`, `Admins can view all events`, `Anon can submit pending events`, `Public events are viewable by everyone`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260810000000_admin_moderation_policies.sql
git commit -m "feat: add admin RLS policies for event moderation"
```

---

### Task 2: Mark yourself admin (manual, one-time, not a migration)

This is a personal-data action, not schema — it stays out of git (`raw_app_meta_data` on your specific `auth.users` row), matching Task 1's migration comment.

**Interfaces:**

- Consumes: your own Supabase user, created via the existing `/signin` → sign-up flow.
- Produces: the `app_metadata.role = 'admin'` claim that `RequireAdmin` (Task 6) and the RLS policies (Task 1) both check.

- [ ] **Step 1: Create (or confirm) your account**

If you haven't already, go to `http://localhost:5173/signin` and sign up with an email/password (local dev — no real email delivery needed since `enable_confirmations = false`).

- [ ] **Step 2: Find your user UUID**

Run: `docker exec -i supabase_db_Salsa psql -U postgres -tAc "select id, email from auth.users"`
Expected: your row, with a UUID like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`.

- [ ] **Step 3: Mark that user admin**

Run (substituting the UUID from Step 2):

```bash
docker exec -i supabase_db_Salsa psql -U postgres -c "UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{\"role\":\"admin\"}'::jsonb WHERE id = '<your-uuid>'"
```

Expected: `UPDATE 1`.

- [ ] **Step 4: Verify**

Run: `docker exec -i supabase_db_Salsa psql -U postgres -tAc "select email, raw_app_meta_data ->> 'role' from auth.users"`
Expected: your row shows `admin` in the second column.

No commit — nothing in git changed.

---

### Task 3: `eventsRepo.ts` — pending-events data access

**Files:**

- Modify: `src/features/events/api/eventsRepo.ts`

**Interfaces:**

- Consumes: `supabase` (already imported in this file), `DatabaseEvent` (already imported in this file from `"../../../types/events"`).
- Produces: `fetchPendingEvents(): Promise<DatabaseEvent[]>`, `setEventStatus(id: string, status: "approved" | "rejected"): Promise<void>` — consumed by Task 4's `usePendingEvents`.

- [ ] **Step 1: Add the two functions**

Append to `src/features/events/api/eventsRepo.ts` (after the existing `submitEvent`):

```ts
export async function fetchPendingEvents(): Promise<DatabaseEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as DatabaseEvent[]) || [];
}

export async function setEventStatus(id: string, status: "approved" | "rejected"): Promise<void> {
  const { error } = await supabase.from("events").update({ status }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 2: Verify the repository-pattern invariant still holds**

Run: `grep -rln 'from("events")' src/`
Expected: exactly one line, `src/features/events/api/eventsRepo.ts`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/events/api/eventsRepo.ts
git commit -m "feat: add fetchPendingEvents/setEventStatus to eventsRepo"
```

(No new test file for this step — matches `fetchApprovedEvents`/`submitEvent` in the same file, which have zero direct test coverage today; see the design spec's Testing section.)

---

### Task 4: `usePendingEvents` hook

**Files:**

- Create: `src/hooks/usePendingEvents.ts`

**Interfaces:**

- Consumes: `fetchPendingEvents`, `setEventStatus` from `src/features/events/api/eventsRepo.ts` (Task 3); `useQuery`/`useMutation`/`useQueryClient` from `@tanstack/react-query`.
- Produces: `usePendingEvents(): { pending: DatabaseEvent[] | undefined; isLoading: boolean; error: string | null; refetch: () => void; decide: (args: { id: string; status: "approved" | "rejected" }) => void; decidingId: string | null; decideError: string | null }` — consumed by Task 8's `AdminPage`.

- [ ] **Step 1: Write the hook**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPendingEvents, setEventStatus } from "../features/events/api/eventsRepo";

export function usePendingEvents() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["events", "pending"],
    queryFn: fetchPendingEvents,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      setEventStatus(id, status),
    onSuccess: () => {
      // Invalidates the pending queue AND the public per-city query, so an
      // approval shows up on the calendar without a manual refetch.
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return {
    pending: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
    decide: mutation.mutate,
    decidingId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
    decideError: mutation.error ? mutation.error.message : null,
  };
}
```

`decidingId` (rather than a plain boolean) lets `PendingEventCard` (Task 7) disable only the card currently being decided, not the whole list.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePendingEvents.ts
git commit -m "feat: add usePendingEvents hook"
```

(No test file — thin TanStack Query wrapper, matching `useEventsQuery.ts`/`useEvent.ts`, neither of which has a test today.)

---

### Task 5: `AuthContext` — expose `isAdmin`

**Files:**

- Modify: `src/contexts/authContextObject.ts`
- Modify: `src/contexts/AuthContext.tsx`

**Interfaces:**

- Produces: `AuthContextValue.isAdmin: boolean`, readable via the existing `useAuth()` hook — consumed by Task 6's `RequireAdmin`.

- [ ] **Step 1: Add `isAdmin` to the type**

In `src/contexts/authContextObject.ts`, the current type is:

```ts
export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: "github" | "google" | "apple") => Promise<void>;
  signOut: () => Promise<void>;
};
```

Change it to add `isAdmin` right after `loading`:

```ts
export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: "github" | "google" | "apple") => Promise<void>;
  signOut: () => Promise<void>;
};
```

- [ ] **Step 2: Compute it in the provider**

In `src/contexts/AuthContext.tsx`, the current `value` object (end of `AuthProvider`) is:

```ts
const value: AuthContextValue = {
  user,
  session,
  loading,
  signInWithPassword,
  signUp,
  signInWithOAuth,
  signOut,
};
```

Change it to:

```ts
const value: AuthContextValue = {
  user,
  session,
  loading,
  isAdmin: user?.app_metadata?.role === "admin",
  signInWithPassword,
  signUp,
  signInWithOAuth,
  signOut,
};
```

No new state/effect needed — `isAdmin` is a pure derivation of `user`, which the existing `getSession`/`onAuthStateChange` effect already keeps current.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/authContextObject.ts src/contexts/AuthContext.tsx
git commit -m "feat: expose isAdmin on AuthContext"
```

---

### Task 6: `RequireAdmin` route guard (TDD)

**Files:**

- Create: `src/components/Auth/RequireAdmin.test.tsx`
- Create: `src/components/Auth/RequireAdmin.tsx`

**Interfaces:**

- Consumes: `useAuth()` (Task 5's `isAdmin` field, plus existing `user`/`loading`).
- Produces: `<RequireAdmin>{children}</RequireAdmin>` — consumed by Task 9's `/admin` route.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RequireAdmin from "./RequireAdmin";
import { useAuth } from "../../contexts/useAuth";

vi.mock("../../contexts/useAuth", () => ({
  useAuth: vi.fn(),
}));

function renderAtAdmin() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <div>Admin Page</div>
            </RequireAdmin>
          }
        />
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAdmin", () => {
  it("shows a loading state while the session is resolving", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: true,
      isAdmin: false,
    } as ReturnType<typeof useAuth>);

    renderAtAdmin();

    expect(screen.getByText(/Checking session/i)).toBeInTheDocument();
  });

  it("redirects unauthenticated visitors to /signin", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      isAdmin: false,
    } as ReturnType<typeof useAuth>);

    renderAtAdmin();

    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
  });

  it("redirects signed-in non-admins to / silently", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1", app_metadata: {} },
      loading: false,
      isAdmin: false,
    } as unknown as ReturnType<typeof useAuth>);

    renderAtAdmin();

    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("renders children for signed-in admins", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1", app_metadata: { role: "admin" } },
      loading: false,
      isAdmin: true,
    } as unknown as ReturnType<typeof useAuth>);

    renderAtAdmin();

    expect(screen.getByText("Admin Page")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Auth/RequireAdmin.test.tsx`
Expected: FAIL — `Failed to resolve import "./RequireAdmin"` (the component doesn't exist yet).

- [ ] **Step 3: Write the component**

```tsx
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";

/**
 * Protects a route by requiring an authenticated session AND the admin
 * app_metadata role. Non-admins (signed in or not) are bounced silently —
 * this route has no public entry point (no nav link).
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "40vh",
          fontSize: "1.1rem",
          color: "var(--muted, #666)",
        }}
      >
        Checking session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/Auth/RequireAdmin.test.tsx`
Expected: PASS — 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/Auth/RequireAdmin.tsx src/components/Auth/RequireAdmin.test.tsx
git commit -m "feat: add RequireAdmin route guard"
```

---

### Task 7: `PendingEventCard` component

**Files:**

- Create: `src/components/Admin/PendingEventCard.tsx`
- Create: `src/components/Admin/PendingEventCard.css`

**Interfaces:**

- Consumes: `DatabaseEvent` (`src/features/events/model/types.ts`).
- Produces: `<PendingEventCard event={} onApprove={} onReject={} isDeciding={} error={} />` — consumed by Task 8's `AdminPage`.

- [ ] **Step 1: Write the component**

```tsx
import "temporal-polyfill/global";
import type { DatabaseEvent } from "../../features/events/model/types";
import "./PendingEventCard.css";

interface Props {
  event: DatabaseEvent;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isDeciding: boolean;
  error: string | null;
}

// event_date is timestamp with time zone — parse as an Instant and render
// in America/New_York, same rule convert.ts uses, so pending events never
// display at the visitor's browser timezone offset.
function formatEventDateTime(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  const dateLabel = zdt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeLabel = zdt.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateLabel} at ${timeLabel}`;
}

export default function PendingEventCard({ event, onApprove, onReject, isDeciding, error }: Props) {
  const isFree = event.price_type === "free" || event.price_amount == null;
  const priceLabel = isFree ? "Free" : `$${event.price_amount}`;
  const cityLabel = event.city === "boston" ? "Boston" : "New York City";

  return (
    <div className="pending-event-card">
      <h3>{event.title}</h3>
      <p className="pending-event-meta">
        {formatEventDateTime(event.event_date)} · {cityLabel} · {priceLabel}
      </p>
      {event.description && <p className="pending-event-description">{event.description}</p>}
      <p className="pending-event-submitter">
        Submitted by {event.submitter_name ?? "Anonymous"}
        {event.submitter_email ? ` (${event.submitter_email})` : ""}
      </p>
      {error && <p className="pending-event-error">{error}</p>}
      <div className="pending-event-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={isDeciding}
          onClick={() => onApprove(event.id)}
        >
          {isDeciding ? "Working…" : "Approve"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={isDeciding}
          onClick={() => onReject(event.id)}
        >
          {isDeciding ? "Working…" : "Reject"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the CSS**

```css
.pending-event-card {
  background: var(--card);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.25rem 1.5rem;
  margin-bottom: 1rem;
}

.pending-event-card h3 {
  font-family: var(--font-display);
  color: var(--text);
  margin: 0 0 0.4rem;
}

.pending-event-meta {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  color: var(--gold);
  margin: 0 0 0.6rem;
}

.pending-event-description {
  font-family: var(--font-body);
  color: var(--text);
  margin: 0 0 0.6rem;
}

.pending-event-submitter {
  font-family: var(--font-ui);
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0 0 0.8rem;
}

.pending-event-error {
  font-family: var(--font-ui);
  font-size: 0.8rem;
  color: var(--red-bright);
  margin: 0 0 0.8rem;
}

.pending-event-actions {
  display: flex;
  gap: 0.75rem;
}

.pending-event-actions button:disabled {
  opacity: 0.6;
  cursor: default;
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/Admin/PendingEventCard.tsx src/components/Admin/PendingEventCard.css
git commit -m "feat: add PendingEventCard component"
```

(No test file — presentational component with no branching logic worth a render test beyond what `AdminPage`'s manual verification, Task 10, already covers live.)

---

### Task 8: `AdminPage`

**Files:**

- Create: `src/pages/AdminPage.tsx`

**Interfaces:**

- Consumes: `usePendingEvents()` (Task 4), `PendingEventCard` (Task 7), `useAuth()` (for the header greeting).
- Produces: default export `AdminPage` — consumed by Task 9's `/admin` route.

- [ ] **Step 1: Write the page**

```tsx
import { useAuth } from "../contexts/useAuth";
import { usePendingEvents } from "../hooks/usePendingEvents";
import PendingEventCard from "../components/Admin/PendingEventCard";

export default function AdminPage() {
  const { user } = useAuth();
  const { pending, isLoading, error, refetch, decide, decidingId, decideError } =
    usePendingEvents();

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <p className="eyebrow">Moderation</p>
        <h1>Pending events</h1>
        {user?.email && <p className="admin-page-user">Signed in as {user.email}</p>}
      </header>

      {isLoading && <p className="admin-page-status">Loading pending events...</p>}

      {error && (
        <div className="admin-page-status admin-page-error">
          <p>Couldn't load pending events: {error}</p>
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && pending && pending.length === 0 && (
        <p className="admin-page-status">No events waiting for review.</p>
      )}

      {pending && pending.length > 0 && (
        <div className="admin-page-list">
          {pending.map((event) => (
            <PendingEventCard
              key={event.id}
              event={event}
              onApprove={(id) => decide({ id, status: "approved" })}
              onReject={(id) => decide({ id, status: "rejected" })}
              isDeciding={decidingId === event.id}
              error={
                decidingId === null && decideError
                  ? null
                  : decidingId === event.id
                    ? decideError
                    : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

Note the `error` prop logic on `PendingEventCard`: `decideError` is global to the one shared mutation, so it's only attributed to the card whose id matches `decidingId` at the moment of failure. Since `decidingId` resets to `null` once the mutation settles (success or error), a failed mutation's error and its `id` are captured in the same render as the mutation transitions from pending→error — `mutation.variables` (which `decidingId` reads) still holds the last attempted variables at that point, so the id/error pairing is correct on the render where the error first appears; a subsequent unrelated card action clears it naturally because a new `mutate()` call resets `mutation.error`.

- [ ] **Step 2: Add page styles**

`AdminPage` reuses `.eyebrow` (already defined in `src/styles/global.css` — used by `More`/other pages) and needs three new page-scoped classes. Following the Modernization Blueprint's CSS-ownership rule (page-scoped classes live with the page, not in `global.css`), create `src/pages/AdminPage.css`:

```css
.admin-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}

.admin-page-header {
  margin-bottom: 2rem;
}

.admin-page-header h1 {
  font-family: var(--font-display);
  color: var(--text);
  margin: 0.2rem 0 0.4rem;
}

.admin-page-user {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.admin-page-status {
  font-family: var(--font-ui);
  color: var(--text-muted);
  padding: 2rem 0;
  text-align: center;
}

.admin-page-error {
  color: var(--red-bright);
}

.admin-page-error button {
  margin-top: 0.75rem;
  padding: 0.5rem 1.5rem;
  background: var(--red-dim);
  color: var(--red-bright);
  border: 1px solid rgba(225, 29, 72, 0.3);
  border-radius: var(--radius-sm);
  font-family: var(--font-ui);
  cursor: pointer;
}
```

Add the import at the top of `src/pages/AdminPage.tsx`:

```ts
import "./AdminPage.css";
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminPage.tsx src/pages/AdminPage.css
git commit -m "feat: add AdminPage"
```

---

### Task 9: Wire the `/admin` route

**Files:**

- Modify: `src/App.tsx`

**Interfaces:**

- Consumes: `RequireAdmin` (Task 6), `AdminPage` (Task 8).

- [ ] **Step 1: Add the lazy import and route**

In `src/App.tsx`, the current lazy-import block is:

```tsx
const SignInPage = lazy(() => import("./pages/SignInPage"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
import RequireAuth from "./components/Auth/RequireAuth";
```

Change it to:

```tsx
const SignInPage = lazy(() => import("./pages/SignInPage"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
import RequireAuth from "./components/Auth/RequireAuth";
import RequireAdmin from "./components/Auth/RequireAdmin";
```

The current `submit` route block inside `<Route path="/" element={<MainLayout />}>` is:

```tsx
<Route
  path="submit"
  element={
    <RequireAuth>
      <SubmitEventPage />
    </RequireAuth>
  }
/>
```

Add the admin route directly after it (still nested under `MainLayout`, matching every other authenticated route):

```tsx
            <Route
              path="submit"
              element={
                <RequireAuth>
                  <SubmitEventPage />
                </RequireAuth>
              }
            />
            <Route
              path="admin"
              element={
                <RequireAdmin>
                  <AdminPage />
                </RequireAdmin>
              }
            />
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire /admin route"
```

---

### Task 10: Manual end-to-end verification + docs sync

**Files:**

- Modify: `Docs/STATUS_SUMMARY.md`
- Modify: `Docs/ROADMAP.md`

**Interfaces:** none (verification + documentation only).

- [ ] **Step 1: Full regression gate**

Run in order:

```bash
npm run lint
npx vitest run
npm run build
```

Expected: all three exit 0. `vitest run` should show one more test file than before (`RequireAdmin.test.tsx`, +4 tests).

- [ ] **Step 2: Manual click-through**

With `npx supabase status` confirming the stack is up and `npm run dev` running:

1. Submit a test event via `/submit` while signed in as a _non-admin_ test account (or your admin account — either works, submission doesn't check role) — confirm it lands with `status: pending` (same as before this plan).
2. Sign in as your admin account (Task 2) and visit `/admin`. Confirm the pending event from step 1 appears in the queue with correct title/date/city/price.
3. Click **Approve** on it. Confirm: the button shows "Working…" briefly, the card disappears from the queue, and the event now appears on `/calendar` for its city (proves the shared `["events"]` cache invalidation from Task 4 works end-to-end).
4. Submit a second test event, go to `/admin`, click **Reject**. Confirm it disappears from the queue and does **not** appear on `/calendar`.
5. Signed out of every account, navigate directly to `/admin`. Confirm you land on `/signin` (the unauthenticated redirect).
6. Sign in as a non-admin test account (or use a second browser profile) and navigate directly to `/admin`. Confirm you land on `/` with no error message — the signed-in-but-not-admin redirect (per the "silent redirect" design decision).

- [ ] **Step 3: Update `Docs/STATUS_SUMMARY.md`**

In the "What's NOT Built" table, change the Moderation dashboard row from "Not started" to shipped, and update "Recommended Next Steps" item 4 (previously pointing at this feature) to point at the next roadmap item (Text search, W8) instead. Re-read the file first — line numbers will have shifted since the design-spec commit.

- [ ] **Step 4: Update `Docs/ROADMAP.md`**

Move "Moderation dashboard" from "In Progress 🔄" to "Completed ✅" in the Progress Overview section, and update the Week 6 row in the 52-Week Deliverables table from "⚠️ Overdue" to "✅ Done". Re-read the file first for current line numbers.

- [ ] **Step 5: Commit**

```bash
git add Docs/STATUS_SUMMARY.md Docs/ROADMAP.md
git commit -m "docs: mark moderation dashboard shipped"
```

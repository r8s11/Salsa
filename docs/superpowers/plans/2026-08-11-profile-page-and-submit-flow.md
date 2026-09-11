# Account-Linked Submissions, My Profile Page, and OAuth "Coming Soon" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tie event submissions to the submitting account, add a read-only account email + weekly-recurring checkbox to `/submit`, add a `/profile` page showing account info and submission status, add nav discoverability for both, and disable the non-functional OAuth sign-in buttons.

**Architecture:** One additive migration (`submitter_id` column + a new "own submissions" SELECT policy + a hardened insert-policy `WITH CHECK`). `eventsRepo.ts` gains `fetchMySubmissions`; `submitEvent`'s payload gains `submitter_id`/`recurrence`. A new `useMySubmissions` TanStack Query hook backs a new `ProfilePage`. Two new nav links appear only when signed in. `SignInForm`'s three OAuth buttons become permanently disabled with "(Coming soon)" labels — no new CSS needed, `.btn-oauth:disabled` already exists.

**Tech Stack:** React 19, TypeScript 5.9, React Router 7, `@tanstack/react-query` 5, Supabase JS 2, `temporal-polyfill` 0.3 (`America/New_York` wall-clock display).

## Global Constraints

- Every task ends with `npm run build` exiting 0 — **except Task 2's Step 4, which documents an intentionally-expected failure** (the new required `NewEventSubmission` fields have no caller yet; Task 3 supplies one and is the first task after Task 2 required to build clean).
- `.from("events")` may only appear in `src/features/events/api/eventsRepo.ts` — verify with `grep -rln 'from("events")' src/` after any task touching that file; it must return exactly one path.
- No new dependencies.
- No editing/withdrawing a submission from `/profile` — read-only status tracking only (explicit out-of-scope, `Docs/superpowers/specs/2026-08-10-profile-page-and-submit-flow-design.md`).
- No recurrence value besides `"weekly"`.
- No account dropdown menu — plain nav links only.
- Never change existing CSS class names on files this plan modifies.
- Commit after each task with the task title as the message.

---

### Task 1: Migration — `submitter_id` + RLS

**Files:**

- Create: `supabase/migrations/20260811000000_submitter_id_and_recurring.sql`

**Interfaces:**

- Produces: `public.events.submitter_id` (nullable `uuid references auth.users(id)`), the `"Users can view own submissions"` SELECT policy, and a hardened `WITH CHECK` on the existing `"Anon can submit pending events"` INSERT policy — consumed by every later task that reads/writes `submitter_id`.

- [ ] **Step 1: Write the migration file**

```sql
-- Ties a submission to the account that made it, so "my submissions" can
-- be looked up reliably instead of matching the free-text email field.
-- Nullable: every pre-existing row (all submitted before Auth existed) has
-- no owning account and simply won't appear under anyone's profile — correct,
-- since no account owns them.
alter table public.events add column submitter_id uuid references auth.users(id);

-- Lets a signed-in user see their own submissions at any status (not just
-- approved). Combines via OR with the existing public/admin SELECT policies.
create policy "Users can view own submissions"
  on public.events
  for select
  to authenticated
  using (submitter_id = auth.uid());

-- Hardening on the existing insert policy (20260809000000_events_insert_policy.sql):
-- without this, an authenticated request could set submitter_id to someone
-- else's UUID, making a spam submission appear on a stranger's profile, or
-- an anon request could set a submitter_id at all despite having no session.
-- `IS NOT DISTINCT FROM` null-safely requires: anon (auth.uid() is null) ->
-- submitter_id must be null; authenticated -> submitter_id must equal auth.uid().
alter policy "Anon can submit pending events"
  on public.events
  with check (status = 'pending' and submitter_id is not distinct from auth.uid());
```

- [ ] **Step 2: Apply it to the local dev stack**

Run: `npx supabase db reset`
Expected: output lists all five migrations applying in order (`20260101000000`, `20260714000000`, `20260809000000`, `20260810000000`, `20260811000000`), then seeding, with no errors.

- [ ] **Step 3: Verify the column and policies exist**

Run: `docker exec -i supabase_db_Salsa psql -U postgres -tAc "select column_name from information_schema.columns where table_name = 'events' and column_name = 'submitter_id'"`
Expected: `submitter_id`.

Run: `docker exec -i supabase_db_Salsa psql -U postgres -tAc "select policyname from pg_policies where tablename = 'events' order by 1"`
Expected: five rows — `Admins can update events`, `Admins can view all events`, `Anon can submit pending events`, `Public events are viewable by everyone`, `Users can view own submissions`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811000000_submitter_id_and_recurring.sql
git commit -m "feat: add submitter_id column and own-submissions RLS policy"
```

---

### Task 2: `types.ts` + `eventsRepo.ts` — data layer

**Files:**

- Modify: `src/features/events/model/types.ts`
- Modify: `src/features/events/api/eventsRepo.ts`
- Modify: `src/features/events/model/convert.test.ts`
- Modify: `src/types/events.test.ts`

**Interfaces:**

- Produces: `DatabaseEvent.submitter_id: string | null`, `NewEventSubmission.submitter_id: string` + `NewEventSubmission.recurrence: "weekly" | null`, `fetchMySubmissions(userId: string): Promise<DatabaseEvent[]>` — consumed by Task 3 (`useSubmitEventForm`) and Task 6 (`useMySubmissions`).

- [ ] **Step 1: Add `submitter_id` to `DatabaseEvent`**

In `src/features/events/model/types.ts`, the current interface has (in order): `..., submitter_name, submitter_email, status, city, created_at, host, recurrence, gallery`. Add `submitter_id: string | null;` immediately after `submitter_email: string | null;`:

```ts
export interface DatabaseEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string; //ISO timestamp from database
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: "free" | "paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  image_url: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_id: string | null;
  status: "approved" | "pending" | "rejected";
  city: City;
  created_at: string;
  host: string | null;
  recurrence: string | null;
  gallery: string[] | null;
}
```

- [ ] **Step 2: Update `NewEventSubmission` and add `fetchMySubmissions`**

In `src/features/events/api/eventsRepo.ts`, the current `NewEventSubmission` interface ends with `submitter_name: string | null; submitter_email: string | null;`. Replace the whole interface:

```ts
export interface NewEventSubmission {
  title: string;
  description: string | null;
  event_type: EventType;
  city: City;
  event_date: string;
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: "free" | "paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_id: string;
  recurrence: "weekly" | null;
}
```

Append this new function after `fetchApprovedEvents` (before `submitEvent`, matching the file's read-then-write ordering) — exact position doesn't matter functionally, place it anywhere at top level:

```ts
export async function fetchMySubmissions(userId: string): Promise<DatabaseEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("submitter_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as DatabaseEvent[]) || [];
}
```

- [ ] **Step 3: Verify the repository-pattern invariant still holds**

Run: `grep -rln 'from("events")' src/`
Expected: exactly one line, `src/features/events/api/eventsRepo.ts`.

- [ ] **Step 4: Fix pre-existing test fixtures broken by the new required field**

`submitter_id` is now a required (non-optional) field on `DatabaseEvent`. Two pre-existing test files construct full `DatabaseEvent` literals and will fail to typecheck without it — this was missed during planning and discovered by the implementer during this task's build check.

In `src/features/events/model/convert.test.ts`, the `mockEvent` factory's base object currently ends with `submitter_email: null,` (before `status: "approved",`). Add `submitter_id: null,` immediately after it.

In `src/types/events.test.ts`, both `DatabaseEvent` literals ("maps properties correctly" and "maps null new fields to undefined" tests) need `submitter_id` added right after their existing `submitter_email` line — `submitter_id: null,` in both cases (neither test asserts on submitter fields, so `null` is correct for both).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: fails — `useSubmitEventForm.ts`'s existing `submitEvent(...)` call is now missing the two new required `NewEventSubmission` fields. That's expected; Task 3 fixes it. Confirm the failure is exactly this (a missing-properties TS error naming `submitter_id`/`recurrence` on the `submitEvent` call in `useSubmitEventForm.ts`), and that it is the **only** remaining failure (the two test-fixture errors from Step 4 must be gone).

- [ ] **Step 6: Commit**

```bash
git add src/features/events/model/types.ts src/features/events/api/eventsRepo.ts src/features/events/model/convert.test.ts src/types/events.test.ts
git commit -m "feat: add submitter_id/recurrence to event submission types, add fetchMySubmissions"
```

---

### Task 3: Submit form — recurrence field, account-derived submitter

**Files:**

- Modify: `src/features/submit-event/validation.ts`
- Modify: `src/features/submit-event/useSubmitEventForm.ts`
- Modify: `src/pages/SubmitEventPage.test.tsx`

**Interfaces:**

- Consumes: `DatabaseEvent`/`NewEventSubmission`/`fetchMySubmissions` (Task 2), `useAuth()` (existing, `user.id`/`user.email`).
- Produces: `SubmitForm.recurrence: "weekly" | ""` — consumed by Task 4's checkbox and Task 5's fieldset props.

- [ ] **Step 1: Add `recurrence` to `SubmitForm`**

In `src/features/submit-event/validation.ts`, the current `SubmitForm` type and `buildInitialForm` both end with `submitter_name`/`submitter_email`. Add `recurrence` to both, immediately after `submitter_email`:

```ts
export type SubmitForm = {
  title: string;
  description: string;
  event_type: EventType | "";
  city: City;
  event_date: string;
  event_time: string;
  location: string;
  address: string;
  price_type: "free" | "paid" | "";
  price_amount: string;
  rsvp_link: string;
  submitter_name: string;
  submitter_email: string;
  recurrence: "weekly" | "";
};

export const buildInitialForm = (city: City): SubmitForm => ({
  title: "",
  description: "",
  event_type: "",
  city,
  event_date: "",
  event_time: "",
  location: "",
  address: "",
  price_type: "",
  price_amount: "",
  rsvp_link: "",
  submitter_name: "",
  submitter_email: "",
  recurrence: "",
});
```

No changes to `validateSubmitForm` — a checkbox-derived field can't fail validation.

- [ ] **Step 2: Wire account identity into submission**

In `src/features/submit-event/useSubmitEventForm.ts`, add the `useAuth` import and destructure `user`:

```ts
import { useState, FormEvent } from "react";
import { submitEvent } from "../events/api/eventsRepo";
import type { EventType } from "../../types/events";
import { useCity } from "../../contexts/useCity";
import { useAuth } from "../../contexts/useAuth";
import { validateSubmitForm, buildInitialForm, SubmitForm } from "./validation";

export function useSubmitEventForm() {
  const { city: defaultCity } = useCity();
  const { user } = useAuth();
  const [form, setForm] = useState<SubmitForm>(() => buildInitialForm(defaultCity));
```

(Only the import block and the two new lines inside the function body change — everything else in the function signature/body stays as-is until the `submitEvent(...)` call below.)

The existing `submitEvent({...})` call currently ends with `submitter_name: form.submitter_name || null, submitter_email: form.submitter_email || null,`. Replace those two lines with:

```ts
        submitter_name: form.submitter_name || null,
        submitter_email: user!.email ?? null,
        submitter_id: user!.id,
        recurrence: form.recurrence || null,
```

`user!` is safe here: `/submit` is `RequireAuth`-gated, so by the time `handleSubmit` can fire, `user` is guaranteed non-null (`RequireAuth` renders nothing but a loading/redirect state otherwise). `submitter_email` now comes from the account, not `form.submitter_email` — Task 5 makes that form field read-only and pre-filled with the same value, so this is not a behavior change from what the user sees, only where the value is sourced at submit time.

- [ ] **Step 3: Fix the now-broken `SubmitEventPage.test.tsx`**

`SubmitEventPage.test.tsx` renders through the real `<Providers>` tree (real `AuthProvider`) with no mocked session, so `user` is `null` there. Three of its four tests click the Submit button, which now runs `user!.id`/`user!.email` and will throw. Add a `useAuth` mock — same technique `RequireAdmin.test.tsx` already established (mock the hook's return value directly, not the underlying context/provider).

At the top of `src/pages/SubmitEventPage.test.tsx`, the current mock block is:

```ts
vi.mock("../features/events/api/eventsRepo", () => ({
  submitEvent: vi.fn(),
}));
```

Add a second mock immediately after it:

```ts
vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@example.com" },
    session: null,
    loading: false,
    isAdmin: false,
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  }),
}));
```

No other change to this file is needed: the existing `expect.objectContaining({...})` assertion in the "submits the form successfully" test only checks a subset of the call's properties (`title`, `event_type`, `event_date`, `city`), so the new `submitter_id`/`submitter_email`/`recurrence` fields on the actual call don't break that partial match.

- [ ] **Step 4: Run the fixed test suite**

Run: `npx vitest run src/pages/SubmitEventPage.test.tsx`
Expected: PASS — all 3 tests (matches the pre-existing count; no test was added or removed, only fixed).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: exits 0 (Task 2's Step 4 failure is now resolved).

- [ ] **Step 6: Commit**

```bash
git add src/features/submit-event/validation.ts src/features/submit-event/useSubmitEventForm.ts src/pages/SubmitEventPage.test.tsx
git commit -m "feat: wire recurrence and account identity into submit-event form"
```

(No new test file beyond the fix above — `validateSubmitForm` has an existing test file, `validation.test.ts`, but no new validation rule was added, so no new case is needed. `useSubmitEventForm` has no test today, matching its sibling hooks.)

---

### Task 4: Recurring checkbox — `EventDetailsFieldset`

**Files:**

- Modify: `src/features/submit-event/components/EventDetailsFieldset.tsx`
- Modify: `src/pages/SubmitEventPage.css`

**Interfaces:**

- Consumes: `SubmitForm.recurrence` (Task 3).

- [ ] **Step 1: Add the checkbox**

In `src/features/submit-event/components/EventDetailsFieldset.tsx`, the current file's Date/Start Time row is a `<div className="form-row">` immediately followed by the Description `<div className="form-group">`. Insert the new control between them (after the closing `</div>` of the Date/Start-Time `form-row`, before the Description `form-group`):

```tsx
      <div className="form-group form-group--checkbox">
        <label>
          <input
            type="checkbox"
            checked={form.recurrence === "weekly"}
            onChange={(e) => update("recurrence", e.target.checked ? "weekly" : "")}
          />
          This is a weekly recurring event
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
```

(Only the new block is inserted; the existing Description `form-group` and everything after it is unchanged.)

- [ ] **Step 2: Add CSS for the checkbox variant**

`.submit-form .form-group label` today is `display: block` with uppercase/letter-spaced styling meant for text field labels — wrong for a checkbox+text row. Append to `src/pages/SubmitEventPage.css` (after the existing `.form-group` block, i.e. after the `input:focus`/`select:focus`/`textarea:focus` rule):

```css
.submit-form .form-group--checkbox label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-transform: none;
  letter-spacing: normal;
  font-size: 0.85rem;
  color: var(--text);
  cursor: pointer;
}

.submit-form .form-group--checkbox input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}
```

The second rule overrides `.form-group input { width: 100% }`, which would otherwise stretch the checkbox to fill the row.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/submit-event/components/EventDetailsFieldset.tsx src/pages/SubmitEventPage.css
git commit -m "feat: add weekly-recurring checkbox to submit-event form"
```

---

### Task 5: Read-only account email — `YourInfoFieldset` + `SubmitEventPage`

**Files:**

- Modify: `src/features/submit-event/components/YourInfoFieldset.tsx`
- Modify: `src/pages/SubmitEventPage.tsx`
- Modify: `src/pages/SubmitEventPage.css`

**Interfaces:**

- Consumes: `useAuth()` (existing).
- Produces: `YourInfoFieldset` gains a required `email: string` prop.

- [ ] **Step 1: Make the email field read-only, driven by a new prop**

Rewrite `src/features/submit-event/components/YourInfoFieldset.tsx` in full:

```tsx
import type { SubmitForm } from "../validation";

interface Props {
  form: SubmitForm;
  update: (field: keyof SubmitForm, value: string) => void;
  email: string;
}

export default function YourInfoFieldset({ form, update, email }: Props) {
  return (
    <fieldset>
      <legend>Your Info</legend>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="submitter_name">Your Name</label>
          <input
            id="submitter_name"
            type="text"
            placeholder="Your name"
            value={form.submitter_name}
            onChange={(e) => update("submitter_name", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="submitter_email">Your Email</label>
          <input id="submitter_email" type="email" value={email} readOnly />
        </div>
      </div>
    </fieldset>
  );
}
```

`form.submitter_email` (the form-state field) is no longer read here — the field always displays the signed-in account's email, matching what Task 3 actually sends on submit.

- [ ] **Step 2: Pass `email` down from `SubmitEventPage`**

In `src/pages/SubmitEventPage.tsx`, add the `useAuth` import and destructure `user`, then pass `email={user?.email ?? ""}` to `YourInfoFieldset`:

```tsx
import { useAuth } from "../contexts/useAuth";
import { useSubmitEventForm } from "../features/submit-event/useSubmitEventForm";
import EventDetailsFieldset from "../features/submit-event/components/EventDetailsFieldset";
import LocationFieldset from "../features/submit-event/components/LocationFieldset";
import PricingFieldset from "../features/submit-event/components/PricingFieldset";
import YourInfoFieldset from "../features/submit-event/components/YourInfoFieldset";
import SuccessCard from "../features/submit-event/components/SuccessCard";
import "./SubmitEventPage.css";

export default function SubmitEventPage() {
  const { user } = useAuth();
  const { form, update, handleSubmit, isSubmitting, isSubmitted, error, resetSubmitted } =
    useSubmitEventForm();
```

The JSX call site changes from `<YourInfoFieldset form={form} update={update} />` to:

```tsx
<YourInfoFieldset form={form} update={update} email={user?.email ?? ""} />
```

Everything else in the file (the `isSubmitted` early return, the surrounding `<section>`/`<form>` markup, the other three fieldsets) is unchanged.

- [ ] **Step 3: Style the read-only state**

Append to `src/pages/SubmitEventPage.css` (after Task 4's checkbox rules):

```css
.submit-form .form-group input[readonly] {
  background: rgba(255, 255, 255, 0.015);
  color: var(--text-muted);
  cursor: default;
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/submit-event/components/YourInfoFieldset.tsx src/pages/SubmitEventPage.tsx src/pages/SubmitEventPage.css
git commit -m "feat: make submit-event email field read-only, sourced from account"
```

---

### Task 6: `useMySubmissions` hook

**Files:**

- Create: `src/hooks/useMySubmissions.ts`

**Interfaces:**

- Consumes: `fetchMySubmissions` (Task 2).
- Produces: `useMySubmissions(userId: string | undefined): { submissions: DatabaseEvent[] | undefined; isLoading: boolean; error: string | null; refetch: () => void }` — consumed by Task 7's `ProfilePage`.

- [ ] **Step 1: Write the hook**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchMySubmissions } from "../features/events/api/eventsRepo";

export function useMySubmissions(userId: string | undefined) {
  const query = useQuery({
    queryKey: ["events", "mine", userId],
    queryFn: () => fetchMySubmissions(userId!),
    enabled: !!userId,
  });

  return {
    submissions: query.data,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
```

`userId` is typed optional (rather than requiring the caller to pre-guard) because `ProfilePage` reads `user` from `useAuth()`, which is `null` for one render while the session resolves — `enabled: !!userId` defers the query until it's available, matching the pattern `RequireAuth`'s `loading` gate already establishes upstream (by the time this component is mounted inside `RequireAuth`, `user` is non-null, but typing the hook to tolerate the transient `undefined` avoids a forced non-null assertion at the call site).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMySubmissions.ts
git commit -m "feat: add useMySubmissions hook"
```

(No test file — thin TanStack Query wrapper, matching `usePendingEvents.ts`/`useEventsQuery.ts`.)

---

### Task 7: `ProfilePage`

**Files:**

- Create: `src/pages/ProfilePage.tsx`
- Create: `src/pages/ProfilePage.css`

**Interfaces:**

- Consumes: `useAuth()`, `useMySubmissions` (Task 6).
- Produces: default export `ProfilePage` — consumed by Task 8's route.

- [ ] **Step 1: Write the page**

```tsx
import "temporal-polyfill/global";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { useMySubmissions } from "../hooks/useMySubmissions";
import type { DatabaseEvent } from "../features/events/model/types";
import "./ProfilePage.css";

const STATUS_LABEL: Record<DatabaseEvent["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

function formatSubmissionDate(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { submissions, isLoading, error, refetch } = useMySubmissions(user?.id);

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <p className="eyebrow">Account</p>
        <h1>My Profile</h1>
        {user?.email && <p className="profile-page-email">{user.email}</p>}
        <button type="button" className="btn-secondary" onClick={() => signOut()}>
          Sign Out
        </button>
      </header>

      <section className="profile-page-submissions">
        <h2>My submissions</h2>

        {isLoading && <p className="profile-page-status">Loading your submissions...</p>}

        {error && (
          <div className="profile-page-status profile-page-error">
            <p>Couldn't load your submissions: {error}</p>
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && submissions && submissions.length === 0 && (
          <p className="profile-page-status">
            You haven't submitted any events yet. <Link to="/submit">Submit one</Link>.
          </p>
        )}

        {submissions && submissions.length > 0 && (
          <ul className="profile-submission-list">
            {submissions.map((event) => (
              <li key={event.id} className="profile-submission-row">
                <div>
                  <p className="profile-submission-title">{event.title}</p>
                  <p className="profile-submission-meta">
                    {formatSubmissionDate(event.event_date)} ·{" "}
                    {event.city === "boston" ? "Boston" : "New York City"}
                  </p>
                </div>
                <span
                  className={`profile-submission-badge profile-submission-badge--${event.status}`}
                >
                  {STATUS_LABEL[event.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Write the CSS**

```css
.profile-page {
  max-width: 700px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}

.profile-page-header {
  margin-bottom: 2.5rem;
}

.profile-page-header h1 {
  font-family: var(--font-display);
  color: var(--text);
  margin: 0.2rem 0 0.6rem;
}

.profile-page-email {
  font-family: var(--font-ui);
  font-size: 0.9rem;
  color: var(--text-muted);
  margin: 0 0 1rem;
}

.profile-page-submissions h2 {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.profile-page-status {
  font-family: var(--font-ui);
  color: var(--text-muted);
  padding: 1.5rem 0;
}

.profile-page-status a {
  color: var(--gold);
}

.profile-page-error {
  color: var(--red-bright);
}

.profile-page-error button {
  margin-top: 0.75rem;
  padding: 0.5rem 1.5rem;
  background: var(--red-dim);
  color: var(--red-bright);
  border: 1px solid rgba(225, 29, 72, 0.3);
  border-radius: var(--radius-sm);
  font-family: var(--font-ui);
  cursor: pointer;
}

.profile-submission-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.profile-submission-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--border);
}

.profile-submission-title {
  font-family: var(--font-display);
  color: var(--text);
  margin: 0 0 0.25rem;
}

.profile-submission-meta {
  font-family: var(--font-ui);
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

.profile-submission-badge {
  flex-shrink: 0;
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-full);
}

.profile-submission-badge--pending {
  background: var(--gold-dim);
  color: var(--gold);
}

.profile-submission-badge--approved {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border-lg);
}

.profile-submission-badge--rejected {
  background: var(--red-dim);
  color: var(--red-bright);
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProfilePage.tsx src/pages/ProfilePage.css
git commit -m "feat: add ProfilePage"
```

(No test file — matches `AdminPage`'s precedent: presentational composition, no branching logic beyond a 1:1 status-to-label/class map, verified manually in Task 11.)

---

### Task 8: Wire the `/profile` route

**Files:**

- Modify: `src/App.tsx`

**Interfaces:**

- Consumes: `ProfilePage` (Task 7), existing `RequireAuth`.

- [ ] **Step 1: Add the lazy import and route**

The current lazy-import block in `src/App.tsx` is:

```tsx
const AdminPage = lazy(() => import("./pages/AdminPage"));
import RequireAuth from "./components/Auth/RequireAuth";
import RequireAdmin from "./components/Auth/RequireAdmin";
```

Change it to:

```tsx
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
import RequireAuth from "./components/Auth/RequireAuth";
import RequireAdmin from "./components/Auth/RequireAdmin";
```

The current `submit` route block is:

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

Add the profile route directly after it (before the `admin` route):

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
              path="profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire /profile route"
```

---

### Task 9: Nav links — `Header.tsx`

**Files:**

- Modify: `src/components/Header/Header.tsx`

**Interfaces:**

- Consumes: `useAuth()` (existing, already imported/used in this file for the Sign In/Out button).

- [ ] **Step 1: Add the two nav items**

The current `nav-links` list's last item before the closing `</ul>` is the Contact link:

```tsx
          <li>
            <NavLink
              to={"/contact"}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Contact
            </NavLink>
          </li>
        </ul>
```

Insert two new conditional items directly before the closing `</ul>` (after the Contact `<li>`):

```tsx
          <li>
            <NavLink
              to={"/contact"}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Contact
            </NavLink>
          </li>
          {user && (
            <li>
              <NavLink
                to={"/submit"}
                onClick={closeMenu}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                Submit Event
              </NavLink>
            </li>
          )}
          {user && (
            <li>
              <NavLink
                to={"/profile"}
                onClick={closeMenu}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                My Profile
              </NavLink>
            </li>
          )}
        </ul>
```

`user` is already destructured from `useAuth()` at the top of this component (used by the existing Sign In/Out button) — no new import or hook call needed.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/Header/Header.tsx
git commit -m "feat: add Submit Event and My Profile nav links for signed-in users"
```

---

### Task 10: OAuth buttons — "Coming soon"

**Files:**

- Modify: `src/components/Auth/SignInForm.tsx`

**Interfaces:** none (self-contained UI change; no new props/exports).

- [ ] **Step 1: Disable the three OAuth buttons**

`.btn-oauth:disabled` already exists in `SignInForm.css` (`opacity: 0.6; cursor: not-allowed;`) — no new CSS is needed; making the buttons permanently `disabled` picks up that existing style for free.

The current OAuth buttons block in `src/components/Auth/SignInForm.tsx` is:

```tsx
<div className="oauth-buttons">
  <button
    type="button"
    className="btn-oauth btn-apple"
    onClick={() => signInWithOAuth("apple")}
    disabled={loading}
  >
    Continue with Apple
  </button>
  <button
    type="button"
    className="btn-oauth btn-google"
    onClick={() => signInWithOAuth("google")}
    disabled={loading}
  >
    Continue with Google
  </button>
  <button
    type="button"
    className="btn-oauth btn-github"
    onClick={() => signInWithOAuth("github")}
    disabled={loading}
  >
    Continue with GitHub
  </button>
</div>
```

Replace it with:

```tsx
<div className="oauth-buttons">
  <button type="button" className="btn-oauth btn-apple" disabled>
    Continue with Apple (Coming soon)
  </button>
  <button type="button" className="btn-oauth btn-google" disabled>
    Continue with Google (Coming soon)
  </button>
  <button type="button" className="btn-oauth btn-github" disabled>
    Continue with GitHub (Coming soon)
  </button>
</div>
```

- [ ] **Step 2: Remove the now-unused `signInWithOAuth` destructure**

The current top of the component destructures `const { signInWithPassword, signUp, signInWithOAuth, loading } = useAuth();`. Since Step 1 removed the only two call sites, change this line to:

```tsx
const { signInWithPassword, signUp, loading } = useAuth();
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0. (If `signInWithOAuth` were left in the destructure with no remaining use, `eslint`'s unused-vars rule would fail `npm run lint` — Step 2 prevents that; `npm run build` alone won't catch it, so also run `npm run lint` here specifically.)

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/Auth/SignInForm.tsx
git commit -m "feat: disable OAuth sign-in buttons, label as coming soon"
```

---

### Task 11: Manual verification + docs sync

**Files:**

- Modify: `Docs/STATUS_SUMMARY.md`

**Interfaces:** none (verification + documentation only).

- [ ] **Step 1: Full regression gate**

Run in order:

```bash
npm run lint
npx vitest run
npm run build
```

Expected: all three exit 0, same test count as before this plan (no new test files were added).

- [ ] **Step 2: Manual click-through**

With `npx supabase status` confirming the stack is up and `npm run dev` running, signed in as a non-admin test account:

1. Confirm the header now shows "Submit Event" and "My Profile" links (and did not before signing in — check by signing out first).
2. Visit `/submit`: confirm the "Your Email" field shows the account's email and cannot be typed into; check "This is a weekly recurring event"; fill the rest and submit.
3. Query the DB directly: `docker exec -i supabase_db_Salsa psql -U postgres -tAc "select submitter_id, recurrence from events order by created_at desc limit 1"` — confirm `submitter_id` is the signed-in user's UUID and `recurrence` is `weekly`.
4. Visit `/profile`: confirm the submission appears with badge **Pending**, correct title/date/city, and the account email is shown at the top.
5. Sign in as the admin account, approve the submission via `/admin`.
6. Sign back in as the original submitter, reload `/profile`: confirm the badge now reads **Approved**. Open `/calendar`, click the event, confirm the modal shows upcoming weekly series dates (proves `recurrence` reached `convert.ts`'s existing display logic unchanged).
7. Sign in as a different (or brand-new) account, visit `/profile`: confirm it shows the empty state ("You haven't submitted any events yet.") and does **not** show the first account's submission.
8. On `/signin`, confirm all three OAuth buttons show "(Coming soon)", are visibly dimmed, and produce no console error or network request when clicked.

- [ ] **Step 3: Update `Docs/STATUS_SUMMARY.md`**

Add a line under the existing Authentication/Moderation-dashboard bullets in "What's Built" (or wherever the current file's structure best fits after Task 10's changes — re-read the file first, line numbers will have shifted since the moderation-dashboard docs sync) noting: account-linked submissions (`submitter_id`), `/profile` page, and nav discoverability for Submit Event/My Profile, shipped alongside a note that OAuth sign-in (Apple/Google/GitHub) is UI-present but disabled pending real provider credentials.

- [ ] **Step 4: Commit**

```bash
git add Docs/STATUS_SUMMARY.md
git commit -m "docs: note account-linked submissions and profile page in status summary"
```

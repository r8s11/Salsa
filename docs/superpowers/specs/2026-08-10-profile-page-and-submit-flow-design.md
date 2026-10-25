# Account-Linked Submissions, My Profile Page, and OAuth "Coming Soon"

**Date:** 2026-08-10
**Context:** `/submit` already exists and works (Modernization Blueprint decomposition, `useSubmitEventForm` + fieldset components) but is unreachable — no nav link — and asks a signed-in user to retype their own email as free text. There is no account page at all. Separately, the three OAuth sign-in buttons (Apple/Google/GitHub) are live in the UI but throw a raw `400 Unsupported provider` since none of the three providers has been registered anywhere (local or hosted Supabase project).

## Scope

**In scope:**

1. `submitter_id` column on `public.events`, set from the signed-in user on every submission.
2. Pre-filled, read-only submitter email on `/submit`; a "weekly recurring" checkbox wired to the existing `recurrence` column.
3. New `/profile` page: account email, sign out, list of the signed-in user's own submissions with status.
4. `Submit Event` and `My Profile` nav links, visible only when signed in.
5. OAuth buttons (Apple/Google/GitHub) become inert, labeled "(Coming soon)".

**Out of scope (explicit):**

- Editing or withdrawing a submission from `/profile` — read-only status tracking only; fixing a bad submission still goes through an admin.
- Any recurrence type beyond `"weekly"` — matches the only value the calendar/modal already understand (`event.recurrence === "weekly"` is the sole branch anywhere in the codebase).
- A display-name field on the account — nothing in this app collects one at signup, so `submitter_name` on `/submit` stays a manual, editable field; only `submitter_email` is account-derived.
- Actually registering real Apple/Google/GitHub OAuth apps — that's an external, credential-owning task for the operator, not code.
- An account dropdown menu — plain nav links only, per existing nav pattern.

## Section 1 — Data model & submission changes

**Migration `supabase/migrations/20260811000000_submitter_id_and_recurring.sql`:**

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

**`src/features/events/model/types.ts`:** `DatabaseEvent` gains `submitter_id: string | null;` (alongside the existing `submitter_name`/`submitter_email`).

**`src/features/events/api/eventsRepo.ts`:**

- `NewEventSubmission` gains `submitter_id: string;` and `recurrence: "weekly" | null;`.
- New: `fetchMySubmissions(userId: string): Promise<DatabaseEvent[]>` — `select("*").eq("submitter_id", userId).order("created_at", { ascending: false })`, same error-handling shape as every sibling function in this file.

**`src/features/submit-event/validation.ts`:** `SubmitForm` gains `recurrence: "weekly" | "";` (default `""` in `buildInitialForm`). No new validation rules — a checkbox can't be malformed.

**`src/features/submit-event/useSubmitEventForm.ts`:** reads `user` from `useAuth()`. `handleSubmit` sends `submitter_id: user!.id` (non-null — `/submit` is `RequireAuth`-gated, `user` is always present by the time this runs) and `recurrence: form.recurrence || null`. `submitter_email` in the payload comes from `user!.email`, not `form.submitter_email` — see Section 2 for why the field becomes read-only rather than removed.

## Section 2 — Submit form changes

**`src/features/submit-event/components/YourInfoFieldset.tsx`:** the `submitter_email` input becomes `readOnly`, pre-filled from `user.email` (new prop: `email: string`, passed down from `SubmitEventPage` via `useAuth()`). It stays visibly present (not hidden) so the submitter can see whose account the submission is tied to — a signed-in user cannot submit under a different email. `submitter_name` is unchanged: manual, editable, optional.

**`src/features/submit-event/components/EventDetailsFieldset.tsx`:** one new control, placed directly after the existing Date/Start Time row:

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
```

Reuses `update`'s existing `(field: keyof SubmitForm, value: string)` signature unchanged — the checkbox maps directly to the same string-typed `recurrence` field the DB column and `ScheduleXEvent`/`convert.ts` already use, no new plumbing needed anywhere else in the form.

## Section 3 — Profile page & navigation

**`src/hooks/useMySubmissions.ts`** (new, alongside `usePendingEvents.ts`): thin TanStack Query wrapper — `useQuery({ queryKey: ["events", "mine", userId], queryFn: () => fetchMySubmissions(userId) })`, `enabled: !!userId`.

**`src/pages/ProfilePage.tsx`** (new, route `/profile`, gated by `RequireAuth` — any signed-in user, not admin-only):

- Header: `user.email`, a Sign Out button (reuses `useAuth().signOut`, same call the existing Header button makes).
- `useMySubmissions(user!.id)` drives the list. States: loading, error (+ retry, same pattern as `AdminPage`), empty (`"You haven't submitted any events yet."` + a link to `/submit`), populated.
- Each row: title, formatted date/city (same `Temporal.Instant → America/New_York` idiom `PendingEventCard` already uses — no new formatter), and a status badge mapping `status` 1:1 — `"pending" → "Pending"`, `"approved" → "Approved"`, `"rejected" → "Rejected"`.
- `src/pages/ProfilePage.css`: page-scoped, reuses the same CSS custom properties (`--card`, `--border`, `--gold`, `--red-bright`, etc.) `AdminPage.css`/`PendingEventCard.css` already establish for status-flavored badges.

**`src/App.tsx`:** two new lazy routes, both wrapped in the existing `RequireAuth` (not `RequireAdmin` — any signed-in user): `<Route path="submit" .../>` already exists; add `<Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />`.

**`src/components/Header/Header.tsx`:** two new `<NavLink>` entries — "Submit Event" (`/submit`) and "My Profile" (`/profile`) — inserted into the existing `nav-links` `<ul>`, each wrapped in `{user && (...)}`. Signed-out visitors see the nav unchanged. Sign In/Sign Out button logic is untouched.

## Section 4 — OAuth buttons "Coming soon"

**`src/components/Auth/SignInForm.tsx`:** the three OAuth buttons' `onClick={() => signInWithOAuth("apple" | "google" | "github")}` is removed and replaced with `disabled`. Label text appends `(Coming soon)` — e.g. `"Continue with Apple (Coming soon)"`. `signInWithOAuth` stays imported/destructured from `useAuth()` only if still used elsewhere in the file (it is not, after this change — remove the now-unused destructure to avoid an unused-variable lint failure). `SignInForm.css` gains a `:disabled` rule for `.oauth-buttons button` matching the reduced-opacity/no-pointer treatment already established by `.pending-event-actions button:disabled`. When a provider gets real credentials later, flipping that one button's `disabled`/`onClick` back is the only change needed — no structural rework.

## Section 5 — Testing

No new automated tests (matches this codebase's established split — pure decision/validation logic gets tests, thin repo functions/hooks/presentational pages don't; nothing here adds new branching logic beyond a 1:1 status-to-label mapping and a static `disabled` flip).

**Manual verification** (the real gate for anything touching live Supabase):

1. Sign in, visit `/submit`: confirm the email field is pre-filled with the account email and not editable; check "weekly recurring"; submit.
2. Query the DB directly (or check via `/admin`) and confirm the new row has `submitter_id` set to the signed-in user's UUID and `recurrence = 'weekly'`.
3. Visit `/profile`: confirm the submission appears with status **Pending**, correct title/date/city.
4. As an admin, approve it via `/admin`; reload `/profile` as the original submitter; confirm the badge flips to **Approved**, and the event now also appears on `/calendar` with its weekly series dates shown in the modal (proves `recurrence` flowed through unchanged to `convert.ts`'s existing logic).
5. Attempt (via the browser console, using the anon key, not the app UI) an insert with a `submitter_id` set to a different user's UUID while signed in as user A — confirm Postgres rejects it (`new row violates row-level security policy`), proving the `IS NOT DISTINCT FROM` hardening on the insert policy holds.
6. Confirm the three OAuth buttons render as disabled with "(Coming soon)" text and produce no console error when clicked (they shouldn't be clickable at all).
7. Signed out, confirm the header shows no "Submit Event"/"My Profile" links.

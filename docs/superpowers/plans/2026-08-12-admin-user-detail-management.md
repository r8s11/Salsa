# Admin User Detail & Role Management (`/admin/users/:id`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/admin/users/:id`, the single-account detail and role-management screen, per the approved design at `Docs/plans/phase6-admin-user-detail-management.md`.

**Architecture:** A new `AdminUserDetailPage` reads the already-cached Phase 5 `useAdminUsers()`/`useAdminEvents()` query results and finds the one row/events it needs client-side — no new bulk RPC. Two small additions to the data layer: `admin_user_directory()` gains an `email_confirmed_at` column, and a new `auditLogRepo.fetchUserAuditLog()` reads the already-grant-permitted `audit_logs` table directly. Every mutating dialog (`AdminRoleChangeDialog`, `AdminFlagUserDialog`, `AdminConfirmDialog`) is reused verbatim from Phase 5. Shared row logic (`UserAvatar`, `rowActionItems`) is extracted out of `AdminUsersTable.tsx` so the table row menu and the detail page's header menu are provably the same contract.

**Tech Stack:** React 19, TypeScript, Vite, React Router v7, Supabase (Postgres 17 + PostgREST), TanStack Query v5, Vitest + Testing Library.

## Global Constraints

- Repo module owning all Supabase calls for one entity: `profilesRepo.ts` for profiles/users, new `auditLogRepo.ts` for `audit_logs` — never call `supabase.from(...)`/`supabase.rpc(...)` from a component or hook directly.
- No new tables, no new RPC functions beyond the one `admin_user_directory()` column addition — see `Docs/plans/phase6-admin-user-detail-management.md` Decisions section; this is a hard constraint from the approved design, not an oversight to fix later.
- Every dialog (`AdminRoleChangeDialog`, `AdminFlagUserDialog`, `AdminConfirmDialog`) is reused unmodified — zero prop or behavior changes.
- Match existing code style exactly: `admin-<component>__<part>` CSS class naming, `.admin-shell`-scoped rules appended to component-local `.css` files, `PAGE_SIZE_OPTIONS`/URL-as-state-store patterns from `AdminEventsPage.tsx`/`AdminUsersPage.tsx` where relevant.
- Run only the specific test file(s) named in each task's Step "Run tests" line while executing tasks — full-suite `npx vitest run`, `npm run build`, and `npm run lint` run once, at the very end (Task 9), not per task.
- After this plan lands, the same production-schema-reconciliation step Phase 5 needed applies again: `admin_user_directory()`'s signature changes, so a hand-applied `create or replace` on the hosted project will fail (Postgres rejects return-type changes via `CREATE OR REPLACE FUNCTION`) unless the migration's `drop function` runs first, exactly as Task 1 writes it. This is a known operational step, not something to solve inside the plan.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260816000000_admin_user_directory_email_verified.sql` | Adds `email_confirmed_at` to `admin_user_directory()`'s return shape |
| `src/features/admin/model/usersQuery.ts` | `AdminUserRow` gains `email_confirmed_at`; gains exported `rowActionItems`/`UserRowAction` (moved from the table) |
| `src/components/Admin/AdminUserAvatar.tsx` | New — the avatar/initials/guest-icon rendering, shared by the table and the detail header |
| `src/components/Admin/AdminUsersTable.tsx` | Modified — imports the two extractions instead of defining them; row name becomes a link |
| `src/features/admin/model/auditLog.ts` | New — pure `AuditLogRow` type, `auditLogLabelFor`, `actorLabelFor`, `latestActionEntry` |
| `src/features/admin/api/auditLogRepo.ts` | New — the only module calling `supabase.from("audit_logs")` |
| `src/hooks/useUserAuditLog.ts` | New — TanStack Query wrapper around `fetchUserAuditLog` |
| `src/pages/AdminUserDetailPage.tsx` + `.css` + `.test.tsx` | New — the page itself |
| `src/App.tsx` | Modified — new route |
| `src/layouts/AdminLayout.tsx` | Modified — breadcrumb resolves `/admin/users/:id` to "Users" |

---

### Task 1: `admin_user_directory()` gains `email_confirmed_at`

**Files:**

- Create: `supabase/migrations/20260816000000_admin_user_directory_email_verified.sql`
- Modify: `src/features/admin/model/usersQuery.ts:5-20` (the `AdminUserRow` interface)
- Modify: `src/features/admin/model/usersQuery.test.ts` (the `makeRow` fixture builder)
- Modify: `src/pages/AdminUsersPage.test.tsx` (the six `AdminUserRow` fixtures)
- Modify: `src/features/admin/api/profilesRepo.ts` (no code change — `fetchUserDirectory`'s return type is `AdminUserRow[]`, already correct once the interface updates)

**Interfaces:**

- Produces: `AdminUserRow.email_confirmed_at: string | null` (ISO timestamp string when confirmed, `null` when not — mirrors how `created_at`/`last_active_at` are already typed as ISO strings, and matches `email_confirmed_at`'s Postgres `timestamptz` type, not a boolean).

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260816000000_admin_user_directory_email_verified.sql`:

```sql
-- Phase 6 — admin_user_directory() gains email_confirmed_at (from
-- auth.users) for the User Detail page's Email Verified chip. Postgres
-- rejects changing a set-returning function's column list via CREATE OR
-- REPLACE, so this drops and recreates the function, then re-grants
-- (the grants from 20260815000000_users_management.sql do not survive a
-- drop — the function becomes a new catalog object).

drop function if exists public.admin_user_directory();

create function public.admin_user_directory()
returns table (
  kind                text,
  id                  text,
  user_id             uuid,
  email               text,
  display_name        text,
  username            text,
  avatar_url          text,
  role                text,
  status              text,
  status_reason       text,
  created_at          timestamptz,
  last_active_at      timestamptz,
  contributions       integer,
  pending_count       integer,
  email_confirmed_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  with profile_stats as (
    select e.submitter_id                                        as uid,
           count(*)::int                                         as total,
           count(*) filter (where e.status = 'pending')::int      as pending,
           max(e.created_at)                                      as last_event_at
      from public.events e
     where e.submitter_id is not null
     group by e.submitter_id
  ),
  guest_stats as (
    select lower(btrim(e.submitter_email))                                        as email,
           min(coalesce(nullif(btrim(e.submitter_name), ''), 'Guest Submitter'))   as name,
           count(*)::int                                                          as total,
           count(*) filter (where e.status = 'pending')::int                       as pending,
           max(e.created_at)                                                       as last_event_at,
           min(e.created_at)                                                       as first_event_at
      from public.events e
     where e.submitter_id is null
       and e.source_type = 'user_submission'
       and btrim(coalesce(e.submitter_email, '')) <> ''
     group by lower(btrim(e.submitter_email))
  )
  select 'profile'::text, p.id::text, p.id, u.email::text,
         p.display_name, p.username, p.avatar_url,
         p.role, p.status, p.status_reason, p.created_at,
         greatest(coalesce(u.last_sign_in_at, p.created_at),
                  coalesce(s.last_event_at, p.created_at)),
         coalesce(s.total, 0), coalesce(s.pending, 0),
         u.email_confirmed_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join profile_stats s on s.uid = p.id
  union all
  select 'guest'::text, 'guest:' || g.email, null::uuid, g.email,
         g.name, null::text, null::text,
         null::text, 'active', null::text, g.first_event_at,
         g.last_event_at, g.total, g.pending,
         null::timestamptz
    from guest_stats g
   where not exists (select 1 from auth.users u2 where lower(u2.email) = g.email);
end;
$$;

revoke execute on function public.admin_user_directory() from public;
grant  execute on function public.admin_user_directory() to authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply it locally and verify the new column is present**

Run: `cd /home/r8s/code/Salsa && npm run db:reset`
Expected: all migrations apply cleanly, including the new one, with no errors.

Run: `docker exec -i supabase_db_Salsa psql -U postgres -tAc "select column_name from information_schema.columns where table_schema='public' and routine... "` is not valid for functions — instead verify via:
`docker exec -i supabase_db_Salsa psql -U postgres -tAc "select pg_get_function_result('public.admin_user_directory'::regproc);"`
Expected output contains `email_confirmed_at timestamp with time zone` as the last column in the `TABLE(...)` list.

- [ ] **Step 3: Update the `AdminUserRow` interface**

In `src/features/admin/model/usersQuery.ts`, the `AdminUserRow` interface currently ends:

```ts
  contributions: number;
  pending_count: number;
}
```

Change to:

```ts
  contributions: number;
  pending_count: number;
  email_confirmed_at: string | null;
}
```

- [ ] **Step 4: Update existing test fixtures so `tsc`/tests stay green**

In `src/features/admin/model/usersQuery.test.ts`, find the `makeRow` fixture builder function. It returns an object literal satisfying `AdminUserRow`; add one field to its defaults:

```ts
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
```

(Add it alongside the existing `created_at`/`last_active_at` defaults, before the closing `...overrides` spread, matching that file's existing style.)

In `src/pages/AdminUsersPage.test.tsx`, each of the six `AdminUserRow` fixture objects (`selfAdmin`, `organizer`, `flaggedUser`, `suspendedUser`, `bannedUser`, `guest`) needs `email_confirmed_at` added. Use `"2026-01-01T00:00:00.000Z"` for every profile fixture and `null` for `guest` (guests have no `auth.users` row, so the SQL always returns `null` for them).

- [ ] **Step 5: Run tests to verify nothing broke**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/features/admin/model/usersQuery.test.ts src/pages/AdminUsersPage.test.tsx`
Expected: all tests pass (32 + 9, same counts as before — this step only restores type-correctness, not new behavior).

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/r8s/code/Salsa
git add supabase/migrations/20260816000000_admin_user_directory_email_verified.sql src/features/admin/model/usersQuery.ts src/features/admin/model/usersQuery.test.ts src/pages/AdminUsersPage.test.tsx
git commit -m "Add email_confirmed_at to admin_user_directory()"
```

---

### Task 2: Extract `AdminUserAvatar`

**Files:**

- Create: `src/components/Admin/AdminUserAvatar.tsx`
- Modify: `src/components/Admin/AdminUsersTable.tsx:172-194` (delete the local `UserAvatar` function; import the extracted one)

**Interfaces:**

- Consumes: `AdminUserRow` (from `usersQuery.ts`, unchanged), `initialsFor` (from `usersQuery.ts`, unchanged).
- Produces: `export default function AdminUserAvatar({ row, size }: { row: AdminUserRow; size?: number }): JSX.Element` — `size` defaults to `40` (the table's current fixed size) so the detail page's header (which needs a larger avatar) can pass a bigger value without a second component.

- [ ] **Step 1: Create the extracted component**

`src/components/Admin/AdminUserAvatar.tsx`:

```tsx
import { UserRound } from "lucide-react";
import { initialsFor, type AdminUserRow } from "../../features/admin/model/usersQuery";

export default function AdminUserAvatar({
  row,
  size = 40,
}: {
  row: AdminUserRow;
  size?: number;
}) {
  if (row.kind === "guest") {
    return (
      <span
        className="admin-users-table__avatar admin-users-table__avatar--guest"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <UserRound size={Math.round(size * 0.45)} />
      </span>
    );
  }
  if (row.avatar_url) {
    return <img src={row.avatar_url} alt="" loading="lazy" width={size} height={size} />;
  }
  return (
    <span
      className="admin-users-table__avatar admin-users-table__avatar--initials"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initialsFor(row)}
    </span>
  );
}
```

(The `style={{ width, height }}` inline override lets the detail page request a larger avatar while the table's default 40px path renders byte-identical markup to before — the CSS classes already set `width: 40px; height: 40px` as their base rule, and this inline style only differs from that base when a caller passes a non-default `size`.)

- [ ] **Step 2: Update `AdminUsersTable.tsx` to use it**

In `src/components/Admin/AdminUsersTable.tsx`:

- Delete lines 172-194 (the local `UserAvatar` function).
- Add `import AdminUserAvatar from "./AdminUserAvatar";` to the top import block.
- In `UserCell` (originally lines 196-220), change `<UserAvatar row={row} />` to `<AdminUserAvatar row={row} />`.

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/pages/AdminUsersPage.test.tsx`
Expected: all 9 tests pass unchanged (this is a pure extraction — the rendered markup for the table's default 40px avatars is identical).

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/components/Admin/AdminUserAvatar.tsx src/components/Admin/AdminUsersTable.tsx
git commit -m "Extract AdminUserAvatar for reuse on the detail page"
```

---

### Task 3: Extract `rowActionItems` into `usersQuery.ts`, add unit tests

**Files:**

- Modify: `src/features/admin/model/usersQuery.ts` (add `UserRowAction` type + `rowActionItems` function)
- Modify: `src/features/admin/model/usersQuery.test.ts` (add `describe("rowActionItems", ...)`)
- Modify: `src/components/Admin/AdminUsersTable.tsx:29-36,63-139` (delete the local type/function; import from `usersQuery.ts`)

**Interfaces:**

- Produces: `export type UserRowAction = "view-contributions" | "change-role" | "flag" | "unflag" | "suspend" | "ban" | "restore";` and `export function rowActionItems(user: AdminUserRow, currentUserId: string | null, adminCount: number, onAction: (action: UserRowAction, user: AdminUserRow) => void): ActionMenuItem[]` — identical signature and matrix to what `AdminUsersTable.tsx` already has; this task only moves it.
- Consumes (in the new location): `ActionMenuItem` type from `../../components/Admin/AdminActionMenu` (note the relative path changes since `usersQuery.ts` lives one directory deeper than `AdminUsersTable.tsx` — `src/features/admin/model/` vs `src/components/Admin/`).

- [ ] **Step 1: Write the failing test first**

Add to `src/features/admin/model/usersQuery.test.ts` (this references `rowActionItems`, which doesn't exist in this file yet, so it will fail to compile/run):

```ts
describe("rowActionItems", () => {
  const currentUserId = "self-1";

  it("guest rows get only View Submissions", () => {
    const guest = makeRow({ kind: "guest", user_id: null, id: "guest:x@y.test" });
    const items = rowActionItems(guest, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual(["view-contributions"]);
    expect(items[0].label).toBe("View Submissions");
  });

  it("self row gets only View Contributions, regardless of status", () => {
    const self = makeRow({ user_id: currentUserId, status: "active" });
    const items = rowActionItems(self, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual(["view-contributions"]);
    expect(items[0].label).toBe("View Contributions");
  });

  it("the last remaining admin gets only View Contributions", () => {
    const soleAdmin = makeRow({ user_id: "other-1", role: "admin", status: "active" });
    const items = rowActionItems(soleAdmin, currentUserId, 1, vi.fn());
    expect(items.map((item) => item.id)).toEqual(["view-contributions"]);
  });

  it("active status offers Change Role, Flag, Suspend, Ban", () => {
    const active = makeRow({ user_id: "other-1", role: "user", status: "active" });
    const items = rowActionItems(active, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual([
      "view-contributions",
      "change-role",
      "flag",
      "suspend",
      "ban",
    ]);
  });

  it("flagged status offers Remove Flag instead of Flag", () => {
    const flagged = makeRow({ user_id: "other-1", status: "flagged" });
    const items = rowActionItems(flagged, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual([
      "view-contributions",
      "change-role",
      "unflag",
      "suspend",
      "ban",
    ]);
  });

  it("suspended status offers Restore and Ban only, no Change Role", () => {
    const suspended = makeRow({ user_id: "other-1", status: "suspended" });
    const items = rowActionItems(suspended, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual(["view-contributions", "restore", "ban"]);
  });

  it("banned status offers Restore only", () => {
    const banned = makeRow({ user_id: "other-1", status: "banned" });
    const items = rowActionItems(banned, currentUserId, 2, vi.fn());
    expect(items.map((item) => item.id)).toEqual(["view-contributions", "restore"]);
  });

  it("onAction receives the action id and the row when an item is selected", () => {
    const onAction = vi.fn();
    const active = makeRow({ user_id: "other-1", status: "active" });
    const items = rowActionItems(active, currentUserId, 2, onAction);
    items.find((item) => item.id === "flag")!.onSelect();
    expect(onAction).toHaveBeenCalledWith("flag", active);
  });
});
```

Add `rowActionItems` (and `vi` if not already imported — check the file's existing import line and add `vi` to the `vitest` import if it's only importing `describe, expect, it`) to the file's top import from `./usersQuery`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/features/admin/model/usersQuery.test.ts`
Expected: FAIL — `rowActionItems is not exported from "./usersQuery"` (or a TypeScript compile error to that effect).

- [ ] **Step 3: Move the implementation into `usersQuery.ts`**

At the top of `src/features/admin/model/usersQuery.ts`, add:

```ts
import type { ComponentType } from "react";
import {
  ListChecks,
  UserCog,
  Flag,
  FlagOff,
  PauseCircle,
  Ban,
  RotateCcw,
} from "lucide-react";
import type { ActionMenuItem } from "../../../components/Admin/AdminActionMenu";
```

Near the end of the file (after `userViewCounts`), add:

```ts
export type UserRowAction =
  | "view-contributions"
  | "change-role"
  | "flag"
  | "unflag"
  | "suspend"
  | "ban"
  | "restore";

// Row action menu contents by row identity/status — this matrix is the contract.
export function rowActionItems(
  user: AdminUserRow,
  currentUserId: string | null,
  adminCount: number,
  onAction: (action: UserRowAction, user: AdminUserRow) => void
): ActionMenuItem[] {
  const viewContributions: ActionMenuItem = {
    id: "view-contributions",
    label: user.kind === "guest" ? "View Submissions" : "View Contributions",
    icon: ListChecks,
    onSelect: () => onAction("view-contributions", user),
  };

  if (user.kind === "guest") {
    return [viewContributions];
  }
  if (user.user_id === currentUserId) {
    return [viewContributions];
  }
  if (user.role === "admin" && adminCount <= 1) {
    return [viewContributions];
  }

  const changeRole: ActionMenuItem = {
    id: "change-role",
    label: "Change Role",
    icon: UserCog,
    separatorBefore: true,
    onSelect: () => onAction("change-role", user),
  };
  const flag: ActionMenuItem = {
    id: "flag",
    label: "Flag",
    icon: Flag,
    separatorBefore: true,
    onSelect: () => onAction("flag", user),
  };
  const unflag: ActionMenuItem = {
    id: "unflag",
    label: "Remove Flag",
    icon: FlagOff,
    separatorBefore: true,
    onSelect: () => onAction("unflag", user),
  };
  const suspend: ActionMenuItem = {
    id: "suspend",
    label: "Suspend",
    icon: PauseCircle,
    onSelect: () => onAction("suspend", user),
  };
  const ban: ActionMenuItem = {
    id: "ban",
    label: "Ban",
    icon: Ban,
    tone: "danger",
    onSelect: () => onAction("ban", user),
  };
  const restore: ActionMenuItem = {
    id: "restore",
    label: "Restore Access",
    icon: RotateCcw,
    separatorBefore: true,
    onSelect: () => onAction("restore", user),
  };

  switch (user.status) {
    case "active":
      return [viewContributions, changeRole, flag, suspend, ban];
    case "flagged":
      return [viewContributions, changeRole, unflag, suspend, ban];
    case "suspended":
      return [viewContributions, restore, ban];
    case "banned":
      return [viewContributions, restore];
  }
}
```

This is a verbatim move of the function currently at `AdminUsersTable.tsx:64-139` plus the `UserRowAction` type currently at `AdminUsersTable.tsx:29-36` — do not change the matrix.

- [ ] **Step 4: Delete the moved code from `AdminUsersTable.tsx` and import instead**

In `src/components/Admin/AdminUsersTable.tsx`:

- Delete the `export type UserRowAction = ...` block (lines 29-36).
- Delete the `rowActionItems` function (lines 63-139, including its leading comment).
- Delete the now-unused icon imports (`ListChecks, UserCog, Flag, FlagOff, PauseCircle, Ban, RotateCcw`) from the `lucide-react` import at the top — check which of `Mail, ArrowUpDown, ArrowUp, ArrowDown, UserRound` (also imported there) are still used elsewhere in the file before removing; `UserRound` moved to `AdminUserAvatar.tsx` in Task 2, so it should already be gone from this file's imports if Task 2 was done correctly — verify, don't just assume.
- Change the import from `"../../features/admin/model/usersQuery"` to include `type UserRowAction, rowActionItems` alongside the existing `type AdminUserRow, type UserSortKey, type SortDir, displayNameFor, identityLineFor, initialsFor` (drop `initialsFor` from this import if `AdminUserAvatar.tsx` is now the only place that used it — check).
- Re-export `UserRowAction` from this file for backward compatibility with existing importers: `export type { UserRowAction } from "../../features/admin/model/usersQuery";` — `AdminUsersPage.tsx` currently does `import AdminUsersTable, { type UserRowAction } from "../components/Admin/AdminUsersTable";`; keeping the re-export here means that import line doesn't need to change.

- [ ] **Step 5: Run tests to verify everything passes**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/features/admin/model/usersQuery.test.ts src/pages/AdminUsersPage.test.tsx`
Expected: PASS — the new `rowActionItems` describe block (8 tests) plus all existing tests (32 + 9, unaffected in behavior).

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/features/admin/model/usersQuery.ts src/features/admin/model/usersQuery.test.ts src/components/Admin/AdminUsersTable.tsx
git commit -m "Extract rowActionItems into usersQuery.ts with unit tests"
```

---

### Task 4: Table row name links to `/admin/users/:id`

**Files:**

- Modify: `src/components/Admin/AdminUsersTable.tsx` (the `UserCell` function, and the mobile card head)
- Modify: `src/pages/AdminUsersPage.test.tsx` (one existing test needs its query updated from `getByText` to account for the name now being inside a link — verify test 1's assertions still pass; if `screen.getByText("Maria Santos")` starts also matching link text, that's fine, `getByText` matches text content regardless of the element)

**Interfaces:**

- Consumes: `react-router-dom`'s `Link` (already used elsewhere in this codebase, e.g. `AdminEventsTable.tsx`'s event title link).
- Produces: no new exports; this is a rendering change only. Guest rows (`kind === "guest"`) do NOT get a link — there is no `/admin/users/:id` route for a `guest:` id's underlying identity in a way that's more useful than staying on the list (the guest's `id` *is* a valid detail-page id per the design doc, actually — re-check: the design doc's Data reality section confirms `admin_user_directory()` already returns `guest:<email>` as `id` for guest rows, and the detail page is designed to render a magic-link presentation for exactly this `kind`. So guests DO get a working detail page — link them too, do not special-case them out.)

- [ ] **Step 1: Update the desktop table cell**

In `src/components/Admin/AdminUsersTable.tsx`'s `UserCell` function, the name line currently reads:

```tsx
        <p className="admin-users-table__name">
          {displayNameFor(row)}
          {row.user_id === currentUserId && <span className="admin-chip">You</span>}
        </p>
```

Change to:

```tsx
        <p className="admin-users-table__name">
          <Link to={`/admin/users/${row.id}`}>{displayNameFor(row)}</Link>
          {row.user_id === currentUserId && <span className="admin-chip">You</span>}
        </p>
```

Add `import { Link } from "react-router-dom";` to the top of the file.

- [ ] **Step 2: Update the mobile card head**

Find the mobile card list's head markup (the `.admin-users-cards__item` rendering inside `AdminUsersTable`'s default export, where the name is shown alongside the avatar). Wrap the name text there in the same `<Link to={`/admin/users/${row.id}`}>` element, matching the desktop change — read the surrounding JSX carefully first (it currently renders `displayNameFor(row)` as plain text inside `.admin-users-cards__head` or similar) and make the equivalent change without altering any other markup in that block.

- [ ] **Step 3: Add a CSS rule so the link doesn't look like a generic anchor**

In `src/components/Admin/AdminUsersTable.css`, find the existing `.admin-users-table__name` rule (font-weight/color). Add directly after it:

```css
.admin-users-table__name a {
  color: inherit;
  text-decoration: none;
}

.admin-users-table__name a:hover {
  text-decoration: underline;
}
```

(This matches the exact pattern `AdminEventsTable.css` uses for its own title link — inherit color, underline only on hover.)

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/pages/AdminUsersPage.test.tsx`
Expected: all 9 tests still pass — `getByText`/`within(row).getByText` queries match text content inside the new `<Link>` the same as they matched the old plain text, since Testing Library's text queries don't care about the enclosing element.

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/components/Admin/AdminUsersTable.tsx src/components/Admin/AdminUsersTable.css
git commit -m "Link user rows to /admin/users/:id"
```

---

### Task 5: Audit log data layer

**Files:**

- Create: `src/features/admin/model/auditLog.ts`
- Create: `src/features/admin/model/auditLog.test.ts`
- Create: `src/features/admin/api/auditLogRepo.ts`
- Create: `src/hooks/useUserAuditLog.ts`

**Interfaces:**

- Produces: `AuditLogRow` type, `auditLogLabelFor(entry: AuditLogRow): string`, `actorLabelFor(actorId: string | null, users: AdminUserRow[]): string`, `latestActionEntry(entries: AuditLogRow[], actions: string[]): AuditLogRow | null` (all in `auditLog.ts`); `fetchUserAuditLog(entityId: string, limit?: number): Promise<AuditLogRow[]>` (in `auditLogRepo.ts`); `useUserAuditLog(entityId: string | null): { entries: AuditLogRow[] | undefined; isLoading: boolean; error: string | null; refetch: () => void }` (in `useUserAuditLog.ts`).
- Consumes: `AdminUserRow`, `displayNameFor` from `usersQuery.ts`; `supabase` client from `../../../lib/supabase`.

- [ ] **Step 1: Write the failing tests for the pure model functions**

`src/features/admin/model/auditLog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AdminUserRow } from "./usersQuery";
import { auditLogLabelFor, actorLabelFor, latestActionEntry, type AuditLogRow } from "./auditLog";

function makeEntry(overrides: Partial<AuditLogRow> = {}): AuditLogRow {
  return {
    id: "log-1",
    actor_id: "admin-1",
    action: "user.role_changed",
    entity_type: "profile",
    entity_id: "user-1",
    metadata: { from_role: "user", to_role: "moderator" },
    created_at: "2026-08-11T00:00:00.000Z",
    ...overrides,
  };
}

function makeUser(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    kind: "profile",
    id: "admin-1",
    user_id: "admin-1",
    email: "admin@salsa.test",
    display_name: "Roosevelt Segura",
    username: "rooseveltsegura",
    avatar_url: null,
    role: "admin",
    status: "active",
    status_reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
    last_active_at: "2026-08-01T00:00:00.000Z",
    contributions: 0,
    pending_count: 0,
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("auditLogLabelFor", () => {
  it("role_changed reads the target role from metadata", () => {
    const entry = makeEntry({ action: "user.role_changed", metadata: { to_role: "moderator" } });
    expect(auditLogLabelFor(entry)).toBe("Role changed to Moderator");
  });

  it("flagged includes the reason when present", () => {
    const entry = makeEntry({ action: "user.flagged", metadata: { reason: "Spam" } });
    expect(auditLogLabelFor(entry)).toBe("Account flagged — Spam");
  });

  it("flagged omits the dash when there is no reason", () => {
    const entry = makeEntry({ action: "user.flagged", metadata: {} });
    expect(auditLogLabelFor(entry)).toBe("Account flagged");
  });

  it("unflagged, restored, suspended, banned each have fixed or reason-aware copy", () => {
    expect(auditLogLabelFor(makeEntry({ action: "user.unflagged", metadata: {} }))).toBe(
      "Flag removed"
    );
    expect(auditLogLabelFor(makeEntry({ action: "user.restored", metadata: {} }))).toBe(
      "Access restored"
    );
    expect(
      auditLogLabelFor(makeEntry({ action: "user.suspended", metadata: { reason: "Repeated inaccurate submissions" } }))
    ).toBe("Account suspended — Repeated inaccurate submissions");
    expect(
      auditLogLabelFor(makeEntry({ action: "user.banned", metadata: { reason: "Harassment" } }))
    ).toBe("Account banned — Harassment");
  });

  it("falls back to the raw action string for anything unrecognized", () => {
    expect(auditLogLabelFor(makeEntry({ action: "event.created", metadata: {} }))).toBe(
      "event.created"
    );
  });
});

describe("actorLabelFor", () => {
  it("resolves to @username when the actor is in the users list and has a username", () => {
    const users = [makeUser({ user_id: "admin-1", username: "rooseveltsegura" })];
    expect(actorLabelFor("admin-1", users)).toBe("@rooseveltsegura");
  });

  it("falls back to displayNameFor when the actor has no username", () => {
    const users = [makeUser({ user_id: "admin-1", username: null, display_name: "Roosevelt Segura" })];
    expect(actorLabelFor("admin-1", users)).toBe("Roosevelt Segura");
  });

  it("returns 'System' for a null actor id", () => {
    expect(actorLabelFor(null, [])).toBe("System");
  });

  it("returns 'Unknown admin' when the actor id doesn't match anyone in the list", () => {
    expect(actorLabelFor("nobody", [makeUser({ user_id: "admin-1" })])).toBe("Unknown admin");
  });
});

describe("latestActionEntry", () => {
  it("returns the first entry whose action is in the given list, given entries are already newest-first", () => {
    const entries = [
      makeEntry({ id: "log-2", action: "user.role_changed", created_at: "2026-08-11T00:00:00.000Z" }),
      makeEntry({ id: "log-1", action: "user.suspended", created_at: "2026-08-10T00:00:00.000Z" }),
    ];
    expect(latestActionEntry(entries, ["user.suspended", "user.banned"])?.id).toBe("log-1");
  });

  it("returns null when nothing matches", () => {
    const entries = [makeEntry({ action: "user.role_changed" })];
    expect(latestActionEntry(entries, ["user.banned"])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/features/admin/model/auditLog.test.ts`
Expected: FAIL — `./auditLog` does not exist yet.

- [ ] **Step 3: Implement `auditLog.ts`**

`src/features/admin/model/auditLog.ts`:

```ts
import { ROLE_LABEL, displayNameFor, type AdminUserRow, type UserRole } from "./usersQuery";

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function reasonSuffix(metadata: Record<string, unknown> | null): string {
  const reason = metadata?.reason;
  return typeof reason === "string" && reason.trim() !== "" ? ` — ${reason}` : "";
}

// Human copy per action — the single source of audit-timeline vocabulary,
// mirroring how displayNameFor/identityLineFor centralize identity copy.
export function auditLogLabelFor(entry: AuditLogRow): string {
  const metadata = entry.metadata ?? {};
  switch (entry.action) {
    case "user.role_changed": {
      const toRole = metadata.to_role as UserRole | undefined;
      return `Role changed to ${toRole ? ROLE_LABEL[toRole] : "Unknown"}`;
    }
    case "user.flagged":
      return `Account flagged${reasonSuffix(metadata)}`;
    case "user.unflagged":
      return "Flag removed";
    case "user.suspended":
      return `Account suspended${reasonSuffix(metadata)}`;
    case "user.banned":
      return `Account banned${reasonSuffix(metadata)}`;
    case "user.restored":
      return "Access restored";
    default:
      return entry.action;
  }
}

// Resolves an audit_logs.actor_id against the already-loaded directory —
// every admin who could perform an action is themselves a directory row.
export function actorLabelFor(actorId: string | null, users: AdminUserRow[]): string {
  if (!actorId) return "System";
  const actor = users.find((user) => user.user_id === actorId);
  if (!actor) return "Unknown admin";
  return actor.username ? `@${actor.username}` : displayNameFor(actor);
}

// entries must already be newest-first (the repo query orders by
// created_at desc) — this returns the first one matching any of the
// given actions, i.e. the most recent occurrence.
export function latestActionEntry(entries: AuditLogRow[], actions: string[]): AuditLogRow | null {
  return entries.find((entry) => actions.includes(entry.action)) ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/features/admin/model/auditLog.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Implement the repo function**

`src/features/admin/api/auditLogRepo.ts`:

```ts
import { supabase } from "../../../lib/supabase";
import type { AuditLogRow } from "../model/auditLog";

export async function fetchUserAuditLog(entityId: string, limit = 50): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as AuditLogRow[]) ?? [];
}
```

- [ ] **Step 6: Implement the hook**

`src/hooks/useUserAuditLog.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchUserAuditLog } from "../features/admin/api/auditLogRepo";

// entityId is null for a guest row's underlying identity concept — audit
// log entries only ever exist for profile ids (admin_set_user_role/status
// require an existing profiles row), so the query is disabled for guests
// rather than issuing a request that can never return rows.
export function useUserAuditLog(entityId: string | null) {
  const query = useQuery({
    queryKey: ["admin", "auditLog", entityId],
    queryFn: () => fetchUserAuditLog(entityId!),
    enabled: entityId !== null,
  });

  return {
    entries: query.data,
    isLoading: entityId !== null && query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
```

- [ ] **Step 7: Run tsc to verify the new files compile**

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/features/admin/model/auditLog.ts src/features/admin/model/auditLog.test.ts src/features/admin/api/auditLogRepo.ts src/hooks/useUserAuditLog.ts
git commit -m "Add audit log read path: model, repo, hook"
```

---

### Task 6: `AdminUserDetailPage` — Identity Header, Account Overview, Activity Summary

**Files:**

- Create: `src/pages/AdminUserDetailPage.tsx`
- Create: `src/pages/AdminUserDetailPage.css`
- Create: `src/pages/AdminUserDetailPage.test.tsx`

**Interfaces:**

- Consumes: `useAdminUsers()` (unchanged, from Task-1-updated `usersQuery.ts` types), `useAuth()` (`user.id`), `AdminUserAvatar`, `AdminRoleBadge`, `AdminAccountStatusBadge`, `AdminPageHeader`, `displayNameFor`/`identityLineFor` from `usersQuery.ts`, `useParams` from `react-router-dom`.
- Produces: `export default function AdminUserDetailPage()` — this task builds only the top of the page (everything through Activity Summary); Tasks 7-8 add the remaining sections to the same file.

- [ ] **Step 1: Write the failing tests for this slice**

`src/pages/AdminUserDetailPage.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AdminUserRow } from "../features/admin/model/usersQuery";
import AdminUserDetailPage from "./AdminUserDetailPage";

const { useAdminUsers } = vi.hoisted(() => ({ useAdminUsers: vi.fn() }));
vi.mock("../hooks/useAdminUsers", () => ({ useAdminUsers }));
vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({ user: { id: "self-1" }, isAdmin: true }),
}));

const organizer: AdminUserRow = {
  kind: "profile",
  id: "organizer-1",
  user_id: "organizer-1",
  email: "maria@salsa.test",
  display_name: "Maria Santos",
  username: "mariasalsa",
  avatar_url: null,
  role: "organizer",
  status: "active",
  status_reason: null,
  created_at: "2026-02-01T00:00:00.000Z",
  last_active_at: "2026-07-01T00:00:00.000Z",
  contributions: 3,
  pending_count: 0,
  email_confirmed_at: "2026-02-01T00:00:00.000Z",
};

const guest: AdminUserRow = {
  kind: "guest",
  id: "guest:vince@salsa.test",
  user_id: null,
  email: "vince@salsa.test",
  display_name: "Vince Guest",
  username: null,
  avatar_url: null,
  role: null,
  status: "active",
  status_reason: null,
  created_at: "2026-06-01T00:00:00.000Z",
  last_active_at: "2026-06-05T00:00:00.000Z",
  contributions: 1,
  pending_count: 1,
  email_confirmed_at: null,
};

const defaultState = {
  users: [organizer, guest],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  setRole: vi.fn(),
  settingRoleId: null,
  roleErrorId: null,
  roleError: null,
  setStatus: vi.fn(),
  settingStatusId: null,
  statusErrorId: null,
  statusError: null,
};

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${id}`]}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminUserDetailPage", () => {
  beforeEach(() => {
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultState });
  });

  it("shows a registered user's identity header, badges, and account overview", () => {
    renderAt("organizer-1");

    expect(screen.getByRole("heading", { name: "Maria Santos" })).toBeInTheDocument();
    expect(screen.getByText("@mariasalsa")).toBeInTheDocument();
    expect(screen.getByText("Organizer")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("maria@salsa.test")).toBeInTheDocument();
    expect(screen.getByText("Registered User")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("shows a guest's magic-link presentation with no role badge", () => {
    renderAt("guest:vince@salsa.test");

    expect(screen.getByRole("heading", { name: "Vince Guest" })).toBeInTheDocument();
    expect(screen.getByText("No public profile")).toBeInTheDocument();
    expect(screen.getByText("Magic-Link Submitter")).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("shows the activity summary counts from the directory row", () => {
    renderAt("organizer-1");
    expect(screen.getByText("3")).toBeInTheDocument(); // contributions
  });

  it("renders 'User not found' with a link back to Users for an unknown id", () => {
    renderAt("does-not-exist");
    expect(screen.getByText("User not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/pages/AdminUserDetailPage.test.tsx`
Expected: FAIL — `./AdminUserDetailPage` does not exist.

- [ ] **Step 3: Implement the page (this slice only)**

`src/pages/AdminUserDetailPage.tsx`:

```tsx
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useAuth } from "../contexts/useAuth";
import {
  displayNameFor,
  identityLineFor,
  ACCOUNT_KIND_LABEL,
  ROLE_LABEL,
  type AdminUserRow,
} from "../features/admin/model/usersQuery";
import AdminUserAvatar from "../components/Admin/AdminUserAvatar";
import AdminRoleBadge from "../components/Admin/AdminRoleBadge";
import AdminAccountStatusBadge from "../components/Admin/AdminAccountStatusBadge";
import "./AdminUserDetailPage.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useAuth();
  const { users: queriedUsers, isLoading, error, refetch } = useAdminUsers();

  const users = useMemo(() => queriedUsers ?? [], [queriedUsers]);
  const adminCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users]);
  const user = useMemo<AdminUserRow | undefined>(
    () => users.find((candidate) => candidate.id === id),
    [users, id]
  );

  if (isLoading) {
    return (
      <div className="admin-user-detail-page__loading" aria-busy="true">
        <p role="status">Loading account…</p>
      </div>
    );
  }

  if (!isLoading && error) {
    return (
      <div className="admin-banner admin-banner--error" role="alert">
        <p>We couldn&apos;t load this account.</p>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>
          Try Again
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-user-detail-page__empty">
        <h2>User not found</h2>
        <Link to="/admin/users" className="admin-btn admin-btn--secondary">
          Users
        </Link>
      </div>
    );
  }

  const isSelf = user.user_id === authUser?.id;
  const isLastAdmin = user.role === "admin" && adminCount <= 1;

  return (
    <div className="admin-user-detail-page">
      <Link to="/admin/users" className="admin-user-detail-page__back">
        ← Users
      </Link>

      <header className="admin-user-detail-page__header">
        <AdminUserAvatar row={user} size={64} />
        <div className="admin-user-detail-page__header-body">
          <h1>{displayNameFor(user)}</h1>
          <p className="admin-user-detail-page__identity">{identityLineFor(user)}</p>
          <div className="admin-user-detail-page__badges">
            <AdminRoleBadge role={user.role} />
            <AdminAccountStatusBadge status={user.status} reason={user.status_reason} />
          </div>
          <p className="admin-user-detail-page__joined">
            {user.kind === "guest" ? "First activity" : "Joined"} {formatDate(user.created_at)}
          </p>
        </div>
      </header>

      <div className="admin-user-detail-page__body">
        <section className="admin-card admin-user-detail-page__overview">
          <h2>Account</h2>
          {user.kind === "profile" ? (
            <>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Email</span>
                <span>
                  {user.email}{" "}
                  <span className="admin-chip">
                    {user.email_confirmed_at ? "Verified" : "Unverified"}
                  </span>
                </span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Username</span>
                <span>{user.username ? `@${user.username}` : "No username set"}</span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Account Type</span>
                <span>{ACCOUNT_KIND_LABEL.profile}</span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Role</span>
                <span>{ROLE_LABEL[user.role!]}</span>
              </div>
            </>
          ) : (
            <>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Username</span>
                <span>—</span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Public Profile</span>
                <span>None</span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Account Type</span>
                <span>{ACCOUNT_KIND_LABEL.guest}</span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Email</span>
                <span>
                  {user.email}{" "}
                  <span className="admin-chip">
                    {user.email_confirmed_at ? "Verified" : "Unverified"}
                  </span>
                </span>
              </div>
            </>
          )}
        </section>

        <section className="admin-card admin-user-detail-page__summary">
          <h2>Activity Summary</h2>
          <div className="admin-user-detail-page__field">
            <span className="admin-user-detail-page__label">Contributions</span>
            <span>{user.contributions}</span>
          </div>
          <div className="admin-user-detail-page__field">
            <span className="admin-user-detail-page__label">Pending</span>
            <span>{user.pending_count}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
```

(`isSelf`/`isLastAdmin` are computed here but unused until Task 8 wires Administrative Actions — leave them declared; they will be consumed in that task's edit to this same function body. If ESLint's `no-unused-vars` complains at this intermediate step, prefix with `_isSelf`/`_isLastAdmin` temporarily is NOT acceptable per this codebase's lint config — instead, Task 8's edit happens in the same session before any lint run, so this is fine as a within-task intermediate state; Task 9's final lint run is what must be clean, and by then Task 8 has consumed both variables.)

- [ ] **Step 4: Create the CSS file**

`src/pages/AdminUserDetailPage.css`:

```css
.admin-user-detail-page__back {
  display: inline-block;
  margin-bottom: 16px;
  color: var(--admin-text-muted);
  font-size: 0.875rem;
  text-decoration: none;
}

.admin-user-detail-page__back:hover {
  text-decoration: underline;
}

.admin-user-detail-page__header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 24px;
}

.admin-user-detail-page__header-body h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--admin-text-strong);
}

.admin-user-detail-page__identity {
  margin: 2px 0 8px;
  color: var(--admin-text-muted);
}

.admin-user-detail-page__identity--none {
  font-style: italic;
}

.admin-user-detail-page__badges {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.admin-user-detail-page__joined {
  margin: 0;
  color: var(--admin-text-muted);
  font-size: 0.85rem;
}

.admin-user-detail-page__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-user-detail-page__overview,
.admin-user-detail-page__summary {
  padding: 20px;
}

.admin-user-detail-page__overview h2,
.admin-user-detail-page__summary h2,
.admin-user-detail-page__moderation h2,
.admin-user-detail-page__events h2,
.admin-user-detail-page__organizer h2,
.admin-user-detail-page__activity h2,
.admin-user-detail-page__actions h2 {
  margin: 0 0 12px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--admin-text-muted);
}

.admin-user-detail-page__field {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--admin-border);
}

.admin-user-detail-page__field:last-child {
  border-bottom: none;
}

.admin-user-detail-page__label {
  color: var(--admin-text-muted);
}

.admin-user-detail-page__loading,
.admin-user-detail-page__empty {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

@media (min-width: 1024px) {
  .admin-user-detail-page__body {
    flex-direction: row;
  }

  .admin-user-detail-page__overview,
  .admin-user-detail-page__summary {
    flex: 1;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/pages/AdminUserDetailPage.test.tsx`
Expected: PASS, all 4 tests green.

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors (route wiring happens in Task 9, so `useParams` without a matching `<Route>` in `App.tsx` yet is fine — the test file supplies its own `<Route>` wrapper).

- [ ] **Step 6: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/pages/AdminUserDetailPage.tsx src/pages/AdminUserDetailPage.css src/pages/AdminUserDetailPage.test.tsx
git commit -m "Add AdminUserDetailPage: header, account overview, activity summary"
```

---

### Task 7: `AdminUserDetailPage` — Moderation, Events & Contributions, Organizer context

**Files:**

- Modify: `src/pages/AdminUserDetailPage.tsx` (add three sections after `Activity Summary`)
- Modify: `src/pages/AdminUserDetailPage.css` (add rules for the new sections)
- Modify: `src/pages/AdminUserDetailPage.test.tsx` (add tests for this slice)

**Interfaces:**

- Consumes: `useAdminEvents()` (unchanged, from `src/hooks/useAdminEvents.ts`), `applyFilters`, `type EventFilters` (from `eventsQuery.ts` — need a base/default `EventFilters` object; reuse the shape already established there), `AdminStatusBadge` (the *event* status badge, from `src/components/Admin/AdminStatusBadge.tsx`).
- Produces: no new exports; this extends the same page component.

- [ ] **Step 1: Write the failing tests for this slice**

Add to `src/pages/AdminUserDetailPage.test.tsx`, alongside the existing mocks add:

```ts
const { useAdminEvents } = vi.hoisted(() => ({ useAdminEvents: vi.fn() }));
vi.mock("../hooks/useAdminEvents", () => ({ useAdminEvents }));
```

Add fixture events near the top (after the `guest`/`organizer` user fixtures):

```ts
import type { DatabaseEvent } from "../features/events/model/types";

const publishedEvent: DatabaseEvent = {
  id: "event-1",
  title: "Havana Nights",
  description: null,
  event_type: "social",
  event_date: "2026-07-20T00:00:00.000Z",
  event_time: "8:00 PM",
  location: "Studio Azul",
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  submitter_name: "Maria Santos",
  submitter_email: "maria@salsa.test",
  submitter_id: "organizer-1",
  status: "approved",
  source_type: "organizer",
  dance_styles: [],
  updated_at: "2026-07-20T00:00:00.000Z",
  cancellation_reason: null,
  city: "boston",
  created_at: "2026-07-15T00:00:00.000Z",
  host: "Maria Santos",
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
};

const eventsDefaultState = {
  events: [publishedEvent],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  changeStatus: vi.fn(),
  changingStatusId: null,
  changeStatusErrorId: null,
  changeStatusError: null,
  save: vi.fn(),
  isSaving: false,
  saveError: null,
  remove: vi.fn(),
  removingId: null,
  removeErrorId: null,
  removeError: null,
  duplicate: vi.fn(),
  isDuplicating: false,
  duplicateError: null,
};
```

Update `beforeEach` to also set the events mock:

```ts
  beforeEach(() => {
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultState });
    vi.mocked(useAdminEvents).mockReturnValue({ ...eventsDefaultState });
  });
```

Add tests:

```ts
  it("shows a quiet moderation state for an active account", () => {
    renderAt("organizer-1");
    expect(screen.getByText("No moderation concerns.")).toBeInTheDocument();
  });

  it("shows the events & contributions list filtered to this person's submissions, with a View all link", () => {
    renderAt("organizer-1");
    expect(screen.getByText("Havana Nights")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View all in Events/ })).toHaveAttribute(
      "href",
      "/admin/events?submitter=organizer-1"
    );
  });

  it("shows the Organizer section only for organizer-role users", () => {
    renderAt("organizer-1");
    expect(screen.getByText("Organizer")).toBeInTheDocument(); // role badge, already asserted elsewhere too
    expect(screen.getByRole("link", { name: "View Events" })).toBeInTheDocument();

    renderAt("guest:vince@salsa.test");
    expect(screen.queryByRole("link", { name: "View Events" })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/pages/AdminUserDetailPage.test.tsx`
Expected: FAIL — the new sections don't exist yet.

- [ ] **Step 3: Implement the three sections**

In `src/pages/AdminUserDetailPage.tsx`, add imports:

```ts
import { useAdminEvents } from "../hooks/useAdminEvents";
import { applyFilters, type EventFilters } from "../features/admin/model/eventsQuery";
import AdminStatusBadge from "../components/Admin/AdminStatusBadge";
```

Add, right after the `user`/`adminCount` derivation (before the early returns), a default `EventFilters` object and the filtered/sliced event list:

```ts
  const { events: queriedEvents } = useAdminEvents();
  const events = useMemo(() => queriedEvents ?? [], [queriedEvents]);

  const submitterValue = user?.kind === "guest" ? user.email : user?.user_id;

  const userEvents = useMemo(() => {
    if (!submitterValue) return [];
    const filters: EventFilters = {
      q: "",
      from: null,
      to: null,
      status: [],
      organizer: null,
      venue: null,
      city: null,
      style: null,
      source: null,
      incompleteOnly: false,
      submitter: submitterValue,
    };
    return applyFilters(events, filters, new Date())
      .slice()
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 5);
  }, [events, submitterValue]);

  const upcomingOrganizerEvents = useMemo(
    () => userEvents.filter((event) => new Date(event.event_date).getTime() >= Date.now()).length,
    [userEvents]
  );
```

(This block must be placed **before** the `if (isLoading) return ...` / `if (!user) return ...` early-return guards, since those guards use hooks-after-hooks would violate the Rules of Hooks if placed after a conditional return — match the existing `useMemo` calls' position in the file from Task 6, which are already above the early returns; add these new `useMemo`s in that same unconditional zone.)

Add three new sections to the JSX, inside `.admin-user-detail-page__body`, after the closing `</section>` of Activity Summary:

```tsx
        <section className="admin-card admin-user-detail-page__moderation">
          <h2>Moderation</h2>
          {user.status === "active" ? (
            <p>No moderation concerns.</p>
          ) : (
            <AdminAccountStatusBadge status={user.status} reason={user.status_reason} />
          )}
        </section>

        {user.role === "organizer" && (
          <section className="admin-card admin-user-detail-page__organizer">
            <h2>Organizer</h2>
            <p>
              {displayNameFor(user)} · {upcomingOrganizerEvents} upcoming events
            </p>
            <Link to={`/admin/events?submitter=${encodeURIComponent(submitterValue!)}`}>
              View Events
            </Link>
          </section>
        )}

        <section className="admin-card admin-user-detail-page__events">
          <h2>Events &amp; Contributions</h2>
          {userEvents.length === 0 ? (
            <p>No events yet.</p>
          ) : (
            <ul className="admin-user-detail-page__events-list">
              {userEvents.map((event) => (
                <li key={event.id}>
                  <Link to={`/admin/events?edit=${event.id}`}>{event.title}</Link>
                  <AdminStatusBadge status={event.status} />
                </li>
              ))}
            </ul>
          )}
          <Link to={`/admin/events?submitter=${encodeURIComponent(submitterValue ?? "")}`}>
            View all in Events →
          </Link>
        </section>
```

- [ ] **Step 4: Add CSS for the new sections**

Append to `src/pages/AdminUserDetailPage.css`:

```css
.admin-user-detail-page__moderation,
.admin-user-detail-page__organizer,
.admin-user-detail-page__events {
  padding: 20px;
}

.admin-user-detail-page__events-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-user-detail-page__events-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--admin-border);
}

.admin-user-detail-page__events-list li:last-child {
  border-bottom: none;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/pages/AdminUserDetailPage.test.tsx`
Expected: PASS, all tests (4 from Task 6 + 3 new) green.

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/pages/AdminUserDetailPage.tsx src/pages/AdminUserDetailPage.css src/pages/AdminUserDetailPage.test.tsx
git commit -m "Add Moderation, Events & Contributions, Organizer sections to AdminUserDetailPage"
```

---

### Task 8: `AdminUserDetailPage` — Activity Timeline, Administrative Actions, self-protection

**Files:**

- Modify: `src/pages/AdminUserDetailPage.tsx` (add the timeline section, the actions section with all 5 reused dialogs, and the self-protection banner)
- Modify: `src/pages/AdminUserDetailPage.css` (add rules)
- Modify: `src/pages/AdminUserDetailPage.test.tsx` (add tests for this slice)

**Interfaces:**

- Consumes: `useUserAuditLog` (Task 5), `auditLogLabelFor`/`actorLabelFor`/`latestActionEntry` (Task 5), `rowActionItems`/`UserRowAction` (Task 3, already imported by the table — import from `usersQuery.ts` here too), `AdminRoleChangeDialog`, `AdminFlagUserDialog`, `AdminConfirmDialog` (all unchanged from Phase 5), `useNavigate` (react-router-dom).
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests for this slice**

Add to `src/pages/AdminUserDetailPage.test.tsx`:

```ts
const { useUserAuditLog } = vi.hoisted(() => ({ useUserAuditLog: vi.fn() }));
vi.mock("../hooks/useUserAuditLog", () => ({ useUserAuditLog }));

const auditDefaultState = {
  entries: [],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};
```

Update `beforeEach`:

```ts
  beforeEach(() => {
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultState });
    vi.mocked(useAdminEvents).mockReturnValue({ ...eventsDefaultState });
    vi.mocked(useUserAuditLog).mockReturnValue({ ...auditDefaultState });
  });
```

Add tests:

```ts
  it("renders audit log entries newest-first with an actor label", () => {
    vi.mocked(useUserAuditLog).mockReturnValue({
      ...auditDefaultState,
      entries: [
        {
          id: "log-1",
          actor_id: "self-1",
          action: "user.role_changed",
          entity_type: "profile",
          entity_id: "organizer-1",
          metadata: { to_role: "organizer" },
          created_at: "2026-08-11T00:00:00.000Z",
        },
      ],
    });
    renderAt("organizer-1");
    expect(screen.getByText(/Role changed to Organizer/)).toBeInTheDocument();
  });

  it("the self row's Administrative Actions has no Change Role/Suspend/Ban and shows the sole-admin banner when applicable", () => {
    vi.mocked(useAdminUsers).mockReturnValue({
      ...defaultState,
      users: [{ ...organizer, id: "self-1", user_id: "self-1", role: "admin" }],
    });
    renderAt("self-1");
    expect(
      screen.getByText("You are the only administrator.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Role" })).not.toBeInTheDocument();
  });

  it("Change Role from Administrative Actions opens the dialog and calls setRole", async () => {
    const userEventLib = await import("@testing-library/user-event");
    const user = userEventLib.default.setup();
    const setRole = vi.fn();
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultState, setRole });
    renderAt("organizer-1");

    await user.click(screen.getByRole("button", { name: "Change Role" }));
    const dialog = screen.getByRole("dialog");
    const { within } = await import("@testing-library/react");
    await user.selectOptions(within(dialog).getByLabelText("New role"), "moderator");
    await user.click(within(dialog).getByRole("button", { name: "Change Role" }));

    expect(setRole).toHaveBeenCalledWith(
      { id: "organizer-1", role: "moderator" },
      expect.anything()
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/pages/AdminUserDetailPage.test.tsx`
Expected: FAIL — Administrative Actions/timeline don't exist yet.

- [ ] **Step 3: Implement the remaining sections**

In `src/pages/AdminUserDetailPage.tsx`, add imports:

```ts
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserAuditLog } from "../hooks/useUserAuditLog";
import { auditLogLabelFor, actorLabelFor } from "../features/admin/model/auditLog";
import { rowActionItems, type UserRowAction } from "../features/admin/model/usersQuery";
import AdminActionMenu from "../components/Admin/AdminActionMenu";
import AdminRoleChangeDialog from "../components/Admin/AdminRoleChangeDialog";
import AdminFlagUserDialog from "../components/Admin/AdminFlagUserDialog";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
```

(`useMemo` and `Link` are already imported from Task 6/7 — add to those existing import lines, don't duplicate them.)

Add, alongside the other hooks near the top of the component body (still above the early returns):

```ts
  const navigate = useNavigate();
  const { setRole, settingRoleId, roleErrorId, roleError, setStatus, settingStatusId, statusErrorId, statusError } =
    useAdminUsers();
  const { entries: auditEntries, isLoading: isAuditLoading, error: auditError, refetch: refetchAudit } =
    useUserAuditLog(user?.kind === "profile" ? (user.id ?? null) : null);
  type PendingAction =
    | { kind: "role" }
    | { kind: "flag" }
    | { kind: "suspend" }
    | { kind: "ban" }
    | { kind: "restore" }
    | { kind: "unflag" }
    | null;
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
```

(Note: `useAdminUsers()` is already called once at the top of the component from Task 6 to get `users`/`isLoading`/`error`/`refetch` — do not call it a second time. Instead, destructure ALL of these fields — `users: queriedUsers, isLoading, error, refetch, setRole, settingRoleId, roleErrorId, roleError, setStatus, settingStatusId, statusErrorId, statusError` — from that single existing call at the top of the function, and delete the duplicate call shown above. This step's prose describes the fields needed; wire them into the Task 6 call site, don't add a second one.)

Add the action handler and dialog confirm handlers (after the `userEvents`/`upcomingOrganizerEvents` memos, still above the early returns):

```ts
  const handleAction = (action: UserRowAction, targetUser = user) => {
    if (!targetUser) return;
    if (action === "view-contributions") {
      const value = targetUser.kind === "guest" ? targetUser.email : (targetUser.user_id ?? "");
      navigate(`/admin/events?submitter=${encodeURIComponent(value)}`);
      return;
    }
    setPendingAction({ kind: action } as PendingAction);
  };

  const closeDialog = () => setPendingAction(null);
```

Add, after the early-return guards (`if (isLoading) ...`, `if (error) ...`, `if (!user) ...` — these must run first since everything below assumes `user` is defined):

```ts
  const isSelf = user.user_id === authUser?.id;
  const isLastAdmin = user.role === "admin" && adminCount <= 1;
  const onlyAdminBanner = isSelf && isLastAdmin;
```

(This replaces the placeholder `isSelf`/`isLastAdmin` declarations from Task 6 if they were left in a different position — consolidate to one declaration, here, after the guards, since `user` is guaranteed non-null at this point and the guest-avoidance in `rowActionItems` already handles guests without needing a separate guest check here.)

Add two more sections to the JSX, after the Events & Contributions section:

```tsx
        <section className="admin-card admin-user-detail-page__activity">
          <h2>Activity</h2>
          {isAuditLoading ? (
            <p role="status">Loading activity…</p>
          ) : auditError ? (
            <div>
              <p role="alert">We couldn&apos;t load account activity.</p>
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetchAudit()}>
                Try Again
              </button>
            </div>
          ) : !auditEntries || auditEntries.length === 0 ? (
            <p>No activity recorded yet.</p>
          ) : (
            <ol className="admin-user-detail-page__timeline">
              {auditEntries.map((entry) => (
                <li key={entry.id}>
                  <span className="admin-user-detail-page__timeline-date">{formatDate(entry.created_at)}</span>
                  <span>
                    {auditLogLabelFor(entry)} by {actorLabelFor(entry.actor_id, users)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="admin-card admin-user-detail-page__actions">
          <h2>Administrative Actions</h2>
          {onlyAdminBanner ? (
            <div className="admin-banner">
              <p>You are the only administrator.</p>
              <p>Add another Admin before removing your Admin role.</p>
            </div>
          ) : (
            <div className="admin-user-detail-page__action-buttons">
              {rowActionItems(user, authUser?.id ?? null, adminCount, handleAction).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    item.tone === "danger" ? "admin-btn admin-btn--danger" : "admin-btn admin-btn--secondary"
                  }
                  onClick={item.onSelect}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </section>
```

Add the five dialogs at the end of the returned JSX, just before the final `</div>` closing `.admin-user-detail-page`:

```tsx
      {pendingAction?.kind === "role" && (
        <AdminRoleChangeDialog
          user={user}
          isBusy={settingRoleId === user.id}
          error={roleErrorId === user.id ? roleError : null}
          onConfirm={(role) =>
            setRole({ id: user.id, role }, { onSuccess: closeDialog })
          }
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "flag" && (
        <AdminFlagUserDialog
          user={user}
          isBusy={settingStatusId === user.id}
          error={statusErrorId === user.id ? statusError : null}
          onConfirm={(reason) =>
            setStatus({ id: user.id, status: "flagged", reason }, { onSuccess: closeDialog })
          }
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "suspend" && (
        <AdminConfirmDialog
          title={`Suspend ${user.username ? `@${user.username}` : displayNameFor(user)}?`}
          body="This account will temporarily lose access to restricted platform actions, including submitting events. You can restore it at any time."
          confirmLabel="Suspend User"
          tone="danger"
          reasonField={{ label: "Reason (optional)", required: false }}
          isBusy={settingStatusId === user.id}
          error={statusErrorId === user.id ? statusError : null}
          onConfirm={(reason) =>
            setStatus({ id: user.id, status: "suspended", reason }, { onSuccess: closeDialog })
          }
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "ban" && (
        <AdminConfirmDialog
          title={`Ban ${user.username ? `@${user.username}` : displayNameFor(user)}?`}
          body="This user will lose access to SalsaSegura when their session next refreshes. Existing content will not automatically be deleted."
          confirmLabel="Ban User"
          tone="danger"
          reasonField={{ label: "Reason", required: true }}
          isBusy={settingStatusId === user.id}
          error={statusErrorId === user.id ? statusError : null}
          onConfirm={(reason) =>
            setStatus({ id: user.id, status: "banned", reason }, { onSuccess: closeDialog })
          }
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "restore" && (
        <AdminConfirmDialog
          title={`Restore access for ${user.username ? `@${user.username}` : displayNameFor(user)}?`}
          body="Access is restored immediately. Their role is unchanged."
          confirmLabel="Restore access"
          tone="neutral"
          isBusy={settingStatusId === user.id}
          error={statusErrorId === user.id ? statusError : null}
          onConfirm={() => setStatus({ id: user.id, status: "active" }, { onSuccess: closeDialog })}
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "unflag" && (
        <AdminConfirmDialog
          title={`Remove the flag on ${user.username ? `@${user.username}` : displayNameFor(user)}?`}
          body="The account returns to Active. The flag reason is cleared."
          confirmLabel="Remove flag"
          tone="neutral"
          isBusy={settingStatusId === user.id}
          error={statusErrorId === user.id ? statusError : null}
          onConfirm={() => setStatus({ id: user.id, status: "active" }, { onSuccess: closeDialog })}
          onCancel={closeDialog}
        />
      )}
```

- [ ] **Step 4: Add CSS for the new sections**

Append to `src/pages/AdminUserDetailPage.css`:

```css
.admin-user-detail-page__activity,
.admin-user-detail-page__actions {
  padding: 20px;
}

.admin-user-detail-page__timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-user-detail-page__timeline li {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-user-detail-page__timeline-date {
  font-size: 0.75rem;
  color: var(--admin-text-muted);
}

.admin-user-detail-page__action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/pages/AdminUserDetailPage.test.tsx`
Expected: PASS, all tests (7 from Tasks 6-7 + 3 new) green.

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors — in particular, confirm there is only ONE call to `useAdminUsers()` in the file (the consolidation instruction in Step 3 above).

- [ ] **Step 6: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/pages/AdminUserDetailPage.tsx src/pages/AdminUserDetailPage.css src/pages/AdminUserDetailPage.test.tsx
git commit -m "Add Activity Timeline and Administrative Actions to AdminUserDetailPage"
```

---

### Task 9: Route wiring, breadcrumb fix, full-suite verification

**Files:**

- Modify: `src/App.tsx` (new lazy route)
- Modify: `src/layouts/AdminLayout.tsx` (breadcrumb prefix-match for `/admin/users/:id`)
- Modify: `src/layouts/AdminLayout.test.tsx` (add a test for the new breadcrumb case)

**Interfaces:** none new — this is pure integration.

- [ ] **Step 1: Write the failing breadcrumb test**

In `src/layouts/AdminLayout.test.tsx`, find the `renderLayout` helper (it wraps `<AdminLayout />` inside a `<Route path="/admin" element={<AdminLayout />}><Route index element={...} /></Route>`). Add a second helper that renders at a nested path:

```tsx
function renderLayoutAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>Dashboard content</p>} />
          <Route path="users/:id" element={<p>Detail content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
```

Add a test:

```tsx
  it("breadcrumb reads Users on the nested detail route", () => {
    renderLayoutAt("/admin/users/organizer-1");
    expect(screen.getByText("Users")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/layouts/AdminLayout.test.tsx`
Expected: FAIL — the breadcrumb currently falls back to "Dashboard" for any unmatched path, including `/admin/users/organizer-1`.

- [ ] **Step 3: Fix the breadcrumb resolution**

In `src/layouts/AdminLayout.tsx`, the current code:

```ts
const SECTION_LABEL: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/events": "Events",
  "/admin/users": "Users",
};
```

and later:

```ts
  const sectionLabel = SECTION_LABEL[pathname] ?? SECTION_LABEL["/admin"];
```

Change the second line to a small resolver function placed above the component (near `SECTION_LABEL`):

```ts
function sectionLabelFor(pathname: string): string {
  if (SECTION_LABEL[pathname]) return SECTION_LABEL[pathname];
  if (pathname.startsWith("/admin/users/")) return "Users";
  return SECTION_LABEL["/admin"];
}
```

and change the call site inside the component to:

```ts
  const sectionLabel = sectionLabelFor(pathname);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/layouts/AdminLayout.test.tsx`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Wire the route**

In `src/App.tsx`:

```ts
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminUserDetailPage = lazy(() => import("./pages/AdminUserDetailPage"));
```

and:

```tsx
              <Route path="events" element={<AdminEventsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="users/:id" element={<AdminUserDetailPage />} />
```

- [ ] **Step 6: Full-suite verification**

Run: `cd /home/r8s/code/Salsa && npx vitest run`
Expected: every test file passes, including all new ones from Tasks 1-9 and every pre-existing file (224 + new tests from this plan).

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

Run: `cd /home/r8s/code/Salsa && npm run build`
Expected: builds cleanly (a new `AdminUserDetailPage-*.js`/`.css` chunk appears in the output; the existing bundle-size warning on `index-*.js` is pre-existing and unrelated).

Run: `cd /home/r8s/code/Salsa && npm run lint`
Expected: 0 warnings/errors (`--max-warnings 0`).

- [ ] **Step 7: Manual smoke test**

Run: `cd /home/r8s/code/Salsa && npm run dev`

With the local Supabase stack up (`npx supabase status` to confirm) and signed in as an admin:

1. Visit `/admin/users`, click a registered user's name — confirm it navigates to `/admin/users/<id>` and the breadcrumb reads "Admin › Users".
2. Confirm the header, Account, Activity Summary, Moderation ("No moderation concerns."), Events & Contributions (with real rows if any exist locally), and Activity (empty or populated) sections all render.
3. Open Administrative Actions → Change Role → confirm the dialog opens, shows consequence copy, and a successful change updates the badge and adds a new Activity timeline entry after the query refetches.
4. Visit `/admin/users/does-not-exist` — confirm "User not found" renders with a working "Users" link back.
5. Visit a guest row's detail page (`/admin/users/guest:<email>`) — confirm the magic-link presentation (no role badge, "No public profile", "Magic-Link Submitter") and that its only Administrative Action is "View Submissions".
6. Narrow the browser below 1024px — confirm Account/Activity Summary stack into one column instead of side-by-side.

- [ ] **Step 8: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/App.tsx src/layouts/AdminLayout.tsx src/layouts/AdminLayout.test.tsx
git commit -m "Wire /admin/users/:id route and fix breadcrumb for nested user routes"
```

---

## Self-Review Notes (fixed inline before handoff)

- **Spec coverage:** all 27 design-doc sections map to a task — §1-9 (identity, header, presentations, overview, role/status, activity summary) → Task 6; §10-12 (events, organizer, moderation) → Task 7; §13-20 (all mutating UX, timeline) → Task 8, reusing Phase 5 dialogs unchanged per the design doc's explicit decision; §21-22 (notes, magic-link conversion) → intentionally not built, documented as Later/conceptual in the design doc, no task needed; §23-25 (states, responsive, a11y) → spread across Tasks 6-9's implementations and the Step 7 manual smoke test; §26 (database) → Task 1 is the only "Now" item; §27 (wireframe) → matched by Tasks 6-8's section order.
- **Type consistency:** `UserRowAction` is defined once (Task 3, in `usersQuery.ts`) and imported everywhere else (`AdminUsersTable.tsx` via re-export, `AdminUserDetailPage.tsx` directly) — no second definition anywhere. `rowActionItems`'s signature (`user, currentUserId, adminCount, onAction`) is identical at both call sites (the table, Task 3; the detail page, Task 8).
- **No placeholders:** every step above has literal, runnable code — no "add appropriate handling" language anywhere in this plan.

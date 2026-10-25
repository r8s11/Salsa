# Admin User Details Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate `/admin/users/:id` as a reference-led operational user-detail page while retaining every existing field, action, dialog, data state, and route behavior.

**Architecture:** Keep `AdminUserDetailPage` as the sole data and interaction owner. Reorganize only the page’s existing rendered content into a command header, desktop main column, and desktop side rail that naturally stacks on mobile. Use page-scoped CSS and existing admin components/tokens; no data-access or dialog API changes.

**Tech Stack:** React 19, TypeScript, React Router v7, CSS custom properties, Vitest, React Testing Library, user-event.

## Global Constraints

- Preserve every current `useAdminUsers`, `useAdminEvents`, `useUserAuditLog`, `useAuth`, action-handler, and dialog contract.
- Preserve profile/guest field differences, organizer-only visibility, only-admin protection, event filtering/link targets, audit loading/error/retry/empty states, and all existing copy.
- Apply the reference language only through existing `--admin-*` tokens, shared badges/buttons, and page-scoped CSS; add no global tokens, icons, or palette values.
- At `min-width: 1024px`, use a main-content column plus a fixed-width side rail; below it, use one stacked column with no horizontal overflow.
- Keep native semantics, existing heading order, `aria-busy`, `role="status"`, `role="alert"`, focus-visible treatment, native links/buttons, and dialog behavior.
- Tests assert observable structure and behavior; they MUST NOT assert incidental CSS values or implementation-only class names.

---

## File Structure

- Modify: `src/pages/AdminUserDetailPage.tsx` — reorganize existing page content into command header, main content column, and operational side rail.
- Modify: `src/pages/AdminUserDetailPage.css` — replace the flat-card layout with responsive page-scoped operational surfaces, a timeline rail, compact metadata rows, and full-width mobile actions.
- Modify: `src/pages/AdminUserDetailPage.test.tsx` — prove the meaningful document grouping while preserving profile, guest, organizer, audit, and action behavior.

### Task 1: Rebuild the user-detail operational layout

**Files:**
- Modify: `src/pages/AdminUserDetailPage.tsx:143-334`
- Modify: `src/pages/AdminUserDetailPage.css:1-167`
- Modify: `src/pages/AdminUserDetailPage.test.tsx:151-252`

**Interfaces:**
- Consumes: existing `user`, `userEvents`, `auditEntries`, `pendingAction`, `rowActionItems`, and all already-rendered shared admin components.
- Produces: layout-only wrappers `admin-user-detail-page__main`, `admin-user-detail-page__side-rail`, and `admin-user-detail-page__account-intelligence`; no exported API, route, hook, dialog prop, or data shape changes.

- [ ] **Step 1: Add a failing layout-semantic test beside the registered-user identity test.**

```tsx
it("groups account intelligence and operational controls into labelled regions", () => {
  renderAt("organizer-1");

  const account = screen.getByRole("region", { name: "Account and activity" });
  const operations = screen.getByRole("complementary", { name: "Account operations" });

  expect(within(account).getByText("maria@salsa.test")).toBeInTheDocument();
  expect(within(account).getByText("Contributions")).toBeInTheDocument();
  expect(within(operations).getByRole("heading", { name: "Moderation" })).toBeInTheDocument();
  expect(within(operations).getByRole("heading", { name: "Administrative Actions" })).toBeInTheDocument();
  expect(within(operations).getByRole("link", { name: "View Events" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the new test to verify that the required landmark structure is absent.**

Run: `npm test -- --run src/pages/AdminUserDetailPage.test.tsx -t "groups account intelligence"`

Expected: FAIL because the existing page does not expose labelled main and operational regions.

- [ ] **Step 3: Reorganize the existing JSX without changing data or actions.**

Retain the existing back link, header data, profile/guest field branches, conditional organizer content, events rendering, audit branches, administrative-action mapping, and all dialogs. Add the following layout shape around existing content:

```tsx
<header className="admin-user-detail-page__header admin-card">
  <div className="admin-user-detail-page__eyebrow">User profile</div>
  {/* existing avatar and header body */}
</header>

<div className="admin-user-detail-page__layout">
  <main className="admin-user-detail-page__main">
    <section
      className="admin-card admin-user-detail-page__account-intelligence"
      aria-labelledby="account-activity-heading"
    >
      <h2 id="account-activity-heading">Account and activity</h2>
      {/* existing profile/guest account fields and summary fields */}
    </section>
    {/* existing Events & Contributions and Activity sections */}
  </main>

  <aside className="admin-user-detail-page__side-rail" aria-label="Account operations">
    {/* existing Moderation, conditional Organizer, and Administrative Actions sections */}
  </aside>
</div>
```

Use `main` only for the information column; preserve the page’s `h1` in its existing header. Do not wrap an existing `section` in another unnamed `section`, duplicate fields, or move dialog rendering inside the side rail.

- [ ] **Step 4: Replace the page CSS with the responsive operational composition.**

Use existing `--admin-*` tokens and page class hooks only:

```css
.admin-user-detail-page__layout {
  display: grid;
  gap: 1rem;
}

.admin-user-detail-page__main,
.admin-user-detail-page__side-rail {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

@media (min-width: 1024px) {
  .admin-user-detail-page__layout {
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 20rem);
    align-items: start;
  }

  .admin-user-detail-page__side-rail {
    position: sticky;
    top: calc(var(--admin-header-height) + 1rem);
  }
}
```

Style the command header as a raised admin-card surface, with a muted uppercase eyebrow and existing avatar/identity/badge information. Make the combined Account and activity fields a compact two-column definition-list-like grid at wider sizes and a stacked label/value layout at narrow sizes. Keep event rows touch-safe and retain status-badge alignment.

For the audit list, add a left border rail with a small date marker; preserve the existing ordered-list semantics and audit message content. In the side rail, make action buttons one-column/full-width under the mobile breakpoint, retain shared danger/secondary classes, and do not restyle shared dialog controls. Avoid hard-coded colors, hover-only behavior, or fixed desktop widths at mobile sizes.

- [ ] **Step 5: Run the focused user-detail test file.**

Run: `npm test -- --run src/pages/AdminUserDetailPage.test.tsx`

Expected: PASS, including profile, guest, organizer, events, audit, only-admin, dialog, and the new landmark test.

- [ ] **Step 6: Run static quality gates.**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all commands exit `0`.

- [ ] **Step 7: Browser-smoke the actual responsive page.**

Start the local application and open `/admin/users/<fixture-id>` with a local authenticated admin fixture. At desktop width, verify the header, main column, and side rail visually distinguish account intelligence from operations. At 390px width, verify every panel stacks with no horizontal overflow and administrative actions remain reachable. Exercise a neutral and a destructive action up to their existing confirmation dialogs, verify event navigation, audit retry/empty states, and keyboard focus visibility.

- [ ] **Step 8: Commit the feature.**

```bash
git add src/pages/AdminUserDetailPage.tsx src/pages/AdminUserDetailPage.css src/pages/AdminUserDetailPage.test.tsx
git commit -m "feat: redesign admin user detail page"
```

## Self-Review

- **Spec coverage:** Task 1 preserves every existing data/action branch while delivering the command header, desktop main/side-rail layout, mobile stacking, account intelligence, contribution/event/activity panels, moderation/action rail, organizer condition, accessibility, and targeted verification.
- **Placeholder scan:** No unresolved markers or generic instructions remain; required landmarks, CSS boundaries, test body, commands, and constrained files are explicit.
- **Type consistency:** The plan uses current page-local values and shared components only. New names are internal layout CSS hooks; no hook, mutation, route, or dialog interface changes are introduced.

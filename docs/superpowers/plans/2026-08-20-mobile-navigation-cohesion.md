# Mobile Navigation Cohesion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing mobile header drawer into a cohesive, touch-first surface with separate destination, city, and account action groups.

**Architecture:** Keep `Header` as the sole owner of drawer state, city selection, authentication actions, and close behavior. Restructure only the mobile-only `li.mobile-nav-actions` content into labelled groups, then layer mobile-scoped CSS over the existing desktop styles. Existing `NavLink`, button, city-switch, and accessibility contracts remain in place.

**Tech Stack:** React 19, TypeScript, React Router v7, CSS custom properties, Vitest, React Testing Library, user-event.

## Global Constraints

- Apply this refinement only inside the existing `@media (max-width: 990px)` drawer behavior; desktop navigation is unchanged.
- Retain every route, `mobileOpen` state transition, Escape handling, city-context update, auth condition, moderator condition, and sign-out flow.
- Use only existing CSS custom properties from `src/styles/global.css` and the established dark glassmorphism idiom.
- Mobile destination and account rows MUST have a 44px minimum touch target.
- `Submit Event` is the sole rose-red CTA in the action group; secondary links and sign-out are not CTA-styled.
- Keep `aria-controls`, `aria-expanded`, the open/close accessible label, and existing focus-visible behavior.
- Test visible mobile content with `within(document.getElementById("site-navigation"))` because desktop and mobile variants are mounted simultaneously.

---

## File Structure

- Modify: `src/components/Header/Header.tsx` — groups the mobile drawer into labelled destination, city, and account sections without changing route or state logic.
- Modify: `src/components/Header/Header.css` — adds mobile-only hierarchy, glass utility panel, touch-target sizing, and action styling using current tokens.
- Modify: `src/components/Header/Header.test.tsx` — asserts that each mobile auth state exposes the intended grouped controls and preserves existing drawer behavior.

### Task 1: Implement the structured mobile drawer

**Files:**
- Modify: `src/components/Header/Header.tsx:65-107`
- Modify: `src/components/Header/Header.css:188-255`
- Modify: `src/components/Header/Header.test.tsx:47-178`

**Interfaces:**
- Consumes: `PRIMARY_LINKS`, `citySwitcher(true)`, `user`, `isModerator`, `closeNavigation`, `handleSignOut`, and the existing `#site-navigation` drawer.
- Produces: labelled `region` landmarks for city and account actions plus `mobile-nav__context`, `mobile-nav__city`, and `mobile-nav__account` class hooks confined to the mobile drawer; no new React props, context fields, routes, or exported APIs.

- [ ] **Step 1: Add the signed-out and authenticated grouped-drawer tests after the exact primary-navigation test.**

```tsx
it("groups signed-out mobile navigation into destinations, city, and account actions", async () => {
  vi.mocked(useAuth).mockReturnValue(defaultAuth());
  vi.mocked(useCity).mockReturnValue({ city: "boston", setCity });
  const user = userEvent.setup();
  renderHeader();

  await user.click(screen.getByRole("button", { name: "Open menu" }));
  const drawer = document.getElementById("site-navigation") as HTMLElement;
  const city = within(drawer).getByRole("region", { name: "Your city" });
  const account = within(drawer).getByRole("region", { name: "Account" });

  expect(within(drawer).getByText("Explore Salsa Segura")).toBeInTheDocument();
  expect(within(account).getByRole("link", { name: "Submit Event" })).toHaveClass("auth-btn");
  expect(within(account).getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/signin");
  expect(within(city).getByRole("button", { name: "BOS" })).toHaveAttribute("aria-pressed", "true");
});

it("keeps member and moderator actions inside the mobile account group", async () => {
  vi.mocked(useAuth).mockReturnValue(
    defaultAuth({ user: { id: "moderator" } as User, isModerator: true })
  );
  vi.mocked(useCity).mockReturnValue({ city: "new-york-city", setCity });
  const user = userEvent.setup();
  renderHeader();

  await user.click(screen.getByRole("button", { name: "Open menu" }));
  const drawer = document.getElementById("site-navigation") as HTMLElement;
  const account = within(drawer).getByRole("region", { name: "Account" });
  const city = within(drawer).getByRole("region", { name: "Your city" });

  expect(within(account).getByRole("link", { name: "My Profile" })).toHaveAttribute(
    "href",
    "/profile"
  );
  expect(within(account).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "href",
    "/admin"
  );
  expect(within(account).getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  expect(within(city).getByRole("button", { name: "NYC" })).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Run the focused new grouping tests to prove the labelled regions are absent.**

Run: `npm test -- --run src/components/Header/Header.test.tsx -t "mobile navigation|mobile account group"`

Expected: FAIL because the labelled city and account regions do not yet exist.

- [ ] **Step 3: Restructure only the mobile drawer markup.**

Replace the current direct contents of `li.mobile-nav-actions` with three labelled subgroups. Keep every existing link and event handler unchanged.

```tsx
<li className="mobile-nav-actions">
  <span className="mobile-nav__context">Explore Salsa Segura</span>
  <section className="mobile-nav__city" aria-labelledby="mobile-nav-city-label">
    <span id="mobile-nav-city-label" className="mobile-nav__label">Your city</span>
    {citySwitcher(true)}
  </section>
  <section className="mobile-nav__account" aria-labelledby="mobile-nav-account-label">
    <span id="mobile-nav-account-label" className="mobile-nav__label">Account</span>
    {user ? (
      <>
        <NavLink to="/submit" className="auth-btn" onClick={closeNavigation}>
          Submit Event
        </NavLink>
        <NavLink to="/profile" onClick={closeNavigation}>My Profile</NavLink>
        {isModerator && <NavLink to="/admin" onClick={closeNavigation}>Dashboard</NavLink>}
        <button type="button" className="drawer-sign-out" onClick={handleSignOut}>Sign Out</button>
      </>
    ) : (
      <>
        <NavLink to="/submit" className="auth-btn" onClick={closeNavigation}>
          Submit Event
        </NavLink>
        <NavLink to="/signin" onClick={closeNavigation}>Sign In</NavLink>
      </>
    )}
  </section>
</li>
```

Do not add a second copy of `PRIMARY_LINKS`; they stay in the existing `ul` before this mobile-only item.

- [ ] **Step 4: Replace the mobile-only `.mobile-nav-actions` rules with group-level styling.**

Inside the existing mobile media query, make the action container a grid with `gap: var(--space-lg)`. Style `.mobile-nav__context` and `.mobile-nav__label` as muted uppercase Epilogue UI labels. Make `.mobile-nav__city` a glass panel using `var(--card)`, the existing blur variable, `1px solid var(--border)`, `var(--radius-lg)`, and `var(--space-md)` padding. Make `.mobile-nav__account` a grid with `gap: var(--space-xs)`, top border, and top padding.

Set `.nav-links > li > a`, `.mobile-nav__account > a`, and `.drawer-sign-out` to `min-height: 44px` in the mobile media query. Style `.mobile-nav__account > a:not(.auth-btn)` and `.drawer-sign-out` as full-width, left-aligned secondary rows with the existing muted text and card hover surface. Set `.mobile-nav-actions .auth-btn` to `width: 100%`, horizontally center its text, and preserve its existing rose-red token styling. Keep `.city-switch--mobile` aligned to the start within the city panel.

- [ ] **Step 5: Run the focused Header test file.**

Run: `npm test -- --run src/components/Header/Header.test.tsx`

Expected: PASS, including the new group tests and existing open/close, guest action, member sign-out, and Escape tests.

- [ ] **Step 6: Run static quality gates.**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: all commands exit `0`.

- [ ] **Step 7: Browser-smoke the actual mobile drawer.**

Run the Vite app and drive it at a narrow viewport. In the guest state, confirm the drawer visually reads as destinations → city glass panel → account actions; confirm the selected city and full-width Submit Event CTA. Then use the existing local authentication path to check member and moderator variants: Profile/Dashboard are secondary rows, Sign Out is last, Escape closes the drawer, and the drawer scrolls without clipping content.

- [ ] **Step 8: Commit the implementation.**

```bash
git add src/components/Header/Header.tsx src/components/Header/Header.css src/components/Header/Header.test.tsx
git commit -m "feat: refine mobile navigation drawer"
```

## Self-Review

- **Spec coverage:** Task 1 implements the three mobile groups, full-width 44px rows, city glass panel, CTA/secondary hierarchy, unchanged desktop boundary, state/route preservation, and accessibility constraints. It locks the observable grouped and role-based variants, then verifies live interaction and visual hierarchy.
- **Placeholder scan:** No unresolved markers or generic implementation instructions remain; selectors, source regions, expected commands, and actual test bodies are specified.
- **Type consistency:** The plan uses only current `Header` locals (`user`, `isModerator`, `closeNavigation`, `handleSignOut`) and existing `NavLink`/`button` markup. New identifiers are CSS class hooks only, with no TypeScript interface impact.

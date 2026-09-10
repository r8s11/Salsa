# SalsaSegura — P2-6 Phase 1: Public Button System & Interaction Primitive Audit

**Audit Date:** September 4, 2026
**Scope:** All public and ordinary-user surfaces
**Code Changes:** None (audit only)

---

## 1. Executive Summary

| Metric | Count |
|--------|-------|
| Public button families | **12 distinct families** |
| Shared components | **0** (no `<Button>` component exists) |
| Raw `<button>` / `<Link>` / `<a>` implementations | **~200+ call sites** |
| Duplicate visual systems | **4** (global btn-*, event-page__btn, account-page__btn, profile-action-btn) |
| Intentionally specialized systems | **2** (admin-btn, calendar nav-btn/filter pills) |

**Largest source of duplication:** The `profile-action-btn` and `account-page__btn` families are near-identical copies of each other (same gradient, same radius, same padding, same font) and diverge only in that Account adds a `--session-global` and `--danger` variant. The global `btn-primary` is also duplicated with `event-page__btn--primary` and `cta-button` — all implement the same "red primary action" pattern with slight visual differences.

---

## 2. Button Family Inventory

| Family | Component/Class | Semantic Role | Consumers | Size | Variant | Recommendation |
|--------|----------------|---------------|-----------|------|---------|----------------|
| **Global Primary** | `.btn-primary` on `<button>`, `<Link>`, `<a>` | PRIMARY CTA | SubmitEventPage, Events, Contact, Auth, Hero, NotFound, Founders, FounderRequestForm, CalendarStatus, AuthCallback, InviteActivation, EventModal (RSVP) | min-h 44px, px 1.75rem | gradient red fill | **MERGE** → Button primary |
| **Global Secondary** | `.btn-secondary` on `<button>`, `<Link>` | SECONDARY | EventModal (ICS), SubmitEventPage, Events, UserEventEditPage, FoundersAcceptPage, FoundersWelcomePage, AdminRejectFounderDialog | min-h 44px, px 1.75rem | gold outline | **MERGE** → Button secondary |
| **Global Ghost** | `.btn-ghost` on `<button>` | TEXT_ACTION | Global CSS only, minimal public consumers | no min-height, px 0.5rem | text + underline reveal | **MERGE** → Button ghost |
| **Global Danger** | `.btn-danger` on `<button>` | DANGER | UserEventEditPage, AdminRejectFounderDialog, AdminFounderInvitationSection | min-h 44px (implicit), px 1.75rem | red outline | **MERGE** → Button danger |
| **Event Page Btn** | `.event-page__btn` + `--primary`/`--ghost`/`--sm` on `<button>`, `<Link>` | SECONDARY/ACTION | EventDetailPage only | padding 10px 16px (base), 7px 12px (sm) | border + fill variants | **MERGE** (or DEPRECATE — nearly identical to btn-*) |
| **Account Page Btn** | `.account-page__btn` + `--primary`/`--outline`/`--session-global`/`--danger` on `<button>`, `<Link>` | ACTION | AccountPage | padding 11px 20px, radius full | gradient primary, outline, session, danger | **MERGE** → Button |
| **Profile Action Btn** | `.profile-action-btn` + `--primary`/`--outline` on `<Link>` | ACTION | ProfilePage | padding 11px 20px, radius full | gradient primary, outline | **MERGE** → Button |
| **CTA Button** | `.cta-button` on `<a>` | PRIMARY CTA | Events section (homepage) | padding 0.9rem 2.25rem, radius 2px | red fill, sweep animation | **MERGE** → Button primary |
| **Auth Btn** | `.auth-btn` on `<button>`, `<a>` | NAV_CTA | Header (desktop sign-in/up) | padding 6px 12px, radius sm | dark red fill | **MERGE** (or SPECIALIZE if size intentionally small) |
| **Link Button** | `.link-button` on `<button>`, `<Link>` | TEXT_ACTION | SignInForm (toggle modes, reset password) | min-h 44px, px 4px 2px | transparent, gold text | **MERGE** → Button ghost |
| **Admin Btn** | `.admin-btn` + `--primary`/`--secondary`/`--danger`/`--ghost`/`--sm`/`--danger-quiet` | ACTION | All admin/host pages (~70+ call sites) | min-h 40px (34px sm), radius 8px | light theme variants | **KEEP SEPARATE** |
| **Calendar Nav Btn** | `.nav-btn` on `<button>` | NAVIGATION | Calendar.tsx (prev/next/today) | 44×44px, radius 50% | circular icon-only | **SPECIALIZED** — keep separate |
| **Calendar Filter Pill** | `.pill` on `<button>` | TOGGLE | Calendar, Events, HostMyEvents | varies | selected/unselected | **SPECIALIZED** — keep separate |
| **Page-Specific** | `.host-checkin__btn`, `.attendee-action-btn`, `.venue-card__cta`, `.modal-close-x`, `.password-toggle`, `.drawer-sign-out`, `.hero-btn` | Various | 1-2 pages each | varies | varies | **SPECIALIZED** — keep, but share tokens |

---

## 3. Visual Consistency Matrix

### Height / Padding Comparison

| System | min-height | padding | border-radius | font-size | font-weight |
|--------|-----------|---------|---------------|-----------|-------------|
| `.btn-primary` (global) | 44px | 0.8rem 1.75rem (~13px 28px) | `var(--radius-xl)` = 24px | 0.8rem | 700 |
| `.btn-secondary` (global) | 44px | 0.8rem 1.75rem | `var(--radius-xl)` = 24px | 0.8rem | 700 |
| `.btn-danger` (global) | 44px (implicit via padding) | 0.8rem 1.75rem | `var(--radius-xl)` = 24px | 0.8rem | 700 |
| `.btn-ghost` (global) | none | 0.8rem 0.5rem | none | 0.8rem | 700 |
| `.event-page__btn` | none | 10px 16px | `var(--radius-md)` = 12px | 0.8rem | 700 |
| `.event-page__btn--sm` | none | 7px 12px | `var(--radius-md)` = 12px | 0.75rem | 700 |
| `.account-page__btn` | none | 11px 20px | `var(--radius-full)` = 9999px | 12.5px | 700 |
| `.profile-action-btn` | none | 11px 20px | `var(--radius-full)` = 9999px | 12.5px | 700 |
| `.cta-button` (Events) | none | 0.9rem 2.25rem (~14px 36px) | 2px | 0.75rem | 600 |
| `.auth-btn` (Header) | none | 6px 12px | `var(--radius-sm)` = 4px | 0.75rem | 600 |
| `.link-button` (Auth) | 44px | 4px 2px | none | inherit | 700 |
| `.admin-btn` | 40px | 0 16px | `var(--admin-radius)` = 8px | 0.9rem | 600 |
| `.admin-btn--sm` | 34px (44px touch) | 0 11px | 8px | 0.82rem | 600 |
| `.nav-btn` (Calendar) | 44px (explicit w/h) | none | 50% | 1.1rem | normal |

### Key Inconsistencies

1. **Height:** Global buttons enforce min-height 44px; event-page, account-page, profile-action, cta-button, auth-btn do NOT set min-height — they rely on padding alone (PASS/FAIL varies).
2. **Border radius:** Three different radius strategies: `--radius-xl` (24px pill), `--radius-full` (9999px pill), `--radius-md` (12px rounded rect), 2px (sharp), 50% (circle). No single radius token for buttons.
3. **Font size:** 0.75rem (auth-btn, cta-button, event-page--sm), 0.8rem (global btn-*, event-page), 12.5px (account/profile), 0.9rem (admin). Inconsistent across families.
4. **Font weight:** 600 (admin, cta-button, auth-btn) vs 700 (global btn-*, event-page, account/profile, link-button).
5. **Font family:** `--font-ui` (global btn-*, auth-btn, admin) vs `--font-display` (event-page, account/profile, venue-card__cta, profile-action). Same font today ("Epilogue"), but semantically divergent.
6. **Gradient:** `linear-gradient(180deg, #ff3d63, #e11d48)` (global btn-primary) vs `linear-gradient(120deg, var(--red), #c2153c)` (account/profile primary). Different gradient angles and stops.
7. **Background:** `var(--red)` solid (event-page primary) vs gradient (global/account/profile primary). Three approaches to "red primary fill."
8. **Border:** 0 (global btn-primary) vs 1px solid transparent (event-page btn-primary) vs none (account/profile primary). Visual weight differs.
9. **Hover:** `box-shadow: var(--glow-primary)` (global btn-primary) vs `background: var(--red-bright)` (auth-btn) vs `border-color: var(--red); color: #fff; background: var(--red-dim)` (account outline hover). Three different hover strategies for primary-like buttons.
10. **Disabled opacity:** 0.55 (global btn-*, admin-btn) vs 0.6 (account-page btn, link-button, password-toggle) vs 0.7 (FounderRequestForm btn-primary override). Inconsistent.

### Color Token Comparison

| Token | Global Buttons | Account/Profile | Event Page | Admin |
|-------|---------------|-----------------|------------|-------|
| Primary fill | `linear-gradient(180deg, #ff3d63, #e11d48)` | `linear-gradient(120deg, var(--red), #c2153c)` | `var(--red)` | `var(--admin-brand)` |
| Primary hover | `var(--glow-primary)` box-shadow | `var(--glow-primary)` box-shadow | none defined | `var(--admin-brand-hover)` |
| Secondary border | `var(--gold)` | `var(--border-md)` | `var(--border-md)` | `var(--admin-border)` |
| Secondary text | `var(--gold)` | `var(--text)` | `var(--text)` | `var(--admin-text-primary)` |
| Danger border | `var(--red-bright)` | `rgba(225,29,72,0.55)` | none | `var(--admin-danger)` |
| Danger text | `var(--red-bright)` | `var(--red-bright)` | none | `#ffffff` |

---

## 4. Semantic Findings

| Finding | Location | Element | Severity | Classification |
|---------|----------|---------|----------|----------------|
| `<a href="#events">` used as button | `Hero.tsx:81` | Hero scroll CTA | LOW | **Acceptable** — anchor link to page section, not route navigation |
| `<a href="/admin/tags/new">` used as button | `AdminTagsPage.tsx:95,151` | Admin "New Tag" CTA | MEDIUM | **Should be `<Link>`** — internal route, causes full page reload |
| `<Link>` with `className="btn-primary"` for navigation | Events.tsx, CalendarStatus, NotFound, Founders | "Submit Event" / "View Calendar" / "Back Home" | LOW | **Acceptable** — correct: link navigates, button styles are visual only |
| Missing `type="button"` on some buttons | Multiple (most have it) | Various | LOW | **Mostly good** — forms consistently use `type="submit"`, non-form buttons use `type="button"`. Spot-check shows no accidental form submissions discovered. |
| `<button>` used for filtering (no `aria-pressed`) | Calendar.tsx (city toggle, type filter), Events.tsx (type filter) | Filter pills | MEDIUM | **Missing `aria-pressed`** — toggled buttons should announce state |
| `role="button"` on non-interactive elements | EventCard.tsx:45, FeaturedEventCard.tsx:43, EventFlyerField.tsx:206 | Clickable cards, dropzone | LOW | **Acceptable** — cards navigate via onClick+keyboard, dropzone is interactive |
| `<button>` without accessible name | Header city toggle, hamburger, Calendar nav arrows | Icon-only buttons | MEDIUM | **Check** — city toggle has no `aria-label`; hamburger and calendar arrows do have `aria-label` |
| `.cta-button` uses `<a href>` for internal scroll | Events section CTA | Homepage CTA to calendar | LOW | **Acceptable** — navigates to section/route |

**Summary:** No critical semantic defects found. Two medium findings: `<a href>` used for internal navigation in admin (should be `<Link>`), and missing `aria-pressed` on filter toggles.

---

## 5. Touch Target Findings (Post-P2-1)

| System | Measured Height | Effective Hitbox | Status |
|--------|----------------|-------------------|--------|
| `.btn-primary` (global) | min-height 44px | 44px+ | **PASS** |
| `.btn-secondary` (global) | min-height 44px | 44px+ | **PASS** |
| `.btn-danger` (global) | ~44px via padding | 44px+ | **PASS** |
| `.btn-ghost` (global) | ~38px (0.8rem+0.8rem padding + line-height) | ~38px | **CONDITIONAL** — no min-height, text-only buttons may fall short |
| `.event-page__btn` | ~36px (10+10px padding + line-height) | ~36px | **CONDITIONAL** — no min-height set |
| `.event-page__btn--sm` | ~28px (7+7px padding) | ~28px | **FAIL** — below 44px touch target |
| `.account-page__btn` | ~40px (11+11px padding + line-height) | ~40px | **CONDITIONAL** — close but no min-height |
| `.profile-action-btn` | ~40px (11+11px padding + line-height) | ~40px | **CONDITIONAL** — close but no min-height |
| `.cta-button` | ~44px (14+14px padding + line-height) | ~44px | **PASS** |
| `.auth-btn` | ~30px (6+6px padding + line-height) | ~30px | **FAIL** — below 44px |
| `.link-button` | min-height 44px | 44px | **PASS** |
| `.nav-btn` (Calendar) | 44×44px explicit | 44px | **PASS** |
| `.admin-btn` | min-height 40px (44px on touch) | 40px/44px | **PASS** (touch devices get 44px) |
| `.admin-btn--sm` | min-height 34px (44px touch) | 34px/44px | **CONDITIONAL** (desktop below target) |
| `.password-toggle` | 44×44px | 44px | **PASS** |
| `.modal-close-x` | 36×36px | 36px | **CONDITIONAL** — below 44px |
| `.attendee-action-btn` | 28×28px | 28px | **FAIL** — admin-only, below target |
| `.venue-card__cta` | min-height 44px | 44px | **PASS** |

**Regressions vs P2-1:** `.event-page__btn--sm` (28px) is a potential regression if P2-1 was supposed to cover all touch targets. `.auth-btn` (30px) and `.modal-close-x` (36px) also appear below target.

---

## 6. Loading / Disabled Findings

| Surface | Action | Loading Pattern | Disabled Pattern | Issue |
|---------|--------|----------------|-----------------|-------|
| SubmitEventPage | Submit event | Text swap: "Submitting..." | `disabled={isSubmitting}` | OK — no spinner, text swap causes width jump |
| Contact | Send message | Text swap: "Sending..." | `disabled={isSubmitting}` | OK — same pattern |
| FounderRequestForm | Submit | Spinner (Loader2) + text swap | `disabled={submitting}` | OK — spinner is `aria-hidden`, text remains |
| AuthCallback | Create account | None visible | `disabled={busy}` | **Issue** — no visual loading state, user sees no feedback |
| InviteActivationPage | Activate | None visible | `disabled={busy}` | **Issue** — same as above |
| SignInForm | Sign in | None visible | `disabled={loading}` | **Issue** — no visual loading state |
| UserEventEditPage | Save | None visible | `disabled={isSaving}` | **Issue** — no visual loading state |
| HostCreateEventPage | Save draft/publish | Text swap: "Saving…" | `disabled={isSaving}` | OK — text swap |
| HostEditEventPage | Save | None visible | `disabled={saving}` | **Issue** — no visual loading state |
| HostEventDetailPage | Delete | None visible | `disabled={isDeleting}` | **Issue** — no visual loading state |
| AccountPage | Delete account | None visible | `disabled` via dialog | OK — confirmation dialog provides context |
| EventFlyerField | Upload | Spinner (Loader2) | `aria-disabled` | OK — uses aria-disabled, not `disabled` |
| AdminPages | Various saves | Text swap ("Saving…") | `disabled={isSaving}` | OK |

**Patterns found:**
- Text swap: 3 surfaces
- Spinner: 2 surfaces (FounderRequestForm, EventFlyerField)
- Disabled only (no visual): 6 surfaces
- No `aria-busy` usage anywhere

---

## 7. Link CTA Findings

**Navigation actions using `<Link>` or `<a>` with button-like styling:**

| Action | Element | Current Class | Should Share Button Primitives? |
|--------|---------|--------------|-------------------------------|
| "Submit Event" (Events section) | `<Link>` | `btn-primary` | **Yes** — already shares |
| "View Calendar" (Events section) | `<Link>` | `btn-secondary` | **Yes** — already shares |
| "Go to Calendar" (NotFound) | `<Link>` | `btn-primary` | **Yes** — already shares |
| "Submit Event" (CalendarStatus) | `<Link>` | `btn-primary` | **Yes** — already shares |
| Hero scroll "Explore Events" | `<a>` | `btn-primary hero-btn` | **Yes** — already shares |
| Venue "Get Directions" | `<a>` | `venue-card__cta` | **Specialized** — text-only link, different visual role |
| Venue "Venue Page" | `<a>` | `venue-card__cta` | **Specialized** — text-only link |
| Founders "Go to Dashboard" | `<Link>` | `btn-primary` | **Yes** — already shares |
| Auth "Forgot Password" / "Create Account" | `<button>`/`<Link>` | `link-button` | **Yes** — should share ghost/text variant |
| Account "View Profile" | `<Link>` | `account-page__btn--primary` | **Yes** — should merge into Button primary |
| Profile "Submit Event" | `<Link>` | `profile-action-btn--primary` | **Yes** — should merge into Button primary |

**Phase 2 architecture should support:** A `ButtonLink` (or polymorphic `asChild`) that renders `<Link>`/`a` with identical button visual styling. Currently the codebase achieves this by applying `.btn-*` classes to `<Link>` elements directly — no wrapper component needed, but a component would enforce consistency.

---

## 8. Icon / Toggle Boundary

### Icon-Only Controls (should share sizing/focus primitives)

| Control | Element | Size | Focus Style | Recommendation |
|---------|---------|------|-------------|----------------|
| Account avatar | `<summary>` | 44×44px | Custom (via global) | **SPECIALIZED** — avatar trigger, unique |
| Hamburger | `<button>` | varies | `outline: 2px solid var(--red-bright)` | **SPECIALIZED** — unique layout role |
| Calendar prev/next | `<button>` | 44×44px | `outline: 2px solid var(--gold)` | **SPECIALIZED** — shares focus ring color with calendar, but should share 44px target |
| Password toggle | `<button>` | 44×44px | none defined | **ISSUE** — no focus-visible style |
| Modal close (X) | `<button>` | 36×36px | none defined | **ISSUE** — no focus-visible style, below 44px target |
| Ellipsis menu | `<button>` | varies | varies | N/A — not found in public surface |
| Share icons (email/copy) | `<button>` | varies | varies | **SPECIALIZED** — social sharing |

**Recommendation:** Icon-only controls should share a 44px minimum target and consistent focus ring (2px solid `var(--red-bright)` or `var(--gold)` per context). They should NOT be forced into the same Button component API.

### Toggle / Segmented Controls (should remain separate)

| Control | ARIA | Visual | Recommendation |
|---------|------|--------|----------------|
| Calendar city pill | `aria-pressed` (implicit) | pill with active state | **SPECIALIZED** — toggle semantics |
| Calendar type filter | `aria-pressed` (implicit) | pill with active state | **SPECIALIZED** — toggle semantics |
| Events type filter | `aria-pressed` (implicit) | pill with active state | **SPECIALIZED** — toggle semantics |
| Host events status filter | `aria-pressed` (implicit) | pill with active state | **SPECIALIZED** — toggle semantics |
| Event type selector (EventForm) | toggle state | button group | **SPECIALIZED** — form-specific |
| City selector (EventForm) | toggle state | button group | **SPECIALIZED** — form-specific |
| Dance style chips | toggle state | chip with active state | **SPECIALIZED** — form-specific |

These should share low-level tokens (height, radius, focus ring) but NOT the same Button component. They use `aria-pressed` and selected-state semantics that differ fundamentally from action buttons.

---

## 9. Admin Boundary

**Recommendation: KEEP ADMIN SEPARATE**

**Rationale:**
1. Admin uses a completely separate token system (`--admin-*` tokens vs `--*` tokens).
2. Admin uses a light SaaS theme; public uses dark glassmorphic theme.
3. Admin buttons have different sizing (40px min-height, 8px radius vs 44px / 24px radius).
4. Admin buttons have `--sm`, `--danger-quiet`, `--ghost` variants not needed publicly.
5. Admin buttons already work well within their `.admin-shell` scope.
6. The codebase already has clean separation via `.admin-shell` scoping.

**Phase 2 should:** Share only low-level CSS reset patterns (inline-flex, cursor, transition) if desired. The admin button system is well-structured and intentional. Forcing unification would create complexity without benefit.

---

## 10. Recommended Phase 2 Primitive Set

### `Button` — Action Button

```tsx
<Button variant="primary" | "secondary" | "ghost" | "danger"
        size="md" | "sm"
        disabled
        loading
        icon={<Icon />}
        iconPosition="left" | "right">
  Label
</Button>
```

- **Purpose:** All actionable buttons (form submits, triggers, confirmations)
- **Variants:** primary (red gradient fill), secondary (gold outline), ghost (text + underline), danger (red outline)
- **Sizes:** md (min-height 44px, 0.8rem font), sm (min-height 32px, 0.75rem font)
- **Semantic element:** `<button>` always
- **Loading:** Spinner + disabled, text swap optional
- **Disabled:** `disabled` attribute + `opacity: 0.55`
- **Icon:** Optional, with position control
- **Focus:** `outline: 2px solid var(--red-bright); outline-offset: 2px`

### `ButtonLink` — Navigational CTA

```tsx
<ButtonLink to="/submit" variant="primary" size="md">
  Submit Event
</ButtonLink>

<ButtonLink href="https://..." variant="secondary" external>
  External Link
</ButtonLink>
```

- **Purpose:** Navigation actions that look like buttons
- **Same visual API as Button** but renders `<Link>` or `<a>`
- **Polymorphic alternative:** `<Button asChild><Link to="/submit">Submit</Link></Button>` (if using Radix-style asChild)

### `IconButton` — Icon-Only Control

```tsx
<IconButton aria-label="Close" variant="ghost" size="md">
  <X />
</IconButton>
```

- **Purpose:** Icon-only controls (close, navigation arrows, toggles)
- **Sizes:** md (44×44px), sm (32×32px)
- **Variants:** ghost (default), outline, danger
- **Focus:** Consistent ring per context

### `ToggleButton` — Selection/Press State

```tsx
<ToggleButton pressed={isOn1} onPressedChange={setIsOn1}>
  On1
</ToggleButton>
```

- **Purpose:** Calendar filters, city selectors, dance style chips
- **ARIA:** `aria-pressed` managed automatically
- **Shares tokens** (height, radius, focus) but separate API from Button

### Token Consolidation (no new tokens needed)

Phase 2 should normalize onto existing tokens:
- **Height:** `--btn-min-h: 44px` (public), `--admin-btn-min-h: 40px` (admin)
- **Radius:** `--radius-xl` for public pills, `--admin-radius` for admin
- **Font:** `--font-ui` for all buttons
- **Disabled:** Standardize to `opacity: 0.55`
- **Focus:** `--focus-ring: 2px solid var(--red-bright); --focus-offset: 2px`

---

## 11. Migration Map

| Current Class | → Proposed Primitive | Consumers | Risk |
|--------------|---------------------|-----------|------|
| `.btn-primary` | `Button variant="primary"` | ~25 call sites | **LOW** — direct class-to-prop mapping |
| `.btn-secondary` | `Button variant="secondary"` | ~12 call sites | **LOW** |
| `.btn-ghost` | `Button variant="ghost"` | ~3 call sites | **LOW** |
| `.btn-danger` | `Button variant="danger"` | ~3 call sites | **LOW** |
| `.btn-block` | `Button` with `className="w-full"` or `block` prop | ~6 call sites | **LOW** |
| `.event-page__btn` | `Button variant="secondary" size="sm"` | EventDetailPage only | **LOW** |
| `.event-page__btn--primary` | `Button variant="primary" size="sm"` | EventDetailPage only | **LOW** |
| `.event-page__btn--ghost` | `Button variant="ghost" size="sm"` | EventDetailPage only | **LOW** |
| `.account-page__btn--primary` | `Button variant="primary"` | AccountPage | **LOW** |
| `.account-page__btn--outline` | `Button variant="secondary"` | AccountPage | **LOW** |
| `.account-page__btn--session-global` | `Button variant="danger"` or new `warning` variant | AccountPage | **MEDIUM** — unique visual, may need new variant |
| `.account-page__btn--danger` | `Button variant="danger"` | AccountPage | **LOW** |
| `.profile-action-btn--primary` | `Button variant="primary"` | ProfilePage | **LOW** |
| `.profile-action-btn--outline` | `Button variant="secondary"` | ProfilePage | **LOW** |
| `.cta-button` | `Button variant="primary"` | Events section | **LOW** |
| `.auth-btn` | `Button variant="primary" size="sm"` | Header | **MEDIUM** — intentional small size, verify |
| `.link-button` | `Button variant="ghost"` | SignInForm | **LOW** |
| `.nav-btn` (Calendar) | `IconButton` | Calendar | **LOW** |
| `.modal-close-x` | `IconButton variant="ghost"` | EventModal | **MEDIUM** — 36px target needs fix |
| `.password-toggle` | `IconButton variant="ghost"` | SignInForm | **LOW** |
| `.admin-btn` | **KEEP** | Admin/host pages | **N/A** — no migration |
| `.pill` / filter toggles | `ToggleButton` | Calendar, Events, Host | **MEDIUM** — aria-pressed integration |

---

## 12. Phase 2 Priority

| Priority | Item | Rationale |
|----------|------|-----------|
| **P0** | Fix `.event-page__btn--sm` touch target (28px → 32px min) | Accessibility regression |
| **P0** | Fix `.auth-btn` touch target (30px → 44px) | Accessibility gap |
| **P0** | Fix `.modal-close-x` touch target (36px → 44px) | Accessibility gap |
| **P0** | Add `aria-pressed` to calendar/event filter toggles | Accessibility: toggle state not announced |
| **P0** | Add focus-visible to `.password-toggle` and `.modal-close-x` | Keyboard navigation gap |
| **P1** | Create `Button` component (primary/secondary/ghost/danger) | Eliminates 4 duplicate CSS families |
| **P1** | Create `ButtonLink` component | Ensures Link + button visual parity |
| **P1** | Merge `.event-page__btn` into Button | Eliminates page-specific duplicate |
| **P1** | Merge `.account-page__btn` + `.profile-action-btn` into Button | Eliminates near-identical duplicates |
| **P1** | Merge `.cta-button` into Button | Eliminates another primary variant |
| **P2** | Add loading state (spinner) to async buttons | 6 surfaces currently lack visual feedback |
| **P2** | Standardize disabled opacity to 0.55 | Consistency across all families |
| **P2** | Create `IconButton` primitive | Consistent icon-only control handling |
| **P2** | Normalize focus-visible across all public buttons | Currently mixed (red-bright vs gold vs missing) |
| **P3** | Normalize gradient angles (180deg → 120deg or vice versa) | Cosmetic consistency |
| **P3** | Normalize font-size tokens for buttons | 0.75rem / 0.8rem / 12.5px / 0.9rem → standardize |
| **P3** | Remove deprecated `style.css` and `EventModal.css` at project root | Dead code cleanup |

---

## 13. Expected Files to Change (Phase 2)

**New files:**
- `src/components/ui/Button.tsx` — Button component
- `src/components/ui/Button.css` — Button styles
- `src/components/ui/ButtonLink.tsx` — Link-as-button component
- `src/components/ui/IconButton.tsx` — Icon-only button
- `src/components/ui/IconButton.css` — Icon button styles
- `src/components/ui/ToggleButton.tsx` — Toggle/press-state button

**Modified files (consumers):**
- `src/pages/SubmitEventPage.tsx` + `.css`
- `src/pages/EventDetailPage.tsx` + `.css`
- `src/pages/NotFoundPage.tsx`
- `src/pages/FoundersAcceptPage.tsx`
- `src/pages/FoundersWelcomePage.tsx`
- `src/pages/UserEventEditPage.tsx`
- `src/pages/AccountPage.tsx` + `.css`
- `src/pages/ProfilePage.tsx` + `.css`
- `src/components/Events/Events.tsx` + `.css`
- `src/components/Hero/Hero.tsx` + `.css`
- `src/components/Contact/Contact.tsx`
- `src/components/Auth/SignInForm.tsx` + `.css`
- `src/components/Auth/AuthCallback.tsx`
- `src/components/Auth/InviteActivationPage.tsx`
- `src/components/Founder/FounderRequestForm.tsx` + `.css`
- `src/components/EventModal/EventModal.tsx` + `.css`
- `src/features/calendar/components/CalendarStatus.tsx`
- `src/features/submit-event/components/SuccessCard.tsx`
- `src/features/events/components/VenueMapCard.tsx` + `.css`
- `src/components/Header/Header.tsx` + `.css`
- `src/components/Calendar/Calendar.tsx` + `.css`

**CSS files to consolidate/remove:**
- `src/styles/global.css` (sections 7: Buttons → import from Button.css)
- `src/pages/EventDetailPage.css` (btn section → remove)
- `src/pages/AccountPage.css` (btn section → remove)
- `src/pages/ProfilePage.css` (btn section → remove)
- `src/components/Events/Events.css` (cta-button → remove)
- `src/components/Founder/FounderRequestForm.css` (btn-primary override → remove)
- `src/components/Auth/SignInForm.css` (link-button, password-toggle → keep password-toggle, remove link-button)

**Not changed:**
- `src/styles/admin.css` (admin-btn stays separate)
- Admin/Host page files (use admin-btn, no migration)

---

## 14. Browser Verification

**Note:** This audit was conducted via static code analysis. No browser runtime inspection was performed. All measurements are derived from CSS definitions and may differ from computed values due to:
- Browser defaults (line-height, font metrics)
- Parent container constraints
- Media query interactions
- Font loading state

**Representative pages analyzed (static):**
- `/` — Hero, Events section CTA
- `/calendar` — Calendar nav, filter pills
- `/events/:id` — EventDetailPage buttons (via EventModal)
- `/submit` — Submit form buttons
- `/contact` — Contact form submit
- `/signin` — Auth form buttons, password toggle
- `/founders` — Founder flow buttons
- `/account` — Account action buttons
- `/profile` — Profile action buttons

**Viewports:** CSS definitions checked for responsive breakpoints at 375px, 768px, and 1440px breakpoints. No actual viewport measurement performed.

---

## 15. Scope Confirmation

- **No source changes made.**
- **No test changes made.**
- **No CSS changes made.**
- **No database/production work.**
- **No P2-8+ work.**
- **No commit/push/merge/reset/stash.**

This is a read-only audit document. All findings are recommendations for Phase 2.

---

## Appendix A: Complete Button Class Inventory

### Global (src/styles/global.css)
- `.btn-primary` — gradient red fill, 44px min-height, pill radius
- `.btn-secondary` — gold outline, 44px min-height, pill radius
- `.btn-ghost` — text-only, underline hover animation
- `.btn-danger` — red outline, pill radius
- `.btn-block` — full-width modifier
- `.rsvp-button` — EventModal RSVP (extends btn-primary contextually)
- `.style-chip` — dance style display chip (not a button)

### Admin (src/styles/admin.css)
- `.admin-btn` — base, 40px min-height, 8px radius
- `.admin-btn--primary` — brand fill
- `.admin-btn--secondary` — surface fill + border
- `.admin-btn--danger` — danger fill
- `.admin-btn--ghost` — transparent
- `.admin-btn--sm` — smaller (34px/44px touch)
- `.admin-btn--danger-quiet` — outlined danger
- `.admin-icon-btn` — 32×32px icon button

### Page-Specific
- `.event-page__btn` / `--primary` / `--ghost` / `--sm` (EventDetailPage)
- `.account-page__btn` / `--primary` / `--outline` / `--session-global` / `--danger` (AccountPage)
- `.profile-action-btn` / `--primary` / `--outline` (ProfilePage)
- `.cta-button` (Events.css — homepage CTA)
- `.auth-btn` (Header.css — desktop auth)
- `.link-button` (SignInForm.css — auth toggle links)
- `.nav-btn` / `.today-btn` (Calendar.css — month navigation)
- `.password-toggle` (SignInForm.css — show/hide password)
- `.modal-close-x` (EventModal.css — close button)
- `.modal-close.back-pill` (EventModal.css — mobile back)
- `.rsvp-button` (EventModal.css + global.css)
- `.poster-toggle-btn` (EventModal.css)
- `.copy-link-btn` (EventModal.css)
- `.venue-card__cta` (VenueMapCard.css — venue link)
- `.hero-btn` (Hero.css — hero CTA override)
- `.drawer-sign-out` (Header.css — mobile sign out)
- `.attendee-action-btn` / `--danger` (HostAttendeeListPage.css — admin row actions)
- `.host-checkin__checkin-btn` (HostCheckInPage.css — uses admin-btn)
- `.host-my-events__card-btn` (HostMyEventsPage.css)

---

# SalsaSegura — P2-6 Closure Report

**Closure Date:** September 4, 2026

---

## 1. Architecture Correction

```
Production .ss-btn consumers before: 0 (ss-btn was always a design handoff name)
Production .ss-btn consumers after: 0
Production ui-button consumers: 22+ components
Canonical public classes: .ui-button, .ui-button--primary, .ui-button--secondary, .ui-button--ghost, .ui-button--danger, .ui-button--compact, .ui-button--block, .ui-button--loading
```

Handoff/reference `.ss-btn` styles in `design/` are **not required** by production primitives. Production owns its own CSS classes under `src/components/ui/Button.css`.

## 2. Header Result

| Old class | New primitive | Runtime size 375/768/1440 |
|-----------|--------------|---------------------------|
| `ss-btn ss-btn--primary ss-btn--compact` (raw NavLink) | `<ButtonLink size="compact">` | ≥44px (CSS min-height enforced) |

Header.css overrides for `.ui-button--compact` ensure 44px min-height, 6px 12px padding, font-size 0.75rem.

## 3. Toggle Semantics

| Control | aria-pressed state | Result |
|---------|-------------------|--------|
| Calendar type filters | `aria-pressed={typeFilter === option.value}` | ALREADY CORRECT |
| Calendar city toggle | `aria-pressed={city === option.value}` | ALREADY CORRECT |
| Events type filters | `aria-pressed={typeFilter === opt.value}` | ALREADY CORRECT |
| Host event filters | `aria-pressed={filter === option.value}` | ALREADY CORRECT |
| Calendar sidebar styles | `aria-pressed={styleFilter === style}` | ALREADY CORRECT |
| Header city switcher | `aria-pressed={city === value}` | ALREADY CORRECT |

## 4. Runtime Measurements (CSS-enforced)

| Control | min-height | padding | Effective target |
|---------|-----------|---------|-----------------|
| Button (all variants) | 44px | 0.8rem 1.75rem | ≥44px PASS |
| Button compact | 36px | 6px 14px | 36px (header overrides to 44px) |
| IconButton | 44px × 44px | 0 | 44px PASS |
| Header .ui-button--compact | 44px (override) | 6px 12px | ≥44px PASS |

## 5. Loading Verification

| Surface | Label | Disabled | aria-busy | Duplicate prevention |
|---------|-------|----------|-----------|---------------------|
| Contact | "Sending…" | ✓ | ✓ | ✓ |
| SignInForm | "Please wait…" | ✓ | ✓ | ✓ |
| AuthCallback | "Updating password…" | ✓ | ✓ | ✓ |
| InviteActivationPage | "Setting password…" | ✓ | ✓ | ✓ |
| FounderRequestForm | "Submitting…" | ✓ | ✓ | ✓ |
| SubmitEventPage | "Submitting…" | ✓ | ✓ | ✓ |
| UserEventEditPage | "Saving…"/"Withdrawing…" | ✓ | ✓ | ✓ |
| EventModal Share | "Generating…" | ✓ | ✓ | ✓ |

## 6. CSS Cleanup

| Selector | Status | Reason |
|----------|--------|--------|
| `.btn-primary` | KEEP TEMPORARILY | Used by 5 admin pages (AdminFounderRequestDetailPage, AdminRejectFounderDialog, AdminFounderInvitationSection, AdminApproveDialog, Calendar.tsx) — admin migration is out of scope |
| `.btn-secondary` | KEEP TEMPORARILY | Same admin consumers |
| `.btn-danger` | KEEP TEMPORARILY | Same admin consumers |
| `.btn-ghost` | REMOVE NOW | Zero production consumers |
| `.btn-block` | REMOVE NOW | Zero production consumers |
| `.cta-button` | REMOVE NOW | Zero production consumers (migrated to Button) |
| `.event-page__btn` | REMOVE NOW | Zero production consumers (migrated to Button) |
| `.account-page__btn` | KEEP TEMPORARILY | `.account-page__btn--session-global` still used as className override on Button in AccountPage.tsx |
| `.profile-action-btn` | REMOVE NOW | Zero production consumers |
| `.auth-btn` | REMOVE NOW | Zero production consumers (migrated to ButtonLink) |
| `.link-button` | REMOVE NOW | Zero production consumers (migrated to Button variant="ghost") |

## 7. Automated Verification

```
lint:        0 errors, 0 warnings ✓
build:       passing ✓
full suite:  165 files passed, 1498 tests passed, 0 failures ✓
```

No failures remain. The previous 3 failures in AdminFounderRequestsTable were resolved by the `React` import fix.

## 8. Scope Confirmation

- ✓ Admin button system unchanged
- ✓ No P2-8+ work
- ✓ No database/production changes
- ✓ P2-1 through P2-4 behavior preserved
- ✓ No unrelated working-tree changes
- ✓ No commit/push/merge/reset/stash

## 9. Closure Decision

```
P2-6 VERIFIED — public button system consolidated.
```

**What remains:** Browser verification at 375px/768px/1440px (requires manual testing or Interceptor installation). The CSS enforces 44px min-height targets, but runtime rendering should be confirmed visually.

# UX/UI Integrity Audit — 2026-09-01

**Scope:** Live-browser audit (public routes) + static code/CSS review (authenticated routes) of `/home/r8s/code/Salsa` (SalsaSegura).
**Method:** Local Supabase stack (remapped to ports 54421+ per the sibling-port procedure — the Bellocampo stack occupies the defaults and was never touched) + Vite dev server on 5173, driven by a real headless Chromium at 375×812 / 768×1024 / 1440×900. Automated DOM collection of contrast ratios (computed WCAG luminance math, not eyeballing), overflow, touch targets, headings, landmarks, focus indicators, ARIA, console/network errors, plus targeted interaction tests (tab-through, empty-form submits, tab switching). 15 screenshots captured to `/tmp/aud-*.png` (vision-model inspection was rate-limited; all visual claims below are grounded in DOM/computed-style measurements and source reads instead).

**Environment disclosure (important):** A fresh local stack (`supabase start` + `seed.sql`) **cannot serve the core public flow** — the app's event queries embed `event_taxonomy_terms(...)` and `/submit` calls the `public_event_suggestions_enabled()` RPC, but neither the taxonomy tables nor `platform_settings` exist in `supabase/migrations/` (they live only in manually-run operational SQL: `sql/phase-10/*`, `supabase/reconcile-prod-schema.sql`). Live results below were captured after applying that production-matching DDL to the local stack (idempotent, non-destructive, mirrors what production actually has). The drift itself is reported as a finding.

**Authenticated routes (admin/host/profile/account):** *Static review only — browser verification blocked: no local test credentials found.* `supabase/seed.sql` creates zero `auth.users`; the only credential-creating script (`supabase/manual/phase6_host_access_verification.sql`) uses throwaway `crypt('x', ...)` hashes with no documented password, and no usable admin/organizer credentials exist anywhere in the repo. Per audit instructions no accounts were created.

---

## 1. Audit Health Score

| Category | Score (0–4) | Key Finding |
| --- | --- | --- |
| Accessibility | 2 | Multiple computed WCAG-AA contrast failures: 1.32:1 date-chip badge on `/events/:id`, 3.64:1 header CTAs on every page, 3.75:1 calendar text, 1.83:1 unstyled logo link on `/founders`. Focus indicators and tab order are otherwise excellent. |
| Performance | 3 | Route-level lazy loading, fast loads (DCL ~352ms dev), lazy gallery images. Deductions: full `@schedule-x/theme-default` light CSS shipped against dark overrides; unoptimized remote picsum card images; no per-route SEO metadata (known gap). Not production-measured (dev server). |
| Responsive Design | 3 | Zero horizontal overflow across 12 routes × 3 viewports; calendar switches to list view on mobile with 44px drawer targets. Deductions: footer/social links 19px, calendar controls 38px, several buttons/inputs under 44px on mobile. |
| Theming | 2 | Three deliberate token systems exist (public `global.css`, scoped `admin.css`, `handoff-bridge.css` mapping `--ss-*`→tokens) but thousands of hardcoded hex values bypass them; 3+ competing button class systems; schedule-x default theme fights the dark palette; `/founders` renders off-system (default-blue link, different navy, different focus color). |
| Implementation Integrity | 1 | **FAIL** — `/lessons`, `/instructors`, `/schools` ship a generic "Work in Progress" placeholder page from the main nav; 5 unrouted 0-byte school pages; local migration chain can't run the public flow. Core flows (event detail, submit, calendar, auth) are genuinely well-authored. |
| **Total** | **11/20** | **Acceptable** (band 10–13) |

---

## 2. Implementation Integrity Verdict

**Verdict: FAIL** (for the shipped public surface as a whole), driven by three concrete evidence points, against a backdrop of otherwise authored, product-specific work.

**Failure evidence:**

1. **Placeholder pages presented as real nav destinations.** `src/pages/Lessons.tsx`, `Instructors.tsx`, and `Schools.tsx` are 4-line wrappers around `<WorkInProgress />` (`src/components/WIP/WorkInProgress`). Live-rendered at all three URLs: *"Work in Progress — We are currently working on our new website to bring you the best dance experience. Stay tuned for updates!"* — a generic, interchangeable page with no salsa/city/product specificity, linked from the main header nav on every page (CALENDAR · LESSONS · INSTRUCTORS · ABOUT · CONTACT). H1 on all three is "Salsa Segura" (the site name), not a page title. Verified live at mobile/desktop.
2. **Dead/unrouted school content.** `src/pages/Schools/{Querencia,RumbaYTimbal,SalsaYControl,LiliDance,Masacote}.tsx` are 0-byte placeholder files, and no `/schools/:slug` route exists in `App.tsx`; `/schools` itself is not linked from the header or footer (orphan route reachable only by typing the URL).
3. **Local environment cannot run the product.** `supabase start` + seed produces a DB where `/`, `/calendar`, and `/events/:id` all fail with PostgREST 400 ("Could not find a relationship … event_taxonomy_terms") and `/submit` 404s on the `public_event_suggestions_enabled` RPC, because `taxonomy_terms`, `event_taxonomy_terms`, `platform_settings`, and `venues` are absent from `supabase/migrations/` (they exist in production only via manual operational SQL). The approved-but-unexecuted consolidation plan (`docs/superpowers/plans/2026-08-30-sql-current-state-consolidation.md`) exists to fix exactly this.

**Counter-evidence (what passes):** `EventDetailPage`, `SubmitEventPage` (flyer upload + manual entry, recurrence, submission gate), `CalendarPage` (city switcher, type filters, mobile list view), `SignInPage`/auth callback suite, `FoundersPage`, and the entire admin surface are specific, product-authored, and truthful about capabilities (no fake toggles; deferred features render as inert rows or are omitted). No lorem-ipsum/"coming soon" strings were detected anywhere else in live-rendered text.

### 2a. Fold-in: static-analysis worker findings (ux-audit-static)

- **Hardcoded colors:** thousands of hex color occurrences in component CSS outside the token layer — corroborates and scales up the Theming finding above (my live measurements surfaced the user-visible consequences: the off-token gold/rose badge colors on RelatedEventsStrip and the unstyled founders logo link).
- **0-byte Schools pages + WIP wrappers** — independently confirmed; matches live evidence.
- **Icon-only buttons are generally accessible**; `alt=""` images on tables/cards are the acceptable decorative pattern (redundant with adjacent text). One false positive from my own collector (`.bmc-link` has `alt="Buy me a coffee"` on its image) was verified and dismissed.
- **Admin/Host branding boundary:** the worker reports the boundary is "thin" and that host pages can show "Organizer · Host · [Section]" branding. My code-level read of `AdminLayout.tsx:72-79,121-133` shows host routes deliberately suppress the `rolePrefix` crumb (`isHostRoute` guard), so the rendered breadcrumb is "Host · My Events" etc.; the shared shell is an intentional architecture decision (same `AdminLayout` component, documented). Residual leak is real but smaller: host pages reuse admin-labeled components (`AdminMetricCard`, `AdminPageHeader`, `AdminStatusBadge`) and the admin visual system throughout — host feels like an admin workspace with host-labeled copy, not an organizer-branded space. See finding [P2-9].
- **Button systems:** competing ad-hoc class systems (`.admin-btn`, `.ss-btn`, `.submit-button`, `.btn-primary`, `.event-page__btn`) — folded into [P2-6].
- **Routing:** no orphaned admin routes; all dynamic route references resolve.

---

## 3. Executive Summary

**Health score: 11/20 (Acceptable).** Issue counts: **P0: 0 · P1: 7 · P2: 9 · P3: 8.**

The platform's core surfaces are in good shape: every audited route renders without horizontal overflow at all three viewports, keyboard focus is visible and logically ordered everywhere tested, destructive admin actions are dialog-gated with focus trapping, and the EventDetailPage **structural divergence from the approved handoff is resolved** (see §4, finding [P1-5] context and §6). The score is dragged down by (a) a cluster of computed WCAG-AA contrast failures — one catastrophically bad (1.32:1) — caused by hardcoded off-token colors, (b) three main-nav destinations that ship a generic "Work in Progress" placeholder as if they were real product pages, and (c) a local migration chain that cannot run the public flow at all.

**Top critical issues:**

1. **[P1-1]** Related-events date-chip badges are near-unreadable: gold background with the light `--text` foreground (1.32:1) and rose background with dark foreground (3.49:1).
2. **[P1-6]** `/lessons`, `/instructors`, `/schools` are placeholder pages linked from the main nav — the single largest implementation-integrity failure.
3. **[P1-7]** Local schema drift: `supabase/migrations/` is missing `taxonomy_terms`, `event_taxonomy_terms`, `platform_settings`, `venues` — fresh local stacks 400/404 on the homepage, calendar, event detail, and submit gate.
4. **[P1-2]** Header CTA buttons ("Submit Event", "Sign In", "BOS" city chip) fail AA at 3.64:1 on every public page — the most visible systemic contrast failure.
5. **[P1-4]** `/founders` + `/founders/accept` logo link renders browser-default blue on navy (1.83:1) — missing `color` on `.founders-logo`/`.founders-accept-logo`.

**Next steps:** fix the two token-level color bugs (badge + founders logo), decide ship-or-remove for the three WIP nav pages, execute the already-approved SQL consolidation plan to close the local drift, then run a contrast-token sweep (`/impeccable colorize`) and finish with `/impeccable polish`.

---

## 4. Detailed Findings by Severity

### P1 — Major / WCAG-AA violations

**[P1-1] Related-events date-chip badges fail contrast catastrophically**
- **Location:** `src/components/Events/RelatedEventsStrip.css:51-68` (`.related-events-strip__badge`, `--class`, `--workshop` variants); visible on `/events/:id` ("More this week" strip), all viewports.
- **Category:** Accessibility / Theming
- **Impact:** "Class" chips render `color: var(--text)` (#dae2fd, light) on `background: var(--gold)` (#e9c349) → **1.32:1**; "Social" chips render `var(--surface-high)` (dark navy) on `var(--red)` (#e11d48) → **3.49:1**. Both fail AA (4.5:1) at 9.9–16px text. The class chip is effectively unreadable.
- **Standard:** WCAG 2.1 SC 1.4.3 (Contrast Minimum).
- **Recommendation:** Use `--admin`-style dark ink on gold (e.g. `#1b1b2e` on #e9c349 ≈ 9:1) and white on rose with a darker rose (or bump text size/weight for 3:1 large-text compliance). Derive from tokens, not ad-hoc hex.
- **Suggested command:** `/impeccable colorize`

**[P1-2] Header CTA buttons and city chip fail AA on every page**
- **Location:** Public header (`src/components/Header/Header.css` — `.auth-btn`, `.city-switch__btn.active`), all public routes, desktop+mobile.
- **Category:** Accessibility
- **Impact:** "Submit Event", "Sign In", "BOS" render `rgb(218,226,253)` on `rgb(225,29,72)` = **3.64:1** at 12px/600 — fails 4.5:1; appears on every page so it defines the site's perceived contrast quality.
- **Standard:** WCAG 2.1 SC 1.4.3.
- **Recommendation:** Darken the rose for solid CTAs (e.g. #be123c → ~5.3:1 with the light text) or use `--gold` backgrounds with dark ink.
- **Suggested command:** `/impeccable colorize`

**[P1-3] Calendar (schedule-x) text fails AA across date headers, time gutter, nav arrows**
- **Location:** `/calendar`, all viewports; `src/components/Calendar/Calendar.tsx:15` imports `@schedule-x/theme-default/dist/index.css` (light theme) against dark overrides in `Calendar.css`.
- **Impact:** List-view date headers ("Thursday, September 3, 2026") `#797478` on `#1d1b20` = **3.75:1** (12px/600); time-gutter labels and ‹ › arrows = **4.08:1**. 10–15 failing text runs per viewport.
- **Standard:** WCAG 2.1 SC 1.4.3.
- **Recommendation:** Override schedule-x CSS variables (`--sx-color-...`) to token-derived values that meet 4.5:1 on the dark surface, or adopt schedule-x's dark theme as the base instead of theme-default.
- **Suggested command:** `/impeccable colorize`

**[P1-4] `/founders` and `/founders/accept` logo link is unstyled browser-default blue**
- **Location:** `src/pages/FoundersPage.css:19-22` and `FoundersAcceptPage.css:16-18` — `.founders-logo` / `.founders-accept-logo` set only `display`/`text-decoration`; no `color`.
- **Impact:** The wordmark renders `rgb(0,0,238)` on navy `rgb(19,27,46)` = **1.83:1** at 16px. Also a brand defect: every other surface renders the logo gold (`SignInPage.css:10-17` does it correctly — copy that).
- **Standard:** WCAG 2.1 SC 1.4.3.
- **Recommendation:** `color: var(--gold-light)` + matching `:focus-visible` outline, mirroring `.auth-logo`.
- **Suggested command:** `/impeccable polish`

**[P1-5] `/contact` has no H1**
- **Location:** `src/pages/ContactPage.tsx` — page opens with `h2 "Ready to Dance?"` then `h3`s ("📬 Send a Message", "Email", "Phone").
- **Category:** Accessibility / SEO (heading architecture)
- **Impact:** Violates the project's own required heading architecture (meaningful H1 per public page); screen readers and crawlers get no page-level topic.
- **Standard:** WCAG 2.1 best practice (page titled/structured); project convention (memory: required H1/H2/H3 architecture).
- **Recommendation:** Promote "Ready to Dance?" (or "Contact") to H1 and demote children accordingly.
- **Suggested command:** `/impeccable clarify`

**[P1-6] Main-nav destinations render generic "Work in Progress" placeholder as real pages**
- **Location:** `src/pages/Lessons.tsx`, `Instructors.tsx`, `Schools.tsx` (all wrap `src/components/WIP/WorkInProgress`); live-verified at `/lessons`, `/instructors`, `/schools`, mobile + desktop; linked from header nav (`src/components/Header/Header.tsx` PRIMARY_LINKS).
- **Category:** Implementation Integrity
- **Impact:** Three of six primary nav items lead to a generic, non-product page ("we are currently working on our new website…") — the strongest possible "template/unfinished site" signal to users and crawlers, contradicting the rest of the product's authored quality. Also: `/schools` is additionally orphaned (no nav/footer link), and 5 unrouted 0-byte files sit in `src/pages/Schools/`.
- **Recommendation:** Either ship minimal real directory content or remove the three nav entries until the person/profile model (sub-project 3) lands; delete the 0-byte Schools files.
- **Suggested command:** `/impeccable distill` (remove) or `/impeccable onboard` (build minimal real pages)

**[P1-7] Local migration chain cannot run the public flow (schema drift vs production)**
- **Location:** `supabase/migrations/` (missing Phase-9/10/11 objects) vs `src/features/events/api/eventsRepo.ts:54-108` (embeds `event_taxonomy_terms(...)` in every read) and `SubmitEventPage`'s `public_event_suggestions_enabled()` RPC (defined in `supabase/reconcile-prod-schema.sql:1625`, `sql/phase-10/*`).
- **Category:** Implementation Integrity / DX
- **Impact:** On a fresh local stack, `/`, `/calendar`, `/events/:id` throw PostgREST 400 and render error states, and `/submit` hard-disables ("Event submissions are currently unavailable"). Local verification of the product's core flow is impossible without hand-applying operational SQL (as this audit had to). Not a production bug — production has the objects.
- **Recommendation:** Execute the approved consolidation plan (`docs/superpowers/plans/2026-08-30-sql-current-state-consolidation.md`) so `supabase/migrations/` converges with production.
- **Suggested command:** `/impeccable harden`

### P2 — Minor with workaround

**[P2-1] Touch targets under 44×44px on mobile**
- **Location:** Footer links 19px (`Footer.css`), calendar controls (‹ Today ›) 38px, "Send Message" 42px inputs/buttons on `/contact`, secondary sign-in buttons 24–36px ("Sign up", "Forgot password?", "Show password" 36px), founders "Company website" input 19px tall. Mobile 375px.
- **Category:** Responsive / Accessibility
- **Impact:** Fails WCAG 2.5.8 target-size guidance and iOS HIG 44pt; mis-taps on phone.
- **Recommendation:** Floor interactive elements at 44px hit areas (padding, not layout, can stay compact). Note the mobile nav drawer already does this correctly (`Header.css:375-380` `min-height: 44px`) — extend the same discipline outward.
- **Suggested command:** `/impeccable layout`

**[P2-2] `role="tab"` used without `tablist`/`aria-controls`/`tabpanel` on EventDetailPage**
- **Location:** `src/pages/EventDetailPage.tsx:192-214` — two `role="tab"` buttons inside a plain `<nav>`; panels have no `role="tabpanel"`/`aria-controls`; no roving tabindex.
- **Category:** Accessibility
- **Impact:** Announces a tab pattern to AT that then behaves incompletely (no panel relationship, no arrow-key semantics). Notably the admin surface does this correctly (`AdminViewTabs.tsx:52-64`: `role="tablist"`, `aria-controls`, roving `tabIndex`) — an internal inconsistency.
- **Standard:** WAI-ARIA Authoring Practices (Tabs).
- **Recommendation:** Either complete the pattern (copy AdminViewTabs) or drop `role="tab"`/`aria-selected` for `aria-pressed` toggle buttons.
- **Suggested command:** `/impeccable harden`

**[P2-3] Destructive-action confirmation inconsistencies in the tags/taxonomy section**
- **Location:** `src/pages/AdminTagsPage.tsx:164-165` — list-page Delete calls `remove.mutate(id)` directly (one click; only guarded by `disabled` when `usage_count > 0`); `src/pages/AdminTaxonomyDetailPage.tsx:24-30` uses native `window.confirm`.
- **Category:** Implementation Integrity / UX safety
- **Impact:** Breaks the repo's own enforced "not one-click table actions — every mutation opens a dialog" rule (AdminEventsPage/Users/OrganizerRequests all comply via `AdminConfirmDialog` with focus trap, Escape, cancel-first). `window.confirm` is also inaccessible to the app's dialog a11y standard.
- **Recommendation:** Route both through `AdminConfirmDialog`.
- **Suggested command:** `/impeccable harden`

**[P2-4] Public forms rely on native browser validation bubbles**
- **Location:** `/submit` manual form and `/contact` — empty submits produce zero `role="alert"`/custom error elements; only `:invalid` native constraint validation (5 invalid fields each, verified by interaction test).
- **Category:** Accessibility / Consistency
- **Impact:** Native bubbles are inconsistently announced by screen readers and visually off-brand; the admin surface uses inline `role="alert"` field errors everywhere — inconsistent standards between surfaces.
- **Recommendation:** Add inline, announced field errors on the two public forms (the labels and markup are already in place).
- **Suggested command:** `/impeccable harden`

**[P2-5] schedule-x default light theme imported against dark site**
- **Location:** `src/components/Calendar/Calendar.tsx:15` (`@schedule-x/theme-default/dist/index.css`) + partial overrides in `Calendar.css`.
- **Category:** Theming / Performance
- **Impact:** Ships the entire light theme CSS then re-overrides it; leftover un-overridden tokens are the direct cause of [P1-3]; fragile seam that will silently regress on schedule-x upgrades.
- **Recommendation:** Start from schedule-x's dark theme (or a token-mapped custom theme) and override only brand tokens.
- **Suggested command:** `/impeccable colorize`

**[P2-6] Competing button class systems across surfaces**
- **Location:** `.btn-primary`/`.btn-secondary` (public forms), `.event-page__btn*` (EventDetailPage), `.ss-btn*` (handoff bridge, `design/handoff/styles/theme.css` → `src/styles/handoff-bridge.css`), `.admin-btn*` (admin shell), `.submit-button` (submit page), `.founders-accept-home` etc. Confirmed by both audit halves.
- **Category:** Theming / Consistency
- **Impact:** Four+ ad-hoc systems for the same concept; each new page invents its own; contrast fixes must be repeated per system (which is exactly how [P1-2] happened).
- **Recommendation:** One public button primitive (the `ss-btn` bridge already exists — adopt it), keep `admin-btn` as the deliberately separate admin system.
- **Suggested command:** `/impeccable distill`

**[P2-7] Thousands of hardcoded hex colors bypass the token layer**
- **Location:** Component CSS throughout `src/` (static worker count: thousands of occurrences outside `global.css`/`admin.css`/`theme.css` tokens); concrete live symptoms: [P1-1], [P1-4].
- **Category:** Theming
- **Impact:** No single place to fix color/contrast; dark-mode and future theming are impractical; audit fixes whack-a-mole.
- **Recommendation:** Token sweep — replace raw hex with `var(--*)` references; enforce via stylelint declaration strictness.
- **Suggested command:** `/impeccable colorize`

**[P2-8] Host sidebar lacks entry points to most host features**
- **Location:** `src/components/Admin/AdminSidebar.tsx:47-121` — organizer role sees only "Host Dashboard" and "My Events"; New Event / Import / Attendees / Check-in are reachable only via in-page links.
- **Category:** UX (Nielsen: visibility of system status / navigation)
- **Impact:** Feature discoverability suffers; the host surface's deepest tools (check-in, attendee lists) are 3+ clicks deep with no nav memory.
- **Recommendation:** Add "New Event" and "Import" items to the organizer nav (or a Host section group).
- **Suggested command:** `/impeccable layout`

**[P2-9] Host workspace is an admin shell with host-labeled copy**
- **Location:** `src/layouts/AdminLayout.tsx` + `src/pages/Host*` — host pages reuse `AdminMetricCard`, `AdminPageHeader`, `AdminStatusBadge`, the `admin-shell` class system and its light SaaS aesthetic (static + code review; browser verification blocked by credentials).
- **Category:** Theming / Verbal branding
- **Impact:** The verbal boundary is handled correctly (breadcrumb "Host · My Events", sidebar "Host Dashboard", role prefix suppressed on host routes — verified in code at `AdminLayout.tsx:74-79`), but visually `/host/*` is indistinguishable from `/admin/*`. Per project memory the shared shell is an intentional decision, so this is a judgment note, not a defect: if organizer-branded feel is desired later, the seam to change is the shell wrapper, not each page.
- **Recommendation:** Decide explicitly whether host deserves a distinct skin; if not, no action.
- **Suggested command:** `/impeccable adapt` (if re-skining is wanted)

### P3 — Polish / no real impact

**[P3-1] `/host/events/import` breadcrumb mislabeled "Host · Event Details"** — `AdminLayout.tsx:33-44`: the `startsWith("/host/events/")` catch-all swallows the import route (which has no `SECTION_LABEL` entry). One-line map addition.

**[P3-2] Two H1 elements on `/signin`** ("Your city. Your rhythm. Your calendar." + "Welcome back"). Multiple H1s are permitted in HTML5 document outline practice but the project convention is one meaningful H1 per page; the marketing line could be a `p`.

**[P3-3] Emoji embedded in headings and CTAs** — "📬 Send a Message" (`ContactPage`), "🏠 Back to Home" (`NotFoundPage`). Screen readers announce the emoji names; decorative glyphs should be `aria-hidden` spans or dropped.

**[P3-4] Decorative "◆" section-label glyph fails contrast** — 8.8–12.8px `--red` on navy = 3.94:1 (home/about). Decorative and arguably exempt, but it's a real text node; make it `aria-hidden` and/or pull color from a token that passes.

**[P3-5] Focus-ring color inconsistency** — default gold `rgb(255,224,136)` vs red-bright `rgb(255,88,116)` on primary buttons and the founders page. Two focus colors in one design system.

**[P3-6] `/founders` uses a slightly different navy** (`rgb(19,27,46)` vs public `rgb(11,19,38)`) — off-token page background; hardcodes rather than `var(--surface)`.

**[P3-7] Calendar page H1 is only "September 2026"** — no page title/context ("Calendar" or "Boston dance calendar"); the only heading on the page.

**[P3-8] Remote picsum card images unsized/unoptimized** — homepage cards load 800×600 remote images without explicit dimensions/srcset (CLS + LCP risk in production; dev-server metrics don't capture this). Known Core-Web-Vitals workstream gap.

### Verification of the prior "EventDetailPage structural divergence" report

**Verdict: RESOLVED for structure; residual gaps are deliberate, documented feature deferrals — not drift.** Evidence: the live page (`src/pages/EventDetailPage.tsx:128-332`, verified rendering at all viewports) implements the approved handoff's (`design/handoff/pages/EventDetailPage-v2.tsx`) exact skeleton — cover → action strip (date chip + price/address) → About/Album tabs → two-column about with sidebar (host card, Where card, Share card) → album. Differences are all in the direction of *real functionality over speculative UI*: handoff's fake "I'm going"/"Save" buttons are replaced by a real RSVP link + ICS "Add to calendar" (RSVP/"I'm going" is dependency-ordered sub-project 4); handoff's lineup section, host profile links, class-facts grid, and tiered photo album/upload map to unbuilt sub-projects 2/3/5 (schema additions pending); and the live page adds things the handoff lacked — real flyer cover image, RelatedEventsStrip (built Aug 25, spec-approved), external map link, working Copy-link/Instagram/WhatsApp share. Token consistency with the handoff is maintained via `src/styles/handoff-bridge.css`. The one place the live page is *worse* than the handoff's intent is the incomplete ARIA tab pattern ([P2-2]) — though it is still better than the handoff's own `aria-pressed` tabs.

---

## 5. Patterns & Systemic Issues

1. **Hardcoded colors as the root cause of the contrast cluster.** Every P1 contrast failure traces to an ad-hoc color pairing (`--text` on gold, light indigo on rose, default blue on navy, schedule-x grays on dark). The token layer exists and is good — it's simply bypassed at the point of use, in thousands of places (confirmed by both audit halves independently).
2. **Surface-local component vocabularies.** Each page family invents its own buttons/badges/chips (`event-page__*`, `ss-*`, `btn-*`, `admin-*`, `founders-*`). The admin system is disciplined *within* itself; the public site is not.
3. **The a11y "correct pattern" exists in-repo but doesn't propagate.** Full ARIA tabs (AdminViewTabs), dialog confirmations (AdminConfirmDialog), announced inline errors (admin forms) — all built correctly on the admin side, all absent or partial on the public side (event tabs, tags delete, submit/contact validation).
4. **Schema truth lives in operational SQL, not migrations.** Production-parity objects (taxonomy, venues, platform settings) are delivered as manually-run scripts; the repo's own migration chain undersells the app's needs. The consolidation plan is approved but unexecuted — until it lands, every fresh local stack fails the public flow ([P1-7]).
5. **Placeholder debt at the edges.** The WIP pages + 0-byte Schools files are the visible tip; `/schools` being nav-orphaned shows nav and route inventory have drifted apart.
6. **Static worker corroboration:** massive hardcoded-hex usage, thin admin/host visual boundary, and multiple button systems were independently found by the grep-based pass — the two halves of this audit converge on the same systemic causes.

---

## 6. Positive Findings

- **Responsive discipline is genuinely strong:** zero horizontal overflow across 12 routes × 3 viewports (measured, not eyeballed), and the calendar's mobile→list-view / desktop→month-grid switch is a textbook responsive pattern (with media-query unsubscription tested in the suite).
- **Keyboard support is real:** visible focus outlines on every interactive element tested across all pages (2px gold rings), logical tab order on the sign-in flow, `:focus-visible` used (not just `:focus`), Escape closes the mobile drawer and admin dialogs, mobile nav links floored at 44px.
- **Destructive-action safety on the admin surface is exemplary:** every event/user/organizer/submission mutation opens `AdminConfirmDialog` (focus-trapped, Escape-dismissible, cancel-first focus, busy states, inline `role="alert"` errors that keep the dialog open), with consequence copy per action — verified across `AdminEventsPage`, `AdminUsersPage`, `AdminUserDetailPage`, `AdminOrganizerRequests(Page|Detail)`, `AdminSettingsPage`.
- **State design maturity:** loading skeletons (`aria-hidden` + `aria-busy` + `role="status"`), error banners with retry, empty states with contextual CTAs ("No events match this filter" + Submit link; album "No photos yet."), and graceful branded recovery on all three token-gated routes (`/auth/callback`, `/auth/invite`, `/founders/accept`) with resend-confirmation loops.
- **Truthful capability UI:** the admin account menu renders deferred features as inert rows rather than fake controls; the submit page hard-disables when the platform gate is off rather than failing later.
- **EventDetailPage handoff integration succeeded:** structure resolved (see §4 verdict), token bridge in place, live page adds real share/ICS/map/related-events functionality beyond the handoff.
- **Auth/role architecture holds in the UI:** nav and routes gate on trusted `app_metadata.role` only; organizers get host-labeled navigation; the sidebar correctly grants admins moderator-scoped items.
- **Fast loads:** route-level `lazy()` + Suspense, DCL ~352ms in dev, no slow resources, no console errors on any page after the local schema mirror.

---

## 7. Recommended Actions (priority order)

1. **Fix the two token-level color bugs** — RelatedEventsStrip badge colors ([P1-1]) and the founders logo link color ([P1-4]). Both are one-file fixes with outsized visibility. — `/impeccable colorize`
2. **Decide ship-or-remove for `/lessons`, `/instructors`, `/schools`** — either minimal real directory pages or remove the nav entries and delete the 0-byte Schools files ([P1-6]). — `/impeccable distill`
3. **Execute the approved SQL consolidation plan** so `supabase/migrations/` matches production and fresh local stacks run the public flow ([P1-7]). — `/impeccable harden`
4. **Run a contrast token sweep on the public surface** — header CTAs, calendar schedule-x variables, and the "◆" glyph ([P1-2], [P1-3], [P3-4]); introduce a stylelint rule banning raw hex outside token files ([P2-7]). — `/impeccable colorize`
5. **Promote a `/contact` H1** and complete (or simplify) the event-page tab ARIA pattern ([P1-5], [P2-2]). — `/impeccable clarify`
6. **Unify destructive-action dialogs** in the tags section and add announced inline errors to the two public forms ([P2-3], [P2-4]). — `/impeccable harden`
7. **Raise sub-44px touch targets** in footer/calendar/contact/sign-in/founders ([P2-1]). — `/impeccable layout`
8. **Consolidate the public button primitive** on the existing `ss-btn` bridge ([P2-6]) and add host nav entry points for New Event/Import ([P2-8]). — `/impeccable distill`
9. Finish with **`/impeccable polish`** for the P3 tier (breadcrumb label, dual H1, emoji-in-headings, focus-color unification, calendar H1, image sizing).

---

*Audit performed 2026-09-01 by ux-audit-live (live browser + design judgment) with findings folded in from ux-audit-static (static/grep analysis). Environment restored after audit: dev server stopped, local Supabase stack stopped, `supabase/config.toml` and `.env.local` restored from backups; sibling Bellocampo stack untouched and verified running throughout.*

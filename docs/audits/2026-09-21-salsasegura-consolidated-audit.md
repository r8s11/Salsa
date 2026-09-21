# Consolidated Audit — Salsa Segura

**Date:** 2026-09-21
**Supersedes and replaces:** the 2026-09-20 impeccable + homepage audits and the four 2026-09-21 audits (awwwards, awwwards re-audit, emil design, impeccable, module depth). Those files are deleted; this is the single record.
**Sources merged:** `$impeccable audit` (5 dimensions, detector + 4 scouts + browser measurement), `emil-design-eng` motion review ×2, `build-awwwards-quality-sites` §1–7 ×2, `coding-standards`, `codebase-design` module-depth pass, and the 2026-09-20 pair.
**Method:** production build, bundled detector over `src/` (259 candidates), four read-only source scouts, graft structural queries, and first-party browser measurement at 375×812 / 1440×900 including computed contrast, touch-target geometry, and hero layout boxes.

---

## Health score

| #   | Dimension                | Score     | Principal finding                                                          |
| --- | ------------------------ | --------- | -------------------------------------------------------------------------- |
| 1   | Accessibility            | 2/4       | Dark-mode action-button labels measure 1.90:1; ticker has no pause control |
| 2   | Performance              | 3/4       | 2.9 MB flyer fallback on 11 call sites                                     |
| 3   | Responsive design        | 2/4       | Four operator controls measured at 28–36px                                 |
| 4   | Theming                  | 3/4       | Two host pages hard-code light-mode hex and break dark mode                |
| 5   | Implementation integrity | 3/4       | Coherent two-world system; drift concentrated in 2 of 121 files            |
|     | **Total**                | **13/20** | **Acceptable — significant work needed**                                   |

Down from the standalone impeccable score of 14/20, because merging yesterday's measured dark-mode contrast failures and the WCAG 2.2.2 ticker violation lowers Accessibility from 3 to 2.

**Issue count: 1 P0, 13 P1, 14 P2, 5 P3.** Seven previously reported findings are dismissed as verified false positives (§ Dismissed).

---

## Integrity verdict

**Pass.** `DESIGN.md` declares two deliberately separated worlds — public "Ritmo Vivo" and the operator "Listings Desk" — and the code honors the split: `src/components/Desk/desk.css` declares its own state tokens, scopes them under `.admin-shell` and `[data-theme="dark"] .desk`, and uses no cards or shadows per its own no-cards law. `admin.css` carries complete light and dark sets. ~90% of 121 CSS files consume tokens cleanly. The hero concept — a vinyl whose label carries the next event's title on a curved `textPath` — is specific to this product and could not be lifted onto another site. This is not interchangeable scaffolding.

---

## P0

### 1. The hero's focal object is invisible unless you request reduced motion

- **Location:** `src/components/Hero/Hero.css:23-33` (centering) vs `:599-613` (`heroEnter`) and `:621-624`
- **Category:** Art direction / Implementation
- **Measured, 2026-09-21:**

| Condition                    | Computed transform               | x    | Visible width |
| ---------------------------- | -------------------------------- | ---- | ------------- |
| Desktop 1440, normal motion  | `matrix(1, 0, 0, 1, 0, 0)`       | 1440 | **0 px**      |
| Mobile 375, normal motion    | `matrix(1, 0, 0, 1, 0, 0)`       | 375  | **0 px**      |
| Desktop 1440, reduced motion | `matrix(1, 0, 0, 1, -560, -560)` | 880  | 560 px        |

- **Cause:** `.hero-vinyl` centers itself with `transform: translate(-50%, -50%)`. `.hero-enter` animates `transform` with `fill: both`, so the animated value wins and the centering is discarded. The code comments at `:619-620` recognize the hazard and try to defuse it by setting `--hero-enter-y: 0px` — but `translateY(0)` is still a `transform` and still overwrites `translate(-50%,-50%)`. The mitigation does not work.
- **Impact:** every visitor without `prefers-reduced-motion` sees an empty right half of the hero. The site's single strongest authored moment ships only to the users who asked for less motion. This inverts the intent of the reduced-motion rule at `:458-460`, which is the only thing restoring correct layout.
- **Fix:** animate `opacity` only on the vinyl — give `.hero-enter[data-enter="vinyl"]` its own keyframe that never touches `transform` — or move the entrance to a wrapper element that does not own the centering transform.
- **Command:** `$impeccable polish`
- **Provenance:** first reported 2026-09-20; the attempted fix is ineffective; re-measured and confirmed today.

---

## P1

### 2. Dark-mode action-button labels fail contrast

`src/styles/admin.css:85, :91, :92, :216, :231`, consumed at `AdminConfirmDialog.tsx:127`. White label on dark danger fill `#f87171` = **2.77:1**; danger hover `#fca5a5` = **1.90:1**; primary hover `#f43f5e` = **3.67:1**. Bright _text-role_ colors are being reused as solid _fills_. WCAG 1.4.3 AA. Separate foreground tokens from action-background tokens. → `$impeccable colorize`

### 3. Activity identifiers use an insufficient-contrast token

`AdminActivityTable.css:92`, rendered at `AdminActivityTable.tsx:101`. `--admin-text-subtle` at 12px: light `#94a3b8` on white = **2.56:1**; dark `#64748b` on `#171a20` = **3.66:1**. These are record identifiers an operator reads character by character, not a disabled control. WCAG 1.4.3 AA. → `$impeccable colorize`

### 4. Event ticker scrolls indefinitely with no pause control

`Hero.tsx:193`, `Hero.css:382`, `:454`. `heroMarquee 34s linear infinite` with no pause/stop/hide mechanism. `aria-hidden` prevents duplicate announcement but does nothing for sighted users distracted while reading. **WCAG 2.2.2 Pause, Stop, Hide (Level A)** — the only Level-A failure in this report. → `$impeccable harden`

### 5. "Featured Tonight" is not tonight

`Events.tsx:36` selects `upcomingEvents[0]` — the next future event at any date — and `:84` labels it "◆ Featured Tonight". A November event can be labeled tonight in September. Truthfulness defect, not a styling one. Either apply a real tonight window or relabel to "Next up". → `$impeccable clarify`

### 6. 2.9 MB fallback banner on 11 call sites

`public/images/default-event-banner.png` via `resolveEventFlyer()` at `EventCard.tsx:57`, `FeaturedEventCard.tsx:61`, `eventModalImage.ts:3`, `EventModal.tsx:373`, `EventDetailPage.tsx:189`, `AdminEventsTable.tsx:244`, `AdminSubmissionsTable.tsx:38`, `Galley.tsx:81`, `HostEventDetailPage.tsx:370`, `CalendarListView.tsx:67`, `ProfilePage.tsx:68`. Ten flyer-less events ≈ 29 MB of placeholder. Re-encode to WebP at display size (`cwebp` and `sips` are both available). → `$impeccable optimize`

### 7. Four dialogs bypass the shared accessible-dialog hook

`AdminLayout.tsx:111-117`, `AccountPage.tsx:143-183`, `AccountDeletionDialog.tsx:72-115`, `InstagramStoryShare.tsx:195-220`. All declare `role="dialog"` + `aria-modal="true"`, promising assistive technology the background is unreachable; none wires `useAccessibleDialog`, so focus escapes, the background is not inert, and body scroll is not locked. `AccountDeletionDialog` is account deletion. WCAG 2.1.2 / 4.1.2. The hook is already used correctly by ~21 components. → `$impeccable harden`

### 8. Destructive control measures 28×28 px

`HostAttendeeListPage.css:240-241`. `.attendee-action-btn` removes an attendee; measured 28×28 at 375px with no `@media (pointer: coarse)` override, on the one screen an organizer uses on a phone at a venue door. → `$impeccable adapt`

### 9. Three more operator controls below 44 px

Measured at 375px: analytics pill **107×28** (`AdminAnalyticsFilters.css:21`), check-in method button **73×31** (`HostCheckInPage.css:89`), host filter **92×36** (`HostMyEventsPage.css:82`). The correct `@media (pointer: coarse) { min-height: 44px }` pattern already exists in six other files. → `$impeccable adapt`

### 10. Two host pages break dark mode

`HostCheckInPage.css` (31 color literals, 30 hex) and `HostAttendeeListPage.css` (55 literals, 53 hex) hard-code `#ffffff`, `#0f172a`, `#64748b`, `#e2e8f0`, `#f8fafc`, `#f1f5f9`, `#94a3b8` — each an exact light-mode token value — while rendering inside `.admin-shell`, which ships a full dark theme. Siblings `HostMyEventsPage.css` and `HostOrganizationPage.css` use `--admin-*` correctly, so this is regression, not decision. → `$impeccable colorize`

### 11. `--red` as text measures 3.94:1

`AboutPage.css:59` (at `font-size: 0.55rem` ≈ 8.8px) and `FounderRequestForm.css:58`. Measured over composited backgrounds: `--red` on `--bg` = 3.94:1, on `--card` = 3.22:1, on `--card-hover` = 2.83:1. `--red-bright` measures 6.08:1 and is the correct text token; `--red` stays a fill/border. WCAG 1.4.3 AA. → `$impeccable colorize`

### 12. Hero grid animates a non-composited property forever

`Hero.css:253-256`. `background-position` on an infinite loop with `will-change: background-position` — not compositor-accelerated, so it repaints above the fold for the whole session, and the `will-change` reserves memory for a hint that cannot be honored. Animate `transform: translate3d()` on an oversized pseudo-element. → `$impeccable optimize`

### 13. Repo tests cross the wrong seam

26 test files `vi.mock("…/lib/supabase")` and hand-build a fluent fake (`submissionsRepo.test.ts:12-29` is representative). Production callers cross the repo interface; tests reach past it onto Supabase's chain, so Supabase's interface leaks into 26 files and locality is lost. It shows in the assertions: `submissionsRepo.test.ts:34` asserts `supabase.from` was called with `"event_submissions"` — a table rename breaks it while behavior is unchanged, and a wrong `.eq()` column still passes because every builder method is `mockReturnThis`. **Fix with one shared `createSupabaseStub(tables)` that actually applies filters, not dependency injection** — there is one adapter, so the seam is hypothetical and threading a client parameter through every repo buys nothing. → `$impeccable harden`

### 14. No final CTA and no contact form

The homepage ends on the weekly feed and drops into the footer; `/contact` offers links only. Both are named requirements of the quality bar, and for a discovery product the closing ask writes itself (submit an event, or subscribe to the week). → `$impeccable onboard`

---

## P2

| #   | Finding                                                            | Location                                                                                            | Note                                                                                                                                                                           |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 15  | Reduced motion leaves smooth scrolling and pointer parallax active | `global.css:117` (`scroll-behavior: smooth`, no override anywhere in `src/`); `Hero.tsx:80-102`     | Parallax is gated on pointer type only, never on motion preference                                                                                                             |
| 16  | Tablist arrow keys are not directional                             | `EventDetailPage.tsx:255-260`, `:285-290`                                                           | Both arrows call the same `focusTab`; operable, so not P1. ARIA APG Tabs                                                                                                       |
| 17  | `--text-dim` fails contrast on hovered cards                       | token pair                                                                                          | 5.85:1 on `--bg`, 4.78:1 on `--card`, **4.21:1 on `--card-hover`** — passes at rest, fails on hover                                                                            |
| 18  | ~15 meaningful images carry `alt=""`                               | `EventCard.tsx:57`, `EventDetailPage.tsx:188`, `Galley.tsx:80`, `ProfilePage.tsx:167,193`, +10      | Flyers carry lineup, price, dress code found nowhere else. WCAG 1.1.1                                                                                                          |
| 19  | 18+ images without `loading="lazy"` or intrinsic dimensions        | `FeaturedEventCard.tsx:61`, `Galley.tsx:81`, +16                                                    | Off-screen downloads plus layout shift                                                                                                                                         |
| 20  | Initials tile as avatar fallback                                   | `ProfilePage.tsx:204-207`                                                                           | The asset rule bans initials, illustrated heads, and silhouettes for avatars                                                                                                   |
| 21  | Featured flyer uses a CSS background with no failure recovery      | `FeaturedEventCard.tsx:54`                                                                          | Ordinary cards already recover at `EventCard.tsx:62`; the featured one does not                                                                                                |
| 22  | No `<noscript>` content                                            | `index.html`                                                                                        | Empty app mount; fails the static-first-frame requirement                                                                                                                      |
| 23  | Toast is keyframed, has no exit, and ignores tab visibility        | `AdminToast.css:17`, `AdminToast.tsx:28-31`                                                         | Keyframes restart from zero when a second toast lands; hover pause exists but `visibilitychange` does not                                                                      |
| 24  | Desk row-exit animates layout properties                           | `desk.css:567-596`                                                                                  | `max-height`, `padding-top`, `padding-bottom` — layout→paint every frame, on the desk's most frequent action                                                                   |
| 25  | `transition: left` on the settings switch knob                     | `ProfileEditPage.css:382`                                                                           | Layout property on the one control whose job is to feel instant                                                                                                                |
| 26  | `AdminSubmissionsPage` recomputes derived lists every render       | `AdminSubmissionsPage.tsx:53`                                                                       | Every sibling admin page memoizes                                                                                                                                              |
| 27  | Four `border-left` side-tabs                                       | `AdminActivityTable.css:79,143`, `AdminVenueForm.css:12`, `AdminOrganizerRequestDetailPage.css:187` | 2–3px colored side borders; conflicts with the desk's own One-Device Rule                                                                                                      |
| 28  | Two state colours used decoratively                                | `ProfileEditPage.css:454` (`#b91c1c` = killed), `OnboardingPage.css:138` (`#34d399` = set)          | `DESIGN.md`: "These five never decorate"                                                                                                                                       |
| 29  | `submissionsRepo` presents two interfaces                          | `submissionsRepo.ts:134-171`                                                                        | Six free functions plus an object that re-exports two of them; test imports both at `:2-9`                                                                                     |
| 30  | Per-page metadata is 1-of-5                                        | `useDocumentMeta.ts`, used only at `Calendar.tsx:238`                                               | `/about`, `/contact`, `/submit` inherit the homepage title and description                                                                                                     |
| 31  | Admin tables and dialogs have no mobile styles                     | 33 CSS files with zero `@media`; `AdminEventsTable.css:260` `min-width: 960px`                      | Wide tables do sit in `overflow-x: auto` wrappers, so this is ergonomic, not broken                                                                                            |
| 32  | Mobile hides the hero subtitle                                     | `Hero.css:530`                                                                                      | First-time visitors lose the explanatory line                                                                                                                                  |
| 33  | `eventsRepo` authority invariant is invisible                      | `eventsRepo.ts`                                                                                     | `deleteEvent` vs `deleteEventForUser` encode a real RLS boundary carried only by a name suffix. **Do not merge them** — brand the actor parameter so misuse is a compile error |

---

## P3

| #   | Finding                                                    | Location                                                                                           |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 34  | Bouncing lesson icon, `animation: bounce 2s infinite`      | `Lessons.css:45`                                                                                   |
| 35  | Stacked `backdrop-filter` across 18+ simultaneous elements | `global.css:225`, `Header.css:10`, `Events.css:224`, +5 — brand-committed, measure before changing |
| 36  | `temporal-polyfill/global` imported in production paths    | `ProfilePage.tsx:1`, `calendarEvents.ts:1`, `ics.ts:4`                                             |
| 37  | Nine skeleton shimmers run offscreen                       | `desk.css:647`, `Events.css:481`, `admin.css:123`, +6                                              |
| 38  | Entrance durations over the 300 ms UI ceiling              | `Events.css:246` (0.4s), `Hero.css:611` (0.42s) — once-per-load decoration                         |

---

## Dismissed — verified false positives

Recording these so the deleted source audits are not re-cited:

1. **`[PHONE]` placeholder in structured data** — false when written. `index.html:99` reads `"telephone": "+1-978-444-0922"`.
2. **`og-image.jpg` 404** — fixed 2026-09-21; ships at `dist/og-image.jpg`, 1200×630, 149,592 bytes.
3. **"No icon system"** — `lucide-react@1.47` is used throughout and `DESIGN.md` mandates Lucide. The Solar/Iconify preference yields to the brief.
4. **"No pointer interaction in the hero"** — `Hero.tsx:80-102` has gated, cleaned-up mouse parallax.
5. **"No `<img>` elements"** — artifact of auditing a client-rendered page's HTML source; 18+ exist.
6. **"Three `push()` immutability violations"** — every `.push(` in `src/features`, `src/utils`, `src/components/Calendar` builds a local accumulator inside a pure function and returns it (`overviewMetrics.ts:22-26`, `quality.ts:29-50`, `ics.ts:101-109`, `CalendarListView.tsx:21-29`). None mutates caller-owned or shared state.
7. **`outline: none` without a focus replacement** at `SignInForm.css:48` and `forms.css:81` — both files define matching `:focus-visible` rules with a 2px outline six lines below.
8. **`desk.css:824` "global reduced-motion kill-switch"** — scoped to 4 selectors whose animations use `forwards`; `animation: none` would discard the end state and leave decided rows visible. The `0.01ms` form is correct here.
9. **`broken-image` at `account.test.ts:263`** — a test-name string containing `<img src>`, not markup.
10. **`AdminEventsTable` "no mobile scroll wrapper"** — `AdminEventsTable.css:3` defines one with `overflow-x: auto`.

---

## Systemic patterns

1. **Two files carry a quarter of all design-system drift.** `HostAttendeeListPage.css` (41 detector findings) and `HostCheckInPage.css` (19) out of 253 across 121 files — and they also own the dark-mode break and the P0-adjacent 28px control. Fixing those two closes 24% of drift, one theming P1, and one responsive P1 at once.
2. **Bright text-role colors are being reused as solid fills.** Findings 2 and 11 are the same mistake in two themes: a token tuned for text on a dark ground pressed into service as a background.
3. **Touch-target sizing is inconsistent, not absent.** The correct coarse-pointer pattern exists in six files; four controls never got it.
4. **The shared a11y hook is the standard with four holdouts** — and each holdout re-derived a partial, incorrect version, which is the deletion test answering itself.
5. **Images are the weakest asset discipline** — ~15 with `alt=""`, 18+ without `loading`/dimensions, one 2.9 MB fallback, one `background-image` with no recovery.
6. **Animation correctness is high; animation _placement_ is where it fails.** No `ease-in` anywhere, no `scale(0)`, one consistent expo curve, 27 reduced-motion blocks — yet the hero's focal object is destroyed by a transform collision and the desk's most frequent action animates layout properties.

---

## What is working

- **`useAccessibleDialog.ts`** — focus trap, background inert, scroll lock, Escape, and opener-focus restore behind a six-option interface, with three private internal seams, used by ~21 components. The reference deep module in this codebase.
- **Landmarks and form wiring** — `MainLayout.tsx:11-15`; `fieldErrorProps.ts:12-18` wires `aria-invalid` + `aria-describedby`; `FormFieldError.tsx:20` uses `role="alert"`.
- **Measured contrast is strong where exercised** — zero failures across 43 rendered elements at both viewports; `--text` 14.34:1, `--text-muted` 10.88:1, `--gold` 10.89:1 on `--bg`.
- **Motion craft** — one house curve `cubic-bezier(0.23, 1, 0.32, 1)`, `scale(0.97)` press feedback on 22 `:active` rules each backed by a base transition, hover gated behind `(hover: hover) and (pointer: fine)`, `linear` on all five spinners.
- **Bundle discipline** — 19 lazily-loaded routes, Supabase in its own chunk, build green in 6.79s.
- **Effect cleanup** — every `addEventListener`, timer, and subscription checked had a teardown.
- **Honest by omission** — no logo wall, no testimonials, no invented partnerships, no fabricated metrics. When there is no honest proof, the site shows none.
- **The desk keeps its own law** — rules and measures, no cards, no shadows, state colour held to state.

---

## Recommended order

1. **[P0] `$impeccable polish`** — fix the hero vinyl transform collision. One rule; restores the site's focal object for ~everyone.
2. **[P1] `$impeccable colorize`** — dark-mode fill tokens, the subtle-text token, host-page tokenization, `--red` → `--red-bright`, `--text-dim` hover. Five findings, one token pass.
3. **[P1] `$impeccable adapt`** — the four measured sub-44px operator controls.
4. **[P1] `$impeccable harden`** — the four hand-rolled dialogs, the ticker pause control, alt text, the shared Supabase test stub.
5. **[P1] `$impeccable clarify`** — "Featured Tonight" truthfulness; error-state copy that does not print `TypeError`.
6. **[P1] `$impeccable optimize`** — 2.9 MB banner, hero-grid repaint, lazy images, `AdminSubmissionsPage` memoization.
7. **[P2] `$impeccable onboard`** — final CTA and contact form.
8. **[P2/P3] `$impeccable polish`** — side-tabs, bouncing icon, desk layout-property exits, toast lifecycle.

---

## Open decisions (not defects)

- **Motion stack.** No GSAP, no Lenis/Locomotive, no ScrollTrigger, no Three.js. Against the awwwards bar this is non-conformance; in context it is defensible — zero smooth-scroll engines cannot conflict, and CSS animation runs off the main thread where ScrollTrigger would drop frames during Supabase fetches. The defect is that the choice is **unrecorded**. Either adopt GSAP on the public marketing path only, or write "CSS-only motion is the committed system" into `DESIGN.md`. Do not retrofit a scroll narrative onto operator tools.
- **Hero imagery.** The hero has no photograph. For a product about people dancing in rooms in Boston, one real art-directed image is the highest-leverage single change available after the P0.
- **Are operator surfaces a supported mobile scene?** 33 CSS files have no `@media` block. Decide and record it; if no, finding 31 closes as out of scope.
- **Client-side rendering.** Landmarks exist in the React tree but `index.html` ships an empty root, so crawlers and no-JS visitors get nothing. Prerendering the five public routes would close findings 22 and 30 together.

---

## Validation performed and limits

**Performed:** `bun run build` (green, 6.79s); detector over `src/` (259 candidates — 125 color, 97 type-size, 29 radius, 4 side-border, 2 grid-background, 1 bounce, 1 image — 6 non-advisory, each read in context); four read-only source scouts; graft repo map and skeletons; browser measurement at 375×812 and 1440×900 of computed contrast over alpha-composited backgrounds, touch-target bounding boxes, and hero layout geometry under both normal and emulated `prefers-reduced-motion`.

**Not performed:** event cards, modal, calendar, and all authenticated admin/host surfaces never rendered — Supabase is unreachable in this environment (`Failed to load events: TypeError: Failed to fetch`), so their contrast came from token pairs and their touch targets from mounting real classes against their own stylesheets, not live paint. No physical-device or synthesized-touch gesture testing, no Lighthouse run, no frame-time profiling, no zoom or full keyboard traversal. Flyer and raster-art licensing was not established; no infringement conclusion is implied. Scores are provisional and no fixes were applied in this audit.

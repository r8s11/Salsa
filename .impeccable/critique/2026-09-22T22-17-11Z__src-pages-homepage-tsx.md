---
target: homepage and menu
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "file:/home/r8s/code/Salsa/src/pages/HomePage.tsx"
target_fingerprint: "sha256:d4ae38e7f6f0ee55845363b4098c456b405abc08bcad8bb2f362a37fdb5ea5ec"
target_path: /home/r8s/code/Salsa/src/pages/HomePage.tsx
timestamp: 2026-09-22T22-17-11Z
slug: src-pages-homepage-tsx
---
# DESIGN HEALTH SCORE

Method note for the archive: dual-agent assessment (A: design review · B: detector evidence); B's browser steps were executed as a parent-browser supplement after its kernel proved browser-less.

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | City switch (pill + drawer cards) changes silently — no `aria-live` announcement anywhere (`FloatingCityPill.tsx:26-39`, `Header.tsx:56-81`) |
| 2 | Match System / Real World | 4 | Dancer vocabulary throughout ("Tonight on the floor", "This Week's Floor"); club-listings meta format matches the printed-listing metaphor |
| 3 | User Control and Freedom | 2 | No undo/back story for city switch; dual navigation mental model (MobileTabBar vs header drawer); keyboard nav and `aria-current` claims partially refuted by source (`NavLink` auto-`aria-current`; `MobileTabBar.css:86` focus ring) — real gap is content, not a11y plumbing |
| 4 | Consistency and Standards | 4 | Ritmo Vivo palette/typography applied consistently at UI scale; numbered rail (`Header.tsx:100-106`) is system-native |
| 5 | Error Prevention | 2 | Filter row has no clear/reset affordance (`Events.tsx:13-18`); empty state routes users off-site to Instagram (`Events.tsx:105-110`); no guard against a dead city context |
| 6 | Recognition Rather Than Recall | 4 | Icon+label tabs, "Featured Tonight" eyebrow, `location · time` meta all name their meaning |
| 7 | Flexibility and Efficiency | 2 | Power path split across tab bar and drawer; submission action absent from the tab bar; no shortcuts |
| 8 | Aesthetic and Minimalist Design | 4 | Strong authored atmosphere (vinyl disc, display band, glass rules); interior of the menu drawer is the one composition failure (dead vertical void) |
| 9 | Error Recovery | 2 | Events error state offers reload only, filter state lost (`Events.tsx:62-76`) |
| 10 | Help and Documentation | 3 | No contextual help on city switch or event-type filters; first-timers must infer "Social/Class/Workshop" |
| **Total** | | **30/40** | **Very Good (upper-mid). Rows sum 30; Assessment A stated 29 — arithmetic slip in its total, recorded as 30.** |

Applicable maximum: 40 (all ten heuristics apply; no n/a).

# DESIGN SPECIFICITY VERDICT

**LLM assessment (A + synthesis):** Authored, not category-interchangeable. The vinyl disc with rotating paper-label print (`Hero.tsx:129-164`; rotation confirmed across two captures), the numbered rail navigation (`Header.tsx:100-106`), and the Ritmo Vivo palette/depth rules are specific to this product; a generic events calendar could not absorb them. City scope (`PRODUCT.md` principle 2) is explicit on every surface (hero eyebrow, `BOS/NYC` pill, drawer city cards). Missed character: the menu drawer's interior composition (dead void between city cards and ACCOUNT) and the tab bar's generic three-icon set underplay the editorial voice used everywhere else.

**Deterministic scan (B):** CLI detector, exit code 0 (advisory), **19 findings**: `design-system-font-size` 12 (Hero.css ×8, Events.css ×3, Header.css ×1), `design-system-color` 6 (Hero.css ×5, Events.css ×1), `codex-grid-background` 1 (Hero.css:244). Locations: `Header.css:428`; `Hero.css:76,151(x2),152,170,177,244,252,298,318,352,548`; `Events.css:94,117,164,315,364`; `HomeCta.css:22`. Read together: the hero executes off the documented ramp and palette — `clamp(3.25rem, 9vw, 8rem)` exceeds DESIGN.md's documented 4.5rem display band; colors `#ef2c58`, `#9c1035`, `rgba(0,0,0,0.6)`, `rgba(124,147,233,0.35)` appear in code but not in DESIGN.md. False positives after adjudication: the 6.6px/3.6px microtext (DESIGN.md exempts vinyl-label artwork lettering from the ramp), bare `#000` ×2 (universal neutral), several `clamp()` endpoints (responsive interpolation), `all-caps-body` (overlines are prescribed uppercase by DESIGN.md), `repeating-stripes-gradient` (branded fallback flyer art), hero glows (prescribed atmosphere).

**Runtime scan (parent supplement):** in-page `detect.js` reported **10 anti-patterns** on the computed page: `low-contrast` ×3 — **3.0:1 (need 4.5:1), #ffffff on #ff5874** on `a.ui-button--primary` (hero "TONIGHT ON THE FLOOR", primary buttons, `.home-cta__btn`); `radial-spotlight-glow` ×3 (`ul#site-navigation.nav-links.active` a0.26 over the drawer, `div.hero-glow`, `div.hero-vinyl__glow`); `dark-glow` (`div.featured-card-date`); `all-caps-body`; `repeating-stripes-gradient`; `codex-grid-background` (agrees with CLI). The three contrast failures are the hard finding: WCAG AA fails on the primary CTA.

**Visual overlays:** injection verified — preflight `{mutated: true, ran: true}`, `detect.js` served from the live-server on :8400, console line `[impeccable] 10 anti-patterns found`, and `.impeccable-overlay.impeccable-visible` + `.impeccable-label` nodes rendered in tab `critique-evidence-m`. The harness browser is headless/shared, so the "present to the user, label [Human]" step is not supported; the overlay existed in that browser session only (since closed).

# OVERALL IMPRESSION

The page has real authorship and a genuine emotional peak — the rotating vinyl label is the kind of detail most local-calendar sites never attempt. What undercuts it is confidence and compliance: with sparse inventory the events grid leaves half a row empty, the empty state invites users to leave the site, and the primary CTA fails contrast at 3.0:1. The menu drawer is the other composition miss — a dead vertical void between the city cards and the ACCOUNT block, with seven competing actions and no content between them. Biggest single opportunity: make "This Week's Floor" prove abundance even on thin weeks (cross-city highlights, next-week tease, prominent full-calendar path) — it converts the product promise ("one place, always on the beat") into visible evidence.

# WHAT'S WORKING

1. **Vinyl disc hero (`Hero.tsx:129-164`)** — authored structural centerpiece; the label's rotating print (verified across two captures) gives the page a physical, rhythmic identity no category template has.
2. **Numbered rail navigation (`Header.tsx:100-106`)** — `01/02/03` with diamond markers turns the menu into an editorial element; it survives even at display scale in the drawer.
3. **City-scoped consistency** — hero eyebrow, `BOS/NYC` pill, and drawer city cards repeat one explicit city model (`PRODUCT.md` principle 2) with matching labels throughout.

# PRIORITY ISSUES

**[P0] Primary buttons fail WCAG contrast — 3.0:1**
- What: `#ffffff` on `#ff5874` at `a.ui-button--primary` (hero "TONIGHT ON THE FLOOR", submit/sign-in primaries, `.home-cta__btn`) — runtime detector, three surfaces.
- Why: AA requires 4.5:1 at this text size; the main conversion CTA is illegible for low-vision users and fails audit on the first screen.
- Fix: darken the button ground toward `#be0037`/`#e11d48` (on-primary-container white already passes at `#e11d48`) or switch button text to `#40000c` on the light rose; verify with the detector after.
- Suggested command: `$impeccable audit`

**[P1] Menu drawer composition + navigation split**
- What: drawer (`Header.tsx:89-241`) stacks 3 rail links + 2 city cards + 2 account actions over a ~380px dead vertical void (verified in capture); `MobileTabBar.tsx:6-29` is a generic three-icon bar with no city context and no submission entry, so the action model is split across two nav surfaces.
- Why: seven competing options with dead space between them reads unfinished; users must hold two navigation mental models to complete one task ("switch city, then find tonight").
- Fix: fill or collapse the void (bottom-anchor the ACCOUNT block with a rule, or fold account actions under the rail); give the tab bar a city marker + submit affordance or state why the bar is intentionally content-only.
- Suggested command: `$impeccable layout`

**[P2] Thin-inventory confidence — sparse grid + off-site empty state**
- What: with 1 featured + 1 grid event the "This Week's Floor" row leaves the right half empty (`Events.tsx:78-139`, verified capture); empty state says "follow @SalsaSegura on Instagram" (`Events.tsx:105-110`) instead of routing to `/calendar`.
- Why: a discovery product's homepage must look bountiful or confidently curated; empty half-rows and exit-ramps make the calendar look dead and leak the visitor.
- Fix: on thin weeks render a "coming up next week / in {other city}" module and make VIEW FULL CALENDAR the empty state's primary action; Instagram stays secondary.
- Suggested command: `$impeccable polish`

**[P3] Silent state changes + all-caps body**
- What: city switch announces nothing (`FloatingCityPill.tsx:26-39`, `Header.tsx:56-81` — `aria-pressed` only, no `aria-live`); the 33-char uppercase span the detector flags is the hero overline (prescribed, keep) but the ticker/labels borrow the same treatment at body lengths.
- Why: screen-reader users get zero feedback that the whole page's city changed; long uppercase runs slow reading.
- Fix: one visually-hidden `aria-live="polite"` region announcing "{City} selected"; cap uppercase to true overlines/labels per DESIGN.md.
- Suggested command: `$impeccable clarify`

**[P3] Code executes off the documented design system**
- What: 12 off-ramp font sizes and 6 undocumented colors (B's CLI), headlined by hero display `clamp(3.25rem, 9vw, 8rem)` vs DESIGN.md's documented 4.5rem display band and ad-hoc `#ef2c58`/`#9c1035`.
- Why: DESIGN.md is the declared visual authority; drift means the next surface built "by the book" won't match the hero it's supposed to share a world with.
- Fix: decide intent — legalize the display band + register the two rose variants in DESIGN.md, or pull the hero onto the documented ramp — then re-run the detector.
- Suggested command: `$impeccable extract`

# PERSONA RED FLAGS

**Jordan (First-Timer)** — find an event this week: lands on hero, hits "TONIGHT ON THE FLOOR" — 3.0:1 contrast makes the primary CTA the hardest text to read on screen (P0). Filter chips "Social/Class/Workshop" have no definitions (H10: 3/4). On a thin week the empty right half of "This Week's Floor" reads as "this site is dead" before the full-calendar link registers.

**Alex (Power User)** — find event, switch city, submit: keyboard nav is real (`NavLink` + focus rings verified) but there are no shortcuts and the submission action lives only in the drawer/header; on mobile "switch city" requires opening the drawer past the dead void. City switch gives no confirmation state change was applied beyond the pill fill.

**Maya (Social Dancer, project persona from `PRODUCT.md` users)** — checks the homepage weekly on the train: wants NYC instead of Boston at scroll 0 — the floating pill (`FloatingCityPill.tsx:6`) waits for 420px of scroll; the drawer's dead void wastes half the screen on a 375px device; no "what's tonight in NYC" answer without switching city and re-scanning.

**Toni (First-Time Organizer, `PRODUCT.md` organizers)** — wants to add a night: only "Submit Event" is visible; the curated-approval promise (`PRODUCT.md` positioning) is never explained at the point of action, so the pending-after-submit state will surprise them.

# MINOR OBSERVATIONS

- Filter row wraps 3+1 at 375px (`Events.tsx:13-18`) — ragged second line; consider 2×2 or scroll-snap row.
- Fixed `MobileTabBar` renders over content mid-scroll (capture artifact of full-page capture, but verify bottom safe-area padding so footer content clears the bar).
- Drawer close restores nothing to focus explicitly (A: `closeNavigation` doesn't move focus back to the hamburger).
- `HomeCta.tsx:4-19` sits outside the glass/depth system the hero establishes; one elevated surface would tie the page's end back to its peak.
- Footer's plain text links miss the gold accent treatment the header buttons use.

# QUESTIONS TO CONSIDER

1. If the vinyl disc is the page's emotional peak, should "This Week's Floor" echo it — a small spinning-label state on the featured card when the week is thin, instead of an empty right half?
2. Does the drawer's dead void exist because the ACCOUNT block is pinned for keyboard reach? If so, what would a drawer that uses that space for "tonight in {city}" do for both Maya and Jordan?
3. The hero runs to 8rem display type while DESIGN.md documents a 4.5rem band — is the hero right and the document stale, or is the hero overreaching its own system?
4. What would it take for the empty state to feel like a bouncer's warm "not tonight, but…" instead of an exit to Instagram?

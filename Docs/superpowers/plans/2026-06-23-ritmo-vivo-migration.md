# Ritmo Vivo Design System Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Salsa Segura site from the "Noche Ardiente" design system to "Ritmo Vivo" (deep-slate glassmorphism, rose-red/gold/orange, neon glow) per `Docs/superpowers/specs/2026-06-23-ritmo-vivo-design-migration.md`.

**Architecture:** Token-first. Rewrite `global.css` tokens to Ritmo Vivo values keeping the SAME variable names so all components inherit instantly (~70% of the change). Then per-component passes apply what variables can't express: `backdrop-filter` glass, glow shadows, new radii, pill chips. App stays shippable between tasks.

**Tech Stack:** React 19, TypeScript, Vite, component-scoped CSS (no modules, no Tailwind). Verification is `npm run build` + `npm run lint` + grep checks (this is a CSS migration — there are no unit tests for styling).

## Global Constraints

- Keep existing CSS custom-property NAMES (`--bg`, `--red`, `--text`, etc.); only re-point their values. New tokens may be added.
- Logo font stays **Great Vibes**. Body → **Be Vietnam Pro**. All other display/UI → **Epilogue**.
- No light mode. The `.light-mode`/`.dark-mode` token blocks and the Footer toggle are removed.
- Dark-only palette anchored at bg `#0b1326`, primary rose `#e11d48`, text `#dae2fd`.
- After EVERY task: `npm run build` must pass and `npm run lint` must be clean.
- Commit after every task.

---

### Task 1: Fonts & HTML head

**Files:**
- Modify: `index.html` (fonts `<link>` ~line with `fonts.googleapis.com/css2`, and `<meta name="theme-color">`)

**Interfaces:**
- Produces: Epilogue, Be Vietnam Pro, Great Vibes available as web fonts for all later CSS tasks.

- [ ] **Step 1: Replace the Google Fonts link**

Find the existing `<link href="https://fonts.googleapis.com/css2?...Great+Vibes...Playfair+Display...Josefin+Sans...Lato...">` and replace its `href` with:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Epilogue:wght@400;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 2: Update theme-color meta**

Change `<meta name="theme-color" content="#2c3e50" />` to:

```html
<meta name="theme-color" content="#0b1326" />
```

- [ ] **Step 3: Verify build + fonts**

Run: `npm run build`
Expected: PASS (no TypeScript/Vite errors).

Run: `grep -i "Playfair\|Josefin\|Lato" index.html`
Expected: no output (old fonts gone).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: swap to Epilogue + Be Vietnam Pro fonts (Ritmo Vivo)"
```

---

### Task 2: Core tokens in global.css

**Files:**
- Modify: `src/styles/global.css` (`:root` block, lines ~9-53)

**Interfaces:**
- Produces: the full Ritmo Vivo token set under the existing variable names + new tokens (`--surface-high`, `--tertiary`, `--tertiary-dim`, `--glass-blur`, `--glow-primary`, `--space-*`, expanded `--radius-*`). All later tasks consume these.

- [ ] **Step 1: Replace the entire `:root` block**

Replace the existing `:root { ... }` (the Design Tokens block) with:

```css
:root {
  /* Backgrounds */
  --bg:          #0b1326;
  --surface:     #131b2e;
  --surface-high:#171f33;
  --card:        rgba(255, 255, 255, 0.08);
  --card-hover:  rgba(255, 255, 255, 0.12);

  /* Borders (glass) */
  --border:      rgba(255, 255, 255, 0.10);
  --border-md:   rgba(255, 255, 255, 0.16);
  --border-lg:   rgba(255, 255, 255, 0.24);

  /* Accent — Rose Red (primary) */
  --red:         #e11d48;
  --red-bright:  #ff5874;
  --red-dim:     rgba(225, 29, 72, 0.18);
  --red-glow:    rgba(225, 29, 72, 0.30);

  /* Accent — Gold (secondary) */
  --gold:        #e9c349;
  --gold-light:  #ffe088;
  --gold-dim:    rgba(233, 195, 73, 0.15);

  /* Accent — Warm Orange (tertiary) */
  --tertiary:     #ffb690;
  --tertiary-dim: rgba(255, 182, 144, 0.15);

  /* Text */
  --text:        #dae2fd;
  --text-muted:  #e5bdbe;
  --text-dim:    #ac8889;

  /* Typography */
  --font-display: 'Epilogue', 'Helvetica Neue', sans-serif;
  --font-ui:      'Epilogue', 'Helvetica Neue', sans-serif;
  --font-body:    'Be Vietnam Pro', 'Helvetica Neue', sans-serif;
  --font-logo:    'Great Vibes', cursive;

  /* Header (glass) */
  --header-bg: rgba(11, 19, 38, 0.72);

  /* Glass & glow */
  --glass-blur:   12px;
  --glow-primary: 0 0 24px rgba(225, 29, 72, 0.30);

  /* Spacing (4px base scale) */
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  16px;
  --space-lg:  24px;
  --space-xl:  40px;
  --space-xxl: 80px;
  --gutter:    24px;
  --container-max: 1280px;
  --section-pad: 80px 0;

  /* Radius */
  --radius-sm:   4px;
  --radius:      8px;
  --radius-md:   12px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-full: 9999px;
}
```

- [ ] **Step 2: Verify build + visual sanity**

Run: `npm run build && npm run dev` (open browser briefly)
Expected: PASS; site renders in slate-blue + rose, text is cool blue-white. Components look mostly migrated already via inheritance.

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: re-point design tokens to Ritmo Vivo palette"
```

---

### Task 3: Shared components & removals in global.css

**Files:**
- Modify: `src/styles/global.css` (`.section-title`, `.btn-primary`, `.contact-form`, `.style-card`, `.contact-card`, focus states, and the `.light-mode`/`.dark-mode` blocks ~lines 322-345, 423-425)

**Interfaces:**
- Consumes: tokens from Task 2.
- Produces: glassmorphic shared cards, rose-glow buttons, and a `.style-chip` pill class for Task 7/9.

- [ ] **Step 1: Delete the light-mode and dark-mode token blocks**

Remove the entire `.light-mode { ... }` block (Section 9), the legacy `.dark-mode { ... }` block, and the `.light-mode :focus-visible { outline-color: var(--red); }` rule near the focus states. Leave all other focus-visible rules.

- [ ] **Step 2: Update `.section-title` typography**

Replace the `.section-title` rule's font line and weight so it reads:

```css
.section-title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  color: var(--text);
  text-align: center;
  margin-bottom: 3rem;
  position: relative;
  letter-spacing: -0.02em;
}
```

(The `::after` crimson bar rule stays; it already uses `var(--red)`.)

- [ ] **Step 3: Make `.style-card` and `.contact-card` glassmorphic**

Replace both card rules' `background`/`border`/`border-radius` so each reads (keep their existing padding/text-align/transition lines):

```css
.style-card {
  background: var(--card);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border);
  padding: 2rem;
  border-radius: var(--radius-lg);
  text-align: center;
  transition: border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
}

.style-card:hover {
  transform: translateY(-6px);
  border-color: var(--red-dim);
  box-shadow: var(--glow-primary);
}
```

Apply the same `background`/`backdrop-filter`/`border`/`border-radius: var(--radius-lg)` treatment to `.contact-card`, and add `box-shadow: var(--glow-primary);` to its `:hover`.

- [ ] **Step 4: Restyle `.btn-primary` for rose gloss + glow + tactile radius**

Replace the `.btn-primary` rule (keep the `::before` slide rules as-is):

```css
.btn-primary {
  display: inline-block;
  padding: 0.8rem 1.75rem;
  background: linear-gradient(180deg, #ff3d63, #e11d48);
  color: #fff;
  text-decoration: none;
  border-radius: var(--radius-xl);
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: box-shadow 0.25s ease;
  position: relative;
  overflow: hidden;
  z-index: 0;
}

.btn-primary:hover {
  box-shadow: var(--glow-primary);
}
```

- [ ] **Step 5: Add the `.style-chip` pill class**

Append after the buttons section:

```css
/* Dance-style chips (On1 / On2 / Cuban) */
.style-chip {
  display: inline-block;
  padding: 4px 12px;
  background: var(--tertiary-dim);
  color: #fff;
  border-radius: var(--radius-full);
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
```

- [ ] **Step 6: Verify**

Run: `npm run build && npm run lint`
Expected: both PASS.

Run: `grep -n "light-mode\|\.dark-mode" src/styles/global.css`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: glassmorphic shared cards, rose-glow buttons, style chips; drop light mode CSS"
```

---

### Task 4: Remove the Footer light-mode toggle

**Files:**
- Modify: `src/components/Footer/Footer.tsx` (lines 1-42)
- Modify: `src/components/Footer/Footer.css` (`.dark-mode-container`, `.dark-mode-toggle` rules + footer chrome)

**Interfaces:**
- Consumes: tokens from Task 2.
- Produces: a toggle-free, glass-styled footer. No more `body.light-mode` writes anywhere in the app.

- [ ] **Step 1: Strip toggle logic from Footer.tsx**

Replace the top of the component so it no longer imports `useState`/`useEffect` for theming or renders the toggle. New file head through the links block:

```tsx
import "./Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer>
      <div className="footer-content">
        <div className="footer-links">
          <a href="https://www.instagram.com/SalsaSegura" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href="mailto:info@SalsaSegura.com">Email</a>
          <a href="tel:+19784440922">Call</a>
        </div>
```

Delete the entire `<div className="dark-mode-container">...</div>` block (the toggle button). Leave the buy-me-a-coffee link and copyright as-is.

- [ ] **Step 2: Remove toggle CSS from Footer.css**

Delete the `.dark-mode-container` and `.dark-mode-toggle` rules (and any `:hover`/`:focus` variants for them). Ensure footer `background`/`border` use tokens (`var(--surface)` / `var(--border)`); add `backdrop-filter: blur(var(--glass-blur))` to the `footer` rule if it has a translucent background.

- [ ] **Step 3: Verify no dangling references**

Run: `grep -rn "light-mode\|lightMode\|dark-mode-toggle\|dark-mode-container" src`
Expected: no output.

Run: `npm run build && npm run lint`
Expected: both PASS (no unused-import warnings for `useState`/`useEffect`).

- [ ] **Step 4: Commit**

```bash
git add src/components/Footer/Footer.tsx src/components/Footer/Footer.css
git commit -m "feat: remove light-mode toggle from footer"
```

---

### Task 5: Header glass pass

**Files:**
- Modify: `src/components/Header/Header.css`

**Interfaces:**
- Consumes: tokens from Task 2.

- [ ] **Step 1: Align blur with the glass token**

In the `header` rule, change `backdrop-filter: blur(16px)` and `-webkit-backdrop-filter: blur(16px)` to `blur(var(--glass-blur))`. The `background: var(--header-bg)` already picks up the new glass value.

- [ ] **Step 2: Fix the hardcoded mobile menu background**

In the `@media (max-width: 990px)` block, change `background: rgba(8, 8, 8, 0.97);` on `.nav-links` to:

```css
    background: rgba(11, 19, 38, 0.97);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
```

- [ ] **Step 3: Verify**

Run: `grep -n "rgba(8, 8, 8" src/components/Header/Header.css`
Expected: no output.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header/Header.css
git commit -m "feat: header glass blur + slate mobile menu"
```

---

### Task 6: Hero pass

**Files:**
- Modify: `src/components/Hero/Hero.css`

**Interfaces:**
- Consumes: tokens from Task 2.

- [ ] **Step 1: Audit for hardcoded Noche Ardiente values**

Run: `grep -niE "#080808|#101016|#16161E|#C41230|#E01540|#C8941A|#F5F0E8|Playfair|Josefin|Lato|box-shadow:[^;]*#000|box-shadow:[^;]*rgba\(0, ?0, ?0" src/components/Hero/Hero.css`
Expected: a list of lines to fix (may be empty if Hero is fully token-driven).

- [ ] **Step 2: Replace each hit with the token equivalent**

For every match from Step 1, substitute per this map:
- `#080808` → `var(--bg)`
- `#101016` → `var(--surface)`
- `#16161E` → `var(--card)`
- `#C41230` → `var(--red)`
- `#E01540` → `var(--red-bright)`
- `#C8941A` → `var(--gold)`
- `#F5F0E8` → `var(--text)`
- heavy black `box-shadow` (`#000` / `rgba(0,0,0,…)`) → `var(--glow-primary)` if it's on a primary/active element, otherwise `0 8px 32px rgba(11,19,38,0.5)` (ambient slate).

Display headings: ensure they use `font-family: var(--font-display)` and `font-weight: 800` with `letter-spacing: -0.02em` for the Epilogue "hit."

- [ ] **Step 3: Verify**

Run the Step 1 grep again.
Expected: no output.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Hero/Hero.css
git commit -m "feat: hero Ritmo Vivo pass (Epilogue display, slate shadows)"
```

---

### Task 7: Events & EventModal cards

**Files:**
- Modify: `src/components/Events/Events.css`
- Modify: `src/components/EventModal/EventModal.css`

**Interfaces:**
- Consumes: tokens from Task 2, `.style-chip` from Task 3.

- [ ] **Step 1: Audit both files**

Run: `grep -niE "#080808|#101016|#16161E|#1D1D26|#C41230|#E01540|#C8941A|#F5F0E8|border-radius: ?(6px|12px|20px)|box-shadow:[^;]*#000|box-shadow:[^;]*rgba\(0, ?0, ?0" src/components/Events/Events.css src/components/EventModal/EventModal.css`
Expected: a list of lines to fix.

- [ ] **Step 2: Apply the hex/shadow substitution map**

Same map as Task 6 Step 2, plus:
- `#1D1D26` → `var(--card-hover)`

- [ ] **Step 3: Make event cards glassmorphic with radius-lg**

For the primary event card selector (e.g. `.event-card`), set:

```css
  background: var(--card);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
```

Bump any `border-radius: 6px` → `var(--radius)`, `12px` → `var(--radius-md)`, `20px` → `var(--radius-lg)`. On card `:hover`, add `box-shadow: var(--glow-primary);` and a `border-color: var(--red-dim);`.

- [ ] **Step 4: Gold tags for status**

If a "Limited Spots"/"Sold Out" badge selector exists, set its background to `var(--gold-dim)` with `color: var(--gold-light)`. If no such selector exists, skip (no invented markup).

- [ ] **Step 5: Verify**

Run the Step 1 grep again.
Expected: no output.

Run: `npm run build && npm run lint`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Events/Events.css src/components/EventModal/EventModal.css
git commit -m "feat: glassmorphic event cards + modal Ritmo Vivo pass"
```

---

### Task 8: Calendar colors & Schedule-X theme

**Files:**
- Modify: `src/types/events.ts` (`CALENDARS_CONFIG`, lines ~42-82)
- Modify: `src/components/Calendar/Calendar.css`

**Interfaces:**
- Consumes: tokens from Task 2.
- Produces: event-type colors social→rose, class→periwinkle, workshop→gold, distinct and legible on a packed calendar.

- [ ] **Step 1: Retune `CALENDARS_CONFIG.darkColors`**

In `src/types/events.ts`, set the `darkColors` for each type:

```ts
  social: {
    colorName: "social",
    lightColors: { main: "#e11d48", container: "#ffd9df", onContainer: "#68001a" },
    darkColors:  { main: "#ff5874", container: "#7a0a26", onContainer: "#ffd9df" },
  },
  class: {
    colorName: "class",
    lightColors: { main: "#4f63c4", container: "#dfe3ff", onContainer: "#1a2a6e" },
    darkColors:  { main: "#7c93e9", container: "#2a3566", onContainer: "#dfe3ff" },
  },
  workshop: {
    colorName: "workshop",
    lightColors: { main: "#a8820f", container: "#fff0c2", onContainer: "#3a2c00" },
    darkColors:  { main: "#e9c349", container: "#574500", onContainer: "#fff0c2" },
  },
```

- [ ] **Step 2: Audit Calendar.css for hardcoded old values**

Run: `grep -niE "#080808|#101016|#16161E|#C41230|#C8941A|#F5F0E8|#ff8c42|#3498db|#27ae60|#85c1e9|#82e0aa" src/components/Calendar/Calendar.css`
Expected: list of lines (Schedule-X theme overrides referencing old hues).

- [ ] **Step 3: Replace Calendar.css hits**

Apply the Task 6 hex map for brand neutrals/accents. For any old event-type hues, map: orange `#ff8c42`/`#ffb380` → `var(--red)` family; blue `#3498db`/`#85c1e9` → `#7c93e9`; green `#27ae60`/`#82e0aa` → `var(--gold)`. Ensure the Schedule-X surface variables (calendar background/grid) use `var(--surface)` / `var(--border)` so the calendar sits in the slate world.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: PASS.

Run: `npm run dev`, open `/calendar`, confirm the three event types are visually distinct (rose / periwinkle / gold) on the slate grid.

- [ ] **Step 5: Commit**

```bash
git add src/types/events.ts src/components/Calendar/Calendar.css
git commit -m "feat: harmonize calendar event-type colors to Ritmo Vivo"
```

---

### Task 9: Instructor, Lessons, Contact

**Files:**
- Modify: `src/components/Instructor/Instructor.css`
- Modify: `src/components/Lessons/Lessons.css`
- Modify: `src/components/Contact/Contact.css`

**Interfaces:**
- Consumes: tokens from Task 2, `.style-chip` from Task 3.

- [ ] **Step 1: Audit all three**

Run: `grep -niE "#080808|#101016|#16161E|#1D1D26|#C41230|#E01540|#C8941A|#F5F0E8|border-radius: ?(6px|12px|20px)|box-shadow:[^;]*#000|box-shadow:[^;]*rgba\(0, ?0, ?0|Playfair|Josefin|Lato" src/components/Instructor/Instructor.css src/components/Lessons/Lessons.css src/components/Contact/Contact.css`
Expected: list of lines.

- [ ] **Step 2: Apply the substitution map**

Same hex/radius/shadow/font map as Tasks 6-7. For card-like surfaces in these files, add the glass treatment (`background: var(--card)` + `backdrop-filter: blur(var(--glass-blur))` + `border: 1px solid var(--border)` + `border-radius: var(--radius-lg)`).

- [ ] **Step 3: Convert Lessons dance-style tags to `.style-chip` (if present)**

If Lessons.css has bespoke styling for On1/On2/Cuban style tags, either replace that rule body with the `.style-chip` properties or, if the markup can use the shared class, leave the shared `.style-chip` to handle it. Do not invent new markup.

- [ ] **Step 4: Verify**

Run the Step 1 grep again.
Expected: no output.

Run: `npm run build && npm run lint`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Instructor/Instructor.css src/components/Lessons/Lessons.css src/components/Contact/Contact.css
git commit -m "feat: instructor, lessons, contact Ritmo Vivo pass"
```

---

### Task 10: Pages & WIP (AboutPage, SubmitEventPage, WorkInProgress, styles.css)

**Files:**
- Modify: `src/pages/AboutPage.css`
- Modify: `src/pages/SubmitEventPage.css`
- Modify: `src/components/WIP/WorkInProgress.css`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: tokens from Task 2.

- [ ] **Step 1: Audit all four**

Run: `grep -niE "#080808|#101016|#16161E|#1D1D26|#C41230|#E01540|#C8941A|#F5F0E8|border-radius: ?(6px|12px|20px)|box-shadow:[^;]*#000|box-shadow:[^;]*rgba\(0, ?0, ?0|Playfair|Josefin|Lato" src/pages/AboutPage.css src/pages/SubmitEventPage.css src/components/WIP/WorkInProgress.css src/styles.css`
Expected: list of lines (note: `src/styles.css` 404 page uses `var(--red)`/`var(--font-display)` already — likely clean).

- [ ] **Step 2: Apply the substitution map**

Same map as prior tasks. For `.about-page section` card styles mentioned in project memory, apply the glass treatment if those rules are being touched. SubmitEventPage form inputs should match the `.contact-form` input styling (token-driven border/background).

- [ ] **Step 3: Verify**

Run the Step 1 grep again.
Expected: no output.

Run: `npm run build && npm run lint`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AboutPage.css src/pages/SubmitEventPage.css src/components/WIP/WorkInProgress.css src/styles.css
git commit -m "feat: pages + WIP Ritmo Vivo pass"
```

---

### Task 11: Whole-repo verification sweep

**Files:**
- None (verification only; fix-forward if anything surfaces)

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Grep the entire src tree + index.html for any leftover Noche Ardiente values**

Run:
```bash
grep -rniE "#080808|#101016|#16161E|#1D1D26|#C41230|#E01540|#C8941A|#F5F0E8|light-mode|lightMode|Playfair|Josefin Sans|'Lato'" src index.html
```
Expected: no output. If anything appears, fix it with the substitution map from Task 6 and re-run.

- [ ] **Step 2: Confirm new fonts and tokens are present**

Run: `grep -c "Epilogue\|Be Vietnam Pro" index.html`
Expected: `1` or more.

- [ ] **Step 3: Full build + lint**

Run: `npm run build && npm run lint`
Expected: both PASS.

- [ ] **Step 4: Manual visual pass**

Run: `npm run dev`. Visit `/`, `/calendar`, `/about`, `/submit`. Confirm: slate-blue backgrounds, rose primary buttons with glow on hover, glass cards, Epilogue headings, Great Vibes logo, cool blue-white text, calendar event types distinct, no light-mode toggle in footer, no visual regressions.

- [ ] **Step 5: Commit (if any fix-forward changes were made)**

```bash
git add -A
git commit -m "chore: final Ritmo Vivo verification fixes"
```

---

## Self-Review

**Spec coverage:** Fonts (T1) ✓ · color tokens (T2) ✓ · spacing/radius scales (T2) ✓ · typography helpers/removals (T2-T3) ✓ · buttons (T3) ✓ · shared cards (T3) ✓ · chips (T3, applied T9) ✓ · Footer toggle removal (T4) ✓ · Header (T5) ✓ · Hero (T6) ✓ · Event cards + modal (T7) ✓ · Calendar colors (T8) ✓ · Instructor/Lessons/Contact (T9) ✓ · Pages/WIP/styles.css (T10) ✓ · verification + grep checks (T11) ✓. Out-of-scope items (masonry gallery, video previews) correctly omitted.

**Placeholder scan:** No TBD/TODO. Conditional steps ("if such a selector exists") explicitly instruct "do not invent markup" rather than leaving it vague — appropriate because the audit grep reveals what actually exists.

**Type consistency:** `CALENDARS_CONFIG` keeps its existing shape (`colorName`/`lightColors`/`darkColors` with `main`/`container`/`onContainer`) — matches `src/types/events.ts`. Token names reused verbatim across tasks (`--glass-blur`, `--glow-primary`, `--style-chip`→`.style-chip`, `--radius-lg`).

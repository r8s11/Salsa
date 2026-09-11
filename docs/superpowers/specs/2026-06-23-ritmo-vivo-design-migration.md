# Design System Migration: Noche Ardiente → Ritmo Vivo

**Date:** 2026-06-23
**Status:** Approved design, ready for implementation planning

## Goal

Migrate the Salsa Segura site from the "Noche Ardiente" design system (dark editorial, pure-black, crimson/cream) to "Ritmo Vivo" as defined in `DESIGN.md` (deep-slate glassmorphism, rose-red/gold/orange, neon glow). This is a **full-system** migration touching every component CSS file, not just tokens.

## Decisions (from brainstorming)

1. **Scope:** Full system — every component CSS file updated to DESIGN.md guidance (glassmorphism, glow, pill chips, rounded scale).
2. **Light mode:** Dropped. Ritmo Vivo is a dark-only "spotlight on a dark stage" aesthetic; glassmorphism/glow break in light mode. Remove the `.light-mode` token block and the Footer toggle.
3. **Logo font:** Keep **Great Vibes** for the "Salsa Segura" logo only — a deliberate script accent against the geometric Epilogue UI. Keep that one font import.
4. **Calendar event colors:** Brand-harmonized but **visually distinct** for fast scanning — social → Rose `#e11d48`, class → periwinkle `#7c93e9` (harmonizes with `#dae2fd` text), workshop → Gold `#e9c349`.

## Strategy

**Token-first, then component passes.** Rewrite `global.css` tokens to Ritmo Vivo values while keeping the **same variable names** (`--bg`, `--red`, `--text`, etc.) so all components inherit the change instantly and consistently (~70% of the visual shift). Then a second pass per component applies what variables can't express: `backdrop-filter` glass, glow shadows, new radii, pill chips.

Add new semantic tokens Ritmo Vivo needs (`--glass`, `--glass-border`, `--glow-primary`, `--tertiary`, 4px spacing scale, expanded radius scale). Old names remain as the canonical variables (re-pointed), so nothing breaks mid-migration. The app stays shippable between steps.

## Section 1 — Tokens & Foundation

### Fonts (`index.html`)
Replace the Google Fonts `<link>`:
- **Add:** Epilogue (700, 800 — display, headlines, labels), Be Vietnam Pro (400 — body).
- **Keep:** Great Vibes (logo only).
- **Remove:** Playfair Display, Josefin Sans, Lato.
- Update `<meta name="theme-color">` from `#2c3e50` to `#0b1326`.

### Color tokens (`global.css`)
Remap existing variable names to Ritmo Vivo values and add new ones:

```
--bg:           #0b1326   (was #080808)
--surface:      #131b2e   (was #101016)
--surface-high: #171f33   (NEW — surface-container)
--card:         rgba(255,255,255,0.08)   (glassmorphic; was #16161E)
--card-hover:   rgba(255,255,255,0.12)
--border:       rgba(255,255,255,0.10)   (glass border)
--border-md:    rgba(255,255,255,0.16)
--border-lg:    rgba(255,255,255,0.24)
--red:          #e11d48   (primary; was #C41230)
--red-bright:   #ff5874   (hover/glow; was #E01540)
--red-dim:      rgba(225,29,72,0.18)
--red-glow:     rgba(225,29,72,0.30)
--gold:         #e9c349   (was #C8941A)
--gold-light:   #ffe088
--gold-dim:     rgba(233,195,73,0.15)
--tertiary:     #ffb690   (NEW — warm orange)
--tertiary-dim: rgba(255,182,144,0.15)
--text:         #dae2fd   (was #F5F0E8)
--text-muted:   #e5bdbe   (on-surface-variant; was #8A8580)
--text-dim:     #ac8889   (outline; was #4E4E55)
--header-bg:    rgba(11,19,38,0.72)   (glass)
--glass-blur:   12px
--glow-primary: 0 0 24px rgba(225,29,72,0.30)
```

### Spacing — NEW 4px scale (`global.css`)
```
--space-xs:  4px
--space-sm:  8px
--space-md:  16px
--space-lg:  24px
--space-xl:  40px
--space-xxl: 80px
--gutter:    24px
--container-max: 1280px
```
`--section-pad` retuned to use the new scale (e.g. `80px 0`).

### Radius — expanded scale (`global.css`)
```
--radius-sm: 4px
--radius:    8px    (DEFAULT base)
--radius-md: 12px
--radius-lg: 16px
--radius-xl: 24px
--radius-full: 9999px
```

### Typography (`global.css`)
- `--font-display: 'Epilogue', sans-serif` (was Playfair Display)
- `--font-ui: 'Epilogue', sans-serif` (was Josefin Sans)
- `--font-body: 'Be Vietnam Pro', sans-serif` (was Lato)
- `--font-logo: 'Great Vibes', cursive` (unchanged)
- `.section-title` → Epilogue 800, tighter letter-spacing (`-0.02em`).
- Labels/overlines → uppercase Epilogue, `letter-spacing: 0.1em`.

### Removals
- Delete `.light-mode` and `.dark-mode` token override blocks.
- Delete the `.light-mode :focus-visible` override.

## Section 2 — Component Patterns

### Buttons (`global.css` + component buttons)
- `.btn-primary`: solid rose `#e11d48`, white text, subtle top-down gradient `linear-gradient(180deg, #ff3d63, #e11d48)`, `border-radius: var(--radius-xl)` (24px tactile CTAs), `box-shadow: var(--glow-primary)` on hover. Keep the existing `::before` slide mechanism.
- Secondary: gold outline, hover fills with semi-transparent gold tint.
- Ghost: text + rhythm underline appearing on hover.

### Cards (Events, Instructor, `.style-card`, `.contact-card`)
Signature glass treatment: `background: var(--card)` (white 8%), `backdrop-filter: blur(var(--glass-blur))`, `1px solid var(--border)`, `border-radius: var(--radius-lg)`. Hover lifts (`translateY`) + rose-tinted border. Replace heavy black shadows with tinted/ambient shadows.

Event cards: large background imagery with a glassmorphic footer holding date/time/CTA; gold accent tags for "Limited Spots"/"Sold Out".

### Header (`Header.css`)
Glassmorphic sticky bar: `--header-bg: rgba(11,19,38,0.72)` + `backdrop-filter: blur(12px)`. Logo stays Great Vibes, retinted to rose or text color.

### Hero (`Hero.css`)
Display type → Epilogue 800 with tight tracking. Rose glow accents. Keep the divider motif, restyled to the new palette.

### Dance-style chips (`global.css` / Lessons)
Pill chips for On1/On2/Cuban tags: low-opacity tertiary-orange bg (`var(--tertiary-dim)`), high-contrast white text, `border-radius: var(--radius-full)`, uppercase label-sm Epilogue.

### Calendar (`Calendar.css` + `src/types/events.ts`)
Retune `CALENDARS_CONFIG` `darkColors`:
- social → main `#e11d48` (rose)
- class → main `#7c93e9` (periwinkle)
- workshop → main `#e9c349` (gold)

Update `container`/`onContainer` for each to legible slate-world pairings. `lightColors` no longer relevant (light mode dropped) but may stay untouched. Update any Schedule-X theme overrides in `Calendar.css` to match.

### Footer (`Footer.css` + `Footer.tsx`)
- Remove the light-mode toggle: `isLightMode` state, `toggleMode`, the `useEffect` applying `light-mode`, the `localStorage` read/write, and the `.dark-mode-container`/`.dark-mode-toggle` button JSX (`Footer.tsx:5-40`).
- Restyle footer to glass.

### Glow & shadows (global)
Replace heavy black `box-shadow` usages with tinted/ambient shadows inheriting the slate hue. Rose glow reserved for active/primary elements only.

## Files Touched

- `index.html` — fonts, theme-color
- `src/styles/global.css` — tokens, foundation, shared components, removals
- `src/styles.css` — verify inherited tokens (404 page, loaders)
- `src/types/events.ts` — `CALENDARS_CONFIG` event colors
- `src/components/Footer/Footer.tsx` — remove toggle
- All 14 component/page CSS files:
  Calendar, Contact, EventModal, Events, Footer, Header, Hero, Instructor, Lessons, WIP/WorkInProgress, AboutPage, SubmitEventPage

## Verification

- `npm run build` passes (TypeScript + Vite).
- `npm run lint` clean.
- Manual visual pass: every page renders with the new palette, no leftover crimson `#C41230` / cream `#F5F0E8` / pure-black `#080808`, no broken light-mode references, fonts loading (Epilogue/Be Vietnam Pro/Great Vibes), calendar event types visually distinct.
- Grep check: no remaining references to `light-mode`, `Playfair`, `Josefin`, `Lato`, or old hex values.

## Out of Scope

- Masonry gallery component (DESIGN.md mentions it, but no gallery exists in the current codebase — defer until a gallery is built).
- Live video hover previews (no gallery yet).
- Any new components or layout restructuring beyond restyling existing ones.

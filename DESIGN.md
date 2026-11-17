---
version: alpha
name: Salsa Segura Design System
description: >-
  Boston & NYC Latin dance events calendar. Three visual languages: Ritmo
  Vivo (public site and shop), The Listings Desk (operators), and The Sleeve
  (exported event and weekly compilation artwork).
colors:
  # Public palette (Ritmo Vivo): the original Stitch export, a Material 3
  # dark scheme. In M3 dark, `primary` is the light tone (#ffb3b6) and the
  # brand Rose Red is `primary-container` (#e11d48, `--red` in
  # src/styles/global.css). Which colour a button uses is stated in
  # `components` below. Gold is `secondary`, Warm Orange is `tertiary`.
  surface: "#0b1326"
  surface-dim: "#0b1326"
  surface-bright: "#31394d"
  surface-container-lowest: "#060e20"
  surface-container-low: "#131b2e"
  surface-container: "#171f33"
  surface-container-high: "#222a3d"
  surface-container-highest: "#2d3449"
  on-surface: "#dae2fd"
  on-surface-variant: "#e5bdbe"
  inverse-surface: "#dae2fd"
  inverse-on-surface: "#283044"
  outline: "#ac8889"
  outline-variant: "#5c3f40"
  surface-tint: "#ffb3b6"
  primary: "#ffb3b6"
  on-primary: "#68001a"
  primary-container: "#e11d48"
  on-primary-container: "#fffaf9"
  inverse-primary: "#be0037"
  secondary: "#e9c349"
  on-secondary: "#3c2f00"
  secondary-container: "#af8d11"
  on-secondary-container: "#342800"
  tertiary: "#ffb690"
  on-tertiary: "#552100"
  tertiary-container: "#bf5300"
  on-tertiary-container: "#fffaf8"
  error: "#ffb4ab"
  on-error: "#690005"
  error-container: "#93000a"
  on-error-container: "#ffdad6"
  primary-fixed: "#ffdada"
  primary-fixed-dim: "#ffb3b6"
  on-primary-fixed: "#40000c"
  on-primary-fixed-variant: "#920028"
  secondary-fixed: "#ffe088"
  secondary-fixed-dim: "#e9c349"
  on-secondary-fixed: "#241a00"
  on-secondary-fixed-variant: "#574500"
  tertiary-fixed: "#ffdbca"
  tertiary-fixed-dim: "#ffb690"
  on-tertiary-fixed: "#341100"
  on-tertiary-fixed-variant: "#783200"
  background: "#0b1326"
  on-background: "#dae2fd"
  surface-variant: "#2d3449"
  # Ritmo Vivo working tokens. src/styles/global.css names the M3 values
  # above differently: --bg = surface/background, --surface =
  # surface-container-low, --surface-high = surface-container, --red =
  # primary-container, --gold = secondary, --gold-light = secondary-fixed,
  # --on-gold = on-secondary, --text = on-surface, --text-muted =
  # on-surface-variant, --text-dim = outline. Values M3 does not name keep
  # their CSS names below.
  red-bright: "#ff5874"
  red-deep: "#be123c"
  red-dim: "rgba(225, 29, 72, 0.18)"
  red-glow: "rgba(225, 29, 72, 0.3)"
  red-error: "#ff8080"
  red-error-strong: "#ffb3b3"
  red-line: "rgba(196, 18, 48, 0.35)"
  surface-action: "#281b31"
  gold-dim: "rgba(233, 195, 73, 0.15)"
  tertiary-dim: "rgba(255, 182, 144, 0.15)"
  blue: "#7c93e9"
  blue-pale: "#9fb1f0"
  blue-mid: "#4a5aa8"
  blue-deep: "#2d3d82"
  text-dim-glass: "#c5a3a4"
  card: "rgba(255, 255, 255, 0.08)"
  card-hover: "rgba(255, 255, 255, 0.12)"
  border: "rgba(255, 255, 255, 0.1)"
  border-md: "rgba(255, 255, 255, 0.16)"
  border-lg: "rgba(255, 255, 255, 0.24)"
  blue-dim: "rgba(124, 147, 233, 0.15)"
  # Retail Edit's scoped reading palette, declared in retail-catalog.css.
  shop-paper: "#edf0fb"
  shop-muted: "#b8c2dd"
  shop-rose: "#ff879b"
  # Event types (CALENDARS_CONFIG darkColors in
  # src/features/events/model/calendarsConfig.ts; the calendar always runs
  # dark). `main` marks type; the container pair paints Schedule-X blocks.
  event-social: "#ff5874"
  event-social-container: "#7a0a26"
  event-social-on-container: "#ffd9df"
  event-class: "#7c93e9"
  event-class-container: "#2a3566"
  event-class-on-container: "#dfe3ff"
  event-workshop: "#e9c349"
  event-workshop-container: "#574500"
  event-workshop-on-container: "#fff0c2"
  event-live-music: "#ffb690"
  event-live-music-container: "#783200"
  event-live-music-on-container: "#ffdbca"
  # Listings Desk state palette (admin, moderator, host), defined on
  # `.desk` in src/components/desk/desk.css. Unsuffixed keys are the light
  # theme; `-dark` keys are `.admin-shell[data-theme="dark"] .desk`. These
  # are state colours and are never used decoratively.
  desk-unset: "#b45309"
  desk-set: "#047857"
  desk-killed: "#b91c1c"
  desk-standing: "#475569"
  desk-tonight: "#be123c"
  desk-unset-dark: "#fbbf24"
  desk-set-dark: "#34d399"
  desk-killed-dark: "#f87171"
  desk-standing-dark: "#94a3b8"
  desk-tonight-dark: "#fb7185"
  # Operator shell (`.admin-shell` in src/styles/admin.css): neutrals, the
  # rose brand and feedback inks. `-dark` keys are data-theme="dark".
  # admin-brand is the same fill in both themes.
  admin-background: "#f8fafc"
  admin-surface: "#ffffff"
  admin-surface-secondary: "#f1f5f9"
  admin-surface-subtle: "#f8fafc"
  admin-border: "#e2e8f0"
  admin-text-primary: "#0f172a"
  admin-text-secondary: "#5d6b80"
  admin-brand: "#e11d48"
  admin-brand-text: "#be123c"
  admin-danger: "#dc2626"
  admin-success: "#047857"
  admin-warning: "#b45309"
  admin-information: "#4338ca"
  admin-background-dark: "#0f1115"
  admin-surface-dark: "#171a20"
  admin-surface-secondary-dark: "#20242c"
  admin-surface-subtle-dark: "#191d24"
  admin-border-dark: "rgba(255, 255, 255, 0.08)"
  admin-text-primary-dark: "#f1f5f9"
  admin-text-secondary-dark: "#94a3b8"
  admin-brand-text-dark: "#fb7185"
  admin-danger-dark: "#f87171"
  admin-success-dark: "#34d399"
  admin-warning-dark: "#fbbf24"
  admin-information-dark: "#818cf8"
  # Operator category chips: one tint/ink pair per hue. Categories only,
  # never state.
  admin-chip-blue-tint: "#dbeafe"
  admin-chip-blue-ink: "#1d4ed8"
  admin-chip-green-tint: "#dcfce7"
  admin-chip-green-ink: "#15803d"
  admin-chip-yellow-tint: "#fef9c3"
  admin-chip-yellow-ink: "#a16207"
  admin-chip-purple-tint: "#f3e8ff"
  admin-chip-purple-ink: "#7e22ce"
  admin-chip-cyan-tint: "#cffafe"
  admin-chip-cyan-ink: "#0e7490"
  admin-chip-orange-tint: "#ffedd5"
  admin-chip-orange-ink: "#c2410c"
  admin-chip-rose-tint: "#ffe4e6"
  admin-chip-rose-ink: "#be123c"
  admin-chip-blue-tint-dark: "rgba(59, 130, 246, 0.16)"
  admin-chip-blue-ink-dark: "#93c5fd"
  admin-chip-green-tint-dark: "rgba(34, 197, 94, 0.16)"
  admin-chip-green-ink-dark: "#86efac"
  admin-chip-yellow-tint-dark: "rgba(234, 179, 8, 0.16)"
  admin-chip-yellow-ink-dark: "#fde047"
  admin-chip-purple-tint-dark: "rgba(168, 85, 247, 0.16)"
  admin-chip-purple-ink-dark: "#d8b4fe"
  admin-chip-cyan-tint-dark: "rgba(34, 211, 238, 0.16)"
  admin-chip-cyan-ink-dark: "#67e8f9"
  admin-chip-orange-tint-dark: "rgba(249, 115, 22, 0.16)"
  admin-chip-orange-ink-dark: "#fdba74"
  admin-chip-rose-tint-dark: "rgba(244, 63, 94, 0.16)"
  admin-chip-rose-ink-dark: "#fda4af"
  # The Sleeve pressing colours (poster only).
  sleeve-red: "#d7263d"
  sleeve-red-deep: "#a8182c"
  sleeve-mustard: "#f2b705"
  sleeve-mustard-deep: "#c99400"
  sleeve-midnight: "#1b1b3a"
  sleeve-midnight-deep: "#10102a"
  sleeve-cream: "#f4ecd8"
  sleeve-live-music: "#ffb690"
  sleeve-live-music-deep: "#bf5300"
  sleeve-live-music-ink: "#552100"
typography:
  display-lg:
    fontFamily: Epilogue
    fontSize: 72px
    fontWeight: "800"
    lineHeight: "1.1"
    letterSpacing: -0.02em
  display-md:
    fontFamily: Epilogue
    fontSize: 48px
    fontWeight: "800"
    lineHeight: "1.2"
  headline-lg:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: "700"
    lineHeight: "1.3"
  headline-md:
    fontFamily: Epilogue
    fontSize: 24px
    fontWeight: "600"
    lineHeight: "1.4"
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: "400"
    lineHeight: "1.6"
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: "400"
    lineHeight: "1.6"
  label-lg:
    fontFamily: Epilogue
    fontSize: 14px
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: 0.1em
  label-sm:
    fontFamily: Epilogue
    fontSize: 12px
    fontWeight: "600"
    lineHeight: "1.2"
  hero-display:
    fontFamily: Epilogue
    fontSize: "clamp(3.25rem, 9vw, 8rem)"
    fontWeight: "900"
    lineHeight: "0.92"
    letterSpacing: -0.02em
  retail-display:
    fontFamily: Barlow Condensed
    fontSize: "clamp(5rem, 9.4vw, 9.5rem)"
    fontWeight: "700"
    lineHeight: "0.88"
    letterSpacing: -0.035em
  desk-agate:
    fontFamily: Be Vietnam Pro
    fontSize: 0.8125rem
    fontWeight: "400"
    lineHeight: "1.35"
  desk-entry-title:
    fontFamily: Be Vietnam Pro
    fontSize: 0.9375rem
    fontWeight: "700"
    lineHeight: "1.3"
  desk-label:
    fontFamily: Epilogue
    fontSize: 0.6875rem
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: 0.14em
  desk-figure:
    fontFamily: Epilogue
    fontSize: 1.375rem
    fontWeight: "800"
    lineHeight: "1"
    letterSpacing: -0.02em
  wordmark:
    fontFamily: Great Vibes
    fontWeight: "400"
    lineHeight: "1"
  identifier:
    fontFamily: ui-monospace
    fontSize: 0.8125rem
    fontWeight: "400"
    lineHeight: "1.4"
  poster-lettering:
    fontFamily: Shrikhand
    fontWeight: "400"
    lineHeight: "1.02"
    letterSpacing: -0.01em
  poster-condensed:
    fontFamily: Barlow Condensed
    fontWeight: "600"
    lineHeight: "1.15"
    fontFeature: '"tnum", "lnum"'
  poster-condensed-bold:
    fontFamily: Barlow Condensed
    fontWeight: "800"
    lineHeight: "1.15"
    fontFeature: '"tnum", "lnum"'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 80px
  container-max: 1280px
  container-utility-max: 1300px
  gutter: 24px
components:
  # Ritmo Vivo buttons (src/styles/global.css .btn-*, components/ui/Button.css).
  button-primary:
    backgroundColor: "{colors.primary-container}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.red-deep}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.xl}"
    height: 44px
  button-ghost:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-surface}"
    height: 44px
  # .style-chip: --tertiary-dim (tertiary at 15%) composited over the base.
  chip-dance-style:
    backgroundColor: "#302b36"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
  # Solid event-type badges (.event-type on the featured card).
  badge-event-social:
    backgroundColor: "{colors.red-deep}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
  badge-event-class:
    backgroundColor: "{colors.blue-deep}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
  badge-event-workshop:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.full}"
  badge-event-live-music:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.surface-container-low}"
    rounded: "{rounded.full}"
  # Listings Desk decisions on the .admin-shell surface, light and dark.
  desk-action-set:
    backgroundColor: "{colors.admin-surface}"
    textColor: "{colors.desk-set}"
    height: 34px
  desk-action-kill:
    backgroundColor: "{colors.admin-surface}"
    textColor: "{colors.desk-killed}"
    height: 34px
  desk-action-set-dark:
    backgroundColor: "{colors.admin-surface-dark}"
    textColor: "{colors.desk-set-dark}"
    height: 34px
  desk-action-kill-dark:
    backgroundColor: "{colors.admin-surface-dark}"
    textColor: "{colors.desk-killed-dark}"
    height: 34px
  # State colours as text and marks on the light desk surface (flags,
  # the Tonight division head, margin marks).
  desk-state-unset:
    backgroundColor: "{colors.admin-surface}"
    textColor: "{colors.desk-unset}"
  desk-state-standing:
    backgroundColor: "{colors.admin-surface}"
    textColor: "{colors.desk-standing}"
  desk-state-tonight:
    backgroundColor: "{colors.admin-surface}"
    textColor: "{colors.desk-tonight}"
  # The Sleeve: each pressing's field with its ink, and the cream back cover.
  sleeve-social:
    backgroundColor: "{colors.sleeve-red}"
    textColor: "{colors.sleeve-cream}"
  sleeve-class:
    backgroundColor: "{colors.sleeve-mustard}"
    textColor: "{colors.sleeve-midnight}"
  sleeve-workshop:
    backgroundColor: "{colors.sleeve-midnight}"
    textColor: "{colors.sleeve-mustard}"
  sleeve-live-music:
    backgroundColor: "{colors.sleeve-live-music}"
    textColor: "{colors.sleeve-live-music-ink}"
  sleeve-back-cover:
    backgroundColor: "{colors.sleeve-cream}"
    textColor: "{colors.sleeve-midnight}"
  sleeve-back-label:
    backgroundColor: "{colors.sleeve-cream}"
    textColor: "{colors.sleeve-red}"
---
## Overview

**Creative North Star: "Three worlds, one dance publication"**

Rhythmic, vivid, dependable. Expressive outside, precise inside: public
surfaces invite discovery; operator surfaces support deliberate work;
exported Sleeve belongs to printed matter.

**Key Characteristics:**

- Public navy grounds, warm stage-light accents, bold type and glass.
- Operator state marks, agate rows, border-only record surfaces.
- Flat, spot-colour poster artwork kept separate from interface chrome.
- Shared accessible controls; expression follows surface's job.

Salsa Segura: one product, three visual languages, applied across
five areas. They do not mix. Each area's rules live under Components.

| Area              | Visual language                 | Who it is for                     |
| ----------------- | ------------------------------- | --------------------------------- |
| Public Experience | **Ritmo Vivo**                  | dancers browsing the site         |
| Retail / Shop     | **Ritmo Vivo** (Retail Edit)    | dancers buying merchandise        |
| The Sleeve        | **The Sleeve** (printed matter) | whoever a poster is sent to       |
| Listings Desk     | **The Listings Desk**           | operators: admin, moderator, host |
| Operator / Admin  | `.admin-shell` record surfaces  | operators                         |

Desk exists because curation back-office read for hours in lit
room, while Ritmo Vivo built to feel like dark dance floor. Sleeve
exists because poster judged against other posters in story or
group chat, not against site around it.

**The Boundary Rule.** Sleeve never appears as site UI — only as
event and itinerary poster exports, itinerary link card, and their
explicit thumbnail/preview surfaces in event modal or itinerary editor.
Ritmo Vivo's glassmorphism and glow never enter poster; Sleeve's
flat spot-colour fields never leak back into Ritmo Vivo. Do not
apply glassmorphism, glow, or dark slate ground to operator surface;
do not apply agate listing rules to public one.

Ritmo Vivo captures salsa's movement, passion, community.
Personality extroverted and rhythmic, balancing heat of dance
floor with reliability of calendar people plan their week around.
Visual style: **High-Contrast / Bold** blended with
**Glassmorphism**: deep backgrounds and vibrant pops of colour simulate
atmosphere of dance social; large-scale type and translucent
overlays suggest motion and depth.

## Colors

Ritmo Vivo: warm palette on cold ground: rose, gold, orange lit
against deep navy slate, like stage light in dark club. On
public site colour has four jobs: action (rose), wayfinding (gold),
event type (four type hues), error. Atmosphere comes from
ground and glass, never extra hues.

Frontmatter keys base palette by Material 3 role names from
original Stitch export; `src/styles/global.css` names same values
differently (`--bg` is `surface`, `--surface` is `surface-container-low`).
Mapping sits in frontmatter comment. Working tokens M3 does not
name keep CSS names (`red-bright`, `blue-deep`, …).

### Primary

- **Rose Red** (`--red` #e11d48; token `primary-container`): primary
  buttons, New event CTA, dock's selected icon box, critical
  brand moments, always white text (4.70:1). `primary` token
  (#ffb3b6) is its M3 light tone, kept from export.
- **Rose Deep** (`red-deep` #be123c): primary hover fill and
  solid Social badge ground, where `--text` holds 4.87:1.
- **Rose Bright** (`red-bright` #ff5874): rose as text and line on
  dark ground (6.08:1 on `--bg`). Default focus ring (global
  `:focus-visible`, buttons, navigation, forms, calendar list rows),
  Social type colour, small rose labels.
- **Rose glow and tint** (`red-glow` 30%, `red-dim` 18%): neon shadow
  under active rose elements and rose-tinted borders. **Decision ground**
  (`surface-action` #281b31) is rose at 10% resolved over `--surface`,
  stated as solid, so text contrast fixed (`--text` 12.61:1)
  instead of depending on what translucent layer covers.

### Secondary

- **Gold** (`--gold` #e9c349; token `secondary`): links, secondary
  buttons, shop's catalog actions, focus ring on
  calendar's buttons, inputs, selects, Filters disclosure. Text on
  gold fill is `on-secondary` (#3c2f00, 7.74:1).
- **Gold Light** (#ffe088; token `secondary-fixed`): gold as small text,
  e.g. "Just approved" badge on its `gold-dim` pill and
  Workshop chip; focus ring on skip link and logo.

### Tertiary

- **Warm Orange** (`--tertiary` #ffb690): bridges red and gold in
  gradients and hover states; Live Music type colour. At 15%
  (`tertiary-dim`) tints dance-style chips, compositing to #302b36
  under white text (13.78:1).

### Neutral

- **Deep Slate** (`--bg` #0b1326): dark base letting warm tones
  glow, like spotlight on dark stage. Opaque surfaces step up to
  `--surface` (#131b2e) and `--surface-high` (#171f33).
- **Glass**: raised cards white at 8% (`card`, 12% on hover) with
  white borders at 10%, 16%, 24% (`border`, `border-md`, `border-lg`).
- **Text**: `--text` (#dae2fd) carries body copy. Secondary copy is
  `--text-muted` (#e5bdbe), rose-tinted neutral not grey, so
  quiet text stays in warm world; `--text-dim` (#ac8889) is
  tertiary step. On glass cards `text-dim-glass` (#c5a3a4) replaces it,
  because card composite would otherwise pull it under 4.5:1
  (5.98:1 on composite).
- **Error**: `red-error` (#ff8080) for error text on dark grounds,
  `red-error-strong` (#ffb3b3) for error headings and error-link hover,
  `red-line` for error banner borders.

### Event types

Each event type owns one hue, set in `CALENDARS_CONFIG`
(`src/features/events/model/calendarsConfig.ts`). Calendar always
runs dark (`isDark: true`), so each type carries only Schedule-X's
`darkColors` set; light set would never render.

| Type       | Main (`event-*`) | Container / on-container | Card chip text | Solid badge                    |
| ---------- | ---------------- | ------------------------ | -------------- | ------------------------------ |
| Social     | #ff5874          | #7a0a26 / #ffd9df 8.55:1 | `red-bright`   | `--text` on `red-deep` 4.87:1  |
| Class      | #7c93e9          | #2a3566 / #dfe3ff 9.21:1 | `blue-pale`    | `--text` on `blue-deep` 7.75:1 |
| Workshop   | #e9c349          | #574500 / #fff0c2 8.20:1 | `gold-light`   | `on-secondary` on gold 7.74:1  |
| Live Music | #ffb690          | #783200 / #ffdbca 7.20:1 | `tertiary`     | `--surface` on orange 10.09:1  |
| Concert    | #ffb690          | #783200 / #ffdbca 7.20:1 | `tertiary`     | `--surface` on orange 10.09:1  |

Concert reuses Live Music palette; system defines no further hue.
Event may carry several categories (`event_types`). First is
primary `event_type` and sets single calendar colour; every category
shown as own chip/badge and matched by type filters.

Main colour marks type as swatch and line: sidebar's swatches and
share rails, list row's leading edge and type label (`--event-color`),
Schedule-X's event accents. Container pair paints Schedule-X's
month and week event blocks. Card chips set type in lighter tone of
same hue on translucent navy pill (navy at 90%, so over
lightest flyer `red-bright` still holds 4.66:1); featured card's solid
badge (`badge-event-*`) fills with deep tone.

**The Hue-Is-Type Rule.** Three type hues are borrowed brand hues (rose,
gold, orange); indigo is the one hue existing only for a type. `blue`,
`blue-mid`, `blue-deep` and `blue-pale` carry no brand role, appear
only for Class. Single exception: `blue-pale` as information
fallback in entity review outside admin shell.

### Scoped palettes

Three palettes scoped to one area each, documented there: desk
state colours (Components › Listings Desk › States; `desk-*`), Sleeve
pressings (Components › The Sleeve › Pressings; `sleeve-*`),
operator category chips (Components › Operator / Admin; `admin-chip-*`).
`.admin-shell` itself runs on own light and dark neutrals, rose
brand and feedback inks (`admin-*`, `-dark` for dark theme). Its rose
splits by job: `admin-brand` (#e11d48) is fill under white labels in
both themes; `admin-brand-text` deepens it for text on light grounds,
brightens it on dark ones.

## Typography

Typography strategy: "Rhythmic Hierarchy." **Epilogue** provides
geometric, editorial weight, decisive and bold — the "hit" of a
beat. **Be Vietnam Pro** offers warm, approachable counterpoint for
long-form content like event descriptions and listing details.

Large display text: tight letter-spacing for compact, high-energy
impact. Labels and overlines uppercase with generous letter-spacing,
structural contrast to fluid imagery of dance.

### The type ramp and the display band

UI type sits on role ramp above, in rem (0.6875 / 0.75 / 0.8125 /
0.875 / 0.9375 / 1 / 1.125 / 1.375 / 1.5rem). Display composition above
24px is surface-specific, not universal cap. Standard display-md
(3rem) and display-lg (4.5rem) roles remain useful anchors; homepage
hero uses `clamp(3.25rem, 9vw, 8rem)` in Epilogue 900; retail
hero uses `clamp(5rem, 9.4vw, 9.5rem)` in Barlow Condensed 700.
SVG artwork lettering (vinyl label print) answers to no UI ramp.

### Two faces beyond the pair

Epilogue and Be Vietnam Pro carry system, but production ships two
more. Both legitimate roles, not drift.

- **Wordmark and shop signature** (Great Vibes): script “Salsa Segura”
  lockup, declared as `--font-logo`. Catalog's “Shop” masthead is
  explicitly approved extension of this lettering. Keep other headings
  and body copy in existing display and reading faces.
- **Identifier** (`ui-monospace, SFMono-Regular, Menlo, monospace`,
  0.8125rem): tabular identifiers operator reads character by
  character — record IDs, hashes, raw payloads, submission diffs.
  Declared as `--font-mono`. Monospace here for data that must align
  and must not be misread, never costume for "technical".

Both operator- and chrome-level roles. Neither part of public
reading experience: dancer sees wordmark, nothing else.

Sleeve sets own faces (Components › The Sleeve › Poster),
desk sets agate (Components › Listings Desk), shop uses Barlow
Condensed for display type (Components › Retail / Shop).

## Layout

Spacing follows strict 4px base unit, with large "breathing rooms"
(XXL, 80px) between major public sections so dark UI never feels
cramped. Reusable container utility caps content at 1300px with 24px
gutter; shared `--container-max` token is 1280px, used by surfaces
like footer. Distinct implemented measures, not aliases.
Events grid uses `repeat(auto-fill, minmax(288px, 1fr))` with 1.25rem
gap; shop uses explicit responsive column counts.

Area-specific layout lives with each area: calendar's responsive
tiers, mobile dock's clearance, desk's two measures and fixed
week, operator shell's collapsible sidebar, poster's fixed
story and feed measures, shop's column breakpoints.

## Elevation & Depth

Ritmo Vivo establishes hierarchy through glassmorphism and ambient light:

1. **Base surface:** deepest neutral slate.
2. **Raised cards:** white at 8% with 12px background blur and 1px
   border of white at 10%.
3. **Active elements:** rose elements carry "glow" — soft, diffused
   shadow of same colour at 30% opacity, like neon.

Avoid heavy black shadows; use tinted shadows inheriting hue of
background to keep vibrant brand promise.

Other languages flat. Listings Desk divides with rules, never
cards or shadows; operator record cards use border, never border and
shadow together; Sleeve prints with no elevation. See each
area under Components.

## Shapes

Ritmo Vivo is **Rounded**, on 0.5rem (8px) base radius balancing
hard energy of bold type. Cards and photographs use `--radius-lg`
(16px); buttons use `--radius-xl` (24px); chips use `--radius-full`.
Sleeve (hard-edged print) and Listings Desk (rules) do not use this
language; see their sections under Components.

## Components

### Shared Controls

**Buttons (Ritmo Vivo).**

- **Primary:** Rose Red with white text, subtle top-down gradient
  (#e11d48 → #be0037), rose glow on hover.
- **Secondary:** outlined in Gold (#e9c349); hover fills with
  semi-transparent gold tint.
- **Ghost:** pure text with underline growing in on hover, like
  rhythm of musical bar.

All three: uppercase Epilogue labels, 44px minimum height,
`--radius-xl` shape.

**Rubber segment.** One selection control serves every segmented choice:
`src/components/ui/RubberSegment.tsx`. Thumb stretches over old and
new option (190ms), contracts onto new one (300ms spring); reduced
motion moves it at once. Mobile dock tints it rose; calendar's
city switch, view switcher and sidebar use neutral `--surface-high`.

### Public Experience (Ritmo Vivo)

Everything dancer sees outside shop and poster.

#### Sign-in and legal reading

Sign-in stays two-column above 960px. Below that, one 480px-wide
column with unboxed, compact story so form remains prominent.
Small-screen story heading uses `clamp(1.75rem, 5vw, 2.25rem)` in
Epilogue 800, intentional surface-specific display size, not new
UI ramp step. No eyebrow precedes story or account-mode heading;
sign-up guidance follows its heading. Gold rule remains single
decorative motion detail, stays static with reduced motion.

Password visibility toggle sits inside input with 44px target;
position without centering transform so shared pressed scale
cannot displace it. Password fields stay inert until email entry.
Password recovery remains reachable even before that reveal.

Privacy and data-deletion pages keep 70ch reading measure, responsive
top spacing, bottom safe-area clearance. Updated dates are muted
0.9rem metadata, not body paragraphs. Deletion instructions retain list
semantics alongside Gold step numerals. Legal links keep Gold
underlines, visible keyboard focus, wrapping for long addresses.

#### Help guides

Help guides (`/help` and `/help/<slug>`) reuse legal reading layout:
same 70ch measure, muted updated-date metadata, hairline rules. Guide copy
is canonical Markdown in `docs/user-guides/`; loader strips
repository metadata and rewrites internal links into app routes; safe
Markdown subset rejects raw HTML, images, code blocks, so guide cannot
inject markup. Tables sit in labeled, keyboard-focusable scroll regions with
36rem minimum table width, so narrow screens do not crush column labels or
overflow page. Screenshots remain deferred pending review; never publish
private attendee or account data.

`ContextHelp` is inline form: labeled `<aside>` ("Help for this page")
of short permission-aware messages, each with one guide link, selected by
`selectHelp` from caller's task and permissions. Adds guide links,
never replaces screen's existing explanatory text.

Authoring rules: links name `/help/<slug>#<heading-slug>` targets; labels
guides reference must match accessible names of controls they
describe. `src/features/help/guideIntegrity.test.tsx` fails CI when link,
route, anchor or documented control label goes stale.


#### Hero rhythm

Homepage's visual “Rhythm” word is six independently scaled letters,
not equalizer icon alongside title. Implemented 2-3 son clave
uses 2.72s loop, 0.17s subdivisions, hit positions 2, 4, 8, 11, 14;
final letter doubles fifth hit. Each character rises from 72%
to full height, with 2% attack and decay ending at 26% of loop.
Attack offset so peak lands on hit.

Shine follows same envelope: registered numeric custom property
mixes Rose Bright and Gold Light in OKLCH and controls rose shadow.
Small four-point glint blooms and fades with each strike. These
are hero-specific motion details, not general treatment for headings.
Individual character scale composes with parent word's GSAP entrance;
does not overwrite that entrance's transform or opacity. Unsplit
source supplies accessible heading; animated layer hidden from
assistive technology. Reduced motion shows static, unsplit heading.

Heading closes with 72×2px Gold rule, separated by 18px above
and 12px heading bottom padding. On hover-capable devices with motion
enabled, hovering heading lengthens rule to 1.4× over 500ms with
`cubic-bezier(0.22, 1, 0.36, 1)`. Reduced motion keeps rule still.

Hero reserves stat rail while event feed or city pending;
pending figures hidden from sight and assistive technology. Metro
label comes from selected slug, so directory loading cannot rename
heading after paint.

#### Calendar

Public calendar (`/calendar`) is nightlife discovery stage and
community submission surface, executed in Ritmo Vivo's dark navy palette,
not administrative light planner. Ground is deep neutral
slate (`--bg: #0b1326`), with `--surface: #131b2e` and
`--surface-high: #171f33` for raised areas; accents are Rose Red
(`--red: #e11d48`) on high-action buttons and Gold (`--gold: #e9c349`) on
focus rings of page's buttons, inputs, selects and Filters
disclosure (`outline: 2px solid var(--gold)` with `outline-offset: 3px`);
list rows keep global Rose Bright ring.
Typography: Epilogue 800 display for stage header ("Dance
calendar." with rose period dot, -0.035em tracking), Be Vietnam Pro
for body copy and listing metadata. Tabular numerals
(`font-variant-numeric: tabular-nums`) enforced across calendar grids,
week numbers, dates, listing time slots so figures align vertically.

**The Read-Only Discovery Rule.** Public calendar strictly read-only
discovery. Public visitors and dancers cannot drag, edit, or delete
listings. Approved events from database remain single source of
truth; all additions flow through submission dialog into pending
moderation queue.

**The Responsive View-Refocus Rule.** Below 769px, or on coarse-pointer
viewports below 1024px wide and at most 500px high, multi-column grids
yield to chronological list or card views. Narrow screens do not force
month cells into micro-boxes: refocus to flyer thumbnails, event
title, time, venue metadata. List thumbnails 56×72px (48×62px on
compact screens): event's flyer, or fallback SVG, cropped with
`object-fit: cover` at 8px radius — plain image, not Sleeve cover.

**The Fallback-Art Guarantee.** Flyers optional. Event without one
falls back to one of four static SVGs in `/images/event-fallbacks/`
(`resolveEventFlyer`): `workshop.svg` for workshops, `bachata.svg` for
socials whose only style is bachata, `social.svg` for other socials,
`salsa.svg` for everything else. Cards and list rows show SVG
directly. Event modal places it inside generated Sleeve — frame,
title band, price sticker, track list — so every approved event still
has shareable artwork.

**Multiple flyers.** Event may carry up to five flyers; first is
primary. Only event modal's Sleeve thumbnail and event page cover
flip through them (`FlyerPager`): previous/next buttons, 44px dot per flyer,
polite "Flyer 2 of 3" status, Left/Right on focused cover, wrapping at
both ends, no slide animation. Flyer that fails to load is skipped. Cards,
list rows, month cells, related strip, poster and share image
use primary flyer only; events with one or no flyer show no controls.

**The Protected Submission Rule.** New Event modal is controlled,
accessible Radix dialog with backdrop blur (`rgba(11, 19, 38, 0.78)` with
8px blur), focus trapping, client-side validation error summaries,
unauthenticated submitter contact requirements, strict focus
restoration to invoking trigger on dismissal. At 640px and below,
submission inputs, selects, textareas use 16px text to avoid browser
focus zoom; field targets stay at least 44px high at every width.

##### Stage header and toolbar

Stage header pairs Epilogue display title and balanced subtitle
("salsa & bachata, hasta la madrugada") with segmented metro pill switch
(Boston / New York City). Controlled `EventManager` toolbar
(`src/components/ui/event-manager.tsx`) anchors planner chrome:

- **Period navigation:** Month and week title (`aria-live="polite"`), step
  controls (`< Today >`), period context appear only in Month/Week
  views. List/Cards retain full upcoming feed, labeled "Upcoming
  events" in toolbar and sidebar, without ineffective date controls.
  Stepping to another period moves title 10px and grid 28px in
  from side time moved toward (later from right), 300ms
  `cubic-bezier(0.16, 1, 0.3, 1)` from 35% opacity. Grid frame stays
  fixed, clips moving contents. Switching views or resizing keeps
  date, never travels. Schedule-X's built-in slide off
  (`skipAnimations`) so this is only grid motion. Reduced motion keeps
  160ms opacity settle with no movement.
- **Search bar:** Real-time search matching event titles, locations,
  venues, descriptions, dance styles, ignoring case and accents
  ("salon" finds "Salón"), with instant clear button (`X`) returning
  focus to input. Search bar's metal perimeter is its one authored
  motion: lazy-loaded Paper liquid metal runs 650ms on focus, then
  stops. Blur/unmount disposes shader; hidden/offscreen rendering
  pauses. Reduced motion and unavailable WebGL use static rim without
  changing search behavior. Decorative masked border follows focus
  anywhere inside bar; moving between icon, input, clear button
  does not restart it. No separate icon frame or inner input
  outline. Focus leaving whole bar disposes shader. Rim alone
  uses material neutrals (`#77777b`, `#dedbd5`, `#85858a`, `#c5b89d`) and
  shader back/tint (`#99999c`, `#fff0d4`); not content or
  category colors.
- **View switcher:** Segmented pill group toggling Month Grid, Week, List,
  Cards on desktop; compact screens filter to List and Cards only.
  Selected view, like selected city in stage switch, sits on
  neutral rubber segment (see Components › Shared Controls).
- **Action CTA:** Prominent solid Rose Red button (`+ New event`)
  launching submission dialog. No duplicate footer or empty-state
  submission CTA.

##### Desktop sidebar and responsive tiers

- **Desktop (≥ 1024px):** 208px left sidebar displays active period
  range label (17px Epilogue 700), live category breakdown counts under
  "What's on" (Social, Class, Workshop, Live Music), dance style taxonomy
  selection (e.g. On1, On2, Cuban, Bachata), 7-day upcoming event
  count tally. Sticky 24px below header, scrolls internally
  when style list long.
  **The sidebar is the grid's legend.** Each type row carries 8px
  swatch in that type's calendar colour (`CALENDARS_CONFIG` dark `main`)
  and 2px share rail showing its portion of events in current
  style context; "All events" carries stacked composition of all four.
  Choosing dance style re-proportions rails (300ms
  `cubic-bezier(0.16, 1, 0.3, 1)`; instant under reduced motion) —
  sidebar's only motion besides selection. Selection rides neutral
  rubber segment, as city and view switches do; rows never paint
  own selected fill, never change weight. Rose dot marks
  selected non-type row only. Zero-count types stay selectable with
  dimmed swatch; counts use tabular numerals.
- **Tablet (769px – 1023px):** Sidebar drops away to maximize grid
  measure; event type pills and dance style selector move into
  `EventManager` toolbar filters row.
- **Compact / Mobile:** Stage uses 28px Epilogue heading within
  display composition band, keeps existing subtitle. Header
  city picker is sole city control: duplicate stage and floating city
  selectors disappear on this surface only. Upcoming events and New event
  share row; full-width labeled List/Cards switch fills next.
  Search stays full-width. Type/style controls sit in closed native
  Filters disclosure with active-selection count; closing never
  clears filters. Disclosure unfolds from summary (280ms open,
  180ms close) as chevron turns. Browsers without size-keyword
  interpolation and reduced-motion users get instant open. List/Cards
  labels stay visible even at 320px. Every visible calendar control
  retains 44px minimum touch target.

##### Feed states

Failed first load names city ("We couldn't load Boston's
listings."), never shows raw driver error; its Try again button
stays in place while retrying, gets focus back if retry fails.
Failed background refresh keeps last loaded events on screen. With no
city chosen, calendar asks for one rather than reporting empty
city.

If city discovery fails before any inventory arrives, homepage and city
picker show recoverable error, not verified-empty state. Retry
controls remain visible, announce loading while request runs; failure
restores focus to Retry. Success focuses resulting discovery heading or
city list. Recovery headings use `tabIndex={-1}` so programmatic focus works
without adding headings to normal Tab order.

Homepage feed lists all future events. Heading is “Upcoming on the
floor,” hero’s primary action is “See upcoming events.” Separate
“Events This Week” statistic covers next seven days only. Filtered-empty
message describes selected event-type list, not week-limited feed.

##### List details

Date-grouped rows with 1px borders show flyer thumbnail,
title, labeled event type using existing calendar colors, two-line
description (one line on compact screens), start–end time, venue,
dance-style badges. List renders 50 chronological events per batch;
"Show more events" extends it, moves keyboard focus to first newly
revealed event. Opening details and unchanged background refreshes retain
expanded rows and opener's focus on close. Converted event
collection stays stable while cached data unchanged; city, filter, or
event-data changes reset pagination. Multi-night events show actual
end date; overnight events use next-day marker. Missing or unreachable
flyers use fallback art above. Fine-pointer hover moves only
detail arrow by 2px over 180ms; reduced motion removes that movement. Rows
have no entrance or filter-triggered reveal. Date group headings use 18px
Epilogue, event titles 16px Epilogue, descriptions and time/venue metadata
14px Be Vietnam Pro, type/style labels 12px. Search text 16px at
all widths; last row can scroll clear of fixed dock. Desktop
retains sidebar and month/week views.

##### Anonymous submission and moderation flow

Submission dialog (`CalendarSubmissionDialog`) opens in-place without
leaving calendar. Guest attendees can submit unlisted nights without
account when submissions open; `submitter_name` and
`submitter_email` are mandatory contact fields for unauthenticated guests;
authenticated organizers have contact credentials prefilled.
Submissions validate with `FormErrorSummary` focusing error summary
and linking to invalid fields. Dialog explicitly informs submitters
that events enter `pending` moderation queue reviewed by community
moderators and do not appear on calendar until approved. Flyer upload
tucked into collapsible `<details>` disclosure with reassurance that
flyerless events still get shareable artwork. On submission, form
fields lock until request settles. If submission-access lookup
fails, dialog offers in-place retry. Success confirmation card
offers "Done" (closing with focus restoration to trigger button) or
"Submit Another Event".

On `/submit`, signed-in submitters see listed venues, organizers,
instructors, schools as they type (one debounced lookup per pause, with
retry on failure). Choosing listing fills only empty event fields; typed
values kept, listing's alternative offered explicitly. Notice
names what was filled and offers undo; keyboard focus moves to that undo,
returns to edited field after undo. **Linked to this event** summary
renders exact `entity_review` payload submitted: Existing — will
be linked, Suggested new — moderator reviews, Not linked, or Needs your
choice. Undecided items flagged before submit; public submitters may still
submit, moderators decide. Success card repeats submitted links;
admin submission review distinguishes what submitter chose from
links applied on approval. Signed-out submitters do not trigger
entity lookups because those RPCs require authentication.

#### Event Cards

`EventCard` is glass card (`--card`, 12px blur, 1px `--border`,
`--radius-lg`) laid out in auto-fill events grid; set of one or two
listings keeps cards at most 360px wide instead of stretching.

- **Image:** flyer, or fallback SVG when none or it
  fails to load.
- **Type chip** (top-left of image): translucent navy pill (90%)
  (0.6875rem uppercase Epilogue) whose text and border take type's
  colour — Social `--red-bright`, Class `--blue-pale`, Workshop
  `--gold-light`, Live Music `--tertiary`.
- **"Just approved" badge** (top-right): gold pill on recently approved
  events.
- **Date overlay** (bottom-left of image): large day numeral beside
  month and weekday.
- **Body:** title (Epilogue 800, 1.125rem) as button whose hit area
  covers card and opens event modal; time and venue with Lucide
  `Clock` and `MapPin`; venue and event's other linked entities
  link to their pages, stay independent keyboard targets.

Card carries no purchase or RSVP button; decisions live on night
card in event modal.

`FeaturedEventCard` is discovery lead: balanced two-column composition
with 420px minimum height, 32–56px Epilogue title, large tabular date
on opaque navy marker. Gold marks date labels, metadata icons and
full-width View details row with Lucide arrow. Keeps existing glass
surface and category colours; no additional palette or typeface.
Below 768px artwork stacks above details. Image explicitly
bounded to card width; date and approval badge occupy separate grid
columns, reflow without overlap at enlarged text sizes. Title's
stretched button still opens modal; entity links remain independent.
Hover/focus fills arrow in gold; reduced motion removes transitions.

Featured selection optional. Admins and moderators may feature
approved event that has not started from admin events row menu; row
shows Featured badge and offers Undo or **Stop featuring**. Homepage
and hero record label spotlight earliest upcoming featured event in
selected area; without one they keep automatic next event. Label says
Featured Tonight/Today only when true, Next up when featured event is also
next, otherwise Featured with its date. Featured event removed from
feed below; automatic next event remains in feed. Writes go
through `set_event_featured`; direct client writes and pre-featured inserts
blocked.

**Dance-style chips.** Small pills (`.style-chip`) name dance styles
(On1, On2, Cuban, …) with low-opacity Warm Orange background
(`--tertiary-dim`) and white 0.6875rem uppercase text — legible but
secondary to primary actions.

#### Artist event RSVP surfaces

`/events/:id/rsvp` uses public navy/rose/gold tokens, Epilogue headings,
Be Vietnam Pro body. Event, schedule, managing artist and raw main-list count
lead two-column desktop composition; phone widths stack same content.
No account or phone field requested. Undecided starts selected. Named
owner/manager disclosure appears before submission; external payment links appear
only after persistence, with check-email, no-confirmed-place and contact-before-paying guidance.

Artist Events lives in existing workspace shell for actual owners/managers,
not editors or generic admin overrides. Shared canonical authoring hides only
recurrence and replaces only RSVP field. Three separate, initially unchecked
responsibility controls gate publication; private draft saves remain available.
Organizer create, draft publish and host bulk publish share same checklist.

Private roster rows use operator neutral/state tokens, rule-separated main-list
and waitlist sections, separate raw and artist-confirmed role totals.
Contacted, Confirmed and email delivery have distinct text labels; none says Paid.
Rows stack on phones. Removal requires confirmation; promotion reminds
artist to contact guest. Stale changes preserve local input until explicit
refresh/review; session loss or denied membership hides cached contacts.
Public controls stay at least 44px, errors focus first invalid field,
saved results receive focus without nested signup dialog.

#### Event Details

Event page's photo album and event modal show photographs from
past nights as plain, static images — no masonry, no video previews.

- **Event page album:** four-column grid of square photos (12px gap,
  `--radius-lg`, 1px `--border`), two columns below 768px.
- **Modal strip ("Photos from past nights"):** up to four 80×80px
  thumbnails (64px on mobile) at `--radius-md`, plus "+N" tile for
  rest. No interactive affordance.

#### Navigation

**The bar condenses on scroll.** At top of page public header is
transparent with no rule beneath, 68px tall (`--site-header-h`). Past 100px
of scroll it turns to glass (`--header-bg`, `--glass-blur`, a `--border`
rule) and condenses to 80% (54.4px, `--site-header-h-condensed`) over 320ms
on `--site-header-ease`; scrolling back above 100px reverses it. Matching
bottom margin keeps bar's footprint constant, so content never jumps.
Controls keep 44px targets. While mobile menu sheet open, bar
is glass at full height. Below 375px, where bar can wrap to two rows, it
turns to glass without condensing. Sticky UI under bar (calendar
sidebar, shop's phone toolbar) offsets by
`--site-header-offset`, which follows condensed height. Reduced motion
swaps states at once.

##### Desktop header

Desktop navigation begins at 1024px. Between 1024px and 1279.98px, tighter
link spacing keeps every destination, Submit Event and Sign In inside
viewport. City-selection triggers without caller-supplied label show
short code at every width (e.g. DC, NYC or BOS), retaining full
city in accessible name, native title hint and selection list.
Explicit labels like “Explore other cities” remain unchanged.

Public discovery offers only locations with approved upcoming events.
Discover's scene chips use `public_active_metros`, not complete metro
registry. City explorer loads shared `public_active_locations` inventory
when opened, offers only populated boroughs and neighborhoods. Borough
with upcoming events but no named neighborhood remains selectable; empty
child disclosures do not render. Loading and failed lookups remain distinct
from confirmed-empty inventory, with in-place retry and keyboard focus
recovery. Direct links and stored selections remain valid even after their
inventory empties; “Every city” still browses complete entity directory.
Curated location definitions remain available for event entry and validation;
they do not themselves make location discoverable.

##### Mobile header

Full two-tone wordmark leads bar. Compact city code and 44px
menu target share trailing edge; picker retains full city
name for assistive technology, shows full name again in city
list. At phone widths, panel anchors to header’s live bottom edge,
including wrapped and condensed states, not to viewport. Height
limited to remaining dynamic viewport above bottom safe area;
long city lists scroll inside panel at 320px and 390px.

While public mobile menu open, header is labelled modal
navigation surface: focus stays among visible controls, background
content inert, page scrolling locked. Dismissal restores focus
to menu button. Choosing destination or resizing to desktop closes
menu and releases page. Header's primary links: Calendar,
Discover, About, Contact, Shop.

##### Mobile tab bar

Below 640px translucent dark glass dock carries four labeled tabs:
**Home**, **Calendar**, **Submit** and **Me**. Submit reads **Add** for
admins, goes straight to event creation; everyone else enters
moderated submission flow. Me opens `/profile`, or `/signin` for guests.
Discover, About, Contact, Shop stay in header menu, which also
remains home of identity, dashboards, sign-out.

Blur keeps labels legible while underlying content stays visible.
Selected tab sits on rose-tinted rubber segment; its icon box
fills solid rose. Pointer proximity gently enlarges dock items. Touch
targets stay steady-sized, reduced-motion users get immediate
selection change, city code remains non-interactive badge above
bar. Keep existing bottom safe-area reservation and header's
city picker as city control.

Dock clearance belongs to full public layout, after footer, not
to main content before it. Below 640px, reserve `--tab-bar-h`
plus `--space-lg` so copyright and footer actions can scroll above
both dock and its raised city badge. Desktop adds no dock clearance.

Floating city picker yields while public footer intersects
viewport, leaving support and contact actions unobscured. Returns when
footer leaves view only if visitor remains past its scroll
threshold. Dock's city badge and header's city picker remain
available.

#### Footer

Homepage’s primary event-submission invitation lives in `HomeCta`
(“Submit your event” routes public visitors to `/submit`). Footer offers
distinct, lower-emphasis organizer-access path: “Request host access” → `/founders`.
Requests reviewed; approved hosts can manage and promote events.
Request page serves dance brands, venues, promoters, event organizers.

Footer link uses 0.875rem UI type, muted text, 1rem Solar arrow,
44px target. Hover adds underline; link is not display-scale CTA.
Compact desktop shell uses `clamp(1.75rem, 3.5vw, 2.5rem)` top padding.

Separate utility tier holds two-tone logo and service area, contact
navigation, native “Buy me a coffee” link. Icons bundled through
Iconify; no remote button image or decorative media required. Destinations
and copyright wording unchanged.

Below 1024px support moves beneath identity and navigation. Below 768px
utility groups stack. All links retain at least 44px targets and visible
keyboard focus. GSAP animates supporting tagline and utility tier, not
organizer link. Reduced motion bypasses entrance and CSS transform feedback;
scoped matchMedia cleanup reverts motion on preference changes or unmount.
Existing route-owned Lenis remains only
smooth-scroll engine; footer creates no scroll instance or WebGL surface.
Styles stay scoped to `.site-footer`; public layout owns mobile dock clearance.

#### Entity pages

Public listing pages close with own band above site Footer, never
second footer. Hairline `--border` rule opens it. Closing action is
display-scale link ("Discover dance communities") in Epilogue 800
(1.5–2.25rem, -0.03em) with "communities" in Gold and bundled Solar
arrow-right-up glyph; listing-management prompt (`.entity-claim-control`,
venues only) sits opposite on same baseline in usual muted voice,
own rule removed here so band carries one. Hover lights label Gold
Light, grows underline in, slides arrow up-right. Below 760px
pair stacks left. Contrast floors, 44px targets, Gold focus ring and
reduced motion (transition durations 0s) hold as elsewhere.

**DJ profiles** (`/dj/:slug`, `DjProfile`) are portrait-led. Below 900px
4:5 portrait bleeds full-width behind header, under short top scrim
keeping transparent bar legible over any photo, and fades to
ground; name (Epilogue 900, 0.92 line-height) lifts over fade, breaking
before last word, which takes Rose Bright. Size fits longest line
to column (capped at 6rem and 21vw, floor 2rem), so long names never
overflow. Location, dance-style chips (Tertiary at 15%, 44px hit area) and one
Rose Red "See next gig" action follow, then bio and gold Instagram/Website
links. Upcoming gigs sit on full-width `--surface` band; Venues and
residencies (series labelled Residency, venues Venue, no schedule claimed) and
Past gigs follow, side by side from 900px, where portrait joins copy in
two-column hero with 16px radius. Over first 400px of scroll
portrait sinks 12px and swells from 1.04 to 1.08 while name rises 12px and
settles to 0.98, on CSS scroll timeline; reduced motion and unsupported
browsers render it static. No portrait drops bleed, opens on name.

#### Weekly guides

Public itinerary (`/itineraries/:city/:weekStart`) is **Read** surface
in Ritmo Vivo, not Sleeve enlarged into page. Title, city and date
range establish edition; introduction and jump-to-night week strip
lead into seven-night schedule. Featured picks carry primary card
weight, alternatives remain readable event cards, curator notes sit
with night they explain. Event links resolve to real event page.
Recommendations, complete featured-night admission estimate (only when
every featured price known), sharing and published neighboring weeks
close guide. Unknown prices leave no placeholder or partial total.

**The Dance-Night Rule.** Starts before **05:00 local** belong to
previous night; 05:00 exactly begins next. Sunday 00:30 start reads
as Saturday night, with actual local start label retained. Week,
jump strip, editor and printed tracks all use same wall-clock rule,
including daylight-saving changes. Sharing and QR codes use canonical
`https://www.salsasegura.com/itineraries/<metro-slug>/<Monday>` URL;
aliases resolve to that edition, not separate share links.

### The Sleeve

Artifacts that leave site: shareable event posters and weekly
compilation artwork, exported and sent to friend's phone, pressed in
own printed world. Only explicit poster previews and thumbnails
bring this world into event modal or itinerary editor.

#### Poster

**Measures.** Poster exports at two fixed pixel sizes, never
responsive: **story** (1080×1920) and **feed** cut (1080×1350, 4:5; see
Feed Cut). Both stack same three prints top to bottom — label
**masthead**, square **front cover**, cream **back cover**.

**Masthead.** Label-style header carrying "Salsa Segura" wordmark
(set in Poster Condensed, not Great Vibes), event type, and
catalogue line (`SS-<MMDD> · <city code>`; city part prints only when
event has city), closed by 4px rule full width.

**Front cover.** Flyer art (shown whole, `object-fit: contain`) or
event's fallback SVG (cropped, `object-fit: cover`) fills square
field-colour frame; lettered title band sits below; circular price
sticker ("Entry" / amount or "Free") pinned to cover's top-right
corner, rotated -9°.

**Track list.** Side A lists night's facts — date, time, venue (with
address as second line), styles — as numbered tracks (A1, A2, …) with
dotted leaders running from Poster Condensed label to bold tabular
value, exactly like LP's printed track list. Side B holds QR
("Scan for the night"), short link and host credit.

**Short link.** QR encodes full `https://` URL
`/e/<first 8 hex of the event id>`. Printed link drops scheme but
keeps host and path (`salsasegura.com/e/1a2b3c4d`). Events whose id is
not UUID fall back to `/events/<id>`.

**Faces.** Sleeve sets own faces, distinct from Epilogue/Be
Vietnam Pro pair. **Shrikhand** (registered as "Poster Lettering", weight 400) is **Poster Lettering**: fat, condensed script reserved for cover
title band alone, never heading, never body copy. **Barlow Condensed**
(registered as "Poster Condensed", weights 600/800) is **Poster
Condensed**: masthead, sticker, track list and Side B, set with
tabular lining numerals (`font-variant-numeric: tabular-nums lining-nums`)
so figures align down track list like desk's agate figures.

Both faces self-hosted (`@fontsource`), registered on demand when
event modal opens (`ensurePosterFonts`), because night card's
thumbnail already needs them. Same font bytes embedded into
PNG capture (`posterFontEmbedCss`) so exported poster matches
on-screen preview instead of falling back to system sans. Shop
loads Barlow Condensed separately for own display type.

**The Artwork-Not-Ramp Rule.** Cover title uses artwork sizing, not
UI type ramp: 24–128px in Story, reduced for long titles so
complete event name stays visible, scaled by cover ratio in Feed
(×0.752; see Feed Cut).

**Flat print.** Sleeve declares **no elevation at all**, more strictly
than desk: printed matter, so no shadow anywhere on
it. Depth comes from pressing's own printed rules — cover's 6px
frame, band's 6px top rule, sticker's 6px ring — never from
cast or ambient shadow. Ritmo Vivo's glow and operator shadows
(`--admin-shadow-sm`/`--admin-shadow-md`) both stop at poster's edge.

**Shapes.** Sleeve's shape language is flat print, not Ritmo Vivo's
rounded corners. Cover is hard-edged square framed in 6px
on-field-ink border; price sticker is the one circle on poster,
6px-ringed disc rotated -9° like stuck-on price tag; every other rule
straight. Cream back cover divided by 3px Side-label rule and 4px
dotted track leaders, both in midnight or red ink — never rounded,
glassy language rest of system uses.

#### Event Modal

Event modal is Ritmo Vivo throughout — dark ground, rose glow, gold
links — right up to sleeve's edge, where Boundary Rule takes over.

**The night card.** Modal opens on sleeve thumbnail (`SleeveCover`,
tappable, opens full poster preview with Story/Feed toggle) beside
facts — date, time, venue (omitted when event has no location),
price with type chip — with title full-width below. Poster
preview is second view in same dialog, not new route.

**Decisions.** Two equal-size decisions follow in 1fr/1fr grid
(`.night-actions`): **Send to friends** (primary) and event's link —
**RSVP · Free** or **Get Tickets** (secondary) when event has RSVP
link, otherwise **Send to friends** spans row alone. On mobile
decisions move to separate action bar. Directly after title and its
notes, **Event shortcuts** group gives **Add to calendar**, **Copy link**
and **View full details** equal raised tiles with gold icons and visible
labels. Group appears in every modal state, with View full details
appearing exactly once; tiles keep 44px targets, wrap under enlarged text
rather than truncating labels.

**The thumbnail.** Thumbnail reuses front cover alone
(`SleeveCover`), scaled down from authored 968px art size (to 220px;
124px on mobile; 104px below 380px). Same component as
exported poster's cover, not approximation. Wrapper belongs to
Ritmo Vivo: sits on night card with drop shadow, small radius,
hover lift and tilt, while sleeve art inside stays flat.

#### Feed Cut

Feed cut is fixed geometry: 728px square cover beside 232px
**spine** carrying date, and below them back cover, whose 232px
right column holds QR directly under spine. Cover title sizes
scale by 728/968 (×0.752) from story sizes.

Every feed track is one line (long values end in ellipsis), so no fact
can move another region. Feed cut omits "Side A"/"Side B" labels
(track numbers still print red), shortens QR call to "Scan", drops
address note. Story cut keeps wrapped values, side labels and
address note.

#### Compilation pressing

Weekly itinerary is **compilation LP**, extending Sleeve rather
than inventing fourth identity. `ShareableItineraryPoster` and
`ItineraryCover` retain flat print, cream stock, Shrikhand only in
title band, Barlow Condensed tabular tracks, red back-cover accents.
Masthead reads "Salsa Segura" / "The Week", with catalogue
`SS-W<ISO week> · <city code>` and week-range sticker.

**The Tile-Frames-Keep-Pressing Rule.** Cream cover holds up to four
featured flyers in mosaic; every tile retains own event-type
pressing frame. No invented week-wide event type. Fewer flyers
use smaller grid; empty cover uses deterministic fallback art.
Spotlight selection takes featured nights in **Fri, Sat, Thu, Sun, Wed,
Tue, Mon** priority, then displays selected nights in chronological
week order, consistently across mosaic and link-card tracks.

**Three cuts, one edition.** Story is **1080×1920**: masthead, square
compilation cover, then Side A (Mon–Thu), Side B (Fri–Sun), QR and
canonical itinerary link printed without scheme. Each populated night
prints featured pick, otherwise top-ranked alternative; empty
nights omitted. More than five populated nights invokes dense
story track treatment so full week retains room for cover and QR.
Feed is **1080×1350**, preserving 728px cover, 232px date-range spine
and QR beneath spine; tracks stay one line with ellipsis.

**1200×630 link card** is dedicated gatefold: **285 / 630 / 285px**.
Centre square keeps same cover, title and week sticker so square
crops retain edition. Left cream panel carries masthead,
city and date range; right lists up to four spotlight nights in week
order. Card track titles may wrap to **three lines**, not forced single-line
ellipsis. No QR: card is already a link. Stored as JPEG at
most 300KB for link previews, not offered as third downloadable poster.
Story/feed exports and stored card all derive from same edition
and canonical URL; no client host or metro alias changes destination.

#### Pressings

Sleeve uses flat spot-colour field chosen by event type — never
decoration, always type.

- **Social pressing** (`#d7263d` field / `#a8182c` deep, on cream
  `#f4ecd8`): default social night.
- **Class pressing** (`#f2b705` mustard field / `#c99400` deep, on
  midnight `#1b1b3a`): recurring classes.
- **Workshop pressing** (`#1b1b3a` midnight field / `#10102a` deep, on
  mustard `#f2b705`): workshops and intensives.
- **Live Music pressing** (`#ffb690` field / `#bf5300` deep, on dark
  orange `#552100`): live music events.
- **Cream stock** (`#f4ecd8`): back cover's paper ground on every
  pressing, printed in midnight ink with red (`#d7263d`) side labels and
  track numbers.

**The Pressing-Codes-Type Rule.** Field colour is only signal of
event type on poster; never reused for anything else on
sleeve. Red (`#d7263d`) is the one accent on cream back cover of every
pressing — side labels (story) and track numbers — so back cover
reads same regardless of which field it backs.

### Listings Desk

Operator overviews — admin, moderator, host — built from
`src/components/desk/` (`OperatorDesk` for admin and moderator
overviews; `HostDashboard` composes same primitives). Desk is
standing rule over two measures: **galley** (entries awaiting
decision) and **set column** (the week).

**Agate setting.** Desk sets listings like printed club-listings
column: small, dense, rule-separated, with tabular lining numerals so
figures align down column (`font-variant-numeric: tabular-nums`).

- **Agate** (Be Vietnam Pro, 0.8125rem/1.35): every listing row.
- **Entry title** (Be Vietnam Pro 700, 0.9375rem/1.3): name of a night.
- **Desk label** (Epilogue 700, 0.6875rem, 0.14em, uppercase): measure
  titles, day headings, count labels, state flags.
- **Figure** (Epilogue 800, 1.375rem, -0.02em): counts in the rule.

**Rules, not cards.** Desk declares **no elevation at all**. No
cards, no panels, no shadows on desk surface; hierarchy comes
from rules and measures. 2px rule closes masthead and separates
major regions, 1px rule separates divisions and entries, 1px
vertical rule divides two measures. Open entry marked by
change of ground (`--admin-surface-subtle`), never by lifting it.
Galley and set column are column of type; card around entry
destroys vertical read proof marks exist for.

#### States

Desk runs on `.admin-shell` neutral tokens (light and dark
themes) plus five state colours that are **law**: one colour per state,
used for state and nothing else. Tokens defined on `.desk`
(`desk.css`), with dark values under
`.admin-shell[data-theme="dark"] .desk`.

- **Unset** (`#b45309` light / `#fbbf24` dark): entry awaiting decision.
- **Set** (`#047857` / `#34d399`): published and in week.
- **Killed** (`#b91c1c` / `#f87171`): rejected or cancelled.
- **Standing** (`#475569` / `#94a3b8`): draft, held.
- **Tonight** (`#be123c` / `#fb7185`): running today.

**The State-Only Rule.** These five never decorate. Operator learns
colour once, then reads column of marks without reading
label; borrowing one for emphasis destroys exactly that.

**Margin marks.** Every listing hangs off drawn mark in margin:
open ring for unset, closed disc for set, diagonal spike for killed,
hollow square for standing, ringed disc for tonight. Authored
SVG geometry, never glyphs or emoji, each labelled for assistive
technology where it is sole carrier of state on its row.

Sidebar's pending counts (Organizer Requests, Founder Requests) are
Unset work and wear this colour. Rose in sidebar is wayfinding only,
current page's icon and focus ring, never state.

#### Controls

**The Agate-Rows-Only Rule.** Listing scale governs rows and nothing
else. Every control operator hits at speed stays at full UI size —
34px minimum with fine pointer, 44px below 640px and on coarse pointers
— because reading load belongs to state palette, not type
size.

**Decisions.** Approve and Reject use set and killed colours as
border and text. Rejection opens existing reason dialog, which is
genuine protected-focus work; approval does not interrupt.

**Set in place.** Deciding entry never routes, never toasts.
Row leaves galley, entry arrives in column at true date
position, count in standing rule drops — one propagation, one
meaning. Reject strikes title through before row goes.

**The undo dock.** Deciding on Events list is undoable for six
seconds; outcome announced to assistive technology. Notice
docked under list, sticky and in page's flow, never floating
over it; the one sanctioned exception to "never toasts" because
undo needs place to live. Names what happened in past tense, offers
Undo (also Ctrl/Cmd+Z), and after decision focus moves to next
row's Approve. Bulk Approve and Reject on Pending Review use same
dock.

**Focus swells, the rest compresses.** Opening entry expands it in
place to full working detail (flyer, description, submitter, address)
while siblings drop thumbs and tighten. No separate
review page to lose position in.

#### Responsive Behavior

**Two measures and a fixed week.** Set column is fixed **seven
divisions** from today; day with nothing in it still occupies its
division, so thin week looks thin instead of collapsing into tidy
short list. Every entry pinned to true position on that one time
axis; division head owns day while entry states only its
time.

Hanging indents constant: 22px margin column for proof mark,
14px gutter, 44px flyer thumb where entry carries evidence.
Below 1024px (`max-width: 1023.98px`) two measures stack rather than
narrow — agate column squeezed under its measure stops being readable.
Below 640px standing rule collapses to one column and controls grow to
44px.

### Operator / Admin

Everywhere operator works outside desk — record tables, forms,
detail pages, dialogs, settings — inside `.admin-shell` light and dark
themes. No glassmorphism, glow, or dark slate ground reaches these
surfaces.

**Category chips are not state.** Taxonomy categories (attendee type,
dance style) labelled by `--admin-chip-*` palette in
`src/styles/admin.css` — one tint/ink pair per hue, light and dark. Chip
names category, never reports entry's state; five desk
colours stay reserved for state.

#### Shell

**Operator location stays visible.** Admin and host topbar retains
current location at phone widths; only parent role and separator
disappear below 640px. Label can ellipsize without shrinking
navigation or account controls. Admin queue labels match sidebar
destinations, including nested submission and founder-request records.
Bulk Upload has own location label. Each sidebar marks only most
specific available destination as current; parent and child links never
compete for active state.

**Desktop collapse recovers workspace.** At 1024px and above, saved
collapse preference changes sidebar from full width
(`clamp(260px, 16.25rem, 360px)`, 260px at default text size) to
72px rail. Sidebar width, topbar left edge, main-content margin
follow same shell-scoped `--admin-sidebar-w`, recovering 188px of
workspace at default text size. Rail links retain full accessible
names; visual labels clipped rather than removed from
accessibility tree, with native title hints for pointer discovery.
Toggle exposes its state and controlled navigation. Below 1024px,
saved preference never narrows labelled drawer or adds content
offset. Returning to desktop restores chosen rail state.

**Navigation is grouped by what it governs.** Admin sections: Desk
(queues, including Listing Claims), Events, Directory (Schools, Venues,
Artists, DJs, Organizers), People, Platform. Host navigation gives
organizer tools own Organization section, then one section per
managed listing titled `{Kind} · {Name}`: school carries Overview,
Timetable, Privates, Prices, Profile and Team; venue, artist or DJ carries
Overview, Profile and Team. Profile appears only for owners and managers,
Team only for owners. Inside listing, same pages repeat as in-page
tabs so platform admins (who keep admin sidebar) can move between them.

**The school timetable is a fixed week.** Like set column, always
shows seven divisions Monday to Sunday; empty day keeps its division
and its Add class control. Classes, privates, price plans edited in
place, never on separate route.

**Operator account actions are usable, not placeholders.** Account
disclosure stays within viewport, scrolls when height limited.
Escape closes it and restores trigger focus. Outside pointer interaction,
focus leaving disclosure, or route navigation closes it without
pulling focus away from user's next action.

Topbar panel is identity-first: 48px profile photo or initials,
display name, clipped email, existing role badge. Profile presentation
comes from shared own-profile query; role comes from AuthContext,
never profile display field. Account and View site use icon-led rows with
short supporting text. Appearance retains native disclosure, offers
System, Light, Dark as three equal radio targets. Controls scoped
to topbar panel; drawer keeps existing theme layout.

Panel at most 340px wide, bounded by viewport, scrollable in
short windows. Uses only admin light/dark tokens and border-only
elevation—no public palette or glow. Avatar trigger stays 44px; menu and
theme actions are 64px targets, with inset focus rings that stay visible
inside scrolling panel.

Both topbar and drawer link Account to `/account`. Existing sign-out
scopes stay explicit: topbar says "Sign out on all devices"
(`global`); drawer says "Sign out on this device" (`local`). Pending
requests disable repeat activation. Failures announce in-place alert
and allow retry. Topbar reveals alert and retry action together,
including when reopened or viewed with enlarged text in short viewport.

#### Cards

`.admin-card` is sanctioned container for record surfaces. Listing
column and edit form are different jobs: form needs stated edge
because it bounds set of fields operator is committing; detail
page needs one because it separates record from page around it.
Forcing agate treatment onto them would make both harder to use.

So boundary is by job, not URL:

- **Desk surfaces** (standing column of entries): rules and measures,
  never card. Ground change marks state; nothing lifts.
- **Record surfaces** (form, table, one record, dialog):
  `.admin-card` is correct, bounded by three rules — one level deep,
  never nested, border-only elevation, never card per row where
  table belongs.

**The One-Device Rule.** Border or shadow, never both. Operator cards
chose border.

`AdminMetricCard` remains the one figure-card exemption, confined to
analytics page. Inventory figures (total users, total venues, total
events) belong there; desk reports work, not scale.

#### Tables

Table is container for its rows, sits in at most one
`.admin-card`. Never give each row own card where table belongs.

##### Entity directories

Directory pages (Schools, Artists, Organizers, Series —
`AdminEntityDirectoryPage`) are reference record table.

**One card, filters on top.** Single `.admin-card` bounds search
form and table. Filters sit on ruled band at top of
card; table runs full-bleed beneath. Card carries no
padding of own so table rules meet its border. Load errors
surface as `.admin-banner--error` with Try again above card, never
inside it.

**The name is the row header.** Each row opens with `<th scope="row">`
holding record link (strong ink, no underline until hover) and,
beneath it, public URL slug in Identifier face (`--font-mono`),
or "No public URL" when absent. Columns follow: City, Events
(right-aligned, tabular figures), Quality (warning-tint flag chips, or
muted "Complete"), Status (pill, shrink-to-fit).

**State on the leading edge.** Row needing decision is findable by
shape, not only pill: `needs_review` rows carry 3px amber
(`--admin-warning-dot`) inset rule on leading edge, `suspended` rows
red (`--admin-danger`) one. Archived is resting state, not fault:
pill neutral (surface-secondary ground, muted ink),
secondary cells drop to muted. Danger tint reserved for `suspended`.

**Tally line.** Under page title, one muted line reports
"{n} {kind} · {n} need review · {n} with quality flags", with "matching"
appended while filter active. Counts only rows server
returned for current query and status; never claims platform
total; hides while loading, on error, or when list empty.

**Empty states name the next action.** With search or status filter
active: "No {kind} match these filters", query echoed back, and
Clear filters button resetting both. With no filter: "No {kind} yet"
and pointer to page's Create {kind} action.

**Phone reflow (≤720px).** Table stays one DOM; header row
visually hidden, each row reflows into stacked record on grid:
name and slug with status pill top-right, then city and "N events"
side by side in muted ink ("events" unit appears only here), then
flag chips.
Row with no quality flags drops Quality line visually, but cell
stays in accessibility tree (clipped, never `display: none`) so every
row keeps one cell per column header. Native table roles survive this
reflow in WebKit 18.4 without ARIA overrides. Leading-edge state rule
moves from name cell to whole row. Filter band collapses to
one column.

#### Forms

Form sits in one `.admin-card` bounding fields being committed.
Record IDs, hashes, raw payloads, submission diffs inside form use
Identifier face (`--font-mono`).

#### Record Pages

Detail page separates one record from page around it with one
level of `.admin-card`, uses Identifier face for anything read
character by character. Decision desk's galley can carry in place
(approve, reject) never requires routing to record page.

#### Weekly itinerary curation

Itinerary list and editor are **Operate** surfaces inside
`.admin-shell`, available to active admins and moderators through
Desk navigation. Drafts / Published / Archived tabs, week/city/title/status/
event-count/updated columns and ordinary record actions reuse existing
admin table, pagination and confirmation vocabulary, not public glass cards.
Archive withdraws edition; published past week remains public guide.

Editor separates **Week & words**, approved city/week **Find events**,
and seven-night **Schedule**. Title, introduction, recommendations
remain editable prose. Featured/alternative choice, within-night rank,
notes, removal and deliberate "No featured pick" controls belong beside
their night. Warnings remain inline and summarized; missing, cancelled,
private or out-of-week pick blocks publication rather than fabricating facts.
Plain flyer thumbnails stay plain images, not mini Sleeves.

Wide layouts pair editing with sticky preview; narrow layouts use
Edit/Preview tabs. Public guide preview clearly labelled
"Draft — not public"; poster preview is explicit Sleeve boundary.
Save explicit with unsaved-change guard. Publishing generates and
uploads gatefold before changing status; failures remain visible and
retryable. After later event changes, public reads omit unavailable or
out-of-city/week items and suppress stale covers until regeneration.
No automatic server-side render or recall of already-shared files implied.

### Retail / Shop

Masthead reads “Shop” in Great Vibes 400, same font as Salsa
Segura wordmark, links back to `/shop` landing. Uses Gold Light
ink at `clamp(2.75rem, 4vw, 3.5rem)` with 1.4 line-height and padding in
`em` (0.15em, with 0.4em on right), so clearance for flourishes
grows with type, enlarged text included. Tracking
normal, case unchanged. Between wordmark and cart pill sits
collection row (Shopfront, Men, Women, Accessories, Shoes). Shopfront
is `/shop` landing, matched exactly. Full grid at `/shop/all`
reached from landing's calls to action and Keep browsing, never only
from hover menu. Row labels uppercase UI-face 0.75rem/700 at 0.14em;
current entry gets gold ink with 2px gold underline. Below 900px
row moves under wordmark and scrolls sideways behind fade edge,
and header wraps by content: when wordmark and cart pill no
longer fit side by side (narrow screens, enlarged text), pill drops to
own line. Pill's count circle sized in `em` so digit stays
inside at any text size.

Site header's Shop disclosure lists same entries plus Cart row,
all from `SHOP_NAV` in `src/features/shopify/collections.ts`. In mobile
drawer, Shop is collapsible group. Shop label still navigates to
`/shop`; 44px chevron toggle beside it shows or hides
collections. Group starts collapsed, except on `/shop*` routes, where
it opens to show current collection.

Mobile dock is Home, Calendar, Shop and Me. Inside shop (`/shop`
and `/shop/*`) Shop tab becomes Cart, in-place action rather than
route. Opens cart drawer, carries gold item count matching
shop's cart pill, returns focus to itself on close. Submitting event
lives in header drawer.

Retail Edit is shipping design for `/shop`, `/shop/:collection` and
`/shop/products/:handle`, in Ritmo Vivo, composed as **the Merch Table**:
shop is table at back of social, real pieces laid on one lit
navy surface, priced and buyable where they lie. Display type is
self-hosted Barlow Condensed (`@fontsource`, weights 600/700), set in
**sentence case** ("Wear the rhythm."), never all caps. Gold marks
wayfinding and catalog actions only: price hang-tags, cart count, selected
sizes and filters, Shop everything and closing links. Headline words
never take gold. Add to cart is Rose Red everywhere (landing table,
product page) and Checkout is Rose Red in cart drawer; rose
spent on actions only. Lead media carry one signature shape: single
swept top-right corner (64px on table's lead piece and product
gallery, 48px on collection heroes and phones) over 4px elsewhere.
The one radius outside scale, deliberate, never applied to cards,
buttons or panels, which use `--radius-sm` (4px), `--radius` (8px) and
`--radius-xl` (24px, the filter sheet's top corners). Lead paragraphs set
1.125rem; mobile hero heading capped at 21vw so longest word
stays on screen under enlarged text.

**The table** (`MerchTable.tsx`, `merch-table.css`). Surface is
`--surface` lifted to `--surface-high` at top edge, 8px radius, 1px
inner highlight, one soft offset shadow; starts 44px below
pieces so they read as laid on it. One work light hangs over it: radial
of gold at 13% fading out, no new hue. Every product tile on table is
white with `object-fit: contain` and carries **hang-tag**: gold fill,
`on-secondary` ink, Barlow Condensed 700 price, navy eyelet, tilted -4°
(-3° on lead), hanging off tile's corner. Tags are price's only
visual form on grids; link's accessible name carries price. Grids
sitting on table (New arrivals, collection results) take
`.retail-catalog__grid.merch-surface`.

Landing's first viewport is headline column (a third) beside
table (two thirds) with up to five pieces: lead, 4:5 and largest, in
middle column, two either side with staggered offsets. Lead is
first piece one size choice can buy; shows Size radiogroup (no
size checked) and Add to cart. Add with no size moves focus to first
size and says "Choose a size first."; confirmed add opens cart
drawer. Below 700px lead spans row and rest go two-up.
Collections follow as table's front edge: Men, Women, Accessories,
Shoes in Barlow Condensed 700 at `clamp(2.5rem, 5vw, 4.5rem)`, each with
real count in gold (muted for Coming soon), underlined in gold on
hover. On load tags swing once on eyelets and settle (GSAP,
elastic ease); reduced motion renders them at rest.

**Shopify is the catalog.** Collections are Shopify collections, resolved
by handle; frontend never lists product handles.

- `/shop/all` is the one virtual handle: whole catalog, Shopify's
  best-selling order by default.
- `collections.ts` carries only route copy (label, headline, fallback
  description, empty-state copy) for five named routes.
- Named collection Shopify hasn't published shows own honest empty
  state. Unknown handle names itself "Collection not found" in
  heading, breadcrumb and tab title, with single Shop all recovery and
  no Keep browsing row. Empty cart drawer's description is
  first-dance line itself, not review-your-items copy.
- Table leads with Shopify's automatic `frontpage` (Home page)
  collection and fills its five places with newest pieces
  (`CREATED_AT` descending, featured ones removed); list named
  "Featured and new", or "New arrivals" when nothing featured. New
  arrivals row below holds next four newest.
- Collections show real product count, or "Coming soon" when
  collection missing or empty, and "Unavailable" when listing
  request fails.
- No Bestseller or New badges; sales data and arrival badges
  don't exist. Sold out is only card badge.

**Collection pages** pair 240px sticky filter rail with grid.
Below 1100px rail becomes Radix bottom sheet whose foot reports
live result count. Facets come only from Shopify data, never from
product titles:

- Product type, grouped by loose key because merchant's types are
  free text.
- Size option (any option whose last word is Size, so "Shoe Size"
  counts), normalised (`xxl` becomes `2XL`) and ordered XS→5XL.
  Numeric sizes (shoe sizes, e.g. 37, 8.5) sort by value ahead of letter
  sizes, so mixed footwear/apparel list reads by number. Unknown
  spellings (e.g. "One Size") sort last. Chips read merchant's own
  spelling; matching and URL keys stay normalised.
- Color option, with merchant swatch colours when set, text chips
  otherwise. Group starts collapsed above ten colours.
- Maximum price, and In stock only.

Size, colour and stock must hold on same variant. Filter and sort
state live in URL. Active filters repeat as removable chips;
filter set with no results offers Clear filters.

Product grids use three columns above 700px, two from 381px to 700px.
Landing's New arrivals row uses four. At 380px and below grid is
one column. Card media is square, whole-product merchant photography with
`object-fit: contain`. On fine pointers second merchant image fades in
on hover. Price hangs on tile as tag (exact when every variant
costs same, otherwise "From <lowest>"); caption carries real
name and colour and size summary. Whole tile is link; no
separate View product action.

Quick add appears on hover or keyboard focus with fine pointer.
Offered only when size is product's sole choice, so one click names
exactly one variant. Touch devices never get it; size choice lives on
product page. No customer photos, shipping promises or scarcity claims
manufactured.

GSAP choreographs readable hero words and section headings; every split
heading keeps one unsplit accessible name. Catalog-only Lenis smooths
wheel input, with native touch scrolling, dialog exclusion, media/font
measurement refresh, cleanup on unmount. Reduced motion skips both
engines and renders final states. Solar icons by 480 Design bundled
locally through Iconify, attributed under CC BY 4.0 at bottom of
each shop page. The one place icons do not come from Lucide.

Product page opens with same masthead (wordmark, collection row and
cart pill, which is also add-to-cart flight target), then breadcrumb:
Shop › product title. Breadcrumb links keep 44px targets. Grid and editorial
media square to match merchant photography. Active-filter chips are
44px high.

Product page is one piece from Merch Table seen up close, in same
`.retail-catalog` container and masthead as landing and collections.
Gallery's main image sits in white tile (object-fit contain, swept 64px
top-right corner, 48px on phones) on lit `.merch-surface`; thumbnails stay
keyboard-selectable on that surface. Beside it, sticky purchase column runs
title (Barlow Condensed 700, sentence case, `clamp(2.75rem, 4.2vw, 4.25rem)`,
line-height 0.95, balanced), price on static gold `.merch-tag` hang-tag
(its text is accessible price), option groups, quantity and purchase
button, Shopify checkout line and Product details disclosure.
Option groups are named chip radiogroups, not native selectors: each group is
`role="radiogroup"` labelled by its micro-label, each value a `role="radio"`
button with `aria-checked` and roving arrow-key focus (arrows move and choose;
Tab reaches one chip per group). Chips at least 48px; checked chip is
gold. Colour uses round swatches (named by `aria-label`, selected name shown
beside label) only when merchant set swatch colour for every value,
otherwise text chips. Size chips follow catalogue size order. Changes
preserve other selections when available, otherwise resolve to
available variant. Sold-out values stay visible, named "…, sold out",
disabled with line-through.
**Size is never chosen for the shopper.** When Size has more than one value
no chip checked, availability line withheld, price reads
lowest for current colour ("From …" when sizes differ, compare-at
hidden), and purchase button reads "Choose size" and focuses first
enabled Size chip instead of adding.
If colour change can't keep chosen size, size is cleared and
status line under chips says so ("M isn't available in
Rose. Choose another size.") — never swapped silently. "Fit & fabric"
beside Size label opens merchant's Product details; no size chart
shown because store supplies none.
Option names are uppercase UI-face micro-labels (12px/700, 0.12em tracking);
read-only values use 16px body type. Availability shares micro-label voice.
Product details live in native disclosure. On phones purchase bar is
pinned above public dock and safe area from first paint at normal text
size: product article, not content column, bounds it. Dock
height already includes bottom safe area; bar uses larger of
that height and safe-area inset, never their sum. When bar grows
taller than a third of viewport (enlarged text, short screens) it stops
pinning and scrolls in flow, so it never covers fields it points to;
"Choose size" and Change also scroll focused field clear of pinned
bar. Enlarged text lets summary and purchase controls wrap into
additional rows; full button stays reachable by scrolling.
First row restates what Add will buy (selected values in gold,
price, and Change action focusing first option group's checked chip);
cart feedback appears inside bar, and floating city pill is hidden
on product pages below 768px. Wider and short landscape viewports use
in-flow bar without summary row. Cart is
protected-focus drawer with real Shopify totals and hosted-checkout
handoff. Confirmed product-page add opens this drawer automatically, just
like quick add: shoppers can review named item, size, quantity and total
and continue with Checkout with Shopify. Escape or Close returns focus to
Add. Pending and failed adds never open drawer; failures retain
inline retry message and return keyboard focus to Add. Stock-adjusted
successful adds open it with Shopify's
warning and authoritative cart. Handoff also works with reduced motion.

Shared-image navigation and confirmed-add flight preserve direct
navigation and purchase behavior under reduced motion or unsupported
APIs. Flight sits below cart modal, never covering checkout
controls. Styles and components live with production pages/cart; no
query-selector switcher, discarded Drop Grid, or preview-only production
branch remains. All photography is merchant-supplied Shopify CDN imagery,
not generated assets. Missing product media retains deterministic named
fallback. When JavaScript disabled, static app shell provides
merchant-store link instead of blank page.

### Accessibility

**Touch targets.**

- Public controls keep 44px minimum: header menu button, dock tabs,
  every visible calendar control, submission fields, shop option selectors,
  and buttons (`min-height: 44px`).
- Operator account controls keep 44px: topbar's 32px avatar sits
  inside 44px disclosure target; account links, Appearance and theme
  options at least 44px high.
- Desk controls 34px at desktop widths with fine pointer. Grow
  to 44px below 640px and under `pointer: coarse` at any width (touch
  laptops, tablets with keyboards). Hit area grows; agate type does
  not.

**Skip links.** Admin and host shells start with "Skip to content,"
moving focus to `#admin-main`; next Tab continues into workspace
rather than through sidebar. Public pages share same focus-moving
skip link; home page's destination reads "Skip to events."

**Dialogs and disclosures** trap or contain focus while open and restore
it to trigger on dismissal: public mobile menu, calendar
submission dialog, cart drawer, desk's reject dialog, and
operator account disclosure (which closes on Escape).

**State is never colour alone.** Desk margin marks carry state by shape
as well as colour; each mark labelled for assistive technology
where it is sole carrier of state on its row.

**Reduced motion.** Every authored motion under Components names its
reduced-motion path; under `prefers-reduced-motion: reduce` movement
removed and selection changes land at once.

## Do's and Don'ts

### Do

- **Do** keep visual languages separate: Ritmo Vivo for anything
  dancer sees (site and shop), The Listings Desk and `.admin-shell` record
  surfaces for anything operator works in, The Sleeve for the one
  artifact that leaves site.
- **Do** state only counts representing work in desk's standing
  rule. Pending decisions, requests, flags are work.
- **Do** hold five state colours to state alone, in both light
  and dark `.admin-shell` themes.
- **Do** keep operator controls at 34px or larger (44px on touch) even
  though rows around them set at agate scale.
- **Do** let decision propagate once, across galley, column and
  counts together.
- **Do** press event type to field colour alone (red social, mustard
  class, midnight workshop, orange live music) and print back
  cover's side labels and track numbers red on every pressing.
- **Do** set Sleeve in Poster Lettering (titles) and Poster
  Condensed (everything else), never Epilogue or Be Vietnam Pro.

### Don't

- **Don't** put KPI stat-card grid on operator surface. Inventory
  figures belong to analytics page; desk reports work, not scale.
- **Don't** add cards, panels, or shadows to desk. Rules and
  measures do dividing.
- **Don't** nest one `.admin-card` inside another, and don't give each
  row of table own card — table is container there. Card
  is for form, record, or dialog, one level deep.
- **Don't** use glyphs or emoji as marks or icons anywhere. Marks are
  drawn geometry; icons come from Lucide set already in use (shop's
  attributed Solar set is the one exception).
- **Don't** shrink control to match agate type, and don't grow agate
  type to match control.
- **Don't** route operator to separate page for decision
  galley can carry in place.
- **Don't** let Ritmo Vivo's glassmorphism, glow or gradients reach
  Sleeve, and don't let Sleeve's flat fields leak back into Ritmo
  Vivo.
- **Don't** show Sleeve outside event/itinerary exports, itinerary
  link card, and their explicit modal/editor thumbnails or previews.
- **Don't** add shadow anywhere on poster; Sleeve prints flat.

### Profile edit access

Public school, artist, venue, organizer and series pages expose secondary
Edit action beside identity for platform admins, linking to existing
admin record editor. School, artist and venue owners/managers receive
same action linked to their workspace Profile editor; editors and unrelated
visitors do not. Signed-in member's own `/profile` exposes Edit profile
at identity header, alongside existing photo and cover controls.

### Event detail refinements

Unknown prices leave no placeholder on event pages. Action strip keeps
address text flexible and reflows actions into full-width touch targets on
phones. Event title and album headings follow 32–48px and 24–32px ramps.
Instagram Story help is bordered, text-token tooltip above its trigger,
revealed on pointer hover or keyboard focus, not permanent body copy.
Stays open while hovered, closes on pointer leave or blur; Escape
dismisses it without moving focus. Sharing and preview behavior unchanged.
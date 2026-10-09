---
version: alpha
name: Salsa Segura Design System
description: >-
  Boston & NYC Latin dance events calendar. Three visual languages: Ritmo
  Vivo (public site and shop), The Listings Desk (operators), and The Sleeve
  (the exported event poster).
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

Salsa Segura is one product with three visual languages, applied across
five areas. They do not mix. Each area's rules live under Components.

| Area              | Visual language                 | Who it is for                     |
| ----------------- | ------------------------------- | --------------------------------- |
| Public Experience | **Ritmo Vivo**                  | dancers browsing the site         |
| Retail / Shop     | **Ritmo Vivo** (Retail Edit)    | dancers buying merchandise        |
| The Sleeve        | **The Sleeve** (printed matter) | whoever a poster is sent to       |
| Listings Desk     | **The Listings Desk**           | operators: admin, moderator, host |
| Operator / Admin  | `.admin-shell` record surfaces  | operators                         |

The desk exists because a curation back-office is read for hours in a lit
room, while Ritmo Vivo is built to feel like a dark dance floor. The Sleeve
exists because a poster is judged against other posters in a story or a
group chat, not against the site around it.

**The Boundary Rule.** The Sleeve never appears as site UI — only as the
poster export itself and its thumbnail/preview inside the event modal.
Ritmo Vivo's glassmorphism and glow never enter the poster, and the
Sleeve's flat spot-colour fields never leak back into Ritmo Vivo. Do not
apply glassmorphism, glow, or the dark slate ground to an operator surface;
do not apply agate listing rules to a public one.

Ritmo Vivo captures salsa's movement, passion and community. The
personality is extroverted and rhythmic, balancing the heat of the dance
floor with the reliability of a calendar people plan their week around.
The visual style is **High-Contrast / Bold** blended with
**Glassmorphism**: deep backgrounds and vibrant pops of colour simulate the
atmosphere of a dance social, while large-scale type and translucent
overlays suggest motion and depth.

## Colors

Ritmo Vivo is a warm palette on a cold ground: rose, gold and orange lit
against deep navy slate, the way stage light reads in a dark club. On the
public site colour has four jobs: action (rose), wayfinding (gold),
event type (the four type hues) and error. Atmosphere comes from the
ground and the glass, never from extra hues.

The frontmatter keys the base palette by its Material 3 role names from
the original Stitch export; `src/styles/global.css` names the same values
differently (`--bg` is `surface`, `--surface` is `surface-container-low`).
The mapping sits in the frontmatter comment. Working tokens M3 does not
name keep their CSS names (`red-bright`, `blue-deep`, …).

### Primary

- **Rose Red** (`--red` #e11d48; token `primary-container`): primary
  buttons, the New event CTA, the dock's selected icon box and critical
  brand moments, always with white text (4.70:1). The `primary` token
  (#ffb3b6) is its M3 light tone, kept from the export.
- **Rose Deep** (`red-deep` #be123c): the primary hover fill and the
  solid Social badge ground, where `--text` holds 4.87:1.
- **Rose Bright** (`red-bright` #ff5874): rose as text and line on the
  dark ground (6.08:1 on `--bg`). It is the default focus ring (the global
  `:focus-visible`, buttons, navigation, forms, calendar list rows), the
  Social type colour and small rose labels.
- **Rose glow and tint** (`red-glow` 30%, `red-dim` 18%): the neon shadow
  under active rose elements and rose-tinted borders. **Decision ground**
  (`surface-action` #281b31) is rose at 10% resolved over `--surface` and
  stated as a solid, so text contrast on it is fixed (`--text` 12.61:1)
  instead of depending on what a translucent layer covers.

### Secondary

- **Gold** (`--gold` #e9c349; token `secondary`): links, secondary
  buttons, the shop's catalog actions, and the focus ring on the
  calendar's buttons, inputs, selects and Filters disclosure. Text on a
  gold fill is `on-secondary` (#3c2f00, 7.74:1).
- **Gold Light** (#ffe088; token `secondary-fixed`): gold as small text,
  such as the "Just approved" badge on its `gold-dim` pill and the
  Workshop chip, and the focus ring on the skip link and the logo.

### Tertiary

- **Warm Orange** (`--tertiary` #ffb690): bridges red and gold in
  gradients and hover states, and is the Live Music type colour. At 15%
  (`tertiary-dim`) it tints dance-style chips, compositing to #302b36
  under white text (13.78:1).

### Neutral

- **Deep Slate** (`--bg` #0b1326): the dark base that lets the warm tones
  glow, like a spotlight on a dark stage. Opaque surfaces step up to
  `--surface` (#131b2e) and `--surface-high` (#171f33).
- **Glass**: raised cards are white at 8% (`card`, 12% on hover) with
  white borders at 10%, 16% and 24% (`border`, `border-md`, `border-lg`).
- **Text**: `--text` (#dae2fd) carries body copy. Secondary copy is
  `--text-muted` (#e5bdbe), a rose-tinted neutral rather than grey, so
  quiet text stays in the warm world; `--text-dim` (#ac8889) is the
  tertiary step. On glass cards `text-dim-glass` (#c5a3a4) replaces it,
  because the card composite would otherwise pull it under 4.5:1
  (5.98:1 on the composite).
- **Error**: `red-error` (#ff8080) for error text on dark grounds,
  `red-error-strong` (#ffb3b3) for error headings and error-link hover,
  `red-line` for error banner borders.

### Event types

Each event type owns one hue, set in `CALENDARS_CONFIG`
(`src/features/events/model/calendarsConfig.ts`). The calendar always
runs dark (`isDark: true`), so each type carries only Schedule-X's
`darkColors` set; a light set would never render.

| Type       | Main (`event-*`) | Container / on-container | Card chip text | Solid badge                    |
| ---------- | ---------------- | ------------------------ | -------------- | ------------------------------ |
| Social     | #ff5874          | #7a0a26 / #ffd9df 8.55:1 | `red-bright`   | `--text` on `red-deep` 4.87:1  |
| Class      | #7c93e9          | #2a3566 / #dfe3ff 9.21:1 | `blue-pale`    | `--text` on `blue-deep` 7.75:1 |
| Workshop   | #e9c349          | #574500 / #fff0c2 8.20:1 | `gold-light`   | `on-secondary` on gold 7.74:1  |
| Live Music | #ffb690          | #783200 / #ffdbca 7.20:1 | `tertiary`     | `--surface` on orange 10.09:1  |

The main colour marks type as swatch and line: the sidebar's swatches and
share rails, a list row's leading edge and type label (`--event-color`),
and Schedule-X's event accents. The container pair paints Schedule-X's
month and week event blocks. Card chips set the type in a lighter tone of
the same hue on a translucent navy pill (navy at 90%, so over the
lightest flyer `red-bright` still holds 4.66:1); the featured card's solid
badge (`badge-event-*`) fills with the deep tone.

**The Hue-Is-Type Rule.** Three type hues are borrowed brand hues (rose,
gold, orange); indigo is the one hue that exists only for a type. `blue`,
`blue-mid`, `blue-deep` and `blue-pale` carry no brand role and appear
only for Class. The single exception is `blue-pale` as the information
fallback in entity review outside the admin shell.

### Scoped palettes

Three palettes are scoped to one area each and documented there: the desk
state colours (Components › Listings Desk › States; `desk-*`), the Sleeve
pressings (Components › The Sleeve › Pressings; `sleeve-*`), and the
operator category chips (Components › Operator / Admin; `admin-chip-*`).
The `.admin-shell` itself runs on its own light and dark neutrals, rose
brand and feedback inks (`admin-*`, `-dark` for the dark theme). Its rose
splits by job: `admin-brand` (#e11d48) is the fill under white labels in
both themes, while `admin-brand-text` deepens it for text on light grounds
and brightens it on dark ones.

## Typography

The typography strategy is "Rhythmic Hierarchy." **Epilogue** provides a
geometric, editorial weight that feels decisive and bold — the "hit" of a
beat. **Be Vietnam Pro** offers a warm, approachable counterpoint for
long-form content such as event descriptions and listing details.

For large display text, use tight letter-spacing for compact, high-energy
impact. Labels and overlines are uppercase with generous letter-spacing,
providing structural contrast to the fluid imagery of dance.

### The type ramp and the display band

UI type sits on the role ramp above, in rem (0.6875 / 0.75 / 0.8125 /
0.875 / 0.9375 / 1 / 1.125 / 1.375 / 1.5rem). Display composition above
24px is a band, not a step list: poster titles, hero figures and splash
headings set 1.5–4.5rem per surface, anchored by display-md (3rem) and
display-lg (4.5rem). SVG artwork lettering (the vinyl label print) is
artwork and answers to no ramp.

### Two faces beyond the pair

Epilogue and Be Vietnam Pro carry the system, but production ships two
more. Both are legitimate roles, not drift.

- **Wordmark** (Great Vibes): the script "Salsa Segura" lockup, and the
  only place this face appears. Declared as `--font-logo` and used by the
  header, the sign-in page, and the work-in-progress screen. It is a
  logotype, never a heading, never body copy, never a decorative flourish
  on a section title.
- **Identifier** (`ui-monospace, SFMono-Regular, Menlo, monospace`,
  0.8125rem): tabular identifiers an operator reads character by
  character — record IDs, hashes, raw payloads, submission diffs.
  Declared as `--font-mono`. Monospace here is for data that must align
  and must not be misread, never a costume for "technical".

Both are operator- and chrome-level roles. Neither is part of the public
reading experience: a dancer sees the wordmark and nothing else.

The Sleeve sets its own faces (Components › The Sleeve › Poster), the
desk sets agate (Components › Listings Desk), and the shop uses Barlow
Condensed for display type (Components › Retail / Shop).

## Layout

Spacing follows a strict 4px base unit, with large "breathing rooms"
(XXL, 80px) between major public sections so the dark UI never feels
cramped. Content is capped at `--container-max` (1280px) with a 24px
gutter. Collection layouts are fluid auto-fill grids rather than a fixed
column count (the events grid is `repeat(auto-fill, minmax(288px, 1fr))`
with a 1.25rem gap).

Area-specific layout lives with each area: the calendar's responsive
tiers, the mobile dock's clearance, the desk's two measures and fixed
week, the operator shell's collapsible sidebar, the poster's fixed
story and feed measures, and the shop's column breakpoints.

## Elevation & Depth

Ritmo Vivo establishes hierarchy through glassmorphism and ambient light:

1. **Base surface:** the deepest neutral slate.
2. **Raised cards:** white at 8% with a 12px background blur and a 1px
   border of white at 10%.
3. **Active elements:** rose elements carry a "glow" — a soft, diffused
   shadow of the same colour at 30% opacity, like neon.

Avoid heavy black shadows; use tinted shadows that inherit the hue of the
background to keep the vibrant brand promise.

The other languages are flat. The Listings Desk divides with rules, never
cards or shadows; operator record cards use a border, never border and
shadow together; the Sleeve prints with no elevation at all. See each
area under Components.

## Shapes

Ritmo Vivo is **Rounded**, on a 0.5rem (8px) base radius that balances the
hard energy of the bold type. Cards and photographs use `--radius-lg`
(16px); buttons use `--radius-xl` (24px); chips use `--radius-full`. The
Sleeve (hard-edged print) and the Listings Desk (rules) do not use this
language; see their sections under Components.

## Components

### Shared Controls

**Buttons (Ritmo Vivo).**

- **Primary:** Rose Red with white text, a subtle top-down gradient
  (#e11d48 → #be0037), and the rose glow on hover.
- **Secondary:** outlined in Gold (#e9c349); hover fills with a
  semi-transparent gold tint.
- **Ghost:** pure text with an underline that grows in on hover, like the
  rhythm of a musical bar.

All three are uppercase Epilogue labels with a 44px minimum height and the
`--radius-xl` shape.

**Rubber segment.** One selection control serves every segmented choice:
`src/components/ui/RubberSegment.tsx`. The thumb stretches over the old and
new option (190ms) and contracts onto the new one (300ms spring); reduced
motion moves it at once. The mobile dock tints it rose; the calendar's
city switch, view switcher and sidebar use the neutral `--surface-high`.

### Public Experience (Ritmo Vivo)

Everything a dancer sees outside the shop and the poster.

#### Calendar

The public calendar (`/calendar`) is a nightlife discovery stage and
community submission surface, executed in Ritmo Vivo's dark navy palette
rather than an administrative light planner. Ground is the deep neutral
slate (`--bg: #0b1326`), with `--surface: #131b2e` and
`--surface-high: #171f33` for raised areas; accents are Rose Red
(`--red: #e11d48`) on high-action buttons and Gold (`--gold: #e9c349`) on
the focus rings of the page's buttons, inputs, selects and Filters
disclosure (`outline: 2px solid var(--gold)` with `outline-offset: 3px`);
list rows keep the global Rose Bright ring.
Typography uses Epilogue 800 display for the stage header ("Dance
calendar." with a rose period dot, -0.035em tracking) and Be Vietnam Pro
for body copy and listing metadata. Tabular numerals
(`font-variant-numeric: tabular-nums`) are enforced across calendar grids,
week numbers, dates, and listing time slots so figures align vertically.

**The Read-Only Discovery Rule.** The public calendar is strictly read-only
discovery. Public visitors and dancers cannot drag, edit, or delete
listings. Approved events from the database remain the single source of
truth; all additions flow through the submission dialog into the pending
moderation queue.

**The Responsive View-Refocus Rule.** Below 769px, or on coarse-pointer
viewports below 1024px wide and at most 500px high, multi-column grids
yield to chronological list or card views. Narrow screens do not force
month cells into micro-boxes: they refocus to flyer thumbnails, event
title, time, and venue metadata. List thumbnails are 56×72px (48×62px on
compact screens): the event's flyer, or its fallback SVG, cropped with
`object-fit: cover` at an 8px radius — a plain image, not the Sleeve cover.

**The Fallback-Art Guarantee.** Flyers are optional. An event without one
falls back to one of four static SVGs in `/images/event-fallbacks/`
(`resolveEventFlyer`): `workshop.svg` for workshops, `bachata.svg` for
socials whose only style is bachata, `social.svg` for other socials, and
`salsa.svg` for everything else. Cards and list rows show the SVG
directly. The event modal places it inside a generated Sleeve — frame,
title band, price sticker and track list — so every approved event still
has shareable artwork.

**The Protected Submission Rule.** The New Event modal is a controlled,
accessible Radix dialog with backdrop blur (`rgba(11, 19, 38, 0.78)` with
8px blur), focus trapping, client-side validation error summaries,
unauthenticated submitter contact requirements, and strict focus
restoration to the invoking trigger upon dismissal. At 640px and below,
submission inputs, selects and textareas use 16px text to avoid browser
focus zoom; field targets remain at least 44px high at every width.

##### Stage header and toolbar

The stage header pairs the Epilogue display title and balanced subtitle
("salsa & bachata, hasta la madrugada") with a segmented metro pill switch
(Boston / New York City). The controlled `EventManager` toolbar
(`src/components/ui/event-manager.tsx`) anchors the planner chrome:

- **Period navigation:** Month and week title (`aria-live="polite"`), step
  controls (`< Today >`), and period context appear only in Month/Week
  views. List/Cards retain the full upcoming feed, labeled "Upcoming
  events" in the toolbar and sidebar, without ineffective date controls.
  Stepping to another period moves the title 10px and the grid 28px in
  from the side time moved toward (later from the right), 300ms
  `cubic-bezier(0.16, 1, 0.3, 1)` from 35% opacity. The grid frame stays
  fixed and clips its moving contents. Switching views or resizing keeps
  the date and never travels. Schedule-X's built-in slide is off
  (`skipAnimations`) so this is the only grid motion. Reduced motion keeps
  a 160ms opacity settle with no movement.
- **Search bar:** Real-time search matching event titles, locations,
  venues, descriptions, and dance styles, ignoring case and accents
  ("salon" finds "Salón"), with an instant clear button (`X`) that returns
  focus to the input. The search bar's metal perimeter is its one authored
  motion: lazy-loaded Paper liquid metal runs for 650ms on focus, then
  stops. Blur/unmount disposes the shader; hidden/offscreen rendering
  pauses. Reduced motion and unavailable WebGL use a static rim without
  changing search behavior. The decorative masked border follows focus
  anywhere inside the bar; moving between the icon, input, and clear button
  does not restart it. There is no separate icon frame or inner input
  outline. Focus leaving the whole bar disposes the shader. The rim alone
  uses material neutrals (`#77777b`, `#dedbd5`, `#85858a`, `#c5b89d`) and
  shader back/tint (`#99999c`, `#fff0d4`); these are not content or
  category colors.
- **View switcher:** Segmented pill group toggling Month Grid, Week, List,
  and Cards on desktop; compact screens filter to List and Cards only. The
  selected view, like the selected city in the stage switch, sits on the
  neutral rubber segment (see Components › Shared Controls).
- **Action CTA:** Prominent solid Rose Red button (`+ New event`) that
  launches the submission dialog. No duplicate footer or empty-state
  submission CTA.

##### Desktop sidebar and responsive tiers

- **Desktop (≥ 1024px):** A 208px left sidebar displays the active period
  range label (17px Epilogue 700), live category breakdown counts under
  "What's on" (Social, Class, Workshop, Live Music), dance style taxonomy
  selection (e.g. On1, On2, Cuban, Bachata), and a 7-day upcoming event
  count tally. It is sticky 24px below the header and scrolls internally
  when the style list is long.
  **The sidebar is the grid's legend.** Each type row carries an 8px
  swatch in that type's calendar colour (`CALENDARS_CONFIG` dark `main`)
  and a 2px share rail showing its portion of the events in the current
  style context; "All events" carries the stacked composition of all four.
  Choosing a dance style re-proportions the rails (300ms
  `cubic-bezier(0.16, 1, 0.3, 1)`; instant under reduced motion) — the
  sidebar's only motion besides selection. Selection rides the neutral
  rubber segment, as the city and view switches do; rows never paint their
  own selected fill and never change weight. The rose dot marks the
  selected non-type row only. Zero-count types stay selectable with a
  dimmed swatch; counts use tabular numerals.
- **Tablet (769px – 1023px):** The sidebar drops away to maximize grid
  measure; event type pills and the dance style selector move into the
  `EventManager` toolbar filters row.
- **Compact / Mobile:** The stage uses a 28px Epilogue heading within the
  display composition band and keeps the existing subtitle. The header
  city picker is the sole city control: duplicate stage and floating city
  selectors disappear on this surface only. Upcoming events and New event
  share a row; a full-width labeled List/Cards switch fills the next.
  Search stays full-width. Type/style controls sit in a closed native
  Filters disclosure with an active-selection count; closing it never
  clears filters. The disclosure unfolds from its summary (280ms open,
  180ms close) as its chevron turns. Browsers without size-keyword
  interpolation and reduced-motion users get an instant open. List/Cards
  labels stay visible even at 320px. Every visible calendar control
  retains a 44px minimum touch target.

##### Feed states

A failed first load names the city ("We couldn't load Boston's
listings.") and never shows the raw driver error; its Try again button
stays in place while retrying and gets focus back if the retry fails. A
failed background refresh keeps the last loaded events on screen. With no
city chosen, the calendar asks for one rather than reporting an empty
city.

##### List details

Date-grouped rows with 1px borders show the flyer thumbnail,
title, labeled event type using the existing calendar colors, a two-line
description (one line on compact screens), start–end time, venue, and
dance-style badges. The list renders 50 chronological events per batch;
"Show more events" extends it and moves keyboard focus to the first newly
revealed event. Opening details and unchanged background refreshes retain
expanded rows and the opener's focus on close. The converted event
collection stays stable while cached data is unchanged; city, filter, or
event-data changes reset pagination. Multi-night events show the actual
end date; overnight events use a next-day marker. Missing or unreachable
flyers use the fallback art above. Fine-pointer hover moves only the
detail arrow by 2px over 180ms; reduced motion removes that movement. Rows
have no entrance or filter-triggered reveal. Date group headings use 18px
Epilogue, event titles 16px Epilogue, descriptions and time/venue metadata
14px Be Vietnam Pro, and type/style labels 12px. Search text is 16px at
all widths; the last row can scroll clear of the fixed dock. Desktop
retains its sidebar and month/week views.

##### Anonymous submission and moderation flow

The submission dialog (`CalendarSubmissionDialog`) opens in-place without
leaving the calendar. Guest attendees can submit unlisted nights without
an account when submissions are open; `submitter_name` and
`submitter_email` are mandatory contact fields for unauthenticated guests,
while authenticated organizers have contact credentials prefilled.
Submissions validate with `FormErrorSummary` focusing the error summary
and linking to invalid fields. The dialog explicitly informs submitters
that events enter a `pending` moderation queue reviewed by community
moderators and do not appear on the calendar until approved. Flyer upload
is tucked into a collapsible `<details>` disclosure with reassurance that
flyerless events still get shareable artwork. Upon submission, the form
fields lock until the request settles. If the submission-access lookup
fails, the dialog offers an in-place retry. A success confirmation card
offers "Done" (closing with focus restoration to the trigger button) or
"Submit Another Event".

#### Event Cards

`EventCard` is a glass card (`--card`, 12px blur, 1px `--border`,
`--radius-lg`) laid out in the auto-fill events grid; a set of one or two
listings keeps cards at most 360px wide instead of stretching them.

- **Image:** the flyer, or the fallback SVG when there is none or it
  fails to load.
- **Type chip** (top-left of the image): a translucent navy pill (90%)
  (0.6875rem uppercase Epilogue) whose text and border take the type's
  colour — Social `--red-bright`, Class `--blue-pale`, Workshop
  `--gold-light`, Live Music `--tertiary`.
- **"Just approved" badge** (top-right): a gold pill on recently approved
  events.
- **Date overlay** (bottom-left of the image): a large day numeral beside
  the month and weekday.
- **Body:** the title (Epilogue 800, 1.125rem) as a button whose hit area
  covers the card and opens the event modal; time and venue with Lucide
  `Clock` and `MapPin`; the venue and the event's other linked entities
  link to their pages and stay independent keyboard targets.

The card carries no purchase or RSVP button; decisions live on the night
card in the event modal.

**Dance-style chips.** Small pills (`.style-chip`) name dance styles
(On1, On2, Cuban, …) with a low-opacity Warm Orange background
(`--tertiary-dim`) and white 0.6875rem uppercase text — legible but
secondary to primary actions.

#### Event Details

The event page's photo album and the event modal show photographs from
past nights as plain, static images — no masonry, no video previews.

- **Event page album:** a four-column grid of square photos (12px gap,
  `--radius-lg`, 1px `--border`), two columns below 768px.
- **Modal strip ("Photos from past nights"):** up to four 80×80px
  thumbnails (64px on mobile) at `--radius-md`, plus a "+N" tile for the
  rest. They have no interactive affordance.

#### Navigation

##### Mobile header

The full two-tone wordmark leads the bar. A compact city code and a 44px
menu target share the trailing edge; the picker retains the full city
name for assistive technology and shows the full name again in its city
list. The picker panel stays inside the phone viewport, including at
320px.

While the public mobile menu is open, the header is a labelled modal
navigation surface: focus stays among its visible controls, background
content is inert, and page scrolling is locked. Dismissal restores focus
to the menu button. Choosing a destination or resizing to desktop closes
the menu and releases the page. The header's primary links are Calendar,
Discover, About, Contact and Shop.

##### Mobile tab bar

Below 640px a translucent dark glass dock carries four labeled tabs:
**Home**, **Calendar**, **Submit** and **Me**. Submit reads **Add** for
admins and goes straight to event creation; everyone else enters the
moderated submission flow. Me opens `/profile`, or `/signin` for guests.
Discover, About, Contact and Shop stay in the header menu, which also
remains the home of identity, dashboards and sign-out.

Blur keeps labels legible while underlying content remains visible. The
selected tab sits on the rose-tinted rubber segment, and its icon box
fills solid rose. Pointer proximity gently enlarges the dock items. Touch
targets remain steady-sized, reduced-motion users get an immediate
selection change, and the city code remains a non-interactive badge above
the bar. Keep the existing bottom safe-area reservation and the header's
city picker as the city control.

Dock clearance belongs to the full public layout, after the footer, rather
than to the main content before it. Below 640px, reserve `--tab-bar-h`
plus `--space-lg` so the copyright and footer actions can scroll above
both the dock and its raised city badge. Desktop adds no dock clearance.

The floating city picker yields while the public footer intersects the
viewport, leaving support and contact actions unobscured. It returns when
the footer leaves view only if the visitor remains past its scroll
threshold. The dock's city badge and the header's city picker remain
available.

### The Sleeve

The one artifact that leaves the site: the shareable event poster,
exported and sent to a friend's phone, pressed in its own printed world.
It appears only as the poster export and as its thumbnail/preview inside
the event modal.

#### Poster

**Measures.** The poster exports at two fixed pixel sizes, never
responsive: a **story** (1080×1920) and a **feed** cut (1080×1350, 4:5; see
Feed Cut). Both stack the same three prints top to bottom — a label
**masthead**, the square **front cover**, and the cream **back cover**.

**Masthead.** A label-style header carrying the "Salsa Segura" wordmark
(set in Poster Condensed, not Great Vibes), the event type, and the
catalogue line (`SS-<MMDD> · <city code>`; the city part prints only when
the event has a city), closed by a 4px rule the full width.

**Front cover.** Flyer art (shown whole, `object-fit: contain`) or the
event's fallback SVG (cropped, `object-fit: cover`) fills a square
field-colour frame; a lettered title band sits below it; a circular price
sticker ("Entry" / amount or "Free") sits pinned to the cover's top-right
corner, rotated -9°.

**Track list.** Side A lists the night's facts — date, time, venue (with
address as a second line), styles — as numbered tracks (A1, A2, …) with
dotted leaders running from a Poster Condensed label to a bold tabular
value, exactly like an LP's printed track list. Side B holds the QR
("Scan for the night"), the short link and the host credit.

**Short link.** The QR encodes the full `https://` URL
`/e/<first 8 hex of the event id>`. The printed link drops the scheme but
keeps the host and path (`salsasegura.com/e/1a2b3c4d`). Events whose id is
not a UUID fall back to `/events/<id>`.

**Faces.** The Sleeve sets its own faces, distinct from the Epilogue/Be
Vietnam Pro pair. **Shrikhand** (registered as "Poster Lettering", weight 400) is **Poster Lettering**: fat, condensed script reserved for the cover
title band alone, never a heading, never body copy. **Barlow Condensed**
(registered as "Poster Condensed", weights 600/800) is **Poster
Condensed**: the masthead, sticker, track list and Side B, set with
tabular lining numerals (`font-variant-numeric: tabular-nums lining-nums`)
so figures align down the track list the way the desk's agate figures do.

Both faces are self-hosted (`@fontsource`) and registered on demand when
the event modal opens (`ensurePosterFonts`), because the night card's
thumbnail already needs them. The same font bytes are embedded into the
PNG capture (`posterFontEmbedCss`) so the exported poster matches the
on-screen preview instead of falling back to a system sans. The shop
loads Barlow Condensed separately for its own display type.

**The Artwork-Not-Ramp Rule.** The cover title uses artwork sizing rather
than the UI type ramp: 24–128px in Story, reduced for long titles so the
complete event name remains visible, and scaled by the cover ratio in Feed
(×0.752; see Feed Cut).

**Flat print.** The Sleeve declares **no elevation at all**, more strictly
than the desk: it is printed matter, so there is no shadow anywhere on
it. Depth comes from the pressing's own printed rules — the cover's 6px
frame, the band's 6px top rule, the sticker's 6px ring — never from a
cast or ambient shadow. Ritmo Vivo's glow and the operator shadows
(`--admin-shadow-sm`/`--admin-shadow-md`) both stop at the poster's edge.

**Shapes.** The Sleeve's shape language is flat print, not Ritmo Vivo's
rounded corners. The cover is a hard-edged square framed in a 6px
on-field-ink border; the price sticker is the one circle on the poster, a
6px-ringed disc rotated -9° like a stuck-on price tag; every other rule is
straight. The cream back cover is divided by a 3px Side-label rule and 4px
dotted track leaders, both in midnight or red ink — never the rounded,
glassy language the rest of the system uses.

#### Event Modal

The event modal is Ritmo Vivo throughout — dark ground, rose glow, gold
links — right up to the sleeve's edge, where the Boundary Rule takes over.

**The night card.** The modal opens on a sleeve thumbnail (`SleeveCover`,
tappable, opens the full poster preview with a Story/Feed toggle) beside
the facts — date, time, venue (omitted when the event has no location),
and price with the type chip — with the title full-width below. The poster
preview is a second view in the same dialog, not a new route.

**Decisions.** Two equal-size decisions follow in a 1fr/1fr grid
(`.night-actions`): **Send to friends** (primary) and the event's link —
**RSVP · Free** or **Get Tickets** (secondary) when the event has an RSVP
link, otherwise **Full details** (secondary). On mobile the decisions move
to a separate action bar. Below them, ghost text-link
utilities never compete with the two decisions: **Calendar** (when a
calendar link can be built), **Copy link**, and **Full details** when it is
not already a decision.

**The thumbnail.** The thumbnail reuses the front cover alone
(`SleeveCover`), scaled down from its authored 968px art size (to 220px;
124px on mobile; 104px below 380px). It is the same component as the
exported poster's cover, not an approximation. Its wrapper belongs to
Ritmo Vivo: it sits on the night card with a drop shadow, a small radius
and a hover lift and tilt, while the sleeve art inside stays flat.

#### Feed Cut

The feed cut is fixed geometry: a 728px square cover beside a 232px
**spine** carrying the date, and below them the back cover, whose 232px
right column holds the QR directly under the spine. Cover title sizes
scale by 728/968 (×0.752) from the story sizes.

Every feed track is one line (long values end in an ellipsis), so no fact
can move another region. The feed cut omits the "Side A"/"Side B" labels
(track numbers still print red), shortens the QR call to "Scan", and drops
the address note. The story cut keeps wrapped values, the side labels and
the address note.

#### Pressings

The Sleeve uses a flat spot-colour field chosen by event type — never
decoration, always the type.

- **Social pressing** (`#d7263d` field / `#a8182c` deep, on cream
  `#f4ecd8`): the default social night.
- **Class pressing** (`#f2b705` mustard field / `#c99400` deep, on
  midnight `#1b1b3a`): recurring classes.
- **Workshop pressing** (`#1b1b3a` midnight field / `#10102a` deep, on
  mustard `#f2b705`): workshops and intensives.
- **Live Music pressing** (`#ffb690` field / `#bf5300` deep, on dark
  orange `#552100`): live music events.
- **Cream stock** (`#f4ecd8`): the back cover's paper ground on every
  pressing, printed in midnight ink with red (`#d7263d`) side labels and
  track numbers.

**The Pressing-Codes-Type Rule.** The field colour is the only signal of
event type on the poster; it is never reused for anything else on the
sleeve. Red (`#d7263d`) is the one accent on the cream back cover of every
pressing — side labels (story) and track numbers — so the back cover
reads the same regardless of which field it backs.

### Listings Desk

The operator overviews — admin, moderator and host — built from
`src/components/desk/` (`OperatorDesk` for the admin and moderator
overviews; `HostDashboard` composes the same primitives). The desk is a
standing rule over two measures: the **galley** (entries awaiting a
decision) and the **set column** (the week).

**Agate setting.** The desk sets listings the way a printed club-listings
column does: small, dense, rule-separated, with tabular lining numerals so
figures align down the column (`font-variant-numeric: tabular-nums`).

- **Agate** (Be Vietnam Pro, 0.8125rem/1.35): every listing row.
- **Entry title** (Be Vietnam Pro 700, 0.9375rem/1.3): the name of a night.
- **Desk label** (Epilogue 700, 0.6875rem, 0.14em, uppercase): measure
  titles, day headings, count labels, state flags.
- **Figure** (Epilogue 800, 1.375rem, -0.02em): the counts in the rule.

**Rules, not cards.** The desk declares **no elevation at all**. There are
no cards, no panels, and no shadows on a desk surface; hierarchy comes
from rules and measures. A 2px rule closes the masthead and separates
major regions, a 1px rule separates divisions and entries, and a 1px
vertical rule divides the two measures. An open entry is marked by a
change of ground (`--admin-surface-subtle`), never by lifting it. A
galley and a set column are a column of type, and a card around an entry
destroys the vertical read the proof marks exist for.

#### States

The desk runs on the `.admin-shell` neutral tokens (light and dark
themes) plus five state colours that are **law**: one colour per state,
used for state and for nothing else. The tokens are defined on `.desk`
(`desk.css`), with the dark values under
`.admin-shell[data-theme="dark"] .desk`.

- **Unset** (`#b45309` light / `#fbbf24` dark): an entry awaiting a decision.
- **Set** (`#047857` / `#34d399`): published and in the week.
- **Killed** (`#b91c1c` / `#f87171`): rejected or cancelled.
- **Standing** (`#475569` / `#94a3b8`): a draft, held.
- **Tonight** (`#be123c` / `#fb7185`): running today.

**The State-Only Rule.** These five never decorate. An operator learns
the colour once and then reads a column of marks without reading a
label; borrowing one for emphasis destroys exactly that.

**Margin marks.** Every listing hangs off a drawn mark in its margin: an
open ring for unset, a closed disc for set, a diagonal spike for killed, a
hollow square for standing, a ringed disc for tonight. These are authored
SVG geometry, never glyphs or emoji, and each is labelled for assistive
technology where it is the sole carrier of state on its row.

The sidebar's pending counts (Organizer Requests, Founder Requests) are
Unset work and wear this colour. Rose in the sidebar is wayfinding only,
the current page's icon and the focus ring, never state.

#### Controls

**The Agate-Rows-Only Rule.** Listing scale governs rows and nothing
else. Every control an operator hits at speed stays at full UI size —
34px minimum with a fine pointer, 44px below 640px and on coarse pointers
— because the reading load belongs to the state palette, not to the type
size.

**Decisions.** Approve and Reject use the set and killed colours as their
border and text. Rejection opens the existing reason dialog, which is
genuine protected-focus work; approval does not interrupt.

**Set in place.** Deciding an entry never routes and never toasts. The
row leaves the galley, the entry arrives in the column at its true date
position, and the count in the standing rule drops — one propagation, one
meaning. Reject strikes the title through before the row goes.

**The undo dock.** Deciding on the Events list is undoable for six
seconds, and the outcome is announced to assistive technology. The notice
is docked under the list, sticky and in the page's flow, never floating
over it, and is the one sanctioned exception to "never toasts" because an
undo needs a place to live. It names what happened in past tense, offers
Undo (also Ctrl/Cmd+Z), and after a decision focus moves to the next
row's Approve. Bulk Approve and Reject on Pending Review use the same
dock.

**Focus swells, the rest compresses.** Opening an entry expands it in
place to full working detail (flyer, description, submitter, address)
while its siblings drop their thumbs and tighten. There is no separate
review page to lose your position in.

#### Responsive Behavior

**Two measures and a fixed week.** The set column is a fixed **seven
divisions** from today; a day with nothing in it still occupies its
division, so a thin week looks thin instead of collapsing into a tidy
short list. Every entry is pinned to its true position on that one time
axis, and the division head owns the day while the entry states only its
time.

Hanging indents are constant: a 22px margin column for the proof mark, a
14px gutter, and a 44px flyer thumb where an entry carries evidence.
Below 1024px (`max-width: 1023.98px`) the two measures stack rather than
narrow — an agate column squeezed under its measure stops being readable.
Below 640px the standing rule collapses to one column and controls grow to
44px.

### Operator / Admin

Everywhere an operator works outside the desk — record tables, forms,
detail pages, dialogs, settings — inside the `.admin-shell` light and dark
themes. No glassmorphism, glow, or dark slate ground reaches these
surfaces.

**Category chips are not state.** Taxonomy categories (attendee type,
dance style) are labelled by the `--admin-chip-*` palette in
`src/styles/admin.css` — one tint/ink pair per hue, light and dark. A chip
names a category and never reports an entry's state; the five desk
colours stay reserved for state.

#### Shell

**Operator location stays visible.** The admin and host topbar retains
the current location at phone widths; only the parent role and separator
disappear below 640px. The label can ellipsize without shrinking the
navigation or account controls. Admin queue labels match their sidebar
destinations, including nested submission and founder-request records.
Bulk Upload has its own location label. Each sidebar marks only the most
specific available destination as current; parent and child links never
compete for the active state.

**Desktop collapse recovers workspace.** At 1024px and above, the saved
collapse preference changes the sidebar from its full width
(`clamp(260px, 16.25rem, 360px)`, 260px at the default text size) to a
72px rail. The sidebar width, topbar left edge, and main-content margin
follow the same shell-scoped `--admin-sidebar-w`, recovering 188px of
workspace at the default text size. Rail links retain full accessible
names; their visual labels are clipped rather than removed from the
accessibility tree, with native title hints for pointer discovery. The
toggle exposes its state and controlled navigation. Below 1024px, the
saved preference never narrows the labelled drawer or adds a content
offset. Returning to desktop restores the chosen rail state.

**Navigation is grouped by what it governs.** Admin sections are Desk
(queues, including Listing Claims), Events, Directory (Schools, Venues,
Artists, Organizers), People and Platform. Host navigation gives
organizer tools their own Organization section, then one section per
managed listing titled `{Kind} · {Name}`: a school carries Overview,
Timetable, Privates, Prices, Profile and Team; a venue or artist carries
Overview, Profile and Team. Profile appears only for owners and managers,
Team only for owners. Inside a listing, the same pages repeat as in-page
tabs so platform admins (who keep the admin sidebar) can move between them.

**The school timetable is a fixed week.** Like the set column, it always
shows seven divisions Monday to Sunday; an empty day keeps its division
and its Add class control. Classes, privates and price plans are edited in
place, never on a separate route.

**Operator account actions are usable, not placeholders.** The account
disclosure stays within the viewport and scrolls when height is limited.
Escape closes it and restores trigger focus. Outside pointer interaction,
focus leaving the disclosure, or route navigation closes it without
pulling focus away from the user's next action.

Both topbar and drawer link Account to `/account`. Existing sign-out
scopes stay explicit: the topbar says "Sign out on all devices"
(`global`); the drawer says "Sign out on this device" (`local`). Pending
requests disable repeat activation. Failures announce an in-place alert
and allow retry. The topbar reveals the alert and retry action together,
including when reopened or viewed with enlarged text in a short viewport.

#### Cards

`.admin-card` is the sanctioned container for record surfaces. A listing
column and an edit form are different jobs: a form needs a stated edge
because it bounds a set of fields the operator is committing, and a detail
page needs one because it separates a record from the page around it.
Forcing the agate treatment onto them would make both harder to use.

So the boundary is by job, not by URL:

- **Desk surfaces** (a standing column of entries): rules and measures,
  never a card. Ground change marks state; nothing lifts.
- **Record surfaces** (a form, a table, one record, a dialog):
  `.admin-card` is correct, bounded by three rules — one level deep and
  never nested, border-only elevation, and never a card per row where a
  table belongs.

**The One-Device Rule.** Border or shadow, never both. Operator cards
chose the border.

`AdminMetricCard` remains the one figure-card exemption, confined to the
analytics page. Inventory figures (total users, total venues, total
events) belong there; the desk reports work, not scale.

#### Tables

A table is the container for its rows and sits in at most one
`.admin-card`. Never give each row its own card where a table belongs.

#### Forms

A form sits in one `.admin-card` that bounds the fields being committed.
Record IDs, hashes, raw payloads and submission diffs inside a form use
the Identifier face (`--font-mono`).

#### Record Pages

A detail page separates one record from the page around it with one
level of `.admin-card`, and uses the Identifier face for anything read
character by character. A decision the desk's galley can carry in place
(approve, reject) never requires routing to a record page.

### Retail / Shop

Retail Edit is the shipping catalog, product and cart design on `/shop`
and `/shop/products/:handle`, in Ritmo Vivo; it is no longer a
development-only variant. The catalog opens with an editorial merchandise
hero: self-hosted Barlow Condensed display type (`@fontsource`, weights
600/700, loaded by the catalog), merchant photography, navy grounds and
restrained rose accents. Catalog actions are gold: the catalog's primary
action, the cart count, and the View product and closing links. On the
product page, Add to cart is Rose Red (selected options are gold); in the
cart drawer, Checkout is Rose Red.

The collection uses three columns above 700px, two columns from 381px to
700px, and one column at 380px and below. Whole-product merchant
photography uses `object-fit: contain`; captions carry real names,
Shopify starting prices and an explicit View product action. No customer
photos, shipping promises or scarcity claims are manufactured. GSAP
choreographs readable hero words and section headings; every split
heading retains one unsplit accessible name. Catalog-only Lenis smooths
wheel input, with native touch scrolling, dialog exclusion, media/font
measurement refresh, and cleanup on unmount. Reduced motion skips both
engines and renders final states. No WebGL canvas is needed. Solar icons
by 480 Design are bundled locally through Iconify and attributed under CC
BY 4.0 at the bottom of the catalog — the one place icons do not come from
Lucide.

The product gallery sits beside a sticky purchase panel on desktop. Named
option buttons expose selection and unavailable combinations; every
option has a 44px minimum target. Product details live in a native
disclosure. On phones, the quantity/add bar stays above the public dock
and safe area; short landscape viewports use an in-flow bar. The cart is
a protected-focus drawer with real Shopify totals and a hosted-checkout
handoff.

Shared-image navigation and the confirmed-add flight preserve direct
navigation and purchase behavior under reduced motion or unsupported
APIs. The flight sits below the cart modal, never covering checkout
controls. Styles and components live with the production pages/cart; no
query-selector switcher, discarded Drop Grid, or preview-only production
branch remains. All photography is merchant-supplied Shopify CDN imagery,
not generated assets. Missing product media retains a deterministic named
fallback. When JavaScript is disabled, the static app shell provides a
merchant-store link instead of a blank page.

## Accessibility

**Touch targets.**

- Public controls keep a 44px minimum: the header menu button, dock tabs,
  every visible calendar control, submission fields, shop option buttons,
  and buttons (`min-height: 44px`).
- Operator account controls keep 44px: the topbar's 32px avatar sits
  inside a 44px disclosure target, and account links, Appearance and theme
  options are at least 44px high.
- Desk controls are 34px at desktop widths with a fine pointer. They grow
  to 44px below 640px and under `pointer: coarse` at any width (touch
  laptops, tablets with keyboards). The hit area grows; agate type does
  not.

**Skip links.** Admin and host shells start with "Skip to content," which
moves focus to `#admin-main`; the next Tab continues into the workspace
rather than through the sidebar. Public pages share the same focus-moving
skip link, and the home page's destination reads "Skip to events."

**Dialogs and disclosures** trap or contain focus while open and restore
it to their trigger on dismissal: the public mobile menu, the calendar
submission dialog, the cart drawer, the desk's reject dialog, and the
operator account disclosure (which closes on Escape).

**State is never colour alone.** Desk margin marks carry state by shape
as well as colour, and each mark is labelled for assistive technology
where it is the sole carrier of state on its row.

**Reduced motion.** Every authored motion under Components names its
reduced-motion path; under `prefers-reduced-motion: reduce` movement is
removed and selection changes land at once.

## Do's and Don'ts

### Do

- **Do** keep the visual languages separate: Ritmo Vivo for anything a
  dancer sees (site and shop), The Listings Desk and `.admin-shell` record
  surfaces for anything an operator works in, and The Sleeve for the one
  artifact that leaves the site.
- **Do** state only counts that represent work in the desk's standing
  rule. Pending decisions, requests, and flags are work.
- **Do** hold the five state colours to state alone, in both the light
  and dark `.admin-shell` themes.
- **Do** keep operator controls at 34px or larger (44px on touch) even
  though the rows around them are set at agate scale.
- **Do** let a decision propagate once, across galley, column and
  counts together.
- **Do** press event type to field colour alone (red social, mustard
  class, midnight workshop, orange live music) and print the back
  cover's side labels and track numbers red on every pressing.
- **Do** set the Sleeve in Poster Lettering (titles) and Poster
  Condensed (everything else), never Epilogue or Be Vietnam Pro.

### Don't

- **Don't** put a KPI stat-card grid on an operator surface. Inventory
  figures belong to the analytics page; the desk reports work, not scale.
- **Don't** add cards, panels, or shadows to the desk. Rules and
  measures do the dividing.
- **Don't** nest one `.admin-card` inside another, and don't give each
  row of a table its own card — a table is the container there. The card
  is for a form, a record, or a dialog, one level deep.
- **Don't** use glyphs or emoji as marks or icons anywhere. Marks are
  drawn geometry; icons come from the Lucide set already in use (the
  shop's attributed Solar set is the one exception).
- **Don't** shrink a control to match agate type, and don't grow agate
  type to match a control.
- **Don't** route an operator to a separate page for a decision the
  galley can carry in place.
- **Don't** let Ritmo Vivo's glassmorphism, glow or gradients reach the
  Sleeve, and don't let the Sleeve's flat fields leak back into Ritmo
  Vivo.
- **Don't** show the Sleeve anywhere but the poster export and its
  thumbnail/preview inside the event modal.
- **Don't** add a shadow anywhere on the poster; the Sleeve prints flat.

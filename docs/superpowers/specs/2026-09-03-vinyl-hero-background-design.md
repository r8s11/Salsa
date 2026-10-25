# Vinyl hero background design

## Context

The public home hero already establishes its visual world with a midnight-blue atmospheric background, amber accents, ambient glow/grid motion, responsive mobile layout, desktop pointer parallax, and Motion-driven entrance choreography. Add one decorative spinning vinyl record behind the hero content. It must reinforce the dance/music identity without weakening legibility, interaction, or motion accessibility.

## Grounded state of the codebase

| Concern | Current implementation | Consequence for this change |
| --- | --- | --- |
| Hero composition | `src/components/Hero/Hero.tsx` renders `.hero-bg` with glow and grid before `.container`, then content and optional ticker. | The vinyl belongs inside `.hero-bg`, before all interactive content. |
| Hero styling | `src/components/Hero/Hero.css` owns hero layering, responsive breakpoints, glow/grid ambient animation, and reduced-motion overrides. | Keep the record’s visual geometry and responsive placement local to `Hero.css`. |
| Motion | `Hero.tsx` uses `motion/react` and `useReducedMotion()` for staged hero entry. | Reuse the same dependency and reduction decision; do not add another animation library. |
| Existing movement | Glow pulses, grid drifts, ticker scrolls, and desktop pointer parallax shifts the content background. | The record rotates independently, slowly, and never responds to pointer input. |
| Existing coverage | `src/components/Hero/Hero.test.tsx` verifies Motion-tagged hero layers. | Extend the test contract for the decorative vinyl element and motion-reduction behavior. |

## Architecture decision

Use a single `motion.div` inside `.hero-bg`, styled as a record with CSS gradients and clipped by the hero boundary.

| Option | Cost | Ripple | Decision |
| --- | --- | --- | --- |
| CSS gradient record + Motion rotation | No asset, no network request, one visual layer, same animation system. | Hero TSX, CSS, and test only. | Chosen. |
| Inline SVG | More markup for geometry CSS already provides. | Adds SVG semantics and larger component surface. | Rejected. |
| Raster texture | Requires licensed source, responsive variants, and extra bytes. | Asset management and loading behavior. | Rejected. |

## Deliverables

### 1. Decorative record layer

Add an `aria-hidden` vinyl element to `.hero-bg`. It remains non-interactive and below every content layer. A pseudo-element or nested CSS-only detail renders the amber label and dark-blue center ring; `repeating-radial-gradient` renders restrained black grooves. The record has no text content or semantic role.

### 2. Placement and responsive composition

Desktop places the record oversized at the hero’s right edge, cropped beyond the boundary. This creates depth behind the heading while leaving the left-side reading column and both CTAs unobstructed.

Mobile retains the same right-cropped visual identity, but reduces the visible diameter and moves the crop farther out to preserve the single-column reading flow, full-width CTA targets, and compact statistic rail. It must introduce neither horizontal overflow nor a new overlap breakpoint.

### 3. Motion and reduced motion

The record rotates clockwise at a barely perceptible 24–30-second linear cadence. It joins the existing Motion entrance system rather than recreating CSS entrance animation. When `useReducedMotion()` is true, the record is rendered without rotation or entrance transition. The existing CSS `prefers-reduced-motion` handling continues to stop ambient background motion.

### 4. Layering and interaction invariants

The record uses the `.hero-bg` stacking context, `pointer-events: none`, and hero clipping. It must never capture pointer or keyboard interaction, obscure copy, change CTA targets, or alter desktop pointer-parallax behavior. The glow/grid remain above or visually compatible with the record according to the existing background layer ordering.

### 5. Contract verification

Extend the targeted Hero test to assert the vinyl background element is a Motion element and that the reduced-motion path removes its animation props. Run the targeted Hero test, lint with zero warnings, production build, and browser checks at 375px and 1440px. Save the refreshed screenshots beside the existing mobile-hero artifacts.

## Wireframes

### Desktop — right-cropped depth

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                             ◜──────────────────────────◝                   │
│ Greater Boston · Live Dance Guide        [ oversized spinning vinyl ]      │
│ Find Your                                                                    │
│ Rhythm.                                   ── cropped beyond right edge ──  │
│ [ Tonight on the floor ] [ Full calendar ]                                  │
│  12 Events This Week   9 Venues   BOS On The Floor                          │
└────────────────────────────────────────────────────────────────────────────┘
```

### Mobile — restrained right crop

```text
┌───────────────────────────────┐
│ Greater Boston · Live Guide    │    ◜──────
│ Find Your Rhythm.              │      vinyl, cropped
│                               │      past right edge
│ [ Tonight on the floor       ] │
│ [ Full calendar              ] │
│ 12 events  │ 9 venues │ BOS   │
└───────────────────────────────┘
```

## What this phase does not decide

- No real album art, record catalog, audio playback, turntable controls, or interactive music feature.
- No new assets, fonts, dependencies, routes, data queries, or analytics.
- No changes to hero copy, CTA destinations, ticker content, city selection, event calculations, or the desktop parallax contract.
- No global animation-system rewrite; the scope is one decorative hero layer.

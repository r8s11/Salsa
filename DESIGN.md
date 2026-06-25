---
name: Ritmo Vivo
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#e5bdbe'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#ac8889'
  outline-variant: '#5c3f40'
  surface-tint: '#ffb3b6'
  primary: '#ffb3b6'
  on-primary: '#68001a'
  primary-container: '#e11d48'
  on-primary-container: '#fffaf9'
  inverse-primary: '#be0037'
  secondary: '#e9c349'
  on-secondary: '#3c2f00'
  secondary-container: '#af8d11'
  on-secondary-container: '#342800'
  tertiary: '#ffb690'
  on-tertiary: '#552100'
  tertiary-container: '#bf5300'
  on-tertiary-container: '#fffaf8'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdada'
  primary-fixed-dim: '#ffb3b6'
  on-primary-fixed: '#40000c'
  on-primary-fixed-variant: '#920028'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#ffb690'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#783200'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Epilogue
    fontSize: 72px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-md:
    fontFamily: Epilogue
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-lg:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Epilogue
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-lg:
    fontFamily: Epilogue
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.1em
  label-sm:
    fontFamily: Epilogue
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
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
---

## Brand & Style

This design system captures the fiery essence of salsa: movement, passion, and community. The brand personality is extroverted and rhythmic, balancing the heat of the dance floor with the structural professionalism of a premier academy.

The visual style is **High-Contrast / Bold** blended with **Glassmorphism**. This creates a "night-out" aesthetic—utilizing deep backgrounds and vibrant pops of color to simulate the atmosphere of a dance social. We use sharp, large-scale typography and translucent overlays to suggest motion and depth, ensuring the school feels modern and energetic rather than traditional or dusty.

## Colors

The palette is anchored in a high-fidelity interpretation of the school’s heritage.

- **Primary (Rose Red):** Used for high-action items, primary buttons, and critical brand moments. It represents passion and heart.
- **Secondary (Gold):** Used for accents, premium tiers, and achievement-based elements (like "Advanced" class badges).
- **Tertiary (Warm Orange):** Introduced to bridge the gap between red and gold, adding vibrancy to gradients and energetic hover states.
- **Neutral (Deep Slate):** A sophisticated dark mode base that allows the warm tones to "glow," mimicking a spotlight on a dark stage.

Surface colors should use varying opacities of white (5% to 15%) over the dark neutral background to create layered depth.

## Typography

The typography strategy is "Rhythmic Hierarchy." **Epilogue** provides a geometric, editorial weight that feels decisive and bold—perfect for capturing the "hit" of a beat. **Be Vietnam Pro** offers a warm, approachable counterpoint for long-form content, ensuring readability for class descriptions and event details.

For large display text, use tight letter-spacing to create a compact, high-energy impact. Labels and overlines should always be uppercase with generous letter-spacing to provide a modern, structural contrast to the fluid imagery of dance.

## Layout & Spacing

The system uses a **Fluid Grid** based on a 12-column model for desktop and a 4-column model for mobile. Layouts should favor asymmetrical arrangements to evoke the spontaneity of salsa dance.

Spacing follows a strict 4px base unit, but emphasizes large "breathing rooms" (XXL spacing) between major sections to prevent the dark UI from feeling cramped. For the gallery component, use a masonry-style layout with varied gutter widths to maintain a sense of dynamic energy.

## Elevation & Depth

Hierarchy is established through **Glassmorphism** and **Ambient Shadows**.

1.  **Base Surface:** The deepest neutral slate color.
2.  **Raised Cards:** Semi-transparent overlays (White at 8% opacity) with a 12px background blur and a 1px subtle border (White at 10% opacity).
3.  **Active Elements:** Primary Rose Red elements should feature a "glow" effect—a soft, diffused shadow of the same color (opacity 30%) to simulate neon lighting.

Avoid heavy black shadows; instead, use tinted shadows that inherit the hue of the background to keep the "vibrant" brand promise.

## Shapes

The shape language is **Rounded**, utilizing a 0.5rem (8px) base radius. This creates a friendly and social feel that balances the "hard" energy of the bold typography.

For the gallery component, images should utilize the `rounded-lg` (16px) or `rounded-xl` (24px) settings to soften the visual impact of photography. Interactive elements like "Join Class" buttons should always use the `rounded-xl` setting to appear more inviting and tactile.

## Components

### Buttons
- **Primary:** Solid Rose Red (#E11D48) with white text. High-gloss finish with a subtle top-down gradient.
- **Secondary:** Outlined in Gold (#D4AF37) with a hover state that fills with a semi-transparent gold tint.
- **Ghost:** Pure text with an underline that appears on hover, mimicking the rhythm of a musical bar.

### Cards & Event Page
Event cards should feature large background imagery with a glassmorphic footer containing the date, time, and "Book Now" CTA. Use the Gold accent color for "Limited Spots" or "Sold Out" tags.

### Gallery Component
The gallery should support "Live" video previews on hover. Use a masonry layout where every third image spans two columns to maintain a rhythmic, non-linear flow. Each image should have a soft inner-glow border to make it pop against the dark background.

### Social Chips
Use small, pill-shaped chips for "Dance Style" tags (e.g., On1, On2, Cuban). These should use a low-opacity Tertiary Orange background with high-contrast white text to remain legible but secondary to primary actions.

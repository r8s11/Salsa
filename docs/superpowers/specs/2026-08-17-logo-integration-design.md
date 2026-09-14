# SalsaSegura Logo Integration — Design

**Status:** Approved (asset approach, theming split, and full-variant composition confirmed by user)
**Related:** `Comprehensive redesign scope/SalsaSegura_Logo_Package.zip` (source brand assets)

## Context

The app has never had a real logo — the public header renders `Salsa <span>Segura</span>` as styled text (`--font-logo: "Great Vibes", cursive`), the admin sidebar renders a CSS `::before { content: "S" }` hack for its collapsed state, and `index.html` has no favicon `<link>` at all. A real brand mark exists (`Comprehensive redesign scope/SalsaSegura_Logo_Package.zip`, added 2026-08-11) but was never wired into the app.

## Grounded state of the codebase

| Fact | Evidence |
| --- | --- |
| Brand assets are raster-only, no vector | Package `README.txt`: *"wrapping the PNG inside an SVG would not create a real vector logo"* |
| Only one artwork exists (a square dancer/treble-clef emblem), in 3 colorways (brand-red, white, black) + app-icon exports (1024/512/180) | `unzip -l`, visual inspection of `_transparent_master`, `_white`, `_black`, `_app_icon_512` |
| No separate "full lockup" (mark+wordmark) image exists | All `logo_*` files are the same square emblem at different sizes |
| Public site is dark-only; its own light-mode toggle was intentionally removed | `src/styles/global.css` single `:root` palette (`--bg: #0b1326`), no public theme toggle in `Header.tsx`/`MainLayout.tsx` |
| `ThemeProvider` (light/dark/system) wraps the *entire* app, but its DOM effect only targets `.admin-shell` | `src/app/providers.tsx` (`ThemeProvider` wraps `AuthProvider`/`CityProvider`, i.e. everything); `ThemeContext.tsx`: `document.querySelector(".admin-shell")?.setAttribute("data-theme", ...)` — no-op outside admin |
| Public brand accent (`--red: #e11d48`) is the *exact* color already painted into the mark artwork | `src/styles/global.css:23` vs. visual inspection of the colored mark |
| Admin dark theme already brightens every other semantic color for dark-surface legibility, but no equivalent exists for a logo | prior session's `--admin-brand-text` fix |
| 404 (`NotFoundPage`) is nested under `MainLayout` and already gets the shared `<Header/>` | `src/App.tsx` route tree |
| `/signin` is a **top-level** route, NOT wrapped by `MainLayout` — it renders its own standalone `auth-logo` link | `src/App.tsx`, `src/pages/SignInPage.tsx` |
| Mobile header is the same `Header.tsx`/`.logo` — no separate mobile-only logo instance exists | `Header.css` has no `.logo` override in the `@media (max-width: 990px)` block |
| Admin sidebar already imports `useTheme()` for its own appearance switcher | `AdminSidebar.tsx` |
| Image tooling available in this environment | `convert`/`magick` (ImageMagick), Pillow — sufficient to produce clean, purpose-sized exports |

## Core decision: theming split (confirmed)

The public site and the admin shell are **not** the same theming problem, so the logo component doesn't try to solve them the same way:

| Surface | Background | Logo tone | Why |
| --- | --- | --- | --- |
| Public site (header, mobile nav, auth page) | Always `--bg: #0b1326` (dark, fixed) | Always **brand-red** mark | Site has no light mode; red mark *is* the site's own `--red` accent |
| Admin sidebar, light theme | `--admin-surface: #ffffff` | **brand-red** mark | Matches `--admin-brand`; high contrast on white |
| Admin sidebar, dark theme | `--admin-surface: #171a20` | **white** mark | Red-on-near-black reads muddy; white is crisp (same reasoning as the earlier `--admin-brand-text` dark-mode fix) |
| Admin sidebar, system theme | resolves via `effectiveTheme` | whichever of the above `effectiveTheme` resolves to | `AdminSidebar` already computes `effectiveTheme` via `useTheme()` |
| Favicon / apple-touch-icon | Browser-chrome dependent | **brand-red** | Standard "colored icon on transparent" favicon convention; matches the package's own `app_icon_*` exports |

**Component stays theme-agnostic.** `SalsaSeguraLogo` takes an explicit `tone` prop (`"brand" | "white"`) rather than calling `useTheme()` itself. Reason: `ThemeProvider` technically wraps the whole app, so calling `useTheme()` wouldn't throw on the public site — but its `effectiveTheme` there just reflects OS preference (since nothing lets a visitor change it), which would pick the wrong tone for a light-OS visitor even though the public page is always rendered dark. Each caller passes the tone that matches what's *actually* rendered around it: `Header.tsx`/`SignInPage.tsx` hardcode `tone="brand"`; `AdminSidebar.tsx` computes `tone={effectiveTheme === "dark" ? "white" : "brand"}` from the `useTheme()` call it already makes.

## Asset structure

```
src/assets/brand/
├── mark-brand.png   # 160×160, brand-red emblem, transparent bg
└── mark-white.png   # 160×160, white emblem, transparent bg

public/
├── favicon-32.png        # 32×32, brand-red
└── apple-touch-icon.png  # 180×180, brand-red (copy of package's app_icon_180)
```

160px source for the two UI marks comfortably covers the largest real display size (header, ~40–44px) at 3x pixel density without shipping the 1024px masters. No `black` colorway is shipped — nothing in the current app renders the mark on a light-enough public surface to need it (the black PNG stays available in the source package if that ever changes). No SVG — none exists; see **Follow-up** below.

**Not building:** a `logo-light.svg`/`logo-dark.svg`/`logo.svg`/`logo-mark.svg` file set as the brief's example structure suggested — that assumed vector assets exist. Adapted to what's real: two raster marks (`mark-brand`, `mark-white`) plus the existing `--font-logo` wordmark text, composed at render time.

## Component

`src/components/brand/SalsaSeguraLogo.tsx`

```tsx
type LogoVariant = "full" | "mark";
type LogoSize = "sm" | "md" | "lg";
type LogoTone = "brand" | "white";

interface SalsaSeguraLogoProps {
  variant?: LogoVariant;   // default "full" — mark + "Salsa Segura" wordmark
  size?: LogoSize;         // default "md" — sm≈24px, md≈32px, lg≈44px mark height
  tone?: LogoTone;         // default "brand"
  className?: string;
  ariaLabel?: string;      // sets alt text on the mark image; omit when the
                            // logo is already wrapped by an element that
                            // provides its own accessible name (a Link with
                            // visible text, or a Link with its own aria-label)
}
```

- `variant="full"`: `<img>` (mark) + `<span>` styled with `var(--font-logo)` reading "Salsa Segura" — the same visual treatment the header already uses today, just with the real mark added beside it. The visible text is the accessible name for any wrapping link; the image gets `alt=""` in this variant (decorative — the text already says it).
- `variant="mark"`: image only. `alt` = `ariaLabel` if provided, else `""`. Used for the collapsed admin sidebar rail, where the wrapping element isn't a link (it's a static brand cell, not interactive) and the surrounding nav already has its own `aria-label="Admin"`.
- CSS module/plain class (matching this codebase's plain-CSS convention, not CSS-in-JS) sets width/height per `size`; the `<img>` has explicit `width`/`height` attributes at all times (no layout shift while loading).
- No `useTheme()` call inside the component (see theming-split decision above).

## Placements

| Location | File | Change |
| --- | --- | --- |
| Public desktop + mobile header | `src/components/Header/Header.tsx` | Replace the plain-text `Salsa <span>Segura</span>` inside the existing `<Link to="/" className="logo">` with `<SalsaSeguraLogo variant="full" size="lg" tone="brand" />`. Link/click-close/focus-visible behavior unchanged. |
| Auth page | `src/pages/SignInPage.tsx` | Replace the standalone `auth-logo` text link's content the same way (`variant="full" size="lg" tone="brand"`), same `Link to="/" aria-label="Salsa Segura home"` wrapper (image `alt=""`, since the Link already carries the name via `aria-label`). |
| 404 / error pages | *(none — inherited)* | `NotFoundPage` already renders inside `MainLayout` → gets the fixed `Header`. No separate change; avoids a redundant logo per the brief's own instruction. |
| Admin sidebar, expanded | `src/components/Admin/AdminSidebar.tsx` / `.css` | Replace `<div className="admin-sidebar__brand">SalsaSegura</div>` with `<div className="admin-sidebar__brand"><SalsaSeguraLogo variant="full" size="md" tone={...} /></div>` — stays a **non-interactive** cell, matching current behavior exactly (it isn't a link today; the sidebar's own "Dashboard" nav item already provides the home affordance, so this doesn't need its own accessible name). Removes the `::before { content: "S" }` hack entirely. |
| Admin sidebar, collapsed (icon rail ≥768px, and user-collapsed ≥1024px) | same files | CSS swaps `variant` from `full` to `mark` (component-level prop change driven by the same collapse state the sidebar already tracks, not a text-hiding hack) — replacing the current `content:"S"` generated-content trick with the real mark image. |
| Favicon | `index.html` | Add `<link rel="icon" type="image/png" href="/favicon-32.png" />` and `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`. |
| Social sharing / OG image | *(not touched)* | `og:image`/`twitter:image` already point at a dedicated `og-image.jpg` (1200×630, separate marketing asset, not a logo crop). Out of scope per the brief's own "document as later recommendation" instruction — noted in Follow-up below, not built. |

`Footer.tsx` is not in the brief's placement list and isn't touched.

## Accessibility

- `variant="full"` instances wrapped by a link (public header, auth page): accessible name comes from the visible "Salsa Segura" text inside the wrapping `<Link>`; mark image is `alt=""`.
- Admin sidebar brand cell (`variant="full"` expanded / `variant="mark"` collapsed): stays a **non-interactive `<div>`**, exactly like the current text version — mark image `alt=""` throughout, since it's decorative branding inside `<nav aria-label="Admin">`, not a control. The sidebar's own "Dashboard" nav item is the actual home-navigation affordance; the brand cell was never a link before this change and doesn't become one now (avoids introducing a link with no accessible name when the wordmark is hidden in the collapsed state).
- Focus-visible ring on the header logo `Link` is unchanged (existing `.logo:focus-visible` rule in `Header.css` still applies — the component renders *inside* the existing focusable link, doesn't introduce a new one).
- `width`/`height` attributes on every `<img>` prevent layout shift.

## Performance

- Two 160×160 PNGs (compressed) for the two UI marks + two small favicon files. No 1024px masters shipped to the browser.
- No `srcset`/responsive-image machinery added — a single 160px source scaled down via CSS covers every real display size in this app (largest is ~44px) without visible quality loss (downscaling only).
- No PWA manifest, no service worker, no maskable-icon set — matches the brief's explicit "don't introduce a full PWA" instruction.

## Follow-up (documented, not built)

1. **Real vector tracing.** The source is AI-generated raster art; a true SVG requires manually redrawing the emblem's curves. Recommend commissioning that if the logo needs to scale beyond ~200px (large hero placements, print) without a raster source at that size.
2. **Dedicated OG/social share crop of the mark.** Current `og-image.jpg` is a separate, already-designed marketing asset — not touched here. If a logo-centric share image is wanted later, that's a new design task, not a logo-integration one.

## What this doesn't decide

- Does not touch `Footer.tsx` (not in the brief's placement list).
- Does not add a web app manifest / PWA icons.
- Does not change `og:image`/Twitter card assets.
- Does not attempt SVG vectorization.

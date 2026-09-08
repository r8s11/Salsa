# Task 2 Report: Draw and verify the responsive record surface

## Status

**Implemented and committed.** The CSS-only responsive vinyl surface is present in the hero background, with desktop right-edge cropping, mobile safe cropping, explicit atmosphere stacking, pointer exclusion, and refreshed browser evidence screenshots.

The required `npm run build` command was attempted but remains blocked by an unrelated/pre-existing Task 1 TypeScript error in `src/components/Hero/Hero.tsx` (`TS2322`, Motion `rotate.ease` inferred as `string`). The Vite production build itself completed successfully with `npx vite build`.

## Changed files

Only the requested scoped files were staged and committed:

- `src/components/Hero/Hero.css`
  - Added `.hero-vinyl` circular surface using the exact requested `clamp()` geometry, radial groove gradients, dark-blue ring, amber label, center hole, shadow, `z-index: 0`, and `pointer-events: none`.
  - Set `.hero-glow` to `z-index: 1` and `.hero-grid` to `z-index: 2`.
  - Added the exact requested mobile crop override at `max-width: 640px`.
- `artifacts/mobile-hero/hero-desktop-1440.webp`
  - Refreshed from the production preview at 1440x900.
- `artifacts/mobile-hero/hero-mobile-375.webp`
  - Refreshed from the production preview at 375x812.

Pre-existing unrelated worktree changes (`vite.config.d.ts.map`, the untracked plan artifact, and `node_modules`) were not touched or staged.

## Commit

- Commit: `a634e15`
- Message: `style(hero): render spinning vinyl background`

## Commands and output

### Initial worktree check

```bash
git status --short && stat -c '%n %s bytes' dist/index.html artifacts/mobile-hero/hero-desktop-1440.webp artifacts/mobile-hero/hero-mobile-375.webp
```

Output:

```text
 M vite.config.d.ts.map
?? docs/superpowers/plans/2026-09-03-vinyl-hero-background.md
?? node_modules
dist/index.html 7577 bytes
artifacts/mobile-hero/hero-desktop-1440.webp 14308 bytes
artifacts/mobile-hero/hero-mobile-375.webp 12892 bytes
```

### Baseline production preview

Started with:

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

Preview became ready at `http://127.0.0.1:4173`.

Desktop baseline browser observation before CSS:

```text
vinylPresent: false
hero.width: 1440
hero.height: 715.484375
hero.overflow: hidden
```

Mobile baseline browser observation before CSS:

```text
innerWidth: 375
docScrollWidth: 375
bodyScrollWidth: 375
horizontalOverflow: false
heroOverflow: hidden
```

### Targeted Hero tests

```bash
npx vitest run src/components/Hero/Hero.test.tsx
```

Output:

```text
 RUN  v4.1.11 /home/r8s/code/Salsa/.worktrees/mobile-hero

 Test Files  1 passed (1)
 Tests  4 passed (4)
 Start at  12:11:29
 Duration  3.15s (transform 376ms, setup 177ms, import 601ms, tests 763ms, environment 1.28s)
```

### Required lint

```bash
npm run lint -- --max-warnings 0
```

Output:

```text
> salsa-segura@1.0.0 lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0 --max-warnings 0
```

Exit status: 0; no warnings were reported.

### Required production build

```bash
npm run build
```

Output:

```text
> tsc -b && vite build

src/components/Hero/Hero.tsx(111,10): error TS2322: Type '{ initial: false; animate?: undefined; transition?: undefined; className: string; "aria-hidden": "true"; } | { initial: { opacity: number; scale: number; rotate: number; }; animate: { opacity: number; scale: number; rotate: number; }; transition: { ...; }; className: string; "aria-hidden": "true"; }' is not assignable to type 'IntrinsicAttributes & Omit<HTMLMotionProps<"div">, "ref"> & RefAttributes<HTMLDivElement>'.
  Types of property 'transition' are incompatible.
    Type '{ opacity: { duration: number; delay: number; ease: readonly [0.22, 1, 0.36, 1]; }; scale: { duration: number; delay: number; ease: readonly [0.22, 1, 0.36, 1]; }; rotate: { duration: number; ease: string; repeat: number; }; }' is not assignable to type 'Transition<any> | undefined'.
      Type '{ opacity: { duration: number; delay: number; ease: readonly [0.22, 1, 0.36, 1]; }; scale: { duration: number; delay: number; ease: readonly [0.22, 1, 0.36, 1]; }; rotate: { duration: number; ease: string; repeat: number; }; }' is not assignable to type 'TransitionWithValueOverrides<any>'.
  ...
```

Exit status: 1. This error points to the Task 1 `vinylMotion` transition type and is outside the Task 2 CSS-only scope.

### Vite production build fallback

```bash
npx vite build
```

Output summary:

```text
vite v7.3.6 building client environment for production...
transforming...
✓ 2711 modules transformed.
rendering chunks...
computing gzip size...
...
dist/assets/index-fI5MBnx9.css 50.14 kB │ gzip: 9.76 kB
dist/assets/CalendarPage-WsJVnjF1.js 201.01 kB │ gzip: 55.42 kB
dist/assets/index-D84huNuZ.js 752.28 kB │ gzip: 230.78 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust build.chunkSizeWarningLimit to adjust this warning
✓ built in 13.35s
```

The only build warning was the known chunk-size warning. Largest final JS chunk: `752.28 kB` (`230.78 kB` gzip). Main CSS: `50.14 kB` (`9.76 kB` gzip).

### Screenshot dimensions

```bash
file artifacts/mobile-hero/hero-desktop-1440.webp artifacts/mobile-hero/hero-mobile-375.webp
```

Output after direct browser capture:

```text
artifacts/mobile-hero/hero-desktop-1440.webp: RIFF (little-endian) data, Web/P image, ICC profile, 1439+1x899+1
artifacts/mobile-hero/hero-mobile-375.webp:   RIFF (little-endian) data, Web/P image, ICC profile, 374+1x811+1
```

These are 1440x900 and 375x812 respectively; `file` reports the dimensions as `1439+1` and `899+1` due to the WebP image metadata/scaling notation.

## Browser observations

All browser checks used the production Vite preview at `http://127.0.0.1:4173/`.

### Desktop 1440x900

Computed DOM/CSS values after CSS implementation:

```text
vinylPresent: true
vinylRect: x=846.09, y=-72.09, width=835.81, height=835.81, right=1681.91, bottom=763.72
vinyl z-index: 0
vinyl pointer-events: none
vinyl position: absolute
vinyl width: 640px (clamp resolves to max 40rem)
vinyl opacity: 1 after Motion entrance animation
vinyl background: repeating-radial-gradient(...) over radial-gradient(...)
::before border: 20px solid rgb(21, 45, 71)
::before background: rgb(233, 195, 73)
glow z-index: 1
grid z-index: 2
container z-index: 2
innerWidth: 1440
docScrollWidth: 1440
bodyScrollWidth: 1440
hero height: 715.484375
```

Visual inspection of `hero-desktop-1440.webp` confirmed:

- A dark record is visibly cropped by the right edge.
- Concentric grooves, the amber label, and black center hole are visible.
- Hero heading, supporting copy, and both CTAs are readable and unobstructed.
- No page-level horizontal overflow is present.

Fine-pointer parallax check:

```text
Before mouse movement: glow transform matrix(1.0016, 0, 0, 1.0016, 0, 0)
After mouse movement:  glow transform matrix(1.00255, 0, 0, 1.00255, 0, 0)
changed.glow: true
```

The existing atmosphere still responds to desktop pointer movement. The vinyl transform also changes due its existing Motion rotation, while the grid remains `none` for transform as before.

### Reduced motion

With `prefers-reduced-motion: reduce` emulated at desktop:

```text
First sample:  vinyl transform none; glow animation none; grid animation none
Second sample: vinyl transform none; glow animation none; grid animation none
vinylStatic: true
atmosphereStatic: true
```

The record remains static and the existing atmospheric animations are disabled.

### Mobile 375x812

Computed DOM/CSS values:

```text
vinylRect: x=121.59, y=-60.41, width=538.82, height=538.82, right=660.41
mobile CSS width: 400px (25rem)
mobile CSS top: -60px (-3.75rem)
mobile CSS right: -216px (-13.5rem)
mobile CSS opacity declaration: 0.72
vinyl pointer-events: none
innerWidth: 375
docScrollWidth: 375
bodyScrollWidth: 375
horizontal overflow: false
hero height: 460.953125
```

Visual inspection of `hero-mobile-375.webp` confirmed:

- The cropped dark record and concentric grooves provide visible vinyl identity on the right.
- Hero eyebrow, heading, and copy remain readable.
- Both CTA buttons remain full width at approximately 335x52px each.
- The three-column stat rail remains approximately 335x70px with all values and labels readable.
- No horizontal scrollbar or visible page-level overflow appears.
- The crop is intentional and does not cover the hero messaging.

### Pointer exclusion

The computed `.hero-vinyl` value is `pointer-events: none`; it cannot capture pointer interaction. The surrounding `.hero-bg` also retains its existing `pointer-events: none` context.

## Concerns

1. `npm run build` cannot complete TypeScript checking because Task 1's existing Motion `rotate.ease: "linear"` is inferred as a general `string`, which is incompatible with the installed Motion `Easing` type. Task 2 did not modify `Hero.tsx`; `npx vite build` completed successfully and was used for the browser proof.
2. Motion supplies inline `opacity: 1` after the vinyl entrance animation, so the browser's computed mobile opacity is `1` even though the required mobile stylesheet declaration is exactly `opacity: 0.72`. The requested CSS value is present verbatim and the screenshot remains visually readable/subtly integrated; changing Task 1's animation or adding an override would exceed the exact Task 2 CSS requirement.
3. The browser screenshot helper initially returned capped 1024x640/375x812 files for desktop; the final artifacts were overwritten using direct browser viewport captures and are now 1440x900 and 375x812.

## Fix follow-up

### Changed files

- `src/components/Hero/Hero.css`
  - Retained the approved mobile `opacity: 0.72` declaration and added `filter: opacity(0.72)` so the mobile record remains visually 72% opaque after Motion applies its inline entrance opacity of `1`, while Motion's opacity animation remains active.
- `src/components/Hero/Hero.tsx`
  - Narrowed `vinylMotion.transition.rotate.ease` with `"linear" as const`; runtime behavior is unchanged.
- `artifacts/mobile-hero/hero-mobile-375.webp`
  - Refreshed mobile evidence because the rendered mobile result changed.

### Verification

```bash
npx vitest run src/components/Hero/Hero.test.tsx
```

```text
Test Files  1 passed (1)
Tests  4 passed (4)
```

```bash
npm run lint -- --max-warnings 0
```

```text
Exit status: 0; no warnings were reported.
```

```bash
npm run build
```

```text
✓ built in 9.13s
(!) Some chunks are larger than 500 kB after minification.
Largest final JS chunk: 752.28 kB (230.78 kB gzip).
```

Browser verification confirmed the mobile record has computed `opacity: 1` from Motion plus `filter: opacity(0.72)`, producing the required rendered visual opacity while preserving the entrance and rotation behavior.

### Commit

- Commit: `947546a`
- Message: `fix(hero): preserve mobile vinyl opacity`

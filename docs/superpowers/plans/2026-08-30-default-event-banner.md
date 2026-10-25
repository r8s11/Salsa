# Default Event Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the supplied Salsa Segura banner as the single default image for every event without an uploaded flyer, including the Instagram Story share poster.

**Architecture:** Publish `design/Banner.png` as a stable public asset and centralize image precedence in the existing modal-image resolver: uploaded flyer first, otherwise the default banner URL. Direct display surfaces consume the same URL rather than rendering generated SVG templates. The share-poster capture receives that resolved URL and inlines it through the existing `resolvePosterImage` path.

**Tech Stack:** React 19, TypeScript, Vite public assets, Vitest, Testing Library, html-to-image.

## Global Constraints

- Image precedence is strict: `image_url` / `imageUrl`, then `/images/default-event-banner.png`.
- Do not add a database field, image transformation pipeline, browser image-error fallback, or a new dependency.
- Use the same resolved no-flyer URL for visible event surfaces and `ShareableEventPoster` capture.
- Adjacent image-only renderings use `alt=""`; existing card, modal, and page titles remain the accessible event name.
- Remove the obsolete generated SVG fallback component, selector utility, styles, and tests completely.
- Preserve the existing card, modal, detail cover, admin-thumbnail, and Story-poster dimensions and `object-fit: cover` behavior.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `public/images/default-event-banner.png` | Publicly served copy of `design/Banner.png`. |
| `src/components/EventModal/eventModalImage.ts` | Sole image-precedence resolver; returns flyer URL or default banner URL. |
| `src/components/EventModal/eventModalImage.test.ts` | Unit contract for flyer precedence and default banner fallback. |
| `src/components/Events/EventCard.tsx` | Uses resolved URL as card thumbnail background. |
| `src/components/Events/FeaturedEventCard.tsx` | Uses resolved URL as featured-card media background. |
| `src/components/EventModal/EventModal.tsx` | Uses resolved URL for modal image and passes it into Story poster capture. |
| `src/components/EventModal/EventModal.test.tsx` | Proves share capture receives a poster with the default banner. |
| `src/components/EventModal/ShareableEventPoster.test.tsx` | Proves explicit poster image rendering. |
| `src/pages/EventDetailPage.tsx` | Renders resolved URL for the no-flyer cover. |
| `src/components/Admin/AdminEventsTable.tsx` | Renders resolved URL for no-flyer thumbnail. |
| `src/components/brand/SalsaSeguraFallbackImage.tsx` | Delete. |
| `src/components/brand/SalsaSeguraFallbackImage.css` | Delete. |
| `src/components/brand/SalsaSeguraFallbackImage.test.tsx` | Delete. |
| `src/utils/eventFallbacks.ts` | Delete. |
| `src/utils/eventFallbacks.test.ts` | Delete. |

### Task 1: Publish and resolve the default banner

**Files:**
- Create: `public/images/default-event-banner.png` (copy from `design/Banner.png`)
- Modify: `src/components/EventModal/eventModalImage.ts`
- Modify: `src/components/EventModal/eventModalImage.test.ts`

**Interfaces:**
- Produces: `DEFAULT_EVENT_BANNER_URL: "/images/default-event-banner.png"`.
- Produces: `resolveEventModalImage(event: Pick<ScheduleXEvent, "id" | "imageUrl" | "calendarId">): string`.
- Consumes: `ScheduleXEvent.imageUrl`.

- [ ] **Step 1: Write the failing resolver test**

```ts
import { DEFAULT_EVENT_BANNER_URL, resolveEventModalImage } from "./eventModalImage";

it("returns the default banner when imageUrl is missing", () => {
  expect(resolveEventModalImage({ id: "1", imageUrl: undefined, calendarId: "social" })).toBe(
    DEFAULT_EVENT_BANNER_URL
  );
});

it("returns the default banner when imageUrl is empty", () => {
  expect(resolveEventModalImage({ id: "1", imageUrl: "", calendarId: "social" })).toBe(
    DEFAULT_EVENT_BANNER_URL
  );
});
```

- [ ] **Step 2: Run the resolver test to verify it fails**

Run: `npx vitest run --exclude '.worktrees/**' src/components/EventModal/eventModalImage.test.ts`

Expected: FAIL because `DEFAULT_EVENT_BANNER_URL` is not exported and missing images resolve to `undefined`.

- [ ] **Step 3: Publish the supplied asset and implement the resolver**

Copy the source without transforming it:

```bash
cp design/Banner.png public/images/default-event-banner.png
```

Replace `eventModalImage.ts` with:

```ts
import type { ScheduleXEvent } from "../../types/events";

export const DEFAULT_EVENT_BANNER_URL = "/images/default-event-banner.png";

export function resolveEventModalImage(
  event: Pick<ScheduleXEvent, "id" | "imageUrl" | "calendarId">
): string {
  return event.imageUrl || DEFAULT_EVENT_BANNER_URL;
}
```

- [ ] **Step 4: Run the resolver test to verify it passes**

Run: `npx vitest run --exclude '.worktrees/**' src/components/EventModal/eventModalImage.test.ts`

Expected: PASS; uploaded URL remains unchanged and missing/empty URLs resolve to `/images/default-event-banner.png`.

- [ ] **Step 5: Commit the asset and resolver contract**

```bash
git add public/images/default-event-banner.png src/components/EventModal/eventModalImage.ts src/components/EventModal/eventModalImage.test.ts
git commit -m "feat: add default event banner"
```

### Task 2: Replace generated fallback rendering on display surfaces

**Files:**
- Modify: `src/components/Events/EventCard.tsx`
- Modify: `src/components/Events/EventCard.test.tsx`
- Modify: `src/components/Events/FeaturedEventCard.tsx`
- Modify: `src/components/Events/FeaturedEventCard.test.tsx`
- Modify: `src/components/EventModal/EventModal.tsx`
- Modify: `src/pages/EventDetailPage.tsx`
- Modify: `src/components/Admin/AdminEventsTable.tsx`
- Modify: surface tests affected by removed `.ss-fallback` selectors
- Delete: `src/components/brand/SalsaSeguraFallbackImage.tsx`
- Delete: `src/components/brand/SalsaSeguraFallbackImage.css`
- Delete: `src/components/brand/SalsaSeguraFallbackImage.test.tsx`
- Delete: `src/utils/eventFallbacks.ts`
- Delete: `src/utils/eventFallbacks.test.ts`

**Interfaces:**
- Consumes: `resolveEventModalImage(event)` and `DEFAULT_EVENT_BANNER_URL` from Task 1.
- Produces: all no-flyer visible surfaces render the default banner; no `SalsaSeguraFallbackImage` or `getFallbackTemplate` import remains.

- [ ] **Step 1: Write failing surface assertions**

For card and featured-card tests, assert missing `imageUrl` produces the public background URL instead of `.ss-fallback`:

```ts
const thumb = container.querySelector(".event-card-thumb") as HTMLElement;
expect(thumb.style.backgroundImage).toContain("/images/default-event-banner.png");
expect(container.querySelector(".ss-fallback")).not.toBeInTheDocument();
```

For detail and admin tests, assert their no-flyer image elements have `src="/images/default-event-banner.png"` and `alt=""`.

- [ ] **Step 2: Run the surface tests to verify they fail**

Run: `npx vitest run --exclude '.worktrees/**' src/components/Events/EventCard.test.tsx src/components/Events/FeaturedEventCard.test.tsx src/components/Admin/AdminEventsTable.test.tsx src/pages/EventDetailPage.test.tsx`

Expected: FAIL because no-flyer surfaces still render generated SVG templates.

- [ ] **Step 3: Replace each generated fallback branch with the resolved image URL**

For `EventCard` and `FeaturedEventCard`, obtain `const imageUrl = resolveEventModalImage(event)` and set the existing media container background with `url(${imageUrl})`; remove conditional fallback children and generated-art imports.

For `EventModal`, retain `const resolvedImageUrl = resolveEventModalImage(event)` and always set `style={{ backgroundImage: \`url(${resolvedImageUrl})\` }}`; remove `hasUploadedImage`, fallback component markup, and its modal fallback CSS class.

For `EventDetailPage` and `AdminEventsTable`, use an `<img>` with `src={resolveEventModalImage(...)}`, `alt=""`, and existing image classes/dimensions. Remove all generated-art imports and fallback-only CSS.

Delete the five generated-art files after all imports are removed.

- [ ] **Step 4: Run the surface tests to verify they pass**

Run: `npx vitest run --exclude '.worktrees/**' src/components/Events/EventCard.test.tsx src/components/Events/FeaturedEventCard.test.tsx src/components/EventModal/EventModal.test.tsx src/components/Admin/AdminEventsTable.test.tsx src/pages/EventDetailPage.test.tsx`

Expected: PASS; flyer URLs retain priority and each missing-flyer surface resolves to the default public banner.

- [ ] **Step 5: Commit surface replacement**

```bash
git add src/components/Events src/components/EventModal/EventModal.tsx src/components/EventModal/EventModal.css src/components/Admin/AdminEventsTable.tsx src/components/Admin/AdminEventsTable.css src/pages/EventDetailPage.tsx src/pages/EventDetailPage.css
git rm src/components/brand/SalsaSeguraFallbackImage.tsx src/components/brand/SalsaSeguraFallbackImage.css src/components/brand/SalsaSeguraFallbackImage.test.tsx src/utils/eventFallbacks.ts src/utils/eventFallbacks.test.ts
git commit -m "refactor: use default banner for missing flyers"
```

### Task 3: Carry the resolved banner into Instagram sharing

**Files:**
- Modify: `src/components/EventModal/EventModal.tsx`
- Modify: `src/components/EventModal/EventModal.test.tsx`
- Create or modify: `src/components/EventModal/ShareableEventPoster.test.tsx`
- Modify only if necessary: `src/components/EventModal/ShareableEventPoster.tsx`

**Interfaces:**
- Consumes: non-optional `resolvedImageUrl` from Task 1.
- Produces: `ShareableEventPoster` is rendered with the data URL created from the resolved flyer-or-banner URL before `capturePoster`.

- [ ] **Step 1: Add a failing share-path test for a missing flyer**

Mock `resolvePosterImage` to resolve a data URL. Trigger `Share` for `baseEvent` with no `imageUrl`, then assert the temporary capture root contains the expected image before `capturePoster` resolves:

```ts
mockResolvePosterImage.mockResolvedValue("data:image/png;base64,banner");
mockCapturePoster.mockImplementation(async (container: HTMLElement) => {
  expect(container.querySelector(".poster-bg-img")).toHaveAttribute(
    "src",
    "data:image/png;base64,banner"
  );
  return new Blob(["poster"], { type: "image/png" });
});
```

Also assert `mockResolvePosterImage` is called with `DEFAULT_EVENT_BANNER_URL`.

- [ ] **Step 2: Run the focused sharing test to verify it fails**

Run: `npx vitest run --exclude '.worktrees/**' src/components/EventModal/EventModal.test.tsx`

Expected: FAIL because the no-flyer share path currently calls `resolvePosterImage(undefined)`.

- [ ] **Step 3: Pass the resolved URL through the existing capture flow**

Keep the existing capture sequence in `handleSharePoster`; it must call:

```ts
const posterImageUrl = await resolvePosterImage(resolvedImageUrl);
root.render(<ShareableEventPoster event={event} imageUrl={posterImageUrl ?? undefined} />);
```

Because Task 1 now guarantees `resolvedImageUrl`, the request is for the banner rather than `undefined`. Do not add a special share-only image path or a second fallback constant.

- [ ] **Step 4: Verify the component-level image contract**

Add or update `ShareableEventPoster.test.tsx`:

```tsx
render(<ShareableEventPoster event={baseEvent} imageUrl="data:image/png;base64,banner" />);
expect(screen.getByRole("img", { name: /instagram story poster/i })).toBeInTheDocument();
expect(document.querySelector(".poster-bg-img")).toHaveAttribute(
  "src",
  "data:image/png;base64,banner"
);
```

Run: `npx vitest run --exclude '.worktrees/**' src/components/EventModal/EventModal.test.tsx src/components/EventModal/ShareableEventPoster.test.tsx`

Expected: PASS; no-flyer sharing embeds the default banner, and flyer sharing remains unchanged.

- [ ] **Step 5: Commit Instagram banner propagation**

```bash
git add src/components/EventModal/EventModal.tsx src/components/EventModal/EventModal.test.tsx src/components/EventModal/ShareableEventPoster.tsx src/components/EventModal/ShareableEventPoster.test.tsx
git commit -m "fix: include default banner in shared posters"
```

### Task 4: Verify the production behavior

**Files:**
- No source changes expected.

**Interfaces:**
- Verifies Tasks 1–3 together.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npx vitest run --exclude '.worktrees/**' \
  src/components/EventModal/eventModalImage.test.ts \
  src/components/Events/EventCard.test.tsx \
  src/components/Events/FeaturedEventCard.test.tsx \
  src/components/EventModal/EventModal.test.tsx \
  src/components/EventModal/ShareableEventPoster.test.tsx \
  src/components/Admin/AdminEventsTable.test.tsx \
  src/pages/EventDetailPage.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run type, lint, and production build checks**

Run:

```bash
npx tsc --noEmit
npx eslint src/components/Events/EventCard.tsx src/components/Events/FeaturedEventCard.tsx src/components/EventModal/EventModal.tsx src/components/EventModal/eventModalImage.ts src/components/EventModal/ShareableEventPoster.tsx src/components/Admin/AdminEventsTable.tsx src/pages/EventDetailPage.tsx --report-unused-disable-directives --max-warnings 0
npm run build
```

Expected: all commands exit 0; Vite emits the default banner asset as a copied public file.

- [ ] **Step 3: Browser-check desktop and mobile**

Start the app, open an event with no flyer at desktop and 390px mobile widths, and verify:

1. Card, featured card, modal, and detail cover show the supplied banner without distortion.
2. An event with an uploaded flyer still displays its flyer.
3. Trigger Share and inspect the temporary `.shareable-poster` before capture: `.poster-bg-img` uses an inlined version of the default banner.
4. The Story canvas remains 1080×1920 with readable title and metadata.

- [ ] **Step 4: Check final diff hygiene**

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Commit verification-only corrections only if needed**

If browser verification reveals a real source defect, add a focused regression test, fix that defect, rerun Steps 1–4, and commit only the corrective files with `fix: preserve default banner in event surfaces`.

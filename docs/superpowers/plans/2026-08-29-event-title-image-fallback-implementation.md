# Event Title Image Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render deterministic SalsaSegura title art whenever an event flyer is absent or fails, consistently across event cards, the event modal, and generated share posters.

**Architecture:** Add a pure event-title-art SVG generator and a narrow image resolver in the events feature. Add a reusable `EventImage` component which uses a flyer initially, changes a failed `<img>` to the deterministic fallback exactly once, and owns the accessible alt text. Consumers render that component rather than setting an unobservable CSS background URL directly; share output consumes the same resolved URL.

**Tech Stack:** React 19, TypeScript 5.9, Vite, Vitest 4, Testing Library, plain CSS, inline SVG data URLs.

## Global Constraints

- Preserve a valid, loadable flyer without changing its URL, database row, or submission payload.
- Generate title art only for blank, missing, or failed flyer URLs; never upload or persist generated art.
- Inputs are stable event ID, title, event type, city, and start/date; equal inputs must yield equal SVG data URLs.
- Use only `social`, `class`, and `workshop` type palettes: deep plum/coral, indigo/periwinkle, and gold/warm red respectively.
- Draw exactly one low-opacity seeded salsa motif: dancing couple, conga/bongo, claves, trumpet, or vinyl.
- Keep title, SalsaSegura lockup, city, and formatted date inside contrast-safe SVG regions; long/missing titles must never overflow or throw.
- Preserve accessible event-specific alt text and prevent repeated image-error fallback loops.
- Apply the shared behavior to each existing event-image surface; surfaces that do not render an event image remain unchanged.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/features/events/ui/eventTitleImage.ts` | Pure type palette, title wrapping, deterministic motif selection, SVG/data-URL generation, and fallback alt text. |
| `src/features/events/ui/eventTitleImage.test.ts` | Determinism, palette, title bounds, missing input, and data-URL contracts. |
| `src/features/events/ui/EventImage.tsx` | Reusable flyer-or-title-art `<img>` with one-time `onError` recovery. |
| `src/features/events/ui/EventImage.test.tsx` | Flyer precedence, absent-flyer fallback, error recovery, and accessible alt contracts. |
| `src/components/Events/EventCard.tsx` | Standard public feed thumbnail consumer. |
| `src/components/Events/FeaturedEventCard.tsx` | Featured public feed thumbnail consumer. |
| `src/components/EventModal/eventModalImage.ts` | Compatibility-facing resolver migrated from stock photos to the shared title-art resolver. |
| `src/components/EventModal/eventModalImage.test.ts` | Regression coverage for the migrated modal/poster resolver. |
| `src/components/EventModal/EventModal.tsx` | Modal header consumer and poster input source. |
| `src/components/EventModal/ShareableEventPoster.tsx` | Share/poster consumer of the same resolver. |
| `src/components/EventModal/EventModal.test.tsx` | Modal integration coverage for absent and failed flyer state. |

### Task 1: Build deterministic title-art generation

**Files:**
- Create: `src/features/events/ui/eventTitleImage.ts`
- Create: `src/features/events/ui/eventTitleImage.test.ts`

**Interfaces:**
- Produces:

```ts
export type EventTitleImageInput = {
  id: string | number;
  title: string | null | undefined;
  eventType: "social" | "class" | "workshop" | null | undefined;
  city: string | null | undefined;
  start: string | null | undefined;
};

export function createEventTitleImage(input: EventTitleImageInput): string;
export function getEventTitleImageAlt(input: EventTitleImageInput): string;
```

- Consumed by: `EventImage`, `resolveEventModalImage`, and `ShareableEventPoster`.

- [ ] **Step 1: Write the failing generator tests**

```ts
import { createEventTitleImage, getEventTitleImageAlt } from "./eventTitleImage";

describe("createEventTitleImage", () => {
  const social = {
    id: "event-1",
    title: "Havana Nights Social",
    eventType: "social" as const,
    city: "boston",
    start: "2026-09-04 20:00",
  };

  it("is deterministic for identical event data", () => {
    expect(createEventTitleImage(social)).toBe(createEventTitleImage(social));
  });

  it.each(["social", "class", "workshop"] as const)("encodes the %s palette", (eventType) => {
    const url = decodeURIComponent(createEventTitleImage({ ...social, eventType }));
    expect(url).toContain("data:image/svg+xml");
    expect(url).toContain(eventType);
  });

  it("uses bounded fallback text for missing or overlong titles", () => {
    const url = decodeURIComponent(
      createEventTitleImage({ ...social, title: "A ".repeat(500), city: null, start: null })
    );
    expect(url).toContain("SalsaSegura");
    expect(url.length).toBeLessThan(20_000);
    expect(getEventTitleImageAlt({ ...social, title: null })).toBe(
      "SalsaSegura event title image for Event"
    );
  });
});
```

- [ ] **Step 2: Run the generator tests to verify failure**

Run: `npx vitest run src/features/events/ui/eventTitleImage.test.ts`

Expected: FAIL because `eventTitleImage.ts` does not exist.

- [ ] **Step 3: Implement the pure generator**

```ts
const PALETTES = {
  social: { background: "#35113d", accent: "#ff6b61", label: "Social" },
  class: { background: "#252353", accent: "#a9a9ff", label: "Class" },
  workshop: { background: "#5b3112", accent: "#f5bd4f", label: "Workshop" },
} as const;

export function createEventTitleImage(input: EventTitleImageInput): string {
  const type = input.eventType && input.eventType in PALETTES ? input.eventType : "social";
  const title = normaliseAndWrapTitle(input.title);
  const motif = MOTIFS[stableHash(String(input.id)) % MOTIFS.length];
  const svg = renderTitleArtSvg({ palette: PALETTES[type], title, motif, city: input.city, start: input.start });
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
```

Implement `normaliseAndWrapTitle` with an `Event` fallback and at most three fixed-width SVG text lines. Implement `stableHash` without `Math.random`. Embed the SalsaSegura wordmark as SVG text and mark decorative motif paths `aria-hidden="true"`; the returned data URL is consumed through an accessible `<img>`.

- [ ] **Step 4: Run the generator tests to verify success**

Run: `npx vitest run src/features/events/ui/eventTitleImage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the generator unit**

```bash
git add src/features/events/ui/eventTitleImage.ts src/features/events/ui/eventTitleImage.test.ts
git commit -m "feat: generate deterministic event title art"
```

### Task 2: Create one flyer-or-title-art image boundary

**Files:**
- Create: `src/features/events/ui/EventImage.tsx`
- Create: `src/features/events/ui/EventImage.test.tsx`

**Interfaces:**
- Consumes: `EventTitleImageInput`, `createEventTitleImage`, and `getEventTitleImageAlt` from Task 1.
- Produces:

```tsx
export type EventImageProps = EventTitleImageInput & {
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
};

export default function EventImage(props: EventImageProps): JSX.Element;
```

- Consumed by: `EventCard`, `FeaturedEventCard`, and `EventModal`.

- [ ] **Step 1: Write the failing component tests**

```tsx
it("uses a supplied flyer until it emits an error", () => {
  render(<EventImage {...event} imageUrl="https://cdn.example/flyer.webp" alt="Havana flyer" />);
  const image = screen.getByRole("img", { name: "Havana flyer" });
  expect(image).toHaveAttribute("src", "https://cdn.example/flyer.webp");
  fireEvent.error(image);
  expect(image).toHaveAttribute("src", createEventTitleImage(event));
});

it("uses accessible title art immediately for a blank flyer URL", () => {
  render(<EventImage {...event} imageUrl="   " />);
  expect(screen.getByRole("img", { name: /SalsaSegura event title image for Havana Nights Social/i }))
    .toHaveAttribute("src", createEventTitleImage(event));
});
```

- [ ] **Step 2: Run the component tests to verify failure**

Run: `npx vitest run src/features/events/ui/EventImage.test.tsx`

Expected: FAIL because `EventImage.tsx` does not exist.

- [ ] **Step 3: Implement one-time error recovery**

```tsx
const fallbackSrc = createEventTitleImage(input);
const flyerSrc = imageUrl?.trim() || fallbackSrc;
const [src, setSrc] = useState(flyerSrc);
const isFallback = src === fallbackSrc;

return (
  <img
    className={className}
    src={src}
    alt={isFallback ? getEventTitleImageAlt(input) : alt ?? `${input.title ?? "Event"} flyer`}
    loading={loading}
    onError={() => {
      if (!isFallback) setSrc(fallbackSrc);
    }}
  />
);
```

Synchronize state when `imageUrl` or title-art inputs change with an effect. Do not attach an `onError` handler once the fallback is active. Keep the component limited to image source/alt state; layout remains owned by callers.

- [ ] **Step 4: Run the component tests to verify success**

Run: `npx vitest run src/features/events/ui/EventImage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the image boundary**

```bash
git add src/features/events/ui/EventImage.tsx src/features/events/ui/EventImage.test.tsx
git commit -m "feat: add resilient event image boundary"
```

### Task 3: Migrate public feed and modal surfaces

**Files:**
- Modify: `src/components/Events/EventCard.tsx:46-61`
- Modify: `src/components/Events/FeaturedEventCard.tsx:46-55`
- Modify: `src/components/Events/Events.css`
- Modify: `src/components/EventModal/EventModal.tsx:156, modal poster header`
- Modify: `src/components/EventModal/EventModal.css`
- Modify: `src/components/EventModal/eventModalImage.ts`
- Modify: `src/components/EventModal/eventModalImage.test.ts`
- Modify: `src/components/EventModal/EventModal.test.tsx`

**Interfaces:**
- Consumes: `EventImage` from Task 2 and `createEventTitleImage` from Task 1.
- Produces: all public card and modal image areas render the same title art if the flyer is absent or fails.
- Existing input mapping from `ScheduleXEvent`:

```ts
const imageInput = {
  id: event.id,
  title: event.title,
  eventType: event.calendarId,
  city: event.city,
  start: typeof event.start === "string" ? event.start : String(event.start),
};
```

- [ ] **Step 1: Write failing feed/modal integration tests**

```tsx
it("renders generated title art in a card without imageUrl", () => {
  render(<EventCard event={{ ...event, imageUrl: undefined }} onSelect={vi.fn()} />);
  expect(screen.getByRole("img", { name: /SalsaSegura event title image for Havana Nights Social/i }))
    .toHaveAttribute("src", createEventTitleImage(imageInput));
});

it("uses generated art in the modal poster when the flyer is absent", () => {
  render(<EventModal event={{ ...event, imageUrl: undefined }} onClose={vi.fn()} />);
  expect(screen.getByRole("img", { name: /SalsaSegura event title image for Havana Nights Social/i }))
    .toHaveAttribute("src", createEventTitleImage(imageInput));
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npx vitest run src/components/Events/EventCard.test.tsx src/components/EventModal/eventModalImage.test.ts src/components/EventModal/EventModal.test.tsx`

Expected: FAIL because cards and modal use background-image styles or stock photo fallbacks.

- [ ] **Step 3: Replace background-image-only rendering with `EventImage`**

Render `EventImage` as the first child of each media container:

```tsx
<div className={`event-card-thumb event-card-thumb--${event.calendarId}`}>
  <EventImage {...imageInput} imageUrl={event.imageUrl} className="event-card-thumb__image" loading="lazy" />
  {/* chip and date overlay remain siblings above the image */}
</div>
```

Add `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;` to the new image elements and preserve existing overlay stacking with `position: relative; z-index: 1`.

Replace `resolveEventModalImage` stock-image selection with `createEventTitleImage`; retain its exported name only if `ShareableEventPoster` currently imports it. Its `Pick<ScheduleXEvent, ...>` input expands only to title, city, and start fields needed by the generator. In the modal, render `EventImage` in the poster shell so a broken flyer recovers without changing its parent layout.

- [ ] **Step 4: Run focused tests and lint**

Run:

```bash
npx vitest run src/features/events/ui/EventImage.test.tsx src/components/Events/EventCard.test.tsx src/components/EventModal/eventModalImage.test.ts src/components/EventModal/EventModal.test.tsx
npx eslint src/features/events/ui/EventImage.tsx src/components/Events/EventCard.tsx src/components/Events/FeaturedEventCard.tsx src/components/EventModal/EventModal.tsx --ext ts,tsx --max-warnings 0
```

Expected: PASS.

- [ ] **Step 5: Commit public-surface migration**

```bash
git add src/components/Events/EventCard.tsx src/components/Events/FeaturedEventCard.tsx src/components/Events/Events.css src/components/EventModal/EventModal.tsx src/components/EventModal/EventModal.css src/components/EventModal/eventModalImage.ts src/components/EventModal/eventModalImage.test.ts src/components/EventModal/EventModal.test.tsx
git commit -m "feat: show title art for missing event flyers"
```

### Task 4: Use title art in share output and audit remaining image consumers

**Files:**
- Modify: `src/components/EventModal/ShareableEventPoster.tsx`
- Modify: `src/components/EventModal/ShareableEventPoster.test.tsx`
- Modify: every production event-image consumer found by `imageUrl`/`image_url` search that is not covered by Task 3

**Interfaces:**
- Consumes: `resolveEventModalImage(event)` from Task 3 or `createEventTitleImage` directly where the consumer has `EventTitleImageInput` fields.
- Produces: share/poster output uses an uploaded flyer when available and deterministic title art otherwise.

- [ ] **Step 1: Write the failing share-output test**

```tsx
it("passes deterministic title art to poster output without an uploaded flyer", () => {
  render(<ShareableEventPoster event={{ ...event, imageUrl: undefined }} />);
  expect(screen.getByRole("img", { name: /Havana Nights Social/i }))
    .toHaveAttribute("src", createEventTitleImage(imageInput));
});
```

- [ ] **Step 2: Run the share test to verify failure**

Run: `npx vitest run src/components/EventModal/ShareableEventPoster.test.tsx`

Expected: FAIL because the poster has no generated-image input contract.

- [ ] **Step 3: Migrate poster and audit production consumers**

In `ShareableEventPoster`, replace an absent `imageUrl` background with the output of `resolveEventModalImage(event)`, keeping the image source identical to the modal. Search only `src/` production code for `imageUrl`, `image_url`, `backgroundImage`, and `<img`; migrate each event-image rendering site to `EventImage` or the resolver. Do not alter host, venue, profile, gallery, design/handoff, or test-fixture imagery.

- [ ] **Step 4: Run share tests, targeted suite, and browser smoke test**

Run:

```bash
npx vitest run src/components/EventModal/ShareableEventPoster.test.tsx src/components/EventModal/eventModalImage.test.ts src/components/EventModal/EventModal.test.tsx src/components/Events/EventCard.test.tsx
```

Then start the Vite app and use the browser to verify a fixture event without `imageUrl` displays its SalsaSegura title art in a feed card, modal header, and share poster; inspect the browser console for image errors.

Expected: PASS tests; all three UI surfaces visibly show the same type palette, title, city/date, logo, and a salsa motif.

- [ ] **Step 5: Commit share and audit completion**

```bash
git add src/components/EventModal/ShareableEventPoster.tsx src/components/EventModal/ShareableEventPoster.test.tsx src
git commit -m "feat: reuse event title art in share output"
```

### Task 5: Run the required regression gate

**Files:**
- Modify: none unless verification exposes a product defect.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: verified production-ready fallback behavior.

- [ ] **Step 1: Run lint excluding unrelated nested worktrees**

Run:

```bash
npx eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0
```

Expected: PASS. This scoped command avoids known unrelated Deno lint failures under `.worktrees/**`.

- [ ] **Step 2: Run the full application test suite**

Run: `npx vitest run`

Expected: PASS with no regressions.

- [ ] **Step 3: Build the application**

Run: `npm run build`

Expected: PASS; generated SVG/data URL code is bundled without client-only runtime failures.

- [ ] **Step 4: Commit only if a verification fix was necessary**

```bash
git add <specific-fixed-files>
git commit -m "fix: complete event title image fallback verification"
```

Do not create an empty verification commit.

## Plan self-review

- **Spec coverage:** Task 1 covers deterministic type palettes, title/date/city/logo/motifs, input safety, and contrast-safe bounded SVG text. Task 2 covers flyer precedence, accessible alt text, and one-time image-load recovery. Task 3 applies the behavior to cards and modal. Task 4 applies it to poster output and audits every remaining production event-image surface. Task 5 performs lint, test, build, and real-browser confirmation.
- **No placeholders:** No task contains an unbounded implementation instruction; exact inputs, outputs, test seams, and verification commands are stated.
- **Type consistency:** Every consumer uses `EventTitleImageInput`; `EventImage` owns flyer-to-fallback state; `resolveEventModalImage` stays a compatibility resolver for poster callers.

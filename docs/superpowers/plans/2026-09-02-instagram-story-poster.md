# Instagram Story Poster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Share a 1080×1920 Story PNG that contains the flyer for every event with a flyer, including remote images that reject browser CORS requests, and give the Story a flyer-forward safe-area layout.

**Architecture:** A public-share Edge Function receives an event ID, reads the approved event’s stored flyer source server-side, validates and caches a normalized copy in Supabase Storage, and returns the cache URL. The browser converts that controlled asset to a data URL before `html-to-image` capture. The poster uses a blurred cover layer plus an uncropped foreground flyer and a lower safe-area information panel.

**Tech Stack:** React 19, TypeScript, Vitest, `html-to-image`, Supabase Postgres/Storage/Edge Functions, `@supabase/server`.

**Spec:** `Docs/superpowers/specs/2026-09-02-instagram-story-poster-design.md`

## Global Constraints

- Preserve `events.image_url` as the original flyer source; use `events.poster_image_url` only as the normalized sharing cache.
- The public client sends only `eventId`; it never submits a URL for the function to fetch.
- The Edge Function accepts only the project publishable credential and returns data only for approved events.
- Reject non-HTTPS, credentialed, localhost, literal-IP, redirecting-to-invalid, non-image, and >8 MiB sources before storage writes.
- A flyer normalization failure must block sharing and show a user-facing error. Flyer-less events still share the designed no-flyer poster.
- Capture only an inline data URL; never make `html-to-image` fetch a remote flyer.
- Preserve the existing native-file-share and direct-download fallback contracts.
- Use a framed `object-fit: contain` foreground flyer; never crop the supplied artwork.

---

### Task 1: Persist normalized poster cache metadata

**Files:**
- Create: `supabase/migrations/20260902000007_poster_image_cache.sql`
- Modify: `src/features/events/model/types.ts`
- Modify: `src/features/events/model/convert.ts`
- Test: `src/features/events/model/convert.test.ts`

**Interfaces:**
- Produces `DatabaseEvent.poster_image_url: string | null` and `ScheduleXEvent.posterImageUrl?: string`.
- Later tasks consume `posterImageUrl` only for poster capture; all existing display surfaces continue using `imageUrl`.

- [ ] **Step 1: Write the failing adapter test**

```ts
it("preserves a normalized poster image independently from the original flyer", () => {
  const result = databaseEventToScheduleX(
    mockEvent({
      image_url: "https://flyers.example/original.jpg",
      poster_image_url: "https://project.supabase.co/storage/v1/object/public/event-flyers/poster-cache/event-1/a.jpg",
    })
  );

  expect(result.imageUrl).toBe("https://flyers.example/original.jpg");
  expect(result.posterImageUrl).toContain("poster-cache/event-1/");
});
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `npm test -- --run src/features/events/model/convert.test.ts`

Expected: FAIL because `poster_image_url` and `posterImageUrl` do not exist.

- [ ] **Step 3: Add the additive migration**

```sql
alter table public.events
  add column if not exists poster_image_url text;

comment on column public.events.poster_image_url is
  'Platform-controlled normalized flyer asset used only by Story poster sharing.';

create or replace function public.clear_poster_image_url_on_source_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.image_url is distinct from old.image_url then
    new.poster_image_url := null;
  end if;
  return new;
end;
$$;

create trigger events_clear_poster_image_url_before_update
before update of image_url on public.events
for each row execute function public.clear_poster_image_url_on_source_change();
```

Use the repository’s existing migration timestamp ordering if another migration lands first. Do not change RLS policies: this adds only a nullable field to the existing public event record.

- [ ] **Step 4: Thread the nullable field through the event model**

Add `poster_image_url: string | null` to `DatabaseEvent`. In `databaseEventToScheduleX`, map `event.poster_image_url ?? undefined` to `posterImageUrl` without changing the `imageUrl` mapping.

- [ ] **Step 5: Run the adapter test to verify it passes**

Run: `npm test -- --run src/features/events/model/convert.test.ts`

Expected: PASS; the original and cache URLs remain distinct.

- [ ] **Step 6: Verify the migration locally**

Run: `supabase db reset`

Expected: the reset applies the new migration without altering existing event access policies.

- [ ] **Step 7: Commit the schema contract**

```bash
git add supabase/migrations/20260902000007_poster_image_cache.sql src/features/events/model/types.ts src/features/events/model/convert.ts src/features/events/model/convert.test.ts
git commit -m "feat: persist poster flyer cache metadata"
```

### Task 2: Normalize approved-event flyers in a constrained Edge Function

**Files:**
- Create: `supabase/functions/resolve-poster-flyer/index.ts`
- Create: `supabase/functions/resolve-poster-flyer/index.test.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes `POST { eventId: string }` with the project publishable Supabase credential.
- Produces `{ status: "ready"; url: string } | { status: "missing" } | { status: "unavailable"; message: string }`.
- Uses `events.id`, `events.status`, `events.image_url`, and `events.poster_image_url`; writes only a normalized cache object and `poster_image_url`.

- [ ] **Step 1: Write failing Deno handler tests**

Create dependency seams for event lookup, cache lookup/write, event update, and remote fetch. Cover these cases:

```ts
Deno.test("returns an existing poster cache without fetching the source", async () => {
  const handler = createResolvePosterFlyerHandler(makeDependencies({
    event: approvedEvent({ poster_image_url: "https://storage.test/cache.jpg" }),
  }));

  const response = await handler(post({ eventId: "event-1" }));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { status: "ready", url: "https://storage.test/cache.jpg" });
  assertEquals(fetchCalls.length, 0);
});

Deno.test("rejects a literal-IP source before remote fetch", async () => {
  const handler = createResolvePosterFlyerHandler(makeDependencies({
    event: approvedEvent({ image_url: "https://127.0.0.1/flyer.png" }),
  }));

  const response = await handler(post({ eventId: "event-1" }));

  assertEquals(response.status, 422);
  assertEquals(await response.json(), { status: "unavailable", message: "Flyer source cannot be used for sharing." });
});

Deno.test("stores an HTTPS image and saves its cache URL", async () => {
  const handler = createResolvePosterFlyerHandler(makeDependencies({
    event: approvedEvent({ image_url: "https://cdn.example/flyer.jpg" }),
    remoteResponse: imageResponse(new Uint8Array([1, 2, 3]), "image/jpeg"),
  }));

  const response = await handler(post({ eventId: "event-1" }));

  assertEquals(response.status, 200);
  assertEquals((await response.json()).status, "ready");
  assertEquals(storageWrites.length, 1);
  assertEquals(eventUpdates[0].poster_image_url, storageWrites[0].publicUrl);
});
```

Also test non-POST (405), malformed/missing event ID (400), unapproved/missing event (404), credentials in URL, non-image MIME, >8 MiB body, redirect-to-invalid source, and a source with no `image_url` returning `{ status: "missing" }`.

- [ ] **Step 2: Run Deno tests to verify they fail**

Run: `deno test --allow-env supabase/functions/resolve-poster-flyer/index.test.ts`

Expected: FAIL because `createResolvePosterFlyerHandler` does not exist.

- [ ] **Step 3: Implement pure validation and handler logic**

In `index.ts`, define the exported handler factory and dependencies before runtime wiring:

```ts
export type PosterFlyerResponse =
  | { status: "ready"; url: string }
  | { status: "missing" }
  | { status: "unavailable"; message: string };

export function createResolvePosterFlyerHandler(dependencies: ResolvePosterFlyerDependencies) {
  return async (request: Request): Promise<Response> => {
    // POST only; parse `{ eventId }`; load an approved event by ID.
    // Return cached poster_image_url immediately.
    // Validate every URL before fetching and after each manual redirect.
    // Reject a non-image or body over 8 MiB before cache write.
    // Hash the final source URL, upload to event-flyers/poster-cache/<eventId>/<hash>.<extension>,
    // update poster_image_url, then return the public URL.
  };
}
```

Use `new URL()` validation with these exact rejection conditions: protocol is not `https:`, username or password is present, hostname is `localhost`, hostname ends in `.localhost`, or hostname is an IPv4/IPv6 literal. Fetch with `redirect: "manual"`; follow no more than three `Location` values, resolving each against the previous URL and validating each next URL. Accept only `image/jpeg`, `image/png`, `image/webp`, and `image/gif`. Reject an announced or actual body size over `8 * 1024 * 1024` bytes. Derive a deterministic hexadecimal SHA-256 from the final URL using `crypto.subtle.digest`.

- [ ] **Step 4: Add runtime wiring with publishable-key authentication**

Use the Supabase server wrapper for the Edge Function:

```ts
import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "publishable" }, async (request, context) =>
    createResolvePosterFlyerHandler(runtimeDependencies(context))(request)
  ),
};
```

`runtimeDependencies` must use the context’s admin client for the approved-event lookup, storage upload, and cache-column update. It must never read a caller-supplied source URL. Add:

```toml
[functions.resolve-poster-flyer]
verify_jwt = false
```

to `supabase/config.toml`, because the wrapper accepts the publishable app credential rather than a user JWT.

- [ ] **Step 5: Run the Deno tests to verify they pass**

Run: `deno test --allow-env supabase/functions/resolve-poster-flyer/index.test.ts`

Expected: PASS with all cache-hit, authorization, source-validation, redirect, MIME, size, and upload cases green.

- [ ] **Step 6: Commit the constrained media normalizer**

```bash
git add supabase/functions/resolve-poster-flyer/index.ts supabase/functions/resolve-poster-flyer/index.test.ts supabase/config.toml
git commit -m "feat: cache remote flyers for Story sharing"
```

### Task 3: Block a broken share instead of sharing a photo-less poster

**Files:**
- Create: `src/features/calendar/api/posterFlyers.ts`
- Create: `src/features/calendar/api/posterFlyers.test.ts`
- Modify: `src/features/calendar/hooks/useShareablePoster.ts`
- Modify: `src/features/calendar/hooks/useShareablePoster.test.tsx`
- Modify: `src/components/EventModal/EventModal.tsx`
- Modify: `src/components/EventModal/EventModal.test.tsx`
- Modify: `src/components/EventModal/EventModal.css`

**Interfaces:**
- `requestPosterFlyer(eventId: string): Promise<PosterFlyerResponse>` invokes `resolve-poster-flyer` through `supabase.functions.invoke`.
- `resolvePosterImage({ eventId, sourceUrl, cachedUrl }): Promise<PosterImageResolution>` returns `ready` with a data URL, `missing`, or `unavailable`.
- `EventModal` shares only when the resolution is `ready` or `missing`; it renders a local `shareError` alert for `unavailable`.

- [ ] **Step 1: Write failing client API and resolver tests**

```ts
it("requests a normalized poster asset by event ID only", async () => {
  vi.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { status: "ready", url: "https://project.supabase.co/cache.jpg" },
    error: null,
  } as never);

  await expect(requestPosterFlyer("event-1")).resolves.toEqual({
    status: "ready",
    url: "https://project.supabase.co/cache.jpg",
  });
  expect(supabase.functions.invoke).toHaveBeenCalledWith("resolve-poster-flyer", {
    body: { eventId: "event-1" },
  });
});

it("returns unavailable when a flyer exists but cache normalization fails", async () => {
  vi.mocked(requestPosterFlyer).mockResolvedValue({
    status: "unavailable",
    message: "Flyer source cannot be used for sharing.",
  });

  await expect(resolvePosterImage({ eventId: "event-1", sourceUrl: "https://blocked.test/flyer.jpg" }))
    .resolves.toEqual({ status: "unavailable" });
});
```

Add an EventModal test asserting `navigator.share` is not called and an alert says `We couldn't prepare this event flyer for sharing. Please try again later.` when a flyer is unavailable.

- [ ] **Step 2: Run the client and modal tests to verify they fail**

Run: `npm test -- --run src/features/calendar/api/posterFlyers.test.ts src/features/calendar/hooks/useShareablePoster.test.tsx src/components/EventModal/EventModal.test.tsx`

Expected: FAIL because the client module, discriminated resolution result, and `shareError` UI do not exist.

- [ ] **Step 3: Implement the function client and typed resolution**

```ts
export type PosterImageResolution =
  | { status: "ready"; dataUrl: string }
  | { status: "missing" }
  | { status: "unavailable" };

export async function resolvePosterImage({
  eventId,
  sourceUrl,
  cachedUrl,
}: {
  eventId: string;
  sourceUrl?: string;
  cachedUrl?: string;
}): Promise<PosterImageResolution> {
  if (!sourceUrl && !cachedUrl) return { status: "missing" };
  const asset = cachedUrl ? { status: "ready" as const, url: cachedUrl } : await requestPosterFlyer(eventId);
  if (asset.status === "missing") return { status: "missing" };
  if (asset.status === "unavailable") return { status: "unavailable" };
  const dataUrl = await fetchAssetAsDataUrl(asset.url);
  return dataUrl ? { status: "ready", dataUrl } : { status: "unavailable" };
}
```

`fetchAssetAsDataUrl` must use `fetch`, require an OK response and allowed image MIME, and convert the returned blob using `FileReader`. The capture hook must not expose remote source URLs to `html-to-image`.

- [ ] **Step 4: Update the share action**

Pass `event.id`, `event.imageUrl`, and `event.posterImageUrl` to the resolver. If it returns `unavailable`, set `shareError`, skip `createRoot`, `capturePoster`, `navigator.share`, and `downloadPoster`, then clean the render target. If it returns `missing`, render the no-flyer poster. Clear `shareError` at the beginning of each new share attempt and render it in both existing action regions with `role="alert"`.

- [ ] **Step 5: Run the client and modal tests to verify they pass**

Run: `npm test -- --run src/features/calendar/api/posterFlyers.test.ts src/features/calendar/hooks/useShareablePoster.test.tsx src/components/EventModal/EventModal.test.tsx`

Expected: PASS; blocked flyer sources cannot open native share, while flyer-less events keep the no-flyer share path.

- [ ] **Step 6: Commit the no-silent-fallback behavior**

```bash
git add src/features/calendar/api/posterFlyers.ts src/features/calendar/api/posterFlyers.test.ts src/features/calendar/hooks/useShareablePoster.ts src/features/calendar/hooks/useShareablePoster.test.tsx src/components/EventModal/EventModal.tsx src/components/EventModal/EventModal.test.tsx src/components/EventModal/EventModal.css
git commit -m "fix: block Story sharing when flyer normalization fails"
```

### Task 4: Make the Story poster flyer-forward and safe-area balanced

**Files:**
- Modify: `src/components/EventModal/ShareableEventPoster.tsx`
- Modify: `src/components/EventModal/ShareableEventPoster.css`
- Modify: `src/components/EventModal/ShareableEventPoster.test.tsx`

**Interfaces:**
- Consumes `imageUrl?: string`, which is now always an inline data URL when present.
- Produces `.poster-artwork-fill`, `.poster-artwork-frame`, `.poster-artwork-image`, and `.poster-info-panel` for the Story capture surface.

- [ ] **Step 1: Write failing poster structure tests**

```tsx
it("renders an uncropped foreground flyer and a separate background fill", () => {
  render(<ShareableEventPoster event={event} imageUrl="data:image/png;base64,flyer" />);

  expect(document.querySelector(".poster-artwork-fill img")).toHaveAttribute("src", "data:image/png;base64,flyer");
  expect(document.querySelector(".poster-artwork-image")).toHaveAttribute("src", "data:image/png;base64,flyer");
  expect(document.querySelector(".poster-info-panel")).toBeInTheDocument();
});

it("uses the identical information panel when an event has no flyer", () => {
  render(<ShareableEventPoster event={event} />);

  expect(document.querySelector(".poster-artwork-frame")).not.toBeInTheDocument();
  expect(document.querySelector(".poster-info-panel")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the poster tests to verify they fail**

Run: `npm test -- --run src/components/EventModal/ShareableEventPoster.test.tsx`

Expected: FAIL because the foreground artwork and information-panel structure do not exist.

- [ ] **Step 3: Replace the single background image layer with art and information layers**

For a present `imageUrl`, render both:

```tsx
<div className="poster-artwork-fill" aria-hidden="true">
  <img src={imageUrl} alt="" />
</div>
<div className="poster-artwork-frame">
  <img className="poster-artwork-image" src={imageUrl} alt="" />
</div>
```

Move the type/date/title/meta/CTA content into `<section className="poster-info-panel">`. Keep the existing accessible poster `role="img"` and title-derived label.

- [ ] **Step 4: Implement the exact Story geometry in CSS**

Keep the capture root at `1080px × 1920px`. Position `.poster-artwork-fill` full bleed with `filter: blur(36px) scale(1.08)` and a dark overlay. Position `.poster-artwork-frame` at `top: 176px; right: 72px; left: 72px; height: 920px`, with a dark surface, 24px radius, and overflow hidden. Set `.poster-artwork-image` to `width: 100%; height: 100%; object-fit: contain;`. Position `.poster-info-panel` from `top: 1052px` through `bottom: 176px`, with a solid `rgba(11, 19, 38, 0.94)` surface and the existing hierarchy scaled to fit long titles. The no-flyer path keeps the gradient background and begins the same information panel at `1052px`.

- [ ] **Step 5: Run the poster tests to verify they pass**

Run: `npm test -- --run src/components/EventModal/ShareableEventPoster.test.tsx`

Expected: PASS; both flyer and no-flyer structures preserve a single safe-area details panel.

- [ ] **Step 6: Commit the Story layout**

```bash
git add src/components/EventModal/ShareableEventPoster.tsx src/components/EventModal/ShareableEventPoster.css src/components/EventModal/ShareableEventPoster.test.tsx
git commit -m "feat: foreground event flyers in Story posters"
```

### Task 5: Validate deployed contracts and capture output

**Files:**
- Modify only files required by defects found in this task.

**Interfaces:**
- Verifies all contracts from Tasks 1–4 without changing function names or response shapes.

- [ ] **Step 1: Run all relevant client tests**

Run:

```bash
npm test -- --run src/features/events/model/convert.test.ts src/features/calendar/api/posterFlyers.test.ts src/features/calendar/hooks/useShareablePoster.test.tsx src/components/EventModal/ShareableEventPoster.test.tsx src/components/EventModal/EventModal.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run the Edge Function test suite**

Run: `deno test --allow-env supabase/functions/resolve-poster-flyer/index.test.ts`

Expected: PASS.

- [ ] **Step 3: Run project validation**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit 0. Record any existing/non-blocking Vite chunk-size warning exactly as emitted.

- [ ] **Step 4: Browser-verify rendered Story posters**

Start the Vite preview. Render actual `ShareableEventPoster` components with deterministic inline portrait, square, and landscape flyer fixtures at 1080×1920. Capture screenshots and inspect that each has: visible foreground flyer, no cropping, lower safe-area information panel, readable title, and no overlap. Exercise the share path with a mocked `navigator.share` and confirm the generated file is PNG with the existing filename contract.

- [ ] **Step 5: Verify the hosted function before production use**

Deploy only after explicit deployment approval. Invoke `resolve-poster-flyer` through the client against one approved event with an external flyer and confirm that the returned cache URL is stored in `events.poster_image_url`. Then share the event on an iPhone and confirm the Instagram Story composer contains the flyer.

- [ ] **Step 6: Commit final validation fixes only if needed**

```bash
git add <only-files-changed-by-validation>
git commit -m "test: verify Story poster flyer capture"
```

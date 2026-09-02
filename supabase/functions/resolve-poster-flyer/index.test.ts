/* eslint-disable */
// @ts-nocheck - Deno test file
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createResolvePosterFlyerHandler } from "./index.ts";
import type { PosterEventRecord, ResolvePosterFlyerDependencies } from "./index.ts";

function approvedEvent(overrides: Partial<PosterEventRecord> = {}): PosterEventRecord {
  return {
    id: "event-1",
    status: "approved",
    image_url: "https://cdn.example/flyer.jpg",
    poster_image_url: null,
    ...overrides,
  };
}

function makeDependencies(
  overrides: Partial<ResolvePosterFlyerDependencies> & {
    event?: PosterEventRecord | null;
    fetchImpl?: ResolvePosterFlyerDependencies["fetchImage"];
  } = {},
): ResolvePosterFlyerDependencies & {
  uploads: Array<{ path: string; bytes: Uint8Array; contentType: string }>;
  updates: Array<{ eventId: string; url: string }>;
  fetchCalls: string[];
} {
  const uploads: Array<{ path: string; bytes: Uint8Array; contentType: string }> = [];
  const updates: Array<{ eventId: string; url: string }> = [];
  const fetchCalls: string[] = [];

  const event = overrides.event !== undefined ? overrides.event : approvedEvent();

  return {
    getEvent: async (id: string) => {
      if (overrides.getEvent) return overrides.getEvent(id);
      return event;
    },
    getPublicUrl: (path: string) => {
      if (overrides.getPublicUrl) return overrides.getPublicUrl(path);
      return `https://project.supabase.co/storage/v1/object/public/event-flyers/${path}`;
    },
    uploadCache: async (path: string, bytes: Uint8Array, contentType: string) => {
      if (overrides.uploadCache) return overrides.uploadCache(path, bytes, contentType);
      uploads.push({ path, bytes, contentType });
      return { error: null };
    },
    updatePosterUrl: async (eventId: string, url: string) => {
      if (overrides.updatePosterUrl) return overrides.updatePosterUrl(eventId, url);
      updates.push({ eventId, url });
      return { error: null };
    },
    fetchImage: async (url: string, init?: RequestInit) => {
      fetchCalls.push(url);
      if (overrides.fetchImpl) return overrides.fetchImpl(url, init);
      if (overrides.fetchImage) return overrides.fetchImage(url, init);
      const body = new Uint8Array([1, 2, 3]);
      return new Response(body as unknown as BodyInit, {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": String(body.length) },
      });
    },
    log: () => {},
    uploads,
    updates,
    fetchCalls,
  };
}

function post(body: unknown): Request {
  return new Request("http://localhost/functions/v1/resolve-poster-flyer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function imageResponse(bytes: Uint8Array, mime = "image/jpeg", status = 200): Response {
  return new Response(bytes as unknown as BodyInit, {
    status,
    headers: { "content-type": mime, "content-length": String(bytes.length) },
  });
}

Deno.test("returns an existing poster cache without fetching the source", async () => {
  const deps = makeDependencies({
    event: approvedEvent({ poster_image_url: "https://storage.test/cache.jpg" }),
  });
  const handler = createResolvePosterFlyerHandler(deps);

  const res = await handler(post({ eventId: "event-1" }));

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: "ready", url: "https://storage.test/cache.jpg" });
  assertEquals(deps.fetchCalls.length, 0);
});

Deno.test("rejects a literal-IP source before remote fetch", async () => {
  const deps = makeDependencies({
    event: approvedEvent({ image_url: "https://127.0.0.1/flyer.png" }),
  });
  const handler = createResolvePosterFlyerHandler(deps);

  const res = await handler(post({ eventId: "event-1" }));

  assertEquals(res.status, 422);
  assertEquals(await res.json(), { status: "unavailable", message: "Flyer source cannot be used for sharing." });
  assertEquals(deps.fetchCalls.length, 0);
});

Deno.test("stores an HTTPS image and saves its cache URL", async () => {
  const deps = makeDependencies({
    event: approvedEvent({ image_url: "https://cdn.example/flyer.jpg" }),
    fetchImpl: async () => imageResponse(new Uint8Array([1, 2, 3]), "image/jpeg"),
  });
  const handler = createResolvePosterFlyerHandler(deps);

  const res = await handler(post({ eventId: "event-1" }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.status, "ready");
  assertEquals(typeof body.url, "string");
  assertEquals(deps.uploads.length, 1);
  assertEquals(deps.uploads[0].path.startsWith("poster-cache/event-1/"), true);
  assertEquals(deps.uploads[0].path.endsWith(".jpg"), true);
  assertEquals(deps.updates.length, 1);
  assertEquals(deps.updates[0].eventId, "event-1");
  assertEquals(deps.updates[0].url, body.url);
});

Deno.test("rejects non-POST with 405", async () => {
  const deps = makeDependencies();
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(new Request("http://localhost/functions/v1/resolve-poster-flyer"));
  assertEquals(res.status, 405);
});

Deno.test("rejects malformed JSON with 400", async () => {
  const deps = makeDependencies();
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(
    new Request("http://localhost/functions/v1/resolve-poster-flyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    }),
  );
  assertEquals(res.status, 400);
});

Deno.test("rejects missing eventId with 400", async () => {
  const deps = makeDependencies();
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({}));
  assertEquals(res.status, 400);
});

Deno.test("returns 404 for missing or unapproved event", async () => {
  const missingDeps = makeDependencies({ event: null });
  const handler1 = createResolvePosterFlyerHandler(missingDeps);
  assertEquals((await handler1(post({ eventId: "event-1" }))).status, 404);

  const pendingDeps = makeDependencies({
    event: approvedEvent({ status: "pending" }),
  });
  const handler2 = createResolvePosterFlyerHandler(pendingDeps);
  assertEquals((await handler2(post({ eventId: "event-1" }))).status, 404);
});

Deno.test("returns missing when event has no image_url", async () => {
  const deps = makeDependencies({
    event: approvedEvent({ image_url: null }),
  });
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({ eventId: "event-1" }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: "missing" });
});

Deno.test("rejects credentials in URL", async () => {
  const deps = makeDependencies({
    event: approvedEvent({ image_url: "https://user:pass@cdn.example/flyer.jpg" }),
  });
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({ eventId: "event-1" }));
  assertEquals(res.status, 422);
});

Deno.test("rejects non-https URL", async () => {
  const deps = makeDependencies({
    event: approvedEvent({ image_url: "http://cdn.example/flyer.jpg" }),
  });
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({ eventId: "event-1" }));
  assertEquals(res.status, 422);
});

Deno.test("rejects non-image MIME", async () => {
  const deps = makeDependencies({
    fetchImpl: async () => imageResponse(new Uint8Array([1, 2, 3]), "text/html"),
  });
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({ eventId: "event-1" }));
  assertEquals(res.status, 422);
});

Deno.test("rejects announced size over 8 MiB", async () => {
  const deps = makeDependencies({
    fetchImpl: async () =>
      new Response(new Uint8Array([1]) as unknown as BodyInit, {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": String(9 * 1024 * 1024) },
      }),
  });
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({ eventId: "event-1" }));
  assertEquals(res.status, 422);
});

Deno.test("rejects actual body over 8 MiB", async () => {
  const big = new Uint8Array(8 * 1024 * 1024 + 1);
  const deps = makeDependencies({
    fetchImpl: async () => imageResponse(big, "image/jpeg"),
  });
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({ eventId: "event-1" }));
  assertEquals(res.status, 422);
});

Deno.test("rejects redirect to invalid source", async () => {
  const deps = makeDependencies({
    fetchImpl: async (url: string) => {
      if (url === "https://cdn.example/flyer.jpg") {
        return new Response(null, { status: 302, headers: { location: "https://127.0.0.1/evil.jpg" } });
      }
      return imageResponse(new Uint8Array([1]), "image/jpeg");
    },
  });
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({ eventId: "event-1" }));
  assertEquals(res.status, 422);
});

Deno.test("follows single redirect and stores final URL hash", async () => {
  const deps = makeDependencies({
    fetchImpl: async (url: string) => {
      if (url === "https://cdn.example/flyer.jpg") {
        return new Response(null, { status: 302, headers: { location: "https://cdn.example/flyer2.jpg" } });
      }
      return imageResponse(new Uint8Array([9, 9, 9]), "image/png");
    },
  });
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({ eventId: "event-1" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.status, "ready");
  assertEquals(deps.uploads[0].path.endsWith(".png"), true);
});

Deno.test("returns 422 on fetch failure", async () => {
  const deps = makeDependencies({
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({ eventId: "event-1" }));
  assertEquals(res.status, 422);
});

Deno.test("returns 422 on non-OK response", async () => {
  const deps = makeDependencies({
    fetchImpl: async () => new Response(null, { status: 404 }),
  });
  const handler = createResolvePosterFlyerHandler(deps);
  const res = await handler(post({ eventId: "event-1" }));
  assertEquals(res.status, 422);
});

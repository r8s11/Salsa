import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createExtractFlyerHandler, type ExtractFlyerDependencies } from "./index.ts";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const imageUrl = `https://project.supabase.co/storage/v1/object/public/event-flyers/${ownerId}/submission-33333333-3333-4333-8333-333333333333/flyer.png`;

function responseJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function imageResponse(bytes = new Uint8Array([1, 2, 3]), mime = "image/png"): Response {
  return new Response(bytes, { status: 200, headers: { "content-type": mime, "content-length": String(bytes.byteLength) } });
}

function makeDependencies(overrides: Partial<ExtractFlyerDependencies> = {}): ExtractFlyerDependencies {
  return {
    supabaseUrl: "https://project.supabase.co",
    openaiKey: "test-key",
    getUser: () => Promise.resolve({ userId: ownerId }),
    fetchImage: () => Promise.resolve(imageResponse()),
    fetchOpenAI: () => Promise.resolve(responseJson({
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ title: "Salsa Night", dance_styles: ["Salsa"] }) }] }],
    })),
    ...overrides,
  };
}

function request(method = "POST", body: unknown = { imageUrl }, authorization = "Bearer token"): Request {
  return new Request("https://functions.example/extract-flyer", {
    method,
    headers: { authorization, "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

Deno.test("handles CORS preflight and rejects non-POST requests", async () => {
  const handler = createExtractFlyerHandler(makeDependencies());
  assertEquals((await handler(request("OPTIONS"))).status, 204);
  assertEquals((await handler(request("GET"))).status, 405);
});

Deno.test("requires valid authentication", async () => {
  const handler = createExtractFlyerHandler(makeDependencies({ getUser: () => Promise.resolve({ userId: null }) }));
  const response = await handler(request("POST", { imageUrl }, "Bearer invalid"));
  assertEquals(response.status, 401);
});

Deno.test("rejects malformed, URL-shaped, traversal, wrong-bucket, and another user's paths", async () => {
  const handler = createExtractFlyerHandler(makeDependencies());
  for (const value of [
    "https://example.com/flyer.png",
    "https://project.supabase.co/storage/v1/object/public/other-bucket/x",
    `https://project.supabase.co/storage/v1/object/public/event-flyers/${otherId}/submission-33333333-3333-4333-8333-333333333333/flyer.png`,
    `https://project.supabase.co/storage/v1/object/public/event-flyers/${ownerId}/submission-33333333-3333-4333-8333-333333333333/../secret.png`,
    "/event-flyers/flyer.png",
  ]) {
    const response = await handler(request("POST", { imageUrl: value }));
    assertEquals(response.status, 400);
  }
});

Deno.test("returns controlled configuration and stored-image errors", async () => {
  assertEquals((await createExtractFlyerHandler(makeDependencies({ openaiKey: undefined }))(request())).status, 503);
  assertEquals((await createExtractFlyerHandler(makeDependencies({ fetchImage: () => Promise.resolve(imageResponse(new Uint8Array([1]), "application/pdf")) }))(request())).status, 422);
  assertEquals((await createExtractFlyerHandler(makeDependencies({ fetchImage: () => Promise.resolve(imageResponse(new Uint8Array(5 * 1024 * 1024 + 1))) }))(request())).status, 422);
});

Deno.test("returns validated structured output and hides provider failures", async () => {
  const success = await createExtractFlyerHandler(makeDependencies())(request());
  assertEquals(success.status, 200);
  assertEquals((await success.json()).extraction.title, "Salsa Night");

  const failed = await createExtractFlyerHandler(makeDependencies({
    fetchOpenAI: () => Promise.resolve(new Response("secret provider details", { status: 500 })),
  }))(request());
  assertEquals(failed.status, 502);
  const body = await failed.text();
  assertStringIncludes(body, "Flyer analysis is unavailable");
});

Deno.test("rejects invalid provider JSON and schema shapes", async () => {
  const malformedJson = await createExtractFlyerHandler(makeDependencies({
    fetchOpenAI: () => Promise.resolve(responseJson({ output: [{ type: "message", content: [{ type: "output_text", text: "not json" }] }] })),
  }))(request());
  assertEquals(malformedJson.status, 502);

  const malformedShape = await createExtractFlyerHandler(makeDependencies({
    fetchOpenAI: () => Promise.resolve(responseJson({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ title: 42 }) }] }] })),
  }))(request());
  assertEquals(malformedShape.status, 502);
});

function extractionFrom(extracted: Record<string, unknown>) {
  return createExtractFlyerHandler(makeDependencies({
    fetchOpenAI: () => Promise.resolve(responseJson({
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(extracted) }] }],
    })),
  }))(request());
}

Deno.test("keeps the readable fields when a date or time is unparseable", async () => {
  const response = await extractionFrom({
    title: "Salsa Night",
    date: "next Friday",
    start_time: "9pm",
    end_time: "22:30",
    venue_name: "The Studio",
  });
  assertEquals(response.status, 200);
  const { extraction } = await response.json();
  assertEquals(extraction.date, null);
  assertEquals(extraction.start_time, null);
  assertEquals(extraction.end_time, "22:30");
  assertEquals(extraction.title, "Salsa Night");
  assertEquals(extraction.venue_name, "The Studio");
});

Deno.test("keeps a scheme-less domain and rejects a non-http website", async () => {
  const bare = await extractionFrom({ title: "Salsa Night", website: "salsasegura.com" });
  assertEquals((await bare.json()).extraction.website, "https://salsasegura.com");

  const withPath = await extractionFrom({ title: "Salsa Night", website: "www.salsasegura.com/events" });
  assertEquals((await withPath.json()).extraction.website, "https://www.salsasegura.com/events");

  const scripted = await extractionFrom({ title: "Salsa Night", website: "javascript:alert(1)" });
  assertEquals((await scripted.json()).extraction.website, null);

  const nonsense = await extractionFrom({ title: "Salsa Night", website: "ask at the door" });
  assertEquals((await nonsense.json()).extraction.website, null);
});

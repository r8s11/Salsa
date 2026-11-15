import assert from "node:assert/strict";
import { createArtistRsvpSubmit, type ArtistRsvpSubmitDependencies, type GuestSubmitInput } from "./artistRsvpSubmit.ts";
const event = "00000000-0000-4000-8000-000000000001";
const body = { event_id: event, name: "Jordan", email: "Jordan@Example.test", role: "undecided" };
const request = (value: unknown = body, init: RequestInit = {}) => new Request("https://edge.test", { method: "POST", headers: { "content-type": "application/json", origin: "https://site.test", "x-forwarded-for": "192.0.2.1" }, body: JSON.stringify(value), ...init });
Deno.test("F3 request boundary rejects invalid data before persistence and hashes trusted inputs", async () => {
  const calls: { input: GuestSubmitInput; ip: string; email: string }[] = [];
  const deps: ArtistRsvpSubmitDependencies = { secret: "s".repeat(32), origins: ["https://site.test"], submit: async (input, ip, email) => { calls.push({ input, ip, email }); return { status: "received", event_id: event, external_url: "https://artist.test/pay" }; } };
  const run = createArtistRsvpSubmit(deps);
  const invalid = [null, [], { ...body, name: " " }, { ...body, name: "x".repeat(121) }, { ...body, email: "bad" }, { ...body, role: "paid" }, { ...body, ip_key: "forged" }, { ...body, confirmed: true }, { ...body, event_id: "not-an-id" }, { ...body, name: "a\u0000b" }];
  for (const value of invalid) assert.equal((await run(request(value))).status, 400);
  assert.equal((await run(request(body, { method: "GET", body: undefined }))).status, 405);
  assert.equal((await run(request(body, { headers: { "content-type": "text/plain" } }))).status, 415);
  assert.equal((await run(request(body, { body: "{bad" }))).status, 400);
  assert.equal((await run(request(body, { body: " ".repeat(4097) }))).status, 413);
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(2049)); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  assert.equal((await run(request(body, { body: stream, duplex: "half" } as RequestInit))).status, 413); assert.equal(cancelled, true);
  assert.equal((await run(request(body, { headers: { "content-type": "application/json", origin: "https://evil.test" } }))).status, 403);
  deps.secret = ""; assert.equal((await run(request())).status, 503); assert.equal(calls.length, 0); deps.secret = "s".repeat(32);
  const response = await run(request()); assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "https://site.test");
  const result = await response.json(); assert.deepEqual(result, { status: "received", event_id: event, external_url: "https://artist.test/pay" });
  assert.equal(calls[0].input.email, "jordan@example.test"); assert.match(calls[0].ip, /^[a-f0-9]{64}$/); assert.match(calls[0].email, /^[a-f0-9]{64}$/); assert.notEqual(calls[0].ip, calls[0].email); assert.ok(!JSON.stringify(result).includes("Jordan"));
  deps.submit = async () => ({ status: "unavailable" });
  for (const _state of ["draft", "closed", "past", "inactive", "disabled"]) { const unavailable = await run(request()); assert.equal(unavailable.status, 409); assert.deepEqual(await unavailable.json(), { status: "unavailable" }); }
  deps.submit = async () => ({ status: "rate_limited", retry_after: 123 }); const limited = await run(request()); assert.equal(limited.status, 429); assert.equal(limited.headers.get("retry-after"), "123");
  deps.submit = async () => { throw Error("private SQL service_key guest@example.test"); }; const failed = await run(request()); assert.equal(failed.status, 503); assert.ok(!await failed.text().then((text) => /SQL|service_key|guest@/.test(text)));
});

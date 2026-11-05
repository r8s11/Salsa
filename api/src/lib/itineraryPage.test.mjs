import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createItineraryPage } from "./itineraryPageHandler.mjs";

const shell = await readFile("index.html", "utf8");
const origin = "https://www.salsasegura.com";
const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "public-anon-key" };
const row = {
  title: 'Noche "Latina" <3 & más 💃', description: '<script>alert("hi")</script> & dance',
  city: "new-york-city", week_start: "2026-11-09",
  cover_image_url: "https://example.supabase.co/storage/v1/object/public/itinerary-covers/id/hash.jpg",
};
const request = (path = "/api/itinerary-page", original = "/itineraries/nyc/2026-11-11") => ({
  url: `https://untrusted.example${path}`,
  headers: new Headers({ host: "attacker.example", ...(original === null ? {} : { "x-ms-original-url": original }) }),
});
const parse = (html) => new DOMParser().parseFromString(html, "text/html");

function setup({ rows = [row], failure, settings = {} } = {}) {
  const fetchImpl = vi.fn(async (input) => {
    const url = new URL(input);
    if (url.pathname === "/index.html") return { ok: true, text: async () => shell };
    if (failure === "network") throw new Error("Supabase offline");
    return { ok: !failure, status: failure ? 503 : 200, json: async () => rows };
  });
  const handler = createItineraryPage({ fetchImpl, env: { ...env, ...settings } });
  return { handler, fetchImpl };
}

function expectUnavailable(response, status) {
  expect(response.status).toBe(status);
  expect(response.headers["Cache-Control"]).toBe("no-store");
  expect(response.headers["X-Robots-Tag"]).toBe("noindex, follow");
  const doc = parse(response.body);
  expect(doc.querySelector('meta[name="robots"]').content).toBe("noindex, follow");
  expect(doc.querySelectorAll('meta[property^="og:image"],meta[name^="twitter:image"]')).toHaveLength(0);
  expect(doc.getElementById("app")).not.toBeNull();
  return doc;
}

describe("itineraryPage", () => {
  it("returns escaped published metadata and the immutable JPEG without duplicated tags", async () => {
    const { handler, fetchImpl } = setup();
    const response = await handler(request(), { error: vi.fn() });
    expect(response.status).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("no-cache");
    expect(response.headers["Content-Type"]).toBe("text/html; charset=utf-8");
    const doc = parse(response.body);
    expect(doc.title).toBe(row.title);
    expect(doc.querySelector('meta[name="description"]').content).toBe(row.description);
    expect(doc.querySelector('link[rel="canonical"]').getAttribute("href")).toBe(`${origin}/itineraries/new-york-city/2026-11-09`);
    expect(doc.querySelectorAll("title")).toHaveLength(1);
    expect(doc.querySelectorAll('meta[property="og:image"]')).toHaveLength(1);
    expect(doc.querySelector('meta[property="og:image"]').content).toBe(row.cover_image_url);
    expect(doc.querySelector('meta[property="og:image:width"]').content).toBe("1200");
    expect(doc.querySelector('meta[property="og:image:height"]').content).toBe("630");
    expect(doc.querySelector('meta[name="robots"]').content).toBe("index, follow");
    expect(response.body).not.toContain(row.description);
    const [url, options] = fetchImpl.mock.calls.find(([input]) => new URL(input).pathname.startsWith("/rest/"));
    const query = new URL(url);
    expect(query.pathname).toBe("/rest/v1/public_itineraries");
    expect(query.searchParams.get("city")).toBe("eq.new-york-city");
    expect(query.searchParams.get("week_start")).toBe("eq.2026-11-09");
    expect(query.searchParams.get("select")).toBe("title,description,cover_image_url,city,week_start");
    expect(options.headers).toEqual({ apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` });
  });

  it.each(["/itineraries/nyc/2026-11-11", "https://attacker.example/itineraries/nyc/2026-11-11"])(
    "ignores arbitrary request/header hosts for shell fetch: %s", async (original) => {
      const { handler, fetchImpl } = setup();
      await handler(request("/api/itinerary-page", original));
      expect(fetchImpl.mock.calls.some(([url]) => String(url) === `${origin}/index.html`)).toBe(true);
      expect(fetchImpl.mock.calls.every(([url]) => !String(url).includes("attacker.example") && !String(url).includes("untrusted.example"))).toBe(true);
    }
  );

  it("supports an explicit trusted local origin and the CLI's original request.url fallback", async () => {
    const { handler, fetchImpl } = setup({ settings: { ITINERARY_SITE_ORIGIN: "http://localhost:4280" } });
    const response = await handler(request("/itineraries/nyc/2026-11-11", null));
    expect(response.status).toBe(200);
    expect(fetchImpl.mock.calls.some(([url]) => String(url) === "http://localhost:4280/index.html")).toBe(true);
    expect(parse(response.body).querySelector('link[rel="canonical"]').getAttribute("href")).toBe("http://localhost:4280/itineraries/new-york-city/2026-11-09");
  });

  it("memoizes only the shell, never publication metadata or missing responses", async () => {
    const rows = [];
    const { handler, fetchImpl } = setup({ rows });
    expectUnavailable(await handler(request()), 404);
    rows.push({ ...row });
    expect((await handler(request())).status).toBe(200);
    rows[0].title = "Updated immediately";
    expect(parse((await handler(request())).body).title).toBe("Updated immediately");
    expect(fetchImpl.mock.calls.filter(([url]) => new URL(url).pathname === "/index.html")).toHaveLength(1);
    expect(fetchImpl.mock.calls.filter(([url]) => new URL(url).pathname === "/rest/v1/public_itineraries")).toHaveLength(3);
  });

  it("does not query unpublished tables when the published projection has no match", async () => {
    const { handler, fetchImpl } = setup({ rows: [] });
    expectUnavailable(await handler(request()), 404);
    const reads = fetchImpl.mock.calls.filter(([url]) => new URL(url).pathname !== "/index.html");
    expect(reads).toHaveLength(1);
    expect(new URL(reads[0][0]).pathname).toBe("/rest/v1/public_itineraries");
  });

  it.each(["/itineraries/boston/2026-02-30", "/itineraries/boston/garbage", "/api/itinerary-page"])(
    "returns noindex 404 without a database request for invalid path %s", async (original) => {
      const { handler, fetchImpl } = setup();
      expectUnavailable(await handler(request("/api/itinerary-page", original)), 404);
      expect(fetchImpl.mock.calls.every(([url]) => new URL(url).pathname === "/index.html")).toBe(true);
    }
  );

  it.each(["http", "network"])("returns shell 503, not misleading metadata, on %s failure", async (failure) => {
    const { handler } = setup({ failure });
    expectUnavailable(await handler(request(), { error: vi.fn() }), 503);
  });

  it("returns no-store 503 without a database read when runtime credentials are missing", async () => {
    const { handler, fetchImpl } = setup({ settings: { SUPABASE_ANON_KEY: "" } });
    expectUnavailable(await handler(request(), { error: vi.fn() }), 503);
    expect(fetchImpl.mock.calls).toHaveLength(1);
  });

  it("does not memoize shell failures", async () => {
    const { handler, fetchImpl } = setup();
    fetchImpl.mockRejectedValueOnce(new Error("Shell unavailable"));
    expect((await handler(request(), { error: vi.fn() })).status).toBe(503);
    expect((await handler(request())).status).toBe(200);
  });
});

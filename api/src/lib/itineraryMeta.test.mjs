import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import aliases from "./metroAliases.json" with { type: "json" };
import { escapeHtml, injectMeta, parseItineraryPath } from "./itineraryMeta.mjs";

const shell = await readFile("index.html", "utf8");
const parse = (html) => new DOMParser().parseFromString(html, "text/html");
const meta = {
  title: 'Noche "Latina" <3 & más 💃',
  description: 'Dance <together> & bring "friends"',
  url: "https://www.salsasegura.com/itineraries/new-york-city/2026-11-09?x=1&y=2",
  image: "https://example.supabase.co/storage/v1/object/public/itinerary-covers/id/hash.jpg",
};

describe("parseItineraryPath", () => {
  it.each([
    ["/itineraries/nyc/2026-11-11", "new-york-city", "2026-11-09"],
    ["/itineraries/Cambridge/2026-11-15/", "boston", "2026-11-09"],
    ["/itineraries/Los%20%C3%81ngeles/2026-11-09", "los-angeles", "2026-11-09"],
    ["/itineraries/boston/2024-02-29", "boston", "2024-02-26"],
    ["/itineraries/boston/2027-01-01", "boston", "2026-12-28"],
  ])("canonicalizes %s", (path, city, weekStart) => {
    expect(parseItineraryPath(path, aliases)).toEqual({ city, weekStart });
  });

  it.each([
    "/itineraries/boston/garbage", "/itineraries/boston/2026-02-29",
    "/itineraries/boston/2026-04-31", "/itineraries/boston/2026-13-01",
    "/itineraries/boston/2026-00-01", "/itineraries/boston/2026-11-00",
    "/itineraries/boston/0000-01-01", "/itineraries/boston/0000-01-02",
    "/itineraries/boston/2026-11-09/extra", "/itineraries/%ZZ/2026-11-09",
    "/itineraries/%2F/2026-11-09", "/api/itinerary-page", "/itineraries//2026-11-09",
  ])("rejects invalid path %s", (path) => {
    expect(parseItineraryPath(path, aliases)).toBeNull();
  });
});

describe("injectMeta", () => {
  it("escapes exactly once and replaces all default metadata in the real shell", () => {
    const html = injectMeta(shell, meta);
    const doc = parse(html);
    expect(escapeHtml(meta.title)).toBe("Noche &quot;Latina&quot; &lt;3 &amp; más 💃");
    expect(doc.title).toBe(meta.title);
    expect(doc.querySelector('meta[name="description"]').content).toBe(meta.description);
    expect(doc.querySelector('link[rel="canonical"]').getAttribute("href")).toBe(meta.url);
    for (const selector of ["title", 'meta[name="description"]', 'link[rel="canonical"]',
      'meta[property="og:title"]', 'meta[property="og:image"]', 'meta[name="twitter:card"]']) {
      expect(doc.querySelectorAll(selector)).toHaveLength(1);
    }
    expect(doc.querySelector('meta[property="og:image"]').content).toBe(meta.image);
    expect(doc.querySelector('meta[property="og:image:width"]').content).toBe("1200");
    expect(doc.querySelector('meta[property="og:image:height"]').content).toBe("630");
    expect(doc.querySelector('meta[property="og:image:type"]').content).toBe("image/jpeg");
    expect(doc.querySelector('meta[name="twitter:card"]').content).toBe("summary_large_image");
    expect(doc.getElementById("app")).not.toBeNull();
    expect(injectMeta(html, meta)).toBe(html);
  });

  it("handles attribute order, quote styles, and removes stale image variants", () => {
    const html = `<html><head><TITLE>Old</TITLE><meta content='old' NAME='description'>
      <link href='/old' REL='canonical'><meta content='old' property='og:image:secure_url'>
      <meta content='old' name='twitter:image:alt'></head><body></body></html>`;
    const doc = parse(injectMeta(html, { ...meta, image: null }));
    expect(doc.querySelectorAll("title")).toHaveLength(1);
    expect(doc.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(doc.querySelectorAll('meta[property^="og:image"], meta[name^="twitter:image"]')).toHaveLength(0);
    expect(doc.querySelector('meta[name="twitter:card"]').content).toBe("summary");
  });
});

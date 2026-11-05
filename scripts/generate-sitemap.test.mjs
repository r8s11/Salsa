import { describe, expect, it } from "vitest";
import { buildSitemapXml } from "./generate-sitemap.mjs";
import { buildRouteTable, isIndexable, routeMeta } from "./public-routes.mjs";

describe("buildSitemapXml", () => {
  it("includes approved event URLs with their actual update timestamp on the canonical host", () => {
    const xml = buildSitemapXml([
      { id: "123e4567-e89b-12d3-a456-426614174000", updated_at: "2026-08-25T11:32:00.000Z" },
      { id: "223e4567-e89b-12d3-a456-426614174000", slug: "friday-dance" },
      { id: "not-a-uuid", updated_at: "2026-08-25T11:32:00.000Z" },
    ]);

    expect(xml).toContain(
      "<loc>https://www.salsasegura.com/events/123e4567-e89b-12d3-a456-426614174000</loc><lastmod>2026-08-25T11:32:00.000Z</lastmod>"
    );
    expect(xml).toContain("<loc>https://www.salsasegura.com/events/friday-dance</loc></url>");
    expect(xml).not.toContain("/events/not-a-uuid");
    expect(xml).not.toContain("https://salsasegura.com/");
  });
  it("indexes canonical entity slugs once and never emits unsafe paths", () => {
    const entities = [
      { kind: "series", slug: "friday-social" },
      { kind: "organizer", slug: "dance-company" },
      { kind: "venue", slug: "dance-hall" },
      { kind: "school", slug: "boston-school" },
      { kind: "instructor", slug: "ana" },
      { kind: "city", slug: "miami" },
      { kind: "style", slug: "salsa" },
      { kind: "school", slug: "boston-school" },
      { kind: "venue", slug: '../private?x=<script>' },
      { kind: "constructor", slug: "inherited" },
    ];
    const xml = buildSitemapXml([], entities);
    for (const path of [
      "/series/friday-social", "/o/dance-company", "/v/dance-hall",
      "/s/boston-school", "/i/ana", "/cities/miami", "/styles/salsa",
    ]) expect(xml).toContain(`<loc>https://www.salsasegura.com${path}</loc>`);
    expect(xml.match(/\/s\/boston-school<\/loc>/g)).toHaveLength(1);
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain("../private");
    expect(xml).not.toContain("inherited");
  });
  it("lists exactly the indexable routes that get prerendered, and leaves out noindex pages", () => {
    const events = [{ id: "123e4567-e89b-12d3-a456-426614174000", slug: "friday-dance" }];
    const entities = [{ kind: "dj", slug: "dj-ana" }];
    const xml = buildSitemapXml(events, entities);
    const listed = [...xml.matchAll(/<loc>https:\/\/www\.salsasegura\.com([^<]*)<\/loc>/g)].map((match) => match[1]);
    expect(listed).toEqual(buildRouteTable(routeMeta, events, entities).filter(isIndexable).map((route) => route.path));
    expect(listed).toEqual(expect.arrayContaining(["/", "/calendar", "/events/boston", "/discover", "/djs", "/dj/dj-ana", "/events/friday-dance"]));
    expect(listed).not.toContain("/submit");
    expect(listed).not.toContain("/lessons");
  });
});

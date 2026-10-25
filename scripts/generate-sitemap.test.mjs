import { describe, expect, it } from "vitest";
import { buildSitemapXml } from "./generate-sitemap.mjs";

describe("buildSitemapXml", () => {
  it("includes approved event URLs with their actual update timestamp on the canonical host", () => {
    const xml = buildSitemapXml([
      { id: "123e4567-e89b-12d3-a456-426614174000", updated_at: "2026-08-25T11:32:00.000Z" },
      { id: "not-a-uuid", updated_at: "2026-08-25T11:32:00.000Z" },
    ]);

    expect(xml).toContain(
      "<loc>https://www.salsasegura.com/events/123e4567-e89b-12d3-a456-426614174000</loc><lastmod>2026-08-25T11:32:00.000Z</lastmod>"
    );
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
      { kind: "event", slug: "friday-dance" },
      { kind: "school", slug: "boston-school" },
      { kind: "venue", slug: '../private?x=<script>' },
    ];
    const xml = buildSitemapXml([], entities);
    for (const path of [
      "/series/friday-social", "/o/dance-company", "/v/dance-hall",
      "/s/boston-school", "/i/ana", "/cities/miami", "/styles/salsa",
      "/events/friday-dance",
    ]) expect(xml).toContain(`<loc>https://www.salsasegura.com${path}</loc>`);
    expect(xml.match(/\/s\/boston-school<\/loc>/g)).toHaveLength(1);
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain("../private");
  });
});

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
});

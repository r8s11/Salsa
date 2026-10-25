import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const sitemap = await readFile("public/sitemap.xml", "utf8");

describe("public sitemap", () => {
  it("uses the www canonical host and includes both metro landing pages", () => {
    expect(sitemap).toContain("https://www.salsasegura.com/");
    expect(sitemap).toContain("https://www.salsasegura.com/events/boston");
    expect(sitemap).toContain("https://www.salsasegura.com/events/new-york-city");
    expect(sitemap).not.toContain("https://salsasegura.com/");
  });

  it("does not publish unfinished sections or fabricated last-modified dates", () => {
    expect(sitemap).not.toMatch(/<loc>[^<]*\/(lessons|instructors|schools|submit)<\/loc>/);
    expect(sitemap).not.toContain("2026-02-10");
  });
});

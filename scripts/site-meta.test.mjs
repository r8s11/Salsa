import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const html = await readFile("index.html", "utf8");

describe("global SEO metadata", () => {
  it("uses www URLs and does not describe the event guide as a dance school or search app", () => {
    expect(html).toContain('href="https://www.salsasegura.com/"');
    expect(html).toContain('property="og:url" content="https://www.salsasegura.com/"');
    expect(html).not.toContain('"@type": "DanceSchool"');
    expect(html).not.toContain('"@type": "SearchAction"');
    expect(html).not.toContain('name="geo.position"');
    expect(html).not.toContain("pop-up classes, social dances, and workshops");
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const config = JSON.parse(await readFile("staticwebapp.config.json", "utf8"));

describe("Static Web Apps SEO route headers", () => {
  it("keeps unpublished and submission routes out of the index on direct requests", () => {
    const routeHeaders = new Map((config.routes ?? []).map((route) => [route.route, route.headers]));

    for (const path of ["/submit", "/lessons", "/instructors", "/schools"]) {
      expect(routeHeaders.get(path)?.["X-Robots-Tag"], path).toBe("noindex, follow");
    }
  });
});

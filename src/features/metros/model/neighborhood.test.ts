import { describe, expect, it } from "vitest";
import { NEIGHBORHOODS, neighborhoodsForLocation, normalizeNeighborhood } from "./neighborhood";

describe("curated neighborhood hierarchy", () => {
  it("requires a neighborhood's exact city and borough", () => {
    expect(normalizeNeighborhood("new-york-city", "brooklyn", "bushwick")).toBe("bushwick");
    expect(normalizeNeighborhood("new-york-city", "queens", "bushwick")).toBeNull();
    expect(normalizeNeighborhood("new-york-city", null, "bushwick")).toBeNull();
    expect(normalizeNeighborhood("boston", null, "bushwick")).toBeNull();
    expect(normalizeNeighborhood("boston", null, "allston")).toBe("allston");
    expect(normalizeNeighborhood("boston", "brooklyn", "allston")).toBeNull();
    expect(normalizeNeighborhood("boston", null, "not-an-area")).toBeNull();
    expect(normalizeNeighborhood("boston", null, null)).toBeNull();
  });

  it("never mixes neighborhoods from sibling boroughs or unrelated cities", () => {
    const queens = neighborhoodsForLocation("new-york-city", "queens");
    expect(queens.map((entry) => entry.slug)).toContain("astoria");
    expect(queens.map((entry) => entry.slug)).not.toContain("bushwick");
    expect(neighborhoodsForLocation("new-york-city", null)).toEqual([]);
    expect(neighborhoodsForLocation("texas", null)).toEqual([]);
  });

  it("keeps neighborhood slugs unambiguous for storage and URLs", () => {
    expect(new Set(NEIGHBORHOODS.map((entry) => entry.slug)).size).toBe(NEIGHBORHOODS.length);
    for (const entry of NEIGHBORHOODS) {
      expect(entry.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});

import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "../api/types";
import { catalogFacets, filterProducts, quickAddSizes, readFilters, sortProducts } from "./catalogFilters";

const money = (amount: string) => ({ amount, currencyCode: "USD" });
function product(handle: string, overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: handle, handle, title: handle, featuredImage: null, priceRange: { minVariantPrice: money("20.00") },
    productType: "", createdAt: "2026-10-01T00:00:00Z", availableForSale: true, images: [],
    options: [], variants: [], variantsComplete: true, ...overrides,
  };
}
const option = (name: string, values: string[]) => ({ name, values: values.map((value) => ({ name: value, swatch: null })) });
const variant = (id: string, options: Record<string, string>, availableForSale = true) =>
  ({ id, availableForSale, selectedOptions: Object.entries(options).map(([name, value]) => ({ name, value })) });
const filters = (query: string) => readFilters(new URLSearchParams(query));

describe("catalogFacets", () => {
  it("merges size spellings across blanks and orders them small to large", () => {
    const facets = catalogFacets([
      product("tee", { options: [option("Size", ["xxl", "s", "XS"])] }),
      product("hoodie", { options: [option("size", ["2XL", "M", "One Size"])] }),
    ]);
    expect(facets.sizes.map((size) => [size.key, size.count])).toEqual([
      ["XS", 1], ["S", 1], ["M", 1], ["2XL", 2], ["ONE SIZE", 1],
    ]);
  });

  it("groups free-text product types and labels them with the most common spelling", () => {
    const facets = catalogFacets([
      product("a", { productType: "T-SHIRT" }),
      product("b", { productType: "T-SHIRT" }),
      product("c", { productType: "tshirts" }),
      product("d", { productType: "Leggings" }),
      product("e", { productType: "" }),
    ]);
    expect(facets.types).toEqual([
      { key: "legging", label: "Leggings", count: 1 },
      { key: "tshirt", label: "T-shirt", count: 3 },
    ]);
  });
});

describe("filterProducts", () => {
  const hoodie = product("hoodie", {
    options: [option("Color", ["Black", "White"]), option("Size", ["S", "XL"])],
    variants: [variant("black-s", { Color: "Black", Size: "S" }), variant("white-xl", { Color: "White", Size: "XL" }, false)],
  });

  it("requires one variant to satisfy size and colour together", () => {
    expect(filterProducts([hoodie], filters("size=S&color=black"))).toEqual([hoodie]);
    // Black exists and XL exists, but not as one variant.
    expect(filterProducts([hoodie], filters("size=XL&color=black"))).toEqual([]);
  });

  it("treats in-stock as a property of the matching variant", () => {
    expect(filterProducts([hoodie], filters("size=XL"))).toEqual([hoodie]);
    expect(filterProducts([hoodie], filters("size=XL&stock=1"))).toEqual([]);
  });

  it("filters by type key and maximum starting price", () => {
    const tee = product("tee", { productType: "tshirts", priceRange: { minVariantPrice: money("14.00") } });
    const legging = product("legging", { productType: "Leggings", priceRange: { minVariantPrice: money("45.00") } });
    expect(filterProducts([tee, legging], filters("type=tshirt"))).toEqual([tee]);
    expect(filterProducts([tee, legging], filters("max=40"))).toEqual([tee]);
  });
});

describe("readFilters and sortProducts", () => {
  it("ignores an unknown sort and a malformed price ceiling", () => {
    const state = filters("sort=cheapest&max=abc&size=xxl");
    expect(state.sort).toBe("featured");
    expect(state.maxPrice).toBeNull();
    expect(state.sizes).toEqual(["2XL"]);
  });

  it("keeps Shopify order for featured and reorders the rest", () => {
    const older = product("older", { createdAt: "2026-01-01T00:00:00Z", priceRange: { minVariantPrice: money("40.00") } });
    const newer = product("newer", { createdAt: "2026-06-01T00:00:00Z", priceRange: { minVariantPrice: money("15.00") } });
    expect(sortProducts([older, newer], "featured")).toEqual([older, newer]);
    expect(sortProducts([older, newer], "newest")).toEqual([newer, older]);
    expect(sortProducts([older, newer], "price-desc")).toEqual([older, newer]);
    expect(sortProducts([older, newer], "price-asc")).toEqual([newer, older]);
  });
});

describe("quickAddSizes", () => {
  it("offers sizes when size is the only real choice, with sold-out sizes marked", () => {
    const tee = product("tee", {
      options: [option("Color", ["White"]), option("Size", ["S", "xxl"])],
      variants: [variant("tee-s", { Color: "White", Size: "S" }), variant("tee-xxl", { Color: "White", Size: "xxl" }, false)],
    });
    expect(quickAddSizes(tee)).toEqual([
      { label: "S", variantId: "tee-s", available: true },
      { label: "2XL", variantId: "tee-xxl", available: false },
    ]);
  });

  it("offers nothing when a second choice would make one click ambiguous", () => {
    const hoodie = product("hoodie", {
      options: [option("Color", ["Black", "Navy"]), option("Size", ["S", "M"])],
      variants: [variant("a", { Color: "Black", Size: "S" }), variant("b", { Color: "Navy", Size: "M" })],
    });
    expect(quickAddSizes(hoodie)).toEqual([]);
    expect(quickAddSizes({ ...hoodie, options: [option("Size", ["S", "M"])], variantsComplete: false })).toEqual([]);
  });
});

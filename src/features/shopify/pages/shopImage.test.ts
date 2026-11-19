import { describe, expect, it } from "vitest";
import { productAlt, shopifySrcSet } from "./shopImage";

describe("shopifySrcSet", () => {
  it("adds CDN widths up to the original and keeps existing query parameters", () => {
    expect(shopifySrcSet("https://cdn.shopify.com/s/files/tee.jpg?v=12", 800)).toBe(
      "https://cdn.shopify.com/s/files/tee.jpg?v=12&width=320 320w, "
      + "https://cdn.shopify.com/s/files/tee.jpg?v=12&width=480 480w, "
      + "https://cdn.shopify.com/s/files/tee.jpg?v=12&width=720 720w"
    );
  });

  it("emits nothing for relative or tiny images", () => {
    expect(shopifySrcSet("/tee.jpg", 2000)).toBeUndefined();
    expect(shopifySrcSet("https://cdn.shopify.com/tee.jpg", 200)).toBeUndefined();
  });
});

describe("productAlt", () => {
  it("replaces mockup-tool captions with the product title", () => {
    expect(productAlt("Product mockup", "Clave Tee")).toBe("Clave Tee");
    expect(productAlt("", "Clave Tee")).toBe("Clave Tee");
    expect(productAlt("Clave Tee, back print", "Clave Tee")).toBe("Clave Tee, back print");
  });
});

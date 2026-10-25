import { describe, expect, it } from "vitest";
import {
  canDeleteTaxonomyTerm,
  normalizeTaxonomyName,
  slugifyTaxonomyName,
  validateTaxonomyForm,
} from "./taxonomy";

const validForm = {
  name: "Salsa On2",
  category: "dance_style" as const,
  slug: "salsa-on2",
  description: "",
  display_order: 10,
  status: "active" as const,
};

describe("taxonomy model", () => {
  it("normalizes case, whitespace, and NFKC-equivalent names", () => {
    expect(normalizeTaxonomyName("  SALSA  ")).toBe("salsa");
    expect(normalizeTaxonomyName("Ｓａｌｓａ")).toBe("salsa");
  });

  it("creates a stable URL-safe slug from a display name", () => {
    expect(slugifyTaxonomyName(" Salsa On2 ")).toBe("salsa-on2");
  });

  it("prevents deleting a term with usage", () => {
    expect(canDeleteTaxonomyTerm(1)).toBe(false);
    expect(canDeleteTaxonomyTerm(0)).toBe(true);
  });

  it("rejects a blank name and malformed slug", () => {
    expect(validateTaxonomyForm({ ...validForm, name: "", slug: "Salsa On2" })).toEqual({
      name: "Enter a name",
      slug: "Use lowercase letters, numbers, and hyphens only",
    });
  });
});

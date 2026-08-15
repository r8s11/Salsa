export type TaxonomyCategory = "dance_style" | "event_attribute";
export type TaxonomyStatus = "active" | "needs_review" | "archived";
export type TaxonomyView =
  | "all"
  | "active"
  | "dance_styles"
  | "attributes"
  | "unused"
  | "needs_review"
  | "archived";

export type TaxonomyForm = {
  name: string;
  category: TaxonomyCategory;
  slug: string;
  description: string;
  display_order: number;
  status: TaxonomyStatus;
};

export const EMPTY_TAXONOMY_FORM: TaxonomyForm = {
  name: "",
  category: "dance_style",
  slug: "",
  description: "",
  display_order: 0,
  status: "active",
};

export type TaxonomyValidationErrors = Partial<Record<"name" | "slug", string>>;

export type TaxonomyTerm = {
  id: string;
  category: TaxonomyCategory;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  status: TaxonomyStatus;
  display_order: number;
  usage_count: number;
  updated_at: string;
};

export type TaxonomyTermDetail = TaxonomyTerm & {
  created_at: string;
};

export type TaxonomyFilters = {
  search: string;
  category: TaxonomyCategory | null;
  status: TaxonomyStatus | null;
  view: TaxonomyView;
};

export const DEFAULT_TAXONOMY_FILTERS: TaxonomyFilters = {
  search: "",
  category: null,
  status: null,
  view: "all",
};

export function normalizeTaxonomyName(name: string): string {
  return name.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function slugifyTaxonomyName(name: string): string {
  return normalizeTaxonomyName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateTaxonomyForm(form: TaxonomyForm): TaxonomyValidationErrors {
  const errors: TaxonomyValidationErrors = {};
  if (!form.name.trim()) errors.name = "Enter a name";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
    errors.slug = "Use lowercase letters, numbers, and hyphens only";
  }
  return errors;
}

export function canDeleteTaxonomyTerm(usageCount: number): boolean {
  return usageCount === 0;
}

export function canChangeTaxonomyCategory(usageCount: number): boolean {
  return usageCount === 0;
}

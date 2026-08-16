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

export const TAXONOMY_VIEWS: { view: TaxonomyView; label: string }[] = [
  { view: "all", label: "All" },
  { view: "active", label: "Active" },
  { view: "dance_styles", label: "Dance Styles" },
  { view: "attributes", label: "Attributes" },
  { view: "unused", label: "Unused" },
  { view: "needs_review", label: "Needs Review" },
  { view: "archived", label: "Archived" },
];

export function applyTaxonomyView(terms: TaxonomyTerm[], view: TaxonomyView): TaxonomyTerm[] {
  switch (view) {
    case "active":
      return terms.filter((t) => t.status === "active");
    case "dance_styles":
      return terms.filter((t) => t.category === "dance_style");
    case "attributes":
      return terms.filter((t) => t.category === "event_attribute");
    case "unused":
      return terms.filter((t) => t.usage_count === 0);
    case "needs_review":
      return terms.filter((t) => t.status === "needs_review");
    case "archived":
      return terms.filter((t) => t.status === "archived");
    default:
      return terms;
  }
}

export function applyTaxonomyFilters(
  terms: TaxonomyTerm[],
  filters: TaxonomyFilters
): TaxonomyTerm[] {
  return terms.filter((term) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !term.name.toLowerCase().includes(q) &&
        !term.slug.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (filters.category && term.category !== filters.category) return false;
    if (filters.status && term.status !== filters.status) return false;
    return true;
  });
}

export function taxonomyViewCounts(terms: TaxonomyTerm[]): Record<TaxonomyView, number> {
  const counts: Record<TaxonomyView, number> = {
    all: terms.length,
    active: 0,
    dance_styles: 0,
    attributes: 0,
    unused: 0,
    needs_review: 0,
    archived: 0,
  };
  for (const term of terms) {
    if (term.status === "active") counts.active++;
    if (term.category === "dance_style") counts.dance_styles++;
    if (term.category === "event_attribute") counts.attributes++;
    if (term.usage_count === 0) counts.unused++;
    if (term.status === "needs_review") counts.needs_review++;
    if (term.status === "archived") counts.archived++;
  }
  return counts;
}

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

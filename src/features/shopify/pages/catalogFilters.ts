import type { CatalogProduct } from "../api/types";

/**
 * Facets come only from Shopify data: product type, the Size and Color
 * options, price and availability. Nothing is inferred from product titles.
 */

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const SIZE_ALIASES: Record<string, string> = { XXL: "2XL", XXXL: "3XL", XXXXL: "4XL" };

const isSizeOption = (name: string) => /^size$/i.test(name.trim());
const isColorOption = (name: string) => /^colou?r$/i.test(name.trim());

/** Blanks spell the same size differently ("xxl", "2XL"); compare one spelling. */
export function normalizeSize(value: string): string {
  const upper = value.trim().toUpperCase();
  return SIZE_ALIASES[upper] ?? upper;
}

function sizeRank(size: string): number {
  const index = SIZE_ORDER.indexOf(size);
  return index === -1 ? SIZE_ORDER.length : index;
}

/** Shopify product types are free text ("T-SHIRT", "tshirts"); group them by a loose key. */
export function productTypeKey(productType: string): string {
  return productType.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

const colorKey = (value: string) => value.trim().toLowerCase();

function optionValues(product: CatalogProduct, match: (name: string) => boolean) {
  return product.options.filter((option) => match(option.name)).flatMap((option) => option.values);
}

export interface Facet { key: string; label: string; count: number; swatch?: string | null }

export interface CatalogFacets {
  types: Facet[];
  sizes: Facet[];
  colors: Facet[];
  /** Highest starting price in whole currency units; the price filter's ceiling. */
  priceCeiling: number;
  currencyCode: string | null;
}

export function catalogFacets(products: CatalogProduct[]): CatalogFacets {
  const types = new Map<string, { labels: Map<string, number>; count: number }>();
  const sizes = new Map<string, number>();
  const colors = new Map<string, Facet>();
  for (const product of products) {
    if (product.productType.trim()) {
      const key = productTypeKey(product.productType);
      const entry = types.get(key) ?? { labels: new Map(), count: 0 };
      entry.count += 1;
      entry.labels.set(product.productType, (entry.labels.get(product.productType) ?? 0) + 1);
      types.set(key, entry);
    }
    for (const size of new Set(optionValues(product, isSizeOption).map((value) => normalizeSize(value.name)))) {
      sizes.set(size, (sizes.get(size) ?? 0) + 1);
    }
    const seen = new Set<string>();
    for (const value of optionValues(product, isColorOption)) {
      const key = colorKey(value.name);
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = colors.get(key);
      if (existing) {
        existing.count += 1;
        existing.swatch ??= value.swatch;
      } else {
        colors.set(key, { key, label: sentenceCase(value.name), count: 1, swatch: value.swatch });
      }
    }
  }
  const prices = products.map((product) => Number(product.priceRange.minVariantPrice.amount));
  return {
    types: [...types.entries()]
      .map(([key, entry]) => {
        // Display the spelling most products use for this type.
        const [label] = [...entry.labels.entries()].sort((a, b) => b[1] - a[1])[0];
        return { key, label: sentenceCase(label), count: entry.count };
      })
      .sort((a, b) => a.label.localeCompare(b.label)),
    sizes: [...sizes.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => sizeRank(a.key) - sizeRank(b.key) || a.key.localeCompare(b.key)),
    colors: [...colors.values()].sort((a, b) => a.label.localeCompare(b.label)),
    priceCeiling: prices.length ? Math.ceil(Math.max(...prices)) : 0,
    currencyCode: products[0]?.priceRange.minVariantPrice.currencyCode ?? null,
  };
}

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "title", label: "Name A–Z" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export interface FilterState {
  types: string[];
  sizes: string[];
  colors: string[];
  /** Maximum starting price, or null for no ceiling. */
  maxPrice: number | null;
  inStock: boolean;
  sort: SortValue;
}

export function readFilters(params: URLSearchParams): FilterState {
  const max = Number(params.get("max"));
  const sort = params.get("sort");
  return {
    types: params.getAll("type"),
    sizes: params.getAll("size").map(normalizeSize),
    colors: params.getAll("color").map(colorKey),
    maxPrice: params.has("max") && Number.isFinite(max) && max >= 0 ? max : null,
    inStock: params.get("stock") === "1",
    sort: SORT_OPTIONS.some((option) => option.value === sort) ? (sort as SortValue) : "featured",
  };
}

export function writeFilters(state: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  state.types.forEach((value) => params.append("type", value));
  state.sizes.forEach((value) => params.append("size", value));
  state.colors.forEach((value) => params.append("color", value));
  if (state.maxPrice !== null) params.set("max", String(state.maxPrice));
  if (state.inStock) params.set("stock", "1");
  if (state.sort !== "featured") params.set("sort", state.sort);
  return params;
}

export function clearedFilters(state: FilterState): FilterState {
  return { types: [], sizes: [], colors: [], maxPrice: null, inStock: false, sort: state.sort };
}

export function activeFilterCount(state: FilterState): number {
  return state.types.length + state.sizes.length + state.colors.length + (state.maxPrice === null ? 0 : 1) + (state.inStock ? 1 : 0);
}

function variantMatches(product: CatalogProduct, state: FilterState): boolean {
  if (!state.sizes.length && !state.colors.length && !state.inStock) return true;
  if (!product.variants.length) return false;
  return product.variants.some((variant) => {
    if (state.inStock && !variant.availableForSale) return false;
    const size = variant.selectedOptions.find((option) => isSizeOption(option.name));
    const color = variant.selectedOptions.find((option) => isColorOption(option.name));
    if (state.sizes.length && !(size && state.sizes.includes(normalizeSize(size.value)))) return false;
    if (state.colors.length && !(color && state.colors.includes(colorKey(color.value)))) return false;
    return true;
  });
}

/** A product matches when one variant satisfies size, colour and stock together. */
export function filterProducts(products: CatalogProduct[], state: FilterState): CatalogProduct[] {
  return products.filter((product) => {
    if (state.types.length && !state.types.includes(productTypeKey(product.productType))) return false;
    if (state.maxPrice !== null && Number(product.priceRange.minVariantPrice.amount) > state.maxPrice) return false;
    if (state.inStock && !product.availableForSale) return false;
    return variantMatches(product, state);
  });
}

/** "featured" keeps Shopify's order for the listing. */
export function sortProducts(products: CatalogProduct[], sort: SortValue): CatalogProduct[] {
  const price = (product: CatalogProduct) => Number(product.priceRange.minVariantPrice.amount);
  const sorted = [...products];
  switch (sort) {
    case "newest": return sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    case "price-asc": return sorted.sort((a, b) => price(a) - price(b));
    case "price-desc": return sorted.sort((a, b) => price(b) - price(a));
    case "title": return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default: return sorted;
  }
}

export interface QuickSize { label: string; variantId: string; available: boolean }

/**
 * Sizes a card can add straight to the cart. Only offered when size is the
 * product's sole choice, so one click names exactly one variant.
 */
export function quickAddSizes(product: CatalogProduct): QuickSize[] {
  if (!product.variantsComplete || !product.availableForSale) return [];
  const sizeOption = product.options.find((option) => isSizeOption(option.name));
  if (!sizeOption || sizeOption.values.length < 2) return [];
  if (product.options.some((option) => option !== sizeOption && option.values.length > 1)) return [];
  return sizeOption.values.flatMap((value) => {
    const variant = product.variants.find((candidate) =>
      candidate.selectedOptions.some((option) => isSizeOption(option.name) && option.value === value.name));
    return variant ? [{ label: normalizeSize(value.name), variantId: variant.id, available: variant.availableForSale }] : [];
  });
}

/** Swatch colours and counts for the card's variant line. */
export function variantSummary(product: CatalogProduct): { colors: Array<{ name: string; swatch: string | null }>; sizeCount: number } {
  const colors = optionValues(product, isColorOption);
  const sizeCount = new Set(optionValues(product, isSizeOption).map((value) => normalizeSize(value.name))).size;
  return { colors: colors.length > 1 ? colors : [], sizeCount };
}

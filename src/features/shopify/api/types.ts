export interface Money {
  amount: string;
  currencyCode: string;
}

export interface ShopifyImage {
  url: string;
  altText: string | null;
  width?: number | null;
  height?: number | null;
}

export interface ProductSummary {
  id: string;
  handle: string;
  title: string;
  featuredImage: ShopifyImage | null;
  priceRange: { minVariantPrice: Money };
}

export interface CatalogOption {
  name: string;
  /** `swatch` is the merchant's swatch colour when set in Shopify, never inferred from the name. */
  values: Array<{ name: string; swatch: string | null }>;
}

export interface CatalogVariant {
  id: string;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
}

/** A product as listed in a grid: enough for facets, hover media and quick add. */
export interface CatalogProduct extends ProductSummary {
  productType: string;
  createdAt: string;
  availableForSale: boolean;
  /** First two images: the card face and its hover alternate. */
  images: ShopifyImage[];
  options: CatalogOption[];
  variants: CatalogVariant[];
  /** False when Shopify has more variants than one listing page carries. */
  variantsComplete: boolean;
}

export interface CollectionSummary {
  handle: string;
  title: string;
  description: string;
  image: ShopifyImage | null;
}

export interface CollectionProducts extends CollectionSummary {
  products: CatalogProduct[];
}

export interface CollectionTile extends CollectionSummary {
  /** Products in the collection, capped at the tile query's page size. */
  productCount: number;
  hasMoreProducts: boolean;
  /** First product image; used when the collection has no image of its own. */
  coverImage: ShopifyImage | null;
}

export type CatalogSort = "newest" | "featured";

export interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  compareAtPrice: Money | null;
  image: ShopifyImage | null;
  selectedOptions: Array<{ name: string; value: string }>;
}

export interface Product extends ProductSummary {
  description: string;
  images: { nodes: ShopifyImage[] };
  variants: { nodes: ProductVariant[] };
}

export interface CartLine {
  id: string;
  quantity: number;
  cost: { totalAmount: Money };
  merchandise: {
    id: string;
    title: string;
    availableForSale: boolean;
    image: ShopifyImage | null;
    selectedOptions?: Array<{ name: string; value: string }>;
    product: { title: string; handle: string };
  };
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: Money; totalAmount: Money };
  lines: { nodes: CartLine[] };
}

export interface StorefrontPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface StorefrontUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

export interface StorefrontWarning {
  message: string;
  code?: string | null;
  target?: string | null;
}

export interface StorefrontGraphQLError {
  message: string;
  code?: string;
  path?: Array<string | number>;
}

export type StorefrontErrorKind =
  | "configuration-missing"
  | "configuration-invalid"
  | "network"
  | "http"
  | "graphql"
  | "malformed-response"
  | "user"
  | "cart-not-found"
  | "pagination"
  | "invalid-checkout-url";

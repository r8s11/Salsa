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

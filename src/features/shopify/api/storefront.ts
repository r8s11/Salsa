import {
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_QUERY,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
  PRODUCTS_QUERY,
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCT_IMAGES_QUERY,
  PRODUCT_VARIANTS_QUERY,
} from "./operations";
import type {
  Cart,
  CartLine,
  Money,
  Product,
  ProductSummary,
  ProductVariant,
  ShopifyImage,
  StorefrontErrorKind,
  StorefrontGraphQLError,
  StorefrontPageInfo,
  StorefrontUserError,
  StorefrontWarning,
} from "./types";

const API_VERSION = "2026-10";
const PAGE_SIZE = 250;
const STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN?.trim() ?? "";
const STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN?.trim() ?? "";
const SHOPIFY_DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/i;
const PRIVATE_TOKEN_PREFIXES = ["shpat_", "shpca_", "shppa_", "shpua_", "shpss_"];

interface ParsedCart {
  cart: Cart;
  pageInfo: StorefrontPageInfo;
}
export class StorefrontError extends Error {
  readonly kind: StorefrontErrorKind;
  readonly cart?: Cart;
  readonly status?: number;
  readonly userErrors?: StorefrontUserError[];
  readonly warnings?: StorefrontWarning[];
  readonly graphQLErrors?: StorefrontGraphQLError[];

  constructor(
    kind: StorefrontErrorKind,
    message: string,
    cart?: Cart,
    details: {
      status?: number;
      userErrors?: StorefrontUserError[];
      warnings?: StorefrontWarning[];
      graphQLErrors?: StorefrontGraphQLError[];
    } = {}
  ) {
    super(message);
    this.name = "StorefrontError";
    this.kind = kind;
    this.cart = cart;
    this.status = details.status;
    this.userErrors = details.userErrors;
    this.warnings = details.warnings;
    this.graphQLErrors = details.graphQLErrors;
  }
}

function validStoreDomain(domain: string): boolean {
  return SHOPIFY_DOMAIN_PATTERN.test(domain);
}

function validPublicToken(token: string): boolean {
  return token.length > 0 && !PRIVATE_TOKEN_PREFIXES.some((prefix) => token.toLowerCase().startsWith(prefix));
}

export function isShopifyConfigured(): boolean {
  return validStoreDomain(STORE_DOMAIN) && validPublicToken(STOREFRONT_TOKEN);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new StorefrontError("malformed-response", `Malformed Shopify response: ${field} is missing.`);
  }
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new StorefrontError("malformed-response", `Malformed Shopify response: ${field} is missing.`);
  }
  return value;
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new StorefrontError("malformed-response", `Malformed Shopify response: ${field} is missing.`);
  }
  return value;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new StorefrontError("malformed-response", `Malformed Shopify response: ${field} is missing.`);
  }
  return value;
}

function list(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new StorefrontError("malformed-response", `Malformed Shopify response: ${field} is missing.`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field);
}

function parseMoney(value: unknown, field: string): Money {
  const money = record(value, field);
  return {
    amount: requiredString(money.amount, `${field}.amount`),
    currencyCode: requiredString(money.currencyCode, `${field}.currencyCode`),
  };
}

function parseImage(value: unknown, field: string): ShopifyImage | null {
  if (value === null) return null;
  const image = record(value, field);
  return {
    url: requiredString(image.url, `${field}.url`),
    altText: nullableString(image.altText, `${field}.altText`),
    ...(image.width == null ? {} : { width: requiredNumber(image.width, `${field}.width`) }),
    ...(image.height == null ? {} : { height: requiredNumber(image.height, `${field}.height`) }),
  };
}

function parseProductSummary(value: unknown): ProductSummary {
  const product = record(value, "product");
  const priceRange = record(product.priceRange, "product.priceRange");
  return {
    id: requiredString(product.id, "product.id"),
    handle: requiredString(product.handle, "product.handle"),
    title: requiredString(product.title, "product.title"),
    featuredImage: parseImage(product.featuredImage, "product.featuredImage"),
    priceRange: { minVariantPrice: parseMoney(priceRange.minVariantPrice, "product.priceRange.minVariantPrice") },
  };
}

function parseVariant(value: unknown): ProductVariant {
  const variant = record(value, "variant");
  return {
    id: requiredString(variant.id, "variant.id"),
    title: requiredString(variant.title, "variant.title"),
    availableForSale: requiredBoolean(variant.availableForSale, "variant.availableForSale"),
    price: parseMoney(variant.price, "variant.price"),
    compareAtPrice: variant.compareAtPrice === null ? null : parseMoney(variant.compareAtPrice, "variant.compareAtPrice"),
    image: parseImage(variant.image, "variant.image"),
    selectedOptions: list(variant.selectedOptions, "variant.selectedOptions").map((option) => {
      const selectedOption = record(option, "variant.selectedOptions[]");
      return {
        name: requiredString(selectedOption.name, "variant.selectedOptions[].name"),
        value: requiredString(selectedOption.value, "variant.selectedOptions[].value"),
      };
    }),
  };
}

function parsePageInfo(value: unknown): StorefrontPageInfo {
  const pageInfo = record(value, "pageInfo");
  return {
    hasNextPage: requiredBoolean(pageInfo.hasNextPage, "pageInfo.hasNextPage"),
    endCursor: nullableString(pageInfo.endCursor, "pageInfo.endCursor"),
  };
}

function parseCartLine(value: unknown): CartLine {
  const line = record(value, "cart line");
  const cost = record(line.cost, "cart line.cost");
  const merchandise = record(line.merchandise, "cart line.merchandise");
  const product = record(merchandise.product, "cart line.merchandise.product");
  return {
    id: requiredString(line.id, "cart line.id"),
    quantity: requiredNumber(line.quantity, "cart line.quantity"),
    cost: { totalAmount: parseMoney(cost.totalAmount, "cart line.cost.totalAmount") },
    merchandise: {
      id: requiredString(merchandise.id, "cart line.merchandise.id"),
      title: requiredString(merchandise.title, "cart line.merchandise.title"),
      availableForSale: requiredBoolean(merchandise.availableForSale, "cart line.merchandise.availableForSale"),
      image: parseImage(merchandise.image, "cart line.merchandise.image"),
      ...(merchandise.selectedOptions === undefined ? {} : {
        selectedOptions: list(merchandise.selectedOptions, "cart line.merchandise.selectedOptions").map((option) => {
          const selected = record(option, "cart line.merchandise.selectedOptions[]");
          return {
            name: requiredString(selected.name, "cart option.name"),
            value: requiredString(selected.value, "cart option.value"),
          };
        }),
      }),
      product: {
        title: requiredString(product.title, "cart line.merchandise.product.title"),
        handle: requiredString(product.handle, "cart line.merchandise.product.handle"),
      },
    },
  };
}

function parseCart(value: unknown): ParsedCart | null {
  if (value === null) return null;
  const cart = record(value, "cart");
  const cost = record(cart.cost, "cart.cost");
  const linesConnection = record(cart.lines, "cart.lines");
  return {
    cart: {
      id: requiredString(cart.id, "cart.id"),
      checkoutUrl: parseCheckoutUrl(cart.checkoutUrl),
      totalQuantity: requiredNumber(cart.totalQuantity, "cart.totalQuantity"),
      cost: {
        subtotalAmount: parseMoney(cost.subtotalAmount, "cart.cost.subtotalAmount"),
        totalAmount: parseMoney(cost.totalAmount, "cart.cost.totalAmount"),
      },
      lines: { nodes: list(linesConnection.nodes, "cart.lines.nodes").map(parseCartLine) },
    },
    pageInfo: parsePageInfo(linesConnection.pageInfo),
  };
}

function sanitizeMessage(message: string): string {
  const withoutToken = STOREFRONT_TOKEN ? message.split(STOREFRONT_TOKEN).join("[redacted]") : message;
  return withoutToken
    .replace(/gid:\/\/shopify\/Cart\/[^\s"'<>]*/gi, "[redacted cart]")
    .replace(/([?&]key=)[^&#\s"'<>]*/gi, "$1[redacted]");
}

function parseCheckoutUrl(value: unknown): string {
  const checkoutUrl = requiredString(value, "cart.checkoutUrl");
  try {
    if (new URL(checkoutUrl).protocol === "https:") return checkoutUrl;
  } catch {
    // Invalid URL syntax is rejected below without echoing the value.
  }
  throw new StorefrontError("invalid-checkout-url", "Shopify returned an invalid checkout URL.");
}

function configuredEndpoint(): string {
  if (!STORE_DOMAIN || !STOREFRONT_TOKEN) {
    throw new StorefrontError("configuration-missing", "Shopify Storefront configuration is missing.");
  }
  if (!validStoreDomain(STORE_DOMAIN) || !validPublicToken(STOREFRONT_TOKEN)) {
    throw new StorefrontError("configuration-invalid", "Shopify Storefront configuration is invalid.");
  }
  return `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;
}

async function request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const endpoint = configuredEndpoint();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new StorefrontError("network", "Unable to connect to Shopify Storefront.");
  }

  if (!response.ok) {
    throw new StorefrontError("http", `Shopify Storefront request failed (${response.status}).`, undefined, {
      status: response.status,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new StorefrontError("malformed-response", "Shopify returned an unreadable response.");
  }
  const body = record(payload, "response");
  if (body.errors !== undefined && !Array.isArray(body.errors)) {
    throw new StorefrontError("malformed-response", "Shopify returned malformed GraphQL errors.");
  }
  if (Array.isArray(body.errors) && body.errors.length) {
    const graphQLErrors = body.errors.map((error): StorefrontGraphQLError => {
      const graphQLError = record(error, "GraphQL error");
      const extensions = isRecord(graphQLError.extensions) ? graphQLError.extensions : {};
      return {
        message: sanitizeMessage(
          typeof graphQLError.message === "string" ? graphQLError.message : "Shopify GraphQL request failed."
        ),
        ...(typeof extensions.code === "string" ? { code: sanitizeMessage(extensions.code) } : {}),
        ...(Array.isArray(graphQLError.path) &&
          graphQLError.path.every((part) => typeof part === "string" || typeof part === "number")
          ? { path: graphQLError.path.map((part) => typeof part === "string" ? sanitizeMessage(part) : part) }
          : {}),
      };
    });
    throw new StorefrontError(
      "graphql",
      graphQLErrors.map(({ message }) => message).join(" "),
      undefined,
      { graphQLErrors }
    );
  }
  if (!isRecord(body.data)) {
    throw new StorefrontError("malformed-response", "Shopify returned a malformed GraphQL response.");
  }
  return body.data as T;
}

function nextCursor(pageInfo: StorefrontPageInfo, previousCursor: string | undefined, resource: string): string | null {
  if (!pageInfo.hasNextPage) return null;
  if (!pageInfo.endCursor || pageInfo.endCursor === previousCursor) {
    throw new StorefrontError("pagination", `Shopify returned an invalid ${resource} pagination cursor.`);
  }
  return pageInfo.endCursor;
}

async function hydrateCart(parsed: ParsedCart): Promise<Cart> {
  const { cart } = parsed;
  let pageInfo = parsed.pageInfo;
  let previousCursor: string | undefined;
  while (pageInfo.hasNextPage) {
    const after = nextCursor(pageInfo, previousCursor, "cart line");
    if (!after) break;
    const data = await request<{ cart?: unknown }>(CART_LINES_QUERY, { id: cart.id, after });
    const cartPage = record(data.cart, "cart line page");
    const linesConnection = record(cartPage.lines, "cart line page.lines");
    cart.lines.nodes.push(...list(linesConnection.nodes, "cart line page.lines.nodes").map(parseCartLine));
    pageInfo = parsePageInfo(linesConnection.pageInfo);
    previousCursor = after;
  }
  return cart;
}

function parseMutationErrors(value: unknown, field: string): StorefrontUserError[] {
  return list(value, field).map((error) => {
    const userError = record(error, field);
    const path = userError.field === undefined || userError.field === null
      ? userError.field
      : list(userError.field, `${field}.field`).map((part) => requiredString(part, `${field}.field[]`));
    return {
      ...(path === undefined ? {} : { field: path }),
      message: sanitizeMessage(requiredString(userError.message, `${field}.message`)),
      ...(userError.code === undefined ? {} : { code: nullableString(userError.code, `${field}.code`) }),
    };
  });
}

function parseWarnings(value: unknown, field: string): StorefrontWarning[] {
  return list(value, field).map((warning) => {
    const parsed = record(warning, field);
    return {
      message: sanitizeMessage(requiredString(parsed.message, `${field}.message`)),
      ...(parsed.code === undefined ? {} : { code: nullableString(parsed.code, `${field}.code`) }),
      ...(parsed.target === undefined
        ? {}
        : { target: nullableString(parsed.target, `${field}.target`) }),
    };
  });
}

async function mutationCart(
  payload: unknown,
  field: string,
  cartId: string | null
): Promise<Cart> {
  const mutation = record(payload, field);
  const userErrors = parseMutationErrors(mutation.userErrors, `${field}.userErrors`);
  const warnings = parseWarnings(mutation.warnings, `${field}.warnings`);
  const cartPage = parseCart(mutation.cart);
  if (userErrors.length) {
    let isMissingCart = false;
    if (cartId !== null && cartPage === null) {
      try {
        isMissingCart = await storefront.getCart(cartId) === null;
      } catch {
        isMissingCart = false;
      }
    }
    const messages = [
      ...userErrors.map(({ message }) => message),
      ...warnings.map(({ message }) => message),
    ];
    throw new StorefrontError(
      isMissingCart ? "cart-not-found" : "user",
      sanitizeMessage(messages.join(" ")) || "Shopify rejected the cart operation.",
      cartPage ? await hydrateCart(cartPage) : undefined,
      { userErrors, warnings }
    );
  }
  if (cartPage === null) {
    if (warnings.length) {
      throw new StorefrontError(
        "user",
        sanitizeMessage(warnings.map(({ message }) => message).join(" ")),
        undefined,
        { warnings }
      );
    }
    throw new StorefrontError("malformed-response", "Shopify returned no cart for a successful cart operation.");
  }
  const cart = await hydrateCart(cartPage);
  if (warnings.length) {
    throw new StorefrontError(
      "user",
      sanitizeMessage(warnings.map(({ message }) => message).join(" ")),
      cart,
      { warnings }
    );
  }
  return cart;
}

async function listProducts(after?: string): Promise<{ nodes: ProductSummary[]; pageInfo: StorefrontPageInfo }> {
  const data = await request<{ products?: unknown }>(PRODUCTS_QUERY, { first: 24, after: after ?? null });
  const products = record(data.products, "products");
  const nodes = list(products.nodes, "products.nodes").map(parseProductSummary);
  const pageInfo = parsePageInfo(products.pageInfo);
  nextCursor(pageInfo, after, "product");
  return { nodes, pageInfo };
}

async function getProduct(handle: string): Promise<Product | null> {
  const data = await request<{ product?: unknown }>(PRODUCT_BY_HANDLE_QUERY, { handle, first: PAGE_SIZE });
  if (data.product === null) return null;
  const product = record(data.product, "product");
  const variantsConnection = record(product.variants, "product.variants");
  const variants = list(variantsConnection.nodes, "product.variants.nodes").map(parseVariant);
  let pageInfo = parsePageInfo(variantsConnection.pageInfo);
  const productId = requiredString(product.id, "product.id");

  let after: string | undefined;
  while (pageInfo.hasNextPage) {
    const cursor = nextCursor(pageInfo, after, "product variant");
    if (!cursor) break;
    const nextData = await request<{ node?: unknown }>(PRODUCT_VARIANTS_QUERY, {
      id: productId,
      first: PAGE_SIZE,
      after: cursor,
    });
    const node = record(nextData.node, "product variant page");
    const nextConnection = record(node.variants, "product variant page.variants");
    variants.push(...list(nextConnection.nodes, "product variant page.variants.nodes").map(parseVariant));
    pageInfo = parsePageInfo(nextConnection.pageInfo);
    after = cursor;
  }
  const summary = parseProductSummary(product);
  const imagesConnection = record(product.images, "product.images");
  const parseImages = (nodes: unknown): ShopifyImage[] =>
    list(nodes, "product.images.nodes").map((node) => {
      const image = parseImage(node, "product.images.node");
      if (!image) throw new StorefrontError("malformed-response", "Shopify returned an invalid product image.");
      return image;
    });
  const images = parseImages(imagesConnection.nodes);
  let imagePage = parsePageInfo(imagesConnection.pageInfo);
  let imageAfter: string | undefined;
  while (imagePage.hasNextPage) {
    const cursor = nextCursor(imagePage, imageAfter, "product image");
    if (!cursor) break;
    const imageData = await request<{ node?: unknown }>(PRODUCT_IMAGES_QUERY, {
      id: productId, first: PAGE_SIZE, after: cursor,
    });
    const imageNode = record(imageData.node, "product image page");
    const connection = record(imageNode.images, "product image page.images");
    images.push(...parseImages(connection.nodes));
    imagePage = parsePageInfo(connection.pageInfo);
    imageAfter = cursor;
  }
  return {
    ...summary,
    description: requiredString(product.description, "product.description"),
    images: { nodes: images },
    variants: { nodes: variants },
  };
}

async function getCart(id: string): Promise<Cart | null> {
  const data = await request<{ cart?: unknown }>(CART_QUERY, { id });
  const cartPage = parseCart(data.cart);
  return cartPage ? hydrateCart(cartPage) : null;
}

async function createCart(lines: Array<{ merchandiseId: string; quantity: number }>): Promise<Cart> {
  const data = await request<{ cartCreate?: unknown }>(CART_CREATE_MUTATION, {
    input: { lines },
  });
  return mutationCart(data.cartCreate, "cartCreate", null);
}

async function addCartLines(
  id: string,
  lines: Array<{ merchandiseId: string; quantity: number }>
): Promise<Cart> {
  const data = await request<{ cartLinesAdd?: unknown }>(CART_LINES_ADD_MUTATION, { cartId: id, lines });
  return mutationCart(data.cartLinesAdd, "cartLinesAdd", id);
}

async function updateCartLines(id: string, lines: Array<{ id: string; quantity: number }>): Promise<Cart> {
  const data = await request<{ cartLinesUpdate?: unknown }>(CART_LINES_UPDATE_MUTATION, { cartId: id, lines });
  return mutationCart(data.cartLinesUpdate, "cartLinesUpdate", id);
}

async function removeCartLines(id: string, lineIds: string[]): Promise<Cart> {
  const data = await request<{ cartLinesRemove?: unknown }>(CART_LINES_REMOVE_MUTATION, { cartId: id, lineIds });
  return mutationCart(data.cartLinesRemove, "cartLinesRemove", id);
}

export const storefront = {
  listProducts,
  getProduct,
  getCart,
  createCart,
  addCartLines,
  updateCartLines,
  removeCartLines,
};

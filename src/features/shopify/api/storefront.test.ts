import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORE_DOMAIN = "ritmo-vivo.myshopify.com";
const STOREFRONT_TOKEN = "storefront-public-token";
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const money = (amount: string, currencyCode = "USD") => ({ amount, currencyCode });
const image = { url: "https://cdn.shopify.com/image.jpg", altText: "Product" };
const cartNode = (overrides: Record<string, unknown> = {}) => ({
  id: "gid://shopify/Cart/1",
  checkoutUrl: "https://checkout.shopify.com/cart/1",
  totalQuantity: 3,
  cost: { subtotalAmount: money("24.00"), totalAmount: money("24.00") },
  lines: {
    nodes: [
      {
        id: "line-1",
        quantity: 3,
        cost: { totalAmount: money("24.00") },
        merchandise: {
          id: "variant-1",
          title: "Medium",
          availableForSale: true,
          image,
          product: { title: "Dance shirt", handle: "dance-shirt" },
        },
      },
    ],
    pageInfo: { hasNextPage: false, endCursor: null },
  },
  ...overrides,
});

// Runtime import is required so each test exercises Vite env captured at module initialization.
async function loadClient() {
  return import("./storefront");
}

function configureStorefront() {
  vi.stubEnv("VITE_SHOPIFY_STORE_DOMAIN", STORE_DOMAIN);
  vi.stubEnv("VITE_SHOPIFY_STOREFRONT_TOKEN", STOREFRONT_TOKEN);
}

describe("Shopify Storefront client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_SHOPIFY_STORE_DOMAIN", "");
    vi.stubEnv("VITE_SHOPIFY_STOREFRONT_TOKEN", "");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports missing configuration and rejects operations without making a request", async () => {
    const { isShopifyConfigured, storefront, StorefrontError } = await loadClient();

    expect(isShopifyConfigured()).toBe(false);
    await expect(storefront.listProducts()).rejects.toMatchObject({
      name: "StorefrontError",
      kind: "configuration-missing",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(StorefrontError).toBeTypeOf("function");
  });

  it.each([
    ["admin token", "shpat_private-admin-token"],
    ["private Storefront token", "shpca_private-token"],
    ["unsafe domain", "https://evil.example/path"],
    ["non-Shopify domain", "evil.example"],
  ])("rejects %s configuration", async (_label, invalidValue) => {
    vi.stubEnv("VITE_SHOPIFY_STORE_DOMAIN", STORE_DOMAIN);
    vi.stubEnv("VITE_SHOPIFY_STOREFRONT_TOKEN", STOREFRONT_TOKEN);
    if (String(invalidValue).includes(".")) {
      vi.stubEnv("VITE_SHOPIFY_STORE_DOMAIN", String(invalidValue));
    } else {
      vi.stubEnv("VITE_SHOPIFY_STOREFRONT_TOKEN", String(invalidValue));
    }

    const { isShopifyConfigured, storefront } = await loadClient();
    expect(isShopifyConfigured()).toBe(false);
    await expect(storefront.getCart("cart-id")).rejects.toMatchObject({ kind: "configuration-invalid" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends requests to the fixed 2026-10 Storefront endpoint with only the public token", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: { cart: null } }));
    const { storefront } = await loadClient();

    expect(await storefront.getCart("cart-id")).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      `https://${STORE_DOMAIN}/api/2026-10/graphql.json`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
        }),
      })
    );
    expect(JSON.stringify(vi.mocked(fetch).mock.calls)).not.toContain("shpat_");
  });

  it("classifies transport failures without exposing credentials", async () => {
    configureStorefront();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    const { storefront } = await loadClient();

    await expect(storefront.getCart("cart-id")).rejects.toMatchObject({ kind: "network" });
  });

  it("classifies non-success HTTP responses separately from transport failures", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({ errors: [{ message: "server failure" }] }, 503));
    const { storefront } = await loadClient();

    await expect(storefront.getCart("cart-id")).rejects.toMatchObject({ kind: "http", status: 503 });
  });

  it("classifies GraphQL errors separately from HTTP failures", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ errors: [{ message: "Access denied" }] })
    );
    const { storefront } = await loadClient();

    await expect(storefront.listProducts()).rejects.toMatchObject({ kind: "graphql" });
  });

  it("rejects malformed and stale response shapes instead of treating them as a missing cart", async () => {
    configureStorefront();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { cart: { id: "broken" } } }))
      .mockResolvedValueOnce(response({ data: {} }));
    const { storefront } = await loadClient();

    await expect(storefront.getCart("cart-id")).rejects.toMatchObject({ kind: "malformed-response" });
    await expect(storefront.getCart("cart-id")).rejects.toMatchObject({ kind: "malformed-response" });
  });

  it("returns null only when a cart query explicitly returns null", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: { cart: null } }));
    const { storefront } = await loadClient();

    await expect(storefront.getCart("deleted-cart")).resolves.toBeNull();
  });

  it("fetches every cart line page before returning the cart", async () => {
    configureStorefront();
    const firstLines = cartNode().lines.nodes;
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        response({
          data: {
            cart: cartNode({
              lines: {
                nodes: firstLines,
                pageInfo: { hasNextPage: true, endCursor: "line-cursor" },
              },
            }),
          },
        })
      )
      .mockResolvedValueOnce(
        response({
          data: {
            cart: {
              lines: {
                nodes: [
                  {
                    id: "line-2",
                    quantity: 1,
                    cost: { totalAmount: money("8.00") },
                    merchandise: {
                      id: "variant-2",
                      title: "Large",
                      availableForSale: true,
                      image,
                      product: { title: "Dance shirt", handle: "dance-shirt" },
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      );
    const { storefront } = await loadClient();

    await expect(storefront.getCart("cart-id")).resolves.toMatchObject({
      lines: { nodes: [{ id: "line-1" }, { id: "line-2" }] },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[1]?.[1])).toContain("line-cursor");
  });

  it("classifies cart user errors without calling every invalid ID a stale cart", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(
      response({
        data: {
          cartLinesAdd: {
            cart: null,
            userErrors: [{ code: "INVALID", message: "Invalid merchandise ID" }],
            warnings: [],
          },
        },
      })
    );
    const { storefront } = await loadClient();

    await expect(
      storefront.addCartLines("cart-id", [{ merchandiseId: "bad-variant", quantity: 1 }])
    ).rejects.toMatchObject({ name: "StorefrontError", kind: "user" });
  });

  it("preserves Shopify's updated cart alongside non-blocking inventory warnings", async () => {
    configureStorefront();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        response({
          data: {
            cartLinesAdd: {
              cart: cartNode({
                totalQuantity: 2,
                lines: {
                  nodes: cartNode().lines.nodes,
                  pageInfo: { hasNextPage: true, endCursor: "warning-cart-cursor" },
                },
              }),
              userErrors: [],
              warnings: [{ code: "MERCHANDISE_NOT_ENOUGH_STOCK", message: "Quantity adjusted", target: "line-1" }],
            },
          },
        })
      )
      .mockResolvedValueOnce(
        response({
          data: {
            cart: {
              lines: {
                nodes: [
                  {
                    id: "line-2",
                    quantity: 1,
                    cost: { totalAmount: money("8.00") },
                    merchandise: {
                      id: "variant-2",
                      title: "Large",
                      availableForSale: true,
                      image,
                      product: { title: "Dance shirt", handle: "dance-shirt" },
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      );
    const { storefront } = await loadClient();

    await expect(
      storefront.addCartLines("cart-id", [{ merchandiseId: "variant-1", quantity: 5 }])
    ).rejects.toMatchObject({
      kind: "user",
      message: expect.stringContaining("Quantity adjusted"),
      cart: { totalQuantity: 2, lines: { nodes: [{ id: "line-1" }, { id: "line-2" }] } },
    });

  });
  it("preserves a cart returned with user errors", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(
      response({
        data: {
          cartLinesAdd: {
            cart: cartNode({ totalQuantity: 2 }),
            userErrors: [{ code: "INVALID", message: "One line was rejected" }],
            warnings: [],
          },
        },
      })
    );
    const { storefront } = await loadClient();

    await expect(
      storefront.addCartLines("cart-id", [{ merchandiseId: "variant-1", quantity: 5 }])
    ).rejects.toMatchObject({ kind: "user", cart: { totalQuantity: 2 } });
  });

  it("preserves Shopify-returned line quantities and money rather than recomputing them", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(
      response({
        data: {
          cart: cartNode({
            totalQuantity: 2,
            cost: { subtotalAmount: money("15.00"), totalAmount: money("17.35") },
          }),
        },
      })
    );
    const { storefront } = await loadClient();

    await expect(storefront.getCart("cart-id")).resolves.toMatchObject({
      totalQuantity: 2,
      cost: { subtotalAmount: money("15.00"), totalAmount: money("17.35") },
      lines: {
        nodes: [
          {
            quantity: 3,
            cost: { totalAmount: money("24.00") },
            merchandise: { id: "variant-1" },
          },
        ],
      },
    });
  });

  it("paginates the product grid using the supplied cursor", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(
      response({
        data: {
          products: {
            nodes: [],
            pageInfo: { hasNextPage: true, endCursor: "next-page" },
          },
        },
      })
    );
    const { storefront } = await loadClient();

    await expect(storefront.listProducts("previous-page")).resolves.toEqual({
      nodes: [],
      pageInfo: { hasNextPage: true, endCursor: "next-page" },
    });
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0]?.[1])).toContain("previous-page");
  });

  it("fetches all variant pages for a product and concatenates their nodes", async () => {
    configureStorefront();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        response({
          data: {
            product: {
              id: "product-1",
              handle: "dance-shirt",
              title: "Dance shirt",
              description: "A shirt",
              featuredImage: image,
              images: { nodes: [image], pageInfo: { hasNextPage: false, endCursor: null } },
              priceRange: { minVariantPrice: money("8.00") },
              variants: {
                nodes: [
                  {
                    id: "variant-1",
                    title: "Small",
                    availableForSale: true,
                    price: money("8.00"),
                    compareAtPrice: null,
                    image,
                    selectedOptions: [{ name: "Size", value: "S" }],
                  },
                ],
                pageInfo: { hasNextPage: true, endCursor: "variant-cursor" },
              },
            },
          },
        })
      )
      .mockResolvedValueOnce(
        response({
          data: {
            node: {
              variants: {
                nodes: [
                  {
                    id: "variant-2",
                    title: "Large",
                    availableForSale: false,
                    price: money("10.00"),
                    compareAtPrice: money("12.00"),
                    image: null,
                    selectedOptions: [{ name: "Size", value: "L" }],
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        })
      );
    const { storefront } = await loadClient();

    await expect(storefront.getProduct("dance-shirt")).resolves.toMatchObject({
      variants: { nodes: [{ id: "variant-1" }, { id: "variant-2" }] },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[1]?.[1])).toContain("variant-cursor");
  });

  it("returns null for a product explicitly absent from Shopify", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: { product: null } }));
    const { storefront } = await loadClient();

    await expect(storefront.getProduct("missing-product")).resolves.toBeNull();
  });

  it.each([
    ["missing cursor", null],
    ["repeated cursor", "same-cursor"],
  ])("rejects product pagination with a %s", async (_label, endCursor) => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        products: {
          nodes: [],
          pageInfo: { hasNextPage: true, endCursor },
        },
      },
    }));
    const { storefront } = await loadClient();

    await expect(storefront.listProducts(endCursor ?? "same-cursor")).rejects.toMatchObject({
      name: "StorefrontError",
      kind: "pagination",
    });
  });

  it("rejects non-HTTPS checkout URLs before returning carts", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: { cart: cartNode({ checkoutUrl: "javascript:alert(1)" }) },
    }));
    const { storefront } = await loadClient();

    await expect(storefront.getCart("cart-id")).rejects.toMatchObject({
      name: "StorefrontError",
      kind: "invalid-checkout-url",
    });
  });

  it("redacts Storefront tokens and cart keys from GraphQL error messages", async () => {
    configureStorefront();
    const sensitiveCartId = "gid://shopify/Cart/secret?key=cart-secret";
    vi.mocked(fetch).mockResolvedValueOnce(response({
      errors: [{ message: `Rejected ${STOREFRONT_TOKEN} ${sensitiveCartId}` }],
    }));
    const { storefront } = await loadClient();

    const failure = await storefront.getCart(sensitiveCartId).catch((error: unknown) => error);
    expect(failure).toMatchObject({ name: "StorefrontError", kind: "graphql" });
    expect((failure as Error).message).not.toContain(STOREFRONT_TOKEN);
    expect((failure as Error).message).not.toContain("cart-secret");
  });

  it("preserves structured user errors and warnings with Shopify's cart", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        cartLinesAdd: {
          cart: cartNode({ totalQuantity: 2 }),
          userErrors: [{ field: ["lines", "0", "quantity"], code: "INVALID", message: "Quantity rejected" }],
          warnings: [{ code: "MERCHANDISE_NOT_ENOUGH_STOCK", message: "Quantity adjusted", target: "line-1" }],
        },
      },
    }));
    const { storefront } = await loadClient();

    await expect(storefront.addCartLines("cart-id", [{ merchandiseId: "variant-1", quantity: 5 }]))
      .rejects.toMatchObject({
        kind: "user",
        userErrors: [{
          field: ["lines", "0", "quantity"],
          code: "INVALID",
          message: "Quantity rejected",
        }],
        warnings: [{
          code: "MERCHANDISE_NOT_ENOUGH_STOCK",
          message: "Quantity adjusted",
          target: "line-1",
        }],
        cart: { totalQuantity: 2 },
      });
  });

  it("rejects a repeated product-variant cursor instead of looping", async () => {
    configureStorefront();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: {
          product: {
            id: "product-1",
            handle: "dance-shirt",
            title: "Dance shirt",
            description: "A shirt",
            featuredImage: image,
            priceRange: { minVariantPrice: money("8.00") },
            variants: {
              nodes: [],
              pageInfo: { hasNextPage: true, endCursor: "same-cursor" },
            },
          },
        },
      }))
      .mockResolvedValueOnce(response({
        data: {
          node: {
            variants: {
              nodes: [],
              pageInfo: { hasNextPage: true, endCursor: "same-cursor" },
            },
          },
        },
      }));
    const { storefront } = await loadClient();

    await expect(storefront.getProduct("dance-shirt")).rejects.toMatchObject({
      name: "StorefrontError",
      kind: "pagination",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects a repeated cart-line cursor instead of looping", async () => {
    configureStorefront();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: {
          cart: cartNode({
            lines: {
              nodes: cartNode().lines.nodes,
              pageInfo: { hasNextPage: true, endCursor: "same-cursor" },
            },
          }),
        },
      }))
      .mockResolvedValueOnce(response({
        data: {
          cart: {
            lines: {
              nodes: [],
              pageInfo: { hasNextPage: true, endCursor: "same-cursor" },
            },
          },
        },
      }));
    const { storefront } = await loadClient();

    await expect(storefront.getCart("cart-id")).rejects.toMatchObject({
      name: "StorefrontError",
      kind: "pagination",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["cartCreate", "create"],
    ["cartLinesAdd", "add"],
    ["cartLinesUpdate", "update"],
    ["cartLinesRemove", "remove"],
  ])("%s preserves Shopify mutation cart results and structured warnings", async (field, action) => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        [field]: {
          cart: cartNode({
            totalQuantity: 7,
            cost: { subtotalAmount: money("12.40"), totalAmount: money("17.25") },
          }),
          userErrors: [],
          warnings: [],
        },
      },
    }));
    const { storefront } = await loadClient();
    const result = action === "create"
      ? storefront.createCart([{ merchandiseId: "variant-1", quantity: 1 }])
      : action === "add"
        ? storefront.addCartLines("cart-id", [{ merchandiseId: "variant-1", quantity: 1 }])
        : action === "update"
          ? storefront.updateCartLines("cart-id", [{ id: "line-1", quantity: 2 }])
          : storefront.removeCartLines("cart-id", ["line-1"]);

    await expect(result).resolves.toMatchObject({
      totalQuantity: 7,
      cost: { subtotalAmount: money("12.40"), totalAmount: money("17.25") },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["cartCreate", "create"],
    ["cartLinesAdd", "add"],
    ["cartLinesUpdate", "update"],
    ["cartLinesRemove", "remove"],
  ])("%s preserves Shopify warnings with the returned cart", async (field, action) => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        [field]: {
          cart: cartNode({ totalQuantity: 2 }),
          userErrors: [],
          warnings: [{ code: "STOCK_ADJUSTED", message: "Quantity adjusted", target: "line-1" }],
        },
      },
    }));
    const { storefront } = await loadClient();
    const result = action === "create"
      ? storefront.createCart([{ merchandiseId: "variant-1", quantity: 1 }])
      : action === "add"
        ? storefront.addCartLines("cart-id", [{ merchandiseId: "variant-1", quantity: 1 }])
        : action === "update"
          ? storefront.updateCartLines("cart-id", [{ id: "line-1", quantity: 2 }])
          : storefront.removeCartLines("cart-id", ["line-1"]);

    await expect(result).rejects.toMatchObject({
      kind: "user",
      warnings: [{ code: "STOCK_ADJUSTED", message: "Quantity adjusted", target: "line-1" }],
      cart: { totalQuantity: 2 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["cartCreate", "create"],
    ["cartLinesAdd", "add"],
    ["cartLinesUpdate", "update"],
    ["cartLinesRemove", "remove"],
  ])("%s preserves Shopify userErrors", async (field, action) => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        [field]: {
          cart: cartNode(),
          userErrors: [{ field: ["lines", "0"], code: "INVALID", message: "Line rejected" }],
          warnings: [],
        },
      },
    }));
    const { storefront } = await loadClient();
    const result = action === "create"
      ? storefront.createCart([{ merchandiseId: "variant-1", quantity: 1 }])
      : action === "add"
        ? storefront.addCartLines("cart-id", [{ merchandiseId: "variant-1", quantity: 1 }])
        : action === "update"
          ? storefront.updateCartLines("cart-id", [{ id: "line-1", quantity: 2 }])
          : storefront.removeCartLines("cart-id", ["line-1"]);

    await expect(result).rejects.toMatchObject({
      kind: "user",
      userErrors: [{ field: ["lines", "0"], code: "INVALID", message: "Line rejected" }],
      cart: { totalQuantity: 3 },
    });
  });

  it("classifies malformed cart creation responses", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: { cartCreate: null } }));
    const { storefront } = await loadClient();

    await expect(storefront.createCart([{ merchandiseId: "variant-1", quantity: 1 }]))
      .rejects.toMatchObject({ kind: "malformed-response" });
  });

  it("rejects a variant page that claims more data without a cursor", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        product: {
          id: "product-1",
          handle: "dance-shirt",
          title: "Dance shirt",
          description: "A shirt",
          featuredImage: image,
          priceRange: { minVariantPrice: money("8.00") },
          variants: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } },
        },
      },
    }));
    const { storefront } = await loadClient();

    await expect(storefront.getProduct("dance-shirt")).rejects.toMatchObject({ kind: "pagination" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a cart page that claims more lines without a cursor", async () => {
    configureStorefront();
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        cart: cartNode({
          lines: {
            nodes: cartNode().lines.nodes,
            pageInfo: { hasNextPage: true, endCursor: null },
          },
        }),
      },
    }));
    const { storefront } = await loadClient();

    await expect(storefront.getCart("cart-id")).rejects.toMatchObject({ kind: "pagination" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry an ambiguous cart mutation after a transport failure", async () => {
    configureStorefront();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("connection interrupted"));
    const { storefront } = await loadClient();

    await expect(storefront.addCartLines("cart-id", [{ merchandiseId: "variant-1", quantity: 1 }]))
      .rejects.toMatchObject({ kind: "network" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["VITE_SHOPIFY_STORE_DOMAIN", "VITE_SHOPIFY_STOREFRONT_TOKEN"] as const)(
    "does not request Shopify when %s is missing",
    async (missingVariable) => {
      vi.stubEnv("VITE_SHOPIFY_STORE_DOMAIN", STORE_DOMAIN);
      vi.stubEnv("VITE_SHOPIFY_STOREFRONT_TOKEN", STOREFRONT_TOKEN);
      vi.stubEnv(missingVariable, "");
      const { storefront } = await loadClient();

      await expect(storefront.listProducts()).rejects.toMatchObject({ kind: "configuration-missing" });
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it("hydrates gallery images and their Shopify dimensions without losing variant data", async () => {
    configureStorefront();
    const firstImage = { ...image, width: 720, height: 900 };
    const secondImage = { ...image, url: "https://cdn.shopify.com/back.jpg", width: 900, height: 720 };
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { product: {
        id: "product-1", handle: "dance-shirt", title: "Dance shirt", description: "A shirt",
        featuredImage: firstImage, priceRange: { minVariantPrice: money("8.00") },
        variants: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        images: { nodes: [firstImage], pageInfo: { hasNextPage: true, endCursor: "image-page" } },
      } } }))
      .mockResolvedValueOnce(response({ data: { node: {
        images: { nodes: [secondImage], pageInfo: { hasNextPage: false, endCursor: null } },
      } } }));
    const { storefront } = await loadClient();
    await expect(storefront.getProduct("dance-shirt")).resolves.toMatchObject({
      featuredImage: firstImage, images: { nodes: [firstImage, secondImage] },
    });
  });

  it("rejects nonadvancing image pagination rather than truncating the gallery", async () => {
    configureStorefront();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { product: {
        id: "product-1", handle: "dance-shirt", title: "Dance shirt", description: "A shirt",
        featuredImage: image, priceRange: { minVariantPrice: money("8.00") },
        variants: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        images: { nodes: [image], pageInfo: { hasNextPage: true, endCursor: "same" } },
      } } }))
      .mockResolvedValueOnce(response({ data: { node: {
        images: { nodes: [], pageInfo: { hasNextPage: true, endCursor: "same" } },
      } } }));
    const { storefront } = await loadClient();
    await expect(storefront.getProduct("dance-shirt")).rejects.toMatchObject({ kind: "pagination" });
  });

  it("exposes structured cart options instead of requiring opaque variant titles", async () => {
    configureStorefront();
    const cart = cartNode();
    const selectedOptions = [{ name: "Size", value: "M" }, { name: "Color", value: "Navy" }];
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: { cart: {
      ...cart, lines: { ...cart.lines, nodes: cart.lines.nodes.map((line) => ({
        ...line, merchandise: { ...line.merchandise, selectedOptions },
      })) },
    } } }));
    const { storefront } = await loadClient();
    await expect(storefront.getCart("cart-id")).resolves.toMatchObject({
      lines: { nodes: [{ merchandise: { selectedOptions } }] },
    });
  });
});

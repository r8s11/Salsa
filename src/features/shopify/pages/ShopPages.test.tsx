import type { Product, ProductSummary } from "../api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductPage from "./ProductPage";
import ShopPage from "./ShopPage";
import { storefront, isShopifyConfigured } from "../api/storefront";
import { useCart } from "../cart/useCart";

vi.mock("../api/storefront", () => ({
  storefront: {
    listProducts: vi.fn(),
    getProduct: vi.fn(),
  },
  isShopifyConfigured: vi.fn(),
}));

vi.mock("../cart/useCart", () => ({
  useCart: vi.fn(),
}));

const money = (amount: string, currencyCode = "USD") => ({ amount, currencyCode });
const image = { url: "https://cdn.example.test/dance-shirt.jpg", altText: "Dance shirt" };
const product = (handle: string, title = handle): Product => ({
  id: `gid://shopify/Product/${handle}`,
  handle,
  title,
  description: "A comfortable shirt for dancing.",
  featuredImage: image,
  images: { nodes: [image] },
  priceRange: { minVariantPrice: money("22.00") },
  variants: {
    nodes: [
      {
        id: `${handle}-small`,
        title: "Small",
        availableForSale: true,
        price: money("22.00"),
        compareAtPrice: money("28.00"),
        image: null,
        selectedOptions: [{ name: "Size", value: "Small" }],
      },
      {
        id: `${handle}-large`,
        title: "Large",
        availableForSale: false,
        price: money("22.00"),
        compareAtPrice: null,
        image: null,
        selectedOptions: [{ name: "Size", value: "Large" }],
      },
      {
        id: `${handle}-medium`,
        title: "Medium",
        availableForSale: true,
        price: money("24.00"),
        compareAtPrice: null,
        image: null,
        selectedOptions: [{ name: "Size", value: "Medium" }],
      },
    ],
  },
});
const summary = (handle: string, title = handle): ProductSummary => ({
  id: `gid://shopify/Product/${handle}`,
  handle,
  title,
  featuredImage: image,
  priceRange: { minVariantPrice: money("22.00") },
});

function cartHook(addVariant = vi.fn().mockResolvedValue(true)) {
  vi.mocked(useCart).mockReturnValue({
    cart: null,
    isLoading: false,
    isBusy: false,
    error: null,
    notice: null,
    isOpen: false,
    setOpen: vi.fn(),
    restoreFocus: vi.fn(),
    addVariant,
    updateLine: vi.fn(),
    removeLine: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
  });
  return addVariant;
}

function renderShop() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/shop"]}>
        <Routes>
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/products/:handle" element={<ProductPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderProduct(handle = "shirt") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/shop/products/${handle}`]}>
        <Routes>
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/products/:handle" element={<ProductPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(storefront.listProducts).mockReset();
  vi.mocked(storefront.getProduct).mockReset();
  vi.mocked(isShopifyConfigured).mockReset().mockReturnValue(true);
  cartHook();
});

describe("ShopPage", () => {
  it("shows branded products with Shopify starting prices and public product URLs", async () => {
    vi.mocked(storefront.listProducts).mockResolvedValue({
      nodes: [summary("dance-shirt", "Dance Shirt")],
      pageInfo: { hasNextPage: false, endCursor: null },
    });

    renderShop();

    expect(await screen.findByRole("link", { name: /dance shirt/i })).toHaveAttribute(
      "href",
      "/shop/products/dance-shirt"
    );
    expect(screen.getByText(/\$22\.00/)).toBeInTheDocument();
  });

  it("shows a loading state and then a retryable error", async () => {
    vi.mocked(storefront.listProducts).mockRejectedValue(new Error("Storefront unavailable"));
    renderShop();

    expect(screen.getByText(/loading shop/i)).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });


  it("does not make storefront requests when configuration is missing", () => {
    vi.mocked(isShopifyConfigured).mockReturnValue(false);
    renderShop();

    expect(storefront.listProducts).not.toHaveBeenCalled();
  });

  it("loads the next product page when Load more is activated", async () => {
    vi.mocked(storefront.listProducts)
      .mockResolvedValueOnce({
        nodes: [summary("first", "First product")],
        pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
      })
      .mockResolvedValueOnce({
        nodes: [summary("second", "Second product")],
        pageInfo: { hasNextPage: false, endCursor: null },
      });
    renderShop();

    fireEvent.click(await screen.findByRole("button", { name: /load more/i }));

    expect(await screen.findByRole("link", { name: /second product/i })).toHaveAttribute(
      "href",
      "/shop/products/second"
    );
    expect(storefront.listProducts).toHaveBeenLastCalledWith("cursor-1");
  });
  it("retains loaded products when a later catalog page fails", async () => {
    vi.mocked(storefront.listProducts)
      .mockResolvedValueOnce({
        nodes: [summary("first", "First product")],
        pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
      })
      .mockRejectedValueOnce(new Error("Connection interrupted"));
    renderShop();
    await screen.findByRole("link", { name: /first product/i });
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    await screen.findByRole("alert");
    expect(screen.getByRole("link", { name: /first product/i })).toHaveAttribute("href", "/shop/products/first");
  });
});

describe("ProductPage", () => {
  it("renders product details, allows available variant selection and disables sold-out purchase", async () => {
    vi.mocked(storefront.getProduct).mockResolvedValue(product("shirt", "Dance Shirt"));
    renderProduct();

    expect(await screen.findByRole("heading", { name: "Dance Shirt" })).toBeInTheDocument();
    expect(screen.getByText("A comfortable shirt for dancing.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Dance shirt" })).toHaveAttribute("src", image.url);
    expect(screen.getByText(/\$28\.00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to shop/i })).toHaveAttribute("href", "/shop");

    expect(screen.getByRole("option", { name: /large.*sold out/i })).toBeDisabled();
  });

  it("shows missing configuration without requesting a product", () => {
    vi.mocked(isShopifyConfigured).mockReturnValue(false);
    renderProduct();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(storefront.getProduct).not.toHaveBeenCalled();
  });

  it("shows retryable loading errors and a missing-product state", async () => {
    vi.mocked(storefront.getProduct).mockRejectedValueOnce(new Error("network"));
    const { unmount } = renderProduct();
    expect(screen.getByText(/loading product/i)).toBeInTheDocument();
    expect(await screen.findByText(/couldn't load this product/i)).toBeInTheDocument();
    unmount();

    vi.mocked(storefront.getProduct).mockReset().mockResolvedValue(null);
    renderProduct("missing");
    expect(await screen.findByRole("heading", { name: /product not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse the shop/i })).toHaveAttribute("href", "/shop");
    expect(screen.queryByText(/loading product/i)).toBeNull();
  });


  it("ignores a late prior product result after the route handle changes", async () => {
    const { promise: oldResult, resolve: resolveOld } = Promise.withResolvers<Product | null>();
    vi.mocked(storefront.getProduct)
      .mockReturnValueOnce(oldResult)
      .mockResolvedValueOnce(product("new", "New product"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/shop/products/old"]}>
          <Routes>
            <Route
              path="/shop/products/:handle"
              element={
                <>
                  <Link to="/shop/products/new">Open new product</Link>
                  <ProductPage />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("link", { name: "Open new product" }));
    expect(await screen.findByRole("heading", { name: "New product" })).toBeInTheDocument();
    const variant = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(variant, { target: { value: "new-medium" } });
    expect(variant.value).toBe("new-medium");

    await act(async () => {
      resolveOld(product("old", "Old product"));
      await oldResult;
    });
    expect(screen.queryByRole("heading", { name: "Old product" })).toBeNull();
    expect(screen.getByRole("heading", { name: "New product" })).toBeInTheDocument();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("new-medium");
  });

  it("resets variant selection when the route handle changes", async () => {
    vi.mocked(storefront.getProduct)
      .mockResolvedValueOnce(product("old", "Old product"))
      .mockResolvedValueOnce(product("new", "New product"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/shop/products/old"]}>
          <Routes>
            <Route
              path="/shop/products/:handle"
              element={
                <>
                  <Link to="/shop/products/new">Open new product</Link>
                  <ProductPage />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Old product" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "old-medium" } });
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("old-medium");

    fireEvent.click(screen.getByRole("link", { name: "Open new product" }));
    expect(await screen.findByRole("heading", { name: "New product" })).toBeInTheDocument();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("new-small");
  });
});

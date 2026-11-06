import type { CatalogProduct, Product } from "../api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductPage from "./ProductPage";
import ShopPage from "./ShopPage";
import { storefront, isShopifyConfigured } from "../api/storefront";
import { useCart } from "../cart/useCart";

// Motion needs real browser layout; customer behavior stays covered in jsdom.
vi.mock("./useCatalogMotion", () => ({ useCatalogMotion: vi.fn() }));

vi.mock("../api/storefront", () => ({
  storefront: {
    listProducts: vi.fn(),
    getCollectionProducts: vi.fn(),
    listCollections: vi.fn(),
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
  priceRange: { minVariantPrice: money("22.00"), maxVariantPrice: money("22.00") },
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
const catalogItem = (handle: string, title = handle): CatalogProduct => ({
  id: `gid://shopify/Product/${handle}`,
  handle,
  title,
  featuredImage: image,
  priceRange: { minVariantPrice: money("22.00"), maxVariantPrice: money("22.00") },
  productType: "T-shirt",
  createdAt: "2026-10-01T00:00:00Z",
  availableForSale: true,
  images: [image],
  options: [],
  variants: [],
  variantsComplete: true,
});
const page = (nodes: CatalogProduct[]) => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });
const frontpage = (products: CatalogProduct[]) => ({ handle: "frontpage", title: "Home page", description: "", image: null, products });

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
  vi.mocked(storefront.listProducts).mockReset().mockResolvedValue(page([]));
  vi.mocked(storefront.getCollectionProducts).mockReset().mockResolvedValue(null);
  vi.mocked(storefront.listCollections).mockReset().mockResolvedValue([]);
  vi.mocked(storefront.getProduct).mockReset();
  vi.mocked(isShopifyConfigured).mockReset().mockReturnValue(true);
  cartHook();
});

describe("ShopPage", () => {
  it("leads the table with the merchant's Home page collection, fills it with the newest pieces, and lists the rest as new arrivals", async () => {
    const newest = ["n1", "n2", "n3", "n4", "n5", "n6"].map((handle) => catalogItem(handle, `Piece ${handle}`));
    vi.mocked(storefront.getCollectionProducts).mockResolvedValue(frontpage([catalogItem("dance-shirt", "Dance Shirt")]));
    vi.mocked(storefront.listProducts).mockResolvedValue(page([catalogItem("dance-shirt", "Dance Shirt"), ...newest]));

    renderShop();

    const table = await screen.findByRole("list", { name: "Featured and new" });
    const tableLinks = within(table).getAllByRole("link");
    expect(tableLinks[0]).toHaveAttribute("href", "/shop/products/dance-shirt");
    expect(tableLinks.map((link) => link.getAttribute("href"))).toEqual(
      ["dance-shirt", "n1", "n2", "n3", "n4"].map((handle) => `/shop/products/${handle}`));
    const arrivals = screen.getByRole("list", { name: "New arrivals" });
    expect(within(arrivals).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(
      ["/shop/products/n5", "/shop/products/n6"]);
    expect(storefront.getCollectionProducts).toHaveBeenCalledWith("frontpage");
    expect(storefront.listProducts).toHaveBeenCalledWith(undefined, "newest", 8);
  });

  it("never picks a size on the table: Add asks for one, then adds exactly the chosen size", async () => {
    const sized: CatalogProduct = {
      ...catalogItem("dance-tee", "Dance Tee"),
      options: [{ name: "Size", values: [{ name: "L", swatch: null }, { name: "S", swatch: null }] }],
      variants: [
        { id: "tee-l", availableForSale: true, selectedOptions: [{ name: "Size", value: "L" }] },
        { id: "tee-s", availableForSale: true, selectedOptions: [{ name: "Size", value: "S" }] },
      ],
    };
    const addVariant = cartHook();
    vi.mocked(storefront.getCollectionProducts).mockResolvedValue(frontpage([sized]));
    renderShop();

    const sizes = await screen.findByRole("radiogroup", { name: "Size" });
    expect(within(sizes).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["S", "L"]);
    expect(within(sizes).getAllByRole("radio").every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(addVariant).not.toHaveBeenCalled();
    expect(screen.getByText("Choose a size first.")).toHaveAttribute("role", "status");
    expect(within(sizes).getByRole("radio", { name: "S" })).toHaveFocus();

    fireEvent.click(within(sizes).getByRole("radio", { name: "L" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    await waitFor(() => expect(addVariant).toHaveBeenCalledWith("tee-l", 1));
  });

  it("shows stocked collections with their count and unstocked ones as coming soon", async () => {
    vi.mocked(storefront.listCollections).mockResolvedValue([
      { handle: "women", title: "Women", description: "", image: null, productCount: 5, hasMoreProducts: false, coverImage: image },
    ]);
    renderShop();

    const tiles = await screen.findByRole("list", { name: "Collections" });
    const women = await within(tiles).findByRole("link", { name: /women.*5 pieces/i });
    expect(women).toHaveAttribute("href", "/shop/women");
    expect(within(tiles).getByRole("link", { name: /^men.*coming soon/i })).toHaveAttribute("href", "/shop/men");
    expect(within(tiles).getByRole("link", { name: /shoes.*coming soon/i })).toHaveAttribute("href", "/shop/shoes");
  });

  it("shows a loading state and then a retryable error when no products load", async () => {
    vi.mocked(storefront.getCollectionProducts).mockRejectedValue(new Error("Storefront unavailable"));
    vi.mocked(storefront.listProducts).mockRejectedValue(new Error("Storefront unavailable"));
    renderShop();

    expect(screen.getByRole("status", { name: /loading products/i })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    vi.mocked(storefront.listProducts).mockResolvedValue(page([catalogItem("recovered", "Recovered Tee")]));
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("list", { name: "New arrivals" })).toHaveTextContent(/recovered tee/i);
  });

  it("does not make storefront requests when configuration is missing", () => {
    vi.mocked(isShopifyConfigured).mockReturnValue(false);
    renderShop();

    expect(storefront.listProducts).not.toHaveBeenCalled();
    expect(storefront.getCollectionProducts).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /shop isn't available/i })).toBeInTheDocument();
  });
});

describe("ProductPage", () => {
  it("renders product details, allows available variant selection and disables sold-out purchase", async () => {
    vi.mocked(storefront.getProduct).mockResolvedValue(product("shirt", "Dance Shirt"));
    renderProduct();

    expect(await screen.findByRole("heading", { name: "Dance Shirt" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Product details", { selector: "summary" }));
    expect(screen.getByText("A comfortable shirt for dancing.")).toBeVisible();
    expect(screen.getByRole("img", { name: "Dance shirt" })).toHaveAttribute("src", image.url);
    expect(screen.getByText("From $22.00", { selector: ".shop-product__price span" })).toBeInTheDocument();
    expect(screen.queryByText(/\$28\.00/)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Small" }));
    expect(screen.getByText(/was \$28\.00/i)).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
    expect(within(breadcrumb).getByText("Dance Shirt")).toHaveAttribute("aria-current", "page");

    expect(screen.getByRole("radio", { name: /large.*sold out/i })).toBeDisabled();
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
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    expect(screen.getByRole("radio", { name: "Medium" })).toBeChecked();

    await act(async () => {
      resolveOld(product("old", "Old product"));
      await oldResult;
    });
    expect(screen.queryByRole("heading", { name: "Old product" })).toBeNull();
    expect(screen.getByRole("heading", { name: "New product" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Medium" })).toBeChecked();
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
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    expect(screen.getByRole("radio", { name: "Medium" })).toBeChecked();

    fireEvent.click(screen.getByRole("link", { name: "Open new product" }));
    expect(await screen.findByRole("heading", { name: "New product" })).toBeInTheDocument();
    expect(within(screen.getByRole("radiogroup", { name: "Size" })).queryByRole("radio", { checked: true })).toBeNull();
  });
});

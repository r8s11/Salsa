import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogProduct, CollectionProducts } from "../api/types";
import { isShopifyConfigured, storefront } from "../api/storefront";
import { useCart } from "../cart/useCart";
import CollectionPage from "./CollectionPage";

vi.mock("../api/storefront", () => ({
  storefront: { getCollectionProducts: vi.fn(), listAllProducts: vi.fn(), getProduct: vi.fn() },
  isShopifyConfigured: vi.fn(),
}));
vi.mock("../cart/useCart", () => ({ useCart: vi.fn() }));

const money = (amount: string) => ({ amount, currencyCode: "USD" });
const image = { url: "https://cdn.example.test/item.jpg", altText: null };
function item(handle: string, title: string, productType: string, sizes: string[], price = "20.00"): CatalogProduct {
  return {
    id: handle, handle, title, featuredImage: image, priceRange: { minVariantPrice: money(price) },
    productType, createdAt: "2026-10-01T00:00:00Z", availableForSale: true, images: [image],
    options: [{ name: "Size", values: sizes.map((name) => ({ name, swatch: null })) }],
    variants: sizes.map((size) => ({ id: `${handle}-${size}`, availableForSale: true, selectedOptions: [{ name: "Size", value: size }] })),
    variantsComplete: true,
  };
}
const tank = item("tank", "Racerback Tank", "tank tops", ["S", "M"], "15.00");
const legging = item("legging", "High-Rise Legging", "Leggings", ["S", "M"], "45.00");
const women: CollectionProducts = { handle: "women", title: "Women", description: "", image: null, products: [tank, legging] };

const addVariant = vi.fn();
const setOpen = vi.fn();

function Location() {
  return <div data-testid="location">{useLocation().search}</div>;
}

function renderCollection(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/shop/:collection" element={<><CollectionPage /><Location /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(isShopifyConfigured).mockReturnValue(true);
  vi.mocked(storefront.getCollectionProducts).mockReset();
  vi.mocked(storefront.listAllProducts).mockReset();
  addVariant.mockReset().mockResolvedValue(true);
  setOpen.mockReset();
  vi.mocked(useCart).mockReturnValue({
    cart: null, isLoading: false, isBusy: false, error: null, notice: null, isOpen: false,
    setOpen, restoreFocus: vi.fn(), addVariant, updateLine: vi.fn(), removeLine: vi.fn(), refresh: vi.fn(),
  });
});

describe("CollectionPage", () => {
  it("says a collection the shop doesn't know about is not found", async () => {
    vi.mocked(storefront.getCollectionProducts).mockResolvedValue(null);
    renderCollection("/shop/summer-sale");

    expect(await screen.findByRole("heading", { name: "Collection not found" })).toBeInTheDocument();
    expect(within(screen.getByRole("status")).getByRole("link", { name: /shop all/i })).toHaveAttribute("href", "/shop/all");
  });

  it("shows an honest empty state for a named collection Shopify hasn't published", async () => {
    vi.mocked(storefront.getCollectionProducts).mockResolvedValue(null);
    renderCollection("/shop/shoes");

    expect(await screen.findByRole("heading", { name: "No shoes in the shop yet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Footwear is coming" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /shoes products/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Sort" })).toBeNull();
  });

  it("narrows results from the URL and restores them when a filter chip is removed", async () => {
    vi.mocked(storefront.getCollectionProducts).mockResolvedValue(women);
    const user = userEvent.setup();
    renderCollection("/shop/women?type=legging");

    const grid = await screen.findByRole("list", { name: "Women products" });
    expect(within(grid).getByRole("link", { name: /high-rise legging/i })).toBeInTheDocument();
    expect(within(grid).queryByRole("link", { name: /racerback tank/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Remove filter Leggings" }));
    expect(within(screen.getByRole("list", { name: "Women products" })).getByRole("link", { name: /racerback tank/i })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(/^$/);
  });

  it("offers a way out when filters match nothing", async () => {
    vi.mocked(storefront.getCollectionProducts).mockResolvedValue(women);
    const user = userEvent.setup();
    renderCollection("/shop/women?max=10");

    expect(await screen.findByRole("heading", { name: "Nothing matches these filters" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("list", { name: "Women products" })).toBeInTheDocument();
  });

  it("sorts by price from the toolbar", async () => {
    vi.mocked(storefront.getCollectionProducts).mockResolvedValue(women);
    const user = userEvent.setup();
    renderCollection("/shop/women");

    await user.selectOptions(await screen.findByRole("combobox", { name: "Sort" }), "price-desc");
    const names = within(screen.getByRole("list", { name: "Women products" })).getAllByRole("link", { name: /starting at/i }).map((link) => link.getAttribute("href"));
    expect(names).toEqual(["/shop/products/legging", "/shop/products/tank"]);
    expect(screen.getByTestId("location")).toHaveTextContent("sort=price-desc");
  });

  it("adds a size straight to the cart when size is the only choice", async () => {
    vi.mocked(storefront.getCollectionProducts).mockResolvedValue(women);
    const user = userEvent.setup();
    renderCollection("/shop/women");

    await user.click(await screen.findByRole("button", { name: "Add Racerback Tank, size M, to cart" }));
    expect(addVariant).toHaveBeenCalledWith("tank-M", 1);
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it("lists the whole catalog for the virtual 'all' handle", async () => {
    vi.mocked(storefront.listAllProducts).mockResolvedValue([tank]);
    renderCollection("/shop/all");

    expect(await screen.findByRole("list", { name: "Shop all products" })).toBeInTheDocument();
    expect(storefront.listAllProducts).toHaveBeenCalled();
    expect(storefront.getCollectionProducts).not.toHaveBeenCalled();
  });
});

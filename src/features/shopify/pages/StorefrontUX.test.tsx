import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorefrontError, storefront } from "../api/storefront";
import type * as StorefrontModule from "../api/storefront";
import type { Cart, Product } from "../api/types";
import CartProvider from "../cart/CartProvider";
import CartDrawer from "../cart/CartDrawer";
import ProductPage from "./ProductPage";
import ShopPage from "./ShopPage";

vi.mock("../api/storefront", async (original) => ({
  ...await original<typeof StorefrontModule>(),
  isShopifyConfigured: () => true,
  storefront: { listProducts: vi.fn(), getProduct: vi.fn(), getCart: vi.fn(), createCart: vi.fn(), addCartLines: vi.fn(), updateCartLines: vi.fn(), removeCartLines: vi.fn() },
}));
const money = (amount: string) => ({ amount, currencyCode: "USD" });
const front = { url: "https://images.example.test/front.jpg", altText: "Tee front", width: 720, height: 900 };
const back = { url: "https://images.example.test/back.jpg", altText: "Tee back", width: 720, height: 900 };
const item: Product = {
  id: "product-1", handle: "dance-tee", title: "Dance Tee", description: "Cotton gear for dancing.",
  featuredImage: front, images: { nodes: [front, back] }, priceRange: { minVariantPrice: money("28.00") },
  variants: { nodes: [
    { id: "small", title: "Opaque A", availableForSale: true, price: money("28.00"), compareAtPrice: money("32.00"), image: front, selectedOptions: [{ name: "Size", value: "S" }, { name: "Color", value: "Rose" }] },
    { id: "medium", title: "Opaque B", availableForSale: true, price: money("30.00"), compareAtPrice: null, image: back, selectedOptions: [{ name: "Size", value: "M" }, { name: "Color", value: "Navy" }] },
    { id: "large", title: "Opaque C", availableForSale: false, price: money("30.00"), compareAtPrice: null, image: null, selectedOptions: [{ name: "Size", value: "L" }, { name: "Color", value: "Navy" }] },
  ] },
};
function makeCart(quantity = 1): Cart {
  const amount = (28 * quantity).toFixed(2);
  return {
    id: "gid://shopify/Cart/test?key=private", checkoutUrl: "https://checkout.example.test/cart", totalQuantity: quantity,
    cost: { subtotalAmount: money(amount), totalAmount: money(amount) },
    lines: { nodes: quantity ? [{ id: "line-1", quantity, cost: { totalAmount: money(amount) }, merchandise: {
      id: "small", title: "Opaque A", availableForSale: true, image: front,
      selectedOptions: item.variants.nodes[0].selectedOptions, product: { title: item.title, handle: item.handle },
    } }] : [] },
  };
}
function renderStore(path = "/shop/products/dance-tee") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><CartProvider>
    <Routes><Route path="/shop" element={<ShopPage />} /><Route path="/shop/products/:handle" element={<ProductPage />} /></Routes>
    <CartDrawer />
  </CartProvider></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.mocked(storefront.getProduct).mockResolvedValue(item);
  vi.mocked(storefront.listProducts).mockResolvedValue({ nodes: [item], pageInfo: { hasNextPage: false, endCursor: null } });
  vi.mocked(storefront.createCart).mockResolvedValue(makeCart());
  vi.mocked(storefront.getCart).mockResolvedValue(makeCart());
});

describe("Storefront customer experience", () => {
  it("uses query-free shop metadata and a plain catalog empty state", async () => {
    vi.mocked(storefront.listProducts).mockResolvedValue({ nodes: [], pageInfo: { hasNextPage: false, endCursor: null } });
    renderStore("/shop?campaign=private");
    await screen.findByRole("heading", { name: /new gear is on its way/i });
    expect(screen.queryByRole("status", { name: /loading products/i })).toBeNull();
    expect(screen.queryByRole("list", { name: "Shop products" })).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.title).toBe("Shop | Salsa Segura");
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute("href", "https://www.salsasegura.com/shop");
  });
  it("renders a missing-image catalog card without breaking discovery", async () => {
    vi.mocked(storefront.listProducts).mockResolvedValue({ nodes: [{ ...item, featuredImage: null }], pageInfo: { hasNextPage: false, endCursor: null } });
    renderStore("/shop");
    const link = await screen.findByRole("link", { name: /dance tee.*28/i });
    expect(link).toHaveAttribute("href", "/shop/products/dance-tee");
    expect(within(link).queryByRole("img")).toBeNull();
    expect(link).toHaveTextContent(/image unavailable/i);
  });
  it("offers named Shopify options and disables unavailable combinations", async () => {
    renderStore(); await screen.findByRole("heading", { name: "Dance Tee" });
    expect(screen.getByRole("option", { name: /Size: S.*Color: Rose/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Size: L.*Color: Navy.*sold out/i })).toBeDisabled();
    expect(screen.queryByText("Opaque A")).toBeNull();
  });
  it.each(["sold-out", "no-variants"] as const)("prevents purchasing a %s product while preserving browsing", async (availability) => {
    const variants = availability === "sold-out"
      ? item.variants.nodes.map((variant) => ({ ...variant, availableForSale: false }))
      : [];
    vi.mocked(storefront.getProduct).mockResolvedValue({ ...item, variants: { nodes: variants } });
    const user = userEvent.setup();
    renderStore();
    await screen.findByRole("heading", { name: "Dance Tee" });
    const purchase = screen.getByRole("button", { name: /sold out/i });
    expect(purchase).toBeDisabled();
    await user.click(purchase);
    expect(screen.getByRole("button", { name: /open cart, 0 items/i })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /cart feedback/i })).toBeNull();
    if (availability === "sold-out") {
      for (const option of screen.getAllByRole("option")) expect(option).toBeDisabled();
    } else {
      expect(screen.queryByRole("combobox")).toBeNull();
      expect(screen.getByText(/no purchase options/i)).toBeInTheDocument();
    }
    await user.click(screen.getByRole("link", { name: /back to shop/i }));
    expect(await screen.findByRole("list", { name: /shop products/i })).toBeInTheDocument();
  });

  it.each(["add", "update"] as const)("keeps adjusted quantities and checkout available after a warning-only %s", async (operation) => {
    const warning = new StorefrontError("user", "RAW_PROVIDER_WARNING", makeCart(1), {
      warnings: [{ code: "MERCHANDISE_NOT_ENOUGH_STOCK", message: "RAW_PROVIDER_WARNING", target: "line-1" }],
      userErrors: [],
    });
    if (operation === "add") vi.mocked(storefront.createCart).mockRejectedValue(warning);
    else {
      localStorage.setItem("salsasegura:shopify-cart-id", makeCart().id);
      vi.mocked(storefront.updateCartLines).mockRejectedValue(warning);
    }
    const user = userEvent.setup();
    renderStore();
    await screen.findByRole("heading", { name: "Dance Tee" });
    if (operation === "add") {
      await user.click(screen.getByRole("button", { name: /^increase quantity$/i }));
      await user.click(screen.getByRole("button", { name: /add to cart/i }));
      expect(await screen.findByRole("status", { name: /cart feedback/i })).toHaveTextContent(/adjust|review/i);
    }
    await user.click(await screen.findByRole("button", { name: /open cart, 1 items/i }));
    const dialog = await screen.findByRole("dialog");
    if (operation === "update") await user.click(within(dialog).getByRole("button", { name: /increase quantity of/i }));
    expect(await within(dialog).findByText(/adjust.*review/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("status", { name: /^quantity of/i })).toHaveTextContent("1");
    expect(within(dialog).getByText("$28.00", { selector: ".shop-cart__line p" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /checkout with shopify/i })).toHaveAttribute("href", "https://checkout.example.test/cart");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("RAW_PROVIDER_WARNING")).toBeNull();
  });

  it("updates price, comparison and primary image when the variant changes", async () => {
    renderStore(); await screen.findByRole("heading", { name: "Dance Tee" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "medium" } });
    expect(screen.getByText("$30.00")).toBeInTheDocument();
    expect(screen.queryByText(/Was.*32/)).toBeNull();
    expect(document.querySelector(".shop-product__image")).toHaveAttribute("src", back.url);
  });
  it("provides keyboard-selectable gallery images and reserves image dimensions", async () => {
    const user = userEvent.setup(); renderStore(); await screen.findByRole("heading", { name: "Dance Tee" });
    const thumb = screen.getByRole("button", { name: /view image 2/i });
    thumb.focus(); await user.keyboard("{Enter}");
    expect(document.querySelector(".shop-product__image")).toHaveAttribute("src", back.url);
    expect(document.querySelector(".shop-product__image")).toHaveAttribute("width", "720");
    expect(thumb).toHaveAttribute("aria-pressed", "true");
  });
  it("sends the selected quantity and shows success without leaving the product", async () => {
    vi.mocked(storefront.createCart).mockImplementation(async (lines) => makeCart(lines[0].quantity));
    const user = userEvent.setup(); renderStore(); await screen.findByRole("heading", { name: "Dance Tee" });
    expect(screen.getByRole("button", { name: /decrease quantity$/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /increase quantity$/i }));
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(await screen.findByRole("status", { name: /cart feedback/i })).toHaveTextContent(/added to cart/i);
    expect(screen.getByRole("heading", { name: "Dance Tee" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /open cart, 2 items/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("status", { name: /^quantity of/i })).toHaveTextContent("2");
    expect(within(dialog).getByText("$56.00", { selector: ".shop-cart__line p" })).toBeInTheDocument();
  });
  it("announces a pending add and prevents duplicate adds", async () => {
    let resolve!: () => void;
    let creations = 0;
    const pending = new Promise<void>((done) => { resolve = done; });
    vi.mocked(storefront.createCart).mockImplementation(async () => {
      creations += 1;
      await pending;
      return makeCart(creations);
    });
    renderStore(); const add = await screen.findByRole("button", { name: /add to cart/i });
    fireEvent.click(add);
    expect(screen.getByRole("button", { name: /adding to cart/i })).toBeDisabled();
    fireEvent.click(add);
    await act(async () => resolve());
    expect(await screen.findByRole("status", { name: /cart feedback/i })).toHaveTextContent(/added to cart/i);
    fireEvent.click(screen.getByRole("button", { name: /open cart, 1 item/i }));
    expect(within(await screen.findByRole("dialog")).getByRole("status", { name: /^quantity of/i })).toHaveTextContent("1");
  });
  it("clears stale success feedback when variant changes", async () => {
    renderStore(); fireEvent.click(await screen.findByRole("button", { name: /add to cart/i }));
    await screen.findByRole("status", { name: /cart feedback/i });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "medium" } });
    expect(screen.queryByText(/added to cart/i)).toBeNull();
  });
  it("uses product metadata, query-free canonical and truthful Product data", async () => {
    renderStore("/shop/products/dance-tee?variant=private&cart=private");
    await screen.findByRole("heading", { name: "Dance Tee" });
    expect(document.title).toBe("Dance Tee | Salsa Segura");
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute("content", item.description);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute("href", "https://www.salsasegura.com/shop/products/dance-tee");
    const data = JSON.parse(document.querySelector('#shop-product-structured-data')?.textContent ?? "{}");
    expect(data["@type"]).toBe("Product"); expect(data.name).toBe(item.title);
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|review|private/);
  });
  it("does not leak arbitrary Shopify errors into customer feedback", async () => {
    vi.mocked(storefront.createCart).mockRejectedValue(new Error("token secret gid://shopify/Cart/test?key=private"));
    renderStore(); fireEvent.click(await screen.findByRole("button", { name: /add to cart/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't.*cart.*try again/i);
    expect(alert).not.toHaveTextContent(/token|secret|private|gid:\/\//i);
  });
  it("shows an empty cart with shop recovery and restores opener focus", async () => {
    const user = userEvent.setup(); renderStore("/shop");
    const opener = screen.getByRole("button", { name: /open cart/i }); await user.click(opener);
    const dialog = await screen.findByRole("dialog", { name: /your cart/i });
    expect(within(dialog).getByRole("link", { name: /browse the shop/i })).toHaveAttribute("href", "/shop");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("updates authoritative cart quantities, prevents below-one decreases, then removes", async () => {
    vi.mocked(storefront.updateCartLines).mockResolvedValueOnce(makeCart(2)).mockResolvedValueOnce(makeCart(1));
    vi.mocked(storefront.removeCartLines).mockResolvedValue(makeCart(0));
    const user = userEvent.setup(); renderStore(); await user.click(await screen.findByRole("button", { name: /add to cart/i }));
    await screen.findByRole("status", { name: /cart feedback/i });
    await user.click(screen.getByRole("button", { name: /open cart, 1 item/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /decrease quantity/i })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: /increase quantity/i }));
    await waitFor(() => expect(within(dialog).getByRole("status", { name: /^quantity of/i })).toHaveTextContent("2"));
    await user.click(within(dialog).getByRole("button", { name: /decrease quantity/i }));
    await waitFor(() => expect(within(dialog).getByRole("status", { name: /^quantity of/i })).toHaveTextContent("1"));
    await user.click(within(dialog).getByRole("button", { name: /remove/i }));
    expect(await within(dialog).findByRole("link", { name: /browse the shop/i })).toBeInTheDocument();
  });
  it("retains cart contents after a failed quantity mutation and identifies Shopify checkout", async () => {
    vi.mocked(storefront.updateCartLines).mockRejectedValue(new Error("raw cart private"));
    const user = userEvent.setup(); renderStore(); await user.click(await screen.findByRole("button", { name: /add to cart/i }));
    await screen.findByRole("status", { name: /cart feedback/i });
    await user.click(screen.getByRole("button", { name: /open cart, 1 item/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /checkout with Shopify/i })).toHaveAttribute("href", "https://checkout.example.test/cart");
    await user.click(within(dialog).getByRole("button", { name: /increase quantity/i }));
    expect(await within(dialog).findByRole("alert")).not.toHaveTextContent(/raw|private/);
    expect(within(dialog).getByRole("status", { name: /^quantity of/i })).toHaveTextContent("1");
    expect(within(dialog).queryByRole("link", { name: /checkout with Shopify/i })).toBeNull();
  });
});

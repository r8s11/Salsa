import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CartProvider from "./CartProvider";
import { useCart } from "./useCart";
import { StorefrontError } from "../api/storefront";

const api = vi.hoisted(() => ({
  getCart: vi.fn(), createCart: vi.fn(), addCartLines: vi.fn(),
  updateCartLines: vi.fn(), removeCartLines: vi.fn(),
}));
vi.mock("../api/storefront", () => ({
  isShopifyConfigured: () => true,
  storefront: api,
  StorefrontError: class extends Error {
    kind: string;
    constructor(kind: string, message: string) { super(message); this.kind = kind; }
  },
}));
const key = "salsasegura:shopify-cart-id";
const money = { amount: "24.00", currencyCode: "USD" };
const cart = {
  id: "gid://shopify/Cart/current?key=secret", checkoutUrl: "https://shop.example/checkouts/current",
  totalQuantity: 1, cost: { subtotalAmount: money, totalAmount: money },
  lines: { nodes: [{ id: "line-1", quantity: 1, cost: { totalAmount: money }, merchandise: {
    id: "variant-1", title: "Small", availableForSale: true, image: null,
    product: { title: "Dance tee", handle: "dance-tee" },
  } }] },
};
function Consumer() {
  const state = useCart();
  return <>
    <output aria-label="Cart quantity">{state.cart?.totalQuantity ?? 0}</output>
    <output aria-label="Cart status">{state.isLoading ? "loading" : "ready"}</output>
    {state.error && <p role="alert">{state.error}</p>}
    {state.notice && <p role="status">{state.notice}</p>}
    <button onClick={() => void state.addVariant("variant-1")}>Add</button>
    <button onClick={() => void state.updateLine("line-1", 2)}>Increase</button>
    <button onClick={() => void state.updateLine("line-1", 0)}>Decrease to zero</button>
    <button onClick={() => void state.removeLine("line-1")}>Remove</button>
    <button onClick={() => void state.refresh()}>Retry</button>
  </>;
}
function mount() { return render(<CartProvider><Consumer /></CartProvider>); }
async function ready() { await waitFor(() => expect(screen.getByLabelText("Cart status")).toHaveTextContent("ready")); }

beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  api.getCart.mockResolvedValue(cart);
  api.createCart.mockResolvedValue(cart);
  api.addCartLines.mockResolvedValue(cart);
  api.updateCartLines.mockResolvedValue({ ...cart, totalQuantity: 2 });
  api.removeCartLines.mockResolvedValue({ ...cart, totalQuantity: 0, lines: { nodes: [] } });
});

describe("Shopify cart session", () => {
  it("restores Shopify quantities from the persisted ID on mount", async () => {
    localStorage.setItem(key, cart.id); mount(); await ready();
    expect(screen.getByLabelText("Cart quantity")).toHaveTextContent("1");
  });
  it("creates a cart with the selected variant and persists only its ID", async () => {
    mount(); await ready(); fireEvent.click(screen.getByText("Add"));
    await waitFor(() => expect(screen.getByLabelText("Cart quantity")).toHaveTextContent("1"));
    expect(localStorage.getItem(key)).toBe(cart.id);
    expect(localStorage.length).toBe(1);
    expect(api.createCart).toHaveBeenCalledWith([{ merchandiseId: "variant-1", quantity: 1 }]);
  });
  it("uses Shopify's updated quantity and removes zero-quantity lines", async () => {
    localStorage.setItem(key, cart.id); mount(); await ready();
    fireEvent.click(screen.getByText("Increase"));
    await waitFor(() => expect(screen.getByLabelText("Cart quantity")).toHaveTextContent("2"));
    fireEvent.click(screen.getByText("Decrease to zero"));
    await waitFor(() => expect(screen.getByLabelText("Cart quantity")).toHaveTextContent("0"));
    expect(api.removeCartLines).toHaveBeenCalledWith(cart.id, ["line-1"]);
  });
  it("discards an expired cart ID and allows a fresh add", async () => {
    localStorage.setItem(key, "expired"); api.getCart.mockResolvedValue(null);
    mount(); await ready(); expect(localStorage.getItem(key)).toBeNull();
    fireEvent.click(screen.getByText("Add"));
    await waitFor(() => expect(localStorage.getItem(key)).toBe(cart.id));
    expect(screen.getByLabelText("Cart quantity")).toHaveTextContent("1");
  });
  it("does not discard a cart or create a duplicate after a restoration network failure", async () => {
    localStorage.setItem(key, cart.id); api.getCart.mockRejectedValue(new Error("Connection interrupted"));
    mount(); await ready(); expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your cart. Try again.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Connection interrupted");
    fireEvent.click(screen.getByText("Add"));
    expect(localStorage.getItem(key)).toBe(cart.id); expect(api.createCart).not.toHaveBeenCalled();
    api.getCart.mockResolvedValue(cart); fireEvent.click(screen.getByText("Retry")); await ready();
    expect(screen.getByLabelText("Cart quantity")).toHaveTextContent("1");
  });
  it("recovers an explicitly expired cart during add without reusing its line IDs", async () => {
    localStorage.setItem(key, cart.id); mount(); await ready();
    api.addCartLines.mockRejectedValue(new StorefrontError("cart-not-found", "Cart expired"));
    api.createCart.mockResolvedValue({ ...cart, id: "replacement" });
    fireEvent.click(screen.getByText("Add"));
    await waitFor(() => expect(localStorage.getItem(key)).toBe("replacement"));
    expect(screen.getByLabelText("Cart quantity")).toHaveTextContent("1");
  });
  it("keeps the existing cart when Shopify rejects an unavailable variant", async () => {
    localStorage.setItem(key, cart.id); mount(); await ready();
    api.addCartLines.mockRejectedValue(new Error("This variant is sold out"));
    fireEvent.click(screen.getByText("Add"));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't update your cart. Try again.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("sold out");
    expect(localStorage.getItem(key)).toBe(cart.id); expect(api.createCart).not.toHaveBeenCalled();
  });
  it("retains Shopify's returned cart but rejects user errors even when warnings are also present", async () => {
    localStorage.setItem(key, cart.id); mount(); await ready();
    const warning = Object.assign(new StorefrontError("user", "Only two items are available"), {
      cart: { ...cart, totalQuantity: 2 },
      userErrors: [{ code: "INVALID", message: "Only two items are available", field: ["lines"] }],
      warnings: [{ code: "MERCHANDISE_NOT_ENOUGH_STOCK", message: "Only two items are available", target: "line-1" }],
    });
    api.addCartLines.mockRejectedValue(warning);
    fireEvent.click(screen.getByText("Add"));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't update your cart. Try again.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Only two items");
    expect(screen.getByLabelText("Cart quantity")).toHaveTextContent("2");
    expect(localStorage.getItem(key)).toBe(cart.id);
  });
  it("serializes double clicks so an add is not submitted twice", async () => {
    let complete = false;
    api.createCart.mockImplementation(async () => {
      await vi.waitUntil(() => complete);
      return cart;
    });
    mount(); await ready();
    fireEvent.click(screen.getByText("Add")); fireEvent.click(screen.getByText("Add"));
    await act(async () => { complete = true; });
    await waitFor(() => expect(screen.getByLabelText("Cart quantity")).toHaveTextContent("1"));
    expect(api.createCart).toHaveBeenCalledTimes(1);
  });
});

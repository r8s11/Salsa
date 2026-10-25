/// <reference lib="es2024.promise" />
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import CartProvider from "./CartProvider";
import CartDrawer from "./CartDrawer";
import { useCart } from "./useCart";

const { getCart, updateCartLines, removeCartLines } = vi.hoisted(() => ({
  getCart: vi.fn(), updateCartLines: vi.fn(), removeCartLines: vi.fn(),
}));
vi.mock("../api/storefront", () => ({
  isShopifyConfigured: () => true,
  storefront: { getCart, updateCartLines, removeCartLines },
  StorefrontError: class extends Error {},
}));
const amount = { amount: "24.00", currencyCode: "USD" };
const cart = {
  id: "cart-1", checkoutUrl: "https://shop.example/checkouts/verified",
  totalQuantity: 1, cost: { subtotalAmount: amount, totalAmount: amount },
  lines: { nodes: [{ id: "line-1", quantity: 1, cost: { totalAmount: amount }, merchandise: {
    id: "variant-1", title: "Small", availableForSale: true, image: null,
    product: { title: "Dance tee", handle: "dance-tee" },
  } }] },
};
function CartAccess() {
  const { setOpen } = useCart();
  return <button onClick={() => setOpen(true)}>Open cart</button>;
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); localStorage.setItem("salsasegura:shopify-cart-id", cart.id);
  getCart.mockResolvedValue(cart);
  removeCartLines.mockResolvedValue({ ...cart, totalQuantity: 0, lines: { nodes: [] } });
  updateCartLines.mockResolvedValue({ ...cart, totalQuantity: 2, lines: { nodes: [{ ...cart.lines.nodes[0], quantity: 2 }] } });
});

it("uses Shopify checkout URL and restores focus after Escape", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><CartProvider><CartAccess /><CartDrawer /></CartProvider></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Open cart" }));
  expect(await screen.findByRole("dialog", { name: "Your cart" })).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "Checkout with Shopify" })).toHaveAttribute("href", cart.checkoutUrl);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Open cart" })).toHaveFocus();
});

it("allows quantity changes and removal in the drawer", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><CartProvider><CartAccess /><CartDrawer /></CartProvider></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Open cart" }));
  expect(screen.getByRole("button", { name: "Decrease quantity of Dance tee, Small" })).toBeDisabled();
  await user.click(await screen.findByRole("button", { name: "Increase quantity of Dance tee, Small" }));
  await waitFor(() => expect(screen.getByLabelText("Quantity of Dance tee, Small")).toHaveTextContent("2"));
  await user.click(screen.getByRole("button", { name: "Remove Dance tee, Small" }));
  expect(await screen.findByText("Your cart is ready for the first dance.")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Checkout with Shopify" })).not.toBeInTheDocument();
});
it("shows a first-dance empty state that closes when browsing the shop", async () => {
  const user = userEvent.setup();
  getCart.mockResolvedValue({ ...cart, totalQuantity: 0, lines: { nodes: [] } });
  render(<MemoryRouter><CartProvider><CartAccess /><CartDrawer /></CartProvider></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Open cart" }));
  expect(await screen.findByText("Your cart is ready for the first dance.")).toBeInTheDocument();
  const browse = screen.getByRole("link", { name: "Browse the shop" });
  expect(browse).toHaveAttribute("href", "/shop");
  await user.click(browse);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("does not expose checkout for an unsafe URL", async () => {
  const user = userEvent.setup();
  getCart.mockResolvedValue({ ...cart, checkoutUrl: "javascript:alert(1)" });
  render(<MemoryRouter><CartProvider><CartAccess /><CartDrawer /></CartProvider></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Open cart" }));
  expect(await screen.findByRole("dialog", { name: "Your cart" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Checkout with Shopify" })).not.toBeInTheDocument();
});
it("locks controls and keeps server quantities while a mutation is pending", async () => {
  const user = userEvent.setup();
  let resolveUpdate: ((value: typeof cart) => void) | undefined;
  getCart.mockResolvedValue({ ...cart, totalQuantity: 2, lines: { nodes: [{ ...cart.lines.nodes[0], quantity: 2 }] } });
  updateCartLines.mockImplementation(() => new Promise((resolve) => { resolveUpdate = resolve; }));
  render(<MemoryRouter><CartProvider><CartAccess /><CartDrawer /></CartProvider></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Open cart" }));
  const increase = await screen.findByRole("button", { name: "Increase quantity of Dance tee, Small" });
  await user.click(increase);
  expect(await screen.findByText("Updating your cart…")).toBeInTheDocument();
  expect(screen.getByLabelText("Quantity of Dance tee, Small")).toHaveTextContent("2");
  expect(screen.getByRole("button", { name: "Decrease quantity of Dance tee, Small" })).toBeDisabled();
  expect(increase).toBeDisabled();
  expect(screen.getByRole("button", { name: "Remove Dance tee, Small" })).toBeDisabled();
  expect(screen.queryByRole("link", { name: "Checkout with Shopify" })).not.toBeInTheDocument();
  resolveUpdate?.({ ...cart, totalQuantity: 3, lines: { nodes: [{ ...cart.lines.nodes[0], quantity: 3 }] } });
  await waitFor(() => expect(screen.getByLabelText("Quantity of Dance tee, Small")).toHaveTextContent("3"));
});
it("does not restore focus to a removed opener after product navigation", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><CartProvider><Routes>
    <Route path="/" element={<CartAccess />} />
    <Route path="/shop/products/:handle" element={<p>Product page</p>} />
  </Routes><CartDrawer /></CartProvider></MemoryRouter>);
  const opener = screen.getByRole("button", { name: "Open cart" });
  await user.click(opener);
  await user.click(await screen.findByRole("link", { name: "Dance tee" }));
  expect(await screen.findByText("Product page")).toBeInTheDocument();
  expect(opener).not.toHaveFocus();
});

async function openDrawer(user: UserEvent) {
  render(<MemoryRouter><CartProvider><CartAccess /><CartDrawer /></CartProvider></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Open cart" }));
  await screen.findByRole("link", { name: "Checkout with Shopify" });
}

const secondLine = {
  ...cart.lines.nodes[0], id: "line-2",
  merchandise: {
    ...cart.lines.nodes[0].merchandise, id: "variant-2", title: "Medium",
    product: { title: "Dance hoodie", handle: "dance-hoodie" },
  },
};

it.each([
  ["Increase", 4],
  ["Decrease", 2],
] as const)("keeps %s focus on the same variant when Shopify replaces its line ID", async (action, quantity) => {
  const user = userEvent.setup();
  getCart.mockResolvedValue({ ...cart, totalQuantity: 3, lines: { nodes: [{ ...cart.lines.nodes[0], quantity: 3 }] } });
  const { promise, resolve: resolveUpdate } = Promise.withResolvers<typeof cart>();
  updateCartLines.mockReturnValue(promise);
  await openDrawer(user);
  screen.getByRole("button", { name: `${action} quantity of Dance tee, Small` }).focus();
  await user.keyboard("{Enter}");
  await screen.findByText("Updating your cart…");
  await act(async () => resolveUpdate({
    ...cart, totalQuantity: quantity,
    lines: { nodes: [{ ...cart.lines.nodes[0], id: "replacement-line", quantity }] },
  }));
  expect(screen.getByLabelText("Quantity of Dance tee, Small")).toHaveTextContent(String(quantity));
  expect(screen.getByRole("button", { name: `${action} quantity of Dance tee, Small` })).toHaveFocus();
});

it("moves decrease focus to the same item's increase control at minimum quantity", async () => {
  const user = userEvent.setup();
  getCart.mockResolvedValue({ ...cart, totalQuantity: 2, lines: { nodes: [{ ...cart.lines.nodes[0], quantity: 2 }] } });
  updateCartLines.mockResolvedValue(cart);
  await openDrawer(user);
  screen.getByRole("button", { name: "Decrease quantity of Dance tee, Small" }).focus();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(screen.getByLabelText("Quantity of Dance tee, Small")).toHaveTextContent("1"));
  expect(screen.getByRole("button", { name: "Decrease quantity of Dance tee, Small" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Increase quantity of Dance tee, Small" })).toHaveFocus();
});

it.each([
  ["Dance tee, Small", "Dance hoodie, Medium", secondLine],
  ["Dance hoodie, Medium", "Dance tee, Small", cart.lines.nodes[0]],
])("moves removal focus from %s to the surviving item's quantity controls", async (removed, survivor, line) => {
  const user = userEvent.setup();
  getCart.mockResolvedValue({
    ...cart, totalQuantity: 2,
    cost: { subtotalAmount: { ...amount, amount: "48.00" }, totalAmount: { ...amount, amount: "48.00" } },
    lines: { nodes: [cart.lines.nodes[0], secondLine] },
  });
  removeCartLines.mockResolvedValue({ ...cart, lines: { nodes: [line] } });
  await openDrawer(user);
  screen.getByRole("button", { name: `Remove ${removed}` }).focus();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(screen.queryByRole("button", { name: `Remove ${removed}` })).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: `Increase quantity of ${survivor}` })).toHaveFocus();
});

it("focuses Browse the shop when the last cart line is removed", async () => {
  const user = userEvent.setup();
  await openDrawer(user);
  screen.getByRole("button", { name: "Remove Dance tee, Small" }).focus();
  await user.keyboard("{Enter}");
  expect(await screen.findByRole("link", { name: "Browse the shop" })).toHaveFocus();
});

it("returns focus to the initiating control when a quantity mutation fails", async () => {
  const user = userEvent.setup();
  const { promise, reject: rejectUpdate } = Promise.withResolvers<typeof cart>();
  updateCartLines.mockReturnValue(promise);
  await openDrawer(user);
  const increase = screen.getByRole("button", { name: "Increase quantity of Dance tee, Small" });
  increase.focus();
  await user.keyboard("{Enter}");
  await screen.findByText("Updating your cart…");
  await act(async () => rejectUpdate(new Error("Network unavailable")));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(increase).toHaveFocus();
  expect(screen.getByLabelText("Quantity of Dance tee, Small")).toHaveTextContent("1");
});

it("does not steal focus when the user tabs away during a quantity mutation", async () => {
  const user = userEvent.setup();
  const { promise, resolve: resolveUpdate } = Promise.withResolvers<typeof cart>();
  updateCartLines.mockReturnValue(promise);
  await openDrawer(user);
  screen.getByRole("button", { name: "Increase quantity of Dance tee, Small" }).focus();
  await user.keyboard("{Enter}");
  await screen.findByText("Updating your cart…");
  await user.tab({ shift: true });
  const productLink = screen.getByRole("link", { name: "Dance tee" });
  expect(productLink).toHaveFocus();
  await act(async () => resolveUpdate({ ...cart, totalQuantity: 2, lines: { nodes: [{ ...cart.lines.nodes[0], quantity: 2 }] } }));
  expect(productLink).toHaveFocus();
});

it("keeps Escape opener restoration when a pending quantity mutation finishes", async () => {
  const user = userEvent.setup();
  const { promise, resolve: resolveUpdate } = Promise.withResolvers<typeof cart>();
  updateCartLines.mockReturnValue(promise);
  await openDrawer(user);
  screen.getByRole("button", { name: "Increase quantity of Dance tee, Small" }).focus();
  await user.keyboard("{Enter}");
  await screen.findByText("Updating your cart…");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Open cart" })).toHaveFocus();
  await act(async () => resolveUpdate({ ...cart, totalQuantity: 2, lines: { nodes: [{ ...cart.lines.nodes[0], quantity: 2 }] } }));
  expect(screen.getByRole("button", { name: "Open cart" })).toHaveFocus();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "./providers";
import App from "./App";

vi.mock("../lib/supabase", () => ({
  supabase: { auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  } },
  supabaseAuthStorageKey: "sb-salsa-test-auth-token",
}));
vi.mock("../features/shopify/api/storefront", () => ({
  isShopifyConfigured: () => false, storefront: {}, StorefrontError: class extends Error {},
}));
beforeEach(() => { window.history.replaceState({}, "", "/"); localStorage.clear(); });

it("allows an anonymous visitor to open /shop inside the public layout", async () => {
  window.history.replaceState({}, "", "/shop");
  render(<Providers><App /></Providers>);
  expect(await screen.findByRole("heading", { name: "Salsa Segura shop" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/shop");
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /^Shop$/ })).toHaveAttribute("href", "/shop");
});

it("keeps product deep links public without Shopify configuration", async () => {
  window.history.replaceState({}, "", "/shop/products/dance-tee");
  render(<Providers><App /></Providers>);
  expect(await screen.findByRole("link", { name: "Back to shop" })).toHaveAttribute("href", "/shop");
  expect(window.location.pathname).toBe("/shop/products/dance-tee");
  expect(screen.queryByRole("heading", { name: /sign in/i })).not.toBeInTheDocument();
});

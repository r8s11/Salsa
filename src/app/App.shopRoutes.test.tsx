import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Providers } from "./providers";
import App from "./App";

// Route access uses jsdom; motion is verified against real browser layout.
vi.mock("../features/shopify/pages/useCatalogMotion", () => ({ useCatalogMotion: vi.fn() }));

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
  expect(window.location.pathname).toBe("/shop");
  const nav = await screen.findByRole("navigation", { name: "Main navigation" });
  expect(within(nav).getByRole("link", { name: /^Shop$/ })).toHaveAttribute("href", "/shop");
});

it("keeps product deep links public without Shopify configuration", async () => {
  window.history.replaceState({}, "", "/shop/products/dance-tee");
  render(<Providers><App /></Providers>);
  const breadcrumb = await screen.findByRole("navigation", { name: "Breadcrumb" });
  expect(within(breadcrumb).getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
  expect(window.location.pathname).toBe("/shop/products/dance-tee");
  expect(screen.queryByRole("heading", { name: /sign in/i })).not.toBeInTheDocument();
});

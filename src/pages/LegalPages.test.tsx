import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "../app/providers";
import App from "../app/App";

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
  supabaseAuthStorageKey: "sb-salsa-test-auth-token",
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

describe.each([
  ["/privacy", "Privacy Policy"],
  ["/data-deletion", "Delete your data"],
])("public %s route", (path, heading) => {
  it("renders for an anonymous visitor without redirecting", async () => {
    window.history.replaceState({}, "", path);
    render(
      <Providers>
        <App />
      </Providers>
    );

    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(window.location.pathname).toBe(path);
  });
});

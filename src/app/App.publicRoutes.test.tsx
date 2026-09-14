import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "./providers";
import App from "./App";

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
  supabaseAuthStorageKey: "sb-salsa-test-auth-token",
}));

vi.mock("../pages/SubmitEventPage", () => ({
  default: () => <main>Public submission route</main>,
}));

function renderAtSubmit() {
  window.history.replaceState({}, "", "/submit");
  return render(
    <Providers>
      <App />
    </Providers>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("public /submit route", () => {
  it("renders the submission page without redirecting an anonymous visitor", async () => {
    renderAtSubmit();

    expect(await screen.findByText("Public submission route")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/submit");
    expect(screen.queryByText(/sign in page/i)).not.toBeInTheDocument();
  });

  it("keeps the route public while the auth session is resolving", async () => {
    renderAtSubmit();

    expect(await screen.findByText("Public submission route")).toBeInTheDocument();
    expect(window.location.pathname).not.toBe("/signin");
  });
});

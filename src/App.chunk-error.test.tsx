import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { Providers } from "./app/providers";

vi.mock("./components/Auth/RequireAdmin", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./components/Auth/RequireReviewer", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./layouts/AdminLayout", () => {
  throw new TypeError("Failed to fetch dynamically imported module");
});

describe("App lazy route recovery", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/admin/events");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("shows a recovery action when a deployed route chunk is unavailable", async () => {
    render(
      <Providers>
        <App />
      </Providers>
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The app was updated while this page was open."
    );
    expect(screen.getByRole("button", { name: "Refresh app" })).toBeInTheDocument();
  });
});

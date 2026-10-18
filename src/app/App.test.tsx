import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import App from "./App";
import { Providers } from "./providers";

const renderApp = () =>
  render(
    <Providers>
      <App />
    </Providers>
  );

describe("App", () => {
  it("renders header with site name", () => {
    renderApp();
    const logo = within(screen.getByRole("banner")).getByRole("link", { name: /Salsa Segura/i });
    expect(logo).toHaveAttribute("href", "/");
  });
});

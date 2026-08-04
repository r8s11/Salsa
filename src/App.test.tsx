import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { Providers } from "./app/providers";

const renderApp = () =>
  render(
    <Providers>
      <App />
    </Providers>
  );

describe("App", () => {
  it("renders without crashing", () => {
    renderApp();
    expect(document.body).toBeInTheDocument();
  });

  it("renders header with site name", () => {
    renderApp();
    const logo = screen.getByRole("link", { name: /Salsa Segura/i });
    expect(logo).toBeInTheDocument();
  });
});

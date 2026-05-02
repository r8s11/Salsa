import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { CityProvider } from "./contexts/CityContext";

const renderApp = () =>
  render(
    <CityProvider>
      <App />
    </CityProvider>
  );

describe("App", () => {
  it("renders without crashing", () => {
    renderApp();
    expect(document.body).toBeInTheDocument();
  });

  it("renders header with site name", () => {
    renderApp();
    const logo = screen.getByRole("link", { name: /💃Salsa Segura🕺/i });
    expect(logo).toBeInTheDocument();
  });
});

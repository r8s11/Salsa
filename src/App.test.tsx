import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(document.body).toBeInTheDocument();
  });

  it("renders header with site name", () => {
    render(<App />);
    const logo = screen.getByRole("link", { name: /💃Salsa Segura🕺/i });
    expect(logo).toBeInTheDocument();
  });
});

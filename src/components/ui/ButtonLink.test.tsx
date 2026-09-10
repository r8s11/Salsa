import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import ButtonLink from "./ButtonLink";

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("ButtonLink", () => {
  describe("internal link (to)", () => {
    it("renders as Link with primary variant", () => {
      render(<ButtonLink to="/submit">Submit</ButtonLink>, { wrapper });
      const link = screen.getByRole("link", { name: "Submit" });
      expect(link).toHaveClass("ui-button", "ui-button--primary");
      expect(link).toHaveAttribute("href", "/submit");
    });

    it("renders secondary variant", () => {
      render(<ButtonLink to="/events" variant="secondary">Events</ButtonLink>, { wrapper });
      expect(screen.getByRole("link")).toHaveClass("ui-button--secondary");
    });

    it("renders ghost variant", () => {
      render(<ButtonLink to="/about" variant="ghost">About</ButtonLink>, { wrapper });
      expect(screen.getByRole("link")).toHaveClass("ui-button--ghost");
    });

    it("renders danger variant", () => {
      render(<ButtonLink to="/delete" variant="danger">Delete</ButtonLink>, { wrapper });
      expect(screen.getByRole("link")).toHaveClass("ui-button--danger");
    });

    it("renders compact size", () => {
      render(<ButtonLink to="/submit" size="compact">Submit</ButtonLink>, { wrapper });
      expect(screen.getByRole("link")).toHaveClass("ui-button--compact");
    });

    it("renders block mode", () => {
      render(<ButtonLink to="/submit" block>Submit</ButtonLink>, { wrapper });
      expect(screen.getByRole("link")).toHaveClass("ui-button--block");
    });

    it("merges custom className", () => {
      render(<ButtonLink to="/submit" className="custom">Submit</ButtonLink>, { wrapper });
      expect(screen.getByRole("link")).toHaveClass("ui-button", "ui-button--primary", "custom");
    });
  });

  describe("external link (href)", () => {
    it("renders as anchor with primary variant", () => {
      render(<ButtonLink href="https://example.com" variant="primary">External</ButtonLink>);
      const link = screen.getByRole("link", { name: "External" });
      expect(link).toHaveClass("ui-button", "ui-button--primary");
      expect(link).toHaveAttribute("href", "https://example.com");
    });

    it("renders secondary variant", () => {
      render(<ButtonLink href="https://example.com" variant="secondary">External</ButtonLink>);
      expect(screen.getByRole("link")).toHaveClass("ui-button--secondary");
    });

    it("sets target and rel for external links", () => {
      render(<ButtonLink href="https://example.com" external>External</ButtonLink>);
      const link = screen.getByRole("link", { name: "External" });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });
});

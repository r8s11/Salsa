import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Button from "./Button";

describe("Button", () => {
  it("renders with default primary variant and type=button", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toHaveClass("ui-button", "ui-button--primary");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("renders secondary variant", () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-button--secondary");
  });

  it("renders ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-button--ghost");
  });

  it("renders danger variant", () => {
    render(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-button--danger");
  });

  it("renders compact size", () => {
    render(<Button size="compact">Compact</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-button--compact");
  });

  it("renders block mode", () => {
    render(<Button block>Full width</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-button--block");
  });

  it("defaults to type=button", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("allows overriding type", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("shows spinner and loading label when loading", () => {
    render(<Button loading loadingLabel="Saving...">Save</Button>);
    const btn = screen.getByRole("button", { name: "Saving..." });
    expect(btn).toHaveClass("ui-button--loading");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn.querySelector(".ui-button__spinner")).toBeInTheDocument();
  });

  it("shows children when not loading", () => {
    render(<Button loading={false}>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("disables button when loading", () => {
    render(<Button loading loadingLabel="Saving...">Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("respects disabled prop", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("merges custom className", () => {
    render(<Button className="my-class">Custom</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-button", "ui-button--primary", "my-class");
  });

  it("forwards ref", () => {
    const ref = { current: null };
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

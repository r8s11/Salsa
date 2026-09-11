import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import IconButton from "./IconButton";

describe("IconButton", () => {
  it("renders with accessible name", () => {
    render(
      <IconButton aria-label="Close">
        <span>X</span>
      </IconButton>
    );
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("defaults to type='button'", () => {
    render(
      <IconButton aria-label="Action">
        <span>+</span>
      </IconButton>
    );
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("applies ghost variant by default", () => {
    render(
      <IconButton aria-label="Test">
        <span>Icon</span>
      </IconButton>
    );
    expect(screen.getByRole("button")).toHaveClass("ui-icon-button", "ui-icon-button--ghost");
  });

  it("applies outline variant class", () => {
    render(
      <IconButton variant="outline" aria-label="Test">
        <span>Icon</span>
      </IconButton>
    );
    expect(screen.getByRole("button")).toHaveClass("ui-icon-button--outline");
  });

  it("applies danger variant class", () => {
    render(
      <IconButton variant="danger" aria-label="Delete">
        <span>Trash</span>
      </IconButton>
    );
    expect(screen.getByRole("button")).toHaveClass("ui-icon-button--danger");
  });

  it("is disabled when disabled prop is true", () => {
    render(
      <IconButton disabled aria-label="Locked">
        <span>Lock</span>
      </IconButton>
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onClick when not disabled", () => {
    const onClick = vi.fn();
    render(
      <IconButton onClick={onClick} aria-label="Click me">
        <span>Go</span>
      </IconButton>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <IconButton disabled onClick={onClick} aria-label="Locked">
        <span>Lock</span>
      </IconButton>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("merges custom className", () => {
    render(
      <IconButton className="custom" aria-label="Test">
        <span>Icon</span>
      </IconButton>
    );
    expect(screen.getByRole("button")).toHaveClass("ui-icon-button", "custom");
  });

  it("accepts explicit type='submit'", () => {
    render(
      <IconButton type="submit" aria-label="Submit">
        <span>OK</span>
      </IconButton>
    );
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});

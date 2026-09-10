import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SuccessCard from "./SuccessCard";

describe("SuccessCard", () => {
  it("hides the decorative emoji from the accessibility tree and exposes the heading text", () => {
    render(<SuccessCard onReset={vi.fn()} />);
    const heading = screen.getByRole("heading", { name: "Event Submitted!" });
    expect(heading).toHaveAccessibleName("Event Submitted!");
    expect(heading.querySelector("[aria-hidden='true']")).toHaveTextContent("🎉");
  });

  it("calls onReset when the CTA is clicked", () => {
    const onReset = vi.fn();
    render(<SuccessCard onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit Another Event" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

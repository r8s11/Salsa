import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SuccessCard from "./SuccessCard";

describe("SuccessCard", () => {
  it("hides the decorative icon from the accessibility tree and exposes the heading text", () => {
    render(<SuccessCard onReset={vi.fn()} />);
    const heading = screen.getByRole("heading", { name: "Event Submitted!" });
    expect(heading).toHaveAccessibleName("Event Submitted!");
    expect(heading.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
  });

  it("calls onReset when the CTA is clicked", () => {
    const onReset = vi.fn();
    render(<SuccessCard onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit Another Event" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("shows the links exactly as submitted, read-only, and nothing when there were none", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const { rerender } = render(
      <SuccessCard
        onReset={vi.fn()}
        links={{
          venue: {
            candidate: { name: "Rhythm Hall" },
            state: "MATCHED",
            matches: [{ id, name: "Rhythm Hall" }],
            decision: "existing",
            selected_id: id,
          },
          organizer: {
            candidate: { name: "Casa Nueva" },
            state: "NEW",
            matches: [],
            decision: "new",
            selected_id: null,
          },
          instructors: [],
          school: null,
        }}
      />
    );
    expect(screen.getByRole("heading", { name: "Sent with your event" })).toBeInTheDocument();
    expect(screen.getByText("Existing — will be linked")).toBeInTheDocument();
    expect(screen.getByText("Suggested new — moderator reviews")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /link/i })).not.toBeInTheDocument();

    rerender(<SuccessCard onReset={vi.fn()} links={null} />);
    expect(screen.queryByRole("heading", { name: "Sent with your event" })).not.toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CalendarSidebar from "./CalendarSidebar";

const baseProps = {
  periodLabel: "Aug 31 – Sep 6, 2026",
  typeOptions: [
    { value: "social" as const, label: "Social", count: 2 },
    { value: "class" as const, label: "Class", count: 1 },
    { value: "workshop" as const, label: "Workshop", count: 0 },
  ],
  typeFilter: "all" as const,
  onTypeFilterChange: vi.fn(),
  styleOptions: ["Bachata", "Salsa"],
  styleFilter: "all",
  onStyleFilterChange: vi.fn(),
  eventCountLabel: "3 events this week",
};

describe("CalendarSidebar", () => {
  it("renders the period label", () => {
    render(<CalendarSidebar {...baseProps} />);
    expect(screen.getByText("Aug 31 – Sep 6, 2026")).toBeInTheDocument();
  });

  it("renders type rows with counts and the What's on group", () => {
    render(<CalendarSidebar {...baseProps} />);
    const group = screen.getByRole("group", { name: "What's on" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Social 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Class 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workshop 0" })).toBeInTheDocument();
  });

  it("marks every type row pressed when the filter is 'all'", () => {
    render(<CalendarSidebar {...baseProps} />);
    expect(screen.getByRole("button", { name: "Social 2" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Class 1" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("marks only the selected type row pressed for a specific filter", () => {
    render(<CalendarSidebar {...baseProps} typeFilter="social" />);
    expect(screen.getByRole("button", { name: "Social 2" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Class 1" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("toggles a selected type row back to 'all'", async () => {
    const onTypeFilterChange = vi.fn();
    const { rerender } = render(
      <CalendarSidebar {...baseProps} typeFilter="social" onTypeFilterChange={onTypeFilterChange} />
    );
    screen.getByRole("button", { name: "Social 2" }).click();
    expect(onTypeFilterChange).toHaveBeenCalledWith("all");

    onTypeFilterChange.mockClear();
    rerender(<CalendarSidebar {...baseProps} typeFilter="all" onTypeFilterChange={onTypeFilterChange} />);
    screen.getByRole("button", { name: "Class 1" }).click();
    expect(onTypeFilterChange).toHaveBeenCalledWith("class");
  });

  it("renders single-select dance style rows including Every style", () => {
    render(<CalendarSidebar {...baseProps} styleFilter="Salsa" />);
    expect(screen.getByRole("group", { name: "Dance style" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Every style" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Salsa" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bachata" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("hides the Dance Style group when there are no style options", () => {
    render(<CalendarSidebar {...baseProps} styleOptions={[]} />);
    expect(screen.queryByRole("group", { name: "Dance style" })).not.toBeInTheDocument();
  });

  it("renders the event-count footer", () => {
    render(<CalendarSidebar {...baseProps} />);
    expect(screen.getByText("3 events this week")).toBeInTheDocument();
  });
});

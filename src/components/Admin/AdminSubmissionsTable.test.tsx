import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type EventSubmission } from "../../../features/admin/model/submissions";
import AdminSubmissionsTable from "./AdminSubmissionsTable";

const submissions: EventSubmission[] = [
  {
    id: "sub-1",
    status: "pending",
    submitted_at: "2026-08-01T10:00:00.000Z",
    submitter_name: "Alice",
    submitter_email: "alice@example.com",
    submitted_data: { title: "Social Dance" },
  },
  {
    id: "sub-2",
    status: "approved",
    submitted_at: "2026-08-02T12:00:00.000Z",
    submitter_name: "Bob",
    submitter_email: "bob@example.com",
    submitted_data: { title: "Salsa Night" },
  },
];

function renderTable(overrides: Partial<ComponentProps<typeof AdminSubmissionsTable>> = {}) {
  const onAction = vi.fn();
  const utils = render(
    <AdminSubmissionsTable 
      submissions={submissions}
      onAction={onAction}
      {...overrides}
    />
  );
  return { ...utils, onAction };
}

describe("AdminSubmissionsTable", () => {
  it("renders the table with submissions", () => {
    renderTable();
    expect(screen.getByText("Social Dance")).toBeInTheDocument();
    expect(screen.getByText("Salsa Night")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("calls onAction when an action is selected", async () => {
    const user = userEvent.setup();
    const { onAction } = renderTable();
    
    const rows = screen.getAllByRole("row");
    const firstRow = rows[1];
    const actionMenu = within(firstRow).getByRole("button", { name: /actions for social dance/i });
    
    await user.click(actionMenu);
    
    const approveBtn = screen.getByRole("menuitem", { name: /approve/i });
    await user.click(approveBtn);
    
    expect(onAction).toHaveBeenCalledWith("approve", submissions[0]);
  });

  it("renders error message if provided", () => {
    renderTable({ error: "Failed to load submissions" });
    expect(screen.getByText("Failed to load submissions")).toBeInTheDocument();
  });

  it("applies busy class when busy is true", () => {
    renderTable({ busy: true });
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveClass("busy");
  });
});

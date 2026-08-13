import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EventSubmission } from "../../features/admin/model/submissions";
import AdminSubmissionsTable from "./AdminSubmissionsTable";

function makeSubmission(overrides: Partial<EventSubmission> = {}): EventSubmission {
  return {
    id: "sub-1",
    submitter_id: "user-1",
    submitter_email: "alice@example.com",
    submitter_name: "Alice",
    status: "pending",
    submitted_data: { title: "Social Dance" },
    edited_data: null,
    submitted_at: "2026-08-01T10:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    rejection_message: null,
    internal_note: null,
    duplicate_of_event_id: null,
    dismissed_duplicate_ids: [],
    approved_event_id: null,
    created_at: "2026-08-01T10:00:00.000Z",
    updated_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

const submissions: EventSubmission[] = [
  makeSubmission(),
  makeSubmission({
    id: "sub-2",
    status: "approved",
    submitter_name: "Bob",
    submitter_email: "bob@example.com",
    submitted_at: "2026-08-02T12:00:00.000Z",
    submitted_data: { title: "Salsa Night" },
  }),
];

function renderTable(overrides: Partial<ComponentProps<typeof AdminSubmissionsTable>> = {}) {
  const onAction = vi.fn();
  const utils = render(
    <AdminSubmissionsTable submissions={submissions} onAction={onAction} {...overrides} />,
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
    await user.click(screen.getByRole("menuitem", { name: /approve/i }));

    expect(onAction).toHaveBeenCalledWith("approve", submissions[0]);
  });

  it("renders error message if provided", () => {
    renderTable({ error: "Failed to load submissions" });
    expect(screen.getByText("Failed to load submissions")).toBeInTheDocument();
  });
});

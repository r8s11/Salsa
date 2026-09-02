import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminSubmissionsPage from "./AdminSubmissionsPage";
import { useAdminSubmissions } from "../../hooks/useAdminSubmissions";
import type { EventSubmission } from "../../features/admin/model/submissions";

vi.mock("../../hooks/useAdminSubmissions");

const pendingSubmission: EventSubmission = {
  id: "submission-pending",
  submitter_id: "user-pending",
  submitter_email: "pending@example.com",
  submitter_name: "Pending Dancer",
  status: "pending",
  submitted_data: { title: "Pending Social" },
  edited_data: null,
  submitted_at: "2026-08-13T10:00:00Z",
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  rejection_message: null,
  internal_note: null,
  duplicate_of_event_id: null,
  dismissed_duplicate_ids: [],
  approved_event_id: null,
  created_at: "2026-08-13T10:00:00Z",
  updated_at: "2026-08-13T10:00:00Z",
};

const mockSubmissions: EventSubmission[] = [
  pendingSubmission,
  {
    ...pendingSubmission,
    id: "submission-review",
    submitter_id: "user-review",
    submitter_email: "review@example.com",
    submitter_name: "Review Dancer",
    status: "in_review",
    submitted_data: { title: "Review Workshop" },
  },
  {
    ...pendingSubmission,
    id: "submission-information",
    submitter_id: "user-information",
    submitter_email: "information@example.com",
    submitter_name: "Information Dancer",
    status: "needs_information",
    submitted_data: { title: "Incomplete Class" },
  },
];

describe("AdminSubmissionsPage", () => {
  beforeEach(() => {
    (useAdminSubmissions as Mock).mockReturnValue({
      submissions: mockSubmissions,
      isLoading: false,
      error: null,
      updateSubmission: vi.fn(),
      isUpdating: false,
      updateError: null,
    });
  });

  it("renders the table and filters", async () => {
    render(
      <MemoryRouter>
        <AdminSubmissionsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Submissions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
  });

  it("prioritizes active review states and filters the queue from its tabs", async () => {
    render(
      <MemoryRouter>
        <AdminSubmissionsPage />
      </MemoryRouter>
    );

    const queue = screen.getByRole("tablist", { name: "Submission review queue" });
    expect(within(queue).getByRole("tab", { name: /Pending 1/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(queue).getByRole("tab", { name: /In Review 1/i })).toBeVisible();
    expect(within(queue).getByRole("tab", { name: /Needs Information 1/i })).toBeVisible();
    expect(within(queue).getByRole("tab", { name: /All 3/i })).toBeVisible();
    expect(screen.getByText("Pending Social")).toBeVisible();
    expect(screen.queryByText("Review Workshop")).not.toBeInTheDocument();

    await userEvent.click(within(queue).getByRole("tab", { name: /In Review 1/i }));

    expect(screen.getByText("Review Workshop")).toBeVisible();
    expect(screen.queryByText("Pending Social")).not.toBeInTheDocument();
  });

  it("navigates View Details to the submission detail route", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/submissions"]}>
        <Routes>
          <Route path="/admin/submissions" element={<AdminSubmissionsPage />} />
          <Route path="/admin/submissions/:id" element={<h1>Submission detail</h1>} />
        </Routes>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole("button", { name: /Actions for Pending Social/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "View Details" }));
    expect(screen.getByRole("heading", { name: "Submission detail" })).toBeVisible();
  });
});

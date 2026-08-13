import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { EventSubmission } from "../../features/admin/model/submissions";
import * as useAdminSubmissions from "../../hooks/useAdminSubmissions";
import AdminSubmissionDetailPage from "./AdminSubmissionDetailPage";

vi.mock("../../hooks/useAdminSubmissions", () => ({
  useAdminSubmissions: vi.fn(),
}));

const mockSubmission: EventSubmission = {
  id: "sub-1",
  submitter_id: "user-1",
  submitter_email: "test@example.com",
  submitter_name: "Test User",
  status: "pending",
  submitted_data: { eventName: "Salsa Night" },
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

describe("AdminSubmissionDetailPage", () => {
  it("renders submission details", async () => {
    vi.mocked(useAdminSubmissions.useAdminSubmissions).mockReturnValue({
      submissions: [mockSubmission],
      isLoading: false,
      error: null,
      updateSubmission: vi.fn(),
      isUpdating: false,
      updateError: null,
    });

    render(
      <MemoryRouter initialEntries={["/admin/submissions/sub-1"]}>
        <Routes>
          <Route path="/admin/submissions/:id" element={<AdminSubmissionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Submission sub-1/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: pending/i)).toBeInTheDocument();
  });
});

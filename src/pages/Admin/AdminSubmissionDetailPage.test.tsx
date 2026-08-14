import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { EventSubmission } from "../../features/admin/model/submissions";
import * as useAdminSubmissions from "../../hooks/useAdminSubmissions";
import AdminSubmissionDetailPage from "./AdminSubmissionDetailPage";
import { useActiveTaxonomyTerms } from "../../features/admin/hooks/useAdminTaxonomy";

vi.mock("../../hooks/useAdminSubmissions", () => ({
  useAdminSubmissions: vi.fn(),
}));
vi.mock("../../features/admin/hooks/useAdminTaxonomy", () => ({ useActiveTaxonomyTerms: vi.fn() }));

const mockSubmission: EventSubmission = {
  id: "sub-1",
  submitter_id: "user-1",
  submitter_email: "test@example.com",
  submitter_name: "Test User",
  status: "pending",
  submitted_data: { title: "Original Salsa Night", event_date: "2026-09-01", dance_styles: ["salsa on 2"] },
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
    vi.mocked(useActiveTaxonomyTerms).mockReturnValue({ terms: [], isLoading: false, error: null });
    vi.mocked(useAdminSubmissions.useAdminSubmissions).mockReturnValue({
      submissions: [mockSubmission],
      isLoading: false,
      error: null,
      updateSubmission: vi.fn(),
      isUpdating: false,
      updateError: null,
      approveSubmissionWithTaxonomy: vi.fn(),
      isApproving: false,
      approveError: null,
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

  it("maps raw styles to selected canonical terms only during approval", async () => {
    const approveSubmissionWithTaxonomy = vi.fn();
    vi.mocked(useAdminSubmissions.useAdminSubmissions).mockReturnValue({
      submissions: [{ ...mockSubmission, edited_data: { title: "Corrected Salsa Night", event_date: "2026-09-08" } }],
      isLoading: false,
      error: null,
      updateSubmission: vi.fn(),
      isUpdating: false,
      updateError: null,
      approveSubmissionWithTaxonomy,
      isApproving: false,
      approveError: null,
    });
    vi.mocked(useActiveTaxonomyTerms).mockReturnValue({
      terms: [{ id: "salsa-on2-id", category: "dance_style", name: "Salsa On2", slug: "salsa-on2", description: null, parent_id: null, status: "active", display_order: 10, usage_count: 0, updated_at: "2026-08-14T00:00:00Z" }],
      isLoading: false,
      error: null,
    });
    render(<MemoryRouter initialEntries={["/admin/submissions/sub-1"]}><Routes><Route path="/admin/submissions/:id" element={<AdminSubmissionDetailPage />} /></Routes></MemoryRouter>);
    expect(screen.getByText("salsa on 2")).toBeVisible();
    await userEvent.click(screen.getByRole("checkbox", { name: "Salsa On2" }));
    await userEvent.click(screen.getByRole("button", { name: "Approve submission" }));
    expect(approveSubmissionWithTaxonomy).toHaveBeenCalledWith({ submissionId: "sub-1", taxonomyTermIds: ["salsa-on2-id"] }, expect.anything());
  });
});

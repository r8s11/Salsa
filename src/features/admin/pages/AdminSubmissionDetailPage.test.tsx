import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { EventSubmission } from "../model/submissions";
import * as useAdminSubmissions from "../hooks/useAdminSubmissionList";
import AdminSubmissionDetailPage from "./AdminSubmissionDetailPage";
import { useActiveTaxonomyTerms } from "../hooks/useAdminTaxonomy";

vi.mock("../hooks/useAdminSubmissionList", () => ({
  useAdminSubmissions: vi.fn(),
}));
vi.mock("../hooks/useAdminTaxonomy", () => ({ useActiveTaxonomyTerms: vi.fn() }));
// Approve/reject fire the transactional emails fire-and-forget. Mocked so the
// normal test suite can never reach the Edge Function or Resend.
vi.mock("../../submit-event/api/submissionNotification", () => ({
  notifySubmissionApproved: vi.fn(),
  notifySubmissionRejected: vi.fn(),
}));

const mockSubmission: EventSubmission = {
  id: "sub-1",
  submitter_id: "user-1",
  submitter_email: "test@example.com",
  submitter_name: "Test User",
  status: "pending",
  submitted_data: {
    title: "Original Salsa Night",
    event_date: "2026-09-01",
    dance_styles: ["salsa on 2"],
  },
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
    vi.mocked(useActiveTaxonomyTerms).mockReturnValue({ terms: [], isLoading: false, error: null, retry: vi.fn() });
    vi.mocked(useAdminSubmissions.useAdminSubmissions).mockReturnValue({
      submissions: [mockSubmission],
      isLoading: false,
      error: null,
      updateSubmission: vi.fn(),
      updateSubmissionAsync: vi.fn(),
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
      </MemoryRouter>
    );

    expect(screen.getByText(/Submission sub-1/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: pending/i)).toBeInTheDocument();
  });

  it("maps raw styles to selected canonical terms only during approval", async () => {
    const approveSubmissionWithTaxonomy = vi.fn();
    vi.mocked(useAdminSubmissions.useAdminSubmissions).mockReturnValue({
      submissions: [
        {
          ...mockSubmission,
          edited_data: { title: "Corrected Salsa Night", event_date: "2026-09-08" },
        },
      ],
      isLoading: false,
      error: null,
      updateSubmission: vi.fn(),
      updateSubmissionAsync: vi.fn(),
      isUpdating: false,
      updateError: null,
      approveSubmissionWithTaxonomy,
      isApproving: false,
      approveError: null,
    });
    vi.mocked(useActiveTaxonomyTerms).mockReturnValue({
      terms: [
        {
          id: "salsa-on2-id",
          category: "dance_style",
          name: "Salsa On2",
          slug: "salsa-on2",
          description: null,
          parent_id: null,
          status: "active",
          display_order: 10,
          usage_count: 0,
          updated_at: "2026-08-14T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/admin/submissions/sub-1"]}>
        <Routes>
          <Route path="/admin/submissions/:id" element={<AdminSubmissionDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("salsa on 2")).toBeVisible();
    await userEvent.click(screen.getByRole("checkbox", { name: "Salsa On2" }));
    await userEvent.click(screen.getByRole("button", { name: "Approve submission" }));
    expect(approveSubmissionWithTaxonomy).toHaveBeenCalledWith(
      { submissionId: "sub-1", taxonomyTermIds: ["salsa-on2-id"] },
      expect.anything()
    );
  });

  it("opens the reject dialog and submits rejection via updateSubmission", async () => {
    const updateSubmission = vi.fn();
    vi.mocked(useActiveTaxonomyTerms).mockReturnValue({ terms: [], isLoading: false, error: null, retry: vi.fn() });
    vi.mocked(useAdminSubmissions.useAdminSubmissions).mockReturnValue({
      submissions: [mockSubmission],
      isLoading: false,
      error: null,
      updateSubmission,
      updateSubmissionAsync: vi.fn(),
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
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: "Reject submission" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: /Message to submitter/i }),
      "Not enough info."
    );
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(updateSubmission).toHaveBeenCalledWith(
      {
        id: "sub-1",
        update: {
          status: "rejected",
          rejection_reason: "duplicate",
          rejection_message: "Not enough info.",
          internal_note: undefined,
        },
      },
      expect.anything()
    );
  });

  describe("linked records", () => {
    const VENUE_ID = "11111111-1111-4111-8111-111111111111";
    const storedReview = (decision: "new" | "existing") => ({
      venue: {
        candidate: { name: "Studio 5", city: "Boston" },
        state: "POSSIBLE MATCH",
        matches: [{ id: VENUE_ID, name: "Studio Five", city: "Boston" }],
        decision,
        selected_id: decision === "existing" ? VENUE_ID : null,
      },
      organizer: null,
      instructors: [],
      school: null,
    });

    const renderPage = (submission: EventSubmission) => {
      const calls: string[] = [];
      const updateSubmissionAsync = vi.fn(async () => {
        calls.push("update");
      });
      const approveSubmissionWithTaxonomy = vi.fn(() => {
        calls.push("approve");
      });
      vi.mocked(useActiveTaxonomyTerms).mockReturnValue({
        terms: [],
        isLoading: false,
        error: null,
        retry: vi.fn(),
      });
      vi.mocked(useAdminSubmissions.useAdminSubmissions).mockReturnValue({
        submissions: [submission],
        isLoading: false,
        error: null,
        updateSubmission: vi.fn(),
        updateSubmissionAsync,
        isUpdating: false,
        updateError: null,
        approveSubmissionWithTaxonomy,
        isApproving: false,
        approveError: null,
      });
      render(
        <MemoryRouter initialEntries={["/admin/submissions/sub-1"]}>
          <Routes>
            <Route path="/admin/submissions/:id" element={<AdminSubmissionDetailPage />} />
          </Routes>
        </MemoryRouter>
      );
      return { calls, updateSubmissionAsync, approveSubmissionWithTaxonomy };
    };

    it("shows a public 'new' suggestion as undecided, and approves without writing when untouched", async () => {
      const { updateSubmissionAsync, approveSubmissionWithTaxonomy } = renderPage({
        ...mockSubmission,
        submitted_data: { ...mockSubmission.submitted_data, entity_review: storedReview("new") },
      });
      expect(screen.getByText(/can only suggest records/)).toBeInTheDocument();
      expect(screen.getByText(/Undecided\. This venue is skipped/)).toBeInTheDocument();
      expect(screen.queryByText(/Will be added as a new venue/)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Approve submission" }));
      expect(updateSubmissionAsync).not.toHaveBeenCalled();
      expect(approveSubmissionWithTaxonomy).toHaveBeenCalledTimes(1);
    });

    it("saves the moderator's review to edited_data.entity_review before approving", async () => {
      const { calls, updateSubmissionAsync, approveSubmissionWithTaxonomy } = renderPage({
        ...mockSubmission,
        edited_data: { title: "Corrected" },
        submitted_data: { ...mockSubmission.submitted_data, entity_review: storedReview("new") },
      });
      await userEvent.click(
        screen.getByRole("button", { name: "Use Studio Five as the venue" })
      );
      await userEvent.click(screen.getByRole("button", { name: "Approve submission" }));

      await waitFor(() => expect(approveSubmissionWithTaxonomy).toHaveBeenCalled());
      expect(calls).toEqual(["update", "approve"]);
      expect(updateSubmissionAsync).toHaveBeenCalledWith({
        id: "sub-1",
        update: {
          edited_data: {
            title: "Corrected",
            entity_review: expect.objectContaining({
              venue: expect.objectContaining({ decision: "existing", selected_id: VENUE_ID }),
            }),
          },
        },
      });
    });

    it("does not approve when saving the review fails", async () => {
      const { approveSubmissionWithTaxonomy, updateSubmissionAsync } = renderPage({
        ...mockSubmission,
        submitted_data: { ...mockSubmission.submitted_data, entity_review: storedReview("new") },
      });
      updateSubmissionAsync.mockRejectedValueOnce(new Error("save failed"));
      await userEvent.click(
        screen.getByRole("button", { name: "Use Studio Five as the venue" })
      );
      await userEvent.click(screen.getByRole("button", { name: "Approve submission" }));
      await waitFor(() => expect(updateSubmissionAsync).toHaveBeenCalled());
      expect(approveSubmissionWithTaxonomy).not.toHaveBeenCalled();
    });

    it("renders nothing for a submission with no or unreadable review", () => {
      renderPage({
        ...mockSubmission,
        submitted_data: { ...mockSubmission.submitted_data, entity_review: { venue: "broken" } },
      });
      expect(screen.queryByText("Venue, organizer, instructors and school")).not.toBeInTheDocument();
    });
  });
});

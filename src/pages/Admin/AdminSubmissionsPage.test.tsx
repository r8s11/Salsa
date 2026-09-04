import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminSubmissionsPage from "./AdminSubmissionsPage";
import { useAdminSubmissions } from "../../hooks/useAdminSubmissions";
import { notifySubmissionRejected } from "../../features/submit-event/submissionNotification";
import type { EventSubmission } from "../../features/admin/model/submissions";

vi.mock("../../hooks/useAdminSubmissions");
vi.mock("../../features/submit-event/submissionNotification", () => ({
  notifySubmissionRejected: vi.fn().mockResolvedValue(undefined),
}));

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

  it("opens the structured reject dialog instead of mutating directly, and cancelling does not mutate", async () => {
    const updateSubmission = vi.fn();
    (useAdminSubmissions as Mock).mockReturnValue({
      submissions: mockSubmissions,
      isLoading: false,
      error: null,
      updateSubmission,
      isUpdating: false,
      updateError: null,
    });

    render(
      <MemoryRouter>
        <AdminSubmissionsPage />
      </MemoryRouter>
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Actions for Pending Social/i })
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Reject/i }));

    expect(
      screen.getByRole("dialog", { name: /Reject “Pending Social”\?/i })
    ).toBeInTheDocument();
    expect(updateSubmission).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));

    expect(updateSubmission).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits the reject dialog through the same structured rejection path as the detail view", async () => {
    const updateSubmission = vi.fn((_vars, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    (useAdminSubmissions as Mock).mockReturnValue({
      submissions: mockSubmissions,
      isLoading: false,
      error: null,
      updateSubmission,
      isUpdating: false,
      updateError: null,
    });

    render(
      <MemoryRouter>
        <AdminSubmissionsPage />
      </MemoryRouter>
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Actions for Pending Social/i })
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Reject/i }));

    fireEvent.change(screen.getByRole("textbox", { name: /Message to submitter/i }), {
      target: { value: "Please resubmit with more detail." },
    });
    await userEvent.click(screen.getByRole("button", { name: /^Reject$/i }));

    expect(updateSubmission).toHaveBeenCalledTimes(1);
    expect(updateSubmission).toHaveBeenCalledWith(
      {
        id: "submission-pending",
        update: {
          status: "rejected",
          rejection_reason: "duplicate",
          rejection_message: "Please resubmit with more detail.",
          internal_note: undefined,
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(notifySubmissionRejected).toHaveBeenCalledWith("submission-pending");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the reject dialog open with the error when the mutation fails", async () => {
    const updateSubmission = vi.fn();
    (useAdminSubmissions as Mock).mockReturnValue({
      submissions: mockSubmissions,
      isLoading: false,
      error: null,
      updateSubmission,
      isUpdating: false,
      updateError: new Error("Rejection failed."),
    });

    render(
      <MemoryRouter>
        <AdminSubmissionsPage />
      </MemoryRouter>
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Actions for Pending Social/i })
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Reject/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Rejection failed.");
  });

  it("surfaces a Supabase PostgrestError, which is not an Error instance", async () => {
    (useAdminSubmissions as Mock).mockReturnValue({
      submissions: mockSubmissions,
      isLoading: false,
      error: null,
      updateSubmission: vi.fn(),
      isUpdating: false,
      // Shape thrown by supabase-js: a plain object, never an Error.
      updateError: { code: "23503", message: "violates foreign key constraint" },
    });

    render(
      <MemoryRouter>
        <AdminSubmissionsPage />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: /Actions for Pending Social/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Reject/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("violates foreign key constraint");
  });

  it("locks Escape while busy and closes on Escape when idle", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <AdminSubmissionsPage />
      </MemoryRouter>
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Actions for Pending Social/i })
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Reject/i }));

    (useAdminSubmissions as Mock).mockReturnValue({
      submissions: mockSubmissions,
      isLoading: false,
      error: null,
      updateSubmission: vi.fn(),
      isUpdating: true,
      updateError: null,
    });
    rerender(
      <MemoryRouter>
        <AdminSubmissionsPage />
      </MemoryRouter>
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    (useAdminSubmissions as Mock).mockReturnValue({
      submissions: mockSubmissions,
      isLoading: false,
      error: null,
      updateSubmission: vi.fn(),
      isUpdating: false,
      updateError: null,
    });
    rerender(
      <MemoryRouter>
        <AdminSubmissionsPage />
      </MemoryRouter>
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts focus on the reason select, not the destructive submit, when the dialog opens", async () => {
    render(
      <MemoryRouter>
        <AdminSubmissionsPage />
      </MemoryRouter>
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Actions for Pending Social/i })
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Reject/i }));

    expect(screen.getByLabelText(/Reason for rejection/i)).toHaveFocus();
  });
});

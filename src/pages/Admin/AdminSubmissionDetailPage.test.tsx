import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminSubmissionDetailPage from "./AdminSubmissionDetailPage";
import * as useAdminSubmissions from "../../hooks/useAdminSubmissions";

vi.mock("../../hooks/useAdminSubmissions", () => ({
  useAdminSubmissions: vi.fn(),
}));

const mockSubmission = {
  id: "sub-1",
  submitter_email: "test@example.com",
  status: "pending",
  submitted_at: "2026-08-13T10:00:00Z",
  submitted_data: { eventName: "Salsa Night" },
};

describe("AdminSubmissionDetailPage", () => {
  it("renders submission details", async () => {
    vi.mocked(useAdminSubmissions.useAdminSubmissions).mockReturnValue({
      submissions: [mockSubmission],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
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
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminSubmissionsPage from "./AdminSubmissionsPage";
import { useAdminSubmissions } from "../../hooks/useAdminSubmissions";

vi.mock("../../hooks/useAdminSubmissions");

const mockSubmissions = [
  { id: "1", status: "pending", submitter_name: "John Doe", submitted_at: "2026-08-13T10:00:00Z" },
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

  it("navigates View Details to the submission detail route", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/submissions"]}>
        <Routes>
          <Route path="/admin/submissions" element={<AdminSubmissionsPage />} />
          <Route path="/admin/submissions/:id" element={<h1>Submission detail</h1>} />
        </Routes>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole("button", { name: /Actions for submission/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "View Details" }));
    expect(screen.getByRole("heading", { name: "Submission detail" })).toBeVisible();
  });
});

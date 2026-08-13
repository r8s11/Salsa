import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminSubmissionsPage from "./AdminSubmissionsPage";
import { useAdminSubmissions } from "../../hooks/useAdminSubmissions";
import { MemoryRouter } from "react-router-dom";
import type { Mock } from "vitest";

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
});

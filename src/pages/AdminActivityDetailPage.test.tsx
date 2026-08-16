import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import AdminActivityDetailPage from "./AdminActivityDetailPage";
import { useAdminActivityDetail } from "../hooks/useAdminActivity";

vi.mock("../hooks/useAdminActivity");

const mockEntry = {
  id: "audit-1",
  action: "user.suspended",
  actor_id: "user-3",
  actor_display_name: "Moderator",
  actor_username: "mod",
  actor_avatar_url: null,
  entity_type: "profile",
  entity_id: "user-7",
  metadata: {
    reason: "Repeated spam",
    from_status: "active",
    to_status: "suspended",
  },
  created_at: "2026-08-14T14:30:00Z",
};

describe("AdminActivityDetailPage", () => {
  beforeEach(() => {
    (useAdminActivityDetail as Mock).mockReturnValue({
      entry: mockEntry,
      isLoading: false,
      error: null,
    });
  });

  it("renders the action as the page heading", () => {
    render(
      <MemoryRouter initialEntries={["/admin/activity/audit-1"]}>
        <Routes>
          <Route path="/admin/activity/:id" element={<AdminActivityDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /account suspended/i })).toBeInTheDocument();
  });

  it("renders actor and timestamp in metadata", () => {
    render(
      <MemoryRouter initialEntries={["/admin/activity/audit-1"]}>
        <Routes>
          <Route path="/admin/activity/:id" element={<AdminActivityDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/by/i)).toBeInTheDocument();
    expect(screen.getByText(/moderator/i)).toBeInTheDocument();
  });

  it("renders the reason section when metadata.reason is present", () => {
    render(
      <MemoryRouter initialEntries={["/admin/activity/audit-1"]}>
        <Routes>
          <Route path="/admin/activity/:id" element={<AdminActivityDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("Repeated spam")).toBeInTheDocument();
  });

  it("renders status change section for user.suspended", () => {
    render(
      <MemoryRouter initialEntries={["/admin/activity/audit-1"]}>
        <Routes>
          <Route path="/admin/activity/:id" element={<AdminActivityDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Status Change")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("suspended")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    (useAdminActivityDetail as Mock).mockReturnValue({
      entry: null,
      isLoading: true,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/admin/activity/audit-1"]}>
        <Routes>
          <Route path="/admin/activity/:id" element={<AdminActivityDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Loading activity entry…")).toBeInTheDocument();
  });

  it("shows error state and retry link", () => {
    (useAdminActivityDetail as Mock).mockReturnValue({
      entry: null,
      isLoading: false,
      error: "Network error",
    });

    render(
      <MemoryRouter initialEntries={["/admin/activity/audit-1"]}>
        <Routes>
          <Route path="/admin/activity/:id" element={<AdminActivityDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load this activity entry.");
  });
});

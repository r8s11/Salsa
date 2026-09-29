import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import AdminActivityPage from "./AdminActivityPage";
import { useAdminActivity } from "../hooks/useAdminActivity";

vi.mock("../hooks/useAdminActivity");

const mockEntries = [
  {
    id: "audit-1",
    action: "event.approved",
    actor_id: "user-1",
    actor_display_name: "Admin User",
    actor_username: "admin",
    actor_avatar_url: null,
    entity_type: "event",
    entity_id: "event-42",
    metadata: null,
    created_at: "2026-08-14T14:30:00Z",
  },
];

describe("AdminActivityPage", () => {
  beforeEach(() => {
    (useAdminActivity as Mock).mockReturnValue({
      entries: mockEntries,
      total: 1,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("renders the page title and result count", () => {
    render(
      <MemoryRouter initialEntries={["/admin/activity"]}>
        <Routes>
          <Route path="/admin/activity" element={<AdminActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Activity" })).toBeInTheDocument();
    expect(screen.getByText("1 activity entry")).toBeInTheDocument();
  });

  it("renders an entry row with the action label", () => {
    render(
      <MemoryRouter initialEntries={["/admin/activity"]}>
        <Routes>
          <Route path="/admin/activity" element={<AdminActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText("Event published").length).toBeGreaterThanOrEqual(1);
  });

  it("shows loading skeleton while data is loading", () => {
    (useAdminActivity as Mock).mockReturnValue({
      entries: [],
      total: 0,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/admin/activity"]}>
        <Routes>
          <Route path="/admin/activity" element={<AdminActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText("Loading activity…").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error state and retry button", () => {
    (useAdminActivity as Mock).mockReturnValue({
      entries: [],
      total: 0,
      isLoading: false,
      error: "Network error",
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/admin/activity"]}>
        <Routes>
          <Route path="/admin/activity" element={<AdminActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load activity.");
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    (useAdminActivity as Mock).mockReturnValue({
      entries: [],
      total: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/admin/activity"]}>
        <Routes>
          <Route path="/admin/activity" element={<AdminActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  });

  it("opens filter drawer and applies filters", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/activity"]}>
        <Routes>
          <Route path="/admin/activity" element={<AdminActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Open the filter drawer
    await userEvent.click(screen.getByRole("button", { name: /more filters/i }));

    // Drawer should now be open showing the dialog
    expect(await screen.findByRole("dialog", { name: /more filters/i })).toBeInTheDocument();

    // Apply filters — this should close the drawer
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
  });
});

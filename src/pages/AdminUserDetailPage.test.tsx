import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AdminUserRow } from "../features/admin/model/usersQuery";
import AdminUserDetailPage from "./AdminUserDetailPage";

const { useAdminUsers } = vi.hoisted(() => ({ useAdminUsers: vi.fn() }));
vi.mock("../hooks/useAdminUsers", () => ({ useAdminUsers }));
vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({ user: { id: "self-1" }, isAdmin: true }),
}));

const organizer: AdminUserRow = {
  kind: "profile",
  id: "organizer-1",
  user_id: "organizer-1",
  email: "maria@salsa.test",
  display_name: "Maria Santos",
  username: "mariasalsa",
  avatar_url: null,
  role: "organizer",
  status: "active",
  status_reason: null,
  created_at: "2026-02-01T00:00:00.000Z",
  last_active_at: "2026-07-01T00:00:00.000Z",
  contributions: 3,
  pending_count: 0,
  email_confirmed_at: "2026-02-01T00:00:00.000Z",
};

const guest: AdminUserRow = {
  kind: "guest",
  id: "guest:vince@salsa.test",
  user_id: null,
  email: "vince@salsa.test",
  display_name: "Vince Guest",
  username: null,
  avatar_url: null,
  role: null,
  status: "active",
  status_reason: null,
  created_at: "2026-06-01T00:00:00.000Z",
  last_active_at: "2026-06-05T00:00:00.000Z",
  contributions: 1,
  pending_count: 1,
  email_confirmed_at: null,
};

const defaultState = {
  users: [organizer, guest],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  setRole: vi.fn(),
  settingRoleId: null,
  roleErrorId: null,
  roleError: null,
  setStatus: vi.fn(),
  settingStatusId: null,
  statusErrorId: null,
  statusError: null,
};

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${id}`]}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminUserDetailPage", () => {
  beforeEach(() => {
    vi.mocked(useAdminUsers).mockReturnValue({ ...defaultState });
  });

  it("shows a registered user's identity header, badges, and account overview", () => {
    renderAt("organizer-1");

    expect(screen.getByRole("heading", { name: "Maria Santos" })).toBeInTheDocument();
    expect(screen.getAllByText("@mariasalsa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Organizer").length).toBeGreaterThan(0);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("maria@salsa.test")).toBeInTheDocument();
    expect(screen.getByText("Registered User")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("shows a guest's magic-link presentation with no role badge", () => {
    renderAt("guest:vince@salsa.test");

    expect(screen.getByRole("heading", { name: "Vince Guest" })).toBeInTheDocument();
    expect(screen.getByText("No public profile")).toBeInTheDocument();
    expect(screen.getByText("Magic-Link Submitter")).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("shows the activity summary counts from the directory row", () => {
    renderAt("organizer-1");
    expect(screen.getByText("3")).toBeInTheDocument(); // contributions
  });

  it("renders 'User not found' with a link back to Users for an unknown id", () => {
    renderAt("does-not-exist");
    expect(screen.getByText("User not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
  });
});

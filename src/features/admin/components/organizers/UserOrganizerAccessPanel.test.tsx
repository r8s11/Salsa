import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { AdminUserRow } from "../../model/usersQuery";
import type { UserOrganizerMembership } from "../../model/organizerAccess";
import UserOrganizerAccessPanel from "./UserOrganizerAccessPanel";

const { useUserOrganizerMemberships } = vi.hoisted(() => ({
  useUserOrganizerMemberships: vi.fn(),
}));
vi.mock("../../hooks/useOrganizerAccess", () => ({ useUserOrganizerMemberships }));
vi.mock("./AssignOrganizerMemberDialog", () => ({
  default: ({ user }: { user: { name: string } }) => <div role="dialog">Assign {user.name}</div>,
}));

const user: AdminUserRow = {
  kind: "profile",
  id: "u1",
  user_id: "u1",
  email: "rob@example.test",
  display_name: "Rob",
  username: null,
  avatar_url: null,
  role: "organizer",
  status: "active",
  status_reason: null,
  created_at: "2026-01-01T00:00:00Z",
  last_active_at: "2026-01-01T00:00:00Z",
  contributions: 0,
  pending_count: 0,
  email_confirmed_at: null,
  approved_count: 0,
};
const membership: UserOrganizerMembership = {
  organizer_id: "o1",
  organizer_name: "Rob — Boston",
  organizer_slug: null,
  organizer_status: "active",
  member_role: "owner",
  member_status: "active",
  event_count: 3,
};

const renderPanel = (row = user, isAdmin = true) =>
  render(
    <MemoryRouter>
      <UserOrganizerAccessPanel user={row} isAdmin={isAdmin} />
    </MemoryRouter>
  );
const state = (data: UserOrganizerMembership[]) =>
  useUserOrganizerMemberships.mockReturnValue({ data, isPending: false, isError: false });

beforeEach(() => useUserOrganizerMemberships.mockReset());

describe("UserOrganizerAccessPanel", () => {
  it("warns when the Organizer role has no membership and offers the next action", async () => {
    state([]);
    renderPanel();
    expect(screen.getByText("Organizer role assigned, membership missing")).toBeInTheDocument();
    expect(screen.getByText(/cannot manage events/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Assign to Organizer" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Assign Rob");
  });

  it("shows configured access with role and managed event count", () => {
    state([membership]);
    renderPanel();
    expect(screen.getByText("Organizer access configured")).toBeInTheDocument();
    expect(screen.getByText("Rob — Boston")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText(/Manages 3 events across 1 organizer/)).toBeInTheDocument();
  });

  it("flags an inactive organizer", () => {
    state([{ ...membership, organizer_status: "archived" }]);
    renderPanel();
    expect(screen.getByText("Organizer inactive")).toBeInTheDocument();
  });

  it("says permission is insufficient for non-admins and does not query", () => {
    state([]);
    renderPanel(user, false);
    expect(screen.getByText(/Insufficient permission/)).toBeInTheDocument();
    expect(useUserOrganizerMemberships).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("button", { name: "Assign to Organizer" })).not.toBeInTheDocument();
  });

  it("shows a retryable error and a loading state", async () => {
    const refetch = vi.fn();
    useUserOrganizerMemberships.mockReturnValue({ isPending: true, isError: false });
    const first = renderPanel();
    expect(screen.getByText("Loading organizer access…")).toBeInTheDocument();
    first.unmount();
    useUserOrganizerMemberships.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error("boom"),
      refetch,
    });
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders nothing for a plain user without memberships", () => {
    state([]);
    const { container } = renderPanel({ ...user, role: "user" });
    expect(container).toBeEmptyDOMElement();
  });
});

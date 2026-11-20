import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OrganizerTeam } from "../../model/organizerAccess";
import EventOrganizerPanel from "./EventOrganizerPanel";

const { useOrganizerTeam } = vi.hoisted(() => ({ useOrganizerTeam: vi.fn() }));
vi.mock("../../hooks/useOrganizerAccess", () => ({ useOrganizerTeam }));
vi.mock("../organizers/AssignOrganizerMemberDialog", () => ({
  default: ({ organizer, onClose }: { organizer: { name: string }; onClose: () => void }) => (
    <div role="dialog">
      Add to {organizer.name}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

const team = (over: Partial<OrganizerTeam> = {}): OrganizerTeam => ({
  organizer_id: "o1",
  organizer_name: "Rob — Boston",
  organizer_status: "active",
  members: [
    {
      user_id: "u1",
      display_name: "Rob",
      username: null,
      email: "rob@example.test",
      account_status: "active",
      member_role: "owner",
      member_status: "active",
    },
  ],
  ...over,
});
const organizer = { id: "o1", name: "Rob — Boston" };

beforeEach(() => useOrganizerTeam.mockReset());

describe("EventOrganizerPanel", () => {
  it("explains the two concepts and resolves a missing organizer", async () => {
    const onChoose = vi.fn();
    render(<EventOrganizerPanel organizer={null} onChoose={onChoose} />);
    expect(screen.getByText(/users allowed to manage that organizer/i)).toBeInTheDocument();
    expect(screen.getByText("Event has no assigned organizer.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Choose organizer" }));
    expect(onChoose).toHaveBeenCalled();
    expect(useOrganizerTeam).not.toHaveBeenCalled();
  });

  it("lists active team members and opens the add dialog", async () => {
    useOrganizerTeam.mockReturnValue({ data: team(), isPending: false, isError: false });
    render(<EventOrganizerPanel organizer={organizer} onChoose={vi.fn()} />);
    expect(screen.getByText("Rob")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add team member" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Add to Rob — Boston");
  });

  it("says nobody can manage the event when the team is empty", () => {
    useOrganizerTeam.mockReturnValue({
      data: team({ members: [] }),
      isPending: false,
      isError: false,
    });
    render(<EventOrganizerPanel organizer={organizer} onChoose={vi.fn()} />);
    expect(screen.getByText(/only administrators can manage this event/i)).toBeInTheDocument();
  });

  it("flags an inactive organizer and blocks adding members", () => {
    useOrganizerTeam.mockReturnValue({
      data: team({ organizer_status: "archived" }),
      isPending: false,
      isError: false,
    });
    render(<EventOrganizerPanel organizer={organizer} onChoose={vi.fn()} />);
    expect(screen.getByText("Organizer inactive.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add team member" })).toBeDisabled();
  });

  it("reports insufficient permission with a retry", async () => {
    const refetch = vi.fn();
    useOrganizerTeam.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error("Administrator role required"),
      refetch,
    });
    render(<EventOrganizerPanel organizer={organizer} onChoose={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Insufficient permission");
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows a loading state", () => {
    useOrganizerTeam.mockReturnValue({ isPending: true, isError: false });
    render(<EventOrganizerPanel organizer={organizer} onChoose={vi.fn()} />);
    expect(screen.getByText("Loading team…")).toBeInTheDocument();
  });
});

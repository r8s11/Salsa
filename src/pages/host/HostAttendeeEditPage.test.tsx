import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HostAttendeeEditPage from "./HostAttendeeEditPage";
import type { HostAttendee } from "../../features/host/model/attendance";

const mockUpdateAttendee = vi.fn();

// Mirrors the real hook: the roster is always scoped to the requested event.
let rosters: Record<string, HostAttendee[]> = {};
let mockLoading = false;
let mockError: string | null = null;

vi.mock("../../features/host/hooks/useEventAttendees", () => ({
  useEventAttendees: (eventId: string) => ({
    attendees: rosters[eventId] ?? [],
    isLoading: mockLoading,
    error: mockError,
    refetch: vi.fn(),
    addAttendee: vi.fn(),
    isAdding: false,
    updateAttendee: mockUpdateAttendee,
    isUpdating: false,
    deleteAttendee: vi.fn(),
    isDeleting: false,
  }),
}));

const ana: HostAttendee = {
  id: "att-1",
  eventId: "evt-1",
  profileId: null,
  displayName: "Ana Garcia",
  email: "ana@example.com",
  category: "guest",
  source: "host",
  partySize: 2,
  notes: "VIP",
  createdBy: "user-1",
  createdAt: "2026-08-30T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
};

const bob: HostAttendee = {
  ...ana,
  id: "att-2",
  displayName: "Bob Smith",
  email: null,
  category: "staff",
  partySize: 1,
  notes: null,
};

const other: HostAttendee = { ...ana, id: "att-9", eventId: "evt-2", displayName: "Zed Other" };

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/host/events/:eventId/attendees/:attendeeId/edit"
          element={<HostAttendeeEditPage />}
        />
        <Route path="/host/events/:eventId/attendees" element={<div>Roster page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HostAttendeeEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rosters = { "evt-1": [ana, bob], "evt-2": [other] };
    mockLoading = false;
    mockError = null;
    mockUpdateAttendee.mockResolvedValue(ana);
  });

  it("opens the requested attendee with their current values", () => {
    renderPage("/host/events/evt-1/attendees/att-2/edit");

    expect(screen.getByLabelText("Name *")).toHaveValue("Bob Smith");
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Category")).toHaveValue("staff");
    expect(screen.getByLabelText("Party Size")).toHaveValue(1);
  });

  it("saves permitted changes to the same record and returns to the roster", async () => {
    const user = userEvent.setup();
    renderPage("/host/events/evt-1/attendees/att-1/edit");

    const name = screen.getByLabelText("Name *");
    await user.clear(name);
    await user.type(name, "  Ana G.  ");
    await user.selectOptions(screen.getByLabelText("Category"), "comp");
    await user.clear(screen.getByLabelText("Email"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mockUpdateAttendee).toHaveBeenCalledWith({
      attendeeId: "att-1",
      updates: {
        displayName: "Ana G.",
        email: null,
        category: "comp",
        partySize: 2,
        notes: "VIP",
      },
    });
    expect(await screen.findByText("Roster page")).toBeInTheDocument();
  });

  it("clamps party size to the add-form limits", async () => {
    const user = userEvent.setup();
    renderPage("/host/events/evt-1/attendees/att-1/edit");

    const party = screen.getByLabelText("Party Size");
    await user.clear(party);
    await user.type(party, "99");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mockUpdateAttendee).toHaveBeenCalledWith(
      expect.objectContaining({ updates: expect.objectContaining({ partySize: 20 }) })
    );
  });

  it("cancel returns to the roster without saving", async () => {
    const user = userEvent.setup();
    renderPage("/host/events/evt-1/attendees/att-1/edit");

    await user.type(screen.getByLabelText("Name *"), " edited");
    await user.click(screen.getByRole("link", { name: "Cancel" }));

    expect(await screen.findByText("Roster page")).toBeInTheDocument();
    expect(mockUpdateAttendee).not.toHaveBeenCalled();
  });

  it("shows the error and keeps the form state when saving fails", async () => {
    const user = userEvent.setup();
    mockUpdateAttendee.mockRejectedValue(new Error("Could not save changes. No permission."));
    renderPage("/host/events/evt-1/attendees/att-1/edit");

    const name = screen.getByLabelText("Name *");
    await user.clear(name);
    await user.type(name, "Ana Renamed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No permission.");
    expect(screen.queryByText("Roster page")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name *")).toHaveValue("Ana Renamed");
  });

  it("does not load an attendee through another event's URL", () => {
    // att-9 exists, but on evt-2; evt-1's roster does not contain it.
    renderPage("/host/events/evt-1/attendees/att-9/edit");

    expect(screen.getByRole("heading", { name: "Attendee not found" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Name *")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Zed Other")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to roster" })).toHaveAttribute(
      "href",
      "/host/events/evt-1/attendees"
    );
  });

  it("shows not found when the caller cannot see the event's roster", () => {
    rosters = {};
    renderPage("/host/events/evt-1/attendees/att-1/edit");

    expect(screen.getByRole("heading", { name: "Attendee not found" })).toBeInTheDocument();
    expect(mockUpdateAttendee).not.toHaveBeenCalled();
  });

  it("does not claim not-found while the roster is loading or failed", () => {
    mockLoading = true;
    const { unmount } = renderPage("/host/events/evt-1/attendees/att-1/edit");
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    expect(screen.queryByText("Attendee not found")).not.toBeInTheDocument();
    unmount();

    mockLoading = false;
    mockError = "Network error";
    renderPage("/host/events/evt-1/attendees/att-1/edit");
    expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    expect(screen.queryByText("Attendee not found")).not.toBeInTheDocument();
  });
});

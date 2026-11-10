import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HostCheckInPage from "./HostCheckInPage";
import type { HostAttendee, HostCheckIn } from "../../features/host/model/attendance";

/* ── Mocks ── */

const mockRefetch = vi.fn();
const mockRefetchCheckIns = vi.fn();
const mockCheckIn = vi.fn();
const mockReverseCheckIn = vi.fn();

let mockAttendees: HostAttendee[] = [];
let mockCheckIns: HostCheckIn[] = [];
let mockAttendeesLoading = false;
let mockCheckInsLoading = false;
let mockAttendeesError: string | null = null;
let mockCheckInsError: string | null = null;

vi.mock("../../features/host/hooks/useEventAttendees", () => ({
  useEventAttendees: () => ({
    attendees: mockAttendees,
    isLoading: mockAttendeesLoading,
    error: mockAttendeesError,
    refetch: mockRefetch,
    addAttendee: vi.fn(),
    isAdding: false,
    updateAttendee: vi.fn(),
    isUpdating: false,
    deleteAttendee: vi.fn(),
    isDeleting: false,
  }),
}));

vi.mock("../../features/host/hooks/useEventCheckIns", () => ({
  useEventCheckIns: () => ({
    checkIns: mockCheckIns,
    isLoading: mockCheckInsLoading,
    error: mockCheckInsError,
    refetch: mockRefetchCheckIns,
    checkIn: mockCheckIn,
    isCheckingIn: false,
    reverseCheckIn: mockReverseCheckIn,
    isReversing: false,
  }),
}));

/* ── Test data ── */

const attendeeA: HostAttendee = {
  id: "att-1",
  eventId: "evt-1",
  profileId: null,
  displayName: "Ana Garcia",
  email: "ana@example.com",
  category: "guest",
  source: "host",
  partySize: 2,
  notes: null,
  createdBy: "user-1",
  createdAt: "2026-08-30T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
};

const attendeeB: HostAttendee = {
  id: "att-2",
  eventId: "evt-1",
  profileId: null,
  displayName: "Bob Smith",
  email: null,
  category: "staff",
  source: "host",
  partySize: 1,
  notes: null,
  createdBy: "user-1",
  createdAt: "2026-08-30T11:00:00Z",
  updatedAt: "2026-08-30T11:00:00Z",
};

const checkInA: HostCheckIn = {
  id: "ci-1",
  attendeeId: "att-1",
  eventId: "evt-1",
  checkedInAt: "2026-08-31T20:15:00Z",
  checkedInBy: "user-1",
  method: "door",
  reversedAt: null,
  reversedBy: null,
  reversalReason: null,
  createdAt: "2026-08-31T20:15:00Z",
};

const reversedCheckIn: HostCheckIn = {
  id: "ci-2",
  attendeeId: "att-2",
  eventId: "evt-1",
  checkedInAt: "2026-08-31T20:10:00Z",
  checkedInBy: "user-1",
  method: "manual",
  reversedAt: "2026-08-31T20:20:00Z",
  reversedBy: "user-1",
  reversalReason: "Wrong person",
  createdAt: "2026-08-31T20:10:00Z",
};

/* ── Helpers ── */

function renderPage(eventId = "evt-1") {
  return render(
    <MemoryRouter initialEntries={[`/host/events/${eventId}/check-in`]}>
      <Routes>
        <Route path="/host/events/:eventId/check-in" element={<HostCheckInPage />} />
        <Route path="/host/events/:eventId" element={<div>Event Detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/* ── Tests ── */

describe("HostCheckInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAttendees = [];
    mockCheckIns = [];
    mockAttendeesLoading = false;
    mockCheckInsLoading = false;
    mockAttendeesError = null;
    mockCheckInsError = null;
  });

  it("renders loading state", () => {
    mockAttendeesLoading = true;
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("renders error state with retry", () => {
    mockAttendeesError = "Network error";
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Network error");
  });

  it("labels roster entries and party headcount separately", () => {
    // Ana is a party of 2 and checked in; Bob is a party of 1 and not.
    mockAttendees = [attendeeA, attendeeB];
    mockCheckIns = [checkInA];
    renderPage();
    expect(
      screen.getByText("1 of 2 roster entries checked in · 2 of 3 headcount arrived")
    ).toBeInTheDocument();
  });

  it("does not count reversed check-ins as arrivals", () => {
    mockAttendees = [attendeeA, attendeeB];
    mockCheckIns = [reversedCheckIn];
    renderPage();
    expect(
      screen.getByText("0 of 2 roster entries checked in · 0 of 3 headcount arrived")
    ).toBeInTheDocument();
  });

  it("shows empty state when no attendees", () => {
    renderPage();
    expect(screen.getByText(/no attendees on the roster/i)).toBeInTheDocument();
  });

  it("renders attendee cards with check-in button", () => {
    mockAttendees = [attendeeA, attendeeB];
    renderPage();
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check in Ana Garcia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check in Bob Smith" })).toBeInTheDocument();
  });

  it("marks checked-in attendee with badge", () => {
    mockAttendees = [attendeeA, attendeeB];
    mockCheckIns = [checkInA];
    renderPage();
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument();
    expect(screen.getByText("Checked in")).toBeInTheDocument();
  });

  it("calls checkIn when button clicked", async () => {
    const user = userEvent.setup();
    mockAttendees = [attendeeA];
    mockCheckIn.mockResolvedValue(undefined);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Check in Ana Garcia" }));
    expect(mockCheckIn).toHaveBeenCalledWith({ attendeeId: "att-1", method: "manual" });
  });

  it("filters attendees by search", async () => {
    const user = userEvent.setup();
    mockAttendees = [attendeeA, attendeeB];
    renderPage();

    await user.type(screen.getByPlaceholderText(/search by name or email/i), "Bob");
    expect(screen.queryByText("Ana Garcia")).not.toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
  });

  it("shows empty search result message", async () => {
    const user = userEvent.setup();
    mockAttendees = [attendeeA];
    renderPage();

    await user.type(screen.getByPlaceholderText(/search by name or email/i), "zzz");
    expect(screen.getByText(/no attendees match/i)).toBeInTheDocument();
  });

  it("toggles method between manual and door", async () => {
    const user = userEvent.setup();
    mockAttendees = [attendeeA];
    renderPage();

    await user.click(screen.getByRole("button", { name: /door/i }));
    await user.click(screen.getByRole("button", { name: "Check in Ana Garcia" }));
    expect(mockCheckIn).toHaveBeenCalledWith({ attendeeId: "att-1", method: "door" });
  });

  it("shows recent reversals section", () => {
    mockAttendees = [attendeeA, attendeeB];
    mockCheckIns = [reversedCheckIn];
    renderPage();
    expect(screen.getByText(/recent reversals/i)).toBeInTheDocument();
    expect(screen.getByText(/reversed at/i)).toBeInTheDocument();
  });
  it("offers Undo check-in on an active row and reverses that check-in", async () => {
    const user = userEvent.setup();
    mockAttendees = [attendeeA, attendeeB];
    mockCheckIns = [checkInA];
    mockReverseCheckIn.mockResolvedValue(undefined);
    renderPage();

    // Only the checked-in attendee gets Undo; the other keeps Check In.
    expect(screen.getAllByRole("button", { name: /undo check-in/i })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Undo check-in for Ana Garcia" }));

    expect(mockReverseCheckIn).toHaveBeenCalledWith({ checkInId: "ci-1" });
    expect(mockCheckIn).not.toHaveBeenCalled();
  });

  it("Re-check-in creates a new arrival instead of reapplying the reversal", async () => {
    const user = userEvent.setup();
    mockAttendees = [attendeeA, attendeeB];
    mockCheckIns = [reversedCheckIn];
    mockCheckIn.mockResolvedValue(undefined);
    renderPage();

    await user.click(screen.getByRole("button", { name: "Re-check-in Bob Smith" }));

    expect(mockCheckIn).toHaveBeenCalledWith({ attendeeId: "att-2", method: "manual" });
    expect(mockReverseCheckIn).not.toHaveBeenCalled();
  });

  it("never offers a second active arrival for an already checked-in attendee", () => {
    // Bob has a reversal in history but is currently checked in again.
    const activeAgain: HostCheckIn = {
      ...reversedCheckIn,
      id: "ci-3",
      reversedAt: null,
      reversedBy: null,
      reversalReason: null,
    };
    mockAttendees = [attendeeB];
    mockCheckIns = [activeAgain, reversedCheckIn];
    renderPage();

    expect(screen.queryByRole("button", { name: /^check in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /re-check-in/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo check-in for Bob Smith" })).toBeInTheDocument();
    // History stays visible.
    expect(screen.getByText(/reversed at/i)).toBeInTheDocument();
  });

  it("shows a denied check-in as an error instead of failing silently", async () => {
    const user = userEvent.setup();
    mockAttendees = [attendeeA];
    mockCheckIn.mockRejectedValue(
      new Error("You do not have permission to check in this attendee for this event.")
    );
    renderPage();

    await user.click(screen.getByRole("button", { name: "Check in Ana Garcia" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/do not have permission/i);
    expect(mockRefetchCheckIns).toHaveBeenCalled();
  });

  it("shows a denied undo as an error", async () => {
    const user = userEvent.setup();
    mockAttendees = [attendeeA];
    mockCheckIns = [checkInA];
    mockReverseCheckIn.mockRejectedValue(new Error("Could not undo this check-in."));
    renderPage();

    await user.click(screen.getByRole("button", { name: "Undo check-in for Ana Garcia" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not undo this check-in.");
  });
});

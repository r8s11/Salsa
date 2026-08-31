import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HostCheckInPage from "./HostCheckInPage";
import type { HostAttendee, HostCheckIn } from "../features/host/model/attendance";

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

vi.mock("../features/host/hooks/useEventAttendees", () => ({
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

vi.mock("../features/host/hooks/useEventCheckIns", () => ({
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

  it("shows subtitle with counts", async () => {
    mockAttendees = [attendeeA, attendeeB];
    mockCheckIns = [checkInA];
    renderPage();
    expect(await screen.findByText(/1 checked in/)).toBeInTheDocument();
    expect(screen.getByText(/2 on roster/)).toBeInTheDocument();
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
    expect(screen.getAllByRole("button", { name: /check in/i }).length).toBe(2);
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

    await user.click(screen.getByRole("button", { name: /check in/i }));
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
    await user.click(screen.getByRole("button", { name: /check in/i }));
    expect(mockCheckIn).toHaveBeenCalledWith({ attendeeId: "att-1", method: "door" });
  });

  it("shows recent reversals section", () => {
    mockAttendees = [attendeeA, attendeeB];
    mockCheckIns = [reversedCheckIn];
    renderPage();
    expect(screen.getByText(/recent reversals/i)).toBeInTheDocument();
    expect(screen.getByText(/reversed at/i)).toBeInTheDocument();
  });
});

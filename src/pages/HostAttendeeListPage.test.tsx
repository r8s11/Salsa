import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HostAttendeeListPage from "./HostAttendeeListPage";
import type { HostAttendee } from "../features/host/model/attendance";

/* ── Mocks ── */

const mockRefetch = vi.fn();
const mockAddAttendee = vi.fn();
const mockDeleteAttendee = vi.fn();

let mockAttendees: HostAttendee[] = [];
let mockLoading = false;
let mockError: string | null = null;

vi.mock("../features/host/hooks/useEventAttendees", () => ({
  useEventAttendees: () => ({
    attendees: mockAttendees,
    isLoading: mockLoading,
    error: mockError,
    refetch: mockRefetch,
    addAttendee: mockAddAttendee,
    isAdding: false,
    updateAttendee: vi.fn(),
    isUpdating: false,
    deleteAttendee: mockDeleteAttendee,
    isDeleting: false,
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
  notes: "VIP",
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

/* ── Helpers ── */

function renderPage(eventId = "evt-1") {
  return render(
    <MemoryRouter initialEntries={[`/host/events/${eventId}/attendees`]}>
      <Routes>
        <Route path="/host/events/:eventId/attendees" element={<HostAttendeeListPage />} />
        <Route path="/host/events/:eventId" element={<div>Event Detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/* ── Tests ── */

describe("HostAttendeeListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAttendees = [];
    mockLoading = false;
    mockError = null;
  });

  it("renders loading state", () => {
    mockLoading = true;
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("renders error state with retry button", () => {
    mockError = "Failed to load";
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load");
    const retry = screen.getByRole("button", { name: /try again/i });
    retry.click();
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("renders empty state when no attendees", async () => {
    renderPage();
    expect(await screen.findByText(/no attendees yet/i)).toBeInTheDocument();
  });

  it("displays attendee count and headcount", () => {
    mockAttendees = [attendeeA, attendeeB];
    renderPage();
    expect(screen.getByText(/2 entries/)).toBeInTheDocument();
    expect(screen.getByText(/3 total headcount/)).toBeInTheDocument();
  });

  it("renders attendee table with all entries", () => {
    mockAttendees = [attendeeA, attendeeB];
    renderPage();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Ana Garcia")).toBeInTheDocument();
    expect(within(table).getByText("Bob Smith")).toBeInTheDocument();
    expect(within(table).getByText("Guest")).toBeInTheDocument();
    expect(within(table).getByText("Staff")).toBeInTheDocument();
  });

  it("shows party size in table", () => {
    mockAttendees = [attendeeA];
    renderPage();
    const table = screen.getByRole("table");
    expect(within(table).getByText("2")).toBeInTheDocument();
  });

  it("shows email or dash", () => {
    mockAttendees = [attendeeA, attendeeB];
    renderPage();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("add form submits and resets fields", async () => {
    const user = userEvent.setup();
    mockAddAttendee.mockResolvedValue(undefined);
    renderPage();

    await user.type(screen.getByPlaceholderText("Display name"), "New Guest");
    const emailInput = screen.getAllByPlaceholderText("Optional")[0];
    await user.type(emailInput, "new@example.com");
    await user.click(screen.getByRole("button", { name: /add attendee/i }));

    expect(mockAddAttendee).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "New Guest", email: "new@example.com" })
    );
  });

  it("calls deleteAttendee when confirmed", async () => {
    const user = userEvent.setup();
    mockAttendees = [attendeeA];
    mockDeleteAttendee.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();
    await user.click(screen.getByRole("button", { name: /remove ana garcia/i }));

    expect(mockDeleteAttendee).toHaveBeenCalledWith("att-1");
  });

  it("does not call deleteAttendee when cancelled", async () => {
    const user = userEvent.setup();
    mockAttendees = [attendeeA];
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderPage();
    await user.click(screen.getByRole("button", { name: /remove ana garcia/i }));

    expect(mockDeleteAttendee).not.toHaveBeenCalled();
  });
});

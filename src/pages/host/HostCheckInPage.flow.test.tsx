import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HostCheckInPage from "./HostCheckInPage";
import type { HostAttendee, HostCheckIn } from "../../features/host/model/attendance";

/**
 * Real hooks + page against an in-memory attendanceRepo that mimics the database rules:
 * one active check-in per attendee, and reversal keeps the row as history.
 */
const db = vi.hoisted(() => ({
  attendees: [] as unknown[],
  checkIns: [] as unknown[],
  denyMutations: false,
  seq: 0,
}));

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

vi.mock("../../features/host/api/attendanceRepo", () => ({
  fetchEventAttendees: async () => structuredClone(db.attendees),
  fetchEventCheckIns: async () => structuredClone(db.checkIns),
  addEventAttendee: vi.fn(),
  updateEventAttendee: vi.fn(),
  deleteEventAttendee: vi.fn(),
  checkInAttendee: async (eventId: string, input: { attendeeId: string; method?: string }) => {
    if (db.denyMutations)
      throw new Error("You do not have permission to check in this attendee for this event.");
    const rows = db.checkIns as HostCheckIn[];
    if (rows.some((c) => c.attendeeId === input.attendeeId && !c.reversedAt)) {
      throw new Error("This attendee is already checked in.");
    }
    const row: HostCheckIn = {
      id: `ci-${++db.seq}`,
      attendeeId: input.attendeeId,
      eventId,
      checkedInAt: new Date(2026, 10, 9, 20, db.seq).toISOString(),
      checkedInBy: "user-1",
      method: (input.method as HostCheckIn["method"]) ?? "manual",
      reversedAt: null,
      reversedBy: null,
      reversalReason: null,
      createdAt: new Date(2026, 10, 9, 20, db.seq).toISOString(),
    };
    rows.unshift(row);
    return row;
  },
  reverseCheckIn: async (_eventId: string, input: { checkInId: string }) => {
    if (db.denyMutations) throw new Error("Could not undo this check-in.");
    const row = (db.checkIns as HostCheckIn[]).find((c) => c.id === input.checkInId);
    if (!row || row.reversedAt) throw new Error("Could not undo this check-in.");
    row.reversedAt = new Date(2026, 10, 9, 21, ++db.seq).toISOString();
    row.reversedBy = "user-1";
    return row;
  },
}));

const ana: HostAttendee = {
  id: "att-1",
  eventId: "evt-1",
  profileId: null,
  displayName: "Ana Garcia",
  email: null,
  category: "guest",
  source: "host",
  partySize: 2,
  notes: null,
  createdBy: "user-1",
  createdAt: "2026-08-30T10:00:00Z",
  updatedAt: "2026-08-30T10:00:00Z",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/host/events/evt-1/check-in"]}>
        <Routes>
          <Route path="/host/events/:eventId/check-in" element={<HostCheckInPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function activeCount() {
  return (db.checkIns as HostCheckIn[]).filter((c) => !c.reversedAt).length;
}

describe("HostCheckInPage check-in → undo → check-in", () => {
  beforeEach(() => {
    db.attendees = [ana];
    db.checkIns = [];
    db.denyMutations = false;
    db.seq = 0;
  });

  it("allows a mistaken check-in to be undone and repeated with history kept", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Check in Ana Garcia" }));
    expect(
      await screen.findByRole("button", { name: "Undo check-in for Ana Garcia" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 of 1 roster entry checked in · 2 of 2 headcount arrived/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo check-in for Ana Garcia" }));
    expect(await screen.findByRole("button", { name: "Check in Ana Garcia" })).toBeInTheDocument();
    expect(
      screen.getByText(/0 of 1 roster entry checked in · 0 of 2 headcount arrived/)
    ).toBeInTheDocument();
    expect(activeCount()).toBe(0);

    // Re-check-in from Recent Reversals creates a new arrival.
    const reversals = screen
      .getByRole("heading", { name: /recent reversals/i })
      .closest("section")!;
    await user.click(within(reversals).getByRole("button", { name: "Re-check-in Ana Garcia" }));
    expect(
      await screen.findByRole("button", { name: "Undo check-in for Ana Garcia" })
    ).toBeInTheDocument();

    expect(db.checkIns).toHaveLength(2);
    expect(activeCount()).toBe(1);
    expect((db.checkIns as HostCheckIn[]).filter((c) => c.reversedAt)).toHaveLength(1);
    // The reversed row remains in history but no longer offers Re-check-in.
    expect(screen.getByText(/reversed at/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /re-check-in/i })).not.toBeInTheDocument();
  });

  it("surfaces a denied mutation as an error and changes nothing", async () => {
    const user = userEvent.setup();
    db.denyMutations = true;
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Check in Ana Garcia" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/do not have permission/i);
    expect(db.checkIns).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Check in Ana Garcia" })).toBeInTheDocument();
  });
});

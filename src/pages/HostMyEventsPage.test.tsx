import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import HostMyEventsPage from "./HostMyEventsPage";

/* ── Mocks ── */

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useMySubmissions } = vi.hoisted(() => ({ useMySubmissions: vi.fn() }));
const { useMyOrganizers } = vi.hoisted(() => ({ useMyOrganizers: vi.fn() }));
const { useMyOrganizerEvents } = vi.hoisted(() => ({ useMyOrganizerEvents: vi.fn() }));
const { useEventAttendanceSummaries } = vi.hoisted(() => ({
  useEventAttendanceSummaries: vi.fn(),
}));

vi.mock("../contexts/useAuth", () => ({ useAuth }));
vi.mock("../hooks/useMySubmissions", () => ({ useMySubmissions }));
vi.mock("../features/host/hooks/useMyOrganizers", () => ({ useMyOrganizers }));
vi.mock("../features/host/hooks/useMyOrganizerEvents", () => ({ useMyOrganizerEvents }));
vi.mock("../features/host/hooks/useEventAttendanceSummaries", () => ({
  useEventAttendanceSummaries,
}));

/* ── Test data ── */

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const baseEvent: DatabaseEvent = {
  id: "base",
  title: "Havana Fridays",
  description: "Weekly salsa social",
  event_type: "social",
  event_date: futureDate,
  event_time: "20:00",
  location: "Havana Club",
  address: "123 Main St",
  price_type: "paid",
  price_amount: 15,
  rsvp_link: null,
  image_url: "https://cdn.example.com/flyer.png",
  submitter_name: null,
  submitter_email: null,
  submitter_id: "user-1",
  status: "approved",
  source_type: "organizer",
  taxonomy_term_ids: [],
  taxonomy_terms: [],
  updated_at: "2026-08-25T00:00:00Z",
  cancellation_reason: null,
  city: "boston",
  created_at: "2026-08-20T00:00:00Z",
  host: "DJ Carlos",
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  venue_id: null,
  organizer_id: "org-1",
};

const draftEvent: DatabaseEvent = {
  ...baseEvent,
  id: "draft-1",
  title: "New Year Bash",
  status: "draft",
  image_url: null,
  location: "Dance Studio",
  updated_at: "2026-08-28T00:00:00Z",
};

const pendingEvent: DatabaseEvent = {
  ...baseEvent,
  id: "pending-1",
  title: "Summer Social",
  status: "pending",
  event_date: futureDate,
};

const pastEvent: DatabaseEvent = {
  ...baseEvent,
  id: "past-1",
  title: "Last Week Party",
  status: "approved",
  event_date: pastDate,
  location: "Old Venue",
};

const cancelledEvent: DatabaseEvent = {
  ...baseEvent,
  id: "cancelled-1",
  title: "Cancelled Night",
  status: "cancelled",
  cancellation_reason: "Venue closed",
};

/* ── Mock helpers ── */

function mockOrganizerData(role: "owner" | "manager" | "editor" = "owner") {
  vi.mocked(useMyOrganizers).mockReturnValue({
    data: [
      {
        organizerId: "org-1",
        organizerName: "Boston Salsa Collective",
        organizerSlug: "boston-salsa",
        organizerStatus: "active",
        memberRole: role,
      },
    ],
    isLoading: false,
  });
}

function mockMultipleOrganizers() {
  vi.mocked(useMyOrganizers).mockReturnValue({
    data: [
      {
        organizerId: "org-1",
        organizerName: "Boston Salsa Collective",
        organizerSlug: "boston-salsa",
        organizerStatus: "active",
        memberRole: "owner",
      },
      {
        organizerId: "org-2",
        organizerName: "NYC Dance Crew",
        organizerSlug: "nyc-dance",
        organizerStatus: "active",
        memberRole: "manager",
      },
    ],
    isLoading: false,
  });
}

function mockEvents(events: DatabaseEvent[]) {
  const submissions = events.filter((e) => e.status === "pending");
  const approved = events.filter((e) => e.status === "approved");
  const organizerEvts = events.filter(
    (e) => e.source_type === "organizer" || e.status === "draft"
  );

  vi.mocked(useMySubmissions).mockReturnValue({
    submissions,
    approvedEvents: approved,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });

  vi.mocked(useMyOrganizerEvents).mockReturnValue({
    events: organizerEvts,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
}

function mockAttendance(summaries: Map<string, { attendeeCount: number; checkedInCount: number }>) {
  vi.mocked(useEventAttendanceSummaries).mockReturnValue({
    summaries,
    isLoading: false,
    error: null,
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/host/events"]}>
      <HostMyEventsPage />
    </MemoryRouter>
  );
}

/* ── Tests ── */

describe("HostMyEventsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: "user-1" }, role: "organizer" });
    mockOrganizerData("owner");
    mockEvents([baseEvent, draftEvent]);
    mockAttendance(new Map());
  });

  /* ── Header ── */

  it("renders the page title", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "My Events" })).toBeInTheDocument();
  });

  it("shows Create Event button for owner", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /\+ Create Event/ })).toBeInTheDocument();
  });

  it("shows View only for editor", () => {
    mockOrganizerData("editor");
    renderPage();
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /\+ Create Event/ })).not.toBeInTheDocument();
  });

  it("shows empty state when no events", () => {
    mockEvents([]);
    renderPage();
    expect(screen.getByText("No events yet")).toBeInTheDocument();
  });

  it("shows empty filter message", async () => {
    mockEvents([baseEvent]);
    renderPage();

    await screen.findByText("Havana Fridays");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Drafts/ }));

    expect(screen.getByText(/No drafts events found/)).toBeInTheDocument();
  });

  /* ── Grouping ── */

  it("groups events into Upcoming, Drafts, Past, Cancelled", async () => {
    mockEvents([baseEvent, draftEvent, pastEvent, cancelledEvent]);
    renderPage();

    expect(await screen.findByText("Havana Fridays")).toBeInTheDocument();
    expect(screen.getByText("New Year Bash")).toBeInTheDocument();
    expect(screen.getByText("Last Week Party")).toBeInTheDocument();
    expect(screen.getByText("Cancelled Night")).toBeInTheDocument();

    expect(document.getElementById("group-upcoming")).toBeInTheDocument();
    expect(document.getElementById("group-drafts")).toBeInTheDocument();
    expect(document.getElementById("group-past")).toBeInTheDocument();
    expect(document.getElementById("group-cancelled")).toBeInTheDocument();
  });

  /* ── Search ── */

  it("filters events by search query", async () => {
    mockEvents([baseEvent, draftEvent, pastEvent]);
    renderPage();

    await screen.findByText("Havana Fridays");
    expect(screen.getByText("New Year Bash")).toBeInTheDocument();
    expect(screen.getByText("Last Week Party")).toBeInTheDocument();

    const user = userEvent.setup();
    const searchInput = screen.getByLabelText("Search events");
    await user.type(searchInput, "Havana");

    await vi.waitFor(() => {
      expect(screen.getByText("Havana Fridays")).toBeInTheDocument();
      expect(screen.queryByText("New Year Bash")).not.toBeInTheDocument();
      expect(screen.queryByText("Last Week Party")).not.toBeInTheDocument();
    });
  });

  it("searches by location", async () => {
    mockEvents([baseEvent, draftEvent]);
    renderPage();

    await screen.findByText("Havana Fridays");
    expect(screen.getByText("New Year Bash")).toBeInTheDocument();

    const user = userEvent.setup();
    const searchInput = screen.getByLabelText("Search events");
    await user.type(searchInput, "Havana Club");

    await vi.waitFor(() => {
      expect(screen.getByText("Havana Fridays")).toBeInTheDocument();
      expect(screen.queryByText("New Year Bash")).not.toBeInTheDocument();
    });
  });

  /* ── Filters ── */

  it("filters by Upcoming", async () => {
    mockEvents([baseEvent, pastEvent]);
    renderPage();

    await screen.findByText("Havana Fridays");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Upcoming/ }));

    expect(screen.getByText("Havana Fridays")).toBeInTheDocument();
    expect(screen.queryByText("Last Week Party")).not.toBeInTheDocument();
  });

  it("filters by Drafts", async () => {
    mockEvents([baseEvent, draftEvent]);
    renderPage();

    await screen.findByText("Havana Fridays");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Drafts/ }));

    expect(screen.queryByText("Havana Fridays")).not.toBeInTheDocument();
    expect(screen.getByText("New Year Bash")).toBeInTheDocument();
  });

  it("filters by Past", async () => {
    mockEvents([baseEvent, pastEvent]);
    renderPage();

    await screen.findByText("Havana Fridays");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Past/ }));

    expect(screen.queryByText("Havana Fridays")).not.toBeInTheDocument();
    expect(screen.getByText("Last Week Party")).toBeInTheDocument();
  });

  /* ── Status badges ── */

  it("shows status badge for each event", () => {
    mockEvents([baseEvent, draftEvent, pendingEvent]);
    renderPage();

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
  });

  /* ── Event card content ── */

  it("shows date and location in event card", async () => {
    renderPage();
    expect(await screen.findByText("Havana Fridays")).toBeInTheDocument();
    expect(screen.getAllByText("Havana Club").length).toBeGreaterThanOrEqual(1);
  });

  it("shows flyer image when available", async () => {
    renderPage();
    const img = await screen.findByRole("img", { name: /Havana Fridays flyer/ });
    expect(img).toHaveAttribute("src", "https://cdn.example.com/flyer.png");
  });

  it("shows fallback when no flyer", async () => {
    mockEvents([draftEvent]);
    renderPage();
    expect(await screen.findByText("New Year Bash")).toBeInTheDocument();
    expect(screen.getByText("💃")).toBeInTheDocument();
  });

  /* ── Attendance ── */

  it("shows real attendee and check-in counts", async () => {
    mockEvents([baseEvent]);
    mockAttendance(
      new Map([["base", { attendeeCount: 24, checkedInCount: 18 }]])
    );
    renderPage();

    expect(await screen.findByText("24 attendees")).toBeInTheDocument();
    expect(screen.getByText("18 checked in")).toBeInTheDocument();
  });

  it("shows zero attendees state", async () => {
    mockEvents([baseEvent]);
    mockAttendance(
      new Map([["base", { attendeeCount: 0, checkedInCount: 0 }]])
    );
    renderPage();

    expect(await screen.findByText("No attendees yet")).toBeInTheDocument();
  });

  it("shows attendance unavailable on query failure", async () => {
    mockEvents([baseEvent]);
    vi.mocked(useEventAttendanceSummaries).mockReturnValue({
      summaries: new Map(),
      isLoading: false,
      error: "Failed to load",
    });
    renderPage();

    await vi.waitFor(() => {
      expect(screen.getByText("Havana Fridays")).toBeInTheDocument();
      expect(screen.getByText("Attendance unavailable")).toBeInTheDocument();
    });
  });

  /* ── Navigation ── */

  it("links Manage Event to host event detail for owner", async () => {
    mockEvents([baseEvent]);
    renderPage();

    expect(await screen.findByRole("link", { name: "Manage Event" })).toHaveAttribute(
      "href",
      "/host/events/base"
    );
  });

  it("links View Event for editor", async () => {
    mockOrganizerData("editor");
    mockEvents([baseEvent]);
    renderPage();

    expect(await screen.findByRole("link", { name: "View Event" })).toHaveAttribute(
      "href",
      "/events/base"
    );
  });

  /* ── Organizer filter ── */

  it("shows organizer filter for multiple organizers", async () => {
    mockMultipleOrganizers();
    mockEvents([baseEvent]);
    renderPage();

    expect(await screen.findByLabelText("Filter by organizer")).toBeInTheDocument();
  });

  it("hides organizer filter for single organizer", () => {
    mockOrganizerData("owner");
    mockEvents([baseEvent]);
    renderPage();

    expect(screen.queryByLabelText("Filter by organizer")).not.toBeInTheDocument();
  });

  /* ── Loading ── */

  it("shows loading state", () => {
    vi.mocked(useMySubmissions).mockReturnValue({
      submissions: [],
      approvedEvents: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  /* ── Error ── */

  it("shows error with retry", async () => {
    const refetch = vi.fn();
    vi.mocked(useMySubmissions).mockReturnValue({
      submissions: [],
      approvedEvents: [],
      isLoading: false,
      error: "Network error",
      refetch,
    });
    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalled();
  });
});

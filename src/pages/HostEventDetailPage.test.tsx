import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import HostEventDetailPage from "./HostEventDetailPage";
import RequireOrganizer from "../components/Auth/RequireOrganizer";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useMySubmissions } = vi.hoisted(() => ({ useMySubmissions: vi.fn() }));
const { useMyOrganizers } = vi.hoisted(() => ({ useMyOrganizers: vi.fn() }));
const { useMyOrganizerEvents } = vi.hoisted(() => ({ useMyOrganizerEvents: vi.fn() }));
const { useEventAttendees } = vi.hoisted(() => ({ useEventAttendees: vi.fn() }));
const { useEventCheckIns } = vi.hoisted(() => ({ useEventCheckIns: vi.fn() }));

vi.mock("../contexts/useAuth", () => ({ useAuth }));
vi.mock("../hooks/useMySubmissions", () => ({ useMySubmissions }));
vi.mock("../features/host/hooks/useMyOrganizers", () => ({ useMyOrganizers }));
vi.mock("../features/host/hooks/useMyOrganizerEvents", () => ({ useMyOrganizerEvents }));
vi.mock("../features/host/hooks/useEventAttendees", () => ({ useEventAttendees }));
vi.mock("../features/host/hooks/useEventCheckIns", () => ({ useEventCheckIns }));

/* ── Test data ── */

const baseEvent: DatabaseEvent = {
  id: "base",
  title: "Havana Nights Social",
  description: "Weekly salsa and bachata social with live DJ sets.",
  event_type: "social",
  event_date: "2026-09-18T20:00:00Z",
  event_time: "20:00",
  location: "The Grand Ballroom",
  address: "1 Main St, Boston, MA",
  price_type: "paid",
  price_amount: 20,
  rsvp_link: "https://tickets.example.com/havana",
  image_url: "https://cdn.example.com/flyer.png",
  submitter_name: "Carlos",
  submitter_email: "carlos@example.com",
  submitter_id: "owner-1",
  status: "pending",
  source_type: "organizer",
  taxonomy_term_ids: ["style-1"],
  taxonomy_terms: [
    { id: "style-1", name: "Salsa", slug: "salsa", category: "dance_style", status: "active" },
  ],
  updated_at: "2026-08-25T00:00:00Z",
  cancellation_reason: null,
  city: "boston",
  created_at: "2026-08-20T00:00:00Z",
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: "host@example.com",
  contact_instagram: "@havanaclub",
  contact_website: "https://havanaclub.com",
  venue_id: null,
};

const draftEvent: DatabaseEvent = { ...baseEvent, id: "draft-1", status: "draft", image_url: null };
const approvedEvent: DatabaseEvent = { ...baseEvent, id: "approved-1", status: "approved" };
const rejectedEvent: DatabaseEvent = { ...baseEvent, id: "rejected-1", status: "rejected" };
const cancelledEvent: DatabaseEvent = {
  ...baseEvent,
  id: "cancelled-1",
  status: "cancelled",
  cancellation_reason: "Venue unavailable",
};

/* ── Mock helpers ── */

type OwnerEventState = {
  submissions: DatabaseEvent[];
  approvedEvents: DatabaseEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

function mockOwnerEvents(overrides: Partial<OwnerEventState> = {}) {
  vi.mocked(useMySubmissions).mockReturnValue({
    submissions: [baseEvent, draftEvent, rejectedEvent],
    approvedEvents: [approvedEvent],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  });
}

function mockOrganizerData(role: "owner" | "manager" | "editor" = "owner", events?: DatabaseEvent[]) {
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
  vi.mocked(useMyOrganizerEvents).mockReturnValue({
    events: events ?? [
      { ...baseEvent, organizer_id: "org-1" },
      { ...draftEvent, organizer_id: "org-1" },
      { ...rejectedEvent, organizer_id: "org-1" },
      { ...approvedEvent, organizer_id: "org-1" },
      { ...cancelledEvent, organizer_id: "org-1" },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
}

function renderDetail(eventId: string, state?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/host/events/${eventId}`, state }]}>
      <Routes>
        <Route path="/host/events/:eventId" element={<HostEventDetailPage />} />
        <Route path="/host/events" element={<div>Host My Events page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/* ── Tests ── */

describe("HostEventDetailPage — Operations Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: "owner-1" }, role: "organizer" });
    mockOrganizerData("owner");
    mockOwnerEvents();
    vi.mocked(useEventAttendees).mockReturnValue({
      attendees: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      addAttendee: vi.fn(),
      isAdding: false,
      updateAttendee: vi.fn(),
      isUpdating: false,
      deleteAttendee: vi.fn(),
      isDeleting: false,
    });
    vi.mocked(useEventCheckIns).mockReturnValue({
      checkIns: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      checkIn: vi.fn(),
      isCheckingIn: false,
      reverseCheckIn: vi.fn(),
      isReversing: false,
    });
  });

  /* ── Header ── */

  it("renders the event title and status badge", async () => {
    renderDetail("base");

    expect(await screen.findByRole("heading", { name: "Havana Nights Social" })).toBeInTheDocument();
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
  });

  it("shows the date and location in the meta line", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getAllByText(/September 18, 2026/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/The Grand Ballroom/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows the organizer context", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getByText("Boston Salsa Collective")).toBeInTheDocument();
  });

  /* ── Status messages ── */

  it("shows draft status message", async () => {
    renderDetail("draft-1");

    expect(await screen.findByRole("heading", { name: "Havana Nights Social" })).toBeInTheDocument();
    expect(screen.getByText(/saved as a draft/i)).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows pending status message", async () => {
    renderDetail("base");

    expect(await screen.findByText("Pending Approval")).toBeInTheDocument();
    expect(screen.getByText(/awaiting review/i)).toBeInTheDocument();
  });

  it("shows approved status message", async () => {
    renderDetail("approved-1");

    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(screen.getByText(/published on salsasegura/i)).toBeInTheDocument();
  });

  it("shows rejected status message", async () => {
    renderDetail("rejected-1");

    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/was not approved/i)).toBeInTheDocument();
  });

  it("shows cancelled status with cancellation reason", async () => {
    // Override both submissions AND organizerEvents to use the cancelled event
    const cancelled = { ...cancelledEvent, organizer_id: "org-1" };
    mockOrganizerData("owner", [cancelled]);
    mockOwnerEvents({
      submissions: [cancelled],
      approvedEvents: [],
    });

    renderDetail("cancelled-1");

    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText(/venue unavailable/i)).toBeInTheDocument();
  });

  /* ── Overview section ── */

  it("renders overview with date, time, location, type, styles, and price", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Event Type")).toBeInTheDocument();
    expect(screen.getByText("Dance Styles")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
    expect(screen.getByText("Salsa")).toBeInTheDocument();
    expect(screen.getByText("$20")).toBeInTheDocument();
  });

  it("renders recurrence when set to weekly", async () => {
    const weeklyEvent = { ...baseEvent, recurrence: "weekly", organizer_id: "org-1" };
    mockOrganizerData("owner", [weeklyEvent]);
    mockOwnerEvents({
      submissions: [weeklyEvent],
      approvedEvents: [],
    });

    renderDetail("base");
    await screen.findByRole("heading", { name: "Overview" });
    expect(screen.getByText("Recurrence")).toBeInTheDocument();
    expect(screen.getByText("Repeats weekly")).toBeInTheDocument();
  });

  it("shows city in overview", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Overview" });
    expect(screen.getByText("City")).toBeInTheDocument();
    expect(screen.getByText("Boston")).toBeInTheDocument();
  });

  /* ── Flyer ── */

  it("shows the flyer image when present", async () => {
    renderDetail("base");

    const flyer = await screen.findByRole("img", { name: /flyer/i });
    expect(flyer).toHaveAttribute("src", "https://cdn.example.com/flyer.png");
  });

  it("shows fallback artwork when no image", async () => {
    const noImage = { ...draftEvent, organizer_id: "org-1" };
    mockOrganizerData("owner", [noImage]);
    mockOwnerEvents({
      submissions: [noImage],
      approvedEvents: [],
    });

    renderDetail("draft-1");
    await screen.findByRole("heading", { name: "Havana Nights Social" });

    expect(screen.getByRole("heading", { name: "Event Flyer" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Salsa Segura artwork for Havana Nights Social" })).toBeInTheDocument();
  });

  it("shows Manage Flyer link for owner/manager", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getByRole("link", { name: /Manage Flyer/i })).toHaveAttribute(
      "href",
      "/host/events/base/edit"
    );
  });

  it("hides Manage Flyer for editor", async () => {
    mockOrganizerData("editor");

    renderDetail("base");
    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.queryByRole("link", { name: /Manage Flyer/i })).not.toBeInTheDocument();
  });

  /* ── Description ── */

  it("renders description when present", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getByRole("heading", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByText("Weekly salsa and bachata social with live DJ sets.")).toBeInTheDocument();
  });

  it("hides description when absent", async () => {
    const noDesc = { ...baseEvent, description: null, organizer_id: "org-1" };
    mockOrganizerData("owner", [noDesc]);
    mockOwnerEvents({
      submissions: [noDesc],
      approvedEvents: [],
    });

    renderDetail("base");
    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.queryByRole("heading", { name: "Description" })).not.toBeInTheDocument();
  });

  /* ── Links & Contact ── */

  it("shows public event link for approved events", async () => {
    renderDetail("approved-1");

    await screen.findByRole("heading", { name: "Links & Contact" });
    expect(screen.getByRole("link", { name: /View public event/i })).toHaveAttribute("href", "/events/approved-1");
  });

  it("hides public event link for non-approved events", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Links & Contact" });
    expect(screen.queryByRole("link", { name: /View public event/i })).not.toBeInTheDocument();
  });

  it("shows RSVP link when present", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Links & Contact" });
    expect(screen.getByText("RSVP / Tickets")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Link/i })).toHaveAttribute("href", "https://tickets.example.com/havana");
  });

  it("shows empty RSVP state when no link", async () => {
    const noRsvp = { ...baseEvent, rsvp_link: null, organizer_id: "org-1" };
    mockOrganizerData("owner", [noRsvp]);
    mockOwnerEvents({
      submissions: [noRsvp],
      approvedEvents: [],
    });

    renderDetail("base");
    await screen.findByRole("heading", { name: "Links & Contact" });
    expect(screen.getByText(/no ticket link added/i)).toBeInTheDocument();
  });

  it("shows contact fields when present", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Links & Contact" });
    expect(screen.getByText("host@example.com")).toBeInTheDocument();
    expect(screen.getByText("@havanaclub")).toBeInTheDocument();
    expect(screen.getByText("havanaclub.com")).toBeInTheDocument();
  });

  it("shows empty contact states when fields absent", async () => {
    const noContacts = {
      ...baseEvent,
      contact_email: null,
      contact_instagram: null,
      contact_website: null,
      organizer_id: "org-1",
    };
    mockOrganizerData("owner", [noContacts]);
    mockOwnerEvents({
      submissions: [noContacts],
      approvedEvents: [],
    });

    renderDetail("base");
    await screen.findByRole("heading", { name: "Links & Contact" });
    expect(screen.getByText(/no contact email added/i)).toBeInTheDocument();
    expect(screen.getByText(/no instagram added/i)).toBeInTheDocument();
    expect(screen.getByText(/no website added/i)).toBeInTheDocument();
  });

  /* ── Event Operations ── */

  it("shows operations section with attendees and check-in links", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Event Operations" });
    expect(screen.getByText("Attendees")).toBeInTheDocument();
    expect(screen.getByText("Check-in")).toBeInTheDocument();
    expect(screen.getByText(/no attendees yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no one checked in yet/i)).toBeInTheDocument();
  });

  /* ── Actions ── */

  it("shows Edit Event for owner", async () => {
    renderDetail("base");

    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getByRole("link", { name: /Edit Event/i })).toHaveAttribute("href", "/host/events/base/edit");
  });

  it("shows Edit Event for manager", async () => {
    mockOrganizerData("manager");

    renderDetail("base");
    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getByRole("link", { name: /Edit Event/i })).toHaveAttribute("href", "/host/events/base/edit");
  });

  it("shows View only for editor", async () => {
    mockOrganizerData("editor");

    renderDetail("base");
    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Edit Event/i })).not.toBeInTheDocument();
  });

  it("shows Share and Edit Event for approved events owned by owner", async () => {
    renderDetail("approved-1");

    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getByText("Share and promote")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy event link" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit Event/i })).toHaveAttribute("href", "/host/events/approved-1/edit");
  });

  it("shows revise action for rejected events for submitter", async () => {
    // No organizer membership — user is a submitter, not an organizer member
    vi.mocked(useMyOrganizers).mockReturnValue({ data: [], isLoading: false });
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderDetail("rejected-1");
    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getByRole("link", { name: /Revise event/i })).toHaveAttribute(
      "href",
      "/profile/edit/rejected-1"
    );
  });

  /* ── No fake metrics ── */

  it("renders no attendance, registration, capacity, or door-mode UI", async () => {
    renderDetail("base");
    await screen.findByRole("heading", { name: "Havana Nights Social" });

    expect(screen.queryByText(/attendance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/registered/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/door mode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/waitlist/i)).not.toBeInTheDocument();
  });

  /* ── Back link ── */

  it("provides an accessible back link to My Events", async () => {
    renderDetail("base");

    expect(await screen.findByRole("link", { name: /my events/i })).toHaveAttribute("href", "/host/events");
  });

  /* ── Flyer warning ── */

  it("renders a flyer warning passed from create", async () => {
    renderDetail("approved-1", { flyerWarning: "Event saved, but we couldn't attach the flyer." });

    expect(await screen.findByRole("status")).toHaveTextContent(/couldn't attach the flyer/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  /* ── Navigation ── */

  it("redirects to My Events for an unknown event id", async () => {
    renderDetail("does-not-exist");

    expect(await screen.findByText("Host My Events page")).toBeInTheDocument();
    expect(screen.queryByText("Havana Nights Social")).not.toBeInTheDocument();
  });

  it("redirects to My Events for an unowned event id", async () => {
    mockOrganizerData("owner", []);
    mockOwnerEvents({ submissions: [], approvedEvents: [] });

    renderDetail("someone-elses-event");

    expect(await screen.findByText("Host My Events page")).toBeInTheDocument();
    expect(screen.queryByText("Havana Nights Social")).not.toBeInTheDocument();
  });

  /* ── Legacy dance styles ── */

  it("shows legacy dance_styles when no taxonomy terms", async () => {
    const legacyStyles = {
      ...baseEvent,
      taxonomy_term_ids: [],
      taxonomy_terms: [],
      dance_styles: ["salsa", "bachata"],
      organizer_id: "org-1",
    } as DatabaseEvent;
    mockOrganizerData("owner", [legacyStyles]);
    mockOwnerEvents({
      submissions: [legacyStyles],
      approvedEvents: [],
    });

    renderDetail("base");
    await screen.findByRole("heading", { name: "Havana Nights Social" });

    expect(screen.getByText("Dance Styles")).toBeInTheDocument();
    expect(screen.getByText("Salsa")).toBeInTheDocument();
    expect(screen.getByText("Bachata")).toBeInTheDocument();
  });

  /* ── Host field ── */

  it("shows host name when present", async () => {
    const withHost = { ...baseEvent, host: "DJ Mambo", organizer_id: "org-1" };
    mockOrganizerData("owner", [withHost]);
    mockOwnerEvents({
      submissions: [withHost],
      approvedEvents: [],
    });

    renderDetail("base");
    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.getByText("DJ Mambo")).toBeInTheDocument();
  });

  it("hides host section when absent", async () => {
    renderDetail("base");
    await screen.findByRole("heading", { name: "Havana Nights Social" });
    expect(screen.queryByText("Host")).not.toBeInTheDocument();
  });

  /* ── Loading / Error ── */

  it("shows a loading state", () => {
    mockOwnerEvents({ isLoading: true });

    renderDetail("base");

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("shows a query failure state with retry", async () => {
    const refetch = vi.fn();
    mockOwnerEvents({
      submissions: [],
      approvedEvents: [],
      error: "Network error",
      refetch,
    });

    renderDetail("base");

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

describe("HostEventDetailPage — Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: "owner-1" }, role: "organizer" });
    vi.mocked(useMyOrganizers).mockReturnValue({ data: [], isLoading: false });
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockOwnerEvents();
  });

  function renderGuarded() {
    return render(
      <MemoryRouter initialEntries={["/host/events/base"]}>
        <Routes>
          <Route
            path="/host/events/:eventId"
            element={
              <RequireOrganizer>
                <HostEventDetailPage />
              </RequireOrganizer>
            }
          />
          <Route path="/" element={<div>Public home</div>} />
          <Route path="/signin" element={<div>Sign in</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("admits the organizer role", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "owner-1" },
      loading: false,
      isOrganizer: true,
    });
    mockOrganizerData("owner");
    mockOwnerEvents();
    renderGuarded();

    expect(
      await screen.findByRole("heading", { name: "Havana Nights Social" })
    ).toBeInTheDocument();
  });

  it("keeps non-organizers out", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "admin-1" },
      loading: false,
      isOrganizer: false,
    });
    renderGuarded();

    expect(await screen.findByText("Public home")).toBeInTheDocument();
  });
});

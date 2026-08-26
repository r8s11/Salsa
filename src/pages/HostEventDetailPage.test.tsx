import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import HostEventDetailPage from "./HostEventDetailPage";
import RequireOrganizer from "../components/Auth/RequireOrganizer";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useMySubmissions } = vi.hoisted(() => ({ useMySubmissions: vi.fn() }));

vi.mock("../contexts/useAuth", () => ({ useAuth }));
vi.mock("../hooks/useMySubmissions", () => ({ useMySubmissions }));

const baseEvent: DatabaseEvent = {
  id: "base",
  title: "Havana Nights Social",
  description: "Weekly salsa and bachata social with live DJ sets.",
  event_type: "social",
  event_date: "2026-09-01T20:00:00Z",
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
  contact_instagram: null,
  contact_website: null,
  venue_id: null,
};

const rejectedEvent: DatabaseEvent = { ...baseEvent, id: "rejected-1", status: "rejected" };
const approvedEvent: DatabaseEvent = { ...baseEvent, id: "approved-1", status: "approved" };

type OwnerEventState = {
  submissions: DatabaseEvent[];
  approvedEvents: DatabaseEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

function mockOwnerEvents(overrides: Partial<OwnerEventState> = {}) {
  vi.mocked(useMySubmissions).mockReturnValue({
    submissions: [baseEvent, rejectedEvent],
    approvedEvents: [approvedEvent],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  });
}

function renderDetail(eventId: string) {
  return render(
    <MemoryRouter initialEntries={[`/host/events/${eventId}`]}>
      <Routes>
        <Route path="/host/events/:eventId" element={<HostEventDetailPage />} />
        <Route path="/host/events" element={<div>Host My Events page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HostEventDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: "owner-1" }, role: "organizer" });
    mockOwnerEvents();
  });

  it("loads an owned pending event with truthful status and edit action", async () => {
    renderDetail("base");

    expect(
      await screen.findByRole("heading", { name: "Havana Nights Social" })
    ).toBeInTheDocument();
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit submission/i })).toHaveAttribute(
      "href",
      "/profile/edit/base"
    );
    expect(screen.queryByText("Share and promote")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Revise submission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View public event/i })).not.toBeInTheDocument();
  });

  it("loads an owned rejected event with truthful status and revise action", async () => {
    renderDetail("rejected-1");

    expect(
      await screen.findByRole("heading", { name: "Havana Nights Social" })
    ).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Revise submission/i })).toHaveAttribute(
      "href",
      "/profile/edit/rejected-1"
    );
  });

  it("loads an owned approved event with truthful status and public link, no edit/withdraw controls", async () => {
    renderDetail("approved-1");

    expect(
      await screen.findByRole("heading", { name: "Havana Nights Social" })
    ).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View public event/i })).toHaveAttribute(
      "href",
      "/events/approved-1"
    );
    expect(screen.getByText("Share and promote")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy event link" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Edit submission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Revise submission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /withdraw/i })).not.toBeInTheDocument();
  });

  it("redirects to My Events for an unknown event id without flashing private data", async () => {
    renderDetail("does-not-exist");

    expect(await screen.findByText("Host My Events page")).toBeInTheDocument();
    expect(screen.queryByText("Havana Nights Social")).not.toBeInTheDocument();
  });

  it("redirects to My Events for an unowned event id, identical to unknown", async () => {
    mockOwnerEvents({ submissions: [], approvedEvents: [] });

    renderDetail("someone-elses-event");

    expect(await screen.findByText("Host My Events page")).toBeInTheDocument();
    expect(screen.queryByText("Havana Nights Social")).not.toBeInTheDocument();
  });

  it("provides an accessible back link to My Events", async () => {
    renderDetail("base");

    expect(await screen.findByRole("link", { name: /my events/i })).toHaveAttribute(
      "href",
      "/host/events"
    );
  });

  it("renders no attendance, registration, capacity, or door-mode UI", async () => {
    renderDetail("base");
    await screen.findByRole("heading", { name: "Havana Nights Social" });

    expect(screen.queryByText(/attendance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/registered/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/capacity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/door mode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/check.?in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/waitlist/i)).not.toBeInTheDocument();
  });

  it("shows the flyer image when present", async () => {
    renderDetail("base");

    const flyer = await screen.findByRole("img", { name: /flyer/i });
    expect(flyer).toHaveAttribute("src", "https://cdn.example.com/flyer.png");
  });

  it("omits the flyer, RSVP link, and description gracefully when absent", async () => {
    mockOwnerEvents({
      submissions: [
        { ...baseEvent, image_url: null, rsvp_link: null, description: null },
        rejectedEvent,
      ],
      approvedEvents: [approvedEvent],
    });

    renderDetail("base");
    await screen.findByRole("heading", { name: "Havana Nights Social" });

    expect(screen.queryByRole("img", { name: /flyer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /rsvp/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
  });

  it("shows a loading state before the owner-scoped query resolves", () => {
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

describe("HostEventDetailPage guarded by RequireOrganizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

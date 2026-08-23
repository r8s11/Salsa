import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { DatabaseEvent } from "../../features/events/model/types";
import HostDashboard from "./HostDashboard";
import RequireOrganizer from "../Auth/RequireOrganizer";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useMySubmissions } = vi.hoisted(() => ({ useMySubmissions: vi.fn() }));

vi.mock("../../contexts/useAuth", () => ({ useAuth }));
vi.mock("../../hooks/useMySubmissions", () => ({ useMySubmissions }));

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

const baseEvent: DatabaseEvent = {
  id: "base",
  title: "Base Event",
  description: null,
  event_type: "social",
  event_date: daysFromNow(10),
  event_time: "20:00",
  location: "Havana Club",
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  submitter_name: null,
  submitter_email: null,
  submitter_id: "user-1",
  status: "approved",
  source_type: "user_submission",
  taxonomy_term_ids: [],
  taxonomy_terms: [],
  updated_at: "2026-08-01T00:00:00Z",
  cancellation_reason: null,
  city: "boston",
  created_at: "2026-08-01T00:00:00Z",
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  venue_id: null,
};

const nextApproved: DatabaseEvent = {
  ...baseEvent,
  id: "next-approved",
  title: "Rooftop Social",
  event_date: daysFromNow(3),
};
const laterPending: DatabaseEvent = {
  ...baseEvent,
  id: "later-pending",
  title: "Mambo Workshop",
  status: "pending",
  event_date: daysFromNow(20),
};
const pastApproved: DatabaseEvent = {
  ...baseEvent,
  id: "past-approved",
  title: "Old Social",
  event_date: daysFromNow(-9),
};

function mockOwnerEvents(overrides: Record<string, unknown> = {}) {
  vi.mocked(useMySubmissions).mockReturnValue({
    submissions: [laterPending],
    approvedEvents: [nextApproved, pastApproved],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/host"]}>
      <HostDashboard />
    </MemoryRouter>
  );
}

describe("HostDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: "user-1" }, role: "organizer" });
    mockOwnerEvents();
  });

  it("leads with the nearest upcoming owner event", async () => {
    renderDashboard();

    const next = await screen.findByLabelText("Next event");
    expect(next).toHaveTextContent("Rooftop Social");
    expect(next).toHaveTextContent("Havana Club");
    expect(next).toHaveTextContent("Approved");
  });

  it("counts only the owner's upcoming and pending events", async () => {
    renderDashboard();

    expect(await screen.findByLabelText(/Upcoming Events: 2\./)).toBeInTheDocument();
    expect(screen.getByLabelText(/Awaiting Review: 1\./)).toBeInTheDocument();
    expect(screen.getByLabelText(/Total Events: 3\./)).toBeInTheDocument();
  });
  it("routes pending events to the owner editor and published events to the calendar", async () => {
    renderDashboard();

    const others = within(await screen.findByLabelText("Your other events"));
    expect(others.getByRole("link", { name: "Edit event" })).toHaveAttribute(
      "href",
      "/profile/edit/later-pending"
    );
    expect(others.getByRole("link", { name: "View event" })).toHaveAttribute(
      "href",
      "/calendar?event=past-approved&city=boston"
    );
  });

  it("invites a first submission when nothing is scheduled", async () => {
    mockOwnerEvents({ submissions: [], approvedEvents: [] });
    renderDashboard();

    expect(await screen.findByText("No upcoming events yet")).toBeInTheDocument();
  });

  it("surfaces a load failure instead of empty metrics", async () => {
    mockOwnerEvents({ submissions: [], approvedEvents: [], error: "Network error" });
    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your events.");
  });
});

describe("RequireOrganizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOwnerEvents();
  });

  function renderGuardedHost() {
    return render(
      <MemoryRouter initialEntries={["/host"]}>
        <Routes>
          <Route
            path="/host"
            element={
              <RequireOrganizer>
                <HostDashboard />
              </RequireOrganizer>
            }
          />
          <Route path="/" element={<div>Public home</div>} />
          <Route path="/signin" element={<div>Sign in</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("admits the organizer role that Host represents", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      isOrganizer: true,
    });
    renderGuardedHost();

    expect(await screen.findByRole("heading", { name: "Host dashboard" })).toBeInTheDocument();
  });

  it("keeps admins and moderators out of the owner-scoped Host area", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "admin-1" },
      loading: false,
      isOrganizer: false,
    });
    renderGuardedHost();

    expect(await screen.findByText("Public home")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign in", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, isOrganizer: false });
    renderGuardedHost();

    expect(await screen.findByText("Sign in")).toBeInTheDocument();
  });
});

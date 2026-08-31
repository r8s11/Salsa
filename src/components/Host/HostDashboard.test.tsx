import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { DatabaseEvent } from "../../features/events/model/types";
import HostDashboard from "./HostDashboard";
import RequireOrganizer from "../Auth/RequireOrganizer";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useMySubmissions } = vi.hoisted(() => ({ useMySubmissions: vi.fn() }));
const { useMyOrganizers } = vi.hoisted(() => ({ useMyOrganizers: vi.fn() }));

vi.mock("../../contexts/useAuth", () => ({ useAuth }));
const { useMyOrganizerEvents } = vi.hoisted(() => ({ useMyOrganizerEvents: vi.fn() }));

vi.mock("../../hooks/useMySubmissions", () => ({ useMySubmissions }));
vi.mock("../../features/host/hooks/useMyOrganizers", () => ({ useMyOrganizers }));
vi.mock("../../features/host/hooks/useMyOrganizerEvents", () => ({ useMyOrganizerEvents }));

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

function mockMyOrganizers(overrides: Record<string, unknown> = {}) {
  vi.mocked(useMyOrganizers).mockReturnValue({
    data: [],
    isLoading: false,
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
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useAuth).mockReturnValue({ user: { id: "user-1" }, role: "organizer" });
    mockOwnerEvents();
    mockMyOrganizers();
  });

  it("leads with the nearest upcoming owner event", async () => {
    renderDashboard();

    const next = await screen.findByLabelText("Next event");
    expect(next).toHaveTextContent("Rooftop Social");
    expect(next).toHaveTextContent("Havana Club");
    expect(next).toHaveTextContent("Approved");
  });

  it("frames the real next event in the Host workspace", async () => {
    renderDashboard();

    expect(await screen.findByText("Host workspace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submit an event" })).toHaveAttribute(
      "href",
      "/submit"
    );
  });

  it("counts only the owner's upcoming and pending events", async () => {
    renderDashboard();

    expect(await screen.findByLabelText(/Upcoming Events: 2\./)).toBeInTheDocument();
    expect(screen.getByLabelText(/Awaiting Review: 1\./)).toBeInTheDocument();
    expect(screen.getByLabelText(/Total Events: 3\./)).toBeInTheDocument();
  });

  it("counts rejected owner submissions that require revision", async () => {
    mockOwnerEvents({
      submissions: [{ ...laterPending, id: "rejected-1", status: "rejected" }],
      approvedEvents: [nextApproved],
    });
    renderDashboard();

    expect(await screen.findByLabelText(/Requires Revision: 1\./)).toBeInTheDocument();
  });
  it("routes pending events to the owner editor and published events to their public page", async () => {
    renderDashboard();

    const others = within(await screen.findByLabelText("Your other events"));
    expect(others.getByRole("link", { name: "Edit submission" })).toHaveAttribute(
      "href",
      "/profile/edit/later-pending"
    );
    expect(others.getByRole("link", { name: "View public event" })).toHaveAttribute(
      "href",
      "/events/past-approved"
    );
  });

  it("links the next event's title to its Host detail page", async () => {
    renderDashboard();

    const next = await screen.findByLabelText("Next event");
    expect(within(next).getByRole("link", { name: "Rooftop Social" })).toHaveAttribute(
      "href",
      "/host/events/next-approved"
    );
  });

  it("links other event titles to their Host detail pages", async () => {
    renderDashboard();

    const others = within(await screen.findByLabelText("Your other events"));
    expect(others.getByRole("link", { name: "Mambo Workshop" })).toHaveAttribute(
      "href",
      "/host/events/later-pending"
    );
    expect(others.getByRole("link", { name: "Old Social" })).toHaveAttribute(
      "href",
      "/host/events/past-approved"
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
  it("merges organizer-owned canonical events and dedupes by id", async () => {
    const organizerEvent = {
      ...nextApproved,
      id: "organizer-draft",
      title: "Organizer Draft",
      status: "draft" as const,
      submitter_id: "another-user",
    };
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [organizerEvent, nextApproved],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderDashboard();

    expect(await screen.findByRole("link", { name: "Organizer Draft" })).toBeInTheDocument();
    expect(screen.getAllByText("Rooftop Social")).toHaveLength(1);
    expect(screen.getByLabelText(/Total Events: 4\./)).toBeInTheDocument();
  });

  it("surfaces organizer load failures and retries the organizer query", async () => {
    const organizerRefetch = vi.fn();
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: "Organizer query failed",
      refetch: organizerRefetch,
    });
    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your events.");
    within(screen.getByRole("alert")).getByRole("button", { name: "Try Again" }).click();
    expect(organizerRefetch).toHaveBeenCalledTimes(1);
  });

});

describe("HostDashboard organizer access foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: "user-1" }, role: "organizer" });
    mockOwnerEvents();
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

  });

  it("lists the signed-in user's active organizer memberships", async () => {
    mockMyOrganizers({
      data: [
        {
          organizerId: "org-1",
          organizerName: "Havana Club",
          organizerSlug: "havana-club",
          organizerStatus: "active",
          memberRole: "owner",
        },
      ],
    });
    renderDashboard();

    expect(await screen.findByText("Your organizers")).toBeInTheDocument();
    const organizerSection = screen.getByRole("region", { name: "Your organizers" });
    const organizerCard = within(organizerSection).getByText("Havana Club").closest("li");
    expect(organizerCard).not.toBeNull();
    expect(organizerCard).toHaveTextContent("Havana Club");
    expect(organizerCard).toHaveTextContent("Owner");
    expect(organizerCard).toHaveTextContent("Organizer access confirmed");
  });

  it("shows the access-request state for signed-in users without memberships", async () => {
    mockMyOrganizers();
    renderDashboard();

    expect(await screen.findByText(/No organizer access yet/)).toBeInTheDocument();
  });

  it("points platform roles at Admin instead of the request flow", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: "admin-1" }, role: "admin", isAdmin: true });
    mockMyOrganizers();
    renderDashboard();

    expect(await screen.findByText(/Platform tools live in/)).toBeInTheDocument();
  });
});

describe("RequireOrganizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOwnerEvents();
    mockMyOrganizers();
    vi.mocked(useMyOrganizerEvents).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

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

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("admits signed-in users without organizer access so the page can render the request state", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "regular-1" },
      loading: false,
      isOrganizer: false,
    });
    renderGuardedHost();

    expect(await screen.findByText(/No organizer access yet/)).toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign in", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, isOrganizer: false });
    renderGuardedHost();

    expect(await screen.findByText("Sign in")).toBeInTheDocument();
  });
});

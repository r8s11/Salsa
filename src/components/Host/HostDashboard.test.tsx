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

vi.mock("../../features/account/hooks/useMySubmissions", () => ({ useMySubmissions }));
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

  function entries() {
    return within(screen.getByRole("region", { name: "Your entries" }));
  }

  function week() {
    return within(screen.getByRole("region", { name: "Set for the week" }));
  }

  /** The standing rule states each count as "<figure> <label>". */
  function countFigure(label: RegExp): string {
    const node = screen.getByText(label).closest(".desk__count") as HTMLElement;
    return within(node).getByText(/^\d+$/).textContent ?? "";
  }

  it("lists every owned entry with its state in the margin", async () => {
    renderDashboard();

    expect(await entries().findByText("Rooftop Social")).toBeInTheDocument();
    expect(entries().getByText("Mambo Workshop")).toBeInTheDocument();
    expect(entries().getByText("Old Social")).toBeInTheDocument();
  });

  it("marks a pending entry as awaiting decision and an approved one as published", async () => {
    renderDashboard();

    await entries().findByText("Rooftop Social");
    expect(entries().getAllByRole("img", { name: "Awaiting decision" })).toHaveLength(1);
    expect(entries().getAllByRole("img", { name: "Published" })).toHaveLength(2);
  });

  it("states only the counts that represent work", async () => {
    renderDashboard();

    await entries().findByText("Rooftop Social");
    expect(countFigure(/awaiting review/)).toBe("1");
    expect(countFigure(/drafts?/)).toBe("0");
    expect(countFigure(/nights? ahead/)).toBe("2");
  });

  it("keeps a rejected entry listed and struck rather than hiding it", async () => {
    mockOwnerEvents({
      submissions: [{ ...laterPending, id: "rejected-1", status: "rejected" }],
      approvedEvents: [nextApproved],
    });
    renderDashboard();

    expect(await entries().findByRole("img", { name: "Rejected" })).toBeInTheDocument();
    // A rejected entry is not set into the week.
    expect(week().queryByText("Mambo Workshop")).not.toBeInTheDocument();
  });

  it("links every entry title to its Host detail page", async () => {
    renderDashboard();

    expect(await entries().findByRole("link", { name: "Rooftop Social" })).toHaveAttribute(
      "href",
      "/host/events/next-approved"
    );
    expect(entries().getByRole("link", { name: "Mambo Workshop" })).toHaveAttribute(
      "href",
      "/host/events/later-pending"
    );
  });

  it("sets an entry inside the week onto its own night", async () => {
    renderDashboard();

    expect(await week().findByText("Rooftop Social")).toBeInTheDocument();
    // 20 days out, past the seven divisions.
    expect(week().queryByText("Mambo Workshop")).not.toBeInTheDocument();
  });

  it("invites a first submission when nothing is scheduled", async () => {
    mockOwnerEvents({ submissions: [], approvedEvents: [] });
    renderDashboard();

    expect(await screen.findByText(/No entries yet/)).toBeInTheDocument();
  });

  it("offers submitting an event", async () => {
    renderDashboard();

    expect(await screen.findByRole("link", { name: "Submit an event" })).toHaveAttribute(
      "href",
      "/submit"
    );
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

    expect(await entries().findByRole("link", { name: "Organizer Draft" })).toBeInTheDocument();
    expect(entries().getAllByText("Rooftop Social")).toHaveLength(1);
    expect(countFigure(/drafts?/)).toBe("1");
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
    within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }).click();
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

    expect(await screen.findByRole("region", { name: "Your entries" })).toBeInTheDocument();
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

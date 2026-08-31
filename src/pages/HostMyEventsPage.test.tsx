import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import HostMyEventsPage from "./HostMyEventsPage";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useMySubmissions } = vi.hoisted(() => ({ useMySubmissions: vi.fn() }));
const { useMyOrganizers, useMyOrganizerEvents } = vi.hoisted(() => ({
  useMyOrganizers: vi.fn(),
  useMyOrganizerEvents: vi.fn(),
}));

vi.mock("../contexts/useAuth", () => ({ useAuth }));
vi.mock("../hooks/useMySubmissions", () => ({ useMySubmissions }));
vi.mock("../features/host/hooks/useMyOrganizers", () => ({ useMyOrganizers }));
vi.mock("../features/host/hooks/useMyOrganizerEvents", () => ({ useMyOrganizerEvents }));

const futureEventDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const baseEvent: DatabaseEvent = {
  id: "base",
  title: "Base Event",
  description: null,
  event_type: "social",
  event_date: futureEventDate,
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
  venue_id: "venue-uuid-1",
};

const ownerPending: DatabaseEvent = {
  ...baseEvent,
  id: "pending-1",
  title: "Pending Event",
  status: "pending",
  event_date: "2099-08-30T20:00:00Z",
  location: "Studio 4B",
};

const ownerApproved: DatabaseEvent = {
  ...baseEvent,
  id: "approved-1",
  title: "Approved Event",
};

const ownerPastApproved: DatabaseEvent = {
  ...baseEvent,
  id: "past-approved-1",
  title: "Past Approved Event",
  event_date: "2020-08-01T20:00:00Z",
};

type OwnerEventState = {
  submissions: DatabaseEvent[];
  approvedEvents: DatabaseEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

function mockOwnerEvents(overrides: Partial<OwnerEventState> = {}) {
  vi.mocked(useMySubmissions).mockReturnValue({
    submissions: [ownerPending],
    approvedEvents: [ownerApproved],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  });
}

function renderHostEvents() {
  return render(
    <MemoryRouter initialEntries={["/host/events"]}>
      <HostMyEventsPage />
    </MemoryRouter>
  );
}

describe("HostMyEventsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: "user-1" }, role: "organizer" });
    vi.mocked(useMyOrganizers).mockReturnValue({ data: [] });
    vi.mocked(useMyOrganizerEvents).mockReturnValue({ events: [], isLoading: false, error: null, refetch: vi.fn() });
    mockOwnerEvents();
  });

  it("lists submitted and published owner events in both views", async () => {
    const user = userEvent.setup();
    renderHostEvents();

    expect(await screen.findByRole("heading", { name: "Host · My Events" })).toBeInTheDocument();
    expect(screen.getByText("Pending Event")).toBeInTheDocument();
    expect(screen.getByText("Approved Event")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Table" }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("Pending Event")).toBeInTheDocument();
    expect(within(table).getByText("Approved Event")).toBeInTheDocument();
  });

  it("filters real events by their database status", async () => {
    const user = userEvent.setup();
    renderHostEvents();

    await user.click(await screen.findByRole("button", { name: "Pending" }));

    expect(screen.getByText("Pending Event")).toBeInTheDocument();
    expect(screen.queryByText("Approved Event")).not.toBeInTheDocument();
  });

  it("filters supported Upcoming and Past views from real event dates", async () => {
    vi.mocked(useMySubmissions).mockReturnValue({
      submissions: [ownerPending],
      approvedEvents: [ownerApproved, ownerPastApproved],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderHostEvents();

    await user.click(await screen.findByRole("button", { name: "Upcoming" }));
    expect(screen.getByText("Pending Event")).toBeInTheDocument();
    expect(screen.getByText("Approved Event")).toBeInTheDocument();
    expect(screen.queryByText("Past Approved Event")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Past" }));
    expect(screen.getByText("Past Approved Event")).toBeInTheDocument();
    expect(screen.queryByText("Pending Event")).not.toBeInTheDocument();
  });

  it("shows compact sharing only for approved events", async () => {
    renderHostEvents();

    expect(await screen.findByRole("button", { name: "Share event" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Share event" })).toHaveLength(1);
  });

  it("labels every table cell for the mobile card layout", async () => {
    const user = userEvent.setup();
    renderHostEvents();

    await user.click(screen.getByRole("button", { name: "Table" }));
    const [firstRow] = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    const labels = within(firstRow)
      .getAllByRole("cell")
      .map((cell) => cell.getAttribute("data-label"));

    expect(labels).toEqual(["Event", "Date", "Venue", "Status", "Action"]);
  });

  it("links editable and published events to their existing destinations", async () => {
    renderHostEvents();

    expect(await screen.findByRole("link", { name: "Edit submission" })).toHaveAttribute(
      "href",
      "/profile/edit/pending-1"
    );
    expect(screen.getByRole("link", { name: "View public event" })).toHaveAttribute(
      "href",
      "/events/approved-1"
    );
  });

  it("links each card title to its Host detail page", async () => {
    renderHostEvents();

    expect(await screen.findByRole("link", { name: "Pending Event" })).toHaveAttribute(
      "href",
      "/host/events/pending-1"
    );
    expect(screen.getByRole("link", { name: "Approved Event" })).toHaveAttribute(
      "href",
      "/host/events/approved-1"
    );
  });

  it("links each table row title to its Host detail page", async () => {
    const user = userEvent.setup();
    renderHostEvents();

    await user.click(screen.getByRole("button", { name: "Table" }));

    expect(screen.getByRole("link", { name: "Pending Event" })).toHaveAttribute(
      "href",
      "/host/events/pending-1"
    );
  });

  it("shows the event location and never a venue id", async () => {
    mockOwnerEvents({
      submissions: [],
      approvedEvents: [ownerApproved, { ...baseEvent, id: "no-venue", location: null }],
    });
    renderHostEvents();

    expect(await screen.findByText("Havana Club")).toBeInTheDocument();
    expect(screen.getByText("Venue not set")).toBeInTheDocument();
    expect(screen.queryByText("venue-uuid-1")).not.toBeInTheDocument();
  });

  it("reports the loading state", async () => {
    mockOwnerEvents({ submissions: [], approvedEvents: [], isLoading: true });
    renderHostEvents();

    expect(await screen.findByRole("status")).toHaveTextContent("Loading your events…");
  });

  it("reports the empty state", async () => {
    mockOwnerEvents({ submissions: [], approvedEvents: [] });
    renderHostEvents();

    expect(await screen.findByText(/haven't submitted any events yet/i)).toBeInTheDocument();
  });

  it("reports a load failure with a retry control", async () => {
    const refetch = vi.fn();
    mockOwnerEvents({ submissions: [], approvedEvents: [], error: "Network error", refetch });
    const user = userEvent.setup();
    renderHostEvents();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your events.");
    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import HostMyEventsPage from "./HostMyEventsPage";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useMySubmissions } = vi.hoisted(() => ({ useMySubmissions: vi.fn() }));

vi.mock("../contexts/useAuth", () => ({ useAuth }));
vi.mock("../hooks/useMySubmissions", () => ({ useMySubmissions }));

const baseEvent: DatabaseEvent = {
  id: "base",
  title: "Base Event",
  description: null,
  event_type: "social",
  event_date: "2026-09-01T20:00:00Z",
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
  event_date: "2026-08-30T20:00:00Z",
  location: "Studio 4B",
};

const ownerApproved: DatabaseEvent = {
  ...baseEvent,
  id: "approved-1",
  title: "Approved Event",
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

    expect(await screen.findByRole("link", { name: "Edit event" })).toHaveAttribute(
      "href",
      "/profile/edit/pending-1"
    );
    expect(screen.getByRole("link", { name: "View event" })).toHaveAttribute(
      "href",
      "/calendar?event=approved-1&city=boston"
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

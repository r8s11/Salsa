import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import AdminOverviewPage from "./AdminOverviewPage";

const { useAdminEvents } = vi.hoisted(() => ({ useAdminEvents: vi.fn() }));

vi.mock("../hooks/useAdminEvents", () => ({ useAdminEvents }));

const FAR_FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

const baseEvent: DatabaseEvent = {
  id: "event-1",
  title: "Bachata Sensual Social",
  description: null,
  event_type: "social",
  event_date: FAR_FUTURE,
  event_time: null,
  location: "Havana Club",
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  submitter_name: "Ada",
  submitter_email: "ada@salsa.test",
  submitter_id: null,
  status: "approved",
  city: "boston",
  created_at: "2026-08-05T00:00:00.000Z",
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
};

// Known fixture: 2 approved (1 upcoming, 1 past), 2 pending, 1 rejected — 5 total.
const events: DatabaseEvent[] = [
  baseEvent,
  { ...baseEvent, id: "event-2", title: "Past Approved Event", status: "approved", event_date: PAST, city: "new-york-city", created_at: "2026-08-04T00:00:00.000Z" },
  { ...baseEvent, id: "event-3", title: "Pending One", status: "pending", created_at: "2026-08-03T00:00:00.000Z" },
  { ...baseEvent, id: "event-4", title: "Pending Two", status: "pending", city: "new-york-city", created_at: "2026-08-02T00:00:00.000Z" },
  { ...baseEvent, id: "event-5", title: "Rejected One", status: "rejected", created_at: "2026-08-01T00:00:00.000Z" },
];

const defaultState = {
  events,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  decide: vi.fn(),
  decidingId: null,
  decidingStatus: null,
  decideErrorId: null,
  decideError: null,
  save: vi.fn(),
  isSaving: false,
  saveError: null,
  remove: vi.fn(),
  removingId: null,
  removeErrorId: null,
  removeError: null,
};

function renderPage() {
  return render(<AdminOverviewPage />, { wrapper: MemoryRouter });
}

describe("AdminOverviewPage", () => {
  beforeEach(() => {
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState });
  });

  it("computes the four metric values from a fixture of known statuses/dates", () => {
    renderPage();

    const metrics = document.querySelector(".admin-overview-page__metrics") as HTMLElement;
    expect(within(metrics).getByText("Total events").nextElementSibling).toHaveTextContent("5");
    expect(within(metrics).getByText("Pending review").nextElementSibling).toHaveTextContent("2");
    expect(within(metrics).getByText("Approved").nextElementSibling).toHaveTextContent("2");
    expect(within(metrics).getByText("Upcoming").nextElementSibling).toHaveTextContent("1");
  });

  it("lists at most 5 recent submissions", () => {
    renderPage();

    const panel = screen.getByText("Recent submissions").closest(".admin-overview-page__panel") as HTMLElement;
    expect(within(panel).getAllByRole("listitem")).toHaveLength(5);
  });

  it("renders zero-events fixture as empty with metric zeros", () => {
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState, events: [] });
    renderPage();

    expect(screen.getByText("Total events").nextElementSibling).toHaveTextContent("0");
    expect(screen.getByText("Pending review").nextElementSibling).toHaveTextContent("0");
    expect(screen.getByText("No events yet.")).toBeInTheDocument();
  });

  it("shows a loading status while fetching", () => {
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState, isLoading: true, events: undefined });
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading overview…");
  });
});

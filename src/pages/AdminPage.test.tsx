import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import AdminPage from "./AdminPage";

const { usePendingEvents } = vi.hoisted(() => ({ usePendingEvents: vi.fn() }));

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({ user: { email: "moderator@salsa.test" } }),
}));

vi.mock("../hooks/usePendingEvents", () => ({ usePendingEvents }));

const events: DatabaseEvent[] = [
  {
    id: "boston-event",
    title: "Boston Social",
    description: "A social dance.",
    event_type: "social",
    event_date: "2026-08-20T00:00:00.000Z",
    event_time: null,
    location: "Dance Hall",
    address: null,
    price_type: "free",
    price_amount: null,
    rsvp_link: null,
    image_url: null,
    submitter_name: "Ada",
    submitter_email: "ada@salsa.test",
    submitter_id: null,
    status: "pending",
    city: "boston",
    created_at: "2026-08-01T00:00:00.000Z",
    host: null,
    recurrence: null,
    gallery: null,
  },
  {
    id: "nyc-event",
    title: "NYC Workshop",
    description: null,
    event_type: "workshop",
    event_date: "2026-08-21T00:00:00.000Z",
    event_time: null,
    location: null,
    address: null,
    price_type: "paid",
    price_amount: 20,
    rsvp_link: null,
    image_url: null,
    submitter_name: null,
    submitter_email: null,
    submitter_id: null,
    status: "pending",
    city: "new-york-city",
    created_at: "2026-08-01T00:00:00.000Z",
    host: null,
    recurrence: null,
    gallery: null,
  },
];

const refetch = vi.fn();
const decide = vi.fn();
const defaultState = {
  pending: events,
  isLoading: false,
  error: null,
  refetch,
  decide,
  decidingId: null,
  decidingStatus: null,
  decideErrorId: null,
  decideError: null,
};

function renderPage() {
  return render(<AdminPage />, { wrapper: MemoryRouter });
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePendingEvents.mockReturnValue(defaultState);
  });

  it("renders loading without numeric metrics", () => {
    usePendingEvents.mockReturnValue({ ...defaultState, pending: undefined, isLoading: true });
    renderPage();
    expect(screen.getByText("Loading pending events…")).toBeInTheDocument();
    expect(screen.queryByText("Awaiting review")).not.toBeInTheDocument();
  });

  it("renders load errors with retry", () => {
    usePendingEvents.mockReturnValue({ ...defaultState, pending: undefined, error: "Offline" });
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load pending events: Offline");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders an empty queue linking to the calendar", () => {
    usePendingEvents.mockReturnValue({ ...defaultState, pending: [] });
    renderPage();
    expect(screen.getByText("No events waiting for review.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View calendar" })).toHaveAttribute("href", "/calendar");
  });

  it("derives stable metrics from loaded pending events", () => {
    renderPage();
    const metrics = within(screen.getByRole("region", { name: "Pending event metrics" }));
    expect(metrics.getByText("Awaiting review").nextElementSibling).toHaveTextContent("2");
    expect(metrics.getByText("Boston").nextElementSibling).toHaveTextContent("1");
    expect(metrics.getByText("NYC").nextElementSibling).toHaveTextContent("1");
  });

  it("passes moderation decisions and card errors to their matching card", () => {
    usePendingEvents.mockReturnValue({
      ...defaultState,
      decidingId: "boston-event",
      decidingStatus: "approved",
      decideErrorId: "nyc-event",
      decideError: "Unable to update",
    });
    renderPage();
    expect(screen.getByRole("button", { name: "Approving…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Approval failed: Unable to update");
  });
});

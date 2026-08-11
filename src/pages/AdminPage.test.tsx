import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import AdminPage from "./AdminPage";

const { useAdminEvents } = vi.hoisted(() => ({ useAdminEvents: vi.fn() }));

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({ user: { id: "admin-1", email: "moderator@salsa.test" } }),
}));

vi.mock("../contexts/useCity", () => ({
  useCity: () => ({ city: "boston" }),
}));

vi.mock("../hooks/useAdminEvents", () => ({ useAdminEvents }));

const baseEvent: DatabaseEvent = {
  id: "event-1",
  title: "Pending Social",
  description: "A pending event",
  event_type: "social",
  event_date: "2026-08-21T00:00:00.000Z",
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
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
};

const events: DatabaseEvent[] = [
  baseEvent,
  { ...baseEvent, id: "event-2", title: "Approved Workshop", event_type: "workshop", status: "approved" },
  { ...baseEvent, id: "event-3", title: "Rejected Class", event_type: "class", status: "rejected" },
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
  return render(<AdminPage />, { wrapper: MemoryRouter });
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminEvents.mockReturnValue(defaultState);
  });

  it("renders loading without numeric metrics", () => {
    useAdminEvents.mockReturnValue({ ...defaultState, events: undefined, isLoading: true });
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading events");
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
  });

  it("renders load errors with retry", () => {
    renderPage();
    useAdminEvents.mockReturnValue({ ...defaultState, error: "Network down" });
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Network down");
  });

  it("renders all statuses and counts", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "All events" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pending Social" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Approved Workshop" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rejected Class" })).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pending 1" })).toHaveAttribute("aria-pressed", "false");
  });

  it("filters rows and exposes counts", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Approved 1" }));
    expect(screen.getByRole("heading", { name: "Approved Workshop" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pending Social" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approved 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens an empty create form from New event", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "New event" }));
    expect(screen.getByRole("heading", { name: "New event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("");
  });

  it("opens an edit form prefilled with the selected event", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByRole("heading", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Pending Social");
  });
});

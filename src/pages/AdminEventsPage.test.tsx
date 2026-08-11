import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { DatabaseEvent } from "../features/events/model/types";
import AdminEventsPage from "./AdminEventsPage";

const { useAdminEvents } = vi.hoisted(() => ({ useAdminEvents: vi.fn() }));

vi.mock("../hooks/useAdminEvents", () => ({ useAdminEvents }));

vi.mock("../contexts/useCity", () => ({
  useCity: () => ({ city: "boston", setCity: vi.fn() }),
}));

const baseEvent: DatabaseEvent = {
  id: "event-1",
  title: "Bachata Sensual Social",
  description: "A pending event",
  event_type: "social",
  event_date: "2026-08-21T00:00:00.000Z",
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
  status: "pending",
  city: "boston",
  created_at: "2026-08-01T00:00:00.000Z",
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  source_type: "user_submission",
  dance_styles: [],
  updated_at: "2026-08-01T00:00:00.000Z",
  cancellation_reason: null,
};

const events: DatabaseEvent[] = [
  baseEvent,
  {
    ...baseEvent,
    id: "event-2",
    title: "Salsa Workshop NYC",
    event_type: "workshop",
    status: "approved",
    location: "Dance Studio",
    city: "new-york-city",
  },
  {
    ...baseEvent,
    id: "event-3",
    title: "Kizomba Class",
    event_type: "class",
    status: "rejected",
    location: "Community Hall",
  },
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
  return render(<AdminEventsPage />, { wrapper: MemoryRouter });
}

function renderAt(path: string) {
  return render(<AdminEventsPage />, {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>,
  });
}

function eventsTable() {
  return screen.getByRole("table");
}

describe("AdminEventsPage", () => {
  beforeEach(() => {
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState });
  });

  it("opens an empty form when New event is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /New event/i }));

    expect(screen.getByRole("heading", { name: "New event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("");
  });

  it("opens a prefilled form when Edit is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    const row = within(within(eventsTable()).getByText("Bachata Sensual Social").closest("tr") as HTMLElement);
    await user.click(row.getByRole("button", { name: "Edit event" }));

    expect(screen.getByRole("heading", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Bachata Sensual Social");
  });

  it("narrows rows by search text", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Search"), "Bachata");

    const table = eventsTable();
    expect(within(table).getByText("Bachata Sensual Social")).toBeInTheDocument();
    expect(within(table).queryByText("Salsa Workshop NYC")).not.toBeInTheDocument();
    expect(within(table).queryByText("Kizomba Class")).not.toBeInTheDocument();
  });

  it("narrows rows by status filter", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText("Status"), "approved");

    const table = eventsTable();
    expect(within(table).getByText("Salsa Workshop NYC")).toBeInTheDocument();
    expect(within(table).queryByText("Bachata Sensual Social")).not.toBeInTheDocument();
    expect(within(table).queryByText("Kizomba Class")).not.toBeInTheDocument();
  });

  it("confirms delete through the dialog and calls remove with the event id", async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState, remove });
    renderPage();

    const row = within(within(eventsTable()).getByText("Bachata Sensual Social").closest("tr") as HTMLElement);
    await user.click(row.getByRole("button", { name: "Delete event" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete this event?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete event" }));

    expect(remove).toHaveBeenCalledWith("event-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancels delete without calling remove or decide", async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    const decide = vi.fn();
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState, remove, decide });
    renderPage();

    const row = within(within(eventsTable()).getByText("Bachata Sensual Social").closest("tr") as HTMLElement);
    await user.click(row.getByRole("button", { name: "Delete event" }));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(remove).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("initializes the status filter from ?status= and shows only matching rows", () => {
    renderAt("/admin/events?status=pending");

    expect(screen.getByLabelText("Status")).toHaveValue("pending");
    const table = eventsTable();
    expect(within(table).getByText("Bachata Sensual Social")).toBeInTheDocument();
    expect(within(table).queryByText("Salsa Workshop NYC")).not.toBeInTheDocument();
    expect(within(table).queryByText("Kizomba Class")).not.toBeInTheDocument();
  });

  it("opens the create form when ?new=1 is present", () => {
    renderAt("/admin/events?new=1");

    expect(screen.getByRole("heading", { name: "New event" })).toBeInTheDocument();
  });

  it("opens the prefilled edit form for ?edit=<uuid> once events have loaded", () => {
    renderAt("/admin/events?edit=event-2");

    expect(screen.getByRole("heading", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Salsa Workshop NYC");
  });

  it("falls back to the list, without error, when ?edit references an unknown id", () => {
    renderAt("/admin/events?edit=does-not-exist");

    expect(screen.queryByRole("heading", { name: "Edit event" })).not.toBeInTheDocument();
    expect(eventsTable()).toBeInTheDocument();
  });

  it("filters by ?flag=incomplete to only events missing venue, time, or image", () => {
    renderAt("/admin/events?flag=incomplete");

    const table = eventsTable();
    expect(within(table).getByText("Salsa Workshop NYC")).toBeInTheDocument();
    expect(within(table).queryByText("Bachata Sensual Social")).not.toBeInTheDocument();
    expect(within(table).queryByText("Kizomba Class")).not.toBeInTheDocument();
    expect(screen.getByText("Missing info")).toBeInTheDocument();
  });

  it("filters by ?flag=upcoming to approved events within the next 30 days", () => {
    renderAt("/admin/events?flag=upcoming");

    const table = eventsTable();
    expect(within(table).getByText("Salsa Workshop NYC")).toBeInTheDocument();
    expect(within(table).queryByText("Bachata Sensual Social")).not.toBeInTheDocument();
    expect(screen.getByText("Next 30 days")).toBeInTheDocument();
  });

  it("dismissing the flag chip clears the filter and restores hidden rows", async () => {
    const user = userEvent.setup();
    renderAt("/admin/events?flag=incomplete");

    expect(within(eventsTable()).queryByText("Bachata Sensual Social")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove filter" }));

    expect(screen.queryByText("Missing info")).not.toBeInTheDocument();
    expect(within(eventsTable()).getByText("Bachata Sensual Social")).toBeInTheDocument();
  });
});

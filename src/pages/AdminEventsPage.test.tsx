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

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

const baseEvent: DatabaseEvent = {
  id: "event-1",
  title: "Bachata Sensual Social",
  description: "A pending event",
  event_type: "social",
  event_date: daysFromNow(10),
  event_time: "8:00 PM",
  location: "Havana Club",
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: "https://example.com/image.jpg",
  submitter_name: "Ada",
  submitter_email: "ada@salsa.test",
  submitter_id: "user-1",
  status: "pending",
  city: "boston",
  created_at: "2026-08-01T00:00:00.000Z",
  host: "DJ Cocolo",
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

const approvedUpcoming: DatabaseEvent = {
  ...baseEvent,
  id: "event-2",
  title: "Salsa Workshop NYC",
  event_type: "workshop",
  status: "approved",
  location: "Dance Studio",
  city: "new-york-city",
  event_date: daysFromNow(5),
};

const rejected: DatabaseEvent = {
  ...baseEvent,
  id: "event-3",
  title: "Kizomba Class",
  event_type: "class",
  status: "rejected",
  location: "Community Hall",
};

const incomplete: DatabaseEvent = {
  ...baseEvent,
  id: "event-4",
  title: "Incomplete Social",
  status: "approved",
  location: null,
  event_date: daysFromNow(3),
};

const archived: DatabaseEvent = {
  ...baseEvent,
  id: "event-5",
  title: "Archived Class",
  status: "archived",
};

const events: DatabaseEvent[] = [baseEvent, approvedUpcoming, rejected];

const defaultState = {
  events,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  changeStatus: vi.fn(),
  changingStatusId: null,
  changeStatusErrorId: null,
  changeStatusError: null,
  save: vi.fn(),
  isSaving: false,
  saveError: null,
  remove: vi.fn(),
  removingId: null,
  removeErrorId: null,
  removeError: null,
  duplicate: vi.fn(),
  isDuplicating: false,
  duplicateError: null,
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

function desktopRowFor(title: string) {
  return within(
    within(eventsTable()).getByRole("link", { name: title }).closest("tr") as HTMLElement
  );
}

async function openRowMenu(user: ReturnType<typeof userEvent.setup>, title: string) {
  const row = desktopRowFor(title);
  await user.click(row.getByRole("button", { name: `Actions for ${title}` }));
  return screen.getByRole("menu");
}

describe("AdminEventsPage", () => {
  beforeEach(() => {
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState });
  });

  it("opens an empty form when Create Event is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Create Event/i }));

    expect(screen.getByRole("heading", { name: "New event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("");
  });

  it("opens a prefilled form when Edit is chosen from the row menu", async () => {
    const user = userEvent.setup();
    renderPage();

    const menu = await openRowMenu(user, "Bachata Sensual Social");
    await user.click(within(menu).getByRole("menuitem", { name: "Edit" }));

    expect(screen.getByRole("heading", { name: "Edit event" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Bachata Sensual Social");
  });

  it("confirms delete through the dialog and calls remove with the event id", async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState, remove });
    renderPage();

    const menu = await openRowMenu(user, "Bachata Sensual Social");
    await user.click(within(menu).getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete this event?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete event" }));

    expect(remove).toHaveBeenCalledWith("event-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancelling the confirm dialog calls neither remove nor changeStatus", async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    const changeStatus = vi.fn();
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState, remove, changeStatus });
    renderPage();

    const menu = await openRowMenu(user, "Bachata Sensual Social");
    await user.click(within(menu).getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(remove).not.toHaveBeenCalled();
    expect(changeStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  describe("Phase 2 Overview deep links", () => {
    it("?status=pending shows only pending rows", () => {
      renderAt("/admin/events?status=pending");

      const table = eventsTable();
      expect(within(table).getByText("Bachata Sensual Social")).toBeInTheDocument();
      expect(within(table).queryByText("Salsa Workshop NYC")).not.toBeInTheDocument();
      expect(within(table).queryByText("Kizomba Class")).not.toBeInTheDocument();
      expect(within(table).getByText("Pending Approval")).toBeInTheDocument();
    });

    it("?flag=upcoming normalizes to the Upcoming view", () => {
      renderAt("/admin/events?flag=upcoming");

      expect(screen.getByRole("tab", { name: /Upcoming/ })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      const table = eventsTable();
      expect(within(table).getByText("Salsa Workshop NYC")).toBeInTheDocument();
      expect(within(table).getByText("Bachata Sensual Social")).toBeInTheDocument();
    });

    it("?flag=incomplete filters to events with a quality issue and shows the Missing info chip", () => {
      vi.mocked(useAdminEvents).mockReturnValue({
        ...defaultState,
        events: [...events, incomplete],
      });
      renderAt("/admin/events?flag=incomplete");

      const table = eventsTable();
      expect(within(table).getByText("Incomplete Social")).toBeInTheDocument();
      expect(within(table).queryByText("Bachata Sensual Social")).not.toBeInTheDocument();
      expect(screen.getByText("Missing info")).toBeInTheDocument();
    });

    it("?new=1 opens the create form", () => {
      renderAt("/admin/events?new=1");
      expect(screen.getByRole("heading", { name: "New event" })).toBeInTheDocument();
    });

    it("?edit=<uuid> opens the prefilled edit form once events have loaded", () => {
      renderAt("/admin/events?edit=event-2");

      expect(screen.getByRole("heading", { name: "Edit event" })).toBeInTheDocument();
      expect(screen.getByLabelText("Event Title *")).toHaveValue("Salsa Workshop NYC");
    });

    it("falls back to the list, without error, when ?edit references an unknown id", () => {
      renderAt("/admin/events?edit=does-not-exist");

      expect(screen.queryByRole("heading", { name: "Edit event" })).not.toBeInTheDocument();
      expect(eventsTable()).toBeInTheDocument();
    });

    it("dismissing the Missing info chip clears the filter and restores hidden rows", async () => {
      const user = userEvent.setup();
      vi.mocked(useAdminEvents).mockReturnValue({
        ...defaultState,
        events: [...events, incomplete],
      });
      renderAt("/admin/events?flag=incomplete");

      expect(within(eventsTable()).queryByText("Bachata Sensual Social")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Remove.*filter/ }));

      expect(screen.queryByText("Missing info")).not.toBeInTheDocument();
      expect(within(eventsTable()).getByText("Bachata Sensual Social")).toBeInTheDocument();
    });
  });

  it("?view=archived shows archived rows; the default view does not", () => {
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState, events: [...events, archived] });
    renderAt("/admin/events?view=archived");

    expect(within(eventsTable()).getByText("Archived Class")).toBeInTheDocument();

    renderAt("/admin/events");
    // Default view (upcoming) never shows archived rows.
    const upcomingTable = screen.getAllByRole("table")[1];
    expect(within(upcomingTable).queryByText("Archived Class")).not.toBeInTheDocument();
  });

  it("clicking the Event header sorts and toggles aria-sort", async () => {
    const user = userEvent.setup();
    renderPage();

    const eventHeader = screen.getByRole("columnheader", { name: /^Event/ });
    expect(eventHeader).toHaveAttribute("aria-sort", "none");

    await user.click(within(eventHeader).getByRole("button"));
    expect(eventHeader).toHaveAttribute("aria-sort", "ascending");

    await user.click(within(eventHeader).getByRole("button"));
    expect(eventHeader).toHaveAttribute("aria-sort", "descending");
  });

  it("published event's row menu offers Unpublish/Cancel/Archive, not Publish", async () => {
    const user = userEvent.setup();
    renderPage();

    const menu = await openRowMenu(user, "Salsa Workshop NYC");
    expect(within(menu).getByRole("menuitem", { name: "Unpublish" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Cancel Event" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Archive" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("archived event's row menu offers Restore, not Archive", async () => {
    const user = userEvent.setup();
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState, events: [archived] });
    renderAt("/admin/events?view=archived");

    const menu = await openRowMenu(user, "Archived Class");
    expect(within(menu).getByRole("menuitem", { name: "Restore" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("Cancel opens a dialog with a reason field and passes the typed reason to changeStatus", async () => {
    const user = userEvent.setup();
    const changeStatus = vi.fn();
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState, changeStatus });
    renderPage();

    const menu = await openRowMenu(user, "Salsa Workshop NYC");
    await user.click(within(menu).getByRole("menuitem", { name: "Cancel Event" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Cancel this event?")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Reason/), "Venue flooded");
    await user.click(within(dialog).getByRole("button", { name: "Cancel event" }));

    expect(changeStatus).toHaveBeenCalledWith({
      id: "event-2",
      status: "cancelled",
      reason: "Venue flooded",
    });
  });

  it("Duplicate opens the dialog prefilled 7 days out and submits draft unless Publish immediately is checked", async () => {
    const user = userEvent.setup();
    const duplicate = vi.fn();
    vi.mocked(useAdminEvents).mockReturnValue({ ...defaultState, duplicate });
    renderPage();

    const menu = await openRowMenu(user, "Bachata Sensual Social");
    await user.click(within(menu).getByRole("menuitem", { name: "Duplicate" }));

    const dialog = screen.getByRole("dialog", { name: /Duplicate/ });
    const original = new Date(baseEvent.event_date);
    const expected = new Date(original.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(within(dialog).getByLabelText("Date")).toHaveValue(expected);

    await user.click(within(dialog).getByRole("button", { name: "Duplicate event" }));

    expect(duplicate).toHaveBeenCalledWith(
      expect.objectContaining({
        source: baseEvent,
        input: expect.objectContaining({ publish: false }),
      }),
      expect.anything()
    );
  });
});

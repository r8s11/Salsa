import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DatabaseEvent } from "../../features/events/model/types";
import AdminEventsTable from "./AdminEventsTable";

const baseEvent: DatabaseEvent = {
  id: "event-1",
  title: "Pending Social",
  description: "A pending event",
  event_type: "social",
  event_date: "2026-08-21T00:00:00.000Z",
  event_time: "8:00 PM",
  location: "Dance Hall",
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
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
  taxonomy_term_ids: [],
  taxonomy_terms: [],
  updated_at: "2026-08-01T00:00:00.000Z",
  cancellation_reason: null,
  venue_id: null,
};

const events: DatabaseEvent[] = [
  baseEvent,
  {
    ...baseEvent,
    id: "event-2",
    title: "Approved Workshop",
    event_type: "workshop",
    status: "approved",
  },
  { ...baseEvent, id: "event-3", title: "Archived Class", event_type: "class", status: "archived" },
];

function renderTable(overrides: Partial<ComponentProps<typeof AdminEventsTable>> = {}) {
  const props: ComponentProps<typeof AdminEventsTable> = {
    events,
    duplicateIds: new Set(),
    sort: { key: "event_date", dir: "desc" },
    onSortChange: vi.fn(),
    onAction: vi.fn(),
    busy: null,
    errorId: null,
    error: null,
    ...overrides,
  };
  render(
    <MemoryRouter>
      <AdminEventsTable {...props} />
    </MemoryRouter>
  );
  return props;
}

function desktopRowFor(title: string) {
  const cell = screen.getAllByRole("link", { name: title })[0];
  return cell.closest("tr")!;
}

describe("AdminEventsTable", () => {
  it("renders the seven-column header", () => {
    renderTable();
    ["Event", "Date & Time", "Venue", "Organizer", "Source", "Status", "Actions"].forEach(
      (label) => {
        expect(screen.getAllByText(label, { selector: "th, button" }).length).toBeGreaterThan(0);
      }
    );
  });

  it("event title links to the edit route", () => {
    renderTable();
    const links = screen.getAllByRole("link", { name: "Pending Social" });
    expect(links[0]).toHaveAttribute("href", "/admin/events?edit=event-1");
  });

  it("uses the public default banner when flyer is absent", () => {
    renderTable();
    const image = document.querySelector(".admin-events-table__event img");
    expect(image).toHaveAttribute("src", "/images/default-event-banner.png");
    expect(image).toHaveAttribute("alt", "");
  });

  it("shows 'Venue not set' and 'Time not set' for empty fields", () => {
    renderTable({
      events: [{ ...baseEvent, location: null, event_time: null }],
    });
    expect(screen.getAllByText("Venue not set").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Time not set").length).toBeGreaterThan(0);
  });

  it("never falls back to the submitter for Organizer", () => {
    renderTable({ events: [{ ...baseEvent, host: null }] });
    expect(screen.getAllByText("No organizer").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ada")).not.toBeInTheDocument();
  });

  it("renders gracefully when event_type is null", () => {
    renderTable({
      events: [{ ...baseEvent, event_type: null as unknown as DatabaseEvent["event_type"] }],
    });
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
  });

  describe("sortable headers", () => {
    it("marks the active sort column and calls onSortChange with the clicked key", async () => {
      const user = userEvent.setup();
      const props = renderTable({ sort: { key: "event_date", dir: "asc" } });
      const dateHeader = screen.getByRole("columnheader", { name: /Date & Time/ });
      expect(dateHeader).toHaveAttribute("aria-sort", "ascending");

      const eventHeader = screen.getByRole("columnheader", { name: /^Event/ });
      expect(eventHeader).toHaveAttribute("aria-sort", "none");

      await user.click(within(eventHeader).getByRole("button"));
      expect(props.onSortChange).toHaveBeenCalledWith("title");
    });
  });

  describe("row action menu by status", () => {
    it("pending offers Publish, Reject, Archive but not Unpublish", async () => {
      const user = userEvent.setup();
      renderTable();
      const row = desktopRowFor("Pending Social");
      await user.click(within(row).getByRole("button", { name: "Actions for Pending Social" }));
      const menu = screen.getByRole("menu");
      expect(within(menu).getByRole("menuitem", { name: "Publish" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Reject" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Archive" })).toBeInTheDocument();
      expect(within(menu).queryByRole("menuitem", { name: "Unpublish" })).not.toBeInTheDocument();
    });

    it("approved (Published) offers Unpublish and Cancel but not Publish", async () => {
      const user = userEvent.setup();
      renderTable();
      const row = desktopRowFor("Approved Workshop");
      await user.click(within(row).getByRole("button", { name: "Actions for Approved Workshop" }));
      const menu = screen.getByRole("menu");
      expect(within(menu).getByRole("menuitem", { name: "Unpublish" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Cancel Event" })).toBeInTheDocument();
      expect(within(menu).queryByRole("menuitem", { name: "Publish" })).not.toBeInTheDocument();
    });

    it("archived offers Restore but not Archive, and every status offers Edit/Duplicate/Delete", async () => {
      const user = userEvent.setup();
      renderTable();
      const row = desktopRowFor("Archived Class");
      await user.click(within(row).getByRole("button", { name: "Actions for Archived Class" }));
      const menu = screen.getByRole("menu");
      expect(within(menu).getByRole("menuitem", { name: "Restore" })).toBeInTheDocument();
      expect(within(menu).queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    });

    it("selecting a menu item calls onAction with the action and the event", async () => {
      const user = userEvent.setup();
      const props = renderTable();
      const row = desktopRowFor("Pending Social");
      await user.click(within(row).getByRole("button", { name: "Actions for Pending Social" }));
      await user.click(screen.getByRole("menuitem", { name: "Publish" }));
      expect(props.onAction).toHaveBeenCalledWith(
        "publish",
        expect.objectContaining({ id: "event-1" })
      );
    });
  });

  it("marks archived rows with the archived row class", () => {
    renderTable();
    const row = desktopRowFor("Archived Class");
    expect(row).toHaveClass("admin-events-table__row--archived");
  });

  it("shows a quality indicator only for events with issues", () => {
    renderTable({
      events: [
        {
          ...baseEvent,
          id: "complete",
          title: "Complete Event",
          location: "Venue",
          host: "Org",
          image_url: "x",
        },
        { ...baseEvent, id: "incomplete", title: "Incomplete Event", location: null },
      ],
    });
    const completeRow = desktopRowFor("Complete Event");
    const incompleteRow = desktopRowFor("Incomplete Event");
    expect(
      within(completeRow).queryByRole("button", { name: /quality issue/ })
    ).not.toBeInTheDocument();
    expect(
      within(incompleteRow).getByRole("button", { name: /quality issue/ })
    ).toBeInTheDocument();
  });

  it("uses a concise organizer warning and a labeled management action", () => {
    renderTable({
      events: [{ ...baseEvent, location: "Venue", host: null, image_url: "flyer.png" }],
    });

    const row = desktopRowFor("Pending Social");
    expect(
      within(row).getByRole("button", { name: "1 quality issue: Missing organizer" })
    ).toHaveTextContent("Needs organizer");
    expect(within(row).getByText("Manage")).toBeInTheDocument();
  });

  it("renders a row-scoped error banner only for the matching event", () => {
    renderTable({ errorId: "event-1", error: "Network error" });
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
    alerts.forEach((alert) => expect(alert).toHaveTextContent("Action failed: Network error"));
  });
});

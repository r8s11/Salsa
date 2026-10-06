import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DatabaseEvent } from "../../../events/model/types";
import AdminEventsTable from "./AdminEventsTable";

vi.mock("../../../metros/hooks/useMetros", () => ({
  useMetroName: () => (slug: string) => (slug === "boston" ? "Boston" : slug),
}));

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

function tableProps(
  overrides: Partial<ComponentProps<typeof AdminEventsTable>> = {}
): ComponentProps<typeof AdminEventsTable> {
  return {
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
}

function renderTable(overrides: Partial<ComponentProps<typeof AdminEventsTable>> = {}) {
  const props = tableProps(overrides);
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
    expect(image).toHaveAttribute(
      "src",
      expect.stringMatching(/\/images\/event-fallbacks\/.+\.svg/)
    );
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
    expect(screen.getAllByText("Unknown · Boston").length).toBeGreaterThan(0);
  });
  it("formats Live Music event type with readable words", () => {
    renderTable({
      events: [{ ...baseEvent, id: "event-live-music", event_type: "live_music" }],
    });
    expect(screen.getAllByText("Live Music · Boston").length).toBeGreaterThan(0);
  });

  it("drops the city from each row when the list is already one city", () => {
    renderTable({
      events: [{ ...baseEvent, event_type: "social" }],
      hideCity: true,
    });
    expect(screen.getAllByText("Social").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Social · Boston/)).not.toBeInTheDocument();
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
    it("pending rows keep Archive in the menu; Approve and Reject live on the row", async () => {
      const user = userEvent.setup();
      renderTable();
      const row = desktopRowFor("Pending Social");
      await user.click(within(row).getByRole("button", { name: "Actions for Pending Social" }));
      const menu = screen.getByRole("menu");
      expect(within(menu).getByRole("menuitem", { name: "Archive" })).toBeInTheDocument();
      expect(within(menu).queryByRole("menuitem", { name: "Publish" })).not.toBeInTheDocument();
      expect(within(menu).queryByRole("menuitem", { name: "Reject" })).not.toBeInTheDocument();
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

    it("archived offers Restore as draft but not Archive, and every status offers Edit/Duplicate/Delete", async () => {
      const user = userEvent.setup();
      renderTable();
      const row = desktopRowFor("Archived Class");
      await user.click(within(row).getByRole("button", { name: "Actions for Archived Class" }));
      const menu = screen.getByRole("menu");
      expect(within(menu).getByRole("menuitem", { name: "Restore as draft" })).toBeInTheDocument();
      expect(within(menu).queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    });

    it("puts the status decision first and the destructive tail last", async () => {
      const user = userEvent.setup();
      renderTable();
      const row = desktopRowFor("Approved Workshop");
      await user.click(within(row).getByRole("button", { name: "Actions for Approved Workshop" }));
      const labels = within(screen.getByRole("menu"))
        .getAllByRole("menuitem")
        .map((item) => item.textContent);
      expect(labels[0]).toBe("Unpublish");
      expect(labels.slice(-3)).toEqual(["Archive", "Cancel Event", "Delete"]);
    });

    it("selecting a menu item calls onAction with the action and the event", async () => {
      const user = userEvent.setup();
      const props = renderTable();
      const row = desktopRowFor("Approved Workshop");
      await user.click(within(row).getByRole("button", { name: "Actions for Approved Workshop" }));
      await user.click(screen.getByRole("menuitem", { name: "Unpublish" }));
      expect(props.onAction).toHaveBeenCalledWith(
        "unpublish",
        expect.objectContaining({ id: "event-2" })
      );
    });
  });

  describe("inline decisions", () => {
    it("Pending rows carry Approve and Reject; other statuses do not", () => {
      renderTable();
      const pending = desktopRowFor("Pending Social");
      expect(
        within(pending).getByRole("button", { name: "Approve Pending Social" })
      ).toBeInTheDocument();
      expect(
        within(pending).getByRole("button", { name: "Reject Pending Social" })
      ).toBeInTheDocument();
      const approved = desktopRowFor("Approved Workshop");
      expect(within(approved).queryByRole("button", { name: /^Approve / })).not.toBeInTheDocument();
      expect(within(approved).queryByRole("button", { name: /^Reject / })).not.toBeInTheDocument();
    });

    it("Approve asks for the publish action and Reject for the reject action", async () => {
      const user = userEvent.setup();
      const props = renderTable();
      const row = desktopRowFor("Pending Social");
      await user.click(within(row).getByRole("button", { name: "Approve Pending Social" }));
      expect(props.onAction).toHaveBeenLastCalledWith(
        "publish",
        expect.objectContaining({ id: "event-1" })
      );
      await user.click(within(row).getByRole("button", { name: "Reject Pending Social" }));
      expect(props.onAction).toHaveBeenLastCalledWith(
        "reject",
        expect.objectContaining({ id: "event-1" })
      );
    });

    it("a busy row cannot be decided twice", () => {
      renderTable({ busy: { id: "event-1", action: "publish" } });
      const row = desktopRowFor("Pending Social");
      expect(within(row).getByRole("button", { name: "Approve Pending Social" })).toBeDisabled();
      expect(within(row).getByRole("button", { name: "Reject Pending Social" })).toBeDisabled();
    });
  });

  describe("selection", () => {
    const pendingEvents = [
      baseEvent,
      { ...baseEvent, id: "event-4", title: "Second Pending" },
      { ...baseEvent, id: "event-5", title: "Third Pending" },
    ];

    it("offers no checkboxes unless selection is enabled", () => {
      renderTable();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("toggles a row and the whole page", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      const onToggleAll = vi.fn();
      renderTable({
        events: pendingEvents,
        selection: { selectedIds: new Set(["event-1"]), onToggle, onToggleAll },
      });
      const row = desktopRowFor("Second Pending");
      await user.click(within(row).getByRole("checkbox", { name: "Select Second Pending" }));
      expect(onToggle).toHaveBeenCalledWith("event-4");

      const all = screen.getByRole("checkbox", { name: "Select all events on this page" });
      expect(all).toHaveProperty("indeterminate", true);
      await user.click(all);
      expect(onToggleAll).toHaveBeenCalledWith(true);
    });
  });

  describe("focus after a decision", () => {
    const pendingEvents = [baseEvent, { ...baseEvent, id: "event-4", title: "Second Pending" }];

    it("hands focus to the neighbour's Approve when the decided row is gone", () => {
      const { rerender } = render(
        <MemoryRouter>
          <AdminEventsTable {...tableProps({ events: pendingEvents })} />
        </MemoryRouter>
      );
      rerender(
        <MemoryRouter>
          <AdminEventsTable
            {...tableProps({
              events: [pendingEvents[1]],
              focusRequest: { rowIds: ["event-1", "event-4"], nonce: 1 },
            })}
          />
        </MemoryRouter>
      );
      const [next] = screen.getAllByRole("button", { name: "Approve Second Pending" });
      expect(next).toHaveFocus();
    });

    it("calls onNone when no requested row remains", () => {
      const onNone = vi.fn();
      render(
        <MemoryRouter>
          <AdminEventsTable
            {...tableProps({ focusRequest: { rowIds: ["gone"], nonce: 1, onNone } })}
          />
        </MemoryRouter>
      );
      expect(onNone).toHaveBeenCalledOnce();
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

import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
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

function renderTable(overrides: Partial<ComponentProps<typeof AdminEventsTable>> = {}) {
  const props = {
    events,
    onEdit: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onDelete: vi.fn(),
    busy: null,
    errorId: null,
    error: null,
    ...overrides,
  };
  render(<AdminEventsTable {...props} />);
  return props;
}

function tableRowFor(title: string) {
  const table = screen.getByRole("table");
  const cell = within(table).getByText(title);
  return within(cell.closest("tr") as HTMLElement);
}

describe("AdminEventsTable", () => {
  it("renders a row per event", () => {
    renderTable();
    const table = screen.getByRole("table");
    // header row + one row per event
    expect(within(table).getAllByRole("row")).toHaveLength(events.length + 1);
  });

  it("hides Approve on an already-approved event and Reject on an already-rejected event", () => {
    renderTable();

    const approvedRow = tableRowFor("Approved Workshop");
    expect(approvedRow.queryByRole("button", { name: "Approve event" })).not.toBeInTheDocument();
    expect(approvedRow.getByRole("button", { name: "Reject event" })).toBeInTheDocument();

    const rejectedRow = tableRowFor("Rejected Class");
    expect(rejectedRow.queryByRole("button", { name: "Reject event" })).not.toBeInTheDocument();
    expect(rejectedRow.getByRole("button", { name: "Approve event" })).toBeInTheDocument();
  });

  it("calls onDelete with the event id when Delete is clicked, with no inline confirm", async () => {
    const user = userEvent.setup();
    const props = renderTable();

    const row = tableRowFor("Pending Social");
    await user.click(row.getByRole("button", { name: "Delete event" }));

    expect(props.onDelete).toHaveBeenCalledWith("event-1");
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it("disables all action buttons in the busy row", () => {
    renderTable({ busy: { id: "event-1", action: "delete" } });

    const row = tableRowFor("Pending Social");
    expect(row.getByRole("button", { name: "Edit event" })).toBeDisabled();
    expect(row.getByRole("button", { name: "Approve event" })).toBeDisabled();
    expect(row.getByRole("button", { name: "Reject event" })).toBeDisabled();
    expect(row.getByRole("button", { name: "Delete event" })).toBeDisabled();

    const otherRow = tableRowFor("Approved Workshop");
    expect(otherRow.getByRole("button", { name: "Edit event" })).not.toBeDisabled();
  });

  it("renders an inline error row for the failing event", () => {
    renderTable({ errorId: "event-1", error: "Network error" });

    const table = screen.getByRole("table");
    const alert = within(table).getByRole("alert");
    expect(alert).toHaveTextContent("Action failed: Network error");
  });
});

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { DatabaseEvent } from "../../features/events/model/types";
import AdminEventRow from "./AdminEventRow";

const event: DatabaseEvent = {
  id: "event-1",
  title: "Friday Social",
  description: "Live music and dancing all night.",
  event_type: "social",
  event_date: "2026-08-21T00:00:00.000Z",
  event_time: null,
  location: "Salsa Hall",
  address: "123 Dance Street",
  price_type: "paid",
  price_amount: 15,
  rsvp_link: "https://example.test/rsvp",
  image_url: null,
  submitter_name: "Ada Lovelace",
  submitter_email: "ada@salsa.test",
  submitter_id: null,
  status: "pending",
  city: "new-york-city",
  created_at: "2026-08-01T00:00:00.000Z",
  host: "Salsa Segura",
  recurrence: "weekly",
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
};

function renderRow(overrides: Partial<ComponentProps<typeof AdminEventRow>> = {}) {
  const props = {
    event,
    onEdit: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onDelete: vi.fn(),
    decision: null,
    isDeleting: false,
    error: null,
    ...overrides,
  };
  render(<AdminEventRow {...props} />);
  return props;
}

describe("AdminEventRow", () => {
  it("renders event details and status", () => {
    renderRow();
    expect(screen.getByRole("heading", { name: "Friday Social" })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Salsa Hall")).toBeInTheDocument();
    expect(screen.getByText("Aug 20, 8:00 PM")).toBeInTheDocument();
  });

  it("shows approve and reject only for pending rows", () => {
    const props = {
      event,
      onEdit: vi.fn(),
      onApprove: vi.fn(),
      onReject: vi.fn(),
      onDelete: vi.fn(),
      decision: null,
      isDeleting: false,
      error: null,
    } satisfies ComponentProps<typeof AdminEventRow>;
    const { rerender } = render(<AdminEventRow {...props} />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject event" })).toBeInTheDocument();
    rerender(<AdminEventRow {...props} event={{ ...event, status: "approved" }} />);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject event" })).not.toBeInTheDocument();
  });

  it("requires rejection confirmation and supports cancel", () => {
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Reject event" }));
    expect(screen.getByRole("button", { name: "Confirm rejection" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Reject event" })).toBeInTheDocument();
  });

  it("confirms deletion only after the second click", () => {
    const props = renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(props.onDelete).toHaveBeenCalledWith(event.id);
  });

  it("disables every action and shows the in-flight label", () => {
    renderRow({ decision: "rejected" });
    expect(screen.getByRole("button", { name: "Rejecting…" })).toBeDisabled();
    expect(screen.getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true);
  });
});

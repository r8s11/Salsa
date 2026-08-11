import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { DatabaseEvent } from "../../features/events/model/types";
import PendingEventCard from "./PendingEventCard";

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
};

function renderCard(overrides: Partial<ComponentProps<typeof PendingEventCard>> = {}) {
  const props = {
    event,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    decision: null,
    error: null,
    ...overrides,
  };
  render(<PendingEventCard {...props} />);
  return props;
}

describe("PendingEventCard", () => {
  it("renders operational metadata and protects the RSVP link", () => {
    renderCard();
    expect(screen.getByRole("article")).toHaveTextContent("Social");
    expect(screen.getByRole("article")).toHaveTextContent("New York City");
    expect(screen.getByText("$15")).toBeInTheDocument();
    expect(screen.getByText("Repeats: weekly")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    const rsvp = screen.getByRole("link", { name: "View RSVP" });
    expect(rsvp).toHaveAttribute("target", "_blank");
    expect(rsvp).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("approves in one click", () => {
    const { onApprove } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith(event.id);
  });

  it("requires confirmation before rejection and can cancel", () => {
    const { onReject } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Reject event" }));
    expect(screen.getByRole("button", { name: "Confirm rejection" })).toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Reject event" })).toBeInTheDocument();
  });

  it("confirms rejection", () => {
    const { onReject } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Reject event" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm rejection" }));
    expect(onReject).toHaveBeenCalledWith(event.id);
  });

  it("shows decision-specific in-flight labels and disables all actions", () => {
    renderCard({ decision: "rejected" });
    expect(screen.getByRole("button", { name: "Rejecting…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("keeps an approval failure classified while opening rejection confirmation", () => {
    const { onApprove } = renderCard({ error: "Database unavailable" });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith(event.id);
    fireEvent.click(screen.getByRole("button", { name: "Reject event" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Approval failed: Database unavailable");
    expect(screen.getByRole("button", { name: "Confirm rejection" })).toBeEnabled();
  });

  it("keeps rejection confirmation open and retries a failed rejection", () => {
    const onReject = vi.fn();
    const props = {
      event,
      onApprove: vi.fn(),
      onReject,
      decision: null as "approved" | "rejected" | null,
      error: null,
    };
    const { rerender } = render(<PendingEventCard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject event" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm rejection" }));
    rerender(<PendingEventCard {...props} error="Database unavailable" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Rejection failed: Database unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry rejection" }));
    expect(onReject).toHaveBeenCalledTimes(2);
    expect(onReject).toHaveBeenLastCalledWith(event.id);
  });
});

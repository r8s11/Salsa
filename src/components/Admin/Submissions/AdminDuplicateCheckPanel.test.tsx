import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DatabaseEvent } from "../../../features/events/model/types";
import type { DuplicateCandidate } from "../../../features/admin/model/submissions";
import AdminDuplicateCheckPanel from "./AdminDuplicateCheckPanel";

const mockEvent = {
  id: "evt-123",
  title: "Salsa Night",
  description: "Fun night!",
  event_type: "social",
  event_date: "2026-09-01T19:00:00Z",
  event_time: null,
  location: "Club Havana",
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  submitter_name: null,
  submitter_email: null,
  submitter_id: null,
  status: "approved",
  source_type: "admin",
  taxonomy_term_ids: [],
  taxonomy_terms: [],
  updated_at: "2026-08-20T10:00:00.000Z",
  cancellation_reason: null,
  city: "boston",
  created_at: "2026-08-20T10:00:00.000Z",
  host: "Maria",
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  venue_id: null,
} satisfies DatabaseEvent;

const mockCandidate: DuplicateCandidate = {
  event: mockEvent,
  signals: ["same-venue", "same-date"],
  confidence: "high",
};

describe("AdminDuplicateCheckPanel", () => {
  it("renders candidates correctly", () => {
    const onViewEvent = vi.fn();
    const onNotADuplicate = vi.fn();
    const onRejectAsDuplicate = vi.fn();

    render(
      <AdminDuplicateCheckPanel
        candidates={[mockCandidate]}
        onViewEvent={onViewEvent}
        onNotADuplicate={onNotADuplicate}
        onRejectAsDuplicate={onRejectAsDuplicate}
      />
    );

    expect(screen.getByText("Salsa Night")).toBeInTheDocument();
    expect(screen.getByText("Confidence: high")).toBeInTheDocument();
    expect(screen.getByText("same-venue")).toBeInTheDocument();
    expect(screen.getByText("same-date")).toBeInTheDocument();
  });

  it("calls handlers when buttons are clicked", () => {
    const onViewEvent = vi.fn();
    const onNotADuplicate = vi.fn();
    const onRejectAsDuplicate = vi.fn();

    render(
      <AdminDuplicateCheckPanel
        candidates={[mockCandidate]}
        onViewEvent={onViewEvent}
        onNotADuplicate={onNotADuplicate}
        onRejectAsDuplicate={onRejectAsDuplicate}
      />
    );

    fireEvent.click(screen.getByText("View Existing"));
    expect(onViewEvent).toHaveBeenCalledWith(mockEvent);

    fireEvent.click(screen.getByText("Not a Duplicate"));
    expect(onNotADuplicate).toHaveBeenCalledWith(mockEvent);

    fireEvent.click(screen.getByText("Reject as Duplicate"));
    expect(onRejectAsDuplicate).toHaveBeenCalledWith(mockEvent);
  });
});

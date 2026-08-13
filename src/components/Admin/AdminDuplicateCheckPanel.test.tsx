import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminDuplicateCheckPanel from "./AdminDuplicateCheckPanel";
import type { DuplicateCandidate } from "../../../features/submissions/model/submissions";
import type { DatabaseEvent } from "../../../features/events/model/types";

const mockEvent: DatabaseEvent = {
  id: "evt-123",
  title: "Salsa Night",
  event_date: "2026-09-01T19:00:00Z",
  location: "Club Havana",
  host: "Maria",
  description: "Fun night!",
  pricing: "",
  dance_styles: [],
  contact_details: "",
  flyer_url: "",
  organizer: "Club Havana"
} as any;

const mockCandidate: DuplicateCandidate = {
  event: mockEvent,
  signals: ["same-venue", "same-date"],
  confidence: "high"
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

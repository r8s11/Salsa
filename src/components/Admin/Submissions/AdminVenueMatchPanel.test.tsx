import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DatabaseEvent } from "../../../features/events/model/types";
import type { EventSubmission } from "../../../features/admin/model/submissions";
import AdminVenueMatchPanel from "./AdminVenueMatchPanel";

function makeSubmission(location: string): EventSubmission {
  return {
    id: "sub-1",
    submitter_id: "user-1",
    submitter_email: "submitter@example.com",
    submitter_name: "Submitter",
    status: "pending",
    submitted_data: { location },
    edited_data: null,
    submitted_at: "2026-08-20T10:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    rejection_message: null,
    internal_note: null,
    duplicate_of_event_id: null,
    dismissed_duplicate_ids: [],
    approved_event_id: null,
    created_at: "2026-08-20T10:00:00.000Z",
    updated_at: "2026-08-20T10:00:00.000Z",
  };
}

const mockExistingEvent = {
  id: "evt-1",
  title: "Existing Event",
  description: null,
  event_type: "social",
  event_date: "2026-08-20T20:00:00.000Z",
  event_time: null,
  location: "havana club",
  address: "123 Street",
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
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  venue_id: null,
} satisfies DatabaseEvent;

describe("AdminVenueMatchPanel", () => {
  it("renders new venue when no match found", () => {
    render(
      <AdminVenueMatchPanel
        submission={makeSubmission("New Place")}
        existingEvents={[]}
        onUseVenue={() => {}}
      />,
    );
    expect(screen.getByText(/New venue — will be recorded as free text/)).toBeDefined();
  });

  it("renders exact match and action button", () => {
    const handleUseVenue = vi.fn();
    render(
      <AdminVenueMatchPanel
        submission={makeSubmission("Havana Club")}
        existingEvents={[mockExistingEvent]}
        onUseVenue={handleUseVenue}
      />,
    );

    expect(screen.getByText(/Exact venue match found/)).toBeDefined();
    expect(screen.getByText("havana club")).toBeDefined();

    fireEvent.click(screen.getByText(/Use Existing Venue/));
    expect(handleUseVenue).toHaveBeenCalledWith("havana club");
  });
});

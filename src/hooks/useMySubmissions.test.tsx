import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { DatabaseEvent } from "../features/events/model/types";
import type { EventSubmission } from "../features/admin/model/submissions";
import { useMySubmissions } from "./useMySubmissions";

const { fetchMySubmissions, fetchMyApprovedEvents } = vi.hoisted(() => ({
  fetchMySubmissions: vi.fn(),
  fetchMyApprovedEvents: vi.fn(),
}));
const { fetchOwnEventSubmissions } = vi.hoisted(() => ({ fetchOwnEventSubmissions: vi.fn() }));

vi.mock("../features/events/api/eventsRepo", () => ({
  fetchMySubmissions,
  fetchMyApprovedEvents,
}));
vi.mock("../features/admin/api/submissionsRepo", () => ({ fetchOwnEventSubmissions }));

const approved: DatabaseEvent = {
  id: "approved-1", title: "Approved Event", description: null, event_type: "social",
  event_date: "2026-10-01T20:00:00Z", event_time: "20:00", location: null, address: null,
  price_type: "free", price_amount: null, rsvp_link: null, image_url: null,
  submitter_name: null, submitter_email: null, submitter_id: "owner-1", status: "approved",
  source_type: "organizer", taxonomy_term_ids: [], taxonomy_terms: [],
  updated_at: "2026-08-25T00:00:00Z", cancellation_reason: null, city: "boston",
  created_at: "2026-08-25T00:00:00Z", host: null, recurrence: null, gallery: null,
  contact_email: null, contact_instagram: null, contact_website: null, venue_id: null,
};

const pending: EventSubmission = {
  id: "submission-1", submitter_id: "owner-1", submitter_email: "owner@example.test",
  submitter_name: "Owner", status: "pending",
  submitted_data: { title: "New Pending Event", event_type: "social", city: "boston", event_date: "2026-10-02T20:00:00Z", dance_styles: [] },
  edited_data: null, submitted_at: "2026-08-25T00:00:00Z", reviewed_by: null, reviewed_at: null,
  rejection_reason: null, rejection_message: null, internal_note: null, duplicate_of_event_id: null,
  dismissed_duplicate_ids: [], approved_event_id: null, created_at: "2026-08-25T00:00:00Z", updated_at: "2026-08-25T00:00:00Z",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useMySubmissions", () => {
  it("combines canonical approved events with projected owner pending submissions", async () => {
    fetchMySubmissions.mockResolvedValue([]);
    fetchMyApprovedEvents.mockResolvedValue([approved]);
    fetchOwnEventSubmissions.mockResolvedValue([pending]);

    const { result } = renderHook(() => useMySubmissions("owner-1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.submissions).toMatchObject([
      { id: "submission-1", submission_id: "submission-1", status: "pending" },
    ]);
    expect(result.current.approvedEvents).toEqual([approved]);
  });
});

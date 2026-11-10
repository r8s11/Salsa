import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

import { WorkspaceAccessError } from "../../workspaces/api/workspacesRepo";
import {
  fetchAdminListingRequests,
  reviewListingRequest,
  submitEventLinkRequest,
  submitMissingListing,
  submitProfileChangeRequest,
} from "./listingRequestsRepo";

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: "r1", error: null });
});

describe("listingRequestsRepo", () => {
  it("sends a missing listing with every typed field", async () => {
    await expect(
      submitMissingListing({
        kind: "venue",
        name: "Casa Habana",
        city: "Boston",
        website: "https://casa.example",
        instagram: "@casa",
        details: "Opened in May",
        checkedExisting: true,
      }),
    ).resolves.toBe("r1");
    expect(rpc).toHaveBeenCalledWith("listing_request_submit_missing", {
      p_kind: "venue",
      p_name: "Casa Habana",
      p_city: "Boston",
      p_website: "https://casa.example",
      p_instagram: "@casa",
      p_details: "Opened in May",
      p_checked_existing: true,
    });
  });

  it("sends an event link for one listing and one event", async () => {
    await submitEventLinkRequest("dj", "d1", "e1", "I played the late set");
    expect(rpc).toHaveBeenCalledWith("listing_request_submit_event_link", {
      p_kind: "dj",
      p_entity_id: "d1",
      p_event_id: "e1",
      p_note: "I played the late set",
    });
  });

  it("sends an identity change with the requested name, city and note", async () => {
    await submitProfileChangeRequest("school", "s1", { requestedName: "Ritmo", requestedCity: "Cambridge", note: "Moved" });
    expect(rpc).toHaveBeenCalledWith("listing_request_submit_profile_change", {
      p_kind: "school",
      p_entity_id: "s1",
      p_requested_name: "Ritmo",
      p_requested_city: "Cambridge",
      p_note: "Moved",
    });
  });

  it("scopes the admin queue to one listing, or to nothing", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await fetchAdminListingRequests("pending", { kind: "dj", id: "d1" });
    expect(rpc).toHaveBeenLastCalledWith("admin_listing_requests", { p_status: "pending", p_entity_kind: "dj", p_entity_id: "d1" });
    await fetchAdminListingRequests(null);
    expect(rpc).toHaveBeenLastCalledWith("admin_listing_requests", { p_status: null, p_entity_kind: null, p_entity_id: null });
  });

  it("sends a decision with its note and created listing", async () => {
    rpc.mockResolvedValue({ data: { request_id: "r1", approved: true, request_type: "missing_listing" }, error: null });
    await reviewListingRequest("r1", true, "Created", "v9");
    expect(rpc).toHaveBeenCalledWith("admin_review_listing_request", {
      p_request_id: "r1",
      p_approve: true,
      p_note: "Created",
      p_resulting_entity_id: "v9",
    });
  });

  it("rejects with the server's exact words", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "You already asked for this link. It is waiting for review.", code: "23505" } });
    await expect(submitEventLinkRequest("dj", "d1", "e1", "")).rejects.toThrow("You already asked for this link. It is waiting for review.");
  });

  it("rejects with WorkspaceAccessError when the database refuses the caller", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "You do not manage this listing.", code: "42501" } });
    await expect(submitEventLinkRequest("dj", "d1", "e1", "")).rejects.toBeInstanceOf(WorkspaceAccessError);
  });
});

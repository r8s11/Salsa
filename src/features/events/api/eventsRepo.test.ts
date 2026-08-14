import "temporal-polyfill/global";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseEvent } from "../model/types";
import { duplicateEvent } from "./eventsRepo";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  replaceEventTaxonomyTerms: vi.fn(),
}));
vi.mock("../../../lib/supabase", () => ({ supabase: { from: () => ({ insert: mocks.insert }) } }));
vi.mock("../../admin/api/taxonomyRepo", () => ({ replaceEventTaxonomyTerms: mocks.replaceEventTaxonomyTerms }));

const source: DatabaseEvent = {
  id: "source-id", title: "Salsa Night", description: null, event_type: "social", event_date: "2026-09-01T00:00:00Z", event_time: "20:00", location: null, address: null, price_type: "free", price_amount: null, rsvp_link: null, image_url: null, submitter_name: null, submitter_email: null, submitter_id: null, status: "approved", source_type: "admin", taxonomy_term_ids: ["salsa-id"], taxonomy_terms: [{ id: "salsa-id", name: "Salsa", slug: "salsa", category: "dance_style", status: "active" }], updated_at: "2026-08-14T00:00:00Z", cancellation_reason: null, city: "boston", created_at: "2026-08-14T00:00:00Z", host: null, recurrence: null, gallery: null, contact_email: null, contact_instagram: null, contact_website: null, venue_id: null,
};

describe("eventsRepo taxonomy persistence", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.replaceEventTaxonomyTerms.mockReset();
    mocks.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "copy-id" }, error: null }) }) });
  });

  it("duplicates the event row without virtual taxonomy fields and replaces relationships", async () => {
    await duplicateEvent(source, { date: "2026-09-08", time: "20:00", publish: true }, { id: "admin-id", email: "admin@example.com" });
    const inserted = mocks.insert.mock.calls[0][0];
    expect(inserted).not.toHaveProperty("taxonomy_term_ids");
    expect(inserted).not.toHaveProperty("taxonomy_terms");
    expect(mocks.replaceEventTaxonomyTerms).toHaveBeenCalledWith("copy-id", ["salsa-id"]);
  });
});

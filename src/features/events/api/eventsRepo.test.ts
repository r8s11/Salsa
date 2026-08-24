import "temporal-polyfill/global";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseEvent } from "../model/types";
import {
  deleteEventForUser,
  duplicateEvent,
  fetchApprovedEventById,
  updateEventForUser,
} from "./eventsRepo";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  maybeSingle: vi.fn(),
  replaceEventTaxonomyTerms: vi.fn(),
}));

const queryBuilder = {
  insert: mocks.insert,
  update: mocks.update,
  delete: mocks.delete,
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: mocks.maybeSingle,
};

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    from: () => queryBuilder,
  },
}));
vi.mock("../../admin/api/taxonomyRepo", () => ({
  replaceEventTaxonomyTerms: mocks.replaceEventTaxonomyTerms,
}));

const source: DatabaseEvent = {
  id: "source-id",
  title: "Salsa Night",
  description: null,
  event_type: "social",
  event_date: "2026-09-01T00:00:00Z",
  event_time: "20:00",
  location: null,
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
  taxonomy_term_ids: ["salsa-id"],
  taxonomy_terms: [
    { id: "salsa-id", name: "Salsa", slug: "salsa", category: "dance_style", status: "active" },
  ],
  updated_at: "2026-08-14T00:00:00Z",
  cancellation_reason: null,
  city: "boston",
  created_at: "2026-08-14T00:00:00Z",
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  venue_id: null,
};

describe("eventsRepo taxonomy persistence", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.replaceEventTaxonomyTerms.mockReset();
    mocks.insert.mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: "copy-id" }, error: null }) }),
    });
  });

  it("duplicates the event row without virtual taxonomy fields and replaces relationships", async () => {
    await duplicateEvent(
      source,
      { date: "2026-09-08", time: "20:00", publish: true },
      { id: "admin-id", email: "admin@example.com" }
    );
    const inserted = mocks.insert.mock.calls[0][0];
    expect(inserted).not.toHaveProperty("taxonomy_term_ids");
    expect(inserted).not.toHaveProperty("taxonomy_terms");
    expect(mocks.replaceEventTaxonomyTerms).toHaveBeenCalledWith("copy-id", ["salsa-id"]);
  });
});

describe("fetchApprovedEventById", () => {
  beforeEach(() => {
    queryBuilder.select.mockClear();
    queryBuilder.eq.mockClear();
    mocks.maybeSingle.mockReset();
  });

  it("queries only the requested approved event and projects taxonomy", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        ...source,
        event_taxonomy_terms: [
          { taxonomy_term_id: "salsa-id", taxonomy_terms: source.taxonomy_terms[0] },
        ],
      },
      error: null,
    });

    await expect(fetchApprovedEventById("source-id")).resolves.toMatchObject({
      id: "source-id",
      taxonomy_term_ids: ["salsa-id"],
      taxonomy_terms: source.taxonomy_terms,
    });

    expect(queryBuilder.eq).toHaveBeenNthCalledWith(1, "id", "source-id");
    expect(queryBuilder.eq).toHaveBeenNthCalledWith(2, "status", "approved");
  });

  it("returns null when the approved event is absent", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(fetchApprovedEventById("missing")).resolves.toBeNull();
  });
});

describe("eventsRepo user update", () => {
  beforeEach(() => {
    mocks.update.mockReset();
    mocks.delete.mockReset();
  });

  it("sends an UPDATE to the events table with only user-editable fields and the event id", async () => {
    mocks.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    await updateEventForUser("event-id", {
      title: "Updated Title",
      description: "Updated description",
      event_type: "workshop",
      city: "boston",
      event_date: "2026-08-20T20:00:00Z",
      event_time: "20:00",
      location: "Venue",
      address: "123 Main St",
      price_type: "paid",
      price_amount: 15,
      rsvp_link: "https://example.com",
      recurrence: "weekly",
      dance_styles: ["salsa", "bachata"],
    });

    expect(mocks.update).toHaveBeenCalledWith({
      title: "Updated Title",
      description: "Updated description",
      event_type: "workshop",
      city: "boston",
      event_date: "2026-08-20T20:00:00Z",
      event_time: "20:00",
      location: "Venue",
      address: "123 Main St",
      price_type: "paid",
      price_amount: 15,
      rsvp_link: "https://example.com",
      recurrence: "weekly",
      dance_styles: ["salsa", "bachata"],
    });

    const eqCall = mocks.update.mock.results[0].value.eq;
    expect(eqCall).toHaveBeenCalledWith("id", "event-id");
  });

  it("does NOT send status, source_type, submitter_*, host, venue_id, contact_*, image_url, gallery", async () => {
    mocks.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    await updateEventForUser("event-id", {
      title: "Updated",
      event_type: "social",
      city: "boston",
      event_date: "2026-08-20T20:00:00Z",
      dance_styles: [],
    });

    const sentPayload = mocks.update.mock.calls[0][0];
    expect(sentPayload).not.toHaveProperty("status");
    expect(sentPayload).not.toHaveProperty("source_type");
    expect(sentPayload).not.toHaveProperty("submitter_id");
    expect(sentPayload).not.toHaveProperty("submitter_name");
    expect(sentPayload).not.toHaveProperty("submitter_email");
    expect(sentPayload).not.toHaveProperty("host");
    expect(sentPayload).not.toHaveProperty("venue_id");
    expect(sentPayload).not.toHaveProperty("contact_email");
    expect(sentPayload).not.toHaveProperty("image_url");
    expect(sentPayload).not.toHaveProperty("gallery");
  });

  it("throws the database error message when the update fails", async () => {
    mocks.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "Row not found" } }),
    });

    await expect(
      updateEventForUser("event-id", {
        title: "Updated",
        event_type: "social",
        city: "boston",
        event_date: "2026-08-20T20:00:00Z",
        dance_styles: [],
      })
    ).rejects.toThrow("Row not found");
  });

  it("deletes the event via deleteEventForUser with the event id", async () => {
    mocks.delete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    await deleteEventForUser("event-id");

    const eqCall = mocks.delete.mock.results[0].value.eq;
    expect(eqCall).toHaveBeenCalledWith("id", "event-id");
  });

  it("throws the database error message when deletion fails", async () => {
    mocks.delete.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "Permission denied" } }),
    });

    await expect(deleteEventForUser("event-id")).rejects.toThrow("Permission denied");
  });
});

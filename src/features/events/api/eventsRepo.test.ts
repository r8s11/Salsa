import "temporal-polyfill/global";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseEvent } from "../model/types";
import {
  createEventAsAdmin,
  deleteEventForUser,
  duplicateEvent,
  fetchApprovedEventById,
  recordEventTouch,
  updateEventFlyer,
  updateEventForUser,
} from "./eventsRepo";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
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
mocks.from.mockReturnValue(queryBuilder);

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
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
    mocks.from.mockClear();
    queryBuilder.select.mockClear();
    queryBuilder.eq.mockClear();
    mocks.maybeSingle.mockReset();
  });

  it("reads approved public event detail from the public view", async () => {
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

    expect(mocks.from).toHaveBeenCalledWith("public_events");
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

describe("createEventAsAdmin", () => {
  it("writes an approved admin-provenance event straight to events", async () => {
    mocks.insert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "new-id" }, error: null }),
      }),
    });

    await createEventAsAdmin(
      {
        title: "Admin Social",
        description: null,
        event_type: "social",
        event_date: "2026-10-01T00:00:00Z",
        event_time: "21:00",
        location: null,
        address: null,
        price_type: "free",
        price_amount: null,
        rsvp_link: null,
        city: "boston",
        recurrence: null,
        host: null,
        contact_email: null,
        contact_instagram: null,
        contact_website: null,
        venue_id: null,
        image_url: null,
        taxonomy_term_ids: [],
      } as Parameters<typeof createEventAsAdmin>[0],
      { id: "admin-1", email: "admin@example.com" }
    );

    expect(mocks.from).toHaveBeenCalledWith("events");
    expect(mocks.from).not.toHaveBeenCalledWith("event_submissions");

    const { calls } = mocks.insert.mock;
    const [inserted] = calls[calls.length - 1] as [Record<string, unknown>];
    expect(inserted.source_type).toBe("admin");
    expect(inserted.status).toBe("approved");
    expect(inserted.submitter_id).toBe("admin-1");
  });
});

describe("updateEventFlyer", () => {
  beforeEach(() => {
    mocks.update.mockReset();
    queryBuilder.select.mockClear();
    queryBuilder.eq.mockClear();
    queryBuilder.single.mockReset();
  });

  it("updates only image_url and verifies the row changed", async () => {
    const eqMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "evt-1", image_url: "https://storage.example.com/flyer.jpg" },
          error: null,
        }),
      }),
    });
    mocks.update.mockReturnValue({ eq: eqMock });

    await expect(
      updateEventFlyer("evt-1", "https://storage.example.com/flyer.jpg")
    ).resolves.toBeUndefined();

    expect(mocks.from).toHaveBeenCalledWith("events");
    expect(mocks.update).toHaveBeenCalledWith({
      image_url: "https://storage.example.com/flyer.jpg",
    });
    expect(eqMock).toHaveBeenCalledWith("id", "evt-1");
  });

  it("clears image_url when called with null", async () => {
    const eqMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "evt-1", image_url: null },
          error: null,
        }),
      }),
    });
    mocks.update.mockReturnValue({ eq: eqMock });

    await expect(updateEventFlyer("evt-1", null)).resolves.toBeUndefined();

    expect(mocks.update).toHaveBeenCalledWith({ image_url: null });
  });

  it("throws when Supabase returns an error", async () => {
    const eqMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "permission denied" },
        }),
      }),
    });
    mocks.update.mockReturnValue({ eq: eqMock });

    await expect(updateEventFlyer("evt-1", "url")).rejects.toThrow("permission denied");
  });

  it("throws when no row is returned (zero-row update)", async () => {
    const eqMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    mocks.update.mockReturnValue({ eq: eqMock });

    await expect(updateEventFlyer("evt-1", "url")).rejects.toThrow(
      "Event not found or update denied by policy."
    );
  });
});

describe("recordEventTouch", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.rpc.mockReset();
  });

  it("sends event id and kind through the record_event_touch RPC", async () => {
    await recordEventTouch("evt-touch-1", "view");

    expect(mocks.rpc).toHaveBeenCalledWith("record_event_touch", {
      p_event_id: "evt-touch-1",
      p_kind: "view",
    });
  });

  it("dedupes to one RPC call per event, kind and UTC day", async () => {
    await recordEventTouch("evt-touch-2", "rsvp_click");
    await recordEventTouch("evt-touch-2", "rsvp_click");

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    // A different kind on the same event still sends.
    await recordEventTouch("evt-touch-2", "view");
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("resolves without throwing when the RPC rejects", async () => {
    mocks.rpc.mockRejectedValue(new Error("network down"));

    await expect(recordEventTouch("evt-touch-3", "view")).resolves.toBeUndefined();
  });
});

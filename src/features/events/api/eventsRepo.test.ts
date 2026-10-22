import "temporal-polyfill/global";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseEvent } from "../model/types";
import {
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

describe("duplicateEvent preserves the event's time zone", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.replaceEventTaxonomyTerms.mockReset();
    mocks.insert.mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: "copy-id" }, error: null }) }),
    });
  });
  const actor = { id: "admin-id", email: "admin@example.com" };

  it.each([
    ["Los Angeles", "los-angeles", "2026-09-09T03:00:00Z"],
    ["Chicago", "chicago", "2026-09-09T01:00:00Z"],
    ["Boston", "boston", "2026-09-09T00:00:00Z"],
  ])("%s copy at 8pm is stored as 8pm local, not 8pm Eastern", async (_label, city, instant) => {
    await duplicateEvent({ ...source, city }, { date: "2026-09-08", time: "20:00", publish: false }, actor);
    expect(mocks.insert.mock.calls[0][0].event_date).toBe(instant);
  });

  it("copies in the venue zone when it differs from the metro", async () => {
    await duplicateEvent(
      { ...source, city: "new-york-city", venue_time_zone: "America/Chicago" },
      { date: "2026-09-08", time: "20:00", publish: false },
      actor
    );
    expect(mocks.insert.mock.calls[0][0].event_date).toBe("2026-09-09T01:00:00Z");
  });

  it("keeps the local hour when the copy lands across fall-back", async () => {
    await duplicateEvent(
      { ...source, city: "los-angeles" },
      { date: "2026-11-07", time: "20:00", publish: false },
      actor
    );
    expect(mocks.insert.mock.calls[0][0].event_date).toBe("2026-11-08T04:00:00Z"); // PST, UTC-8
  });

  it("does not send in-memory zone hints to the events table, which has no such columns", async () => {
    await duplicateEvent(
      {
        ...source,
        time_zone: "America/Chicago",
        venue_time_zone: "America/Chicago",
        series_time_zone: "America/Chicago",
      },
      { date: "2026-09-08", time: "20:00", publish: false },
      actor
    );
    const inserted = mocks.insert.mock.calls[0][0];
    expect(inserted).not.toHaveProperty("time_zone");
    expect(inserted).not.toHaveProperty("venue_time_zone");
    expect(inserted).not.toHaveProperty("series_time_zone");
  });
});
describe("duplicateEvent taxonomy failure", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.replaceEventTaxonomyTerms.mockReset();
    mocks.insert.mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: "copy-id" }, error: null }) }),
    });
  });

  it("keeps the duplicate saved when taxonomy linking fails and reports a warning", async () => {
    mocks.replaceEventTaxonomyTerms.mockRejectedValue(new Error("taxonomy unavailable"));
    const onTaxonomyFailure = vi.fn();

    await expect(
      duplicateEvent(
        source,
        { date: "2026-09-08", time: "20:00", publish: true },
        { id: "admin-id", email: "admin@example.com" },
        onTaxonomyFailure
      )
    ).resolves.toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(onTaxonomyFailure).toHaveBeenCalledWith(
      "Event saved, but tags could not be linked. Check them in the event editor."
    );
    mocks.replaceEventTaxonomyTerms.mockResolvedValue(undefined);
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

    const eventId = "11111111-1111-4111-8111-111111111111";
    await expect(fetchApprovedEventById(eventId)).resolves.toMatchObject({
      id: "source-id",
      taxonomy_term_ids: ["salsa-id"],
      taxonomy_terms: source.taxonomy_terms,
    });

    expect(mocks.from).toHaveBeenCalledWith("public_events");
    expect(queryBuilder.eq).toHaveBeenNthCalledWith(1, "id", eventId);
    expect(queryBuilder.eq).toHaveBeenNthCalledWith(2, "status", "approved");
  });
  it("looks up a non-UUID route segment by persisted event slug", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...source, slug: "salsa-night" }, error: null });

    await expect(fetchApprovedEventById("salsa-night")).resolves.toMatchObject({
      id: "source-id",
      slug: "salsa-night",
    });

    expect(queryBuilder.eq).toHaveBeenNthCalledWith(1, "slug", "salsa-night");
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
      event_types: ["workshop", "concert"],
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
      event_types: ["workshop", "concert"],
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

  it("sends allowed user fields and excludes admin-only fields", async () => {
    mocks.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    await updateEventForUser("event-id", {
      title: "Updated",
      event_type: "social",
      event_types: ["social"],
      city: "boston",
      event_date: "2026-08-20T20:00:00Z",
      dance_styles: [],
      image_url: "https://storage.example.com/user-flyer.jpg",
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
    expect(sentPayload).not.toHaveProperty("gallery");
    expect(sentPayload.image_url).toBe("https://storage.example.com/user-flyer.jpg");
    expect(sentPayload.event_types).toEqual(["social"]);
  });

  it("throws the database error message when the update fails", async () => {
    mocks.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "Row not found" } }),
    });

    await expect(
      updateEventForUser("event-id", {
        title: "Updated",
        event_type: "social",
        event_types: ["social"],
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


describe("updateEventFlyer", () => {
  beforeEach(() => {
    mocks.update.mockReset();
    queryBuilder.select.mockClear();
    queryBuilder.eq.mockClear();
    queryBuilder.maybeSingle.mockReset();
  });

  it("updates only image_url and verifies the row changed", async () => {
    const eqMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
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
        maybeSingle: vi.fn().mockResolvedValue({
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
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "permission denied" },
        }),
      }),
    });
    mocks.update.mockReturnValue({ eq: eqMock });

    await expect(updateEventFlyer("evt-1", "url")).rejects.toThrow("permission denied");
  });

  it("reports a zero-row update from maybeSingle's normal no-row result", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ maybeSingle }),
    });
    mocks.update.mockReturnValue({ eq: eqMock });

    await expect(updateEventFlyer("evt-1", "url")).rejects.toThrow(
      "Event not found or update denied by policy."
    );
    expect(maybeSingle).toHaveBeenCalledTimes(1);
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

  it("dedupes view touches per event and UTC day but records each action", async () => {
    await recordEventTouch("evt-touch-2", "view");
    await recordEventTouch("evt-touch-2", "view");

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenLastCalledWith("record_event_touch", {
      p_event_id: "evt-touch-2",
      p_kind: "view",
    });

    // Explicit outbound actions are separate interactions, not session-deduped.
    await recordEventTouch("evt-touch-2", "rsvp_click");
    await recordEventTouch("evt-touch-2", "rsvp_click");
    await recordEventTouch("evt-touch-2", "ticket_click");
    await recordEventTouch("evt-touch-2", "ticket_click");
    await recordEventTouch("evt-touch-2", "share");
    await recordEventTouch("evt-touch-2", "share");
    expect(mocks.rpc).toHaveBeenCalledTimes(7);
  });

  it.each([{ doNotTrack: "1" }, { globalPrivacyControl: true }])("honors browser privacy signals without storing view markers", async (privacy) => {
    vi.stubGlobal("navigator", { ...navigator, ...privacy });
    try {
      await recordEventTouch("evt-private", "view");
      await recordEventTouch("evt-private", "rsvp_click");
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(sessionStorage.length).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

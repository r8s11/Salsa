import { describe, expect, it } from "vitest";
import { buildEmptyAdminForm } from "./adminEventForm";
import { applySeriesToComposer, readComposerRecovery } from "./eventComposerDraft";
import type { DatabaseEvent } from "../../events/model/types";

const source: DatabaseEvent = {
  id: "earlier",
  title: "Thursday social",
  description: "Earlier description",
  event_type: "social",
  event_date: "2026-10-09T00:00:00Z",
  event_time: "20:00",
  location: "Havana",
  address: "1 Main St",
  price_type: "paid",
  price_amount: 20,
  rsvp_link: null,
  image_url: "https://example.com/old.png",
  status: "approved",
  source_type: "admin",
  taxonomy_term_ids: ["salsa"],
  taxonomy_terms: [],
  city: "boston",
  sublocation: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  host: "Salsa crew",
  recurrence: "weekly",
  gallery: null,
  venue_id: "venue",
};

describe("composer series reuse", () => {
  it("reuses artwork and event defaults but never copies an occurrence date", () => {
    const next = applySeriesToComposer(
      buildEmptyAdminForm("boston"),
      {
        id: "series",
        name: "Thursdays",
        image_url: "https://example.com/series.png",
      },
      source,
      new Set()
    );
    expect(next).toMatchObject({
      title: "Thursday social",
      event_type: "social",
      event_date: "",
      event_time: "20:00",
      image_url: "https://example.com/series.png",
      image_urls: ["https://example.com/series.png"],
      series_id: "series",
      recurrence: "",
    });
  });

  it("copies every flyer of the earlier occurrence when the series has no artwork of its own", () => {
    const next = applySeriesToComposer(
      buildEmptyAdminForm("boston"),
      { id: "series", name: "Thursdays" },
      { ...source, image_urls: ["https://example.com/old.png", "https://example.com/old-2.png"] },
      new Set()
    );
    expect(next.image_url).toBe("https://example.com/old.png");
    expect(next.image_urls).toEqual(["https://example.com/old.png", "https://example.com/old-2.png"]);
  });

  it("preserves manually edited and deliberately cleared fields", () => {
    const form = {
      ...buildEmptyAdminForm("new-york-city"),
      title: "My night",
      description: "",
      event_date: "2026-11-12",
    };
    const next = applySeriesToComposer(
      form,
      { id: "series", name: "Series", city: "boston" },
      source,
      new Set(["description", "city"])
    );
    expect(next).toMatchObject({
      title: "My night",
      description: "",
      city: "new-york-city",
      event_date: "2026-11-12",
    });
  });
});

describe("composer recovery", () => {
  it("recovers incomplete fields, explicit clears, and the existing saved ID", () => {
    const initial = buildEmptyAdminForm("boston");
    const saved = { id: "saved", status: "draft" };
    const next = readComposerRecovery(
      JSON.stringify({
        version: 1,
        form: { ...initial, title: "Unfinished" },
        saved,
        edited: ["description"],
      }),
      initial
    );
    expect(next?.form).toMatchObject({ title: "Unfinished", event_date: "" });
    expect(next?.saved).toEqual(saved);
    expect(next?.edited).toContain("description");
  });

  it("recovers the ordered flyer list, and derives it from a legacy draft that only has the primary", () => {
    const initial = buildEmptyAdminForm("boston");
    const withList = readComposerRecovery(
      JSON.stringify({
        version: 1,
        form: {
          ...initial,
          image_url: "https://example.com/a.png",
          image_urls: ["https://example.com/a.png", "https://example.com/b.png"],
        },
        saved: null,
        edited: ["image_urls"],
      }),
      initial
    );
    expect(withList?.form.image_urls).toEqual([
      "https://example.com/a.png",
      "https://example.com/b.png",
    ]);
    expect(withList?.edited).toContain("image_urls");

    const { image_urls: _omitted, ...legacyForm } = {
      ...initial,
      image_url: "https://example.com/a.png",
    };
    const legacy = readComposerRecovery(
      JSON.stringify({ version: 1, form: legacyForm, saved: null, edited: [] }),
      initial
    );
    expect(legacy?.form).toMatchObject({
      image_url: "https://example.com/a.png",
      image_urls: ["https://example.com/a.png"],
    });
  });

  it("rejects malformed recovery without replacing the initial event", () => {
    const initial = buildEmptyAdminForm("boston");
    expect(
      readComposerRecovery('{"version":1,"form":{"title":42},"edited":[]}', initial)
    ).toBeNull();
    expect(readComposerRecovery("not json", initial)).toBeNull();
  });
});

it("does not mix series venue links or addresses into a populated venue", () => {
  const form = { ...buildEmptyAdminForm("boston"), location: "My venue", address: "" };
  const next = applySeriesToComposer(
    form,
    { id: "series", name: "New series", venue_id: "venue-b" },
    source,
    new Set()
  );
  expect(next).toMatchObject({ venue_id: "", location: "My venue", address: "" });
});

describe("composer event types", () => {
  const multiSource: DatabaseEvent = {
    ...source,
    event_type: "live_music",
    event_types: ["live_music", "concert"],
  };

  it("fills both type fields from the earlier occurrence without a mismatch", () => {
    const next = applySeriesToComposer(
      buildEmptyAdminForm("boston"),
      { id: "series", name: "Series" },
      multiSource,
      new Set()
    );
    expect(next).toMatchObject({
      event_type: "live_music",
      event_types: ["live_music", "concert"],
    });
  });

  it("keeps a deliberate selection, even when it only changed the list", () => {
    const form = {
      ...buildEmptyAdminForm("boston"),
      event_type: "social" as const,
      event_types: ["social" as const, "class" as const],
    };
    const next = applySeriesToComposer(
      form,
      { id: "series", name: "Series" },
      multiSource,
      new Set(["event_types"])
    );
    expect(next).toMatchObject({ event_type: "social", event_types: ["social", "class"] });
  });

  it("does not refill a selection the person deliberately cleared", () => {
    const next = applySeriesToComposer(
      buildEmptyAdminForm("boston"),
      { id: "series", name: "Series" },
      multiSource,
      new Set(["event_type", "event_types"])
    );
    expect(next).toMatchObject({ event_type: "", event_types: [] });
  });

  it("completes a primary-only draft with a one-item list instead of the source list", () => {
    const form = { ...buildEmptyAdminForm("boston"), event_type: "class" as const };
    const next = applySeriesToComposer(form, { id: "series", name: "Series" }, multiSource, new Set());
    expect(next).toMatchObject({ event_type: "class", event_types: ["class"] });
  });

  it("recovers a saved multi-type selection in order", () => {
    const initial = buildEmptyAdminForm("boston");
    const next = readComposerRecovery(
      JSON.stringify({
        version: 1,
        form: { ...initial, event_type: "concert", event_types: ["concert", "workshop"] },
        saved: null,
        edited: ["event_types"],
      }),
      initial
    );
    expect(next?.form).toMatchObject({
      event_type: "concert",
      event_types: ["concert", "workshop"],
    });
    expect(next?.edited).toContain("event_types");
  });

  it("recovers a draft saved before multi-select from its primary type", () => {
    const initial = buildEmptyAdminForm("boston");
    const { event_types: _eventTypes, ...legacyForm } = initial;
    const next = readComposerRecovery(
      JSON.stringify({
        version: 1,
        form: { ...legacyForm, event_type: "class" },
        saved: null,
        edited: [],
      }),
      initial
    );
    expect(next?.form).toMatchObject({ event_type: "class", event_types: ["class"] });
  });

  it("recovers lists even when the initial form was built without the field", () => {
    const { event_types: _eventTypes, ...initial } = buildEmptyAdminForm("boston");
    const next = readComposerRecovery(
      JSON.stringify({
        version: 1,
        form: { ...initial, event_type: "social", event_types: ["social", "concert"] },
        saved: null,
        edited: ["event_types"],
      }),
      initial
    );
    expect(next?.form).toMatchObject({ event_type: "social", event_types: ["social", "concert"] });
    expect(next?.edited).toContain("event_types");
  });

  it("rejects a recovered list that is not an array", () => {
    const initial = buildEmptyAdminForm("boston");
    expect(
      readComposerRecovery(
        JSON.stringify({ version: 1, form: { ...initial, event_types: "social" }, edited: [] }),
        initial
      )
    ).toBeNull();
  });
});

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
      series_id: "series",
      recurrence: "",
    });
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

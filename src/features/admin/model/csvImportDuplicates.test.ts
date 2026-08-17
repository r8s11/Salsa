import { describe, expect, it } from "vitest";
import { findCsvRowDuplicates } from "./csvImportDuplicates";
import { validateCsvRow } from "./csvImportValidation";
import type { DatabaseEvent } from "../../events/model/types";

function existingEvent(overrides: Partial<DatabaseEvent> = {}): DatabaseEvent {
  return {
    id: "event-1",
    title: "Salsa Social",
    description: null,
    event_type: "social",
    event_date: "2026-09-16T00:00:00Z",
    event_time: "8:00 PM",
    location: "The Dance Loft",
    address: null,
    price_type: null,
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
    updated_at: "2026-08-01T00:00:00Z",
    cancellation_reason: null,
    city: "boston",
    created_at: "2026-08-01T00:00:00Z",
    host: "Maria's Studio",
    recurrence: null,
    gallery: null,
    contact_email: null,
    contact_instagram: null,
    contact_website: null,
    venue_id: null,
    ...overrides,
  };
}

function csvRow(overrides: Record<string, string> = {}) {
  return validateCsvRow(
    {
      title: "Salsa Social",
      event_type: "social",
      event_date: "2026-09-15",
      city: "boston",
      event_time: "20:00",
      location: "The Dance Loft",
      host: "Maria's Studio",
      ...overrides,
    },
    0,
    [],
    []
  );
}

describe("findCsvRowDuplicates", () => {
  it("flags a row matching title + date + venue + host as high confidence", () => {
    const matches = findCsvRowDuplicates(csvRow(), [existingEvent()]);
    expect(matches).toHaveLength(1);
    expect(matches[0].confidence).toBe("high");
    expect(matches[0].signals).toEqual(
      expect.arrayContaining(["same-venue", "same-date", "similar-title", "same-organizer"])
    );
  });

  it("requires at least two signals — a title match alone is not a duplicate", () => {
    const matches = findCsvRowDuplicates(
      csvRow({ location: "", host: "", event_date: "2027-01-01" }),
      [existingEvent()]
    );
    expect(matches).toEqual([]);
  });

  it("treats exactly two signals as medium confidence", () => {
    const matches = findCsvRowDuplicates(csvRow({ location: "", host: "" }), [existingEvent()]);
    expect(matches).toHaveLength(1);
    expect(matches[0].confidence).toBe("medium");
    expect(matches[0].signals).toEqual(expect.arrayContaining(["same-date", "similar-title"]));
  });

  it("is case- and whitespace-insensitive on title and venue", () => {
    const matches = findCsvRowDuplicates(
      csvRow({ title: "  salsa SOCIAL  ", location: "  the dance LOFT " }),
      [existingEvent()]
    );
    expect(matches).toHaveLength(1);
  });

  it("returns nothing when there are no existing events", () => {
    expect(findCsvRowDuplicates(csvRow(), [])).toEqual([]);
  });

  it("returns nothing for an invalid row (no payload to compare)", () => {
    const invalid = csvRow({ title: "" });
    expect(invalid.payload).toBeNull();
    expect(findCsvRowDuplicates(invalid, [existingEvent()])).toEqual([]);
  });

  it("does not count a blank venue as matching a blank existing venue", () => {
    const matches = findCsvRowDuplicates(
      csvRow({ location: "", host: "", title: "Totally Different", event_date: "2026-09-15" }),
      [existingEvent({ location: null, title: "Other Event" })]
    );
    expect(matches).toEqual([]);
  });
});

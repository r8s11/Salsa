import { describe, expect, it } from "vitest";
import { applyExtractionToEventForm } from "./applyExtraction";
import type { ExtractedEvent } from "./types";
import type { ReconciledExtraction } from "../entity-matching/types";

const extraction = (over: Partial<ExtractedEvent>): ExtractedEvent => ({
  title: null,
  date: null,
  start_time: null,
  end_time: null,
  venue_name: "Havana Club",
  address: "288 Green St",
  city: "Cambridge",
  dance_styles: [],
  event_type: null,
  price: null,
  organizer_name: "Salsa y Control",
  instagram: "@salsaycontrol",
  website: null,
  details: [],
  ...over,
});

const emptyDraft = () => ({
  title: "",
  description: "",
  event_type: "" as const,
  city: "boston" as const,
  event_date: "",
  event_time: "",
  recurrence: "" as const,
  location: "",
  address: "",
  venue_id: "",
  price_type: "" as const,
  price_amount: "",
  rsvp_link: "",
  image_url: "",
  host: "",
  contact_email: "",
  contact_instagram: "",
  contact_website: "",
  submitter_name: "",
  submitter_email: "",
  dance_styles: [] as string[],
  taxonomy_term_ids: [] as string[],
});

const exactVenueReconciliation: ReconciledExtraction = {
  venue: {
    status: "exact",
    venue_id: "v1",
    venue_name: "Havana Club",
    city: "Cambridge",
    address: "288 Green Street",
    matched_on: ["name", "address"],
  },
  organizer: { status: "none" },
  dance_styles: [],
  event_type: { raw: null, slug: null },
};

const noneReconciliation: ReconciledExtraction = {
  venue: { status: "none" },
  organizer: { status: "none" },
  dance_styles: [],
  event_type: { raw: null, slug: null },
};

describe("applyExtractionToEventForm — Phase 4 reconciliation", () => {
  it("fills empty address from canonical venue on exact match", () => {
    const next = applyExtractionToEventForm(emptyDraft(), extraction({ address: null }), exactVenueReconciliation);
    expect(next.address).toBe("288 Green Street");
    expect(next.location).toBe("Havana Club");
  });

  it("does NOT overwrite a user-typed address when canonical venue resolves", () => {
    const draft = emptyDraft();
    draft.address = "1 User Street";
    const next = applyExtractionToEventForm(draft, extraction({ address: "288 Green St" }), exactVenueReconciliation);
    // User value wins.
    expect(next.address).toBe("1 User Street");
  });

  it("does NOT overwrite a user-typed venue name", () => {
    const draft = emptyDraft();
    draft.location = "My Own Venue";
    const next = applyExtractionToEventForm(draft, extraction({}), exactVenueReconciliation);
    expect(next.location).toBe("My Own Venue");
  });

  it("falls back to raw extracted address when no canonical match", () => {
    const next = applyExtractionToEventForm(emptyDraft(), extraction({ address: "288 Green St" }), noneReconciliation);
    expect(next.address).toBe("288 Green St");
  });

  it("uses resolved organizer brand name in the description tail", () => {
    const withOrg: ReconciledExtraction = {
      ...exactVenueReconciliation,
      organizer: { status: "strong", organizer_id: "o1", name: "Salsa y Control", matched_on: ["instagram"] },
    };
    const next = applyExtractionToEventForm(emptyDraft(), extraction({}), withOrg);
    expect(next.description).toContain("Presented by: Salsa y Control");
  });

  it("never attaches a venue_id or organizer_id to the submit draft", () => {
    const next = applyExtractionToEventForm(emptyDraft(), extraction({}), exactVenueReconciliation);
    // Submit flow has no venue_id in its payload shape, but assert the draft is
    // untouched for identity-bearing fields.
    expect(next.venue_id).toBe("");
  });
});

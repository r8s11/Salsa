import { describe, expect, it } from "vitest";
import type { EventFormDraft } from "../events/components/EventForm";
import type { ExtractedEvent } from "./types";
import { applyExtractionToDraft } from "./prefill";

const BASE_DRAFT: EventFormDraft = {
  title: "",
  description: "",
  event_type: "",
  city: "boston",
  event_date: "",
  event_time: "",
  recurrence: "",
  location: "",
  address: "",
  venue_id: "",
  price_type: "",
  price_amount: "",
  rsvp_link: "",
  image_url: "",
  host: "",
  contact_email: "",
  contact_instagram: "",
  contact_website: "",
  submitter_name: "",
  submitter_email: "",
  dance_styles: [],
  taxonomy_term_ids: [],
};

const BASE_EXTRACTION: ExtractedEvent = {
  title: null,
  date: null,
  start_time: null,
  end_time: null,
  venue_name: null,
  address: null,
  city: null,
  dance_styles: [],
  event_type: null,
  price: null,
  organizer_name: null,
  instagram: null,
  website: null,
  details: [],
};

// The registered metros mapCity resolves against — mirrors what useMetros()
// would supply in production. Includes a metro with no built-in locality
// alias (Miami) to prove resolution isn't limited to the hardcoded list.
const METROS = [
  { slug: "boston", name: "Boston" },
  { slug: "new-york-city", name: "New York City" },
  { slug: "miami", name: "Miami" },
];

describe("applyExtractionToDraft", () => {
  it("fills empty text, date, and time fields", () => {
    const { draft, filled, skipped } = applyExtractionToDraft(
      {
        ...BASE_EXTRACTION,
        title: "Havana Friday Social",
        date: "2026-09-18",
        start_time: "21:00",
        venue_name: "Havana Club",
        address: "288 Columbus Ave",
        website: "https://example.com",
        details: ["Three rooms of salsa.", "Beginner lesson at 8."],
      },
      BASE_DRAFT,
      METROS
    );

    expect(draft.title).toBe("Havana Friday Social");
    expect(draft.event_date).toBe("2026-09-18");
    expect(draft.event_time).toBe("21:00");
    expect(draft.location).toBe("Havana Club");
    expect(draft.address).toBe("288 Columbus Ave");
    expect(draft.rsvp_link).toBe("https://example.com");
    expect(draft.description).toBe("Three rooms of salsa.\n\nBeginner lesson at 8.");
    expect(skipped).toEqual([]);
    expect(filled).toEqual(
      expect.arrayContaining(["Title", "Date", "Start time", "Venue", "Description"])
    );
  });

  it("never clobbers fields the user already typed", () => {
    const { draft, filled } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, title: "Flyer Title", venue_name: "Flyer Venue" },
      { ...BASE_DRAFT, title: "My Title" },
      METROS
    );

    expect(draft.title).toBe("My Title");
    expect(draft.location).toBe("Flyer Venue");
    expect(filled).not.toContain("Title");
  });

  it("maps city localities on either side of the comma", () => {
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, city: "Cambridge, MA" }, BASE_DRAFT, METROS)
        .draft.city
    ).toBe("boston");
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, city: "Brooklyn" }, BASE_DRAFT, METROS).draft
        .city
    ).toBe("new-york-city");
  });

  it("matches any registered metro by name, not just the built-in aliases", () => {
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, city: "Miami" }, BASE_DRAFT, METROS).draft.city
    ).toBe("miami");
  });

  it("leaves city alone and reports it when the locality is unknown", () => {
    const { draft, skipped } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, city: "Cambridgeport" },
      BASE_DRAFT,
      METROS
    );

    expect(draft.city).toBe("boston");
    expect(skipped).toContain("City");
  });

  it("maps event-type aliases and reports the unmappable", () => {
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, event_type: "Social" }, BASE_DRAFT, METROS)
        .draft.event_type
    ).toBe("social");
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, event_type: "lessons" }, BASE_DRAFT, METROS)
        .draft.event_type
    ).toBe("class");

    const { draft, skipped } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, event_type: "Festival" },
      BASE_DRAFT,
      METROS
    );
    expect(draft.event_type).toBe("");
    expect(skipped).toContain("Event type");
  });
  it("maps Live Music extraction labels to the event type", () => {
    const { draft } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, event_type: "Live Music" },
      BASE_DRAFT,
      METROS
    );
    expect(draft.event_type).toBe("live_music");
  });

  it("splits price into type and amount, including ranges", () => {
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, price: "$20" }, BASE_DRAFT, METROS).draft
    ).toMatchObject({ price_type: "paid", price_amount: "20" });
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, price: "$10-20" }, BASE_DRAFT, METROS).draft
    ).toMatchObject({ price_type: "paid", price_amount: "10" });
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, price: "Free" }, BASE_DRAFT, METROS).draft
    ).toMatchObject({ price_type: "free", price_amount: "" });

    const { draft, skipped } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, price: "Suggested donation" },
      BASE_DRAFT,
      METROS
    );
    expect(draft.price_type).toBe("");
    expect(skipped).toContain("Price");
  });

  it("unions mapped dance styles and reports fully-unmapped sets", () => {
    const { draft } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, dance_styles: ["Salsa", "Cha Cha", "Tango"] },
      { ...BASE_DRAFT, dance_styles: ["bachata"] },
      METROS
    );
    expect(draft.dance_styles).toEqual(["bachata", "salsa", "cha-cha"]);

    const skipped = applyExtractionToDraft(
      { ...BASE_EXTRACTION, dance_styles: ["Tango"] },
      BASE_DRAFT,
      METROS
    );
    expect(skipped.draft.dance_styles).toEqual([]);
    expect(skipped.skipped).toContain("Dance styles");
  });
});

describe("applyExtractionToDraft with structured entities", () => {
  const venueEntity = {
    name: "Havana Club",
    address: "288 Green St",
    city: "Cambridge",
    state_region: "MA",
    country: null,
    website: null,
    instagram: null,
    email: null,
    phone: null,
    organization: null,
  };

  it("falls back to the structured venue name and address when the flat fields are empty", () => {
    const { draft, filled } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, venue: venueEntity },
      BASE_DRAFT,
      METROS
    );
    expect(draft.location).toBe("Havana Club");
    expect(draft.address).toBe("288 Green St");
    expect(filled).toEqual(expect.arrayContaining(["Venue", "Address"]));
  });

  it("prefers the flat event fields over the structured venue", () => {
    const { draft } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, venue_name: "Flat Venue", venue: venueEntity },
      BASE_DRAFT,
      METROS
    );
    expect(draft.location).toBe("Flat Venue");
  });

  it("never turns the venue's city into the event city", () => {
    const { draft } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, venue: { ...venueEntity, city: "Brooklyn" } },
      BASE_DRAFT,
      METROS
    );
    expect(draft.city).toBe("boston");
  });

  it("never writes organizer, instructor or school data into the event draft", () => {
    const { draft } = applyExtractionToDraft(
      {
        ...BASE_EXTRACTION,
        organizer: { ...venueEntity, name: "Salsa Segura", instagram: "@salsasegura" },
        instructors: [{ ...venueEntity, name: "Ana" }],
        school: { ...venueEntity, name: "Mambo Co" },
      },
      BASE_DRAFT,
      METROS
    );
    expect(draft).toEqual(BASE_DRAFT);
  });
});

describe("applyExtractionToDraft manual city precedence", () => {
  it("keeps the city the user chose when preserveCity is set", () => {
    const { draft, filled, skipped } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, city: "Brooklyn" },
      BASE_DRAFT,
      METROS,
      { preserveCity: true }
    );
    expect(draft.city).toBe("boston");
    expect(filled).not.toContain("City");
    expect(skipped).not.toContain("City");
  });

  it("still reports an unmappable flyer locality as skipped while keeping the chosen city", () => {
    const { draft, skipped } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, city: "Providence, RI" },
      BASE_DRAFT,
      METROS,
      { preserveCity: true }
    );
    expect(draft.city).toBe("boston");
    expect(skipped).toContain("City");
  });

  it("still maps the city by default so first-time extraction keeps working", () => {
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, city: "Brooklyn" }, BASE_DRAFT, METROS).draft
        .city
    ).toBe("new-york-city");
  });
});

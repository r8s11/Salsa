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
      expect.arrayContaining(["Title", "Date", "Start time", "Venue", "Description"]),
    );
  });

  it("never clobbers fields the user already typed", () => {
    const { draft, filled } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, title: "Flyer Title", venue_name: "Flyer Venue" },
      { ...BASE_DRAFT, title: "My Title" },
    );

    expect(draft.title).toBe("My Title");
    expect(draft.location).toBe("Flyer Venue");
    expect(filled).not.toContain("Title");
  });

  it("maps city localities on either side of the comma", () => {
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, city: "Cambridge, MA" }, BASE_DRAFT).draft.city,
    ).toBe("boston");
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, city: "Brooklyn" }, BASE_DRAFT).draft.city,
    ).toBe("new-york-city");
  });

  it("leaves city alone and reports it when the locality is unknown", () => {
    const { draft, skipped } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, city: "Cambridgeport" },
      BASE_DRAFT,
    );

    expect(draft.city).toBe("boston");
    expect(skipped).toContain("City");
  });

  it("maps event-type aliases and reports the unmappable", () => {
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, event_type: "Social" }, BASE_DRAFT).draft
        .event_type,
    ).toBe("social");
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, event_type: "lessons" }, BASE_DRAFT).draft
        .event_type,
    ).toBe("class");

    const { draft, skipped } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, event_type: "Festival" },
      BASE_DRAFT,
    );
    expect(draft.event_type).toBe("");
    expect(skipped).toContain("Event type");
  });

  it("splits price into type and amount, including ranges", () => {
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, price: "$20" }, BASE_DRAFT).draft,
    ).toMatchObject({ price_type: "paid", price_amount: "20" });
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, price: "$10-20" }, BASE_DRAFT).draft,
    ).toMatchObject({ price_type: "paid", price_amount: "10" });
    expect(
      applyExtractionToDraft({ ...BASE_EXTRACTION, price: "Free" }, BASE_DRAFT).draft,
    ).toMatchObject({ price_type: "free", price_amount: "" });

    const { draft, skipped } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, price: "Suggested donation" },
      BASE_DRAFT,
    );
    expect(draft.price_type).toBe("");
    expect(skipped).toContain("Price");
  });

  it("unions mapped dance styles and reports fully-unmapped sets", () => {
    const { draft } = applyExtractionToDraft(
      { ...BASE_EXTRACTION, dance_styles: ["Salsa", "Cha Cha", "Tango"] },
      { ...BASE_DRAFT, dance_styles: ["bachata"] },
    );
    expect(draft.dance_styles).toEqual(["bachata", "salsa", "cha-cha"]);

    const skipped = applyExtractionToDraft(
      { ...BASE_EXTRACTION, dance_styles: ["Tango"] },
      BASE_DRAFT,
    );
    expect(skipped.draft.dance_styles).toEqual([]);
    expect(skipped.skipped).toContain("Dance styles");
  });
});

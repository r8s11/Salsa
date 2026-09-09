import { describe, expect, it } from "vitest";
import { matchVenue } from "./venueMatcher";
import { matchOrganizer } from "./organizerMatcher";
import {
  reconcileDanceStyles,
  reconcileEventType,
  DANCE_STYLE_ALIASES,
  EVENT_TYPE_ALIASES,
} from "./taxonomyMatcher";
import { normalizeAddress, normalizeInstagramHandle, normalizeName } from "./normalize";
import { reconcileExtraction, isResolved } from "./reconcile";
import type {
  OrganizerCandidate,
  ReconcileInput,
  VenueCandidate,
} from "./types";
import type { ExtractedEvent } from "../flyer-extraction/types";

// ─────────────────────────── helpers ───────────────────────────

const venue = (over: Partial<VenueCandidate>): VenueCandidate => ({
  id: "v1",
  name: "Havana Club",
  normalized_name: null,
  address_line1: "288 Green Street",
  city: "Cambridge",
  status: "active",
  ...over,
});

const organizer = (over: Partial<OrganizerCandidate>): OrganizerCandidate => ({
  id: "o1",
  name: "Salsa y Control",
  slug: null,
  instagram: "@salsaycontrol",
  website: "https://salsaycontrol.com",
  status: "active",
  ...over,
});

// ─────────────────────────── normalize ───────────────────────────

describe("normalize", () => {
  it("lowercases, trims, and collapses whitespace for names", () => {
    expect(normalizeName("  HAVANA   CLUB ")).toBe("havana club");
    expect(normalizeName("Havana Club Boston")).toBe("havana club boston");
  });

  it("does NOT make a suffix-contained name equal to a shorter name", () => {
    // Guard against the brief's warning: these must stay distinct.
    expect(normalizeName("Havana Club")).not.toBe(normalizeName("Havana Club Cambridge"));
    expect(normalizeName("Havana Club")).not.toBe(normalizeName("Havana Club Boston"));
  });

  it("normalizes street suffix variants to the same value (no geocoding)", () => {
    expect(normalizeAddress("123 Main Street")).toBe(normalizeAddress("123 Main St."));
    expect(normalizeAddress("123 main st")).toBe(normalizeAddress("123 Main Street"));
  });

  it("normalizes Instagram handles to a bare id", () => {
    expect(normalizeInstagramHandle("@SalsaYControl")).toBe("salsaycontrol");
    expect(normalizeInstagramHandle("instagram.com/salsaycontrol")).toBe("salsaycontrol");
  });
});

// ─────────────────────────── venue matching ───────────────────────────

describe("matchVenue", () => {
  it("returns exact on name + address", () => {
    const result = matchVenue(
      { venue_name: "Havana Club", address: "288 Green St", city: "Cambridge" },
      [venue({})]
    );
    expect(result.status).toBe("exact");
    expect(result.venue_id).toBe("v1");
    expect(result.matched_on).toContain("address");
  });

  it("returns strong on normalized name + city with one candidate", () => {
    const result = matchVenue(
      { venue_name: "  HAVANA CLUB ", address: null, city: "cambridge" },
      [venue({})]
    );
    expect(result.status).toBe("strong");
    expect(result.venue_id).toBe("v1");
    expect(result.matched_on).toContain("city");
  });

  it("flags duplicate names in the same area as ambiguous", () => {
    const result = matchVenue(
      { venue_name: "Havana Club", address: null, city: "Cambridge" },
      [
        venue({ id: "v1", address_line1: "288 Green Street" }),
        venue({ id: "v2", address_line1: "300 Blue Street" }),
      ]
    );
    expect(result.status).toBe("ambiguous");
    expect(result.venue_id).toBeUndefined();
    expect(result.candidates?.length).toBe(2);
  });

  it("does NOT fuzzy-match 'Havana Club' to 'Havana Nights' or 'Club Havana'", () => {
    const result = matchVenue(
      { venue_name: "Havana Club", address: null, city: null },
      [
        venue({ id: "x", name: "Havana Nights", address_line1: null, city: null }),
        venue({ id: "y", name: "Club Havana", address_line1: null, city: null }),
      ]
    );
    expect(result.status).toBe("none");
  });

  it("returns none when no candidate matches", () => {
    const result = matchVenue(
      { venue_name: "Casa Latina", address: null, city: null },
      [venue({})]
    );
    expect(result.status).toBe("none");
    expect(result.venue_id).toBeUndefined();
  });

  it("ignores non-active candidates", () => {
    const result = matchVenue(
      { venue_name: "Havana Club", address: "288 Green Street", city: "Cambridge" },
      [venue({ status: "archived" })]
    );
    expect(result.status).toBe("none");
  });

  it("does not treat a single name match with no city context as strong", () => {
    const result = matchVenue(
      { venue_name: "Havana Club", address: null, city: null },
      [venue({ id: "v1", city: "Cambridge" })]
    );
    expect(result.status).toBe("ambiguous");
  });
});

// ─────────────────────────── organizer matching ───────────────────────────

describe("matchOrganizer", () => {
  it("matches exactly on normalized name with a single candidate", () => {
    const result = matchOrganizer(
      { organizer_name: "Salsa y Control", instagram: null, website: null },
      [organizer({})]
    );
    expect(result.status).toBe("strong");
    expect(result.organizer_id).toBe("o1");
  });

  it("matches exactly on Instagram handle and never fabricates a user id", () => {
    const result = matchOrganizer(
      { organizer_name: "Some Promoter", instagram: "@salsaycontrol", website: null },
      [organizer({})]
    );
    expect(result.status).toBe("strong");
    expect(result.organizer_id).toBe("o1");
    expect(result.matched_on).toContain("instagram");
  });

  it("matches exactly on website domain", () => {
    const result = matchOrganizer(
      { organizer_name: null, instagram: null, website: "salsaycontrol.com/events" },
      [organizer({})]
    );
    expect(result.status).toBe("strong");
    expect(result.organizer_id).toBe("o1");
    expect(result.matched_on).toContain("website");
  });

  it("flags an ambiguous brand name and withholds an id", () => {
    const result = matchOrganizer(
      { organizer_name: "Latin Dance Boston", instagram: null, website: null },
      [
        organizer({ id: "a", name: "Latin Dance Boston", instagram: null, website: null }),
        organizer({ id: "b", name: "Latin Dance Boston", instagram: null, website: null }),
      ]
    );
    expect(result.status).toBe("ambiguous");
    expect(result.organizer_id).toBeUndefined();
  });

  it("returns none for an unrecognized organizer (no fabrication)", () => {
    const result = matchOrganizer(
      { organizer_name: "Mystery Crew", instagram: null, website: null },
      [organizer({})]
    );
    expect(result.status).toBe("none");
    expect(result.organizer_id).toBeUndefined();
  });

  it("never returns a user_id — only a brand id", () => {
    const result = matchOrganizer(
      { organizer_name: "Salsa y Control", instagram: null, website: null },
      [organizer({})]
    );
    expect(result.organizer_id).toBeDefined();
    // The shape has no user_id field at all; assert it is absent.
    expect((result as unknown as Record<string, unknown>).user_id).toBeUndefined();
  });
});

// ─────────────────────────── taxonomy reconciliation ───────────────────────────

describe("reconcileDanceStyles", () => {
  const known = ["salsa", "bachata", "merengue", "cha-cha", "kizomba", "zouk", "afro-cuban"];

  it("maps an exact known slug", () => {
    expect(reconcileDanceStyles(["Salsa"], { knownDanceStyleSlugs: known })).toEqual([
      { raw: "Salsa", slug: "salsa" },
    ]);
  });

  it("maps a supported alias", () => {
    expect(reconcileDanceStyles(["Bachata Sensual"], { knownDanceStyleSlugs: known })).toEqual([
      { raw: "Bachata Sensual", slug: "bachata" },
    ]);
    expect(reconcileDanceStyles(["Mambo"], { knownDanceStyleSlugs: known })).toEqual([
      { raw: "Mambo", slug: "salsa" },
    ]);
  });

  it("maps multiple styles", () => {
    expect(
      reconcileDanceStyles(["Salsa", "Bachata", "Kizomba"], { knownDanceStyleSlugs: known })
    ).toEqual([
      { raw: "Salsa", slug: "salsa" },
      { raw: "Bachata", slug: "bachata" },
      { raw: "Kizomba", slug: "kizomba" },
    ]);
  });

  it("de-duplicates repeated styles", () => {
    const out = reconcileDanceStyles(["Salsa", "salsa", "SALSA"], {
      knownDanceStyleSlugs: known,
    });
    expect(out).toEqual([{ raw: "Salsa", slug: "salsa" }]);
  });

  it("leaves an unknown style unresolved (slug null) but keeps raw text", () => {
    const out = reconcileDanceStyles(["Polka"], { knownDanceStyleSlugs: known });
    expect(out).toEqual([{ raw: "Polka", slug: null }]);
  });

  it("preserves specificity — 'Bachata Sensual' raw text survives", () => {
    const out = reconcileDanceStyles(["Bachata Sensual"], { knownDanceStyleSlugs: known });
    expect(out[0].raw).toBe("Bachata Sensual");
    expect(out[0].slug).toBe("bachata");
  });
});

describe("reconcileEventType", () => {
  it("maps an exact supported type", () => {
    expect(reconcileEventType("social")).toEqual({ raw: "social", slug: "social" });
  });

  it("maps a supported alias", () => {
    expect(reconcileEventType("Social Dancing")).toEqual({ raw: "Social Dancing", slug: "social" });
    expect(reconcileEventType("lesson")).toEqual({ raw: "lesson", slug: "class" });
    expect(reconcileEventType("bootcamp")).toEqual({ raw: "bootcamp", slug: "workshop" });
  });

  it("leaves an unsupported type unresolved (no force into social)", () => {
    expect(reconcileEventType("festival")).toEqual({ raw: "festival", slug: null });
  });

  it("exposes the alias map as explicit + testable", () => {
    expect(DANCE_STYLE_ALIASES["bachata sensual"]).toBe("bachata");
    expect(DANCE_STYLE_ALIASES["ny style salsa"]).toBe("salsa");
    expect(EVENT_TYPE_ALIASES["dance social"]).toBe("social");
  });
});

// ─────────────────────────── orchestrator + resilience ───────────────────────────

const emptyInput: ReconcileInput = {
  venueCandidates: [],
  organizerCandidates: [],
  knownDanceStyleSlugs: ["salsa", "bachata"],
  knownEventTypes: ["social", "class", "workshop"],
};

const extraction = (over: Partial<ExtractedEvent>): ExtractedEvent => ({
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
  ...over,
});

describe("reconcileExtraction (resilience + orchestration)", () => {
  it("returns none/unknown when no candidates exist (never throws)", () => {
    const result = reconcileExtraction(
      extraction({
        venue_name: "Havana Club",
        organizer_name: "Salsa y Control",
        dance_styles: ["Salsa"],
        event_type: "social",
      }),
      emptyInput
    );
    expect(result.venue.status).toBe("none");
    expect(result.organizer.status).toBe("none");
    expect(result.dance_styles[0].slug).toBe("salsa");
    expect(result.event_type.slug).toBe("social");
  });

  it("resolves a venue + organizer together when candidates are present", () => {
    const result = reconcileExtraction(
      extraction({
        venue_name: "Havana Club",
        address: "288 Green St",
        city: "Cambridge",
        organizer_name: "Salsa y Control",
        instagram: "@salsaycontrol",
        dance_styles: ["Salsa", "Bachata Sensual"],
        event_type: "social",
      }),
      {
        venueCandidates: [venue({})],
        organizerCandidates: [organizer({})],
        knownDanceStyleSlugs: ["salsa", "bachata"],
        knownEventTypes: ["social", "class", "workshop"],
      }
    );
    expect(result.venue.status).toBe("exact");
    expect(result.organizer.status).toBe("strong");
    expect(result.dance_styles.map((d) => d.slug)).toEqual(["salsa", "bachata"]);
    expect(result.event_type.slug).toBe("social");
  });

  it("isResolved is true only for exact/strong", () => {
    expect(isResolved("exact")).toBe(true);
    expect(isResolved("strong")).toBe(true);
    expect(isResolved("ambiguous")).toBe(false);
    expect(isResolved("none")).toBe(false);
  });
});

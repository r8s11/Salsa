import { describe, expect, it } from "vitest";
import type { ExtractedEvent } from "../flyer-extraction/types";
import {
  MAX_REVIEW_INSTRUCTORS,
  emptyEntityCandidates,
  emptyEntityReview,
  extractionEntityCandidates,
  mergeEntityReview,
  normalizeEntityCandidate,
  normalizeEntityCandidates,
  parseEntityMatches,
  parseEntityReview,
  type EntityCandidate,
  type EntityReview,
  type EntityReviewItem,
} from "./entityReview";

const ALPHA_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BETA_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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

function candidate(name: string, extra: Partial<EntityCandidate> = {}): EntityCandidate {
  return {
    name,
    address: null,
    city: null,
    state_region: null,
    country: null,
    website: null,
    instagram: null,
    email: null,
    phone: null,
    organization: null,
    ...extra,
  };
}

function item(
  name: string,
  overrides: Partial<EntityReviewItem> = {},
  extra: Partial<EntityCandidate> = {}
): EntityReviewItem {
  return {
    candidate: candidate(name, extra),
    state: "NEW",
    matches: [],
    decision: "pending",
    selected_id: null,
    ...overrides,
  };
}

describe("normalizeEntityCandidate", () => {
  it("returns every key, trims, collapses whitespace and strips control characters", () => {
    expect(
      normalizeEntityCandidate({
        name: "  Havana\nClub \u200B ",
        address: "288 Green St\r\nCambridge",
        city: " Cambridge ",
        state_region: "MA",
        country: "USA",
      })
    ).toEqual(
      candidate("Havana Club", {
        address: "288 Green St Cambridge",
        city: "Cambridge",
        state_region: "MA",
        country: "USA",
      })
    );
  });

  it("requires a readable name", () => {
    expect(normalizeEntityCandidate({ name: "   ", city: "Boston" })).toBeNull();
    expect(normalizeEntityCandidate({ city: "Boston" })).toBeNull();
    expect(normalizeEntityCandidate({ name: 42 })).toBeNull();
    expect(normalizeEntityCandidate(null)).toBeNull();
    expect(normalizeEntityCandidate("Havana Club")).toBeNull();
    expect(normalizeEntityCandidate(["Havana Club"])).toBeNull();
  });

  it("ignores unknown keys and non-string fields instead of copying them", () => {
    const result = normalizeEntityCandidate({
      name: "Rosa",
      city: 7,
      id: "11111111-1111-4111-8111-111111111111",
      role: "admin",
    });
    expect(result).toEqual(candidate("Rosa"));
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("role");
  });

  it("bounds every field", () => {
    const long = "x".repeat(800);
    const result = normalizeEntityCandidate({
      name: long,
      address: long,
      city: long,
      state_region: long,
      country: long,
      organization: long,
    })!;
    expect(result.name).toHaveLength(200);
    expect(result.address).toHaveLength(300);
    expect(result.city).toHaveLength(100);
    expect(result.state_region).toHaveLength(100);
    expect(result.country).toHaveLength(100);
    expect(result.organization).toHaveLength(200);
  });

  it("keeps only safe http(s) websites and assumes https for bare domains", () => {
    const website = (value: string) =>
      normalizeEntityCandidate({ name: "A", website: value })!.website;
    expect(website("salsasegura.com")).toBe("https://salsasegura.com");
    expect(website("https://example.com/x")).toBe("https://example.com/x");
    expect(website("javascript:alert(1)")).toBeNull();
    expect(website("ask at the door")).toBeNull();
    expect(website("https://user:pw@example.com")).toBeNull();
  });

  it("normalizes instagram handles and profile links, rejecting anything else", () => {
    const instagram = (value: string) =>
      normalizeEntityCandidate({ name: "A", instagram: value })!.instagram;
    expect(instagram("@salsa.segura")).toBe("@salsa.segura");
    expect(instagram("salsa_segura")).toBe("@salsa_segura");
    expect(instagram("https://www.instagram.com/salsa_segura/")).toBe("@salsa_segura");
    expect(instagram("instagram.com/salsa_segura?hl=en")).toBe("@salsa_segura");
    expect(instagram("follow us on instagram")).toBeNull();
    expect(instagram("https://evil.example/salsa")).toBeNull();
  });

  it("validates email and phone, never inventing a value", () => {
    const parsed = normalizeEntityCandidate({
      name: "A",
      email: " Info@Example.com ",
      phone: "(617) 555-0100",
    })!;
    expect(parsed.email).toBe("Info@Example.com");
    expect(parsed.phone).toBe("(617) 555-0100");

    const bad = normalizeEntityCandidate({
      name: "A",
      email: "info at example",
      phone: "call us",
    })!;
    expect(bad.email).toBeNull();
    expect(bad.phone).toBeNull();
  });
});

describe("normalizeEntityCandidates", () => {
  it("preserves same-name instructors with different identifying context", () => {
    const result = normalizeEntityCandidates({
      ...emptyEntityCandidates(),
      instructors: [
        candidate("Jane Dancer", { instagram: "@jane_miami" }),
        candidate(" jane dancer ", { instagram: "@jane_chicago" }),
        candidate("Jane Dancer", { organization: "Miami Academy" }),
        candidate("Jane Dancer", { organization: "Chicago Academy" }),
      ],
    });
    expect(
      result.instructors.map(({ instagram, organization }) => ({ instagram, organization }))
    ).toEqual([
      { instagram: "@jane_miami", organization: null },
      { instagram: "@jane_chicago", organization: null },
      { instagram: null, organization: "Miami Academy" },
      { instagram: null, organization: "Chicago Academy" },
    ]);
  });
  it("drops nameless entries, dedupes instructors by name and caps the list", () => {
    const instructors = [
      candidate("Ana"),
      candidate(" ana "),
      candidate("  "),
      ...Array.from({ length: 30 }, (_, index) => candidate(`Teacher ${index}`)),
    ];
    const result = normalizeEntityCandidates({
      venue: candidate("   "),
      organizer: candidate("Salsa Segura"),
      instructors,
      school: null,
    });
    expect(result.venue).toBeNull();
    expect(result.organizer?.name).toBe("Salsa Segura");
    expect(result.instructors).toHaveLength(MAX_REVIEW_INSTRUCTORS);
    expect(result.instructors.map((entry) => entry.name).slice(0, 2)).toEqual(["Ana", "Teacher 0"]);
  });
});

describe("extractionEntityCandidates", () => {
  it("uses the structured venue, organizer, instructors and school", () => {
    const result = extractionEntityCandidates({
      ...BASE_EXTRACTION,
      venue: candidate("Havana Club", { address: "288 Green St", city: "Cambridge" }),
      organizer: candidate("Salsa Segura", { instagram: "@salsasegura" }),
      instructors: [candidate("Ana Rivera"), candidate("Luis Ortiz", { organization: "Mambo Co" })],
      school: candidate("Mambo Co", { website: "https://mambo.example" }),
    });
    expect(result.venue?.name).toBe("Havana Club");
    expect(result.venue?.city).toBe("Cambridge");
    expect(result.organizer?.instagram).toBe("@salsasegura");
    expect(result.instructors.map((entry) => entry.name)).toEqual(["Ana Rivera", "Luis Ortiz"]);
    expect(result.instructors[1].organization).toBe("Mambo Co");
    expect(result.school?.website).toBe("https://mambo.example");
  });

  it("treats explicit structured nulls as authoritative, not as a cue to read flat fields", () => {
    const result = extractionEntityCandidates({
      ...BASE_EXTRACTION,
      venue_name: "Flat Venue",
      organizer_name: "Flat Organizer",
      venue: null,
      organizer: null,
      instructors: [],
      school: null,
    });
    expect(result).toEqual(emptyEntityCandidates());
  });

  it("derives a venue and organizer name from a legacy flat extraction only", () => {
    const result = extractionEntityCandidates({
      ...BASE_EXTRACTION,
      venue_name: "Havana Club",
      address: "288 Green St",
      city: "Cambridge",
      organizer_name: "Salsa Segura",
      instagram: "@eventcontact",
      website: "https://eventcontact.example",
    });
    expect(result.venue).toEqual(
      candidate("Havana Club", { address: "288 Green St", city: "Cambridge" })
    );
    // The flat instagram/website are the event's contact, never an organizer's.
    expect(result.organizer).toEqual(candidate("Salsa Segura"));
    expect(result.instructors).toEqual([]);
    expect(result.school).toBeNull();
  });

  it("never invents entities from an extraction with no entity data", () => {
    expect(
      extractionEntityCandidates({
        ...BASE_EXTRACTION,
        instagram: "@eventcontact",
        website: "https://eventcontact.example",
        address: "288 Green St",
        city: "Cambridge",
      })
    ).toEqual(emptyEntityCandidates());
  });

  it("re-sanitizes structured data from fixtures", () => {
    const result = extractionEntityCandidates({
      ...BASE_EXTRACTION,
      venue: candidate("  "),
      instructors: [candidate("Ana"), candidate("ana")],
    });
    expect(result.venue).toBeNull();
    expect(result.instructors).toHaveLength(1);
  });
});

describe("parseEntityReview", () => {
  const matched = {
    candidate: candidate("Havana Club"),
    state: "MATCHED",
    matches: [
      { id: "11111111-1111-4111-8111-111111111111", name: "Havana Club", city: "Cambridge" },
    ],
    decision: "existing",
    selected_id: "11111111-1111-4111-8111-111111111111",
  };

  it("parses a full review and normalizes match fields", () => {
    const review = parseEntityReview({
      venue: matched,
      organizer: null,
      instructors: [{ ...matched, candidate: candidate("Ana"), state: "NEW", matches: [] }],
      school: null,
    });
    expect(review.venue).toEqual({
      candidate: candidate("Havana Club"),
      state: "MATCHED",
      matches: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Havana Club",
          address: null,
          city: "Cambridge",
          state_region: null,
          website: null,
          instagram: null,
        },
      ],
      decision: "existing",
      selected_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(review.organizer).toBeNull();
    expect(review.instructors).toHaveLength(1);
  });

  it("rejects a structurally wrong response", () => {
    expect(() => parseEntityReview(null)).toThrow("Invalid entity review");
    expect(() => parseEntityReview([])).toThrow("Invalid entity review");
    expect(() =>
      parseEntityReview({ venue: null, organizer: null, instructors: "no", school: null })
    ).toThrow("Invalid entity review");
    expect(() =>
      parseEntityReview({
        venue: { ...matched, state: "WHATEVER" },
        organizer: null,
        instructors: [],
        school: null,
      })
    ).toThrow("Invalid entity review");
    expect(() =>
      parseEntityReview({
        venue: { ...matched, decision: "maybe" },
        organizer: null,
        instructors: [],
        school: null,
      })
    ).toThrow("Invalid entity review");
    expect(() =>
      parseEntityReview({
        venue: { ...matched, matches: [{ name: "No id" }] },
        organizer: null,
        instructors: [],
        school: null,
      })
    ).toThrow("Invalid entity review");
  });

  it("never trusts an existing decision without a selected id, or a stray selected id", () => {
    const review = parseEntityReview({
      venue: { ...matched, selected_id: null },
      organizer: {
        ...matched,
        decision: "new",
        selected_id: "11111111-1111-4111-8111-111111111111",
      },
      instructors: [],
      school: null,
    });
    expect(review.venue?.decision).toBe("pending");
    expect(review.venue?.selected_id).toBeNull();
    expect(review.organizer?.decision).toBe("new");
    expect(review.organizer?.selected_id).toBeNull();
  });

  it("retains deliberate choices on reload but never confirms an undecided item", () => {
    const review = parseEntityReview({
      venue: { ...matched, explicit: true, moderator_confirmed: true },
      organizer: { ...matched, decision: "pending", explicit: true, moderator_confirmed: true },
    });
    expect(review.venue?.explicit).toBe(true);
    expect(review.venue?.moderator_confirmed).toBe(true);
    expect(review.organizer?.explicit).toBeUndefined();
    expect(review.organizer?.moderator_confirmed).toBeUndefined();
    const refreshed = mergeEntityReview(
      review,
      { ...emptyEntityCandidates(), venue: candidate("Havana Club") },
      emptyEntityReview()
    );
    expect(refreshed.venue?.selected_id).toBe(matched.selected_id);
  });

  it("treats missing slots as empty", () => {
    expect(parseEntityReview({})).toEqual(emptyEntityReview());
  });
});

describe("parseEntityMatches", () => {
  it("accepts an array or a { matches } wrapper and drops unreadable rows", () => {
    const rows = [
      { id: ALPHA_ID, name: "Alpha", website: "alpha.example", instagram: "@alpha" },
      { id: "", name: "No id" },
      { id: "not-a-uuid", name: "Bad id" },
      { id: BETA_ID },
      "junk",
    ];
    const expected = [
      {
        id: ALPHA_ID,
        name: "Alpha",
        address: null,
        city: null,
        state_region: null,
        website: "https://alpha.example",
        instagram: "@alpha",
      },
    ];
    expect(parseEntityMatches(rows)).toEqual(expected);
    expect(parseEntityMatches({ matches: rows })).toEqual(expected);
    expect(parseEntityMatches(null)).toEqual([]);
  });

  it("caps the number of matches", () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      name: `N${index}`,
    }));
    expect(parseEntityMatches(rows).length).toBeLessThanOrEqual(25);
  });

  it("rejects a review whose selected id or match id is not a uuid", () => {
    const base = {
      candidate: candidate("Havana Club"),
      state: "MATCHED",
      matches: [{ id: ALPHA_ID, name: "Havana Club" }],
      decision: "existing",
    };
    const review = parseEntityReview({
      venue: { ...base, selected_id: "'; drop table venues; --" },
      organizer: null,
      instructors: [],
      school: null,
    });
    expect(review.venue?.decision).toBe("pending");
    expect(review.venue?.selected_id).toBeNull();
    expect(() =>
      parseEntityReview({
        venue: { ...base, matches: [{ id: "x", name: "Havana Club" }], selected_id: ALPHA_ID },
        organizer: null,
        instructors: [],
        school: null,
      })
    ).toThrow("Invalid entity review");
  });
});

describe("mergeEntityReview — repeat extraction never overwrites user work", () => {
  const extracted = {
    venue: candidate("Havana Club"),
    organizer: candidate("Salsa Segura"),
    instructors: [candidate("Ana"), candidate("Luis")],
    school: candidate("Mambo Co"),
  };

  it("refreshes automatic matches and removes them with the flyer", () => {
    const automatic = review({
      venue: item("Havana Club", { state: "MATCHED", decision: "existing", selected_id: ALPHA_ID }),
    });
    expect(
      mergeEntityReview(automatic, extracted, review({ venue: item("Correct venue") })).venue
        ?.candidate.name
    ).toBe("Correct venue");
    expect(mergeEntityReview(automatic, extracted, emptyEntityReview()).venue).toBeNull();
  });

  it("keeps edited instructor origins stable over three extractions", () => {
    const edited = review({ instructors: [item("Ana"), item("Luis Ortiz")] });
    const second = mergeEntityReview(edited, extracted, review());
    const third = mergeEntityReview(
      second,
      extracted,
      review({ instructors: [item("Anna"), item("Luis")] })
    );
    expect(third.instructors.map((entry) => entry.candidate.name).sort()).toEqual([
      "Anna",
      "Luis Ortiz",
    ]);
  });

  it("never assigns a flyer origin to a manual instructor on retry", () => {
    const incoming = review({ instructors: [item("Ana")] });
    const first = mergeEntityReview(
      review({ instructors: [item("Manual", { decision: "new" })] }),
      null,
      incoming
    );
    const next = mergeEntityReview(
      parseEntityReview(first),
      { ...emptyEntityCandidates(), instructors: [candidate("Ana")] },
      incoming
    );
    expect(next.instructors.map((entry) => entry.candidate.name)).toEqual(["Manual", "Ana"]);
  });

  it("keeps same-name instructors with conflicting geographic context", () => {
    const result = normalizeEntityCandidates({
      ...emptyEntityCandidates(),
      instructors: [
        candidate("Jane Dancer", { city: "Springfield", state_region: "MA" }),
        candidate("Jane Dancer", { city: "Springfield", state_region: "IL" }),
      ],
    });
    expect(result.instructors.map((entry) => entry.state_region)).toEqual(["MA", "IL"]);
  });

  function review(overrides: Partial<EntityReview> = {}): EntityReview {
    return {
      venue: item("Havana Club"),
      organizer: item("Salsa Segura"),
      instructors: [item("Ana"), item("Luis")],
      school: item("Mambo Co"),
      ...overrides,
    };
  }

  it("refreshes untouched pending slots with the new reconciliation", () => {
    const incoming = review({
      venue: item("Havana Club", {
        state: "POSSIBLE MATCH",
        matches: [{ id: "11111111-1111-4111-8111-111111111111", name: "Havana" }],
      }),
    });
    const merged = mergeEntityReview(review(), extracted, incoming);
    expect(merged.venue?.state).toBe("POSSIBLE MATCH");
    expect(merged.venue?.matches).toHaveLength(1);
  });

  it("keeps a slot whose candidate text the user edited", () => {
    const current = review({ venue: item("Havana Club Cambridge", {}, { city: "Cambridge" }) });
    const incoming = review({
      venue: item("Havana Club", {
        state: "MATCHED",
        decision: "existing",
        selected_id: "99999999-9999-4999-8999-999999999999",
      }),
    });
    const merged = mergeEntityReview(current, extracted, incoming);
    expect(merged.venue).toEqual(current.venue);
  });

  it("keeps a slot the user decided on, even with unchanged text", () => {
    const decided = item("Salsa Segura", {
      decision: "existing",
      selected_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const removed = item("Mambo Co", { decision: "removed" });
    const merged = mergeEntityReview(
      review({ organizer: decided, school: removed }),
      extracted,
      review({ organizer: item("Salsa Segura", { decision: "new" }), school: item("Mambo Co") })
    );
    expect(merged.organizer).toEqual(decided);
    expect(merged.school).toEqual(removed);
  });

  it("keeps a user-created slot that the flyer never produced", () => {
    const manual = item("My Venue", { decision: "new" });
    const merged = mergeEntityReview(
      review({ venue: manual }),
      { ...extracted, venue: null },
      review()
    );
    expect(merged.venue).toEqual(manual);
  });

  it("fills a slot the user never had", () => {
    const merged = mergeEntityReview(
      review({ school: null }),
      { ...extracted, school: null },
      review()
    );
    expect(merged.school?.candidate.name).toBe("Mambo Co");
  });

  it("merges instructors: keeps touched ones, refreshes untouched, appends new, never duplicates", () => {
    const edited = item("Ana Rivera", {}, { instagram: "@ana" });
    const decided = item("Luis", {
      decision: "existing",
      selected_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    const current = review({ instructors: [edited, decided, item("Zed")] });
    const incoming = review({
      instructors: [
        item("Ana"),
        item("Luis", { decision: "new" }),
        item("Marta", { state: "POSSIBLE MATCH" }),
      ],
    });
    const merged = mergeEntityReview(
      current,
      { ...extracted, instructors: [candidate("Ana"), candidate("Luis"), candidate("Zed")] },
      incoming
    );
    expect(merged.instructors.map((entry) => entry.candidate.name)).toEqual([
      "Ana Rivera",
      "Luis",
      "Marta",
    ]);
    expect(merged.instructors[1]?.selected_id).toBe(decided.selected_id);
  });

  it("does not drop an instructor the user added by hand", () => {
    const manual = item("Handmade", { decision: "new" });
    const merged = mergeEntityReview(
      review({ instructors: [manual] }),
      { ...extracted, instructors: [] },
      review({ instructors: [item("Ana")] })
    );
    expect(merged.instructors.map((entry) => entry.candidate.name)).toEqual(["Handmade", "Ana"]);
  });
});
